interface FormBadgeProps {
  result: string
}

export default function FormBadge({ result }: FormBadgeProps) {
  if (result === 'W') return <span className="badge-win">W</span>
  if (result === 'D') return <span className="badge-draw">D</span>
  if (result === 'L') return <span className="badge-loss">L</span>
  return null
}

export function FormStrip({ form }: { form: string }) {
  return (
    <div className="flex gap-0.5">
      {form.split('').map((r, i) => (
        <FormBadge key={i} result={r} />
      ))}
    </div>
  )
}
