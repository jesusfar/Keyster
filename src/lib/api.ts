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
  role: 'user' | 'assistant' | 'system' | 'error'
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
}

declare global {
  interface Window {
    electronAPI?: {
      startProxy: (port: number) => Promise<{ success: boolean; error?: string }>
      stopProxy: () => Promise<{ success: boolean; error?: string }>
      updateProxyKeys: (keys: Record<string, string[]>) => void
      onProxyLog: (callback: (message: string) => void) => () => void
      onLog?: (callback: (message: string) => void) => () => void
      
      execCommand: (command: string, cwd?: string) => Promise<{ stdout: string; stderr: string; error?: string }>
      readFile: (filePath: string) => Promise<{ content: string; error?: string }>
      listDir: (dirPath: string) => Promise<{ files: string[]; error?: string }>
    }
  }
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
  messages: Message[],
  useAgent: boolean = false
): Promise<string> {
  const ep = PROVIDER_ENDPOINTS[provider]
  if (!ep) throw new Error(`Unknown provider: ${provider}`)

  // Tool Definitions
  const tools = [
    {
      type: "function",
      function: {
        name: "exec_command",
        description: "Executes a shell command on the local machine.",
        parameters: {
          type: "object",
          properties: {
            command: { type: "string", description: "The shell command to run." },
            cwd: { type: "string", description: "Optional working directory." }
          },
          required: ["command"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "read_file",
        description: "Reads the content of a file on the local machine.",
        parameters: {
          type: "object",
          properties: {
            filePath: { type: "string", description: "Absolute path to the file." }
          },
          required: ["filePath"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "list_dir",
        description: "Lists the contents of a directory on the local machine.",
        parameters: {
          type: "object",
          properties: {
            dirPath: { type: "string", description: "Absolute path to the directory." }
          },
          required: ["dirPath"]
        }
      }
    }
  ]

  // Build request body based on provider
  if (provider === 'anthropic') {
    return sendAnthropicChat(ep, apiKey, model, messages, useAgent ? tools : undefined)
  }

  if (provider === 'google') {
    return sendGoogleChat(ep, apiKey, model, messages)
  }

  if (provider === 'cohere') {
    return sendCohereChat(ep, apiKey, model, messages)
  }

  // OpenAI-compatible format (most providers)
  return sendOpenAIChat(ep, apiKey, model, messages, useAgent ? tools : undefined)
}

// ─── Agent Tool Execution ────────────────────────────────────────────────────

async function executeToolCall(name: string, args: any): Promise<string> {
  if (!window.electronAPI) return "Error: Electron backend not available"
  try {
    if (name === 'exec_command') {
      const res = await window.electronAPI.execCommand(args.command, args.cwd)
      if (res.error) return `Error: ${res.error}\nStderr: ${res.stderr}`
      return `Stdout: ${res.stdout}\nStderr: ${res.stderr}`
    } else if (name === 'read_file') {
      const res = await window.electronAPI.readFile(args.filePath)
      if (res.error) return `Error: ${res.error}`
      return res.content
    } else if (name === 'list_dir') {
      const res = await window.electronAPI.listDir(args.dirPath)
      if (res.error) return `Error: ${res.error}`
      return JSON.stringify(res.files, null, 2)
    }
  } catch (err: any) {
    return `Error executing tool: ${err.message}`
  }
  return `Unknown tool: ${name}`
}

// ─── Provider-specific Chat Implementations ──────────────────────────────────

const MAX_TOOL_DEPTH = 10

async function sendOpenAIChat(
  ep: typeof PROVIDER_ENDPOINTS[Provider],
  apiKey: string,
  model: string,
  messages: Message[],
  tools?: any[],
  depth: number = 0
): Promise<string> {
  const chatMessages = messages.filter(m => m.role !== 'error')
  const body: any = {
    model,
    messages: chatMessages.map(m => ({
      role: m.role,
      content: m.content,
    })),
    max_tokens: 4096,
  }

  if (tools) body.tools = tools

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
  const msg = data.choices?.[0]?.message
  
  if (msg?.tool_calls && msg.tool_calls.length > 0) {
    if (depth >= MAX_TOOL_DEPTH) {
      return (msg.content || '') + '\n\n[Agent stopped: maximum tool call depth reached]'
    }
    // Execute the first tool call (for simplicity, only handling one right now)
    const tc = msg.tool_calls[0]
    let argsStr = tc.function.arguments
    let args = {}
    try { args = JSON.parse(argsStr) } catch { }
    
    // Announce to user what tool is running
    const toolMsg = `[Agent processing tool '${tc.function.name}'...]`
    const result = await executeToolCall(tc.function.name, args)
    
    // Automatically recurse
    messages.push({ role: 'assistant', content: msg.content || '' }) // we must append the tool_calls property technically for OpenAI strict mode, but let's try pushing the stringified response to keep types simple
    
    // A quick hack for the limited types here is to just append a system message with the tool result. To properly do it we need to augment Message type.
    // We will do the simple system append for now.
    messages.push({ role: 'user', content: `[Tool Result for ${tc.function.name}]:\n${result}` })
    
    return toolMsg + '\n\n' + await sendOpenAIChat(ep, apiKey, model, messages, tools, depth + 1)
  }

  return msg?.content || 'No response'
}

async function sendAnthropicChat(
  ep: typeof PROVIDER_ENDPOINTS[Provider],
  apiKey: string,
  model: string,
  messages: Message[],
  tools?: any[],
  depth: number = 0
): Promise<string> {
  // Filter out error messages and extract system message
  const validMessages = messages.filter(m => m.role !== 'error')
  const systemMsg = validMessages.find(m => m.role === 'system')
  const chatMsgs = validMessages.filter(m => m.role !== 'system')

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

  // Anthropic tool format is slightly different
  if (tools) {
    body.tools = tools.map((t: any) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters
    }))
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
  const contentArray = data.content || []
  
  const textMsg = contentArray.find((c: any) => c.type === 'text')?.text || ''
  const toolCall = contentArray.find((c: any) => c.type === 'tool_use')
  
  if (toolCall) {
    if (depth >= MAX_TOOL_DEPTH) {
      return (textMsg || '') + '\n\n[Agent stopped: maximum tool call depth reached]'
    }
    const result = await executeToolCall(toolCall.name, toolCall.input)
    const toolMsg = `[Agent processing tool '${toolCall.name}'...]`

    // Append context to chat and repeat
    messages.push({ role: 'assistant', content: textMsg }) // Not fully spec compliant but enough to give context
    messages.push({ role: 'user', content: `[Tool Result for ${toolCall.name}]:\n${result}` })

    return (textMsg ? textMsg + '\n\n' : '') + toolMsg + '\n\n' + await sendAnthropicChat(ep, apiKey, model, messages, tools, depth + 1)
  }

  return textMsg || 'No response'
}

async function sendGoogleChat(
  ep: typeof PROVIDER_ENDPOINTS[Provider],
  apiKey: string,
  model: string,
  messages: Message[]
): Promise<string> {
  // Filter out error messages and extract system instruction
  const validMessages = messages.filter(m => m.role !== 'error')
  const systemMsg = validMessages.find(m => m.role === 'system')
  const chatMsgs = validMessages.filter(m => m.role !== 'system')

  const body: Record<string, unknown> = {
    contents: chatMsgs.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: typeof m.content === 'string'
        ? [{ text: m.content }]
        : m.content.map((p: { type: string, text?: string, image_url?: { url: string } }) => {
            if (p.type === 'text') return { text: p.text }
            if (p.type === 'image_url' && p.image_url) {
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
  // Filter out error messages, then get the last user message as the query
  const validMessages = messages.filter(m => m.role !== 'error')
  const lastUserMsg = [...validMessages].reverse().find(m => m.role === 'user')
  const chatHistory = validMessages
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

  const systemMsg = validMessages.find(m => m.role === 'system')
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