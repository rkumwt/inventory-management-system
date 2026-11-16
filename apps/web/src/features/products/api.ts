import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Category,
  Paginated,
  Product,
  ProductInput,
} from '@/lib/api/types';

export interface ProductFilters {
  page: number;
  search?: string;
  categoryId?: string;
  isActive?: boolean;
}

export const productKeys = {
  all: ['products'] as const,
  list: (filters: ProductFilters) => ['products', 'list', filters] as const,
  lookup: ['products', 'lookup'] as const,
  categories: ['categories'] as const,
};

export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: () =>
      api.get<Paginated<Product>>('/products', { ...filters, limit: 10 }),
    placeholderData: keepPreviousData, // keep the table while the next page loads
  });
}

/**
 * Every product, for dropdowns and for showing names next to the product IDs
 * that inventory and orders return. One request, cached for a while.
 */
export function useProductLookup() {
  const query = useQuery({
    queryKey: productKeys.lookup,
    queryFn: () =>
      api.get<Paginated<Product>>('/products', { limit: 100, sortBy: 'name' }),
    staleTime: 60_000,
  });
  const products = query.data?.data ?? [];
  const byId = new Map(products.map((product) => [product.id, product]));
  return { ...query, products, byId };
}

export function useCategories() {
  return useQuery({
    queryKey: productKeys.categories,
    queryFn: () => api.get<Paginated<Category>>('/categories', { limit: 100 }),
    staleTime: 60_000,
  });
}

export function useSaveProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ProductInput }) =>
      id
        ? api.patch<Product>(`/products/${id}`, input)
        : api.post<Product>('/products', input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: productKeys.all }),
  });
}

export function useSetProductActive() {
  const queryClient = useQueryClient();
  return useMutation({
    // DELETE archives (the API never hard-deletes a product); PATCH restores.
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      if (isActive) await api.patch(`/products/${id}`, { isActive: true });
      else await api.delete(`/products/${id}`);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: productKeys.all }),
  });
}
