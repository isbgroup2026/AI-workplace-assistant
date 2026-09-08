import { Page } from '../types'

interface NavItem {
  id: Page
  label: string
  icon: JSX.Element
  badge?: number
}

function IconHome() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 11.5 12 4l8 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconAssistant() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="5" width="16" height="12" rx="2.5" />
      <path d="M9 21h6M12 17v4M9 10.5v1M15 10.5v1" strokeLinecap="round" />
    </svg>
  )
}
function IconChat() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 5h16v11H8l-4 4V5Z" strokeLinejoin="round" />
    </svg>
  )
}
function IconTasks() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4.5" y="4" width="15" height="16" rx="2" />
      <path d="M8.5 10.5 10 12l3.5-4M8.5 16.5h7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconMeetings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="5.5" width="16" height="14" rx="2" />
      <path d="M4 10h16M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  )
}
function IconBell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z" strokeLinejoin="round" />
      <path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  )
}
function IconAnalytics() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 19V9M12 19V5M19 19v-6" strokeLinecap="round" />
      <path d="M3 19h18" strokeLinecap="round" />
    </svg>
  )
}
function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2L10 21h4l.6-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconTeam() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M15.5 14.2c2.6.3 4.7 2.6 4.7 5.8" strokeLinecap="round" />
    </svg>
  )
}

export default function Sidebar({
  active,
  onNavigate,
  unreadNotifications,
  plant,
  showTeamTasks,
}: {
  active: Page
  onNavigate: (p: Page) => void
  unreadNotifications: number
  plant: string
  showTeamTasks: boolean
}) {
  const items: NavItem[] = [
    { id: 'home', label: 'Home', icon: <IconHome /> },
    { id: 'assistant', label: 'AI Assistant', icon: <IconAssistant /> },
    { id: 'chat', label: 'Chat', icon: <IconChat /> },
    { id: 'tasks', label: 'Tasks', icon: <IconTasks /> },
    ...(showTeamTasks ? [{ id: 'teamTasks' as Page, label: 'Team Tasks', icon: <IconTeam /> }] : []),
    { id: 'meetings', label: 'Meetings', icon: <IconMeetings /> },
    { id: 'notifications', label: 'Notifications', icon: <IconBell />, badge: unreadNotifications },
    { id: 'analytics', label: 'Analytics', icon: <IconAnalytics /> },
    { id: 'settings', label: 'Settings', icon: <IconSettings /> },
  ]

  return (
    <aside className="w-[232px] shrink-0 bg-panel text-white flex flex-col h-screen sticky top-0">
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-md bg-steel-500 flex items-center justify-center font-display font-bold text-sm">
          A
        </div>
        <div className="leading-tight">
          <p className="font-display font-semibold text-sm">Innodatatics Inc.</p>
          <p className="text-[11px] text-white/45 tracking-wide">Workplace Assistant</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Main navigation">
        {items.map((item) => {
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors relative ${
                isActive
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-amber-500" />
              )}
              <span className={isActive ? 'text-amber-400' : ''}>{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {!!item.badge && (
                <span className="text-[11px] font-mono font-medium bg-amber-500 text-panel px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-2 text-[11px] text-white/40 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-signal-green" />
          {plant} · Systems nominal
        </div>
      </div>
    </aside>
  )
}
