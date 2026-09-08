import { useState, useEffect, useMemo } from 'react'
import { Task, TaskStatus, TaskPriority } from '../types'
import { Card, PriorityTag, StatusTag, inputClass } from '../components/ui'
import { listProfiles } from '../lib/api'

const statuses: TaskStatus[] = ['Pending', 'In Progress', 'Done']

export default function TeamTasks({ myId, tasks }: { myId: string; tasks: Task[] }) {
  const [profiles, setProfiles] = useState<{ id: string; name: string; department: string }[]>([])
  useEffect(() => {
    listProfiles().then(setProfiles)
  }, [])

  const [memberFilter, setMemberFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'All'>('All')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'All'>('All')
  const [overdueOnly, setOverdueOnly] = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  // RLS already scopes `tasks` to: my own + my direct reports' + (if Admin) everything.
  // Exclude the manager's own tasks here — those already live on the regular Tasks page.
  const teamTasks = tasks.filter((t) => t.assigneeId && t.assigneeId !== myId)

  const teamMembers = useMemo(() => {
    const ids = Array.from(new Set(teamTasks.map((t) => t.assigneeId!).filter(Boolean)))
    return ids
      .map((id) => profiles.find((p) => p.id === id))
      .filter((p): p is { id: string; name: string; department: string } => !!p)
  }, [teamTasks, profiles])

  const isOverdue = (t: Task) => t.status !== 'Done' && t.dueDate < today

  const filtered = teamTasks.filter((t) => {
    if (memberFilter !== 'all' && t.assigneeId !== memberFilter) return false
    if (statusFilter !== 'All' && t.status !== statusFilter) return false
    if (priorityFilter !== 'All' && t.priority !== priorityFilter) return false
    if (overdueOnly && !isOverdue(t)) return false
    return true
  })

  const total = teamTasks.length
  const done = teamTasks.filter((t) => t.status === 'Done').length
  const overdueCount = teamTasks.filter(isOverdue).length
  const completionRate = total ? Math.round((done / total) * 100) : 0

  return (
    <div className="p-6 max-w-6xl space-y-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">Team Tasks</h2>
        <p className="text-sm text-inkmuted mt-1">Task status and progress across your direct reports.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-inkmuted uppercase tracking-wide">Team members</p>
          <p className="font-display text-2xl font-semibold text-ink mt-1.5">{teamMembers.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-inkmuted uppercase tracking-wide">Total tasks</p>
          <p className="font-display text-2xl font-semibold text-ink mt-1.5">{total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-inkmuted uppercase tracking-wide">Completion rate</p>
          <p className="font-display text-2xl font-semibold text-ink mt-1.5">{completionRate}%</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-inkmuted uppercase tracking-wide">Overdue</p>
          <p className={`font-display text-2xl font-semibold mt-1.5 ${overdueCount > 0 ? 'text-signal-red' : 'text-ink'}`}>
            {overdueCount}
          </p>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
          className={`${inputClass} max-w-xs`}
        >
          <option value="all">All team members</option>
          {teamMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        <div className="flex gap-1.5">
          {(['All', ...statuses] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                statusFilter === s
                  ? 'bg-steel-600 text-white border-steel-600'
                  : 'bg-white text-inkmuted border-line hover:bg-slate-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | 'All')}
          className={inputClass}
        >
          <option value="All">All priorities</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Critical">Critical</option>
        </select>

        <label className="flex items-center gap-2 text-sm text-inkmuted">
          <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} className="rounded border-line" />
          Overdue only
        </label>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-slate-50/60 text-left text-xs text-inkmuted uppercase tracking-wide">
              <th className="px-5 py-3 font-medium">Team member</th>
              <th className="px-5 py-3 font-medium">Task</th>
              <th className="px-5 py-3 font-medium">Due</th>
              <th className="px-5 py-3 font-medium">Priority</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-b border-line last:border-0 hover:bg-slate-50/60">
                <td className="px-5 py-3.5 text-ink font-medium">{t.assignee}</td>
                <td className="px-5 py-3.5">
                  <p className="text-ink">{t.title}</p>
                  <p className="text-xs text-inkmuted mt-0.5">{t.department}</p>
                </td>
                <td className={`px-5 py-3.5 font-mono text-xs ${isOverdue(t) ? 'text-signal-red font-medium' : 'text-inkmuted'}`}>
                  {t.dueDate}
                  {isOverdue(t) && ' · Overdue'}
                </td>
                <td className="px-5 py-3.5">
                  <PriorityTag priority={t.priority} />
                </td>
                <td className="px-5 py-3.5">
                  <StatusTag status={t.status} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-inkmuted text-sm">
                  {teamTasks.length === 0
                    ? 'No tasks assigned to your direct reports yet.'
                    : 'No tasks match your filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
