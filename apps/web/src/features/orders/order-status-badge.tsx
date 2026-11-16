import { Loader2 } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import type { OrderStatus } from '@/lib/api/types';

const VARIANT: Record<OrderStatus, BadgeVariant> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  CANCELLED: 'danger',
};

const LABEL: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant={VARIANT[status]} className="gap-1">
      {status === 'PENDING' ? (
        <Loader2 className="size-3 animate-spin" aria-hidden />
      ) : null}
      {LABEL[status]}
    </Badge>
  );
}
