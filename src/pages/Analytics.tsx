import {
  kpis,
  taskCompletionTrend,
  departmentProductivity,
  messagingActivity,
  meetingPlatformSplit,
} from '../data/analytics'
import { Card, SectionHeading } from '../components/ui'
import { BarChart, LineChart, DonutChart } from '../components/charts'

export default function Analytics() {
  const maxDept = Math.max(...departmentProductivity.map((d) => d.completion))

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">Analytics</h2>
        <p className="text-sm text-inkmuted mt-1">Plant-wide productivity and engagement, last 30 days.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <p className="text-xs font-medium text-inkmuted uppercase tracking-wide">{k.label}</p>
            <p className="font-display text-3xl font-semibold text-ink mt-2">{k.value}</p>
            <p className={`text-xs mt-1 ${k.positive ? 'text-signal-green' : 'text-signal-red'}`}>{k.delta}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <SectionHeading title="Task completion rate" subtitle="Monthly trend, plant-wide" />
          <LineChart data={taskCompletionTrend} />
        </Card>

        <Card className="p-5">
          <SectionHeading title="Messaging activity" subtitle="Messages sent this week" />
          <BarChart data={messagingActivity} color="#D98E04" />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <SectionHeading title="Department-wise productivity" subtitle="Task completion by department" />
          <div className="space-y-3.5 mt-2">
            {departmentProductivity.map((d) => (
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
        </Card>

        <Card className="p-5">
          <SectionHeading title="Meeting volume by platform" subtitle="Share of meetings held this month" />
          <div className="mt-4">
            <DonutChart data={meetingPlatformSplit} />
          </div>
        </Card>
      </div>
    </div>
  )
}
