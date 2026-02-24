/**
 * Tests for async utilities
 */

import { describe, it, expect, vi } from 'vitest'
import { sleep, withRetry, processBatch, PromisePool } from './async'

describe('sleep', () => {
  it('should resolve after specified time', async () => {
    const start = Date.now()
    await sleep(100)
    const elapsed = Date.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(90) // Allow some variance
  })

  it('should reject when signal is aborted', async () => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 50)

    await expect(sleep(200, controller.signal)).rejects.toThrow('Aborted')
  })
})

describe('withRetry', () => {
  it('should succeed on first try', async () => {
    const fn = vi.fn().mockResolvedValue('success')
    const result = await withRetry(fn)

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry on failure', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValue('success')

    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10 })

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should throw after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent failure'))

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelay: 10 })
    ).rejects.toThrow('persistent failure')

    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should not retry if shouldRetry returns false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('do not retry'))

    await expect(
      withRetry(fn, {
        maxRetries: 3,
        shouldRetry: () => false,
        baseDelay: 10
      })
    ).rejects.toThrow('do not retry')

    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('processBatch', () => {
  it('should process all items', async () => {
    const items = [1, 2, 3, 4, 5]
    const processor = vi.fn((x: number) => Promise.resolve(x * 2))

    const results = await processBatch(items, processor, {
      batchSize: 2,
      delayBetweenBatches: 10
    })

    expect(results).toEqual([2, 4, 6, 8, 10])
    expect(processor).toHaveBeenCalledTimes(5)
  })

  it('should respect abort signal', async () => {
    const items = [1, 2, 3, 4, 5]
    const processor = vi.fn((x: number) => Promise.resolve(x * 2))
    const controller = new AbortController()

    setTimeout(() => controller.abort(), 50)

    await expect(
      processBatch(items, processor, {
        batchSize: 1,
        delayBetweenBatches: 100,
        signal: controller.signal
      })
    ).rejects.toThrow('Aborted')
  })
})

describe('PromisePool', () => {
  it('should limit concurrency', async () => {
    const pool = new PromisePool(2)
    let running = 0
    let maxConcurrent = 0

    const task = () => new Promise(resolve => {
      running++
      maxConcurrent = Math.max(maxConcurrent, running)
      setTimeout(() => {
        running--
        resolve(undefined)
      }, 50)
    })

    await Promise.all([
      pool.add(task),
      pool.add(task),
      pool.add(task),
      pool.add(task),
    ])

    expect(maxConcurrent).toBeLessThanOrEqual(2)
  })

  it('should execute all tasks', async () => {
    const pool = new PromisePool(3)
    const results: number[] = []

    await Promise.all([
      pool.add(async () => { results.push(1); return 1 }),
      pool.add(async () => { results.push(2); return 2 }),
      pool.add(async () => { results.push(3); return 3 }),
    ])

    expect(results.sort()).toEqual([1, 2, 3])
  })
})
