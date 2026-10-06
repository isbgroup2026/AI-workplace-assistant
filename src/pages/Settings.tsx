import { useState } from 'react'
import { CurrentUser } from '../types'
import { Card, SectionHeading, Avatar, Button, Field, inputClass } from '../components/ui'
import { updateMyLanguage } from '../lib/api'

export default function Settings({
  user,
  setUser,
  onLogout,
}: {
  user: CurrentUser
  setUser: React.Dispatch<React.SetStateAction<CurrentUser>>
  onLogout: () => void
}) {
  const [notifPrefs, setNotifPrefs] = useState({
    taskReminders: true,
    meetingAlerts: true,
    approvalRequests: true,
    weeklyDigest: false,
  })
  const [saved, setSaved] = useState(false)

  function toggle(key: keyof typeof notifPrefs) {
    setNotifPrefs((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    updateMyLanguage(user.language)
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">Profile &amp; settings</h2>
        <p className="text-sm text-inkmuted mt-1">Manage your identity, language, and notification preferences.</p>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <Avatar initials={user.initials} size="lg" />
          <div>
            <h3 className="font-display font-semibold text-ink">{user.name}</h3>
            <p className="text-sm text-inkmuted">
              {user.role} · {user.department}
            </p>
            <p className="text-xs text-inkmuted font-mono mt-0.5">{user.employeeId} · {user.plant}</p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <SectionHeading title="Employee details" />
        <form onSubmit={save} className="grid grid-cols-2 gap-4">
          <Field label="Full name">
            <input className={inputClass} value={user.name} readOnly />
          </Field>
          <Field label="Employee ID">
            <input className={inputClass} value={user.employeeId} readOnly />
          </Field>
          <Field label="Department">
            <input className={inputClass} value={user.department} readOnly />
          </Field>
          <Field label="Role">
            <input className={inputClass} value={user.role} readOnly />
          </Field>
          <Field label="Email">
            <input className={inputClass} value={user.email} readOnly />
          </Field>
          <Field label="Language preference">
            <select
              className={inputClass}
              value={user.language}
              onChange={(e) => setUser({ ...user, language: e.target.value as CurrentUser['language'] })}
            >
              <option>English</option>
              <option>Hindi</option>
              <option>Telugu</option>
            </select>
          </Field>
          <div className="col-span-2 flex items-center gap-3 mt-1">
            <Button type="submit">Save changes</Button>
            {saved && <span className="text-sm text-signal-green">Saved.</span>}
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <SectionHeading title="Notification preferences" />
        <div className="space-y-3">
          {[
            { key: 'taskReminders' as const, label: 'Task reminders', hint: 'Due dates and reassignments' },
            { key: 'meetingAlerts' as const, label: 'Meeting alerts', hint: 'Upcoming and rescheduled meetings' },
            { key: 'approvalRequests' as const, label: 'Approval requests', hint: 'Purchase orders, leave, and sign-offs' },
            { key: 'weeklyDigest' as const, label: 'Weekly digest email', hint: 'Summary sent every Monday' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-2 border-b border-line last:border-0">
              <div>
                <p className="text-sm font-medium text-ink">{item.label}</p>
                <p className="text-xs text-inkmuted mt-0.5">{item.hint}</p>
              </div>
              <button
                role="switch"
                aria-checked={notifPrefs[item.key]}
                onClick={() => toggle(item.key)}
                className={`w-10 h-6 rounded-full relative transition-colors ${
                  notifPrefs[item.key] ? 'bg-steel-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    notifPrefs[item.key] ? 'translate-x-[18px]' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-ink">Sign out</h3>
          <p className="text-sm text-inkmuted mt-0.5">End your session on this device.</p>
        </div>
        <Button variant="danger" onClick={onLogout}>
          Log out
        </Button>
      </Card>
    </div>
  )
}
