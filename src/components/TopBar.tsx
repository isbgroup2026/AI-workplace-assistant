import { useState } from 'react'
import { CurrentUser, Page } from '../types'
import { Avatar } from './ui'

const pageTitles: Record<Page, string> = {
  home: 'Home',
  assistant: 'AI Assistant',
  chat: 'Chat',
  tasks: 'Tasks',
  teamTasks: 'Team Tasks',
  meetings: 'Meetings',
  notifications: 'Notifications',
  analytics: 'Analytics',
  settings: 'Profile & Settings',
}

export default function TopBar({
  page,
  user,
  unreadNotifications,
  onNavigate,
}: {
  page: Page
  user: CurrentUser
  unreadNotifications: number
  onNavigate: (p: Page) => void
}) {
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="h-16 border-b border-line bg-white/95 backdrop-blur sticky top-0 z-30 flex items-center gap-4 px-6">
      <h1 className="font-display font-semibold text-ink text-base whitespace-nowrap">
        {pageTitles[page]}
      </h1>

      <div className="flex-1 max-w-md relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          width="16"
          height="16"
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
          placeholder="Search tasks, people, meetings…"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-line bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus:border-steel-500"
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={() => onNavigate('notifications')}
          aria-label="Notifications"
          className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 text-inkmuted"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z" strokeLinejoin="round" />
            <path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" />
          </svg>
          {unreadNotifications > 0 && (
            <span className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-amber-500" />
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-slate-100"
          >
            <Avatar initials={user.initials} size="sm" />
            <span className="text-sm font-medium text-ink hidden sm:block">{user.name}</span>
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-48 bg-white border border-line rounded-lg shadow-panel py-1 z-40"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                onClick={() => {
                  onNavigate('settings')
                  setMenuOpen(false)
                }}
                className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-slate-50"
              >
                Profile &amp; settings
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
