/**
 * GitHub API Key Scanner
 * Scans public GitHub code via the GitHub REST API for exposed AI provider API keys.
 * Uses: https://api.github.com/search/code (requires Personal Access Token)
 */

export interface ProviderPattern {
  provider: string
  label: string
  icon: string
  patterns: RegExp[]
  searchQueries: string[]
}

export type KeyStatus = 'checking' | 'valid' | 'invalid' | 'rate_limited' | 'error'
export type SearchSource = 'code' | 'gist' | 'commit'

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

export type TimeRange = '1h' | '24h' | '7d' | '30d' | 'all'

export interface ScanProgress {
  currentProvider: string
  currentQuery: number
  totalQueries: number
  keysFound: number
  status: 'idle' | 'scanning' | 'paused' | 'done' | 'error' | 'rate-limited'
  message: string
}

// ─── Provider Key Patterns ───────────────────────────────────────────────────

export const PROVIDER_PATTERNS: ProviderPattern[] = [
  {
    provider: 'anthropic',
    label: 'Anthropic',
    icon: '🟣',
    patterns: [
      /sk-ant-api03-[A-Za-z0-9_\-]{80,}/g,
      /sk-ant-[A-Za-z0-9_\-]{40,}/g,
    ],
    searchQueries: [
      'sk-ant-api03',
      'sk-ant-api',
      'ANTHROPIC_API_KEY sk-ant',
      'anthropic_key sk-ant',
      'sk-ant path:.env',
      'sk-ant path:.yml',
      'sk-ant language:Python',
      'sk-ant language:JavaScript',
      'sk-ant language:TypeScript',
      'claude api_key sk-ant',
      // Config & agent exposure
      'sk-ant path:docker-compose',
      'sk-ant path:config.json',
      'sk-ant path:.env.production',
      'anthropic_api_key path:settings',
      'claude sk-ant path:mcp',
      'sk-ant path:secrets',
    ],
  },
  {
    provider: 'openai',
    label: 'OpenAI',
    icon: '🟢',
    patterns: [
      /sk-proj-[A-Za-z0-9_\-]{40,}/g,
      /sk-[a-zA-Z0-9]{20,}/g,
    ],
    searchQueries: [
      'sk-proj-',
      'OPENAI_API_KEY sk-',
      'openai_api_key sk-',
      'openai.api_key sk-',
      'sk-proj- path:.env',
      'sk-proj- path:.yml',
      'OPENAI_API_KEY language:Python',
      'OPENAI_API_KEY language:JavaScript',
      'openai_key sk- language:Dotenv',
      'sk- path:.env.local',
      // Config & agent exposure
      'sk-proj- path:docker-compose',
      'openai_api_key path:config.json',
      'sk- path:.env.production',
      'openai sk- path:appsettings',
      'OPENAI_API_KEY path:serverless',
    ],
  },
  {
    provider: 'google',
    label: 'Google AI',
    icon: '🔵',
    patterns: [
      /AIza[A-Za-z0-9_\-]{35}/g,
    ],
    searchQueries: [
      'GEMINI_API_KEY AIza',
      'GOOGLE_API_KEY AIza',
      'google_api_key AIza',
      'AIzaSy path:.env',
      'AIzaSy path:.yml',
      'AIzaSy language:Python',
      'AIzaSy language:JavaScript',
      'generativelanguage AIzaSy',
      'gemini AIzaSy',
      // Config & agent exposure
      'AIzaSy path:docker-compose',
      'AIzaSy path:config.json',
      'AIzaSy path:.env.production',
      'google_api_key AIzaSy path:secrets',
    ],
  },
  {
    provider: 'xai',
    label: 'xAI (Grok)',
    icon: '⚪',
    patterns: [
      /xai-[A-Za-z0-9]{20,}/g,
    ],
    searchQueries: [
      'XAI_API_KEY xai-',
      'xai_api_key xai-',
      'xai- grok api',
      'xai- path:.env',
      'xai- language:Python',
      'x.ai api_key xai-',
      // Config & agent exposure
      'xai- path:docker-compose',
      'xai- path:config.json',
    ],
  },
  {
    provider: 'groq',
    label: 'Groq',
    icon: '🟠',
    patterns: [
      /gsk_[A-Za-z0-9]{20,}/g,
    ],
    searchQueries: [
      'GROQ_API_KEY gsk_',
      'groq_api_key gsk_',
      'gsk_ path:.env',
      'gsk_ language:Python',
      'gsk_ language:JavaScript',
      'groq api key gsk_',
      // Config & agent exposure
      'gsk_ path:docker-compose',
      'gsk_ path:config.json',
    ],
  },
  {
    provider: 'cerebras',
    label: 'Cerebras',
    icon: '🔴',
    patterns: [
      /csk-[A-Za-z0-9]{20,}/g,
    ],
    searchQueries: [
      'CEREBRAS_API_KEY csk-',
      'cerebras_api_key csk-',
      'csk- path:.env',
      'csk- language:Python',
      // Config & agent exposure
      'csk- path:docker-compose',
      'csk- path:config.json',
    ],
  },
  {
    provider: 'openrouter',
    label: 'OpenRouter',
    icon: '🟡',
    patterns: [
      /sk-or-v1-[A-Za-z0-9]{40,}/g,
    ],
    searchQueries: [
      'sk-or-v1-',
      'OPENROUTER_API_KEY sk-or-v1-',
      'openrouter_api_key sk-or-v1-',
      'sk-or-v1- path:.env',
      'sk-or-v1- language:Python',
      'openrouter sk-or-v1-',
      // Config & agent exposure
      'sk-or-v1- path:docker-compose',
      'sk-or-v1- path:config.json',
    ],
  },
  {
    provider: 'mistral',
    label: 'Mistral AI',
    icon: '🔷',
    patterns: [
      /[A-Za-z0-9]{32}/g, // Mistral keys are 32 char alphanumeric
    ],
    searchQueries: [
      'MISTRAL_API_KEY',
      'mistral_api_key path:.env',
      'mistral_key language:Python',
      'mistral api_key path:config',
      'mistral path:.env.production',
    ],
  },
  {
    provider: 'cohere',
    label: 'Cohere',
    icon: '🟤',
    patterns: [
      /[A-Za-z0-9]{40}/g, // Cohere keys are ~40 chars
    ],
    searchQueries: [
      'COHERE_API_KEY co-',
      'cohere_api_key path:.env',
      'cohere api_key language:Python',
      'COHERE_API_KEY path:config',
      'cohere_key path:.env.production',
    ],
  },
  {
    provider: 'together',
    label: 'Together AI',
    icon: '🤝',
    patterns: [
      /[a-f0-9]{64}/g, // Together keys are 64 char hex
    ],
    searchQueries: [
      'TOGETHER_API_KEY',
      'together_api_key path:.env',
      'TOGETHER_API_KEY language:Python',
      'together ai api_key path:config',
      'togetherai path:.env',
    ],
  },
  {
    provider: 'replicate',
    label: 'Replicate',
    icon: '🔁',
    patterns: [
      /r8_[A-Za-z0-9]{36,}/g,
    ],
    searchQueries: [
      'REPLICATE_API_TOKEN r8_',
      'r8_ path:.env',
      'replicate_api_token r8_',
      'r8_ language:Python',
      'replicate r8_ path:config',
      'r8_ path:docker-compose',
    ],
  },
  {
    provider: 'huggingface',
    label: 'Hugging Face',
    icon: '🤗',
    patterns: [
      /hf_[A-Za-z0-9]{30,}/g,
    ],
    searchQueries: [
      'hf_ HF_TOKEN',
      'HUGGINGFACE_API_KEY hf_',
      'hf_ path:.env',
      'hf_ language:Python',
      'huggingface_token hf_',
      'HF_TOKEN hf_ path:config',
      'hf_ path:docker-compose',
    ],
  },
  {
    provider: 'deepseek',
    label: 'Deepseek',
    icon: '🐋',
    patterns: [
      /sk-[a-f0-9]{48,}/g, // Deepseek uses sk- prefix with hex
    ],
    searchQueries: [
      'DEEPSEEK_API_KEY sk-',
      'deepseek_api_key path:.env',
      'deepseek api_key language:Python',
      'deepseek sk- path:config',
      'deepseek_key path:.env.production',
    ],
  },
  {
    provider: 'fireworks',
    label: 'Fireworks AI',
    icon: '🎆',
    patterns: [
      /fw_[A-Za-z0-9]{30,}/g,
    ],
    searchQueries: [
      'FIREWORKS_API_KEY fw_',
      'fireworks_api_key fw_',
      'fw_ path:.env',
      'fw_ language:Python',
      'fireworks fw_ path:config',
    ],
  },
]

