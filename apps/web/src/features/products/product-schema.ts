import { z } from 'zod';
import {
  PRODUCT_UNITS,
  type Product,
  type ProductAttributes,
  type ProductInput,
} from '@/lib/api/types';

/** Form values are strings, as inputs hold them; they are converted on submit. */
export const productFormSchema = z.object({
  sku: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/,
      'Use 2-64 letters, digits, ".", "-" or "_"',
    ),
  name: z.string().trim().min(1, 'Enter a name').max(200),
  description: z.string().trim().max(2000),
  price: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter a price like 12 or 12.50'),
  unit: z.enum(PRODUCT_UNITS as [string, ...string[]]),
  categoryId: z.string(),
  attributes: z.string().refine((text) => {
    try {
      parseAttributes(text);
      return true;
    } catch {
      return false;
    }
  }, 'Use one "key: value" per line, e.g. "color: blue"'),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

/**
 * Attributes are edited as plain text, one `key: value` per line. Values that
 * look like numbers or booleans are stored as such, so `voltage: 18` can be
 * filtered as the number 18.
 */
export function parseAttributes(text: string): ProductAttributes {
  const attributes: ProductAttributes = {};
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const separator = line.indexOf(':');
    const key = line.slice(0, separator).trim();
    const raw = line.slice(separator + 1).trim();
    if (separator < 1 || !key || !raw) {
      throw new Error(`Cannot read "${line.trim()}"`);
    }
    attributes[key] =
      raw === 'true'
        ? true
        : raw === 'false'
          ? false
          : /^-?\d+(\.\d+)?$/.test(raw)
            ? Number(raw)
            : raw;
  }
  return attributes;
}

export function formatAttributes(attributes: ProductAttributes): string {
  return Object.entries(attributes)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}

export function toFormValues(product?: Product): ProductFormValues {
  return {
    sku: product?.sku ?? '',
    name: product?.name ?? '',
    description: product?.description ?? '',
    price: product ? String(product.price) : '',
    unit: product?.unit ?? 'pcs',
    categoryId: product?.category?.id ?? '',
    attributes: product ? formatAttributes(product.attributes) : '',
  };
}

export function toProductInput(values: ProductFormValues): ProductInput {
  return {
    sku: values.sku,
    name: values.name,
    description: values.description || null,
    price: Number(values.price),
    unit: values.unit as ProductInput['unit'],
    categoryId: values.categoryId || null,
    attributes: parseAttributes(values.attributes),
  };
}
