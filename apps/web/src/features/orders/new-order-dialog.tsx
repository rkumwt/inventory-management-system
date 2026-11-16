'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { useProductLookup } from '@/features/products/api';
import { useWarehouseLookup } from '@/features/warehouses/api';
import { errorMessage } from '@/lib/api/errors';
import { formatMoney } from '@/lib/format';
import { useCreateOrder } from './api';
import {
  emptyOrder,
  estimateTotal,
  orderFormSchema,
  toCreateOrderInput,
  type OrderFormValues,
} from './order-schema';

export function NewOrderDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { products, byId } = useProductLookup();
  const { warehouses } = useWarehouseLookup();
  const createOrder = useCreateOrder();

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: emptyOrder,
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = useWatch({ control, name: 'items' });

  useEffect(() => {
    if (open) reset(emptyOrder);
  }, [open, reset]);

  const onSubmit = handleSubmit((values) =>
    createOrder.mutate(toCreateOrderInput(values), {
      onSuccess: (order) => {
        toast.success(`Order ${order.orderNumber} placed`, {
          description: 'Reserving stock…',
        });
        onOpenChange(false);
        router.push(`/orders/${order.id}`);
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  );

  const activeProducts = products.filter((product) => product.isActive);
  const total = estimateTotal(items ?? [], (id) => byId.get(id)?.price);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader
          title="New order"
          description="The order is confirmed once stock has been reserved for every line."
        />
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field
            label="Fulfil from"
            htmlFor="warehouseId"
            error={errors.warehouseId?.message}
          >
            <Select
              id="warehouseId"
              aria-invalid={!!errors.warehouseId}
              {...register('warehouseId')}
            >
              <option value="">Choose a warehouse…</option>
              {warehouses
                .filter((warehouse) => warehouse.isActive)
                .map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} · {warehouse.name}
                  </option>
                ))}
            </Select>
          </Field>

          <div className="grid gap-2">
            <Label>Products</Label>
            {fields.map((field, index) => {
              const lineErrors = errors.items?.[index];
              return (
                <div key={field.id} className="grid gap-1">
                  <div className="flex items-start gap-2">
                    <Select
                      aria-label={`Product ${index + 1}`}
                      aria-invalid={!!lineErrors?.productId}
                      {...register(`items.${index}.productId`)}
                    >
                      <option value="">Choose a product…</option>
                      {activeProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.sku} · {product.name} (
                          {formatMoney(product.price)})
                        </option>
                      ))}
                    </Select>
                    <Input
                      aria-label={`Quantity ${index + 1}`}
                      inputMode="numeric"
                      className="w-24"
                      aria-invalid={!!lineErrors?.quantity}
                      {...register(`items.${index}.quantity`)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mt-0.5"
                      aria-label={`Remove product ${index + 1}`}
                      disabled={fields.length === 1}
                      onClick={() => remove(index)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  {lineErrors?.productId || lineErrors?.quantity ? (
                    <p role="alert" className="text-xs text-destructive">
                      {lineErrors.productId?.message ??
                        lineErrors.quantity?.message}
                    </p>
                  ) : null}
                </div>
              );
            })}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => append({ productId: '', quantity: '1' })}
              >
                <Plus aria-hidden /> Add product
              </Button>
              <p className="text-sm">
                <span className="text-muted-foreground">Estimated total </span>
                <span className="font-semibold tabular-nums">
                  {formatMoney(total)}
                </span>
              </p>
            </div>
          </div>

          <Field label="Note" htmlFor="note" error={errors.note?.message}>
            <Input id="note" placeholder="Optional" {...register('note')} />
          </Field>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createOrder.isPending}>
              {createOrder.isPending ? 'Placing…' : 'Place order'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
