/**
 * API Key validation module — single source of truth for key validation
 * Supports basic access check + premium tier detection
 */

import type { KeyStatus } from './types'
import { logger } from '../utils/logger'

interface ValidationConfig {
  url: string
  method?: string
  body?: unknown
  headers: (key: string) => Record<string, string>
  premiumUrl?: string
  premiumMethod?: string
  premiumBody?: unknown
}

const VALIDATION_ENDPOINTS: Record<string, ValidationConfig> = {
  anthropic: {
    url: '/api/anthropic/messages',
    method: 'POST',
    body: { model: 'claude-3-haiku-20240307', max_tokens: 1, messages: [{role: 'user', content: 'hi'}] },
    headers: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }),
    premiumUrl: '/api/anthropic/messages',
    premiumMethod: 'POST',
    premiumBody: { model: 'claude-3-opus-20240229', max_tokens: 1, messages: [{role: 'user', content: 'hi'}] }
  },
  openai: {
    url: '/api/openai/models',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
    premiumUrl: '/api/openai/chat/completions',
    premiumMethod: 'POST',
    premiumBody: { model: 'gpt-4', max_tokens: 1, messages: [{role: 'user', content: 'hi'}] }
  },
  google: {
    url: '/api/google/models/gemini-1.5-flash:generateContent',
    method: 'POST',
    body: { contents: [{ parts: [{ text: "hi" }] }] },
    headers: () => ({ 'Content-Type': 'application/json' }),
    premiumUrl: '/api/google/models/gemini-1.5-pro:generateContent',
    premiumMethod: 'POST',
    premiumBody: { contents: [{ parts: [{ text: "hi" }] }] }
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
 * Validate an API key by making a lightweight request to the provider's API.
 * Supports two-step validation: basic access check, then premium tier detection.
 */
export async function validateKey(key: string, provider: string): Promise<KeyStatus> {
  const endpoint = VALIDATION_ENDPOINTS[provider]
  if (!endpoint) {
    logger.warn(`No validation endpoint for provider: ${provider}`)
    return 'error'
  }

  const doRequest = async (urlSuffix: string, method?: string, bodyObj?: unknown) => {
    const url = provider === 'google' ? `${urlSuffix}?key=${key}` : urlSuffix
    const fetchOptions: RequestInit = {
      method: method || 'GET',
      headers: endpoint.headers(key),
    }
    if (bodyObj) fetchOptions.body = JSON.stringify(bodyObj)

    const response = await fetch(url, fetchOptions)
    if (response.ok) return 'ok'
    if (response.status === 401 || response.status === 403) return 'invalid'
    if (response.status === 429) return 'rate_limited'
    return 'error'
  }

  try {
    // 1. Test basic access
    const basicRes = await doRequest(endpoint.url, endpoint.method, endpoint.body)
    if (basicRes === 'rate_limited') return 'rate_limited'
    if (basicRes === 'invalid') return 'invalid'
    if (basicRes === 'error') return 'valid' // Fallback for providers that might fail normal model check but key format is right

    if (basicRes === 'ok') {
      // 2. Test Premium access if available
      if (endpoint.premiumUrl) {
        const premiumRes = await doRequest(endpoint.premiumUrl, endpoint.premiumMethod, endpoint.premiumBody)
        if (premiumRes === 'ok') return 'valid-premium'
        return 'valid-standard' // Has basic, failed premium (e.g. rate limit / tier restriction on Opus/GPT4)
      }
      return 'valid' // Provider without tiers
    }
  } catch {
    return 'error'
  }
  return 'error'
}
