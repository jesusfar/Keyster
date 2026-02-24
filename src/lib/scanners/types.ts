/**
 * Shared types for scanner modules
 */

export type KeyStatus = 'checking' | 'valid' | 'invalid' | 'rate_limited' | 'error'
export type SearchSource = 'code' | 'gist' | 'commit' | 'issue' | 'gitlab' | 'sourcegraph' | 'grep.app' | 'apiradar' | 'huggingface'
export type ScanSourcePlatform = 'github' | 'gitlab' | 'sourcegraph' | 'grep.app' | 'apiradar' | 'huggingface'
export type TimeRange = '1h' | '24h' | '7d' | '30d' | 'all'

export interface ProviderPattern {
  provider: string
  label: string
  icon: string
  patterns: RegExp[]
  searchQueries: string[]
}

export interface ScanResult {
  key: string
  provider: string
  providerLabel: string
  repo: string
  author: string
  filePath: string
  fileUrl: string
  timestamp: number
  keyStatus: KeyStatus
  source: SearchSource
}

export interface ScanProgress {
  currentProvider: string
  currentQuery: number
  totalQueries: number
  keysFound: number
  status: 'idle' | 'scanning' | 'paused' | 'done' | 'error' | 'rate-limited'
  message: string
}

export interface ScanOptions {
  providers: string[]
  githubToken: string
  gitlabToken?: string
  sources?: ScanSourcePlatform[]
  timeRange: TimeRange
  maxPagesPerQuery?: number
  deepScan?: boolean
  onProgress: (progress: ScanProgress) => void
  onResult: (result: ScanResult) => void
  onResultUpdate: (key: string, status: KeyStatus) => void
  signal?: AbortSignal
}

export interface SearchContext {
  providerPattern: ProviderPattern
  seenKeys: Set<string>
  allResults: ScanResult[]
  onResult: (result: ScanResult) => void
  onResultUpdate: (key: string, status: KeyStatus) => void
  signal?: AbortSignal
}

/**
 * Get ISO date string for the given time range offset from now
 */
export function getDateForRange(range: TimeRange): string | null {
  if (range === 'all') return null
  const now = new Date()
  switch (range) {
    case '1h': now.setHours(now.getHours() - 1); break
    case '24h': now.setDate(now.getDate() - 1); break
    case '7d': now.setDate(now.getDate() - 7); break
    case '30d': now.setDate(now.getDate() - 30); break
  }
  return now.toISOString().split('T')[0] // YYYY-MM-DD
}
