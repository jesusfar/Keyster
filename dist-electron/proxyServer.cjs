"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProxyKeys = updateProxyKeys;
exports.startLocalProxy = startLocalProxy;
exports.stopLocalProxy = stopLocalProxy;
const express_1 = __importDefault(require("express"));
const http_proxy_middleware_1 = require("http-proxy-middleware");
const cors_1 = __importDefault(require("cors"));
const state = {
    server: null,
    port: 8080,
    activeKeys: {},
    currentKeyIndex: {}
};
function updateProxyKeys(keys) {
    state.activeKeys = keys;
    // reset indexes for newly updated providers
    for (const provider of Object.keys(keys)) {
        if (state.currentKeyIndex[provider] === undefined) {
            state.currentKeyIndex[provider] = 0;
        }
        else if (state.currentKeyIndex[provider] >= keys[provider].length) {
            state.currentKeyIndex[provider] = 0;
        }
    }
}
function getNextKey(provider) {
    const keys = state.activeKeys[provider];
    if (!keys || keys.length === 0)
        return null;
    if (state.currentKeyIndex[provider] === undefined) {
        state.currentKeyIndex[provider] = 0;
    }
    const index = state.currentKeyIndex[provider] % keys.length;
    return keys[index];
}
function rotateKey(provider) {
    const keys = state.activeKeys[provider];
    if (keys && keys.length > 0) {
        state.currentKeyIndex[provider] = (state.currentKeyIndex[provider] + 1) % keys.length;
    }
}
function startLocalProxy(port, onLog) {
    return new Promise((resolve) => {
        if (state.server) {
            onLog('Proxy is already running.');
            resolve(true);
            return;
        }
        state.port = port;
        const app = (0, express_1.default)();
        app.use((0, cors_1.default)());
        // Anthropic Proxy
        app.use('/anthropic', (0, http_proxy_middleware_1.createProxyMiddleware)({
            target: 'https://api.anthropic.com',
            changeOrigin: true,
            pathRewrite: { '^/anthropic': '' },
            on: {
                proxyReq: (proxyReq, req, _res) => {
                    const key = getNextKey('anthropic');
                    if (key) {
                        proxyReq.setHeader('x-api-key', key);
                        proxyReq.setHeader('anthropic-version', '2023-06-01');
                    }
                    if (req.body) {
                        (0, http_proxy_middleware_1.fixRequestBody)(proxyReq, req);
                    }
                },
                proxyRes: (proxyRes, _req, _res) => {
                    if (proxyRes.statusCode === 429) {
                        onLog(`[Anthropic] Rate limited (429). Rotating key...`);
                        rotateKey('anthropic');
                    }
                }
            }
        }));
        // OpenAI Proxy
        app.use('/openai', (0, http_proxy_middleware_1.createProxyMiddleware)({
            target: 'https://api.openai.com/v1',
            changeOrigin: true,
            pathRewrite: { '^/openai': '' },
            on: {
                proxyReq: (proxyReq, req, _res) => {
                    const key = getNextKey('openai');
                    if (key) {
                        proxyReq.setHeader('Authorization', `Bearer ${key}`);
                    }
                    if (req.body) {
                        (0, http_proxy_middleware_1.fixRequestBody)(proxyReq, req);
                    }
                },
                proxyRes: (proxyRes, _req, _res) => {
                    if (proxyRes.statusCode === 429) {
                        onLog(`[OpenAI] Rate limited (429). Rotating key...`);
                        rotateKey('openai');
                    }
                }
            }
        }));
        const server = app.listen(port, () => {
            onLog(`Local Proxy Server started on http://localhost:${port}`);
            onLog(`Available endpoints:`);
            onLog(`- Anthropic: http://localhost:${port}/anthropic`);
            onLog(`- OpenAI: http://localhost:${port}/openai`);
            resolve(true);
        });
        server.on('error', (err) => {
            onLog(`Proxy Error: ${err.message}`);
            resolve(false);
        });
        state.server = server;
    });
}
function stopLocalProxy() {
    return new Promise((resolve) => {
        if (!state.server) {
            resolve(true);
            return;
        }
        state.server.close(() => {
            state.server = null;
            resolve(true);
        });
    });
}
