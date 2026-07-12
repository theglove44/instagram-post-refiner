'use client';

/**
 * use-toast — a tiny global toast store (the shadcn pattern), framework-free.
 *
 * Call the imperative `toast(...)` from anywhere (event handlers, fetch
 * callbacks) — no context/provider needed for dispatch. Render <Toaster /> once
 * (already wired into the (app) layout) to display them.
 *
 *   import { toast } from '@/components/ui/use-toast.js';
 *   toast({ title: 'Synced', description: '12 posts updated', variant: 'success' });
 *   const t = toast({ title: 'Uploading…' });
 *   t.update({ title: 'Done', variant: 'success' }); t.dismiss();
 */
import * as React from 'react';

const LIMIT = 3;
const REMOVE_DELAY = 5000;

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return String(count);
}

let memoryState = { toasts: [] };
const listeners = new Set();
const timeouts = new Map();

function emit() {
  for (const l of listeners) l(memoryState);
}

function scheduleRemove(id, duration = REMOVE_DELAY) {
  if (timeouts.has(id)) return;
  const t = setTimeout(() => {
    timeouts.delete(id);
    memoryState = { toasts: memoryState.toasts.filter((x) => x.id !== id) };
    emit();
  }, duration);
  timeouts.set(id, t);
}

function dismiss(id) {
  memoryState = {
    toasts: memoryState.toasts.map((x) =>
      id === undefined || x.id === id ? { ...x, open: false } : x
    ),
  };
  emit();
}

export function toast({ duration = REMOVE_DELAY, ...props }) {
  const id = genId();

  const update = (next) => {
    memoryState = {
      toasts: memoryState.toasts.map((x) => (x.id === id ? { ...x, ...next } : x)),
    };
    emit();
  };

  memoryState = {
    toasts: [
      {
        ...props,
        id,
        open: true,
        duration,
        onOpenChange: (open) => {
          if (!open) {
            dismiss(id);
            scheduleRemove(id, 180); // allow exit animation, then purge
          }
        },
      },
      ...memoryState.toasts,
    ].slice(0, LIMIT),
  };
  emit();

  return { id, update, dismiss: () => dismiss(id) };
}

/** Variant shortcuts. */
toast.success = (p) => toast({ ...p, variant: 'success' });
toast.error = (p) => toast({ ...p, variant: 'error' });
toast.warning = (p) => toast({ ...p, variant: 'warning' });

export function useToast() {
  const [state, setState] = React.useState(memoryState);
  React.useEffect(() => {
    listeners.add(setState);
    return () => listeners.delete(setState);
  }, []);
  return { ...state, toast, dismiss };
}
