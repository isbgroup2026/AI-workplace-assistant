import { useState, useRef, useEffect } from 'react'
import { AIMessage, CurrentUser } from '../types'
import { suggestedPrompts, initialConversation } from '../data/ai'
import { Avatar } from '../components/ui'
import { listAIMessages, saveAIMessage, askAssistant } from '../lib/api'

const languages: CurrentUser['language'][] = ['English', 'Hindi', 'Telugu']

export default function AIAssistant({ user, myId }: { user: CurrentUser; myId: string }) {
  const [language, setLanguage] = useState<CurrentUser['language']>(user.language)
  const [conversations, setConversations] = useState<Record<string, AIMessage[]>>(initialConversation)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listAIMessages(myId).then((history) => {
      if (history.length) setConversations((prev) => ({ ...prev, [language]: history }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId])

  const messages = conversations[language]

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isTyping])

  async function sendMessage(text: string) {
    if (!text.trim()) return
    const userMsg: AIMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
      timestamp: 'Just now',
    }
    const history = [...messages, userMsg]
    setConversations((prev) => ({ ...prev, [language]: history }))
    saveAIMessage(myId, 'user', text)
    setInput('')
    setIsTyping(true)

    const responseText = await askAssistant(
      history.map((m) => ({ role: m.role, content: m.text })),
      language,
    )
    const aiMsg: AIMessage = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      text: responseText,
      timestamp: 'Just now',
    }
    setConversations((prev) => ({ ...prev, [language]: [...prev[language], aiMsg] }))
    saveAIMessage(myId, 'assistant', responseText)
    setIsTyping(false)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-4xl mx-auto w-full">
      <div className="px-6 pt-5 pb-3 flex items-center justify-between border-b border-line">
        <div>
          <h2 className="font-display font-semibold text-ink">Workplace Assistant</h2>
          <p className="text-xs text-inkmuted mt-0.5">Can view and update your tasks, meetings, notifications, and messages</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-inkmuted">Language</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as CurrentUser['language'])}
            className="text-sm border border-line rounded-lg px-2.5 py-1.5 bg-white focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {languages.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {m.role === 'assistant' ? (
              <div className="w-8 h-8 rounded-lg bg-steel-600 flex items-center justify-center shrink-0 mt-0.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
                  <rect x="4" y="5" width="16" height="12" rx="2.5" />
                  <path d="M9 21h6M12 17v4" strokeLinecap="round" />
                </svg>
              </div>
            ) : (
              <Avatar initials={user.initials} size="sm" />
            )}
            <div className={`max-w-[75%] ${m.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
              <div
                className={`px-4 py-2.5 text-sm leading-relaxed rounded-2xl ${
                  m.role === 'user'
                    ? 'bg-steel-600 text-white rounded-tr-sm'
                    : 'bg-white border border-line text-ink rounded-tl-sm'
                }`}
              >
                {m.text}
              </div>
              <span className="text-[11px] text-inkmuted font-mono mt-1 px-1">{m.timestamp}</span>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-steel-600 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
                <rect x="4" y="5" width="16" height="12" rx="2.5" />
              </svg>
            </div>
            <div className="bg-white border border-line rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" />
            </div>
          </div>
        )}
      </div>

      <div className="px-6 pb-3">
        <div className="flex flex-wrap gap-2 mb-3">
          {suggestedPrompts[language].map((p) => (
            <button
              key={p}
              onClick={() => sendMessage(p)}
              className="text-xs text-steel-600 border border-steel-100 bg-steel-50 hover:bg-steel-100 rounded-full px-3 py-1.5 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          sendMessage(input)
        }}
        className="px-6 pb-6 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about tasks, meetings, approvals…"
          className="flex-1 rounded-full border border-line px-4 py-2.5 text-sm bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus:border-steel-500"
        />
        <button
          type="submit"
          className="w-11 h-11 rounded-full bg-steel-600 hover:bg-steel-700 text-white flex items-center justify-center shrink-0"
          aria-label="Send message"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m5 12 14-7-5 7 5 7-14-7Z" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
    </div>
  )
}
