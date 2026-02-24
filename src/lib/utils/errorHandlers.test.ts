/**
 * Tests for error handler utilities
 */

import { describe, it, expect } from 'vitest'
import {
  isError,
  getErrorMessage,
  RateLimitError,
  AuthenticationError,
  isRateLimitError,
  isAuthError,
  isAbortError
} from './errorHandlers'

describe('isError', () => {
  it('should identify Error instances', () => {
    expect(isError(new Error('test'))).toBe(true)
    expect(isError(new TypeError('test'))).toBe(true)
  })

  it('should reject non-Error types', () => {
    expect(isError('error string')).toBe(false)
    expect(isError({ message: 'error' })).toBe(false)
    expect(isError(null)).toBe(false)
    expect(isError(undefined)).toBe(false)
  })
})

describe('getErrorMessage', () => {
  it('should extract message from Error', () => {
    const error = new Error('Test error')
    expect(getErrorMessage(error)).toBe('Test error')
  })

  it('should return string directly', () => {
    expect(getErrorMessage('Error string')).toBe('Error string')
  })

  it('should return default message for unknown types', () => {
    expect(getErrorMessage(null)).toBe('An unknown error occurred')
    expect(getErrorMessage(undefined)).toBe('An unknown error occurred')
    expect(getErrorMessage(123)).toBe('An unknown error occurred')
  })
})

describe('RateLimitError', () => {
  it('should create error with retry time', () => {
    const error = new RateLimitError(60)
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('RateLimitError')
    expect(error.message).toBe('RATE_LIMITED')
    expect(error.retryAfterSeconds).toBe(60)
  })
})

describe('AuthenticationError', () => {
  it('should create auth error', () => {
    const error = new AuthenticationError('Invalid token')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('AuthenticationError')
    expect(error.message).toBe('Invalid token')
  })

  it('should use default message', () => {
    const error = new AuthenticationError()
    expect(error.message).toBe('Authentication failed')
  })
})

describe('isRateLimitError', () => {
  it('should identify RateLimitError', () => {
    expect(isRateLimitError(new RateLimitError(30))).toBe(true)
    expect(isRateLimitError(new Error('test'))).toBe(false)
  })
})

describe('isAuthError', () => {
  it('should identify AuthenticationError', () => {
    expect(isAuthError(new AuthenticationError())).toBe(true)
    expect(isAuthError(new Error('test'))).toBe(false)
  })
})

describe('isAbortError', () => {
  it('should identify AbortError', () => {
    const abortError = new DOMException('Aborted', 'AbortError')
    expect(isAbortError(abortError)).toBe(true)
    expect(isAbortError(new Error('test'))).toBe(false)
  })
})
