import { getCorrelationId, Paginated, paginate, toSkip } from '@ims/common';
import { addToOutbox } from '@ims/database';
import { createEvent, EventName } from '@ims/events';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomBytes, randomUUID } from 'node:crypto';
import { DataSource, EntityManager, ILike, In } from 'typeorm';
import { CatalogClient } from '../catalog/catalog.client';
import {
  lineTotal,
  nextStatus,
  OrderStatus,
  orderTotal,
  OrderTrigger,
  statusesAccepting,
} from '../saga/order-state';
import { CreateOrderDto, OrderQueryDto } from './dto/order.dto';
import { Order, OrderItem } from './order.entity';

export interface Actor {
  userId: string;
  email: string;
  authorization: string;
}

const ORDER_NUMBER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I

export function generateOrderNumber(now = new Date()): string {
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Array.from(
    randomBytes(6),
    (byte) => ORDER_NUMBER_ALPHABET[byte % ORDER_NUMBER_ALPHABET.length],
  ).join('');
  return `ORD-${date}-${suffix}`;
}

/**
 * The request-driven half of the saga: placing and cancelling orders.
 * (The event-driven half is OrderSagaService.)
 *
 * Every state change writes the matching event to the outbox in the same
 * transaction, so the order and the announcement of it cannot disagree.
 */
@Injectable()
export class OrdersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly catalog: CatalogClient,
  ) {}

  async list(query: OrderQueryDto): Promise<Paginated<Order>> {
    const [rows, total] = await this.dataSource
      .getRepository(Order)
      .findAndCount({
        where: {
          ...(query.status && { status: query.status }),
          ...(query.warehouseId && { warehouseId: query.warehouseId }),
          ...(query.search && { orderNumber: ILike(`%${query.search}%`) }),
        },
        relations: { items: true },
        order: { createdAt: 'DESC', id: 'ASC' },
        skip: toSkip(query),
        take: query.limit,
      });
    return paginate(rows, total, query);
  }

  async getById(id: string, manager?: EntityManager): Promise<Order> {
    const order = await (manager ?? this.dataSource.manager).findOne(Order, {
      where: { id },
      relations: { items: true },
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  /**
   * Saga step 1. Looks up current product details (synchronously), then
   * saves the order as PENDING and records OrderCreated. The response does
   * not wait for stock: the client sees PENDING and the order becomes
   * CONFIRMED or CANCELLED moments later.
   */
  async create(dto: CreateOrderDto, actor: Actor): Promise<Order> {
    const [products] = await Promise.all([
      Promise.all(
        dto.items.map((item) =>
          this.catalog.getProduct(item.productId, actor.authorization),
        ),
      ),
      this.catalog.assertWarehouseUsable(dto.warehouseId, actor.authorization),
    ]);

    const lines = dto.items.map((item, index) => {
      const product = products[index] as (typeof products)[number];
      return {
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
      };
    });
    const totalAmount = orderTotal(lines);

    return this.dataSource.transaction(async (manager) => {
      const order = await manager.save(
        manager.create(Order, {
          orderNumber: generateOrderNumber(),
          warehouseId: dto.warehouseId,
          status: OrderStatus.Pending,
          totalAmount,
          note: dto.note ?? null,
          cancellationReason: null,
          createdBy: actor.userId,
          createdByEmail: actor.email,
        }),
      );
      await manager.save(
        lines.map((line) =>
          manager.create(OrderItem, {
            ...line,
            orderId: order.id,
            lineTotal: lineTotal(line),
          }),
        ),
      );

      await addToOutbox(
        manager,
        createEvent(
          EventName.OrderCreated,
          {
            orderId: order.id,
            orderNumber: order.orderNumber,
            warehouseId: order.warehouseId,
            items: lines.map(({ productId, sku, quantity, unitPrice }) => ({
              productId,
              sku,
              quantity,
              unitPrice,
            })),
            totalAmount,
            createdBy: order.createdBy,
            createdByEmail: order.createdByEmail,
          },
          getCorrelationId() ?? randomUUID(),
        ),
      );
      return this.getById(order.id, manager);
    });
  }

  /**
   * Cancels a PENDING or CONFIRMED order and records OrderCancelled, which
   * tells inventory-service to release the reservation (compensation).
   */
  async cancel(id: string, reason: string | undefined): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.getById(id, manager);
      const cancellationReason = reason?.trim() || 'Cancelled by user';

      const moved = await transition(
        manager,
        id,
        OrderTrigger.CancelRequested,
        { cancellationReason },
      );
      if (!moved) {
        throw new ConflictException({
          error: 'ORDER_NOT_CANCELLABLE',
          message: `Order ${order.orderNumber} is already ${order.status}`,
        });
      }

      await addToOutbox(
        manager,
        createEvent(
          EventName.OrderCancelled,
          {
            orderId: order.id,
            orderNumber: order.orderNumber,
            warehouseId: order.warehouseId,
            reason: cancellationReason,
            createdBy: order.createdBy,
            createdByEmail: order.createdByEmail,
          },
          getCorrelationId() ?? randomUUID(),
        ),
      );
      return this.getById(id, manager);
    });
  }
}

/**
 * Applies a state-machine trigger with a single conditional UPDATE:
 *
 *   UPDATE orders SET status = <next> WHERE id = ? AND status IN (<from>)
 *
 * The WHERE clause is the concurrency control. If a cancel request and a
 * StockReserved event race, exactly one UPDATE matches the PENDING row; the
 * other matches nothing and returns false.
 */
export async function transition(
  manager: EntityManager,
  orderId: string,
  trigger: OrderTrigger,
  extra: Partial<Pick<Order, 'cancellationReason'>> = {},
): Promise<boolean> {
  const from = statusesAccepting(trigger);
  // Every status that accepts a given trigger leads to the same next status.
  const to = nextStatus(from[0] as OrderStatus, trigger) as OrderStatus;

  const result = await manager.update(
    Order,
    { id: orderId, status: In(from) },
    { status: to, ...extra },
  );
  return result.affected === 1;
}
