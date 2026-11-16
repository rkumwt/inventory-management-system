'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { EmptyState, TableStates } from '@/components/data-states';
import { PageHeader, Toolbar } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import type {
  Notification,
  NotificationType,
  Paginated,
} from '@/lib/api/types';
import { formatDateTime, humanize } from '@/lib/format';

const TYPE_BADGE: Record<NotificationType, BadgeVariant> = {
  ORDER_CONFIRMED: 'success',
  ORDER_CANCELLED: 'danger',
  LOW_STOCK: 'warning',
};

export function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState<NotificationType | ''>('');

  const notifications = useQuery({
    queryKey: ['notifications', { page, type }],
    queryFn: () =>
      api.get<Paginated<Notification>>('/notifications', {
        page,
        limit: 10,
        type: type || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Emails sent in response to events. They are mocked: recorded here, not delivered."
      />
      <Card>
        <Toolbar>
          <Select
            aria-label="Type"
            className="w-52"
            value={type}
            onChange={(event) => {
              setType(event.target.value as NotificationType | '');
              setPage(1);
            }}
          >
            <option value="">All types</option>
            <option value="ORDER_CONFIRMED">Order confirmed</option>
            <option value="ORDER_CANCELLED">Order cancelled</option>
            <option value="LOW_STOCK">Low stock</option>
          </Select>
        </Toolbar>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sent</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableStates
              query={notifications}
              columns={4}
              empty={
                <EmptyState
                  title="No notifications yet"
                  description="Confirm or cancel an order, or let an item run low."
                />
              }
            >
              {(rows) =>
                rows.map((notification) => (
                  <TableRow key={notification.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(notification.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={TYPE_BADGE[notification.type]}>
                        {humanize(notification.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>{notification.recipient}</TableCell>
                    <TableCell>
                      <p className="font-medium">{notification.subject}</p>
                      <p className="text-muted-foreground">
                        {notification.body}
                      </p>
                    </TableCell>
                  </TableRow>
                ))
              }
            </TableStates>
          </TableBody>
        </Table>
        <Pagination meta={notifications.data?.meta} onPageChange={setPage} />
      </Card>
    </>
  );
}
