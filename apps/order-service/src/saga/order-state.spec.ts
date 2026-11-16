import { generateOrderNumber } from '../orders/orders.service';
import {
  describeShortages,
  lineTotal,
  nextStatus,
  OrderStatus,
  orderTotal,
  OrderTrigger,
  statusesAccepting,
} from './order-state';

const { Pending, Confirmed, Cancelled } = OrderStatus;
const { StockReserved, StockReservationFailed, CancelRequested } = OrderTrigger;

describe('order state machine', () => {
  it.each([
    [Pending, StockReserved, Confirmed],
    [Pending, StockReservationFailed, Cancelled],
    [Pending, CancelRequested, Cancelled],
    [Confirmed, CancelRequested, Cancelled],
  ])('%s + %s -> %s', (from, trigger, to) => {
    expect(nextStatus(from, trigger)).toBe(to);
  });

  it.each([
    // A late or duplicate reply must not move an order that has moved on.
    [Confirmed, StockReserved],
    [Confirmed, StockReservationFailed],
    [Cancelled, StockReserved],
    [Cancelled, StockReservationFailed],
    // Cancelled is final.
    [Cancelled, CancelRequested],
  ])('%s ignores %s', (from, trigger) => {
    expect(nextStatus(from, trigger)).toBeUndefined();
  });

  it('knows which statuses each trigger applies to', () => {
    expect(statusesAccepting(StockReserved)).toEqual([Pending]);
    expect(statusesAccepting(StockReservationFailed)).toEqual([Pending]);
    expect(statusesAccepting(CancelRequested)).toEqual([Pending, Confirmed]);
  });

  it('sends every accepting status to the same next status', () => {
    // transition() relies on this to use a single UPDATE per trigger.
    for (const trigger of Object.values(OrderTrigger)) {
      const targets = new Set(
        statusesAccepting(trigger).map((status) => nextStatus(status, trigger)),
      );
      expect(targets.size).toBe(1);
    }
  });
});

describe('order totals', () => {
  it('multiplies and adds in cents, without floating-point drift', () => {
    // 0.1 * 3 is 0.30000000000000004 in floating point.
    expect(lineTotal({ quantity: 3, unitPrice: 0.1 })).toBe(0.3);
    expect(
      orderTotal([
        { quantity: 3, unitPrice: 18.75 },
        { quantity: 2, unitPrice: 24.99 },
        { quantity: 7, unitPrice: 0.1 },
      ]),
    ).toBe(106.93);
  });

  it('is zero for no lines', () => {
    expect(orderTotal([])).toBe(0);
  });
});

describe('describeShortages', () => {
  it('names products by SKU where it knows them', () => {
    const reason = describeShortages(
      [
        { productId: 'p1', requested: 5, available: 3 },
        { productId: 'p2', requested: 1, available: 0 },
      ],
      new Map([['p1', 'SAW-185']]),
    );

    expect(reason).toBe(
      'Insufficient stock (SAW-185: requested 5, available 3; p2: requested 1, available 0)',
    );
  });
});

describe('generateOrderNumber', () => {
  it('combines the date with a random, unambiguous suffix', () => {
    const number = generateOrderNumber(new Date('2026-11-16T10:00:00Z'));

    expect(number).toMatch(/^ORD-20261116-[A-HJ-NP-Z2-9]{6}$/);
    expect(generateOrderNumber()).not.toBe(generateOrderNumber());
  });
});
