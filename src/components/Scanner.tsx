import { useState, useRef, useCallback, useEffect } from 'react'
import { PROVIDER_PATTERNS, scanForKeys } from '../lib/scanner'
import type { ScanResult, ScanProgress, KeyStatus, TimeRange } from '../lib/scanner'
import { useToast } from './ToastContext'
import './Scanner.css'

// ─── Persistence ─────────────────────────────────────────────────────────────
const STORAGE_KEY = 'keyster_scan_results'

function saveResults(results: ScanResult[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(results))
  } catch { /* quota exceeded or disabled */ }
}

function loadResults(): ScanResult[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

// ─── Sound Notification ──────────────────────────────────────────────────────
function playValidKeySound() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.value = 0.15
    osc.start()
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.stop(ctx.currentTime + 0.3)
    // Second beep
    setTimeout(() => {
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.frequency.value = 1100
      osc2.type = 'sine'
      gain2.gain.value = 0.15
      osc2.start()
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc2.stop(ctx.currentTime + 0.3)
    }, 150)
  } catch { /* AudioContext not supported */ }
}

// ─── Export ──────────────────────────────────────────────────────────────────
function exportAsJSON(results: ScanResult[]) {
  const data = JSON.stringify(results, null, 2)
  downloadFile(data, 'keyster-results.json', 'application/json')
}

