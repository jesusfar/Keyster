/**
 * Utilities for extracting and validating API keys
 */

import { CONFIG } from '../config'
import { logger } from './logger'

/**
 * Calculate Shannon Entropy of a string to detect cryptographically random keys
 * vs repeating characters (e.g. sk-xxxxxxxxxxxxxxxx)
 */
export function calculateEntropy(str: string): number {
  const len = str.length
  if (len === 0) return 0

  const frequencies: Record<string, number> = {}
  for (let i = 0; i < len; i++) {
    const char = str[i]
    frequencies[char] = (frequencies[char] || 0) + 1
  }

  return Object.values(frequencies).reduce((entropy, count) => {
    const p = count / len
    return entropy - p * Math.log2(p)
  }, 0)
}

/**
 * Heuristic: skip obviously fake/example keys and low-entropy strings
 */
export function isFakeKey(key: string): boolean {
  const lower = key.toLowerCase()
  const fakePatterns = [
    'xxxx', '0000', '1111', '2222', '3333', '4444', '5555',
    'test', 'example', 'demo', 'fake', 'placeholder', 'your_',
    'insert', 'replace', 'abcdef', '123456', 'sample', 'dummy',
    'todo', 'fixme', 'changeme', 'secret', 'mykey', 'my_key',
    'put_your', 'enter_your', 'add_your', 'your-api', 'key_here'
  ]

  if (fakePatterns.some(p => lower.includes(p))) {
    logger.debug('Rejecting fake key pattern:', key.substring(0, 20))
    return true
  }

  // Calculate entropy of the key part (ignoring prefixes like sk-ant-)
  // If entropy is below threshold, it's highly likely to be a fake repetitive string
  const entropy = calculateEntropy(key)
  if (entropy < CONFIG.VALIDATION.MIN_ENTROPY && key.length > CONFIG.VALIDATION.MIN_KEY_LENGTH) {
    logger.debug('Rejecting low entropy key:', key.substring(0, 20), 'entropy:', entropy)
    return true
  }

  return false
}

/**
 * Extract API keys from text using regex patterns
 */
export function extractKeysFromText(text: string, patterns: RegExp[]): string[] {
  const keys = new Set<string>()

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, 'g')
    let match
    while ((match = regex.exec(text)) !== null) {
      const key = match[0]
      if (!isFakeKey(key)) {
        keys.add(key)
      }
    }
  }

  return Array.from(keys)
}
