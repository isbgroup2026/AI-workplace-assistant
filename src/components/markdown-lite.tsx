// Minimal markdown renderer for AI responses — no new dependency.
// Handles exactly what the assistant's model tends to produce:
// **bold**, "- " bullet lists, blank-line paragraph breaks, and a
// standalone "**Heading**" line rendered as a small section heading.

function renderInline(line: string, keyPrefix: string) {
  const parts = line.split(/\*\*(.+?)\*\*/g)
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={`${keyPrefix}-${i}`} className="font-semibold">
        {part}
      </strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    ),
  )
}

export function MarkdownLite({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: JSX.Element[] = []
  let bulletBuffer: string[] = []

  function flushBullets(key: string) {
    if (bulletBuffer.length === 0) return
    blocks.push(
      <ul key={key} className="list-disc pl-5 space-y-1 my-1.5">
        {bulletBuffer.map((item, i) => (
          <li key={i}>{renderInline(item, `${key}-${i}`)}</li>
        ))}
      </ul>,
    )
    bulletBuffer = []
  }

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim()

    if (line === '') {
      flushBullets(`ul-${idx}`)
      return
    }

    const bulletMatch = line.match(/^[-*]\s+(.*)/)
    if (bulletMatch) {
      bulletBuffer.push(bulletMatch[1])
      return
    }
    flushBullets(`ul-${idx}`)

    // A line that's entirely "**Something**" (optionally ending in a colon)
    // reads as a section heading, not a body paragraph.
    const headingMatch = line.match(/^\*\*(.+?)\*\*:?$/)
    if (headingMatch) {
      blocks.push(
        <p key={idx} className="font-semibold mt-2.5 mb-1 first:mt-0">
          {headingMatch[1]}
        </p>,
      )
      return
    }

    blocks.push(
      <p key={idx} className="mb-1">
        {renderInline(line, `p-${idx}`)}
      </p>,
    )
  })
  flushBullets('ul-end')

  return <div>{blocks}</div>
}
