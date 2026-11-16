'use client';

import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  SlidersHorizontal,
} from 'lucide-react';
import { useState } from 'react';
import { EmptyState, TableStates } from '@/components/data-states';
import { PageHeader, Toolbar } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/features/auth/auth-context';
import { useProductLookup } from '@/features/products/api';
import { useWarehouseLookup } from '@/features/warehouses/api';
import type { MovementType, StockItem } from '@/lib/api/types';
import { formatDateTime, formatNumber, humanize } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useMovements, useStock } from './api';
import { StockActionDialog, type StockAction } from './stock-action-dialog';
import { ThresholdDialog } from './threshold-dialog';

const MOVEMENT_BADGE: Record<MovementType, BadgeVariant> = {
  IN: 'success',
  OUT: 'danger',
  TRANSFER_IN: 'info',
  TRANSFER_OUT: 'warning',
};

type Tab = 'stock' | 'movements';

export function InventoryPage() {
  const { can } = useAuth();
  const canAdjust = can('inventory:adjust');
  const canTransfer = can('inventory:transfer');

  const [tab, setTab] = useState<Tab>('stock');
  const [warehouseId, setWarehouseId] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [stockPage, setStockPage] = useState(1);
  const [movementPage, setMovementPage] = useState(1);
  const [action, setAction] = useState<StockAction | null>(null);
  const [thresholdItem, setThresholdItem] = useState<StockItem | null>(null);

  const products = useProductLookup();
  const warehouses = useWarehouseLookup();
  const stock = useStock({
    page: stockPage,
    warehouseId: warehouseId || undefined,
    lowStock: lowOnly ? true : undefined,
  });
  const movements = useMovements({
    page: movementPage,
    warehouseId: warehouseId || undefined,
  });

  const productLabel = (id: string) => {
    const product = products.byId.get(id);
    return product ? (
      <>
        <span className="font-medium">{product.name}</span>
        <span className="ml-2 font-mono text-xs text-muted-foreground">
          {product.sku}
        </span>
      </>
    ) : (
      <span className="font-mono text-xs text-muted-foreground">{id}</span>
    );
  };
  const warehouseLabel = (id: string) => warehouses.byId.get(id)?.code ?? '…';

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Stock per product and warehouse, and every movement that changed it."
        actions={
          <>
            {canAdjust ? (
              <>
                <Button variant="outline" onClick={() => setAction('in')}>
                  <ArrowDownToLine aria-hidden /> Stock in
                </Button>
                <Button variant="outline" onClick={() => setAction('out')}>
                  <ArrowUpFromLine aria-hidden /> Stock out
                </Button>
              </>
            ) : null}
            {canTransfer ? (
              <Button onClick={() => setAction('transfer')}>
                <ArrowLeftRight aria-hidden /> Transfer
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <Toolbar>
          <div role="tablist" className="flex rounded-md bg-muted p-0.5">
            {(['stock', 'movements'] as const).map((value) => (
              <button
                key={value}
                role="tab"
                type="button"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={cn(
                  'rounded px-3 py-1 text-sm',
                  tab === value
                    ? 'bg-card font-medium shadow-xs'
                    : 'text-muted-foreground',
                )}
              >
                {value === 'stock' ? 'Stock levels' : 'Movement history'}
              </button>
            ))}
          </div>
          <Select
            aria-label="Warehouse"
            className="w-56"
            value={warehouseId}
            onChange={(event) => {
              setWarehouseId(event.target.value);
              setStockPage(1);
              setMovementPage(1);
            }}
          >
            <option value="">All warehouses</option>
            {warehouses.warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code} · {warehouse.name}
              </option>
            ))}
          </Select>
          {tab === 'stock' ? (
            <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={lowOnly}
                onChange={(event) => {
                  setLowOnly(event.target.checked);
                  setStockPage(1);
                }}
              />
              Low stock only
            </label>
          ) : null}
        </Toolbar>

        {tab === 'stock' ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Threshold</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableStates
                  query={stock}
                  columns={7}
                  empty={
                    <EmptyState
                      title={
                        lowOnly
                          ? 'Nothing is low on stock'
                          : 'No stock recorded'
                      }
                      description={
                        lowOnly
                          ? 'Every item is above its threshold.'
                          : 'Use "Stock in" to record the first delivery.'
                      }
                    />
                  }
                >
                  {(rows) =>
                    rows.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{productLabel(item.productId)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {warehouseLabel(item.warehouseId)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(item.quantity)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatNumber(item.reservedQuantity)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatNumber(item.availableQuantity)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(item.lowStockThreshold)}
                          {canAdjust ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="ml-1"
                              aria-label="Change low-stock threshold"
                              onClick={() => setThresholdItem(item)}
                            >
                              <SlidersHorizontal />
                            </Button>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={item.lowStock ? 'warning' : 'success'}
                          >
                            {item.lowStock ? 'Low stock' : 'In stock'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  }
                </TableStates>
              </TableBody>
            </Table>
            <Pagination meta={stock.data?.meta} onPageChange={setStockPage} />
          </>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableStates
                  query={movements}
                  columns={7}
                  empty={
                    <EmptyState
                      title="No movements yet"
                      description="Stock changes will be listed here."
                    />
                  }
                >
                  {(rows) =>
                    rows.map((movement) => {
                      const adds =
                        movement.type === 'IN' ||
                        movement.type === 'TRANSFER_IN';
                      return (
                        <TableRow key={movement.id}>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {formatDateTime(movement.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={MOVEMENT_BADGE[movement.type]}>
                              {humanize(movement.type)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {productLabel(movement.productId)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {warehouseLabel(movement.warehouseId)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              'text-right font-medium tabular-nums',
                              adds ? 'text-success' : 'text-destructive',
                            )}
                          >
                            {adds ? '+' : '−'}
                            {formatNumber(movement.quantity)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNumber(movement.quantityAfter)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {movement.reference ?? movement.note ?? '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  }
                </TableStates>
              </TableBody>
            </Table>
            <Pagination
              meta={movements.data?.meta}
              onPageChange={setMovementPage}
            />
          </>
        )}
      </Card>

      <StockActionDialog
        action={action}
        onClose={() => setAction(null)}
        defaults={{ warehouseId: warehouseId || undefined }}
      />
      <ThresholdDialog
        item={thresholdItem}
        label={
          thresholdItem
            ? (products.byId.get(thresholdItem.productId)?.name ?? 'This item')
            : ''
        }
        onClose={() => setThresholdItem(null)}
      />
    </>
  );
}
