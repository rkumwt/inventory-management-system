import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AdjustStockInput,
  MovementType,
  Paginated,
  StockItem,
  StockMovement,
  TransferStockInput,
} from '@/lib/api/types';

export interface StockFilters {
  page: number;
  limit?: number;
  warehouseId?: string;
  productId?: string;
  lowStock?: boolean;
}

export interface MovementFilters {
  page: number;
  warehouseId?: string;
  type?: MovementType;
}

export const inventoryKeys = {
  all: ['inventory'] as const,
  stock: (filters: StockFilters) => ['inventory', 'stock', filters] as const,
  movements: (filters: MovementFilters) =>
    ['inventory', 'movements', filters] as const,
};

export function useStock(filters: StockFilters) {
  return useQuery({
    queryKey: inventoryKeys.stock(filters),
    queryFn: () =>
      api.get<Paginated<StockItem>>('/inventory', { limit: 10, ...filters }),
    placeholderData: keepPreviousData,
  });
}

export function useMovements(filters: MovementFilters) {
  return useQuery({
    queryKey: inventoryKeys.movements(filters),
    queryFn: () =>
      api.get<Paginated<StockMovement>>('/inventory/movements', {
        ...filters,
        limit: 10,
      }),
    placeholderData: keepPreviousData,
  });
}

/** Any stock change makes every cached stock level and movement list stale. */
function useInvalidateInventory() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
}

export function useAdjustStock(direction: 'in' | 'out') {
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: (input: AdjustStockInput) =>
      api.post<{ stock: StockItem }>(`/inventory/stock-${direction}`, input),
    onSuccess: invalidate,
  });
}

export function useTransferStock() {
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: (input: TransferStockInput) =>
      api.post<{ source: StockItem; destination: StockItem }>(
        '/inventory/transfer',
        input,
      ),
    onSuccess: invalidate,
  });
}

export function useSetThreshold() {
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: ({ id, threshold }: { id: string; threshold: number }) =>
      api.patch<StockItem>(`/inventory/${id}/threshold`, {
        lowStockThreshold: threshold,
      }),
    onSuccess: invalidate,
  });
}
