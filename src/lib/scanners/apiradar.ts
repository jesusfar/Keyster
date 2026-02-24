/**
 * API Radar scanner module - Enhanced version
 * Handles free tier limitations and maximizes results
 */

import { extractKeysFromText } from '../utils/keyExtraction'
import { logger } from '../utils/logger'
import { sleep } from '../utils/async'
import { logError } from '../utils/errorHandlers'
import { validateKey } from './validation'
import type { ProviderPattern, SearchContext, ScanProgress } from './types'

const APIRADAR_API = '/api/apiradar'
const APIRADAR_WEB = 'https://apiradar.live'

interface ApiRadarLeak {
  id: string
  provider: string
  redactedKey: string
  repoUrl: string
  filePath: string
  leakIntroducedAt: string
  leakDetectedAt?: string
  repoCreatedAt?: string
  isLocked?: boolean
}

interface ApiRadarResponse {
  leaks: ApiRadarLeak[]
  total: number
  hasMore: boolean
  planLimits?: {
    maxLeaks: number
  }
}

/**
 * Fetch leaks from API Radar API
 * Free tier has strict limits (usually 4 results max)
 */
async function fetchApiRadarLeaks(
  provider?: string,
  signal?: AbortSignal
): Promise<ApiRadarLeak[]> {
  try {
    const params = new URLSearchParams()
    if (provider) {
      params.append('provider', provider.toLowerCase())
    }
    params.append('limit', '100') // Request more, even if we get fewer

    const url = `${APIRADAR_API}/leaks${params.toString() ? '?' + params : ''}`
    const res = await fetch(url, { signal })

    if (!res.ok) {
      logger.warn(`API Radar API returned ${res.status}`)
      return []
    }

    const data: ApiRadarResponse = await res.json()

    logger.info(`API Radar: Got ${data.leaks.length} leaks (total: ${data.total}, limit: ${data.planLimits?.maxLeaks || 'unknown'})`)

    return data.leaks || []
  } catch (err) {
    logError('fetchApiRadarLeaks', err)
    return []
  }
}

/**
 * Scrape additional leaks from the API Radar website
 * This bypasses API limits by parsing the public web interface
 */
async function scrapeApiRadarWeb(
  provider: string,
  signal?: AbortSignal
): Promise<ApiRadarLeak[]> {
  try {
    // API Radar web interface shows more results than the API
    const url = `${APIRADAR_WEB}/?provider=${provider.toLowerCase()}`
    const res = await fetch(url, { signal })

    if (!res.ok) return []

    const html = await res.text()

    // Extract leak data from HTML
    // The web page contains JSON data in script tags or data attributes
    const leaks: ApiRadarLeak[] = []

    // Look for JSON data in the page
    const jsonMatches = html.match(/"leaks":\s*\[(.*?)\]/s)
    if (jsonMatches) {
      try {
        const jsonData = JSON.parse(`{"leaks":[${jsonMatches[1]}]}`)
        leaks.push(...jsonData.leaks)
      } catch {
        // Fallback: parse HTML structure
        logger.debug('Could not parse JSON from API Radar web, trying HTML parsing')
      }
    }

    // Alternative: parse from __NEXT_DATA__ or similar
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/)
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1])
        const pageLeaks = nextData?.props?.pageProps?.leaks || []
        leaks.push(...pageLeaks)
      } catch (err) {
        logger.debug('Could not parse __NEXT_DATA__:', err)
      }
    }

    logger.info(`API Radar Web Scraping: Found ${leaks.length} additional leaks`)
    return leaks
  } catch (err) {
    logError('scrapeApiRadarWeb', err)
    return []
  }
}

/**
 * Fetch file content from raw GitHub/GitLab URL
 */
async function fetchRawContent(
  repoUrl: string,
  filePath: string,
  signal?: AbortSignal
): Promise<string | null> {
  const branches = ['main', 'master', 'HEAD', 'develop']
  let rawUrls: string[] = []

  if (repoUrl.includes('github.com')) {
    const repoPath = repoUrl
      .replace('https://github.com/', '')
      .replace('http://github.com/', '')
      .replace(/\/$/, '')
    rawUrls = branches.map(b => `https://raw.githubusercontent.com/${repoPath}/${b}/${filePath}`)
  } else if (repoUrl.includes('gitlab.com')) {
    const repoPath = repoUrl
      .replace('https://gitlab.com/', '')
      .replace('http://gitlab.com/', '')
      .replace(/\/$/, '')
    rawUrls = branches.map(b => `https://gitlab.com/${repoPath}/-/raw/${b}/${filePath}`)
  } else {
    return null
  }

  for (const rawUrl of rawUrls) {
    try {
      const res = await fetch(rawUrl, {
        signal,
        // Add headers to avoid rate limiting
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })
      if (res.ok) {
        return await res.text()
      }
    } catch (err) {
      logger.debug(`Failed to fetch ${rawUrl}:`, err)
    }
  }

  return null
}

