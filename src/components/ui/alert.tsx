import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const alertVariants = cva('rounded-md', {
  variants: {
    variant: {
      error: 'border border-destructive/50 bg-destructive/10 text-destructive',
      success: 'border border-gain/50 bg-gain/10 text-gain',
    },
    size: {
      default: 'px-4 py-2 text-sm',
      sm: 'px-3 py-1.5 text-xs',
    },
  },
  defaultVariants: {
    variant: 'error',
    size: 'default',
  },
});

function Alert({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div data-slot="alert" className={cn(alertVariants({ variant, size, className }))} {...props} />
  );
}

export { Alert, alertVariants };
