import { AlertTriangle, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableRow } from '@/components/ui/table';
import { errorMessage } from '@/lib/api/errors';

/** Placeholder rows shown while a table's first page is loading. */
export function LoadingRows({
  columns,
  rows = 5,
}: {
  columns: number;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <TableRow key={row} aria-hidden>
          {Array.from({ length: columns }, (_, column) => (
            <TableCell key={column}>
              <Skeleton className="h-4 w-full max-w-40" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 px-6 py-10 text-center"
    >
      <AlertTriangle className="size-8 text-destructive" aria-hidden />
      <div>
        <p className="text-sm font-medium">Could not load this data</p>
        <p className="text-sm text-muted-foreground">{errorMessage(error)}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <Inbox className="size-8 text-muted-foreground" aria-hidden />
      <div>
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/**
 * The body of every data table: skeleton rows while loading, an error with a
 * retry button, an empty message, or the rows. Keeps the three non-happy
 * states consistent across screens.
 */
export function TableStates<T>({
  query,
  columns,
  empty,
  children,
}: {
  query: {
    isPending: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => unknown;
    data?: { data: T[] };
  };
  columns: number;
  empty: React.ReactNode;
  children: (rows: T[]) => React.ReactNode;
}) {
  if (query.isPending) return <LoadingRows columns={columns} />;
  if (query.isError) {
    return (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={columns}>
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        </TableCell>
      </TableRow>
    );
  }
  const rows = query.data?.data ?? [];
  if (rows.length === 0) {
    return (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={columns}>{empty}</TableCell>
      </TableRow>
    );
  }
  return <>{children(rows)}</>;
}
