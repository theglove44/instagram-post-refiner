'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils.js';

/**
 * Tooltip — Radix hover/focus hint. Wrap the app (or a subtree) once in
 * <TooltipProvider>, then use Tooltip/TooltipTrigger/TooltipContent.
 * For a single-use tooltip the provider is included via the `Tip` helper.
 */
const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef(function TooltipContent(
  { className, sideOffset = 5, ...props },
  ref
) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 max-w-xs rounded-[var(--radius-sm)] border border-border-light bg-bg px-2.5 py-1.5 text-xs text-fg shadow-[var(--shadow-elevated)]',
          'data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
});

/**
 * Tip — convenience wrapper: a self-contained tooltip with its own provider.
 *   <Tip content="Refreshed 48h after publish"><InfoIcon/></Tip>
 */
function Tip({ content, children, delayDuration = 200, ...props }) {
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent {...props}>{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, Tip };
