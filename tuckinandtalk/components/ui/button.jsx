import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils.js';

/**
 * Button — the primary interactive primitive.
 *
 * Variants mirror the existing .btn-* CSS classes but are token-driven so they
 * compose with utilities. Use `asChild` to render the styles onto a child
 * element (e.g. a Next <Link> or an <a>) without an extra wrapper:
 *
 *   <Button asChild><Link href="/posts">View posts</Link></Button>
 *
 * Pass `loading` to show an inline spinner and auto-disable.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium ' +
    'rounded-[var(--radius-sm)] border border-transparent cursor-pointer select-none ' +
    'transition-[background-color,border-color,opacity,color] duration-150 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra/60 ' +
    'focus-visible:ring-offset-2 focus-visible:ring-offset-bg ' +
    'disabled:opacity-50 disabled:pointer-events-none ' +
    "[&_svg]:shrink-0 [&_svg]:size-4",
  {
    variants: {
      variant: {
        primary: 'bg-terra text-white border-terra hover:bg-terra-hover hover:border-terra-hover',
        secondary:
          'bg-card text-fg border-border-light hover:bg-card-hover',
        outline:
          'bg-transparent text-fg-secondary border-border hover:bg-card hover:text-fg',
        ghost:
          'bg-transparent text-fg-secondary border-transparent hover:bg-card hover:text-fg',
        mustard:
          'bg-mustard text-bg border-mustard hover:bg-mustard-light hover:border-mustard-light',
        danger:
          'bg-transparent text-danger border-danger/40 hover:bg-danger-bg',
        link: 'bg-transparent text-terra border-transparent underline-offset-4 hover:underline hover:text-terra-hover p-0 h-auto',
      },
      size: {
        sm: 'h-8 px-2.5 text-[0.8rem]',
        default: 'h-9 px-4 text-sm',
        lg: 'h-11 px-6 text-base',
        icon: 'size-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

const Spinner = () => (
  <span
    aria-hidden="true"
    className="size-4 rounded-full border-2 border-current/30 border-t-current animate-spin"
  />
);

const Button = React.forwardRef(function Button(
  { className, variant, size, asChild = false, loading = false, disabled, children, ...props },
  ref
) {
  const Comp = asChild ? Slot : 'button';
  const isDisabled = disabled || loading;
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={Comp === 'button' ? isDisabled : undefined}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </Comp>
  );
});

export { Button, buttonVariants };
