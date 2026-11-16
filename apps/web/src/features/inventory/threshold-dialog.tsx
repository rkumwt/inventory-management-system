'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { errorMessage } from '@/lib/api/errors';
import type { StockItem } from '@/lib/api/types';
import { useSetThreshold } from './api';

export function ThresholdDialog({
  item,
  label,
  onClose,
}: {
  item: StockItem | null;
  label: string;
  onClose: () => void;
}) {
  const setThreshold = useSetThreshold();
  const [value, setValue] = useState('');

  useEffect(() => {
    if (item) setValue(String(item.lowStockThreshold));
  }, [item]);

  if (!item) return null;
  const valid = /^\d{1,7}$/.test(value.trim());

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader
          title="Low-stock threshold"
          description={`${label} is flagged as low when its available quantity is at or below this number.`}
        />
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!valid) return;
            setThreshold.mutate(
              { id: item.id, threshold: Number(value) },
              {
                onSuccess: () => {
                  toast.success('Threshold updated');
                  onClose();
                },
                onError: (error) => toast.error(errorMessage(error)),
              },
            );
          }}
        >
          <Field
            label="Threshold"
            htmlFor="threshold"
            error={valid ? undefined : 'Enter a whole number, zero or more'}
          >
            <Input
              id="threshold"
              inputMode="numeric"
              value={value}
              aria-invalid={!valid}
              onChange={(event) => setValue(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || setThreshold.isPending}>
              {setThreshold.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
