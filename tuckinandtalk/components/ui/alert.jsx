import * as React from 'react';
import { cva } from 'class-variance-authority';
import { Info, CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils.js';

/**
 * Alert — inline notice banner. Variants carry an icon + role for a11y
 * (error/warning use role="alert"; info/success use role="status").
 * Pass `onClose` to render a dismiss button. Compose AlertTitle + free text.
 */
const alertVariants = cva(
  'relative flex items-start gap-2.5 rounded-[var(--radius-sm)] border px-4 py-3 text-sm',
  {
    variants: {
      variant: {
        info: 'bg-info-bg border-info/30 text-info',
        success: 'bg-success-bg border-success/30 text-success',
        warning: 'bg-warning-bg border-warning/30 text-warning',
        error: 'bg-danger-bg border-danger/30 text-danger',
      },
    },
    defaultVariants: { variant: 'info' },
  }
);

const icons = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle };
const roles = { info: 'status', success: 'status', warning: 'alert', error: 'alert' };

const Alert = React.forwardRef(function Alert(
  { className, variant = 'info', icon = true, onClose, children, ...props },
  ref
) {
  const Icon = icons[variant];
  return (
    <div ref={ref} role={roles[variant]} className={cn(alertVariants({ variant }), className)} {...props}>
      {icon && <Icon className="size-4 mt-0.5 shrink-0" aria-hidden="true" />}
      <div className="min-w-0 flex-1">{children}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="shrink-0 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
});

const AlertTitle = React.forwardRef(function AlertTitle({ className, ...props }, ref) {
  return <p ref={ref} className={cn('font-medium mb-0.5', className)} {...props} />;
});

const AlertDescription = React.forwardRef(function AlertDescription({ className, ...props }, ref) {
  return <div ref={ref} className={cn('text-sm opacity-90 leading-relaxed', className)} {...props} />;
});

export { Alert, AlertTitle, AlertDescription };
