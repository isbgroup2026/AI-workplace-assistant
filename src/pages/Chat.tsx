import { useState, useRef, useEffect } from 'react'
import { Contact, ChatMessage } from '../types'
import { Avatar } from '../components/ui'
import { listConversations, listMessages, sendMessage as apiSendMessage, subscribeToMessages } from '../lib/api'

export default function Chat({ myId }: { myId: string }) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [conversations, setConversations] = useState<Record<string, ChatMessage[]>>({})
  const [activeId, setActiveId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listConversations(myId).then((list) => {
      setContacts(list)
      if (list.length) setActiveId(list[0].id)
    })
  }, [myId])

  useEffect(() => {
    if (!activeId) return
    listMessages(activeId).then((msgs) => setConversations((prev) => ({ ...prev, [activeId]: msgs })))
    const unsubscribe = subscribeToMessages(activeId, (msg) => {
      setConversations((prev) => ({ ...prev, [activeId]: [...(prev[activeId] || []), msg] }))
    })
    return unsubscribe
  }, [activeId])

  const active = contacts.find((c) => c.id === activeId)
  const messages = conversations[activeId] || []

  const filtered = contacts.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, activeId])

  function selectContact(id: string) {
    setActiveId(id)
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)))
  }

  function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.trim() || !activeId) return
    apiSendMessage(activeId, myId, draft)
    setContacts((prev) =>
      prev.map((c) => (c.id === activeId ? { ...c, lastMessage: draft, lastTimestamp: 'Just now' } : c)),
    )
    setDraft('')
  }

  function senderLabel(senderId: string) {
    if (senderId === myId) return 'ME'
    const c = contacts.find((x) => x.id === senderId)
    return c ? c.initials : '??'
  }

  function senderName(senderId: string) {
    if (senderId === myId) return 'You'
    const c = contacts.find((x) => x.id === senderId)
    return c ? c.name : 'Unknown'
  }

  if (!active) {
    return <div className="p-6 text-sm text-inkmuted">No conversations yet.</div>
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Contact list */}
      <div className="w-80 shrink-0 border-r border-line flex flex-col bg-white">
        <div className="p-4 border-b border-line">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people or groups…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-line bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => selectContact(c.id)}
              className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-line/60 hover:bg-slate-50 transition-colors ${
                activeId === c.id ? 'bg-steel-50' : ''
              }`}
            >
              <Avatar initials={c.initials} online={c.isGroup ? undefined : c.online} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink truncate">{c.name}</p>
                  <span className="text-[11px] text-inkmuted font-mono shrink-0">{c.lastTimestamp}</span>
                </div>
                <p className="text-xs text-inkmuted truncate mt-0.5">
                  {c.isGroup ? `${c.members} members · ` : ''}
                  {c.lastMessage}
                </p>
              </div>
              {c.unread > 0 && (
                <span className="text-[11px] font-mono bg-amber-500 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0">
                  {c.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation */}
      <div className="flex-1 flex flex-col bg-canvas">
        <div className="h-16 border-b border-line bg-white flex items-center gap-3 px-5">
          <Avatar initials={active.initials} online={active.isGroup ? undefined : active.online} />
          <div>
            <p className="text-sm font-semibold text-ink">{active.name}</p>
            <p className="text-xs text-inkmuted">
              {active.isGroup ? `${active.members} members` : active.online ? 'Online' : active.role}
            </p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {messages.map((m) => {
            const isMe = m.senderId === myId
            return (
              <div key={m.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                <Avatar initials={senderLabel(m.senderId)} size="sm" />
                <div className={`max-w-[65%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {active.isGroup && !isMe && (
                    <span className="text-xs text-inkmuted mb-1">{senderName(m.senderId)}</span>
                  )}
                  <div
                    className={`px-4 py-2.5 text-sm leading-relaxed rounded-2xl ${
                      isMe ? 'bg-steel-600 text-white rounded-tr-sm' : 'bg-white border border-line rounded-tl-sm'
                    }`}
                  >
                    {m.text}
                    {m.attachment && (
                      <div
                        className={`mt-2 flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5 ${
                          isMe ? 'bg-white/15' : 'bg-slate-50 border border-line'
                        }`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M8 12v6a3 3 0 0 0 6 0V8a2 2 0 1 0-4 0v9" strokeLinecap="round" />
                        </svg>
                        {m.attachment}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1 px-1">
                    <span className="text-[11px] text-inkmuted font-mono">{m.timestamp}</span>
                    {isMe && (
                      <span className="text-[11px] text-inkmuted">
                        {m.status === 'read' ? '· Read' : m.status === 'delivered' ? '· Delivered' : '· Sent'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <form onSubmit={sendMessage} className="border-t border-line bg-white px-5 py-4 flex items-center gap-2">
          <button
            type="button"
            aria-label="Add attachment"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-inkmuted hover:bg-slate-100 shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path
                d="M8 12v6a3 3 0 0 0 6 0V8a2 2 0 1 0-4 0v9a1 1 0 0 0 2 0V9"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message ${active.name}…`}
            className="flex-1 rounded-full border border-line px-4 py-2.5 text-sm bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2"
          />
          <button
            type="submit"
            className="w-10 h-10 rounded-full bg-steel-600 hover:bg-steel-700 text-white flex items-center justify-center shrink-0"
            aria-label="Send message"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m5 12 14-7-5 7 5 7-14-7Z" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
