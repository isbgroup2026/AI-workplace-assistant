import { useState, useEffect } from 'react'
import { Meeting, MeetingPlatform } from '../types'
import { Card, MeetingStatusTag, Button, Modal, Field, inputClass } from '../components/ui'
import { listProfiles, createMeeting, rescheduleMeeting as apiReschedule, cancelMeeting as apiCancel } from '../lib/api'

const platforms: MeetingPlatform[] = ['Google Meet', 'Zoom', 'Webex']

const platformIcon: Record<MeetingPlatform, string> = {
  'Google Meet': '#1E8A5F',
  Zoom: '#3457A6',
  Webex: '#D98E04',
}

export default function Meetings({
  myId,
  meetings,
  setMeetings,
}: {
  myId: string
  meetings: Meeting[]
  setMeetings: React.Dispatch<React.SetStateAction<Meeting[]>>
}) {
  const [profiles, setProfiles] = useState<{ id: string; name: string; initials: string; role: string; department: string }[]>([])
  useEffect(() => {
    listProfiles().then(setProfiles)
  }, [])

  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleError, setScheduleError] = useState('')
  const [rescheduleTarget, setRescheduleTarget] = useState<Meeting | null>(null)

  const [form, setForm] = useState({
    title: '',
    date: '',
    time: '',
    duration: '30 min',
    platform: 'Google Meet' as MeetingPlatform,
    attendeeIds: [] as string[],
    agenda: '',
  })

  const [rescheduleForm, setRescheduleForm] = useState({ date: '', time: '' })

  const sorted = [...meetings].sort((a, b) => (a.date + a.time > b.date + b.time ? 1 : -1))
  const byDate = sorted.reduce<Record<string, Meeting[]>>((acc, m) => {
    acc[m.date] = acc[m.date] || []
    acc[m.date].push(m)
    return acc
  }, {})

  function toggleAttendee(id: string) {
    setForm((prev) => ({
      ...prev,
      attendeeIds: prev.attendeeIds.includes(id)
        ? prev.attendeeIds.filter((x) => x !== id)
        : [...prev.attendeeIds, id],
    }))
  }

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.date || !form.time) return
    setScheduleError('')
    const durationMinutes = parseInt(form.duration, 10) || 30
    try {
      const created = await createMeeting(
        {
          title: form.title,
          date: form.date,
          time: `${form.time}:00`,
          durationMinutes,
          platform: form.platform,
          attendeeIds: form.attendeeIds,
          agenda: form.agenda || 'No agenda provided.',
        },
        myId,
      )
      setMeetings((prev) => [created, ...prev])
      setScheduleOpen(false)
      setForm({ title: '', date: '', time: '', duration: '30 min', platform: 'Google Meet', attendeeIds: [], agenda: '' })
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Failed to schedule meeting.')
    }
  }

  function cancelMeeting(id: string) {
    setMeetings((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'Cancelled' } : m)))
    apiCancel(id)
  }

  function openReschedule(m: Meeting) {
    setRescheduleTarget(m)
    setRescheduleForm({ date: m.date, time: m.time })
  }

  function submitReschedule(e: React.FormEvent) {
    e.preventDefault()
    if (!rescheduleTarget) return
    setMeetings((prev) =>
      prev.map((m) =>
        m.id === rescheduleTarget.id
          ? { ...m, date: rescheduleForm.date, time: rescheduleForm.time, status: 'Rescheduled' }
          : m,
      ),
    )
    apiReschedule(rescheduleTarget.id, rescheduleForm.date, `${rescheduleForm.time}:00`)
    setRescheduleTarget(null)
  }

  return (
    <div className="p-6 max-w-6xl space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Meetings</h2>
          <p className="text-sm text-inkmuted mt-1">Coordinate shift handovers, reviews, and vendor calls.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setView('list')}
              className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
                view === 'list' ? 'bg-white shadow-card text-ink' : 'text-inkmuted'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
                view === 'calendar' ? 'bg-white shadow-card text-ink' : 'text-inkmuted'
              }`}
            >
              Calendar
            </button>
          </div>
          <Button onClick={() => setScheduleOpen(true)}>+ Schedule meeting</Button>
        </div>
      </div>

      {view === 'list' ? (
        <div className="space-y-6">
          {Object.entries(byDate).map(([date, list]) => (
            <div key={date}>
              <p className="text-xs font-mono uppercase tracking-wide text-inkmuted mb-2">
                {new Date(date + 'T00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <div className="space-y-3">
                {list.map((m) => (
                  <Card key={m.id} className="p-4 flex items-center gap-4">
                    <div
                      className="w-1 self-stretch rounded-full"
                      style={{ backgroundColor: platformIcon[m.platform] }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-ink">{m.title}</p>
                        <MeetingStatusTag status={m.status} />
                      </div>
                      <p className="text-xs text-inkmuted mt-1">{m.agenda}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-inkmuted font-mono">
                        <span>{m.time} · {m.duration}</span>
                        <span>{m.platform}</span>
                        <span>{m.attendees.length} attendees</span>
                      </div>
                    </div>
                    {m.status !== 'Cancelled' && (
                      <div className="flex gap-2 shrink-0">
                        <Button variant="secondary" onClick={() => openReschedule(m)}>
                          Reschedule
                        </Button>
                        <Button variant="danger" onClick={() => cancelMeeting(m.id)}>
                          Cancel
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card className="p-5">
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-mono text-inkmuted mb-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
              const dateStr = `2026-08-${String(day).padStart(2, '0')}`
              const dayMeetings = byDate[dateStr] || []
              return (
                <div
                  key={day}
                  className={`min-h-[76px] rounded-lg border p-1.5 text-left ${
                    dayMeetings.length ? 'border-steel-100 bg-steel-50/50' : 'border-line'
                  }`}
                >
                  <p className="text-xs font-mono text-inkmuted">{day}</p>
                  <div className="space-y-1 mt-1">
                    {dayMeetings.slice(0, 2).map((m) => (
                      <div
                        key={m.id}
                        className="text-[10px] leading-tight px-1 py-0.5 rounded bg-steel-100 text-steel-700 truncate"
                        title={m.title}
                      >
                        {m.title}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <Modal open={scheduleOpen} onClose={() => setScheduleOpen(false)} title="Schedule meeting">
        <form onSubmit={handleSchedule}>
          {scheduleError && (
            <p className="text-sm text-signal-red bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
              {scheduleError}
            </p>
          )}
          <Field label="Title">
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Line 2 maintenance review"
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date">
              <input
                type="date"
                className={inputClass}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </Field>
            <Field label="Time">
              <input
                type="time"
                className={inputClass}
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                required
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Duration">
              <select
                className={inputClass}
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
              >
                <option>15 min</option>
                <option>30 min</option>
                <option>45 min</option>
                <option>60 min</option>
                <option>90 min</option>
              </select>
            </Field>
            <Field label="Platform">
              <select
                className={inputClass}
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value as MeetingPlatform })}
              >
                {platforms.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Attendees">
            <div className="border border-line rounded-lg divide-y divide-line max-h-40 overflow-y-auto">
              {profiles
                .filter((p) => p.id !== myId)
                .map((p) => (
                  <label key={p.id} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={form.attendeeIds.includes(p.id)}
                      onChange={() => toggleAttendee(p.id)}
                      className="rounded border-line"
                    />
                    <span className="text-ink">{p.name}</span>
                    <span className="text-xs text-inkmuted ml-auto">{p.department}</span>
                  </label>
                ))}
              {profiles.length <= 1 && (
                <p className="px-3 py-2 text-xs text-inkmuted">No other employees found yet.</p>
              )}
            </div>
          </Field>
          <Field label="Agenda">
            <textarea
              className={inputClass}
              rows={3}
              value={form.agenda}
              onChange={(e) => setForm({ ...form, agenda: e.target.value })}
              placeholder="What should this meeting cover?"
            />
          </Field>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Schedule</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!rescheduleTarget} onClose={() => setRescheduleTarget(null)} title="Reschedule meeting">
        {rescheduleTarget && (
          <form onSubmit={submitReschedule}>
            <p className="text-sm text-inkmuted mb-4">{rescheduleTarget.title}</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="New date">
                <input
                  type="date"
                  className={inputClass}
                  value={rescheduleForm.date}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, date: e.target.value })}
                  required
                />
              </Field>
              <Field label="New time">
                <input
                  type="time"
                  className={inputClass}
                  value={rescheduleForm.time}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, time: e.target.value })}
                  required
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setRescheduleTarget(null)}>
                Cancel
              </Button>
              <Button type="submit">Confirm reschedule</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
