import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: { value: number; label: string }
  accent?: boolean
}

export function StatsCard({ title, value, subtitle, icon: Icon, accent }: StatsCardProps) {
  return (
    <div
      className={cn(
        'bg-surface border border-border rounded-xl p-5 flex flex-col gap-3',
        accent && 'border-accent/30 bg-accent/5',
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-text-3 uppercase tracking-wide">{title}</p>
        <div className={cn('p-2 rounded-lg', accent ? 'bg-accent/20' : 'bg-surface-2')}>
          <Icon className={cn('w-3.5 h-3.5', accent ? 'text-accent' : 'text-text-2')} />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-text-1 tracking-tight">{value}</p>
        {subtitle && <p className="text-xs text-text-3 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}
