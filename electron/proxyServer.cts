import express, { Request } from 'express'
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware'
import cors from 'cors'
import type { Server } from 'http'

interface ProxyState {
  server: Server | null
  port: number
  activeKeys: Record<string, string[]> // e.g. { 'anthropic': ['sk-ant-1...', 'sk-ant-2...'] }
  currentKeyIndex: Record<string, number> // track which key we're using
}

const state: ProxyState = {
  server: null,
  port: 8080,
  activeKeys: {},
  currentKeyIndex: {}
}

export function updateProxyKeys(keys: Record<string, string[]>) {
  state.activeKeys = keys
  // reset indexes for newly updated providers
  for (const provider of Object.keys(keys)) {
    if (state.currentKeyIndex[provider] === undefined) {
      state.currentKeyIndex[provider] = 0
    } else if (state.currentKeyIndex[provider] >= keys[provider].length) {
      state.currentKeyIndex[provider] = 0
    }
  }
}

function getNextKey(provider: string): string | null {
  const keys = state.activeKeys[provider]
  if (!keys || keys.length === 0) return null

  if (state.currentKeyIndex[provider] === undefined) {
    state.currentKeyIndex[provider] = 0
  }
  const index = state.currentKeyIndex[provider] % keys.length
  return keys[index]
}

function rotateKey(provider: string) {
  const keys = state.activeKeys[provider]
  if (keys && keys.length > 0) {
    state.currentKeyIndex[provider] = (state.currentKeyIndex[provider] + 1) % keys.length
  }
}

export function startLocalProxy(port: number, onLog: (msg: string) => void): Promise<boolean> {
  return new Promise((resolve) => {
    if (state.server) {
      onLog('Proxy is already running.')
      resolve(true)
      return
    }

    state.port = port
    const app = express()
    app.use(cors())

    // Anthropic Proxy
    app.use('/anthropic', createProxyMiddleware({
      target: 'https://api.anthropic.com',
      changeOrigin: true,
      pathRewrite: { '^/anthropic': '' },
      on: {
        proxyReq: (proxyReq, req, _res) => {
          const key = getNextKey('anthropic')
          if (key) {
            proxyReq.setHeader('x-api-key', key)
            proxyReq.setHeader('anthropic-version', '2023-06-01')
          }
          if ((req as Request).body) {
              fixRequestBody(proxyReq, req);
          }
        },
        proxyRes: (proxyRes, _req, _res) => {
           if (proxyRes.statusCode === 429) {
               onLog(`[Anthropic] Rate limited (429). Rotating key...`)
               rotateKey('anthropic')
           }
        }
      }
    }))

    // OpenAI Proxy
    app.use('/openai', createProxyMiddleware({
      target: 'https://api.openai.com/v1',
      changeOrigin: true,
      pathRewrite: { '^/openai': '' },
      on: {
        proxyReq: (proxyReq, req, _res) => {
          const key = getNextKey('openai')
          if (key) {
            proxyReq.setHeader('Authorization', `Bearer ${key}`)
          }
          if ((req as Request).body) {
              fixRequestBody(proxyReq, req);
          }
        },
        proxyRes: (proxyRes, _req, _res) => {
           if (proxyRes.statusCode === 429) {
               onLog(`[OpenAI] Rate limited (429). Rotating key...`)
               rotateKey('openai')
           }
        }
      }
    }))

    const server = app.listen(port, () => {
      onLog(`Local Proxy Server started on http://localhost:${port}`)
      onLog(`Available endpoints:`)
      onLog(`- Anthropic: http://localhost:${port}/anthropic`)
      onLog(`- OpenAI: http://localhost:${port}/openai`)
      resolve(true)
    })

    server.on('error', (err) => {
      onLog(`Proxy Error: ${err.message}`)
      resolve(false)
    })

    state.server = server
  })
}

export function stopLocalProxy(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!state.server) {
      resolve(true)
      return
    }

    state.server.close(() => {
      state.server = null
      resolve(true)
    })
  })
}
