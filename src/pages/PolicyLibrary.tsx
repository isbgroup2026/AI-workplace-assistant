import { useState, useEffect } from 'react'
import { Card } from '../components/ui'
import { listActivePolicies, listPolicySections, PolicySummary } from '../lib/api'

const departments = ['All', 'HR', 'Finance', 'IT', 'Admin', 'Plant Operations']

export default function PolicyLibrary() {
  const [policies, setPolicies] = useState<PolicySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [department, setDepartment] = useState('All')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [sections, setSections] = useState<Record<string, { section_name: string | null; chunk_text: string }[]>>({})

  useEffect(() => {
    // RLS already hides restricted documents from roles that shouldn't see them.
    listActivePolicies()
      .then(setPolicies)
      .finally(() => setLoading(false))
  }, [])

  async function toggle(id: string) {
    if (openId === id) {
      setOpenId(null)
      return
    }
    setOpenId(id)
    if (!sections[id]) {
      const s = await listPolicySections(id)
      setSections((prev) => ({ ...prev, [id]: s }))
    }
  }

  const filtered = policies.filter(
    (p) =>
      (department === 'All' || p.department === department) &&
      (p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.policy_type.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <div className="p-6 max-w-4xl space-y-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">Policy library</h2>
        <p className="text-sm text-inkmuted mt-1">
          Browse company policies by department. You can also just ask the AI Assistant a question.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search policies…"
          className="rounded-lg border border-line px-3 py-2 text-sm bg-white max-w-xs w-full focus-visible:outline-2 focus-visible:outline-offset-2"
        />
        <div className="flex gap-1.5 flex-wrap">
          {departments.map((d) => (
            <button
              key={d}
              onClick={() => setDepartment(d)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                department === d
                  ? 'bg-steel-600 text-white border-steel-600'
                  : 'bg-white text-inkmuted border-line hover:bg-slate-50'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-inkmuted">Loading policies…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-inkmuted">
          {policies.length === 0 ? 'No policies have been published yet.' : 'No policies match your filters.'}
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <button
                onClick={() => toggle(p.id)}
                className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-50/60"
              >
                <div>
                  <p className="font-medium text-ink">{p.title}</p>
                  <p className="text-xs text-inkmuted font-mono mt-1">
                    {p.department} · {p.policy_type} · {p.version} · effective {p.effective_date}
                  </p>
                </div>
                <span className="text-inkmuted text-sm">{openId === p.id ? 'Hide' : 'Read'}</span>
              </button>
              {openId === p.id && (
                <div className="px-5 pb-4 pt-1 border-t border-line space-y-3">
                  {(sections[p.id] ?? []).length === 0 ? (
                    <p className="text-sm text-inkmuted pt-3">Loading sections…</p>
                  ) : (
                    sections[p.id].map((s, i) => (
                      <div key={i} className="pt-3">
                        {s.section_name && <p className="text-sm font-semibold text-ink mb-1">{s.section_name}</p>}
                        <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{s.chunk_text}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
