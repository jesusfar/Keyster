import { useState, useRef, useEffect } from 'react'
import type { ChatSession } from '../App'
import { ChatBubble } from './ChatBubble'
import { sendChatMessage } from '../lib/api'
import type { Message } from '../lib/api'
import { useToast } from './ToastContext'
import { getErrorMessage } from '../lib/utils/errorHandlers'
import './ChatWindow.css'

interface ChatWindowProps {
  session: ChatSession | null
}

export function ChatWindow({ session }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [attachedImages, setAttachedImages] = useState<string[]>([])
  const [agentMode, setAgentMode] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const { showToast } = useToast()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Clear chat if session provider changes
  useEffect(() => {
    setMessages([])
  }, [session?.provider])

  const handleSend = async () => {
    if ((!input.trim() && attachedImages.length === 0) || !session || isLoading) return

    const userText = input.trim()
    setInput('')
    
    let messageContent: Message['content'] = userText
    
    if (attachedImages.length > 0) {
      const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = attachedImages.map(img => ({ type: 'image_url', image_url: { url: img } }))
      if (userText) {
        parts.push({ type: 'text', text: userText })
      }
      messageContent = parts
    }
    
    setAttachedImages([])
    
    const newMessages: Message[] = [
      ...messages,
      { role: 'user', content: messageContent }
    ]
    
    setMessages(newMessages)
    setIsLoading(true)

    try {
      const response = await sendChatMessage(
        session.provider,
        session.apiKey,
        session.model,
        newMessages,
        agentMode
      )

      setMessages([
        ...newMessages,
        { role: 'assistant', content: response }
      ])
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err)
      showToast(errorMessage, 'error')
      setMessages([
        ...newMessages,
        { role: 'error', content: errorMessage }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          if (e.target?.result) {
            setAttachedImages(prev => [...prev, e.target!.result as string])
          }
        }
        reader.readAsDataURL(file)
      } else {
        const text = await file.text()
        setInput(prev => prev + `\n\n--- Content of ${file.name} ---\n${text}\n--- End of ${file.name} ---\n\n`)
      }
    }
    
    e.target.value = ''
  }

  return (
    <div className="chat-window">
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔑</div>
            {!session ? (
              <>
                <h3>Welcome to Keyster</h3>
                <p>Enter your API key in the sidebar to connect to an AI provider and start chatting.</p>
              </>
            ) : (
              <>
                <h3>Ready to Chat</h3>
                <p>You're connected! Start a conversation below.</p>
                <div className="model-badge">{session.model}</div>
              </>
            )}
          </div>
        ) : (
          messages.map((msg, idx) => (
            <ChatBubble 
              key={idx} 
              role={msg.role as "user" | "assistant" | "system" | "error"} 
              content={msg.content} 
              modelName={msg.role === 'assistant' ? session?.model : undefined} 
            />
          ))
        )}
        {isLoading && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span className="typing-label">{session?.model} is thinking{agentMode ? ' (Agent Mode Active)' : ''}...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="chat-input-area">
        {attachedImages.length > 0 && (
          <div className="attached-images-preview">
            {attachedImages.map((img, i) => (
              <div key={i} className="image-preview-item">
                <img src={img} alt={`Preview ${i + 1}`} />
                <button
                  type="button"
                  className="image-remove-btn"
                  onClick={() => setAttachedImages(prev => prev.filter((_, idx) => idx !== i))}
                  aria-label="Remove image"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="chat-input-wrapper">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            hidden 
            multiple 
            accept="image/*,.txt,.md,.json,.csv" 
          />
          <button
            type="button"
            className="attach-btn"
            title="Attach file or image"
            aria-label="Attach file or image"
            onClick={() => fileInputRef.current?.click()}
            disabled={!session || isLoading}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          
          <button
            type="button"
            className={`agent-toggle-btn ${agentMode ? 'active' : ''}`}
            title={agentMode ? "Agent Mode ON: Can execute commands and read files" : "Agent Mode OFF"}
            onClick={() => setAgentMode(!agentMode)}
            disabled={!session || isLoading || !window.electronAPI}
            style={{
              background: agentMode ? 'var(--accent-glow)' : 'transparent',
              color: agentMode ? 'var(--accent-color)' : 'var(--text-muted)',
              border: 'none',
              cursor: (!session || isLoading || !window.electronAPI) ? 'not-allowed' : 'pointer',
              padding: '0.5rem',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20" />
              <path d="m4.93 10.93 14.14 14.14" />
              <path d="m2 22 20-20" />
              <path d="m10.93 4.93 14.14 14.14" />
            </svg>
          </button>
          
          <textarea 
            className="chat-textarea" 
            placeholder={session ? "Message..." : "Connect to start"}
            disabled={!session || isLoading}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          
          <button
            type="button"
            className="send-btn"
            title="Send message"
            aria-label="Send message"
            disabled={!session || (!input.trim() && attachedImages.length === 0) || isLoading}
            onClick={handleSend}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <div className="chat-footer">
          Responses are generated directly via API · Keys are stored locally
        </div>
      </div>
    </div>
  )
}
