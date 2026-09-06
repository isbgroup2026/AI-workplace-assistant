export function BarChart({
  data,
  color = '#3457A6',
}: {
  data: { label: string; value: number }[]
  color?: string
}) {
  const max = Math.max(...data.map((d) => d.value)) * 1.15
  return (
    <div className="flex items-end gap-3 h-40 pt-2">
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-2">
          <div className="w-full flex items-end h-32 rounded-md overflow-hidden bg-slate-50">
            <div
              className="w-full rounded-t-sm transition-all"
              style={{ height: `${(d.value / max) * 100}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-[11px] text-inkmuted font-mono">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

export function LineChart({
  data,
  color = '#3457A6',
}: {
  data: { label: string; value: number }[]
  color?: string
}) {
  const width = 560
  const height = 160
  const padding = 24
  const max = Math.max(...data.map((d) => d.value))
  const min = Math.min(...data.map((d) => d.value))
  const range = max - min || 1

  const points = data.map((d, i) => {
    const x = padding + (i * (width - padding * 2)) / (data.length - 1)
    const y = height - padding - ((d.value - min) / range) * (height - padding * 2)
    return { x, y, ...d }
  })

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${path} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${
    height - padding
  } Z`

  return (
    <svg viewBox={`0 0 ${width} ${height + 24}`} className="w-full h-auto">
      <defs>
        <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#lineFill)" />
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p) => (
        <circle key={p.label} cx={p.x} cy={p.y} r="3.5" fill="white" stroke={color} strokeWidth="2" />
      ))}
      {points.map((p) => (
        <text
          key={p.label + '-t'}
          x={p.x}
          y={height + 18}
          textAnchor="middle"
          fontSize="11"
          fill="#525A72"
          fontFamily="IBM Plex Mono, monospace"
        >
          {p.label}
        </text>
      ))}
    </svg>
  )
}

export function DonutChart({
  data,
}: {
  data: { platform: string; value: number; color: string }[]
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  let cumulative = 0
  const radius = 42
  const circumference = 2 * Math.PI * radius

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 110 110" className="w-28 h-28 shrink-0 -rotate-90">
        <circle cx="55" cy="55" r={radius} fill="none" stroke="#EEF1F5" strokeWidth="14" />
        {data.map((d) => {
          const fraction = d.value / total
          const dash = fraction * circumference
          const gap = circumference - dash
          const offset = -((cumulative / total) * circumference)
          cumulative += d.value
          return (
            <circle
              key={d.platform}
              cx="55"
              cy="55"
              r={radius}
              fill="none"
              stroke={d.color}
              strokeWidth="14"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={offset}
              strokeLinecap="butt"
            />
          )
        })}
      </svg>
      <div className="space-y-2">
        {data.map((d) => (
          <div key={d.platform} className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-ink font-medium">{d.platform}</span>
            <span className="text-inkmuted font-mono text-xs">{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
