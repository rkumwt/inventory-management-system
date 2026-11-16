'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { EmptyState, ErrorState, TableStates } from '@/components/data-states';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { errorMessage } from '@/lib/api/errors';
import {
  useAddLocation,
  useDeleteLocation,
  useLocations,
  useWarehouse,
} from './api';

const locationSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,31}$/, 'Use letters, digits or "-"'),
  description: z.string().trim().max(255),
});

type LocationValues = z.infer<typeof locationSchema>;

export function WarehouseDetailPage({ id }: { id: string }) {
  const { can } = useAuth();
  const canWrite = can('warehouses:write');
  const warehouse = useWarehouse(id);
  const locations = useLocations(id);
  const addLocation = useAddLocation(id);
  const deleteLocation = useDeleteLocation(id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LocationValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: { code: '', description: '' },
  });

  const onAdd = handleSubmit((values) =>
    addLocation.mutate(
      { code: values.code, description: values.description || null },
      {
        onSuccess: (location) => {
          toast.success(`Location ${location.code} added`);
          reset();
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    ),
  );

  const back = (
    <Button variant="outline" asChild>
      <Link href="/warehouses">
        <ArrowLeft aria-hidden /> All warehouses
      </Link>
    </Button>
  );

  if (warehouse.isError) {
    return (
      <>
        <PageHeader title="Warehouse" actions={back} />
        <Card>
          <ErrorState
            error={warehouse.error}
            onRetry={() => warehouse.refetch()}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={warehouse.data?.name ?? 'Loading…'}
        description={
          warehouse.data
            ? [
                warehouse.data.address,
                warehouse.data.city,
                warehouse.data.country,
              ]
                .filter(Boolean)
                .join(', ')
            : undefined
        }
        actions={back}
      />
      {warehouse.isPending ? (
        <Skeleton className="mb-5 h-6 w-48" />
      ) : (
        <div className="mb-5 flex gap-2">
          <Badge variant="info">{warehouse.data.code}</Badge>
          <Badge variant={warehouse.data.isActive ? 'success' : 'neutral'}>
            {warehouse.data.isActive ? 'Active' : 'Archived'}
          </Badge>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Storage locations</CardTitle>
        </CardHeader>
        {canWrite ? (
          <CardContent>
            <form
              onSubmit={onAdd}
              className="flex items-start gap-2"
              noValidate
            >
              <div className="w-40">
                <Input
                  aria-label="Location code"
                  placeholder="A-01-03"
                  aria-invalid={!!errors.code}
                  {...register('code')}
                />
                {errors.code ? (
                  <p role="alert" className="mt-1 text-xs text-destructive">
                    {errors.code.message}
                  </p>
                ) : null}
              </div>
              <Input
                aria-label="Description"
                placeholder="Description (optional)"
                className="max-w-sm"
                {...register('description')}
              />
              <Button type="submit" disabled={addLocation.isPending}>
                <Plus aria-hidden /> Add location
              </Button>
            </form>
          </CardContent>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Description</TableHead>
              {canWrite ? <TableHead className="w-16" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableStates
              query={locations}
              columns={canWrite ? 3 : 2}
              empty={
                <EmptyState
                  title="No storage locations yet"
                  description="Add aisles, racks or bins to describe this warehouse."
                />
              }
            >
              {(rows) =>
                rows.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-mono text-xs">
                      {location.code}
                    </TableCell>
                    <TableCell>{location.description ?? '—'}</TableCell>
                    {canWrite ? (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete location ${location.code}`}
                          disabled={deleteLocation.isPending}
                          onClick={() =>
                            deleteLocation.mutate(location.id, {
                              onSuccess: () =>
                                toast.success(
                                  `Location ${location.code} deleted`,
                                ),
                              onError: (error) =>
                                toast.error(errorMessage(error)),
                            })
                          }
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              }
            </TableStates>
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
