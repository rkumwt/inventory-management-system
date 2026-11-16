/**
 * The API contract as the frontend sees it. These mirror the response and
 * request shapes documented in each service's Swagger (reached through the
 * gateway). The frontend is a separate deployable, so it keeps its own copy
 * of the contract instead of importing server code.
 */

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  correlationId?: string;
}

// --- auth ---

export type Role = 'ADMIN' | 'MANAGER' | 'STAFF';

export type Permission =
  | 'users:manage'
  | 'products:read'
  | 'products:write'
  | 'warehouses:read'
  | 'warehouses:write'
  | 'inventory:read'
  | 'inventory:adjust'
  | 'inventory:transfer'
  | 'orders:read'
  | 'orders:create'
  | 'orders:cancel'
  | 'notifications:read';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: User;
}

// --- products ---

export interface Category {
  id: string;
  name: string;
  description: string | null;
}

export type ProductUnit = 'pcs' | 'box' | 'pack' | 'kg' | 'l' | 'm';
export const PRODUCT_UNITS: ProductUnit[] = [
  'pcs',
  'box',
  'pack',
  'kg',
  'l',
  'm',
];

export type ProductAttributes = Record<string, string | number | boolean>;

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  unit: ProductUnit;
  attributes: ProductAttributes;
  category: { id: string; name: string } | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  sku: string;
  name: string;
  description?: string | null;
  price: number;
  unit: ProductUnit;
  attributes?: ProductAttributes;
  categoryId?: string | null;
  isActive?: boolean;
}

// --- warehouses ---

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address: string | null;
  city: string;
  country: string;
  isActive: boolean;
}

export interface WarehouseInput {
  code: string;
  name: string;
  address?: string | null;
  city: string;
  country: string;
  isActive?: boolean;
}

export interface StorageLocation {
  id: string;
  warehouseId: string;
  code: string;
  description: string | null;
}

// --- inventory ---

export interface StockItem {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  lowStock: boolean;
  updatedAt: string;
}

export type MovementType = 'IN' | 'OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT';

export interface StockMovement {
  id: string;
  productId: string;
  warehouseId: string;
  type: MovementType;
  quantity: number;
  quantityAfter: number;
  transferId: string | null;
  reference: string | null;
  note: string | null;
  performedBy: string | null;
  createdAt: string;
}

export interface AdjustStockInput {
  productId: string;
  warehouseId: string;
  quantity: number;
  reference?: string;
  note?: string;
}

export interface TransferStockInput {
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  reference?: string;
  note?: string;
}

// --- orders ---

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export interface OrderItem {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  warehouseId: string;
  status: OrderStatus;
  totalAmount: number;
  note: string | null;
  cancellationReason: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface CreateOrderInput {
  warehouseId: string;
  items: Array<{ productId: string; quantity: number }>;
  note?: string;
}

// --- notifications ---

export type NotificationType =
  'ORDER_CONFIRMED' | 'ORDER_CANCELLED' | 'LOW_STOCK';

export interface Notification {
  id: string;
  type: NotificationType;
  recipient: string;
  subject: string;
  body: string;
  createdAt: string;
}
