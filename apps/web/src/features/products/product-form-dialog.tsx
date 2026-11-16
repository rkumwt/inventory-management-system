'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { errorMessage } from '@/lib/api/errors';
import { PRODUCT_UNITS, type Product } from '@/lib/api/types';
import { useCategories, useSaveProduct } from './api';
import {
  productFormSchema,
  toFormValues,
  toProductInput,
  type ProductFormValues,
} from './product-schema';

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; absent when creating. */
  product?: Product;
}) {
  const categories = useCategories();
  const save = useSaveProduct();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: toFormValues(product),
  });

  // Start from the right values each time the dialog opens.
  useEffect(() => {
    if (open) reset(toFormValues(product));
  }, [open, product, reset]);

  const onSubmit = handleSubmit((values) => {
    save.mutate(
      { id: product?.id, input: toProductInput(values) },
      {
        onSuccess: (saved) => {
          toast.success(`${saved.sku} ${product ? 'updated' : 'created'}`);
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
          title={product ? `Edit ${product.sku}` : 'New product'}
          description="SKU, price and unit are required."
        />
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <Field label="SKU" htmlFor="sku" error={errors.sku?.message}>
              <Input
                id="sku"
                aria-invalid={!!errors.sku}
                {...register('sku')}
              />
            </Field>
            <Field
              label="Category"
              htmlFor="categoryId"
              error={errors.categoryId?.message}
            >
              <Select id="categoryId" {...register('categoryId')}>
                <option value="">No category</option>
                {categories.data?.data.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Name" htmlFor="name" error={errors.name?.message}>
            <Input
              id="name"
              aria-invalid={!!errors.name}
              {...register('name')}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Price" htmlFor="price" error={errors.price?.message}>
              <Input
                id="price"
                inputMode="decimal"
                placeholder="0.00"
                aria-invalid={!!errors.price}
                {...register('price')}
              />
            </Field>
            <Field label="Unit" htmlFor="unit" error={errors.unit?.message}>
              <Select id="unit" {...register('unit')}>
                {PRODUCT_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field
            label="Description"
            htmlFor="description"
            error={errors.description?.message}
          >
            <Textarea id="description" rows={2} {...register('description')} />
          </Field>
          <Field
            label="Attributes"
            htmlFor="attributes"
            error={errors.attributes?.message}
            hint='One "key: value" per line, e.g. "color: blue".'
          >
            <Textarea
              id="attributes"
              rows={3}
              className="font-mono text-xs"
              aria-invalid={!!errors.attributes}
              {...register('attributes')}
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
