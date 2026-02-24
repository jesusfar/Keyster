/**
 * API module — types and functions for provider validation & chat
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type Provider =
  | 'openai' | 'anthropic' | 'google' | 'openrouter' | 'xai'
  | 'groq' | 'cerebras' | 'mistral' | 'cohere' | 'together'
  | 'replicate' | 'huggingface' | 'deepseek' | 'fireworks'

export interface Model {
  id: string
  name?: string
}

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
}

// ─── Provider API Paths (via Vite proxy) ─────────────────────────────────────

const PROVIDER_ENDPOINTS: Record<Provider, { base: string; modelsPath: string; chatPath: string; authHeader: (key: string) => Record<string, string> }> = {
  openai:      { base: '/api/openai',      modelsPath: '/models', chatPath: '/chat/completions', authHeader: (k) => ({ 'Authorization': `Bearer ${k}`, 'Content-Type': 'application/json' }) },
  anthropic:   { base: '/api/anthropic',    modelsPath: '/models', chatPath: '/messages',          authHeader: (k) => ({ 'x-api-key': k, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }) },
  google:      { base: '/api/google',       modelsPath: '/models', chatPath: '/models',            authHeader: ()  => ({ 'Content-Type': 'application/json' }) },
  openrouter:  { base: '/api/openrouter',   modelsPath: '/models', chatPath: '/chat/completions', authHeader: (k) => ({ 'Authorization': `Bearer ${k}`, 'Content-Type': 'application/json' }) },
  xai:         { base: '/api/xai',          modelsPath: '/models', chatPath: '/chat/completions', authHeader: (k) => ({ 'Authorization': `Bearer ${k}`, 'Content-Type': 'application/json' }) },
  groq:        { base: '/api/groq',         modelsPath: '/models', chatPath: '/chat/completions', authHeader: (k) => ({ 'Authorization': `Bearer ${k}`, 'Content-Type': 'application/json' }) },
  cerebras:    { base: '/api/cerebras',     modelsPath: '/models', chatPath: '/chat/completions', authHeader: (k) => ({ 'Authorization': `Bearer ${k}`, 'Content-Type': 'application/json' }) },
  mistral:     { base: '/api/mistral',      modelsPath: '/models', chatPath: '/chat/completions', authHeader: (k) => ({ 'Authorization': `Bearer ${k}`, 'Content-Type': 'application/json' }) },
  cohere:      { base: '/api/cohere',       modelsPath: '/models', chatPath: '/chat',              authHeader: (k) => ({ 'Authorization': `Bearer ${k}`, 'Content-Type': 'application/json' }) },
  together:    { base: '/api/together',     modelsPath: '/models', chatPath: '/chat/completions', authHeader: (k) => ({ 'Authorization': `Bearer ${k}`, 'Content-Type': 'application/json' }) },
  replicate:   { base: '/api/replicate',    modelsPath: '/models', chatPath: '/predictions',       authHeader: (k) => ({ 'Authorization': `Bearer ${k}`, 'Content-Type': 'application/json' }) },
  huggingface: { base: '/api/huggingface',  modelsPath: '/models', chatPath: '/chat/completions', authHeader: (k) => ({ 'Authorization': `Bearer ${k}`, 'Content-Type': 'application/json' }) },
  deepseek:    { base: '/api/deepseek',     modelsPath: '/models', chatPath: '/chat/completions', authHeader: (k) => ({ 'Authorization': `Bearer ${k}`, 'Content-Type': 'application/json' }) },
  fireworks:   { base: '/api/fireworks',    modelsPath: '/models', chatPath: '/chat/completions', authHeader: (k) => ({ 'Authorization': `Bearer ${k}`, 'Content-Type': 'application/json' }) },
}

// ─── Validate Key & Fetch Models ─────────────────────────────────────────────

export async function validateAndFetchModels(provider: Provider, apiKey: string): Promise<Model[]> {
  const ep = PROVIDER_ENDPOINTS[provider]
  if (!ep) throw new Error(`Unknown provider: ${provider}`)

  // Google uses query param
  const url = provider === 'google'
    ? `${ep.base}${ep.modelsPath}?key=${apiKey}`
    : `${ep.base}${ep.modelsPath}`

  const response = await fetch(url, {
    headers: ep.authHeader(apiKey),
  })

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid API key')
    }
    throw new Error(`API error: ${response.status}`)
  }

  const data = await response.json()

  // Different providers return models differently
  if (provider === 'google') {
    // Google returns { models: [{ name: "models/gemini-pro", displayName: "..." }] }
    return (data.models || []).map((m: { name?: string, displayName?: string }) => ({
      id: m.name?.replace('models/', '') || m.name,
      name: m.displayName || m.name,
    }))
  }

  if (provider === 'openrouter') {
    return (data.data || []).map((m: { id: string, name?: string }) => ({
      id: m.id,
      name: m.name || m.id,
    }))
  }

  if (provider === 'anthropic') {
    return (data.data || []).map((m: { id: string, display_name?: string }) => ({
      id: m.id,
      name: m.display_name || m.id,
    }))
  }

  if (provider === 'cohere') {
    return (data.models || []).map((m: { id: string, name?: string }) => ({
      id: m.name || m.id,
      name: m.name || m.id,
    }))
  }

  // OpenAI-compatible format (most providers)
  return (data.data || data.models || []).map((m: { id: string }) => ({
    id: m.id,
    name: m.id,
  }))
}

// ─── Send Chat Message ───────────────────────────────────────────────────────

export async function sendChatMessage(
  provider: Provider,
  apiKey: string,
  model: string,
  messages: Message[]
): Promise<string> {
  const ep = PROVIDER_ENDPOINTS[provider]
  if (!ep) throw new Error(`Unknown provider: ${provider}`)

  // Build request body based on provider
  if (provider === 'anthropic') {
    return sendAnthropicChat(ep, apiKey, model, messages)
  }

  if (provider === 'google') {
    return sendGoogleChat(ep, apiKey, model, messages)
  }

  if (provider === 'cohere') {
    return sendCohereChat(ep, apiKey, model, messages)
  }

  // OpenAI-compatible format (most providers)
  return sendOpenAIChat(ep, apiKey, model, messages)
}

// ─── Provider-specific Chat Implementations ──────────────────────────────────

async function sendOpenAIChat(
  ep: typeof PROVIDER_ENDPOINTS[Provider],
  apiKey: string,
  model: string,
  messages: Message[]
): Promise<string> {
  const response = await fetch(`${ep.base}${ep.chatPath}`, {
    method: 'POST',
    headers: ep.authHeader(apiKey),
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || 'No response'
}

async function sendAnthropicChat(
  ep: typeof PROVIDER_ENDPOINTS[Provider],
  apiKey: string,
  model: string,
  messages: Message[]
): Promise<string> {
  // Extract system message if present
  const systemMsg = messages.find(m => m.role === 'system')
  const chatMsgs = messages.filter(m => m.role !== 'system')

  const body: Record<string, unknown> = {
    model,
    max_tokens: 4096,
    messages: chatMsgs.map(m => ({
      role: m.role,
      content: m.content,
    })),
  }

  if (systemMsg && typeof systemMsg.content === 'string') {
    body.system = systemMsg.content
  }

  const response = await fetch(`${ep.base}${ep.chatPath}`, {
    method: 'POST',
    headers: ep.authHeader(apiKey),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `API error: ${response.status}`)
  }

  const data = await response.json()
  return data.content?.[0]?.text || 'No response'
}

async function sendGoogleChat(
  ep: typeof PROVIDER_ENDPOINTS[Provider],
  apiKey: string,
  model: string,
  messages: Message[]
): Promise<string> {
  // Extract system instruction
  const systemMsg = messages.find(m => m.role === 'system')
  const chatMsgs = messages.filter(m => m.role !== 'system')

  const body: Record<string, unknown> = {
    contents: chatMsgs.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: typeof m.content === 'string'
        ? [{ text: m.content }]
        : m.content.map((p: { type: string, text?: string, image_url?: { url: string } }) => {
            if (p.type === 'text') return { text: p.text }
            if (p.type === 'image_url') {
              const url = p.image_url.url
              if (url.startsWith('data:')) {
                const [meta, data] = url.split(',')
                const mimeType = meta.split(':')[1].split(';')[0]
                return { inlineData: { mimeType, data } }
              }
            }
            return { text: '' }
          }),
    })),
  }

  if (systemMsg && typeof systemMsg.content === 'string') {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] }
  }

  const response = await fetch(`${ep.base}/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `API error: ${response.status}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response'
}

async function sendCohereChat(
  ep: typeof PROVIDER_ENDPOINTS[Provider],
  apiKey: string,
  model: string,
  messages: Message[]
): Promise<string> {
  // Get the last user message as the query
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
  const chatHistory = messages
    .filter(m => m !== lastUserMsg && m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
      message: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    }))

  const body: Record<string, unknown> = {
    model,
    message: typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : JSON.stringify(lastUserMsg?.content),
    chat_history: chatHistory,
  }

  const systemMsg = messages.find(m => m.role === 'system')
  if (systemMsg && typeof systemMsg.content === 'string') {
    body.preamble = systemMsg.content
  }

  const response = await fetch(`${ep.base}${ep.chatPath}`, {
    method: 'POST',
    headers: ep.authHeader(apiKey),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `API error: ${response.status}`)
  }

  const data = await response.json()
  return data.text || data.message || 'No response'
}