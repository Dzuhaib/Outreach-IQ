import { Badge } from '@/components/ui/Badge'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/utils'
import type { LeadStatus } from '@/lib/types'

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge className={STATUS_COLORS[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
