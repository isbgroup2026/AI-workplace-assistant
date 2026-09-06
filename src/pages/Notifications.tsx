import { useState } from 'react'
import { NotificationItem, NotificationType } from '../types'
import { Card, Button, NotificationDot } from '../components/ui'
import { markNotificationRead, markAllNotificationsRead } from '../lib/api'

const typeLabels: Record<NotificationType | 'all', string> = {
  all: 'All',
  task: 'Tasks',
  meeting: 'Meetings',
  approval: 'Approvals',
  system: 'System',
}

export default function Notifications({
  myId,
  notifications,
  setNotifications,
}: {
  myId: string
  notifications: NotificationItem[]
  setNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>
}) {
  const [filter, setFilter] = useState<NotificationType | 'all'>('all')

  const filtered = notifications.filter((n) => filter === 'all' || n.type === filter)
  const unreadCount = notifications.filter((n) => !n.read).length

  function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    markNotificationRead(id)
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    markAllNotificationsRead(myId)
  }

  return (
    <div className="p-6 max-w-3xl space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Notifications</h2>
          <p className="text-sm text-inkmuted mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
          </p>
        </div>
        <Button variant="secondary" onClick={markAllRead}>
          Mark all as read
        </Button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {(Object.keys(typeLabels) as (NotificationType | 'all')[]).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              filter === t
                ? 'bg-steel-600 text-white border-steel-600'
                : 'bg-white text-inkmuted border-line hover:bg-slate-50'
            }`}
          >
            {typeLabels[t]}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((n) => (
          <Card
            key={n.id}
            className={`p-4 flex items-start gap-3 ${!n.read ? 'border-steel-100 bg-steel-50/30' : ''}`}
          >
            <NotificationDot type={n.type} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm ${n.read ? 'text-inkmuted' : 'text-ink font-medium'}`}>{n.title}</p>
                <span className="text-xs text-inkmuted font-mono shrink-0">{n.timestamp}</span>
              </div>
              <p className="text-sm text-inkmuted mt-1">{n.detail}</p>
              {n.type === 'approval' && !n.read && (
                <div className="flex gap-2 mt-3">
                  <Button variant="primary" onClick={() => markRead(n.id)}>
                    Approve
                  </Button>
                  <Button variant="secondary" onClick={() => markRead(n.id)}>
                    Decline
                  </Button>
                </div>
              )}
            </div>
            {!n.read && (
              <button
                onClick={() => markRead(n.id)}
                className="text-xs text-steel-600 hover:underline shrink-0 mt-0.5"
              >
                Mark read
              </button>
            )}
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-inkmuted py-10">No notifications in this category.</p>
        )}
      </div>
    </div>
  )
}
