import * as React from 'react';
import { cn } from '@/lib/utils.js';

/**
 * Table — styled wrappers over native table elements. Semantic and responsive
 * (horizontal scroll on overflow). Use TableNumeric for right-aligned mono
 * figures, matching the .td-mono convention.
 *
 *   <Table>
 *     <TableHeader><TableRow>
 *       <TableHead>Handle</TableHead><TableHead numeric>Followers</TableHead>
 *     </TableRow></TableHeader>
 *     <TableBody>{rows.map(r => <TableRow key={r.id}>…</TableRow>)}</TableBody>
 *   </Table>
 */
const Table = React.forwardRef(function Table({ className, containerClassName, ...props }, ref) {
  return (
    <div className={cn('w-full overflow-x-auto rounded-[var(--radius-md)] border border-border', containerClassName)}>
      <table ref={ref} className={cn('w-full border-collapse text-sm', className)} {...props} />
    </div>
  );
});

const TableHeader = React.forwardRef(function TableHeader({ className, ...props }, ref) {
  return <thead ref={ref} className={cn('[&_tr]:border-b [&_tr]:border-border', className)} {...props} />;
});

const TableBody = React.forwardRef(function TableBody({ className, ...props }, ref) {
  return <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
});

const TableFooter = React.forwardRef(function TableFooter({ className, ...props }, ref) {
  return (
    <tfoot ref={ref} className={cn('border-t border-border bg-card font-medium', className)} {...props} />
  );
});

const TableRow = React.forwardRef(function TableRow({ className, ...props }, ref) {
  return (
    <tr
      ref={ref}
      className={cn(
        'border-b border-border transition-colors hover:bg-card-hover data-[state=selected]:bg-card-hover',
        className
      )}
      {...props}
    />
  );
});

const TableHead = React.forwardRef(function TableHead({ className, numeric, ...props }, ref) {
  return (
    <th
      ref={ref}
      scope="col"
      className={cn(
        'whitespace-nowrap bg-card px-4 py-2.5 text-[0.7rem] font-medium uppercase tracking-[0.06em] text-fg-muted',
        numeric ? 'text-right' : 'text-left',
        className
      )}
      {...props}
    />
  );
});

const TableCell = React.forwardRef(function TableCell({ className, numeric, muted, ...props }, ref) {
  return (
    <td
      ref={ref}
      className={cn(
        'px-4 py-3 align-middle text-fg',
        numeric && 'text-right font-mono text-[0.8rem] text-fg-number tabular-nums',
        muted && 'text-fg-muted text-[0.8rem]',
        className
      )}
      {...props}
    />
  );
});

const TableCaption = React.forwardRef(function TableCaption({ className, ...props }, ref) {
  return <caption ref={ref} className={cn('mt-3 text-xs text-fg-muted', className)} {...props} />;
});

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
};
