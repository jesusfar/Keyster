import type { Message } from '../lib/api'
import './ChatBubble.css'

export type MessageRole = 'user' | 'assistant' | 'system' | 'error'

interface ChatBubbleProps {
  role: MessageRole
  content: Message['content']
  modelName?: string
}

export function ChatBubble({ role, content, modelName }: ChatBubbleProps) {
  const isUser = role === 'user'

  return (
    <div className={`chat-bubble-container ${isUser ? 'user-container' : 'assistant-container'}`}>
      {!isUser && (
        <div className="avatar assistant-avatar">
          {role === 'error' ? '!' : 'AI'}
        </div>
      )}
      
      <div className={`chat-bubble ${role}-bubble`}>
        {!isUser && modelName && role !== 'error' && (
          <div className="message-model-name">{modelName}</div>
        )}
        <div className="message-content">
          {typeof content === 'string' ? (
            content
          ) : (
            <div className="multimodal-content">
              {content.map((part, i) => {
                if (part.type === 'text') {
                  return <div key={i}>{part.text}</div>
                } else if (part.type === 'image_url') {
                  return <img key={i} src={part.image_url.url} alt="attached" className="chat-bubble-image" />
                }
                return null
              })}
            </div>
          )}
        </div>
      </div>
      
      {isUser && (
        <div className="avatar user-avatar">
          U
        </div>
      )}
    </div>
  )
}
