import type { Provider } from './api'

export interface ProviderInfo {
  id: Provider
  name: string
  logo?: string
}

export const PROVIDERS: ProviderInfo[] = [
  { id: 'openai', name: 'OpenAI' },
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'google', name: 'Google' },
  { id: 'openrouter', name: 'OpenRouter' },
  { id: 'xai', name: 'xAI (Grok)' },
  { id: 'groq', name: 'Groq' },
  { id: 'cerebras', name: 'Cerebras' },
  { id: 'mistral', name: 'Mistral AI' },
  { id: 'cohere', name: 'Cohere' },
  { id: 'together', name: 'Together AI' },
  { id: 'replicate', name: 'Replicate' },
  { id: 'huggingface', name: 'Hugging Face' },
  { id: 'deepseek', name: 'Deepseek' },
  { id: 'fireworks', name: 'Fireworks AI' },
]

export const getProviderById = (id: Provider): ProviderInfo | undefined => 
  PROVIDERS.find(p => p.id === id)
