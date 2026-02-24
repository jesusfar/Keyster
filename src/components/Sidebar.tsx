import { useState, useEffect } from 'react'
import { validateAndFetchModels } from '../lib/api'
import type { Provider, Model } from '../lib/api'
import { getApiKey, saveApiKey, clearApiKey } from '../lib/storage'
import { useToast } from './ToastContext'
import './Sidebar.css'

interface SidebarProps {
  onSessionConfigured: (provider: Provider, key: string, model: string) => void
}

export function Sidebar({ onSessionConfigured }: SidebarProps) {
  const [provider, setProvider] = useState<Provider>('openai')
  const [apiKey, setApiKey] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  
  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  
  const { showToast } = useToast()

  // Load saved key on provider change
  useEffect(() => {
    const savedKey = getApiKey(provider)
    if (savedKey) {
      setApiKey(savedKey)
    } else {
      setApiKey('')
    }
    // reset connection state when changing provider
    setIsConnected(false)
    setModels([])
    setSelectedModel('')
  }, [provider])

  const handleValidate = async () => {
    if (!apiKey.trim()) {
      showToast('Please enter an API key', 'error')
      return
    }

    setIsLoading(true)
    try {
      const fetchedModels = await validateAndFetchModels(provider, apiKey)
      const sortedModels = [...fetchedModels].sort((a, b) => 
        (a.name || a.id).localeCompare(b.name || b.id)
      )
      setModels(sortedModels)
      if (sortedModels.length > 0) {
        setSelectedModel(sortedModels[0].id)
      }
      setIsConnected(true)
      saveApiKey(provider, apiKey)
      showToast(`Connected to ${provider.toUpperCase()}`, 'success')
      
      if (sortedModels.length > 0) {
        onSessionConfigured(provider, apiKey, sortedModels[0].id)
      }
    } catch (err: unknown) {
      setIsConnected(false)
      showToast((err as Error).message || 'Failed to connect', 'error')
      clearApiKey(provider)
    } finally {
      setIsLoading(false)
    }
  }

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value
    setSelectedModel(newModel)
    if (isConnected) {
      onSessionConfigured(provider, apiKey, newModel)
    }
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Keyster</h2>
        <p>API Key Tester & Chat</p>
      </div>
      
      <div className="sidebar-content">
        <label>Select Provider</label>
        <select 
          className="provider-select" 
          value={provider}
          onChange={(e) => setProvider(e.target.value as Provider)}
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="google">Google</option>
          <option value="openrouter">OpenRouter</option>
          <option value="xai">xAI (Grok)</option>
          <option value="groq">Groq</option>
          <option value="cerebras">Cerebras</option>
          <option value="mistral">Mistral AI</option>
          <option value="cohere">Cohere</option>
          <option value="together">Together AI</option>
          <option value="replicate">Replicate</option>
          <option value="huggingface">Hugging Face</option>
          <option value="deepseek">Deepseek</option>
          <option value="fireworks">Fireworks AI</option>
        </select>

        <label>API Key</label>
        <div className="api-key-input-container">
          <input 
            type="password" 
            placeholder="sk-..." 
            className="api-key-input"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          {apiKey && (
            <button 
              className="key-delete-btn"
              title="Delete API key"
              onClick={() => {
                clearApiKey(provider)
                setApiKey('')
                setIsConnected(false)
                setModels([])
                setSelectedModel('')
                showToast('API key removed', 'info')
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
        </div>
        
        <button 
          className="btn-primary validate-btn" 
          onClick={handleValidate}
          disabled={isLoading || !apiKey.trim()}
        >
          {isLoading ? 'Validating...' : 'Validate & Connect'}
        </button>

        {isConnected && models.length > 0 && (
          <div className="model-selection-area">
            <label>Select Model</label>
            <select 
              className="provider-select" 
              value={selectedModel}
              onChange={handleModelChange}
            >
              {models.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name || m.id}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="status-indicator">
          <span className={`dot ${isConnected ? 'dot-online' : 'dot-offline'}`}></span> 
          {isConnected ? 'Connected' : 'Not Connected'}
        </div>
      </div>
    </div>
  )
}
