import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { inventoryKeys } from '@/features/inventory/api';
import { api } from '@/lib/api';
import type {
  CreateOrderInput,
  Order,
  OrderStatus,
  Paginated,
} from '@/lib/api/types';

export interface OrderFilters {
  page: number;
  limit?: number;
  status?: OrderStatus;
  search?: string;
}

export const orderKeys = {
  all: ['orders'] as const,
  list: (filters: OrderFilters) => ['orders', 'list', filters] as const,
  detail: (id: string) => ['orders', 'detail', id] as const,
};

/** How often a PENDING order is re-checked while the saga decides its fate. */
const PENDING_POLL_MS = 1500;

export function useOrders(filters: OrderFilters) {
  return useQuery({
    queryKey: orderKeys.list(filters),
    queryFn: () =>
      api.get<Paginated<Order>>('/orders', { limit: 10, ...filters }),
    placeholderData: keepPreviousData,
    // Keep refreshing while anything on the page is still pending.
    refetchInterval: (query) =>
      query.state.data?.data.some((order) => order.status === 'PENDING')
        ? PENDING_POLL_MS
        : false,
  });
}

/**
 * Placing an order returns PENDING straight away; stock is reserved
 * asynchronously. So the detail query polls until the order is CONFIRMED or
 * CANCELLED, then stops.
 */
export function useOrder(id: string) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => api.get<Order>(`/orders/${id}`),
    refetchInterval: (query) =>
      query.state.data?.status === 'PENDING' ? PENDING_POLL_MS : false,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrderInput) => api.post<Order>('/orders', input),
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(order.id), order);
      return queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.post<Order>(`/orders/${id}/cancel`, { reason: reason || undefined }),
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(order.id), order);
      // Cancelling releases reserved stock, a moment later.
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      return queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
  });
}
