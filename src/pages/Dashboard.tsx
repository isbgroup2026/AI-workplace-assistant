import { CurrentUser, Page, Task, Meeting, NotificationItem } from '../types'
import { Card, PriorityTag, StatusTag, Avatar, NotificationDot, Button } from '../components/ui'

export default function Dashboard({
  user,
  tasks,
  meetings,
  notifications,
  onNavigate,
}: {
  user: CurrentUser
  tasks: Task[]
  meetings: Meeting[]
  notifications: NotificationItem[]
  onNavigate: (p: Page) => void
}) {
  const myPending = tasks.filter((t) => t.status !== 'Done' && t.assignee === 'You')
  const upcomingMeetings = meetings.filter((m) => m.status !== 'Cancelled').slice(0, 3)
  const unread = notifications.filter((n) => !n.read)
  const pendingApprovals = notifications.filter((n) => n.type === 'approval' && !n.read)

  const kpis = [
    { label: 'My Tasks', value: myPending.length, hint: 'open items', page: 'tasks' as Page },
    { label: 'Upcoming Meetings', value: upcomingMeetings.length, hint: 'this week', page: 'meetings' as Page },
    { label: 'Notifications', value: unread.length, hint: 'unread', page: 'notifications' as Page },
    { label: 'Pending Approvals', value: pendingApprovals.length, hint: 'awaiting you', page: 'notifications' as Page },
  ]

  const recentActivity = [
    { text: 'Ravi Shah completed "Calibrate torque wrenches - Bay 4"', time: '35 min ago' },
    { text: 'You approved PO #4408 for packaging materials', time: '2 hr ago' },
    { text: 'Arjun Mehta shared the RCA draft for Batch 217', time: '3 hr ago' },
    { text: 'Meeting "CNC changeover training" was cancelled', time: 'Yesterday' },
  ]

  const quickActions: { label: string; page: Page }[] = [
    { label: 'Create task', page: 'tasks' },
    { label: 'Schedule meeting', page: 'meetings' },
    { label: 'Ask AI Assistant', page: 'assistant' },
    { label: 'Open messages', page: 'chat' },
  ]

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">
          Good morning, {user.name.split(' ')[0]}.
        </h2>
        <p className="text-sm text-inkmuted mt-1">
          Here's what's moving across {user.plant} today, {new Date('2026-08-24').toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <button key={k.label} onClick={() => onNavigate(k.page)} className="text-left">
            <Card className="p-4 hover:border-steel-300 transition-colors h-full">
              <p className="text-xs font-medium text-inkmuted uppercase tracking-wide">{k.label}</p>
              <p className="font-display text-3xl font-semibold text-ink mt-2">{k.value}</p>
              <p className="text-xs text-inkmuted mt-1">{k.hint}</p>
            </Card>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-ink">Recent activity</h3>
          </div>
          <ul className="space-y-4">
            {recentActivity.map((item, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-steel-500 mt-1.5 shrink-0" />
                <div>
                  <p className="text-ink">{item.text}</p>
                  <p className="text-xs text-inkmuted font-mono mt-0.5">{item.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h3 className="font-display font-semibold text-ink mb-4">Quick actions</h3>
          <div className="space-y-2">
            {quickActions.map((qa) => (
              <Button
                key={qa.label}
                variant="secondary"
                onClick={() => onNavigate(qa.page)}
                className="w-full justify-between"
              >
                {qa.label}
                <span aria-hidden>→</span>
              </Button>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-ink">My tasks</h3>
            <button onClick={() => onNavigate('tasks')} className="text-sm text-steel-600 hover:underline">
              View all
            </button>
          </div>
          <ul className="divide-y divide-line">
            {myPending.slice(0, 4).map((t) => (
              <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">{t.title}</p>
                  <p className="text-xs text-inkmuted font-mono mt-0.5">Due {t.dueDate}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <PriorityTag priority={t.priority} />
                  <StatusTag status={t.status} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-ink">Upcoming meetings</h3>
            <button onClick={() => onNavigate('meetings')} className="text-sm text-steel-600 hover:underline">
              View all
            </button>
          </div>
          <ul className="divide-y divide-line">
            {upcomingMeetings.map((m) => (
              <li key={m.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">{m.title}</p>
                  <p className="text-xs text-inkmuted font-mono mt-0.5">
                    {m.date} · {m.time} · {m.platform}
                  </p>
                </div>
                <div className="flex -space-x-2 shrink-0">
                  {m.attendees.slice(0, 3).map((a) => (
                    <Avatar key={a} initials={a === 'You' ? 'ME' : a.split(' ').map((n) => n[0]).join('')} size="sm" />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-ink">Latest notifications</h3>
          <button onClick={() => onNavigate('notifications')} className="text-sm text-steel-600 hover:underline">
            View all
          </button>
        </div>
        <ul className="divide-y divide-line">
          {notifications.slice(0, 3).map((n) => (
            <li key={n.id} className="py-3 flex gap-3">
              <NotificationDot type={n.type} />
              <div className="flex-1">
                <p className={`text-sm ${n.read ? 'text-inkmuted' : 'text-ink font-medium'}`}>{n.title}</p>
                <p className="text-xs text-inkmuted mt-0.5">{n.detail}</p>
              </div>
              <span className="text-xs text-inkmuted font-mono shrink-0">{n.timestamp}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
