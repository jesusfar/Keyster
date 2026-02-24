/**
 * Type-safe error handling utilities
 */

import { logger } from './logger'

export function isError(err: unknown): err is Error {
  return err instanceof Error
}

export function getErrorMessage(err: unknown): string {
  if (isError(err)) {
    return err.message
  }
  if (typeof err === 'string') {
    return err
  }
  return 'An unknown error occurred'
}

export function logError(context: string, err: unknown) {
  const message = getErrorMessage(err)
  logger.error(`[${context}]`, message, err)
}

export class RateLimitError extends Error {
  retryAfterSeconds: number

  constructor(retryAfterSeconds: number) {
    super('RATE_LIMITED')
    this.name = 'RateLimitError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export class AuthenticationError extends Error {
  constructor(message = 'Authentication failed') {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export function isRateLimitError(err: unknown): err is RateLimitError {
  return err instanceof RateLimitError
}

export function isAuthError(err: unknown): err is AuthenticationError {
  return err instanceof AuthenticationError
}

export function isAbortError(err: unknown): boolean {
  return isError(err) && err.name === 'AbortError'
}
