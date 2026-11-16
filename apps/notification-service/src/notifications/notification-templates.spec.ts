import { createEvent, EventName } from '@ims/events';
import { buildEmail } from './notification-templates';
import { NotificationType } from './notification.entity';

const settings = { lowStockAlertEmail: 'alerts@ims.local' };

describe('buildEmail', () => {
  it('tells the person who placed the order that it is confirmed', () => {
    const email = buildEmail(
      createEvent(
        EventName.OrderConfirmed,
        {
          orderId: 'o1',
          orderNumber: 'ORD-1',
          totalAmount: 106.5,
          createdBy: 'u1',
          createdByEmail: 'staff@ims.local',
        },
        'corr',
      ),
      settings,
    );

    expect(email).toEqual({
      type: NotificationType.OrderConfirmed,
      recipient: 'staff@ims.local',
      subject: 'Order ORD-1 confirmed',
      body: 'Stock has been reserved for order ORD-1. Order total: 106.50.',
    });
  });

  it('tells them why an order was cancelled', () => {
    const email = buildEmail(
      createEvent(
        EventName.OrderCancelled,
        {
          orderId: 'o1',
          orderNumber: 'ORD-1',
          warehouseId: 'w1',
          reason: 'Insufficient stock (SAW-185: requested 5, available 3)',
          createdBy: 'u1',
          createdByEmail: 'staff@ims.local',
        },
        'corr',
      ),
      settings,
    );

    expect(email.type).toBe(NotificationType.OrderCancelled);
    expect(email.recipient).toBe('staff@ims.local');
    expect(email.body).toContain('SAW-185: requested 5, available 3');
  });

  it('sends low-stock alerts to the configured address', () => {
    const email = buildEmail(
      createEvent(
        EventName.LowStockDetected,
        {
          productId: 'p1',
          warehouseId: 'w1',
          availableQuantity: 3,
          threshold: 10,
        },
        'corr',
      ),
      settings,
    );

    expect(email).toMatchObject({
      type: NotificationType.LowStock,
      recipient: 'alerts@ims.local',
      subject: 'Low stock: product p1',
    });
    expect(email.body).toContain('down to 3 available (threshold 10)');
  });
});
