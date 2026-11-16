import { z } from 'zod';
import type { CreateOrderInput } from '@/lib/api/types';

export const orderFormSchema = z.object({
  warehouseId: z.string().min(1, 'Choose a warehouse'),
  note: z.string().trim().max(500),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Choose a product'),
        quantity: z
          .string()
          .trim()
          .regex(/^[1-9]\d{0,4}$/, 'Whole number, 1 or more'),
      }),
    )
    .min(1, 'Add at least one product')
    .superRefine((items, context) => {
      const seen = new Set<string>();
      items.forEach((item, index) => {
        if (item.productId && seen.has(item.productId)) {
          context.addIssue({
            code: 'custom',
            path: [index, 'productId'],
            message: 'Already on this order',
          });
        }
        seen.add(item.productId);
      });
    }),
});

export type OrderFormValues = z.infer<typeof orderFormSchema>;

export const emptyOrder: OrderFormValues = {
  warehouseId: '',
  note: '',
  items: [{ productId: '', quantity: '1' }],
};

export function toCreateOrderInput(values: OrderFormValues): CreateOrderInput {
  return {
    warehouseId: values.warehouseId,
    note: values.note || undefined,
    items: values.items.map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity),
    })),
  };
}

/** Running total shown in the form; the server computes the real one. */
export function estimateTotal(
  items: OrderFormValues['items'],
  priceOf: (productId: string) => number | undefined,
): number {
  const cents = items.reduce((sum, item) => {
    const price = priceOf(item.productId);
    const quantity = /^\d+$/.test(item.quantity) ? Number(item.quantity) : 0;
    return price === undefined ? sum : sum + Math.round(price * 100) * quantity;
  }, 0);
  return cents / 100;
}
