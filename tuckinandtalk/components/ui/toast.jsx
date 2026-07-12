'use client';

import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { cva } from 'class-variance-authority';
import { X, Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils.js';

const ToastProvider = ToastPrimitive.Provider;

const ToastViewport = React.forwardRef(function ToastViewport({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Viewport
      ref={ref}
      className={cn(
        'fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-sm',
        className
      )}
      {...props}
    />
  );
});

const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-[var(--radius-md)] border p-4 shadow-[var(--shadow-elevated)] ' +
    'data-[state=open]:animate-in data-[state=open]:slide-in-from-right-full data-[state=open]:fade-in-0 ' +
    'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-full data-[state=closed]:fade-out-0 ' +
    'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform',
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-fg',
        success: 'border-success/40 bg-success-bg text-success',
        warning: 'border-warning/40 bg-warning-bg text-warning',
        error: 'border-danger/40 bg-danger-bg text-danger',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

const Toast = React.forwardRef(function Toast({ className, variant, ...props }, ref) {
  return <ToastPrimitive.Root ref={ref} className={cn(toastVariants({ variant }), className)} {...props} />;
});

const ToastAction = React.forwardRef(function ToastAction({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Action
      ref={ref}
      className={cn(
        'inline-flex h-7 shrink-0 items-center rounded-[var(--radius-sm)] border border-current/30 bg-transparent px-2.5 text-xs font-medium',
        'transition-colors hover:bg-current/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/50',
        className
      )}
      {...props}
    />
  );
});

const ToastClose = React.forwardRef(function ToastClose({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Close
      ref={ref}
      toast-close=""
      className={cn(
        'absolute right-2 top-2 rounded-sm p-0.5 opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/50',
        className
      )}
      {...props}
    >
      <X className="size-4" />
    </ToastPrimitive.Close>
  );
});

const ToastTitle = React.forwardRef(function ToastTitle({ className, ...props }, ref) {
  return <ToastPrimitive.Title ref={ref} className={cn('text-sm font-semibold', className)} {...props} />;
});

const ToastDescription = React.forwardRef(function ToastDescription({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Description ref={ref} className={cn('text-sm opacity-90', className)} {...props} />
  );
});

const toastIcons = { default: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle };

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastAction,
  ToastClose,
  ToastTitle,
  ToastDescription,
  toastIcons,
};
