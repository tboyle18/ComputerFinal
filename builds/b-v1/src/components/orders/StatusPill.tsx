import { CircleCheck, Clock, Truck } from 'lucide-react'
import { Badge } from '../ui/Feedback'

export function StatusPill({ status }: { status: string }) {
  if (status === 'delivered')
    return (
      <Badge tone="success">
        <CircleCheck /> Delivered
      </Badge>
    )
  if (status === 'shipped')
    return (
      <Badge tone="ink">
        <Truck /> Shipped
      </Badge>
    )
  return (
    <Badge tone="warning">
      <Clock /> Processing
    </Badge>
  )
}

const steps = ['processing', 'shipped', 'delivered'] as const

export function StatusTrack({ status }: { status: string }) {
  const current = Math.max(0, steps.indexOf(status as (typeof steps)[number]))
  return (
    <div className="flex items-center gap-2" aria-label={`Status: ${status}`}>
      {steps.map((s, i) => (
        <div key={s} className="flex flex-1 items-center gap-2">
          <div className="flex flex-col items-start gap-1">
            <span
              className={`size-2.5 rounded-full ${i <= current ? 'bg-ink' : 'bg-surface-3'} ${i === current ? 'ring-4 ring-accent/60' : ''}`}
            />
          </div>
          <span className={`text-[11px] font-medium capitalize ${i <= current ? 'text-ink' : 'text-muted'}`}>{s}</span>
          {i < steps.length - 1 && <span className={`h-px flex-1 ${i < current ? 'bg-ink' : 'bg-line-strong'}`} />}
        </div>
      ))}
    </div>
  )
}
