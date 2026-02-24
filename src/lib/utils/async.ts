/**
 * Async utilities for rate limiting and retries
 */

import { CONFIG } from '../config'
import { RateLimitError, isAbortError, logError } from './errorHandlers'

/**
 * Sleep with optional abort signal support
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms)
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timeout)
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }
      signal.addEventListener('abort', () => {
        clearTimeout(timeout)
        reject(new DOMException('Aborted', 'AbortError'))
      }, { once: true })
    }
  })
}

interface RetryOptions<T> {
  maxRetries?: number
  baseDelay?: number
  signal?: AbortSignal
  onRetry?: (attempt: number, error: unknown) => void
  shouldRetry?: (error: unknown) => boolean
}

/**
 * Generic retry function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions<T> = {}
): Promise<T> {
  const {
    maxRetries = CONFIG.RATE_LIMIT.MAX_RETRY_ATTEMPTS,
    baseDelay = 1000,
    signal,
    onRetry,
    shouldRetry = () => true,
  } = options

  let lastError: unknown

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err

      // Don't retry on abort or if shouldRetry returns false
      if (isAbortError(err) || !shouldRetry(err)) {
        throw err
      }

      // If this was the last attempt, throw
      if (attempt === maxRetries - 1) {
        throw err
      }

      // Notify about retry
      onRetry?.(attempt + 1, err)

      // Wait with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt)
      await sleep(delay, signal)
    }
  }

  throw lastError
}

/**
 * Process items in batches with controlled concurrency
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    batchSize?: number
    delayBetweenBatches?: number
    signal?: AbortSignal
  } = {}
): Promise<R[]> {
  const {
    batchSize = CONFIG.RATE_LIMIT.BATCH_SIZE,
    delayBetweenBatches = CONFIG.RATE_LIMIT.BATCH_DELAY_MS,
    signal
  } = options

  const results: R[] = []

  for (let i = 0; i < items.length; i += batchSize) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(processor))
    results.push(...batchResults)

    // Delay between batches (except after last batch)
    if (i + batchSize < items.length) {
      await sleep(delayBetweenBatches, signal)
    }
  }

  return results
}

/**
 * Simple promise-based concurrency limiter
 */
export class PromisePool {
  private queue: Array<() => Promise<void>> = []
  private running = 0

  constructor(private concurrency: number) {}

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn()
          resolve(result)
        } catch (err) {
          reject(err)
        }
      })
      this.run()
    })
  }

  private async run() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift()
      if (!task) break

      this.running++
      task().finally(() => {
        this.running--
        this.run()
      })
    }
  }
}

/**
 * Handle rate limit errors with automatic retry
 */
export async function handleRateLimit(
  error: unknown,
  signal?: AbortSignal
): Promise<void> {
  if (error instanceof RateLimitError) {
    const waitSec = Math.min(error.retryAfterSeconds, 90)
    logError('RateLimit', `Waiting ${waitSec}s before retry`)
    await sleep(waitSec * 1000, signal)
  } else {
    throw error
  }
}
