import { configureHttpApp, permissionsForRole, Role } from '@ims/common';
import { ensureTestDatabase } from '@ims/database';
import { createEvent, EventName } from '@ims/events';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { EMAIL_SENDER } from '../src/notifications/email-sender';
import type { Email } from '../src/notifications/notification-templates';
import { NotificationsService } from '../src/notifications/notifications.service';

/** Stands in for the email provider. */
const mailbox = {
  sent: [] as Email[],
  failing: false,
  send: jest.fn(async (email: Email) => {
    if (mailbox.failing) throw new Error('provider down');
    mailbox.sent.push(email);
  }),
};

const orderConfirmed = () =>
  createEvent(
    EventName.OrderConfirmed,
    {
      orderId: '00000000-0000-4000-8000-000000000001',
      orderNumber: 'ORD-20261116-ABC234',
      totalAmount: 106.23,
      createdBy: '00000000-0000-4000-8000-000000000002',
      createdByEmail: 'staff@ims.local',
    },
    'corr-notify',
  );

/**
 * Boots the real AppModule against a real PostgreSQL database. Events are
 * handed to the service directly (no broker) and emails go to a fake sender.
 */
describe('notification-service (integration)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let dataSource: DataSource;
  let notifications: NotificationsService;

  const tokenFor = (role: Role) =>
    `Bearer ${app.get(JwtService).sign({
      sub: '00000000-0000-4000-8000-000000000009',
      email: `${role.toLowerCase()}@ims.local`,
      role,
      permissions: permissionsForRole(role),
    })}`;

  const stored = async () =>
    (
      await dataSource.query('SELECT count(*)::int AS count FROM notifications')
    )[0].count as number;

  beforeAll(async () => {
    await ensureTestDatabase();
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EMAIL_SENDER)
      .useValue(mailbox)
      .compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    configureHttpApp(app, { serviceName: 'notification-service' });
    await app.init();

    dataSource = app.get(DataSource);
    notifications = app.get(NotificationsService);
    http = request(app.getHttpServer());
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE notifications, processed_events');
    mailbox.sent = [];
    mailbox.failing = false;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('reports healthy when the database is reachable', async () => {
    await http.get('/health').expect(200);
  });

  it('sends an email for an event and keeps a record of it', async () => {
    await notifications.notify(orderConfirmed());

    expect(mailbox.sent).toEqual([
      expect.objectContaining({
        recipient: 'staff@ims.local',
        subject: 'Order ORD-20261116-ABC234 confirmed',
      }),
    ]);
    const [row] = await dataSource.query(
      'SELECT type, recipient, correlation_id FROM notifications',
    );
    expect(row).toEqual({
      type: 'ORDER_CONFIRMED',
      recipient: 'staff@ims.local',
      correlation_id: 'corr-notify',
    });
  });

  it('is idempotent: a redelivered event does not send a second email', async () => {
    const event = orderConfirmed();

    await notifications.notify(event);
    await notifications.notify(event);

    expect(mailbox.sent).toHaveLength(1);
    expect(await stored()).toBe(1);
  });

  it('records nothing when sending fails, so the redelivery can try again', async () => {
    const event = orderConfirmed();
    mailbox.failing = true;

    await expect(notifications.notify(event)).rejects.toThrow('provider down');
    expect(await stored()).toBe(0);

    mailbox.failing = false;
    await notifications.notify(event);
    expect(mailbox.sent).toHaveLength(1);
    expect(await stored()).toBe(1);
  });

  it('sends low-stock alerts to the configured address', async () => {
    await notifications.notify(
      createEvent(
        EventName.LowStockDetected,
        {
          productId: '00000000-0000-4000-8000-000000000003',
          warehouseId: '00000000-0000-4000-8000-000000000004',
          availableQuantity: 3,
          threshold: 10,
        },
        'corr-low',
      ),
    );

    expect(mailbox.sent[0]?.recipient).toBe('inventory-alerts@ims.local');
  });

  it('lists sent notifications to managers, not to staff', async () => {
    await notifications.notify(orderConfirmed());

    const response = await http
      .get('/notifications?type=ORDER_CONFIRMED')
      .set('Authorization', tokenFor(Role.Manager))
      .expect(200);
    expect(response.body.meta.total).toBe(1);
    expect(response.body.data[0]).toMatchObject({
      type: 'ORDER_CONFIRMED',
      recipient: 'staff@ims.local',
    });

    await http.get('/notifications').expect(401);
    await http
      .get('/notifications')
      .set('Authorization', tokenFor(Role.Staff))
      .expect(403);
  });
});
