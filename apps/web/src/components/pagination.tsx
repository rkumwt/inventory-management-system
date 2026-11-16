import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PaginationMeta } from '@/lib/api/types';
import { formatNumber } from '@/lib/format';

export function Pagination({
  meta,
  onPageChange,
}: {
  meta?: PaginationMeta;
  onPageChange: (page: number) => void;
}) {
  if (!meta || meta.total === 0) return null;
  return (
    <div className="flex items-center justify-between gap-4 border-t px-3 py-2.5 text-sm text-muted-foreground">
      <span>
        {formatNumber(meta.total)} {meta.total === 1 ? 'result' : 'results'}
        {meta.totalPages > 1
          ? ` · page ${meta.page} of ${meta.totalPages}`
          : ''}
      </span>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={!meta.hasPreviousPage}
          onClick={() => onPageChange(meta.page - 1)}
        >
          <ChevronLeft aria-hidden /> Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!meta.hasNextPage}
          onClick={() => onPageChange(meta.page + 1)}
        >
          Next <ChevronRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