// ─── Provider API Endpoints (for key validation) ────────────────────────────

const VALIDATION_ENDPOINTS: Record<string, { url: string, headers: (key: string) => Record<string, string> }> = {
  anthropic: {
    url: '/api/anthropic/models',
    headers: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }),
  },
  openai: {
    url: '/api/openai/models',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
  google: {
    url: '/api/google/models',
    headers: () => ({ 'Content-Type': 'application/json' }),
  },
  openrouter: {
    url: '/api/openrouter/auth/key',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
  xai: {
    url: '/api/xai/models',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
  groq: {
    url: '/api/groq/models',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
  cerebras: {
    url: '/api/cerebras/models',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
}

/**
 * Validate an API key by making a lightweight request to the provider's API
 */
export async function validateKey(key: string, provider: string): Promise<KeyStatus> {
  const endpoint = VALIDATION_ENDPOINTS[provider]
  if (!endpoint) return 'error'

  try {
    // Google uses query param for key
    const url = provider === 'google'
      ? `${endpoint.url}?key=${key}`
      : endpoint.url

    const response = await fetch(url, {
      headers: endpoint.headers(key),
    })

    if (response.ok) return 'valid'
    if (response.status === 401 || response.status === 403) return 'invalid'
    if (response.status === 429) return 'rate_limited'
    return 'invalid'
  } catch {
    return 'error'
  }
}

// ─── GitHub REST API Search ──────────────────────────────────────────────────

const GITHUB_API = '/api/githubapi'
const BASE_DELAY_MS = 3000
let rateLimitRemaining = 30 // Track remaining API calls
let currentDelayMs = BASE_DELAY_MS

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

/**
 * Search GitHub code via REST API — returns structured results with text_matches
 */
async function searchGitHubAPI(
  query: string,
  token: string,
  page: number = 1,
  retries: number = 3
): Promise<GitHubSearchResponse> {
  const params = new URLSearchParams({
    q: query,
    per_page: '30',
    page: String(page),
  })

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(`${GITHUB_API}/search/code?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.text-match+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })

      // Track rate limits from headers
      const remaining = response.headers.get('X-RateLimit-Remaining')
      if (remaining) {
        rateLimitRemaining = parseInt(remaining, 10)
        // Adaptively slow down when approaching limits
        if (rateLimitRemaining < 5) currentDelayMs = 10000
        else if (rateLimitRemaining < 10) currentDelayMs = 6000
        else currentDelayMs = BASE_DELAY_MS
      }

      if (response.status === 429 || response.status === 403) {
        const resetHeader = response.headers.get('X-RateLimit-Reset')
        const retryAfter = resetHeader
          ? Math.max(0, Number(resetHeader) - Math.floor(Date.now() / 1000))
          : 60
        throw new RateLimitError(retryAfter)
      }

      if (response.status === 401) throw new Error('AUTH_ERROR')
      if (response.status === 422) return { total_count: 0, incomplete_results: false, items: [] }

      if (!response.ok) {
        throw new Error(`GitHub API error ${response.status}`)
      }

      return await response.json()
    } catch (err: any) {
      if (err.message === 'AUTH_ERROR' || err instanceof RateLimitError) throw err
      // Retry with exponential backoff
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
        continue
      }
      throw err
    }
  }
  return { total_count: 0, incomplete_results: false, items: [] }
}

class RateLimitError extends Error {
  retryAfterSeconds: number
  constructor(retryAfterSeconds: number) {
    super('RATE_LIMITED')
    this.retryAfterSeconds = retryAfterSeconds
  }
}

/**
 * Fetch raw file content from GitHub to extract full keys
 */
async function fetchFileContent(
  repo: string,
  path: string,
  token: string
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
      }
    )
    if (!response.ok) return null
    return await response.text()
  } catch {
    return null
  }
}

/**
 * Extract API keys from text using regex patterns
 */
function extractKeysFromText(text: string, patterns: RegExp[]): string[] {
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

/**
 * Heuristic: skip obviously fake/example keys
 */
function isFakeKey(key: string): boolean {
  const lower = key.toLowerCase()
  const fakePatterns = [
    'xxxx', '0000', '1111', '2222', '3333', '4444', '5555',
    'test', 'example', 'demo', 'fake', 'placeholder', 'your_',
    'insert', 'replace', 'abcdef', '123456', 'sample', 'dummy',
    'todo', 'fixme', 'changeme', 'secret', 'mykey', 'my_key',
    'put_your', 'enter_your', 'add_your', 'your-api',
  ]
  return fakePatterns.some(p => lower.includes(p))
}

/**
 * Search GitHub Gists via REST API
 */
async function searchGitHubGists(
  query: string,
  token: string,
  page: number = 1
): Promise<GitHubSearchResponse> {
  const params = new URLSearchParams({
    q: query,
    per_page: '30',
    page: String(page),
  })

  const response = await fetch(`${GITHUB_API}/search/code?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.text-match+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (response.status === 429 || response.status === 403) {
    const resetHeader = response.headers.get('X-RateLimit-Reset')
    const retryAfter = resetHeader
      ? Math.max(0, Number(resetHeader) - Math.floor(Date.now() / 1000))
      : 60
    throw new RateLimitError(retryAfter)
  }
  if (response.status === 401) throw new Error('AUTH_ERROR')
  if (response.status === 422) return { total_count: 0, incomplete_results: false, items: [] }
  if (!response.ok) return { total_count: 0, incomplete_results: false, items: [] }

  return await response.json()
}

/**
 * Search GitHub Commits via REST API
 */
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

async function searchGitHubCommits(
  query: string,
  token: string,
  page: number = 1
): Promise<CommitSearchResponse> {
  const params = new URLSearchParams({
    q: query,
    per_page: '20',
    page: String(page),
    sort: 'committer-date',
    order: 'desc',
  })

  const response = await fetch(`${GITHUB_API}/search/commits?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.text-match+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (response.status === 429 || response.status === 403) {
    const resetHeader = response.headers.get('X-RateLimit-Reset')
    const retryAfter = resetHeader
      ? Math.max(0, Number(resetHeader) - Math.floor(Date.now() / 1000))
      : 60
    throw new RateLimitError(retryAfter)
  }
  if (response.status === 401) throw new Error('AUTH_ERROR')
  if (!response.ok) return { total_count: 0, items: [] }

  return await response.json()
}

// ─── Scan Orchestration ──────────────────────────────────────────────────────

interface ScanOptions {
  providers: string[]
  githubToken: string
  timeRange: TimeRange
  maxPagesPerQuery?: number
  onProgress: (progress: ScanProgress) => void
  onResult: (result: ScanResult) => void
  onResultUpdate: (key: string, status: KeyStatus) => void
  signal?: AbortSignal
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
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

/**
 * Get ISO date string for the given time range offset from now
 */
function getDateForRange(range: TimeRange): string | null {
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

/**
 * Helper to add a found key result
 */
function addKeyResult(
  key: string,
  pp: ProviderPattern,
  repo: string,
  author: string,
  filePath: string,
  fileUrl: string,
  source: SearchSource,
  seenKeys: Set<string>,
  allResults: ScanResult[],
  onResult: (r: ScanResult) => void,
  onResultUpdate: (key: string, status: KeyStatus) => void,
): boolean {
  if (seenKeys.has(key)) return false
  seenKeys.add(key)
  const result: ScanResult = {
    key,
    provider: pp.provider,
    providerLabel: pp.label,
    repo,
    author,
    filePath,
    fileUrl,
    timestamp: Date.now(),
    keyStatus: 'checking',
    source,
  }
  allResults.push(result)
  onResult(result)
  // Validate in background
  validateKey(key, pp.provider).then(status => {
    onResultUpdate(key, status)
  })
  return true
}

export async function scanForKeys(options: ScanOptions): Promise<ScanResult[]> {
  const { providers, githubToken, timeRange, maxPagesPerQuery = 3, onProgress, onResult, onResultUpdate, signal } = options
  const allResults: ScanResult[] = []
  const seenKeys = new Set<string>()

  const selectedPatterns = PROVIDER_PATTERNS.filter(p => providers.includes(p.provider))
  const dateFilter = getDateForRange(timeRange)

  // Count total work units: code queries + gist queries + commit queries per provider
  let totalQueries = 0
  for (const pp of selectedPatterns) {
    totalQueries += pp.searchQueries.length  // code search
    totalQueries += 1                         // gist search (1 query per provider)
    totalQueries += 1                         // commit search (1 query per provider)
  }

  let currentQuery = 0

  for (const pp of selectedPatterns) {
    if (signal?.aborted) return allResults

    // ─── Phase 1: Code Search ────────────────────────────────────────
    for (const query of pp.searchQueries) {
      if (signal?.aborted) return allResults

      currentQuery++
      const fullQuery = dateFilter
        ? `${query} pushed:>${dateFilter}`
        : query

      onProgress({
        currentProvider: pp.label,
        currentQuery,
        totalQueries,
        keysFound: allResults.length,
        status: 'scanning',
        message: `🔍 Code: "${query}"${dateFilter ? ` (since ${dateFilter})` : ''}`,
      })

      try {
        for (let page = 1; page <= maxPagesPerQuery; page++) {
          if (signal?.aborted) return allResults

          const searchResult = await searchGitHubAPI(fullQuery, githubToken, page)
          if (searchResult.items.length === 0) break

          for (const item of searchResult.items) {
            if (signal?.aborted) return allResults

            let foundKeys: string[] = []
            if (item.text_matches && item.text_matches.length > 0) {
              const allFragments = item.text_matches.map(tm => tm.fragment).join('\n')
              foundKeys = extractKeysFromText(allFragments, pp.patterns)
            }

            if (foundKeys.length === 0) {
              const content = await fetchFileContent(item.repository.full_name, item.path, githubToken)
              if (content) foundKeys = extractKeysFromText(content, pp.patterns)
              try { await sleep(300, signal) } catch { return allResults }
            }

            for (const key of foundKeys) {
              if (addKeyResult(key, pp, item.repository.full_name, item.repository.owner.login, item.path, item.html_url, 'code', seenKeys, allResults, onResult, onResultUpdate)) {
                onProgress({
                  currentProvider: pp.label, currentQuery, totalQueries,
                  keysFound: allResults.length, status: 'scanning',
                  message: `🔑 Found in ${item.repository.full_name}`,
                })
              }
            }
          }

          if (searchResult.items.length < 30) break
          try { await sleep(currentDelayMs, signal) } catch { return allResults }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return allResults
        if (err instanceof RateLimitError) {
          const waitSec = Math.min(err.retryAfterSeconds, 90)
          onProgress({ currentProvider: pp.label, currentQuery, totalQueries, keysFound: allResults.length, status: 'rate-limited', message: `Rate limited. Waiting ${waitSec}s...` })
          try { await sleep(waitSec * 1000, signal) } catch { return allResults }
          currentQuery--
          continue
        }
        if (err.message === 'AUTH_ERROR') {
          onProgress({ currentProvider: pp.label, currentQuery, totalQueries, keysFound: allResults.length, status: 'error', message: 'Invalid GitHub token.' })
          return allResults
        }
      }

      if (!signal?.aborted) {
        try { await sleep(currentDelayMs, signal) } catch { return allResults }
      }
    }

    // ─── Phase 2: Gist Search ────────────────────────────────────────
    if (signal?.aborted) return allResults
    currentQuery++
    const gistQuery = pp.searchQueries[0] // Use primary key prefix
    onProgress({
      currentProvider: pp.label, currentQuery, totalQueries,
      keysFound: allResults.length, status: 'scanning',
      message: `📋 Gists: "${gistQuery}"`,
    })

    try {
      // Gist search uses code search with 'gist' qualifier trick
      const gistFullQuery = `${gistQuery} path:*.txt OR path:*.md OR path:*.env`
      const gistResult = await searchGitHubGists(gistFullQuery, githubToken)

      for (const item of gistResult.items) {
        if (signal?.aborted) return allResults

        let foundKeys: string[] = []
        if (item.text_matches && item.text_matches.length > 0) {
          const frags = item.text_matches.map(tm => tm.fragment).join('\n')
          foundKeys = extractKeysFromText(frags, pp.patterns)
        }

        for (const key of foundKeys) {
          addKeyResult(key, pp, item.repository?.full_name || 'gist', item.repository?.owner?.login || 'unknown', item.path || 'gist', item.html_url, 'gist', seenKeys, allResults, onResult, onResultUpdate)
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return allResults
      if (err instanceof RateLimitError) {
        try { await sleep(Math.min(err.retryAfterSeconds, 60) * 1000, signal) } catch { return allResults }
      }
    }

    try { await sleep(currentDelayMs, signal) } catch { return allResults }

    // ─── Phase 3: Commit Search ──────────────────────────────────────
    if (signal?.aborted) return allResults
    currentQuery++
    const commitQuery = pp.searchQueries[0]
    onProgress({
      currentProvider: pp.label, currentQuery, totalQueries,
      keysFound: allResults.length, status: 'scanning',
      message: `📝 Commits: "${commitQuery}"`,
    })

    try {
      const commitFullQuery = dateFilter
        ? `${commitQuery} committer-date:>${dateFilter}`
        : commitQuery

      const commitResult = await searchGitHubCommits(commitFullQuery, githubToken)

      for (const item of commitResult.items) {
        if (signal?.aborted) return allResults

        let foundKeys: string[] = []
        // Check commit message and text_matches
        foundKeys.push(...extractKeysFromText(item.commit.message, pp.patterns))
        if (item.text_matches && item.text_matches.length > 0) {
          const frags = item.text_matches.map(tm => tm.fragment).join('\n')
          foundKeys.push(...extractKeysFromText(frags, pp.patterns))
        }

        for (const key of foundKeys) {
          addKeyResult(key, pp, item.repository.full_name, item.repository.owner.login, `commit/${item.sha.substring(0, 7)}`, item.html_url, 'commit', seenKeys, allResults, onResult, onResultUpdate)
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return allResults
      if (err instanceof RateLimitError) {
        try { await sleep(Math.min(err.retryAfterSeconds, 60) * 1000, signal) } catch { return allResults }
      }
    }

    try { await sleep(currentDelayMs, signal) } catch { return allResults }
  }

  onProgress({
    currentProvider: '',
    currentQuery: totalQueries,
    totalQueries,
    keysFound: allResults.length,
    status: 'done',
    message: `Scan complete! Found ${allResults.length} keys across code, gists, and commits.`,
  })

  return allResults
}
