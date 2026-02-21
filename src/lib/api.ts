interface OpenAIBody {
  model: string
  messages: Message[]
  max_tokens: number
}

interface AnthropicBody {
  model: string
  max_tokens: number
  messages: Array<{ role: string; content: string | Array<unknown> }>
  system?: string
}

interface GoogleBody {
  contents: Array<{
    role: string
    parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>
  }>
  systemInstruction?: {
    parts: Array<{ text: string }>
  }
}