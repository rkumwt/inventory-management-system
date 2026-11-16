'use client';

import { Archive, Pencil, Plus, RotateCcw, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, TableStates } from '@/components/data-states';
import { PageHeader, Toolbar } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import type { Warehouse } from '@/lib/api/types';
import { useSetWarehouseActive, useWarehouses } from './api';
import { WarehouseFormDialog } from './warehouse-form-dialog';

export function WarehousesPage() {
  const { can } = useAuth();
  const canWrite = can('warehouses:write');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const warehouses = useWarehouses({
    page,
    search: debouncedSearch || undefined,
  });
  const setActive = useSetWarehouseActive();
  const [editing, setEditing] = useState<Warehouse | null | undefined>();

  const toggleActive = (warehouse: Warehouse) =>
    setActive.mutate(
      { id: warehouse.id, isActive: !warehouse.isActive },
      {
        onSuccess: () =>
          toast.success(
            `${warehouse.code} ${warehouse.isActive ? 'archived' : 'restored'}`,
          ),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );

  const columns = canWrite ? 6 : 5;

  return (
    <>
      <PageHeader
        title="Warehouses"
        description="Where stock is kept. Open one to manage its storage locations."
        actions={
          canWrite ? (
            <Button onClick={() => setEditing(null)}>
              <Plus aria-hidden /> New warehouse
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
              aria-label="Search warehouses"
              placeholder="Search code, name or city"
              className="pl-8"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </Toolbar>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Status</TableHead>
              {canWrite ? <TableHead className="w-24" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableStates
              query={warehouses}
              columns={columns}
              empty={
                <EmptyState
                  title={
                    debouncedSearch
                      ? 'No warehouses match'
                      : 'No warehouses yet'
                  }
                  description={
                    debouncedSearch
                      ? 'Try a different search.'
                      : 'Create the first warehouse to get started.'
                  }
                />
              }
            >
              {(rows) =>
                rows.map((warehouse) => (
                  <TableRow key={warehouse.id}>
                    <TableCell className="font-mono text-xs">
                      {warehouse.code}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/warehouses/${warehouse.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {warehouse.name}
                      </Link>
                    </TableCell>
                    <TableCell>{warehouse.city}</TableCell>
                    <TableCell>{warehouse.country}</TableCell>
                    <TableCell>
                      <Badge
                        variant={warehouse.isActive ? 'success' : 'neutral'}
                      >
                        {warehouse.isActive ? 'Active' : 'Archived'}
                      </Badge>
                    </TableCell>
                    {canWrite ? (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${warehouse.code}`}
                            onClick={() => setEditing(warehouse)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`${warehouse.isActive ? 'Archive' : 'Restore'} ${warehouse.code}`}
                            disabled={setActive.isPending}
                            onClick={() => toggleActive(warehouse)}
                          >
                            {warehouse.isActive ? <Archive /> : <RotateCcw />}
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
        <Pagination meta={warehouses.data?.meta} onPageChange={setPage} />
      </Card>

      <WarehouseFormDialog
        open={editing !== undefined}
        onOpenChange={(open) => !open && setEditing(undefined)}
        warehouse={editing ?? undefined}
      />
    </>
  );
}
