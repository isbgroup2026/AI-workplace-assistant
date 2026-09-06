import { useState, useEffect } from 'react'
import { Card, SectionHeading } from '../components/ui'
import { BarChart, LineChart, DonutChart } from '../components/charts'
import { getAnalytics, AnalyticsData } from '../lib/api'

export default function Analytics({ myId }: { myId: string }) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAnalytics(myId)
      .then(setData)
      .finally(() => setLoading(false))
  }, [myId])

  if (loading) {
    return <div className="p-6 text-sm text-inkmuted">Loading analytics…</div>
  }

  if (!data) {
    return <div className="p-6 text-sm text-inkmuted">Couldn't load analytics right now.</div>
  }

  const maxDept = Math.max(1, ...data.departmentProductivity.map((d) => d.completion))

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">Analytics</h2>
        <p className="text-sm text-inkmuted mt-1">Live productivity and engagement, based on your workspace data.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {data.kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <p className="text-xs font-medium text-inkmuted uppercase tracking-wide">{k.label}</p>
            <p className="font-display text-3xl font-semibold text-ink mt-2">{k.value}</p>
            <p className={`text-xs mt-1 ${k.delta === 'No data yet' ? 'text-inkmuted' : k.positive ? 'text-signal-green' : 'text-signal-red'}`}>
              {k.delta}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <SectionHeading title="Task completion rate" subtitle="Last 6 months, by due date" />
          {data.taskCompletionTrend.every((d) => d.value === 0) ? (
            <p className="text-sm text-inkmuted py-8 text-center">No task data yet to chart.</p>
          ) : (
            <LineChart data={data.taskCompletionTrend} />
          )}
        </Card>

        <Card className="p-5">
          <SectionHeading title="Your messaging activity" subtitle="Messages you sent, last 7 days" />
          {data.messagingActivity.every((d) => d.value === 0) ? (
            <p className="text-sm text-inkmuted py-8 text-center">No messages sent in the last 7 days.</p>
          ) : (
            <BarChart data={data.messagingActivity} color="#D98E04" />
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <SectionHeading title="Department-wise productivity" subtitle="Task completion by department, all-time" />
          {data.departmentProductivity.length === 0 ? (
            <p className="text-sm text-inkmuted py-8 text-center">No departments with tasks yet.</p>
          ) : (
            <div className="space-y-3.5 mt-2">
              {data.departmentProductivity.map((d) => (
                <div key={d.department}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-ink font-medium">{d.department}</span>
                    <span className="text-inkmuted font-mono text-xs">{d.completion}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-steel-600"
                      style={{ width: `${(d.completion / maxDept) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionHeading title="Meeting volume by platform" subtitle="Share of active meetings, all-time" />
          {data.meetingPlatformSplit.length === 0 ? (
            <p className="text-sm text-inkmuted py-8 text-center">No meetings scheduled yet.</p>
          ) : (
            <div className="mt-4">
              <DonutChart data={data.meetingPlatformSplit} />
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
