/**
 * GitHub API scanner module
 */

import { CONFIG } from '../config'
import { RateLimitError, AuthenticationError, logError } from '../utils/errorHandlers'
import { sleep, withRetry, processBatch } from '../utils/async'
import { extractKeysFromText } from '../utils/keyExtraction'
import { logger } from '../utils/logger'
import type { SearchContext, ScanProgress } from './types'
import { validateKey } from './validation'

const GITHUB_API = '/api/githubapi'

interface GitHubSearchResponse {
  total_count: number
  incomplete_results: boolean
  items: GitHubSearchItem[]
}

interface GitHubSearchItem {
  name: string
  path: string
  html_url: string
  repository: {
    full_name: string
    html_url: string
    owner: {
      login: string
    }
  }
  text_matches?: Array<{
    fragment: string
    matches: Array<{
      text: string
      indices: [number, number]
    }>
  }>
}

interface CommitSearchResponse {
  total_count: number
  items: Array<{
    sha: string
    html_url: string
    commit: {
      message: string
      author: { name: string }
    }
    repository: {
      full_name: string
      owner: { login: string }
    }
    text_matches?: Array<{
      fragment: string
      matches: Array<{ text: string; indices: [number, number] }>
    }>
  }>
}

interface IssueSearchResponse {
  total_count: number
  items: Array<{
    html_url: string
    body: string
    title: string
    repository_url: string
    user: { login: string }
    text_matches?: Array<{
      fragment: string
      matches: Array<{ text: string; indices: [number, number] }>
    }>
  }>
}

/**
 * Track rate limits across requests
 */
class RateLimitTracker {
  private remaining = 30
  private currentDelay = CONFIG.RATE_LIMIT.BASE_DELAY_MS

  updateFromHeaders(headers: Headers, hasMultipleTokens: boolean) {
    const remaining = headers.get('X-RateLimit-Remaining')
    if (remaining && !hasMultipleTokens) {
      this.remaining = parseInt(remaining, 10)
      // Adaptively slow down when approaching limits
      if (this.remaining < 5) this.currentDelay = CONFIG.RATE_LIMIT.RATE_LIMIT_DELAY_MS
      else if (this.remaining < 10) this.currentDelay = CONFIG.RATE_LIMIT.LOW_REMAINING_DELAY_MS
      else this.currentDelay = CONFIG.RATE_LIMIT.BASE_DELAY_MS
    } else {
      this.currentDelay = CONFIG.RATE_LIMIT.BASE_DELAY_MS
    }
  }

  getDelay(): number {
    return this.currentDelay
  }
}

const rateLimitTracker = new RateLimitTracker()

/**
 * Generic GitHub search with retry and token rotation
 */
