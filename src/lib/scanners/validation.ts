/**
 * API Key validation module
 */

import type { KeyStatus } from './types'
import { logger } from '../utils/logger'
import { logError } from '../utils/errorHandlers'

const VALIDATION_ENDPOINTS: Record<string, {
  url: string
  method?: string
  body?: unknown
  headers: (key: string) => Record<string, string>
}> = {
  anthropic: {
    url: '/api/anthropic/messages',
    method: 'POST',
    body: { model: 'claude-3-haiku-20240307', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] },
    headers: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }),
  },
  openai: {
    url: '/api/openai/models',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
  google: {
    url: '/api/google/models',
    headers: () => ({ 'Content-Type': 'application/json' }),
  },
  openrouter: {
    url: '/api/openrouter/auth/key',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
  xai: {
    url: '/api/xai/models',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
  groq: {
    url: '/api/groq/models',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
  cerebras: {
    url: '/api/cerebras/models',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
}

/**
 * Validate an API key by making a lightweight request to the provider's API
 */
export async function validateKey(key: string, provider: string): Promise<KeyStatus> {
  const endpoint = VALIDATION_ENDPOINTS[provider]
  if (!endpoint) {
    logger.warn(`No validation endpoint for provider: ${provider}`)
    return 'error'
  }

  try {
    // Google uses query param for key
    const url = provider === 'google'
      ? `${endpoint.url}?key=${key}`
      : endpoint.url

    const fetchOptions: RequestInit = {
      method: endpoint.method || 'GET',
      headers: endpoint.headers(key),
    }

    if (endpoint.body) {
      fetchOptions.body = JSON.stringify(endpoint.body)
    }

    const response = await fetch(url, fetchOptions)

    if (response.ok) {
      logger.info(`Key validated for ${provider}`)
      return 'valid'
    }
    if (response.status === 401 || response.status === 403) return 'invalid'
    if (response.status === 429) return 'rate_limited'
    return 'invalid'
  } catch (err) {
    logError(`validateKey:${provider}`, err)
    return 'error'
  }
}
