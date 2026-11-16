'use client';

import { Archive, Pencil, Plus, RotateCcw, Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, TableStates } from '@/components/data-states';
import { PageHeader, Toolbar } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { Badge } from '@/components/ui/badge';
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
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { errorMessage } from '@/lib/api/errors';
import type { Product } from '@/lib/api/types';
import { formatMoney } from '@/lib/format';
import { useCategories, useProducts, useSetProductActive } from './api';
import { ProductFormDialog } from './product-form-dialog';

export function ProductsPage() {
  const { can } = useAuth();
  const canWrite = can('products:write');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const products = useProducts({
    page,
    search: debouncedSearch || undefined,
    categoryId: categoryId || undefined,
    isActive: showArchived ? undefined : true,
  });
  const categories = useCategories();
  const setActive = useSetProductActive();

  // `undefined` = closed, `null` = creating, a product = editing it.
  const [editing, setEditing] = useState<Product | null | undefined>();

  const toggleActive = (product: Product) =>
    setActive.mutate(
      { id: product.id, isActive: !product.isActive },
      {
        onSuccess: () =>
          toast.success(
            `${product.sku} ${product.isActive ? 'archived' : 'restored'}`,
          ),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );

  const columns = canWrite ? 7 : 6;
  const filtered = !!debouncedSearch || !!categoryId;

  return (
    <>
      <PageHeader
        title="Products"
        description="The catalogue: what can be stocked and ordered."
        actions={
          canWrite ? (
            <Button onClick={() => setEditing(null)}>
              <Plus aria-hidden /> New product
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
              aria-label="Search products"
              placeholder="Search SKU or name"
              className="pl-8"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            aria-label="Category"
            className="w-48"
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {categories.data?.data.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => {
                setShowArchived(event.target.checked);
                setPage(1);
              }}
            />
            Show archived
          </label>
        </Toolbar>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Attributes</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Status</TableHead>
              {canWrite ? <TableHead className="w-24" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableStates
              query={products}
              columns={columns}
              empty={
                <EmptyState
                  title={filtered ? 'No products match' : 'No products yet'}
                  description={
                    filtered
                      ? 'Try a different search or category.'
                      : 'Create the first product to get started.'
                  }
                />
              }
            >
              {(rows) =>
                rows.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono text-xs">
                      {product.sku}
                    </TableCell>
                    <TableCell className="font-medium">
                      {product.name}
                    </TableCell>
                    <TableCell>{product.category?.name ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(product.attributes).map(
                          ([key, value]) => (
                            <Badge key={key}>
                              {key}: {String(value)}
                            </Badge>
                          ),
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(product.price)}
                      <span className="text-muted-foreground">
                        {' '}
                        / {product.unit}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.isActive ? 'success' : 'neutral'}>
                        {product.isActive ? 'Active' : 'Archived'}
                      </Badge>
                    </TableCell>
                    {canWrite ? (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${product.sku}`}
                            onClick={() => setEditing(product)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`${product.isActive ? 'Archive' : 'Restore'} ${product.sku}`}
                            disabled={setActive.isPending}
                            onClick={() => toggleActive(product)}
                          >
                            {product.isActive ? <Archive /> : <RotateCcw />}
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              }
            </TableStates>
          </TableBody>
        </Table>
        <Pagination meta={products.data?.meta} onPageChange={setPage} />
      </Card>

      <ProductFormDialog
        open={editing !== undefined}
        onOpenChange={(open) => !open && setEditing(undefined)}
        product={editing ?? undefined}
      />
    </>
  );
}