async function searchGitHub<T>(
  endpoint: string,
  params: URLSearchParams,
  tokens: string[],
  signal?: AbortSignal
): Promise<T> {
  let tokenIndex = 0

  return withRetry(
    async () => {
      const activeToken = tokens[tokenIndex % tokens.length]
      const response = await fetch(`${GITHUB_API}${endpoint}?${params}`, {
        headers: {
          'Authorization': `Bearer ${activeToken}`,
          'Accept': 'application/vnd.github.text-match+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal,
      })

      // Update rate limit tracking
      rateLimitTracker.updateFromHeaders(response.headers, tokens.length > 1)

      // Handle rate limiting
      if (response.status === 429 || response.status === 403) {
        const resetHeader = response.headers.get('X-RateLimit-Reset')
        const retryAfter = resetHeader
          ? Math.max(0, Number(resetHeader) - Math.floor(Date.now() / 1000))
          : 60

        // If we have multiple tokens, rotate to next token
        if (tokens.length > 1) {
          tokenIndex++
          logger.info('Rate limited, rotating to next token')
          throw new Error('ROTATE_TOKEN')
        } else {
          throw new RateLimitError(retryAfter)
        }
      }

      if (response.status === 401) throw new AuthenticationError('Invalid GitHub token')
      if (response.status === 422) return { total_count: 0, incomplete_results: false, items: [] } as T

      if (!response.ok) {
        throw new Error(`GitHub API error ${response.status}`)
      }

      return await response.json()
    },
    {
      shouldRetry: (err) => {
        // Retry on token rotation, but not on auth errors
        if (err instanceof AuthenticationError) return false
        return true
      },
      onRetry: (attempt, err) => {
        logger.debug(`Retrying GitHub search, attempt ${attempt}`, err)
      },
      signal,
    }
  )
}

/**
 * Fetch raw file content from GitHub
 */
async function fetchFileContent(
  repo: string,
  path: string,
  token: string,
  signal?: AbortSignal
): Promise<string | null> {
  try {
    const response = await fetch(
      `${GITHUB_API}/repos/${repo}/contents/${encodeURIComponent(path)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.raw+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal,
      }
    )
    if (!response.ok) return null
    return await response.text()
  } catch (err) {
    logError('fetchFileContent', err)
    return null
  }
}

/**
 * Add a key result to the context
 */
function addKeyResult(
  key: string,
  context: SearchContext,
  repo: string,
  author: string,
  filePath: string,
  fileUrl: string,
  source: 'code' | 'gist' | 'commit' | 'issue'
): boolean {
  if (context.seenKeys.has(key)) return false

  context.seenKeys.add(key)
  const result = {
    key,
    provider: context.providerPattern.provider,
    providerLabel: context.providerPattern.label,
    repo,
    author,
    filePath,
    fileUrl,
    timestamp: Date.now(),
    keyStatus: 'checking' as const,
    source,
  }

  context.allResults.push(result)
  context.onResult(result)

  // Validate in background
  validateKey(key, context.providerPattern.provider).then(status => {
    context.onResultUpdate(key, status)
  })

  return true
}

/**
 * Search GitHub code
 */
export async function searchGitHubCode(
  query: string,
  tokens: string[],
  context: SearchContext,
  options: {
    maxPages: number
    deepScan: boolean
    dateFilter: string | null
    onProgress: (progress: Partial<ScanProgress>) => void
  }
): Promise<void> {
  const { maxPages, deepScan, dateFilter, onProgress } = options

  // Time shards for deep scan to bypass 1000 result limit
  const timeShards = deepScan
    ? [
        dateFilter ? `pushed:>${dateFilter}` : 'pushed:>2024-01-01',
        'pushed:2023-01-01..2023-12-31',
        'pushed:2022-01-01..2022-12-31',
        'pushed:2021-01-01..2021-12-31',
        'pushed:<2020-12-31'
      ]
    : [dateFilter ? `pushed:>${dateFilter}` : '']

  for (const shard of timeShards) {
    if (context.signal?.aborted) return

    const fullQuery = shard ? `${query} ${shard}` : query

    for (let page = 1; page <= maxPages; page++) {
      if (context.signal?.aborted) return

      const params = new URLSearchParams({
        q: fullQuery,
        per_page: String(CONFIG.SCAN.RESULTS_PER_PAGE),
        page: String(page),
        sort: 'indexed',
        order: 'desc',
      })

      try {
        const searchResult = await searchGitHub<GitHubSearchResponse>(
          '/search/code',
          params,
          tokens,
          context.signal
        )

        if (searchResult.items.length === 0) break

        // Process items in batches
        await processBatch(
          searchResult.items,
          async (item) => {
            let foundKeys: string[] = []

            // Try to extract from text matches first
            if (item.text_matches && item.text_matches.length > 0) {
              const allFragments = item.text_matches.map(tm => tm.fragment).join('\n')
              foundKeys = extractKeysFromText(allFragments, context.providerPattern.patterns)
            }

            // If no keys found, fetch full file content
            if (foundKeys.length === 0) {
              const randToken = tokens[Math.floor(Math.random() * tokens.length)]
              const content = await fetchFileContent(item.repository.full_name, item.path, randToken, context.signal)
              if (content) foundKeys = extractKeysFromText(content, context.providerPattern.patterns)
            }

            // Add all found keys
            for (const key of foundKeys) {
              if (addKeyResult(key, context, item.repository.full_name, item.repository.owner.login, item.path, item.html_url, 'code')) {
                onProgress({
                  keysFound: context.allResults.length,
                  message: `🔑 Found in ${item.repository.full_name}`,
                })
              }
            }
          },
          {
            batchSize: CONFIG.RATE_LIMIT.BATCH_SIZE,
            delayBetweenBatches: CONFIG.RATE_LIMIT.BATCH_DELAY_MS,
            signal: context.signal,
          }
        )

        if (searchResult.items.length < CONFIG.SCAN.RESULTS_PER_PAGE) break
        await sleep(rateLimitTracker.getDelay(), context.signal)
      } catch (err) {
        if (err instanceof RateLimitError) {
          onProgress({
            status: 'rate-limited',
            message: `Rate limited. Waiting ${err.retryAfterSeconds}s...`,
          })
          await sleep(err.retryAfterSeconds * 1000, context.signal)
        } else {
          throw err
        }
      }
    }
  }
}

/**
 * Search GitHub gists
 */
export async function searchGitHubGists(
  query: string,
  tokens: string[],
  context: SearchContext,
  options: {
    deepScan: boolean
    onProgress: (progress: Partial<ScanProgress>) => void
  }
): Promise<void> {
  const { deepScan, onProgress } = options

  const fullQuery = `${query} path:*.txt OR path:*.md OR path:*.env`
  const maxPages = deepScan ? 2 : 1

  for (let page = 1; page <= maxPages; page++) {
    if (context.signal?.aborted) return

    const params = new URLSearchParams({
      q: fullQuery,
      per_page: '30',
      page: String(page),
      sort: 'indexed',
      order: 'desc',
    })

    try {
      const result = await searchGitHub<GitHubSearchResponse>(
        '/search/code',
        params,
        tokens,
        context.signal
      )

      await processBatch(
        result.items,
        async (item) => {
          if (item.text_matches && item.text_matches.length > 0) {
            const frags = item.text_matches.map(tm => tm.fragment).join('\n')
            const foundKeys = extractKeysFromText(frags, context.providerPattern.patterns)

            for (const key of foundKeys) {
              addKeyResult(key, context, item.repository?.full_name || 'gist', item.repository?.owner?.login || 'unknown', item.path || 'gist', item.html_url, 'gist')
            }
          }
        },
        { signal: context.signal }
      )
    } catch (err) {
      logError('searchGitHubGists', err)
    }
  }
}

/**
 * Search GitHub commits
 */
export async function searchGitHubCommits(
  query: string,
  tokens: string[],
  context: SearchContext,
  options: {
    dateFilter: string | null
    onProgress: (progress: Partial<ScanProgress>) => void
  }
): Promise<void> {
  const { dateFilter, onProgress } = options

  const fullQuery = dateFilter ? `${query} committer-date:>${dateFilter}` : query
  const params = new URLSearchParams({
    q: fullQuery,
    per_page: '20',
    page: '1',
    sort: 'committer-date',
    order: 'desc',
  })

  try {
    const result = await searchGitHub<CommitSearchResponse>(
      '/search/commits',
      params,
      tokens,
      context.signal
    )

    await processBatch(
      result.items,
      async (item) => {
        const foundKeys: string[] = []
        foundKeys.push(...extractKeysFromText(item.commit.message, context.providerPattern.patterns))

        if (item.text_matches && item.text_matches.length > 0) {
          const frags = item.text_matches.map(tm => tm.fragment).join('\n')
          foundKeys.push(...extractKeysFromText(frags, context.providerPattern.patterns))
        }

        for (const key of foundKeys) {
          addKeyResult(key, context, item.repository.full_name, item.repository.owner.login, `commit/${item.sha.substring(0, 7)}`, item.html_url, 'commit')
        }
      },
      { signal: context.signal }
    )
  } catch (err) {
    logError('searchGitHubCommits', err)
  }
}

/**
 * Search GitHub issues
 */
export async function searchGitHubIssues(
  query: string,
  tokens: string[],
  context: SearchContext,
  options: {
    dateFilter: string | null
    onProgress: (progress: Partial<ScanProgress>) => void
  }
): Promise<void> {
  const { dateFilter, onProgress } = options

  const fullQuery = dateFilter ? `${query} updated:>${dateFilter}` : query
  const params = new URLSearchParams({
    q: fullQuery,
    per_page: '20',
    page: '1',
    sort: 'updated',
    order: 'desc',
  })

  try {
    const result = await searchGitHub<IssueSearchResponse>(
      '/search/issues',
      params,
      tokens,
      context.signal
    )

    await processBatch(
      result.items,
      async (item) => {
        const foundKeys: string[] = []
        foundKeys.push(...extractKeysFromText(item.body || '', context.providerPattern.patterns))

        if (item.text_matches && item.text_matches.length > 0) {
          const frags = item.text_matches.map(tm => tm.fragment).join('\n')
          foundKeys.push(...extractKeysFromText(frags, context.providerPattern.patterns))
        }

        for (const key of foundKeys) {
          const repoMatch = item.repository_url.match(/repos\/([^/]+)\/([^/]+)/)
          const owner = repoMatch ? repoMatch[1] : 'unknown'
          const repoFullName = repoMatch ? `${repoMatch[1]}/${repoMatch[2]}` : 'unknown'

          addKeyResult(key, context, repoFullName, owner, `issue💬`, item.html_url, 'issue')
        }
      },
      { signal: context.signal }
    )
  } catch (err) {
    logError('searchGitHubIssues', err)
  }
}
