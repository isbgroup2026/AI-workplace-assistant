import { useState } from 'react'
import { Card, Button, Field, inputClass } from '../components/ui'
import { uploadPolicyDocument } from '../lib/api'

const departments = ['HR', 'Finance', 'IT', 'Admin', 'Plant Operations']
const roles = ['Employee', 'Team Lead', 'Manager', 'Admin']

export default function AdminPolicies() {
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    title: '',
    department: 'HR',
    policyType: '',
    version: '',
    effectiveDate: '',
  })
  const [restrictedRoles, setRestrictedRoles] = useState<string[]>([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ chunks_inserted: number; chunks_total: number } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setResult(null)
    if (!file) {
      setError('Choose a .txt or .md file to upload.')
      return
    }
    if (!form.title || !form.policyType || !form.version || !form.effectiveDate) {
      setError('Fill in all fields.')
      return
    }
    setSubmitting(true)
    try {
      const res = await uploadPolicyDocument({ file, ...form, restrictedToRoles: restrictedRoles })
      setResult({ chunks_inserted: res.chunks_inserted, chunks_total: res.chunks_total })
      setFile(null)
      setForm({ title: '', department: 'HR', policyType: '', version: '', effectiveDate: '' })
      setRestrictedRoles([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl space-y-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">Policy documents</h2>
        <p className="text-sm text-inkmuted mt-1">
          Upload a plain-text or Markdown policy file. It's automatically split into sections and made
          searchable by the AI Assistant.
        </p>
      </div>

      <Card className="p-5">
        <form onSubmit={handleSubmit}>
          {error && (
            <p className="text-sm text-signal-red bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
              {error}
            </p>
          )}
          {result && (
            <p className="text-sm text-signal-green bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-4">
              Uploaded — {result.chunks_inserted} of {result.chunks_total} sections indexed successfully.
            </p>
          )}

          <Field label="Policy file (.txt or .md)">
            <input
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className={inputClass}
            />
          </Field>

          <Field label="Title">
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Leave Policy"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Department">
              <select
                className={inputClass}
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              >
                {departments.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="Policy type">
              <input
                className={inputClass}
                value={form.policyType}
                onChange={(e) => setForm({ ...form, policyType: e.target.value })}
                placeholder="e.g. Leave, WFH, Travel"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Version">
              <input
                className={inputClass}
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                placeholder="e.g. v1.0"
              />
            </Field>
            <Field label="Effective date">
              <input
                type="date"
                className={inputClass}
                value={form.effectiveDate}
                onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Restrict to roles (optional — leave unchecked for everyone)">
            <div className="flex gap-3 flex-wrap">
              {roles.map((r) => (
                <label key={r} className="flex items-center gap-1.5 text-sm text-ink">
                  <input
                    type="checkbox"
                    className="rounded border-line"
                    checked={restrictedRoles.includes(r)}
                    onChange={(e) =>
                      setRestrictedRoles((prev) =>
                        e.target.checked ? [...prev, r] : prev.filter((x) => x !== r),
                      )
                    }
                  />
                  {r}
                </label>
              ))}
            </div>
          </Field>

          <Button type="submit" className="mt-2" disabled={submitting}>
            {submitting ? 'Uploading…' : 'Upload & index'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
