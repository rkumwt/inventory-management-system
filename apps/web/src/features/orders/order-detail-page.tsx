'use client';

import { ArrowLeft, Ban } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ErrorState } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/features/auth/auth-context';
import { useWarehouseLookup } from '@/features/warehouses/api';
import { errorMessage } from '@/lib/api/errors';
import type { OrderStatus } from '@/lib/api/types';
import { formatDateTime, formatMoney } from '@/lib/format';
import { useCancelOrder, useOrder } from './api';
import { OrderStatusBadge } from './order-status-badge';

const STATUS_NOTE: Record<OrderStatus, string> = {
  PENDING: 'Waiting for stock to be reserved. This page updates by itself.',
  CONFIRMED: 'Stock is reserved for every line of this order.',
  CANCELLED: 'This order was cancelled; any reserved stock was released.',
};

export function OrderDetailPage({ id }: { id: string }) {
  const { can } = useAuth();
  const order = useOrder(id);
  const warehouses = useWarehouseLookup();
  const cancelOrder = useCancelOrder();
  const [confirming, setConfirming] = useState(false);

  const back = (
    <Button variant="outline" asChild>
      <Link href="/orders">
        <ArrowLeft aria-hidden /> All orders
      </Link>
    </Button>
  );

  if (order.isError) {
    return (
      <>
        <PageHeader title="Order" actions={back} />
        <Card>
          <ErrorState error={order.error} onRetry={() => order.refetch()} />
        </Card>
      </>
    );
  }
  if (order.isPending) {
    return (
      <>
        <PageHeader title="Order" actions={back} />
        <Skeleton className="h-64 w-full" />
      </>
    );
  }

  const data = order.data;
  const warehouse = warehouses.byId.get(data.warehouseId);
  const cancellable = data.status !== 'CANCELLED' && can('orders:cancel');

  return (
    <>
      <PageHeader
        title={data.orderNumber}
        description={`Placed ${formatDateTime(data.createdAt)}`}
        actions={
          <>
            {back}
            {cancellable ? (
              <Button variant="destructive" onClick={() => setConfirming(true)}>
                <Ban aria-hidden /> Cancel order
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Line total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
                <TableRow key={item.productId}>
                  <TableCell>
                    <span className="font-medium">{item.productName}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {item.sku}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(item.unitPrice)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.quantity}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(item.lineTotal)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3} className="text-right font-medium">
                  Total
                </TableCell>
                <TableCell className="text-right text-base font-semibold tabular-nums">
                  {formatMoney(data.totalAmount)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div aria-live="polite" className="grid gap-2">
              <div>
                <OrderStatusBadge status={data.status} />
              </div>
              <p className="text-muted-foreground">
                {STATUS_NOTE[data.status]}
              </p>
            </div>
            {data.cancellationReason ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Reason
                </p>
                <p>{data.cancellationReason}</p>
              </div>
            ) : null}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Fulfilled from
              </p>
              <p>{warehouse ? `${warehouse.code} · ${warehouse.name}` : '…'}</p>
            </div>
            {data.note ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Note
                </p>
                <p>{data.note}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Cancel ${data.orderNumber}?`}
        description="The reserved stock goes back to available. A cancelled order cannot be reopened."
        confirmLabel="Cancel order"
        pending={cancelOrder.isPending}
        onConfirm={() =>
          cancelOrder.mutate(
            { id: data.id },
            {
              onSuccess: () => {
                toast.success(`Order ${data.orderNumber} cancelled`);
                setConfirming(false);
              },
              onError: (error) => {
                toast.error(errorMessage(error));
                setConfirming(false);
              },
            },
          )
        }
      />
    </>
  );
}
