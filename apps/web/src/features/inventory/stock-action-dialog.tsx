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
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { useProductLookup } from '@/features/products/api';
import { useWarehouseLookup } from '@/features/warehouses/api';
import { errorMessage } from '@/lib/api/errors';
import { useAdjustStock, useTransferStock } from './api';

export type StockAction = 'in' | 'out' | 'transfer';

const COPY: Record<
  StockAction,
  { title: string; description: string; submit: string }
> = {
  in: {
    title: 'Stock in',
    description: 'Record stock received into a warehouse.',
    submit: 'Receive stock',
  },
  out: {
    title: 'Stock out',
    description: 'Remove available stock from a warehouse.',
    submit: 'Remove stock',
  },
  transfer: {
    title: 'Transfer stock',
    description: 'Move stock from one warehouse to another.',
    submit: 'Transfer',
  },
};

const schema = z
  .object({
    action: z.enum(['in', 'out', 'transfer']),
    productId: z.string().min(1, 'Choose a product'),
    warehouseId: z.string().min(1, 'Choose a warehouse'),
    toWarehouseId: z.string(),
    quantity: z
      .string()
      .trim()
      .regex(/^[1-9]\d{0,6}$/, 'Enter a whole number greater than zero'),
    reference: z.string().trim().max(120),
    note: z.string().trim().max(500),
  })
  .superRefine((values, context) => {
    if (values.action !== 'transfer') return;
    if (!values.toWarehouseId) {
      context.addIssue({
        code: 'custom',
        path: ['toWarehouseId'],
        message: 'Choose a destination',
      });
    } else if (values.toWarehouseId === values.warehouseId) {
      context.addIssue({
        code: 'custom',
        path: ['toWarehouseId'],
        message: 'Must differ from the source warehouse',
      });
    }
  });

type Values = z.infer<typeof schema>;

export function StockActionDialog({
  action,
  onClose,
  defaults,
}: {
  /** Which dialog is open; `null` closes it. */
  action: StockAction | null;
  onClose: () => void;
  defaults?: { productId?: string; warehouseId?: string };
}) {
  const { products } = useProductLookup();
  const { warehouses } = useWarehouseLookup();
  const stockIn = useAdjustStock('in');
  const stockOut = useAdjustStock('out');
  const transfer = useTransferStock();
  const pending = stockIn.isPending || stockOut.isPending || transfer.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (action) {
      reset({
        action,
        productId: defaults?.productId ?? '',
        warehouseId: defaults?.warehouseId ?? '',
        toWarehouseId: '',
        quantity: '',
        reference: '',
        note: '',
      });
    }
  }, [action, defaults?.productId, defaults?.warehouseId, reset]);

  if (!action) return null;
  const copy = COPY[action];
  const activeProducts = products.filter((product) => product.isActive);
  const activeWarehouses = warehouses.filter((warehouse) => warehouse.isActive);

  const onSubmit = handleSubmit((values) => {
    const common = {
      productId: values.productId,
      quantity: Number(values.quantity),
      reference: values.reference || undefined,
      note: values.note || undefined,
    };
    const handlers = {
      onSuccess: () => {
        toast.success(`${copy.title} recorded`);
        onClose();
      },
      onError: (error: unknown) => toast.error(errorMessage(error)),
    };

    if (values.action === 'transfer') {
      transfer.mutate(
        {
          ...common,
          fromWarehouseId: values.warehouseId,
          toWarehouseId: values.toWarehouseId,
        },
        handlers,
      );
    } else {
      const mutation = values.action === 'in' ? stockIn : stockOut;
      mutation.mutate({ ...common, warehouseId: values.warehouseId }, handlers);
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader title={copy.title} description={copy.description} />
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <input type="hidden" {...register('action')} />
          <Field
            label="Product"
            htmlFor="productId"
            error={errors.productId?.message}
          >
            <Select
              id="productId"
              aria-invalid={!!errors.productId}
              {...register('productId')}
            >
              <option value="">Choose a product…</option>
              {activeProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} · {product.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={action === 'transfer' ? 'From warehouse' : 'Warehouse'}
              htmlFor="warehouseId"
              error={errors.warehouseId?.message}
              className={action === 'transfer' ? '' : 'col-span-2'}
            >
              <Select
                id="warehouseId"
                aria-invalid={!!errors.warehouseId}
                {...register('warehouseId')}
              >
                <option value="">Choose a warehouse…</option>
                {activeWarehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} · {warehouse.name}
                  </option>
                ))}
              </Select>
            </Field>
            {action === 'transfer' ? (
              <Field
                label="To warehouse"
                htmlFor="toWarehouseId"
                error={errors.toWarehouseId?.message}
              >
                <Select
                  id="toWarehouseId"
                  aria-invalid={!!errors.toWarehouseId}
                  {...register('toWarehouseId')}
                >
                  <option value="">Choose a warehouse…</option>
                  {activeWarehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.code} · {warehouse.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Quantity"
              htmlFor="quantity"
              error={errors.quantity?.message}
            >
              <Input
                id="quantity"
                inputMode="numeric"
                aria-invalid={!!errors.quantity}
                {...register('quantity')}
              />
            </Field>
            <Field
              label="Reference"
              htmlFor="reference"
              error={errors.reference?.message}
              hint="e.g. a purchase order number"
            >
              <Input id="reference" {...register('reference')} />
            </Field>
          </div>
          <Field label="Note" htmlFor="note" error={errors.note?.message}>
            <Input id="note" {...register('note')} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : copy.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
