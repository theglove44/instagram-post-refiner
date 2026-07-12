import * as React from 'react';
import { cn } from '@/lib/utils.js';
import { Label } from '@/components/ui/label.jsx';

/**
 * Field — labelled form-control wrapper that wires up accessibility for you.
 *
 *   <Field label="Competitor handle" hint="Without the @" error={err}>
 *     <Input placeholder="roamrochdale" />
 *   </Field>
 *
 * Generates an id, points the <Label htmlFor> at the control, and links the
 * hint/error via aria-describedby. The single child control is cloned with the
 * id + aria wiring + aria-invalid when an error is present.
 */
function Field({ label, hint, error, required, className, id, children }) {
  const reactId = React.useId();
  const fieldId = id || reactId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const control = React.isValidElement(children)
    ? React.cloneElement(children, {
        id: children.props.id || fieldId,
        'aria-describedby': cn(children.props['aria-describedby'], describedBy) || undefined,
        'aria-invalid': error ? true : children.props['aria-invalid'],
      })
    : children;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <Label htmlFor={fieldId}>
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </Label>
      )}
      {control}
      {hint && !error && (
        <p id={hintId} className="text-xs text-fg-muted leading-relaxed">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-danger leading-relaxed">
          {error}
        </p>
      )}
    </div>
  );
}

export { Field };
