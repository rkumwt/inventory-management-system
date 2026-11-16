import { CreateReservationsAndMessaging1731900000000 } from './1731900000000-create-reservations-and-messaging';
import { CreateStockItemsAndMovements1731800000000 } from './1731800000000-create-stock-items-and-movements';

/**
 * Migrations are listed explicitly (not loaded by glob) so they survive
 * bundling. Add new ones to the end of this array.
 */
export const migrations = [
  CreateStockItemsAndMovements1731800000000,
  CreateReservationsAndMessaging1731900000000,
];
