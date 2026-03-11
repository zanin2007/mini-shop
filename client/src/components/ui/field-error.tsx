import { type ComponentProps } from 'react';
import { cn } from '../../lib/utils';

function FieldError({ className, children, ...props }: ComponentProps<'p'>) {
  if (!children) return null;

  return (
    <p
      role="alert"
      className={cn('field-error', className)}
      {...props}
    >
      {children}
    </p>
  );
}

export { FieldError };
