import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatWindow } from './components/ChatWindow'
import { Scanner } from './components/Scanner'
import type { Provider } from './lib/api'

export interface ChatSession {
  provider: Provider
  apiKey: string
  model: string
}

type AppTab = 'chat' | 'scanner'

function App() {
  const [session, setSession] = useState<ChatSession | null>(null)
  const [activeTab, setActiveTab] = useState<AppTab>('chat')

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh' }}>
      {/* Tab Navigation */}
      <nav className="app-tabs">
        <div className="app-brand">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="brand-name">Keyster</span>
        </div>
        <div className="tab-buttons">
          <button
            className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Chat
        </button>
        <button
          className={`tab-btn ${activeTab === 'scanner' ? 'active' : ''}`}
          onClick={() => setActiveTab('scanner')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          Scanner
        </button>
        </div>
        <div className="tab-indicator" />
      </nav>

      {/* Tab Content */}
      {activeTab === 'chat' ? (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar onSessionConfigured={(provider, key, model) => setSession({ provider, apiKey: key, model })} />
          <ChatWindow session={session} />
        </div>
      ) : (
        <Scanner />
      )}
    </div>
  )
}

export default App