function exportAsCSV(results: ScanResult[]) {
  const header = 'Key,Provider,Status,Repo,Author,File,URL,Source,Timestamp\n'
  const rows = results.map(r =>
    `"${r.key}","${r.providerLabel}","${r.keyStatus}","${r.repo}","${r.author}","${r.filePath}","${r.fileUrl}","${r.source}","${new Date(r.timestamp).toISOString()}"`
  ).join('\n')
  downloadFile(header + rows, 'keyster-results.csv', 'text/csv')
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Component ───────────────────────────────────────────────────────────────
export function Scanner() {
  const [selectedProviders, setSelectedProviders] = useState<string[]>(
    PROVIDER_PATTERNS.map(p => p.provider)
  )
  const [githubToken, setGithubToken] = useState(() => 
    localStorage.getItem('keyster_github_token') || ''
  )
  const [results, setResults] = useState<ScanResult[]>(() => loadResults())
  const [filterProvider, setFilterProvider] = useState<string>('all')
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [continuousMode, setContinuousMode] = useState(false)
  const [scanCycle, setScanCycle] = useState(0)
  const continuousRef = useRef(false)
  const [progress, setProgress] = useState<ScanProgress>({
    currentProvider: '',
    currentQuery: 0,
    totalQueries: 0,
    keysFound: 0,
    status: 'idle',
    message: '',
  })
  const abortRef = useRef<AbortController | null>(null)
  const { showToast } = useToast()

  // Persist results whenever they change
  useEffect(() => {
    if (results.length > 0) saveResults(results)
  }, [results])

  const toggleProvider = (provider: string) => {
    setSelectedProviders(prev =>
      prev.includes(provider)
        ? prev.filter(p => p !== provider)
        : [...prev, provider]
    )
  }

  const selectAll = () => setSelectedProviders(PROVIDER_PATTERNS.map(p => p.provider))
  const selectNone = () => setSelectedProviders([])

  const handleTokenChange = (value: string) => {
    setGithubToken(value)
    if (value) {
      localStorage.setItem('keyster_github_token', value)
    } else {
      localStorage.removeItem('keyster_github_token')
    }
  }

  const runScanCycle = useCallback(async (controller: AbortController, keepResults: boolean) => {
    if (!keepResults) setResults([])

    try {
      await scanForKeys({
        providers: selectedProviders,
        githubToken: githubToken.trim(),
        timeRange,
        maxPagesPerQuery: 3,
        onProgress: (p) => setProgress(p),
        onResult: (r) => setResults(prev => {
          // Deduplicate across cycles
          if (prev.some(existing => existing.key === r.key)) return prev
          return [...prev, r]
        }),
        onResultUpdate: (key: string, status: KeyStatus) => {
          setResults(prev => {
            const updated = prev.map(r =>
              r.key === key ? { ...r, keyStatus: status } : r
            )
            if (status === 'valid' && soundEnabled) {
              playValidKeySound()
            }
            return updated
          })
        },
        signal: controller.signal,
      })
    } catch {
      // handled in scanner
    }
  }, [selectedProviders, githubToken, timeRange, soundEnabled])

  const startScan = useCallback(async () => {
    if (selectedProviders.length === 0) {
      showToast('Select at least one provider', 'error')
      return
    }
    if (!githubToken.trim()) {
      showToast('Enter a GitHub Personal Access Token', 'error')
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    continuousRef.current = continuousMode
    setScanCycle(1)

    // First cycle clears results
    await runScanCycle(controller, false)

    // If continuous mode, keep looping
    while (continuousRef.current && !controller.signal.aborted) {
      setScanCycle(prev => prev + 1)
      setProgress(p => ({ ...p, status: 'scanning', message: `♻️ Starting new scan cycle...` }))
      // Brief pause between cycles
      await new Promise(r => setTimeout(r, 5000))
      if (controller.signal.aborted) break
      await runScanCycle(controller, true) // Keep existing results
    }
  }, [selectedProviders, githubToken, continuousMode, runScanCycle, showToast])

  const stopScan = () => {
    continuousRef.current = false
    abortRef.current?.abort()
    setProgress(prev => ({ ...prev, status: 'idle', message: 'Scan stopped by user' }))
  }

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    showToast('Key copied to clipboard', 'success')
  }

  const useKeyInChat = (key: string, provider: string) => {
    // Save the key to localStorage so the Chat sidebar picks it up
    localStorage.setItem(`apiKey_${provider}`, key)
    showToast(`Key saved for ${provider} — switch to Chat tab to use it!`, 'success')
  }

  const clearResults = () => {
    setResults([])
    localStorage.removeItem(STORAGE_KEY)
    setProgress(p => ({ ...p, status: 'idle', message: '', keysFound: 0 }))
    showToast('Results cleared', 'success')
  }

  const isScanning = progress.status === 'scanning' || progress.status === 'rate-limited'
  const progressPercent = progress.totalQueries > 0
    ? Math.round((progress.currentQuery / progress.totalQueries) * 100)
    : 0

  // Filter and sort results (valid keys first)
  const statusOrder: Record<string, number> = { valid: 0, checking: 1, rate_limited: 2, error: 3, invalid: 4 }
  const filteredResults = (filterProvider === 'all'
    ? results
    : results.filter(r => r.provider === filterProvider)
  ).slice().sort((a, b) => (statusOrder[a.keyStatus] ?? 9) - (statusOrder[b.keyStatus] ?? 9))

  // Stats
  const statsByProvider = results.reduce((acc, r) => {
    acc[r.provider] = (acc[r.provider] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const validCount = results.filter(r => r.keyStatus === 'valid').length
  const invalidCount = results.filter(r => r.keyStatus === 'invalid').length
  const checkingCount = results.filter(r => r.keyStatus === 'checking').length

  return (
    <div className="scanner-page">
      {/* Header */}
      <div className="scanner-header">
        <div className="scanner-title-area">
          <h1>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            GitHub Key Scanner
          </h1>
          <p>Scan public GitHub repositories for exposed AI API keys</p>
        </div>
        <div className="header-actions">
          {results.length > 0 && (
            <div className="live-counter">
              <span className="live-dot" />
              <span>{results.length} keys found</span>
              {validCount > 0 && <span className="valid-badge">✅ {validCount} valid</span>}
            </div>
          )}
        </div>
      </div>

      <div className="scanner-body">
        {/* Config Panel */}
        <div className="scanner-config">
          {/* GitHub Token */}
          <div className="config-section">
            <label className="config-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              GitHub Personal Access Token
            </label>
            <div className="token-input-row">
              <input
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                value={githubToken}
                onChange={(e) => handleTokenChange(e.target.value)}
                className="token-input"
                disabled={isScanning}
              />
              {githubToken && (
                <button className="token-clear-btn" title="Clear token" onClick={() => handleTokenChange('')}>✕</button>
              )}
            </div>
            <span className="config-hint">
              Create at <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">github.com/settings/tokens</a> — no special scopes needed
            </span>
          </div>

          {/* Time Range */}
          <div className="config-section">
            <label className="config-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Time Range
            </label>
            <select className="time-range-select" value={timeRange} onChange={(e) => setTimeRange(e.target.value as TimeRange)} disabled={isScanning}>
              <option value="1h">Last hour</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </div>

          {/* Provider Selection */}
          <div className="config-section">
            <div className="config-label-row">
              <label className="config-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                </svg>
                Providers
              </label>
              <div className="select-actions">
                <button onClick={selectAll} disabled={isScanning}>All</button>
                <button onClick={selectNone} disabled={isScanning}>None</button>
              </div>
            </div>
            <div className="provider-grid">
              {PROVIDER_PATTERNS.map(pp => (
                <label key={pp.provider} className={`provider-chip ${selectedProviders.includes(pp.provider) ? 'active' : ''}`}>
                  <input type="checkbox" checked={selectedProviders.includes(pp.provider)} onChange={() => toggleProvider(pp.provider)} disabled={isScanning} />
                  <span className="chip-icon">{pp.icon}</span>
                  <span className="chip-label">{pp.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="config-section">
            <label className="config-label">Options</label>
            <label className="option-toggle">
              <input type="checkbox" checked={soundEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} />
              <span>🔔 Sound on valid key</span>
            </label>
            <label className="option-toggle">
              <input type="checkbox" checked={continuousMode} onChange={(e) => setContinuousMode(e.target.checked)} disabled={isScanning} />
              <span>♻️ Continuous scan (never stops)</span>
            </label>
          </div>

          {/* Scan Controls */}
          <div className="scan-controls">
            {!isScanning ? (
              <button className="btn-scan" onClick={startScan} disabled={selectedProviders.length === 0 || !githubToken.trim()}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                Start Scan
              </button>
            ) : (
              <button className="btn-stop" onClick={stopScan}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
                Stop Scan
              </button>
            )}

            {results.length > 0 && !isScanning && (
              <div className="export-controls">
                <button className="btn-export" onClick={() => exportAsJSON(results)}>📥 JSON</button>
                <button className="btn-export" onClick={() => exportAsCSV(results)}>📥 CSV</button>
                <button className="btn-clear" onClick={clearResults}>🗑️ Clear</button>
              </div>
            )}
          </div>
        </div>

        {/* Progress & Results */}
        <div className="scanner-results-area">
          {/* Progress Bar */}
          {(isScanning || progress.status === 'done') && (
            <div className="progress-section">
              <div className="progress-header">
                <span className={`progress-status status-${progress.status}`}>
                  {progress.status === 'scanning' && '● Scanning'}
                  {progress.status === 'rate-limited' && '⏳ Rate Limited'}
                  {progress.status === 'done' && '✓ Complete'}
                </span>
                <span className="progress-percent">{progressPercent}%</span>
              {scanCycle > 1 && <span className="cycle-badge">♻️ Cycle {scanCycle}</span>}
              </div>
              <div className="progress-bar-track">
                <div className={`progress-bar-fill ${progress.status === 'rate-limited' ? 'rate-limited' : ''}`} style={{ width: `${progressPercent}%` }} />
              </div>
              <p className="progress-message">{progress.message}</p>
            </div>
          )}

          {/* Stats */}
          {results.length > 0 && (
            <div className="stats-row">
              <div className="stat-card stat-total">
                <span className="stat-number">{results.length}</span>
                <span className="stat-label">Total Found</span>
              </div>
              <div className="stat-card stat-valid">
                <span className="stat-number">{validCount}</span>
                <span className="stat-label">✅ Valid</span>
              </div>
              <div className="stat-card stat-invalid">
                <span className="stat-number">{invalidCount}</span>
                <span className="stat-label">❌ Invalid</span>
              </div>
              {checkingCount > 0 && (
                <div className="stat-card">
                  <span className="stat-number">{checkingCount}</span>
                  <span className="stat-label">🔄 Checking</span>
                </div>
              )}
              {Object.entries(statsByProvider).map(([provider, count]) => {
                const pp = PROVIDER_PATTERNS.find(p => p.provider === provider)
                return (
                  <div className="stat-card" key={provider}>
                    <span className="stat-number">{count}</span>
                    <span className="stat-label">{pp?.icon} {pp?.label || provider}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Filter Tabs */}
          {results.length > 0 && (
            <div className="filter-tabs">
              <button className={`filter-tab ${filterProvider === 'all' ? 'active' : ''}`} onClick={() => setFilterProvider('all')}>
                All ({results.length})
              </button>
              {Object.entries(statsByProvider).map(([provider, count]) => {
                const pp = PROVIDER_PATTERNS.find(p => p.provider === provider)
                return (
                  <button key={provider} className={`filter-tab ${filterProvider === provider ? 'active' : ''}`} onClick={() => setFilterProvider(provider)}>
                    {pp?.icon} {pp?.label} ({count})
                  </button>
                )
              })}
            </div>
          )}

          {/* Results Grid */}
          {filteredResults.length > 0 && (
            <div className="results-grid">
              {filteredResults.map((r, i) => (
                <div key={i} className={`leak-card ${r.keyStatus === 'valid' ? 'card-valid-glow' : ''}`}>
                  <div className="leak-card-header">
                    <code className="leak-key">{r.key}</code>
                    <span className={`key-status status-${r.keyStatus}`}>
                      {r.keyStatus === 'checking' && '🔄 Checking...'}
                      {r.keyStatus === 'valid' && '✅ Valid'}
                      {r.keyStatus === 'invalid' && '❌ Invalid'}
                      {r.keyStatus === 'rate_limited' && '⏳ Rate Limited'}
                      {r.keyStatus === 'error' && '⚠️ Error'}
                    </span>
                    <span className={`provider-badge badge-${r.provider}`}>{r.providerLabel}</span>
                  </div>
                  <div className="leak-card-body">
                    <div className="leak-meta">
                      <span className="leak-meta-label">Repo:</span>
                      <a href={`https://github.com/${r.repo}`} target="_blank" rel="noreferrer" className="leak-link">{r.repo}</a>
                    </div>
                    <div className="leak-meta">
                      <span className="leak-meta-label">by</span>
                      <a href={`https://github.com/${r.author}`} target="_blank" rel="noreferrer" className="leak-link">{r.author}</a>
                    </div>
                    <div className="leak-meta">
                      <span className="leak-meta-label">File:</span>
                      <code className="leak-path">{r.filePath}</code>
                    </div>
                    <div className="leak-meta">
                      <span className="leak-meta-label">Source:</span>
                      <span className={`source-badge source-${r.source}`}>
                        {r.source === 'code' && '📄 Code'}
                        {r.source === 'gist' && '📋 Gist'}
                        {r.source === 'commit' && '📝 Commit'}
                      </span>
                    </div>
                  </div>
                  <div className="leak-card-footer">
                    <a href={r.fileUrl} target="_blank" rel="noreferrer" className="leak-source-btn">View on GitHub ↗</a>
                    <div className="card-actions">
                      {r.keyStatus === 'valid' && (
                        <button className="btn-use-key" onClick={() => useKeyInChat(r.key, r.provider)} title="Use this key in Chat">
                          ⚡ Use
                        </button>
                      )}
                      <button className="copy-key-btn" onClick={() => copyKey(r.key)} title="Copy full key to clipboard">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                        Copy Key
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isScanning && progress.status === 'idle' && results.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                  <path d="M11 8v6" />
                  <path d="M8 11h6" />
                </svg>
              </div>
              <h3>Ready to Scan</h3>
              <p>Enter your GitHub token, select providers, and start scanning to find exposed API keys in public repositories.</p>
            </div>
          )}

          {/* Scanning but no results */}
          {isScanning && results.length === 0 && (
            <div className="empty-state">
              <div className="scanning-spinner" />
              <h3>Scanning GitHub...</h3>
              <p>{progress.message}</p>
            </div>
          )}

          {/* Disclaimer */}
          <div className="disclaimer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
            <span>For security research only. Do not use found keys without authorization.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
