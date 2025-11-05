import { useAI } from '@/providers/AIProvider'
import { Loader2, Sparkles, Send, AlertCircle, Settings, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useTranslation } from 'react-i18next'
import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { TAIMessage } from '@/types'
import modalManagerService from '@/services/modal-manager.service'
import { useWidgets, AVAILABLE_WIDGETS } from '@/providers/WidgetsProvider'

export default function SidebarAIPromptWidget() {
  const { t } = useTranslation()
  const { chat, isConfigured } = useAI()
  const { pubkey } = useNostr()
  const { toggleWidget, hideWidgetTitles } = useWidgets()
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<TAIMessage[]>([])
  const [isHovered, setIsHovered] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async () => {
    if (!prompt.trim() || isLoading || !isConfigured) return

    const userMessage = prompt.trim()
    setPrompt('')
    setError(null)
    setIsLoading(true)

    try {
      // Build messages array
      const conversationMessages = [
        {
          role: 'system' as const,
          content: 'You are a helpful AI assistant.'
        },
        ...messages,
        {
          role: 'user' as const,
          content: userMessage
        }
      ]

      // Get AI response
      const response = await chat(conversationMessages, pubkey)

      // Update messages
      setMessages([
        ...messages,
        { role: 'user' as const, content: userMessage },
        { role: 'assistant' as const, content: response }
      ])
    } catch (err: any) {
      console.error('AI Prompt Error:', err)
      setError(err.message || t('Failed to get AI response'))
    } finally {
      setIsLoading(false)
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleConfigureAI = () => {
    modalManagerService.open('/settings/ai-tools')
  }

  // Get the widget name from AVAILABLE_WIDGETS
  const widgetName = AVAILABLE_WIDGETS.find(w => w.id === 'ai-prompt')?.name || 'AI Prompt'

  return (
    <div className="flex flex-col h-full max-h-[600px]">
      {/* Header */}
      {!hideWidgetTitles && (
        <div
          className="flex items-center justify-between p-4 border-b group"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <h3 className="font-semibold" style={{ fontSize: '14px' }}>{widgetName}</h3>
          </div>
          <div className="flex items-center gap-1">
            {isHovered && (
              <button
                className="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                onClick={() => toggleWidget('ai-prompt')}
                title={t('Hide widget')}
              >
                <EyeOff className="h-3.5 w-3.5" />
              </button>
            )}
            {!isConfigured && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={handleConfigureAI}
              >
                <Settings className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className={`flex-1 overflow-y-auto px-4 ${hideWidgetTitles ? 'pt-4' : ''} py-4 space-y-3 min-h-0`}>
        {!isConfigured && (
          <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-yellow-600 dark:text-yellow-500 mb-2">
                {t('AI is not configured')}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={handleConfigureAI}
              >
                <Settings className="h-3 w-3 mr-2" />
                {t('Configure AI Settings')}
              </Button>
            </div>
          </div>
        )}

        {messages.length === 0 && isConfigured && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{t('Start a conversation with AI')}</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={cn(
              'p-3 rounded-lg text-sm max-h-[400px] overflow-y-auto',
              message.role === 'user'
                ? 'bg-primary text-primary-foreground ml-8'
                : 'bg-muted mr-8'
            )}
          >
            <div className="whitespace-pre-wrap break-words select-text">
              {message.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg mr-8">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">{t('Thinking...')}</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <div className="text-sm text-destructive">
              {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t bg-card">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('Ask me anything...')}
            className="resize-none min-h-[60px] max-h-[120px]"
            disabled={isLoading || !isConfigured}
          />
          <Button
            onClick={handleSubmit}
            disabled={!prompt.trim() || isLoading || !isConfigured}
            size="icon"
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
