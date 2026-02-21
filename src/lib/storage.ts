import type { Provider } from './api'

const STORAGE_KEYS_PREFIX = 'keyster_api_key_'

export function saveApiKey(provider: Provider, key: string) {
  localStorage.setItem(`${STORAGE_KEYS_PREFIX}${provider}`, key)
}

export function getApiKey(provider: Provider): string | null {
  return localStorage.getItem(`${STORAGE_KEYS_PREFIX}${provider}`)
}

export function clearApiKey(provider: Provider) {
  localStorage.removeItem(`${STORAGE_KEYS_PREFIX}${provider}`)
}