/**
 * Enhanced API Radar scanner
 */
export async function scanApiRadar(
  providerPattern: ProviderPattern,
  context: SearchContext,
  options: {
    onProgress: (progress: Partial<ScanProgress>) => void
    signal?: AbortSignal
  }
): Promise<void> {
  const { onProgress, signal } = options

  onProgress({
    message: `📡 API Radar: Fetching ${providerPattern.label} leaks...`,
  })

  // Strategy 1: Fetch from API with provider filter
  const apiLeaks = await fetchApiRadarLeaks(providerPattern.provider, signal)

  // Strategy 2: Scrape web interface for more results
  const webLeaks = await scrapeApiRadarWeb(providerPattern.provider, signal)

  // Combine and deduplicate
  const allLeaks = new Map<string, ApiRadarLeak>()
  for (const leak of [...apiLeaks, ...webLeaks]) {
    allLeaks.set(leak.id, leak)
  }

  const uniqueLeaks = Array.from(allLeaks.values())
  logger.info(`API Radar: Processing ${uniqueLeaks.length} unique leaks for ${providerPattern.label}`)

  onProgress({
    message: `📡 API Radar: Processing ${uniqueLeaks.length} leaks...`,
  })

  let processed = 0
  for (const leak of uniqueLeaks) {
    if (signal?.aborted) return

    processed++
    if (processed % 5 === 0) {
      onProgress({
        message: `📡 API Radar: Processing ${processed}/${uniqueLeaks.length}...`,
      })
    }

    // Extract repo info
    const repoPath = leak.repoUrl
      .replace('https://github.com/', '')
      .replace('https://gitlab.com/', '')
      .replace('http://github.com/', '')
      .replace('http://gitlab.com/', '')
      .replace(/\/$/, '')

    const repoName = repoPath
    const author = repoPath.split('/')[0] || 'unknown'

    // Fetch file content
    const content = await fetchRawContent(leak.repoUrl, leak.filePath, signal)

    if (!content) {
      logger.debug(`Could not fetch content for ${repoName}/${leak.filePath}`)
      continue
    }

    // Extract keys from content
    const foundKeys = extractKeysFromText(content, providerPattern.patterns)

    if (foundKeys.length > 0) {
      logger.info(`API Radar: Found ${foundKeys.length} keys in ${repoName}/${leak.filePath}`)

      for (const key of foundKeys) {
        const sourceUrl = leak.repoUrl.includes('github.com')
          ? `https://github.com/${repoName}/blob/HEAD/${leak.filePath}`
          : `https://gitlab.com/${repoName}/-/blob/HEAD/${leak.filePath}`

        // Add result to context
        if (!context.seenKeys.has(key)) {
          context.seenKeys.add(key)

          const result = {
            key,
            provider: providerPattern.provider,
            providerLabel: providerPattern.label,
            repo: repoName,
            author,
            filePath: leak.filePath,
            fileUrl: sourceUrl,
            timestamp: Date.now(),
            keyStatus: 'checking' as const,
            source: 'apiradar' as const,
          }

          context.allResults.push(result)
          context.onResult(result)

          // Validate in background
          validateKey(key, providerPattern.provider).then(status => {
            context.onResultUpdate(key, status)
          }).catch(err => {
            logger.warn(`Validation failed for ${providerPattern.provider} key: ${err}`)
            context.onResultUpdate(key, 'error')
          })

          onProgress({
            message: `🔑 API Radar: Found in ${repoName}`,
          })
        }
      }
    }

    // Small delay to avoid overwhelming the system
    await sleep(100, signal)
  }

  onProgress({
    message: `📡 API Radar: Completed ${providerPattern.label} (${uniqueLeaks.length} leaks processed)`,
  })
}
