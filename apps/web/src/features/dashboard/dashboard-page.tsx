'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Package,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { EmptyState, TableStates } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { useStock } from '@/features/inventory/api';
import { useOrders } from '@/features/orders/api';
import { OrderStatusBadge } from '@/features/orders/order-status-badge';
import { useProductLookup } from '@/features/products/api';
import { useWarehouseLookup } from '@/features/warehouses/api';
import { api } from '@/lib/api';
import type { Paginated } from '@/lib/api/types';
import { formatMoney, formatNumber } from '@/lib/format';

/**
 * How many rows a list endpoint has in total. Every list response carries
 * `meta.total`, so asking for a single row is the cheapest way to count.
 */
function useCount(
  key: string,
  path: string,
  query: Record<string, string | boolean> = {},
) {
  return useQuery({
    queryKey: ['dashboard', 'count', key],
    queryFn: () => api.get<Paginated<unknown>>(path, { ...query, limit: 1 }),
    select: (page) => page.meta.total,
  });
}

function StatCard({
  label,
  icon: Icon,
  href,
  query,
  tone = 'default',
}: {
  label: string;
  icon: LucideIcon;
  href: string;
  query: { isPending: boolean; isError: boolean; data?: number };
  tone?: 'default' | 'warning';
}) {
  const highlighted = tone === 'warning' && (query.data ?? 0) > 0;
  return (
    <Link
      href={href}
      className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center justify-between pt-5">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            {query.isPending ? (
              <Skeleton className="mt-1.5 h-8 w-14" />
            ) : (
              <p className="mt-0.5 text-3xl font-semibold tabular-nums">
                {query.isError ? '—' : formatNumber(query.data ?? 0)}
              </p>
            )}
          </div>
          <Icon
            className={
              highlighted
                ? 'size-8 text-warning'
                : 'size-8 text-muted-foreground/50'
            }
            aria-hidden
          />
        </CardContent>
      </Card>
    </Link>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const products = useProductLookup();
  const warehouses = useWarehouseLookup();

  const productCount = useCount('products', '/products', { isActive: true });
  const warehouseCount = useCount('warehouses', '/warehouses', {
    isActive: true,
  });
  const lowStockCount = useCount('low-stock', '/inventory', { lowStock: true });
  const pendingCount = useCount('pending', '/orders', { status: 'PENDING' });
  const confirmedCount = useCount('confirmed', '/orders', {
    status: 'CONFIRMED',
  });

  const lowStock = useStock({ page: 1, limit: 5, lowStock: true });
  const recentOrders = useOrders({ page: 1, limit: 5 });

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.name.split(' ')[0] ?? ''}`}
        description="A snapshot of the catalogue, stock and orders."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Active products"
          icon={Package}
          href="/products"
          query={productCount}
        />
        <StatCard
          label="Warehouses"
          icon={Warehouse}
          href="/warehouses"
          query={warehouseCount}
        />
        <StatCard
          label="Low-stock items"
          icon={AlertTriangle}
          href="/inventory"
          query={lowStockCount}
          tone="warning"
        />
        <StatCard
          label="Pending orders"
          icon={Clock}
          href="/orders"
          query={pendingCount}
        />
        <StatCard
          label="Confirmed orders"
          icon={CheckCircle2}
          href="/orders"
          query={confirmedCount}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Low on stock</CardTitle>
            <CardDescription>
              Items at or below their threshold.
            </CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Threshold</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableStates
                query={lowStock}
                columns={4}
                empty={
                  <EmptyState
                    title="Nothing is low on stock"
                    description="Every item is above its threshold."
                  />
                }
              >
                {(rows) =>
                  rows.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {products.byId.get(item.productId)?.name ?? '…'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {warehouses.byId.get(item.warehouseId)?.code ?? '…'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="warning">
                          {formatNumber(item.availableQuantity)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatNumber(item.lowStockThreshold)}
                      </TableCell>
                    </TableRow>
                  ))
                }
              </TableStates>
            </TableBody>
          </Table>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent orders</CardTitle>
            <CardDescription>The five most recent.</CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableStates
                query={recentOrders}
                columns={3}
                empty={
                  <EmptyState
                    title="No orders yet"
                    description="Orders will appear here once placed."
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
                      <TableCell className="text-right tabular-nums">
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
        </Card>
      </div>
    </>
  );
}
