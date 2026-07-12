'use client';

import * as React from 'react';
import {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  toastIcons,
} from '@/components/ui/toast.jsx';
import { useToast } from '@/components/ui/use-toast.js';

/**
 * Toaster — renders queued toasts. Mount once near the root (it's in the
 * (app) layout). Toasts are pushed imperatively via `toast()` from use-toast.
 */
export function Toaster() {
  const { toasts } = useToast();
  return (
    <ToastProvider swipeDirection="right">
      {toasts.map(({ id, title, description, action, variant = 'default', icon = true, ...props }) => {
        const Icon = toastIcons[variant] || toastIcons.default;
        return (
          <Toast key={id} variant={variant} {...props}>
            {icon && <Icon className="size-4 mt-0.5 shrink-0" aria-hidden="true" />}
            <div className="grid flex-1 gap-0.5 pr-5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action && <ToastAction altText={action.altText || action.label} onClick={action.onClick}>{action.label}</ToastAction>}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
