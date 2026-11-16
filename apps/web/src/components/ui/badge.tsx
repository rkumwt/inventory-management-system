import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'bg-muted text-muted-foreground',
        info: 'bg-primary/10 text-primary',
        success: 'bg-success/15 text-success',
        warning: 'bg-warning/20 text-[oklch(0.45_0.12_70)]',
        danger: 'bg-destructive/10 text-destructive',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export type BadgeVariant = NonNullable<
  VariantProps<typeof badgeVariants>['variant']
>;

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
