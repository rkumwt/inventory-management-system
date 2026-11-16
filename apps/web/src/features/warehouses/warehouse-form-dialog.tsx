'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { errorMessage } from '@/lib/api/errors';
import type { Warehouse } from '@/lib/api/types';
import { useSaveWarehouse } from './api';

const warehouseSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9-]{1,19}$/,
      'Use 2-20 letters, digits or "-"',
    ),
  name: z.string().trim().min(1, 'Enter a name').max(120),
  address: z.string().trim().max(255),
  city: z.string().trim().min(1, 'Enter a city').max(80),
  country: z.string().trim().min(1, 'Enter a country').max(80),
});

type WarehouseValues = z.infer<typeof warehouseSchema>;

const toValues = (warehouse?: Warehouse): WarehouseValues => ({
  code: warehouse?.code ?? '',
  name: warehouse?.name ?? '',
  address: warehouse?.address ?? '',
  city: warehouse?.city ?? '',
  country: warehouse?.country ?? '',
});

export function WarehouseFormDialog({
  open,
  onOpenChange,
  warehouse,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; absent when creating. */
  warehouse?: Warehouse;
}) {
  const save = useSaveWarehouse();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WarehouseValues>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: toValues(warehouse),
  });

  useEffect(() => {
    if (open) reset(toValues(warehouse));
  }, [open, warehouse, reset]);

  const onSubmit = handleSubmit((values) => {
    save.mutate(
      {
        id: warehouse?.id,
        input: { ...values, address: values.address || null },
      },
      {
        onSuccess: (saved) => {
          toast.success(`${saved.code} ${warehouse ? 'updated' : 'created'}`);
          onOpenChange(false);
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          title={warehouse ? `Edit ${warehouse.code}` : 'New warehouse'}
        />
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Code" htmlFor="code" error={errors.code?.message}>
              <Input
                id="code"
                placeholder="WH-NYC"
                aria-invalid={!!errors.code}
                {...register('code')}
              />
            </Field>
            <Field
              label="Name"
              htmlFor="name"
              error={errors.name?.message}
              className="col-span-2"
            >
              <Input
                id="name"
                aria-invalid={!!errors.name}
                {...register('name')}
              />
            </Field>
          </div>
          <Field
            label="Address"
            htmlFor="address"
            error={errors.address?.message}
          >
            <Input id="address" {...register('address')} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="City" htmlFor="city" error={errors.city?.message}>
              <Input
                id="city"
                aria-invalid={!!errors.city}
                {...register('city')}
              />
            </Field>
            <Field
              label="Country"
              htmlFor="country"
              error={errors.country?.message}
            >
              <Input
                id="country"
                aria-invalid={!!errors.country}
                {...register('country')}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save warehouse'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
