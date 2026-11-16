import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Paginated,
  StorageLocation,
  Warehouse,
  WarehouseInput,
} from '@/lib/api/types';

export interface WarehouseFilters {
  page: number;
  search?: string;
  isActive?: boolean;
}

export const warehouseKeys = {
  all: ['warehouses'] as const,
  list: (filters: WarehouseFilters) => ['warehouses', 'list', filters] as const,
  lookup: ['warehouses', 'lookup'] as const,
  detail: (id: string) => ['warehouses', 'detail', id] as const,
  locations: (id: string) => ['warehouses', 'locations', id] as const,
};

export function useWarehouses(filters: WarehouseFilters) {
  return useQuery({
    queryKey: warehouseKeys.list(filters),
    queryFn: () =>
      api.get<Paginated<Warehouse>>('/warehouses', { ...filters, limit: 10 }),
    placeholderData: keepPreviousData,
  });
}

/** Every warehouse, for dropdowns and for showing names next to IDs. */
export function useWarehouseLookup() {
  const query = useQuery({
    queryKey: warehouseKeys.lookup,
    queryFn: () => api.get<Paginated<Warehouse>>('/warehouses', { limit: 100 }),
    staleTime: 60_000,
  });
  const warehouses = query.data?.data ?? [];
  const byId = new Map(
    warehouses.map((warehouse) => [warehouse.id, warehouse]),
  );
  return { ...query, warehouses, byId };
}

export function useWarehouse(id: string) {
  return useQuery({
    queryKey: warehouseKeys.detail(id),
    queryFn: () => api.get<Warehouse>(`/warehouses/${id}`),
  });
}

export function useSaveWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: WarehouseInput }) =>
      id
        ? api.patch<Warehouse>(`/warehouses/${id}`, input)
        : api.post<Warehouse>('/warehouses', input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: warehouseKeys.all }),
  });
}

export function useSetWarehouseActive() {
  const queryClient = useQueryClient();
  return useMutation({
    // DELETE archives (the API never hard-deletes a warehouse); PATCH restores.
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      if (isActive) await api.patch(`/warehouses/${id}`, { isActive: true });
      else await api.delete(`/warehouses/${id}`);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: warehouseKeys.all }),
  });
}

export function useLocations(warehouseId: string) {
  return useQuery({
    queryKey: warehouseKeys.locations(warehouseId),
    queryFn: () =>
      api.get<Paginated<StorageLocation>>(
        `/warehouses/${warehouseId}/locations`,
        { limit: 100 },
      ),
  });
}

export function useAddLocation(warehouseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string; description?: string | null }) =>
      api.post<StorageLocation>(`/warehouses/${warehouseId}/locations`, input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: warehouseKeys.locations(warehouseId),
      }),
  });
}

export function useDeleteLocation(warehouseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (locationId: string) =>
      api.delete(`/warehouses/${warehouseId}/locations/${locationId}`),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: warehouseKeys.locations(warehouseId),
      }),
  });
}
