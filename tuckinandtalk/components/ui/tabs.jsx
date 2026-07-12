'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils.js';

/**
 * Tabs — Radix tabs (arrow-key nav, roving tabindex, ARIA).
 *   <Tabs defaultValue="all">
 *     <TabsList><TabsTrigger value="all">All</TabsTrigger>…</TabsList>
 *     <TabsContent value="all">…</TabsContent>
 *   </Tabs>
 */
const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-border bg-card p-1',
        className
      )}
      {...props}
    />
  );
});

const TabsTrigger = React.forwardRef(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium text-fg-secondary',
        'transition-colors outline-none cursor-pointer',
        'hover:text-fg',
        'focus-visible:ring-2 focus-visible:ring-terra/60',
        'disabled:pointer-events-none disabled:opacity-50',
        'data-[state=active]:bg-card-hover data-[state=active]:text-terra',
        className
      )}
      {...props}
    />
  );
});

const TabsContent = React.forwardRef(function TabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn('mt-4 outline-none focus-visible:ring-2 focus-visible:ring-terra/40 rounded-[var(--radius-sm)]', className)}
      {...props}
    />
  );
});

export { Tabs, TabsList, TabsTrigger, TabsContent };
