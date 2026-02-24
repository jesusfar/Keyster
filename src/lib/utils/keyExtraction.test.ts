/**
 * Tests for key extraction utilities
 */

import { describe, it, expect } from 'vitest'
import { calculateEntropy, isFakeKey, extractKeysFromText } from './keyExtraction'

describe('calculateEntropy', () => {
  it('should return 0 for empty string', () => {
    expect(calculateEntropy('')).toBe(0)
  })

  it('should return low entropy for repetitive strings', () => {
    const entropy = calculateEntropy('xxxxxxxxxxxxxxxxxxxxxxxx')
    expect(entropy).toBeLessThan(1)
  })

  it('should return high entropy for random strings', () => {
    const entropy = calculateEntropy('sk-ant-api03-abc123XYZ789_-randomchars')
    expect(entropy).toBeGreaterThan(3)
  })
})

describe('isFakeKey', () => {
  it('should detect obvious fake patterns', () => {
    expect(isFakeKey('sk-xxxxxxxxxxxxxxxxxxxx')).toBe(true)
    expect(isFakeKey('test-key-12345')).toBe(true)
    expect(isFakeKey('example-api-key')).toBe(true)
    expect(isFakeKey('your_api_key_here')).toBe(true)
  })

  it('should detect low entropy keys', () => {
    expect(isFakeKey('sk-0000000000000000000000000')).toBe(true)
    expect(isFakeKey('AIzaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(true)
  })

  it('should not flag valid-looking keys', () => {
    expect(isFakeKey('sk-ant-api03-J8fK3mN9pQ2rT6vX1yZ4bC7dF0gH5jL8nM3pR6sV9wY2aE5hK')).toBe(false)
    expect(isFakeKey('AIzaSyDx7_K9mP3nQ8rT1vW4yX6zA2bC5dF7gH0jL')).toBe(false)
  })
})

describe('extractKeysFromText', () => {
  it('should extract API keys matching patterns', () => {
    const text = 'ANTHROPIC_API_KEY=sk-ant-api03-randomkey123456789'
    const patterns = [/sk-ant-api03-[A-Za-z0-9_-]{20,}/g]

    const keys = extractKeysFromText(text, patterns)
    expect(keys).toHaveLength(1)
    expect(keys[0]).toContain('sk-ant-api03-')
  })

  it('should filter out fake keys', () => {
    const text = 'OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx'
    const patterns = [/sk-[a-zA-Z0-9]{20,}/g]

    const keys = extractKeysFromText(text, patterns)
    expect(keys).toHaveLength(0)
  })

  it('should extract multiple keys', () => {
    const text = `
      ANTHROPIC_API_KEY=sk-ant-abc123def456
      OPENAI_API_KEY=sk-proj-xyz789abc123def456ghi789
    `
    const patterns = [
      /sk-ant-[A-Za-z0-9_-]{12,}/g,
      /sk-proj-[A-Za-z0-9_-]{20,}/g,
    ]

    const keys = extractKeysFromText(text, patterns)
    expect(keys.length).toBeGreaterThan(0)
  })

  it('should not extract duplicate keys', () => {
    const text = `
      key1=sk-ant-abc123def456
      key2=sk-ant-abc123def456
    `
    const patterns = [/sk-ant-[A-Za-z0-9_-]{12,}/g]

    const keys = extractKeysFromText(text, patterns)
    expect(keys).toHaveLength(1)
  })
})
