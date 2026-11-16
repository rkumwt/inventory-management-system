'use client';

import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState, TableStates } from '@/components/data-states';
import { PageHeader, Toolbar } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
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
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { OrderStatus } from '@/lib/api/types';
import { formatDateTime, formatMoney } from '@/lib/format';
import { useOrders } from './api';
import { NewOrderDialog } from './new-order-dialog';
import { OrderStatusBadge } from './order-status-badge';

export function OrdersPage() {
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const warehouses = useWarehouseLookup();
  const orders = useOrders({
    page,
    status: status || undefined,
    search: debouncedSearch || undefined,
  });
  const filtered = !!status || !!debouncedSearch;

  return (
    <>
      <PageHeader
        title="Orders"
        description="An order is confirmed once stock has been reserved for it."
        actions={
          can('orders:create') ? (
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden /> New order
            </Button>
          ) : null
        }
      />
      <Card>
        <Toolbar>
          <div className="relative w-64">
            <Search
              className="absolute left-2.5 top-2.5 size-4 text-muted-foreground"
              aria-hidden
            />
            <Input
              aria-label="Search orders"
              placeholder="Search order number"
              className="pl-8"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            aria-label="Status"
            className="w-44"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as OrderStatus | '');
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </Toolbar>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Placed</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableStates
              query={orders}
              columns={6}
              empty={
                <EmptyState
                  title={filtered ? 'No orders match' : 'No orders yet'}
                  description={
                    filtered
                      ? 'Try a different search or status.'
                      : 'Place the first order to see the saga at work.'
                  }
                />
              }
            >
              {(rows) =>
                rows.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-mono text-xs font-medium text-primary hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(order.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {warehouses.byId.get(order.warehouseId)?.code ?? '…'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {order.items.reduce(
                        (sum, item) => sum + item.quantity,
                        0,
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(order.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                  </TableRow>
                ))
              }
            </TableStates>
          </TableBody>
        </Table>
        <Pagination meta={orders.data?.meta} onPageChange={setPage} />
      </Card>

      <NewOrderDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
