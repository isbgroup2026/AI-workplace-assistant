import { useState, useEffect } from 'react'
import { CurrentUser, Task, TaskPriority, TaskStatus } from '../types'
import { Card, PriorityTag, StatusTag, Button, Modal, Field, inputClass } from '../components/ui'
import { listProfiles, createTask, updateTaskStatus } from '../lib/api'

const statuses: TaskStatus[] = ['Pending', 'In Progress', 'Done']
const priorities: TaskPriority[] = ['Low', 'Medium', 'High', 'Critical']

export default function Tasks({
  user,
  myId,
  tasks,
  setTasks,
}: {
  user: CurrentUser
  myId: string
  tasks: Task[]
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
}) {
  const [profiles, setProfiles] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    listProfiles().then(setProfiles)
  }, [])

  const isManager = user.role === 'Manager' || user.role === 'Admin' || user.role === 'Team Lead'
  const [scope, setScope] = useState<'mine' | 'team'>('mine')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'All'>('All')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailTask, setDetailTask] = useState<Task | null>(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    assignee: 'You',
    dueDate: '',
    priority: 'Medium' as TaskPriority,
  })

  const scoped = scope === 'mine' ? tasks.filter((t) => t.assignee === 'You') : tasks
  const filtered = scoped.filter((t) => {
    const matchesStatus = statusFilter === 'All' || t.status === statusFilter
    const matchesSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase())
    return matchesStatus && matchesSearch
  })

  function cycleStatus(task: Task) {
    const idx = statuses.indexOf(task.status)
    const next = statuses[(idx + 1) % statuses.length]
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)))
    updateTaskStatus(task.id, next)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.dueDate) return
    const assigneeId = form.assignee === 'You' ? myId : profiles.find((p) => p.name === form.assignee)?.id ?? null
    const created = await createTask(
      {
        title: form.title,
        description: form.description || 'No additional details provided.',
        assigneeId,
        dueDate: form.dueDate,
        priority: form.priority,
        department: user.department,
      },
      myId,
    )
    if (created) setTasks((prev) => [created, ...prev])
    setCreateOpen(false)
    setForm({ title: '', description: '', assignee: 'You', dueDate: '', priority: 'Medium' })
  }

  const counts = {
    Pending: scoped.filter((t) => t.status === 'Pending').length,
    'In Progress': scoped.filter((t) => t.status === 'In Progress').length,
    Done: scoped.filter((t) => t.status === 'Done').length,
  }

  return (
    <div className="p-6 max-w-6xl space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Tasks</h2>
          <p className="text-sm text-inkmuted mt-1">Track and manage work across your line and team.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ Create task</Button>
      </div>

      {isManager && (
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setScope('mine')}
            className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
              scope === 'mine' ? 'bg-white shadow-card text-ink' : 'text-inkmuted'
            }`}
          >
            My tasks
          </button>
          <button
            onClick={() => setScope('team')}
            className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
              scope === 'team' ? 'bg-white shadow-card text-ink' : 'text-inkmuted'
            }`}
          >
            Team tasks
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {statuses.map((s) => (
          <Card key={s} className="p-4">
            <p className="text-xs font-medium text-inkmuted uppercase tracking-wide">{s}</p>
            <p className="font-display text-2xl font-semibold text-ink mt-1.5">{counts[s]}</p>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks by title or ID…"
          className={`${inputClass} max-w-xs`}
        />
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
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-slate-50/60 text-left text-xs text-inkmuted uppercase tracking-wide">
              <th className="px-5 py-3 font-medium">Task</th>
              {scope === 'team' && <th className="px-5 py-3 font-medium">Assignee</th>}
              <th className="px-5 py-3 font-medium">Due</th>
              <th className="px-5 py-3 font-medium">Priority</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr
                key={t.id}
                className="border-b border-line last:border-0 hover:bg-slate-50/60 cursor-pointer"
                onClick={() => setDetailTask(t)}
              >
                <td className="px-5 py-3.5">
                  <p className="font-medium text-ink">{t.title}</p>
                  <p className="text-xs text-inkmuted font-mono mt-0.5">{t.id} · {t.department}</p>
                </td>
                {scope === 'team' && (
                  <td className="px-5 py-3.5 text-inkmuted">{t.assignee}</td>
                )}
                <td className="px-5 py-3.5 text-inkmuted font-mono text-xs">{t.dueDate}</td>
                <td className="px-5 py-3.5">
                  <PriorityTag priority={t.priority} />
                </td>
                <td className="px-5 py-3.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      cycleStatus(t)
                    }}
                    title="Click to advance status"
                  >
                    <StatusTag status={t.status} />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-inkmuted text-sm">
                  No tasks match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create task">
        <form onSubmit={handleCreate}>
          <Field label="Title">
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Inspect Line 2 hydraulic press"
              required
            />
          </Field>
          <Field label="Description">
            <textarea
              className={inputClass}
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Add any relevant detail…"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Assignee">
              <select
                className={inputClass}
                value={form.assignee}
                onChange={(e) => setForm({ ...form, assignee: e.target.value })}
              >
                <option>You</option>
                <option>Ravi Shah</option>
                <option>Priya Nair</option>
                <option>Arjun Mehta</option>
                <option>Sana Iqbal</option>
              </select>
            </Field>
            <Field label="Due date">
              <input
                type="date"
                className={inputClass}
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                required
              />
            </Field>
          </div>
          <Field label="Priority">
            <div className="flex gap-2">
              {priorities.map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setForm({ ...form, priority: p })}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    form.priority === p ? 'bg-steel-600 text-white border-steel-600' : 'bg-white text-inkmuted border-line'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </Field>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create task</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!detailTask} onClose={() => setDetailTask(null)} title={detailTask?.id ?? ''}>
        {detailTask && (
          <div className="space-y-4">
            <div>
              <h4 className="font-display font-semibold text-ink">{detailTask.title}</h4>
              <p className="text-sm text-inkmuted mt-1.5">{detailTask.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <PriorityTag priority={detailTask.priority} />
              <StatusTag status={detailTask.status} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-line">
              <div>
                <p className="text-xs text-inkmuted uppercase tracking-wide">Assignee</p>
                <p className="text-ink mt-0.5">{detailTask.assignee}</p>
              </div>
              <div>
                <p className="text-xs text-inkmuted uppercase tracking-wide">Due date</p>
                <p className="text-ink mt-0.5 font-mono">{detailTask.dueDate}</p>
              </div>
              <div>
                <p className="text-xs text-inkmuted uppercase tracking-wide">Department</p>
                <p className="text-ink mt-0.5">{detailTask.department}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
