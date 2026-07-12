# Tuckin and Talk — UI Kit

A small, production-grade component system for the @tuckinandtalk analytics app.
Built on **Tailwind v4 + Radix UI** (the shadcn/ui pattern) and styled entirely
through the app's existing design tokens, so it matches the terracotta/cream
editorial look without a second palette to maintain.

## Architecture

```
components/ui/
  *.jsx              # one component family per file, owned & editable in-repo
  use-toast.js       # global toast store (imperative toast() + useToast hook)
  index.js           # barrel re-export
lib/utils.js         # cn() — clsx + tailwind-merge class composer
app/globals.css      # @theme inline maps :root tokens → Tailwind utilities
```

**Owned, not installed.** These are first-party source files (the shadcn
philosophy) — edit them directly instead of fighting a node_module's API.

**Token bridge — single source of truth.** Colours live once, in `:root` in
`globals.css`. `@theme inline` re-exposes them as Tailwind utilities
(`bg-card`, `text-fg-muted`, `border-border`, `text-terra`, `ring-terra`, …).
Radius/shadow are consumed as `rounded-[var(--radius-md)]` /
`shadow-[var(--shadow-card)]`. Change a swatch in one place; utilities, legacy
`.card`/`.btn` classes, and these components all move together.

**Layering.**
- *Primitives* — Button, Input, Textarea, Label, Badge, Card, Separator,
  Skeleton, Spinner, Alert.
- *Radix-backed* — Dialog, DropdownMenu, Popover, Tooltip, Select, Tabs, Switch,
  Checkbox, RadioGroup, Toast. Accessibility (focus trap, keyboard nav, ARIA
  roles, scroll lock) comes from Radix; we only skin it.
- *Composite / app-domain* — Field (labelled control + a11y wiring), Table,
  EmptyState, StatCard (KPI tile), DataState (loading/error/empty/ready),
  Toaster + `toast()`.

## API conventions

- **`className` always wins.** Every component merges incoming `className` last
  via `cn()`, so any utility overrides the defaults (`tailwind-merge` dedupes
  conflicts).
- **`forwardRef` everywhere** a DOM node is rendered — refs, focus management and
  Radix `asChild` composition all work.
- **`asChild`** (Button, Badge) renders styles onto your own element:
  `<Button asChild><Link href="/x">Go</Link></Button>`.
- **Variants via `cva`.** `variant` + `size` props are typed by the variant map;
  unknown values fall back to `defaultVariants`.
- **Controlled or uncontrolled.** Radix components accept `value`/`onValueChange`
  (or `checked`/`onCheckedChange`) and `defaultValue` alike.
- **Native props pass through.** `...props` is spread onto the underlying
  element, so `disabled`, `name`, `onClick`, `aria-*`, `type`, etc. just work.

## States & edge cases (handled for you)

| Concern | Where |
|---------|-------|
| Loading | `Button loading`, `Spinner`, `Skeleton`/`SkeletonText`/`SkeletonCard`, `StatCard loading`, `DataState` |
| Empty | `EmptyState`, `DataState empty` |
| Error | `Alert variant="error"`, `DataState error` + `onRetry` |
| Validation | `Input invalid` / `Field error` (wires `aria-invalid` + `aria-describedby`) |
| Async feedback | `toast()` / `toast.success()` / `toast.error()` |
| Disabled | every control honours `disabled` with consistent styling |
| Long content | Table scrolls x; Select/Dropdown portal + scroll; text truncates |

## Responsiveness & a11y

- Mobile-first: stacks on small screens, grids fill from ~180–300px tracks.
  Existing `.metrics-grid` / `.posts-grid` breakpoints still apply.
- Focus-visible rings on every interactive element (`ring-terra`), never removed
  without a replacement.
- Radix supplies roles/labels; remember a `DialogTitle` per dialog and an
  accessible name (`Label`/`Field`/`aria-label`) per control.
- Respects reduced-motion (animations come from `tw-animate-css`, gated by the
  user's OS preference).

## Usage

```jsx
'use client';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.jsx';
import { toast } from '@/components/ui/use-toast.js';

export function SyncCard() {
  return (
    <Card>
      <CardHeader><CardTitle>Insights</CardTitle></CardHeader>
      <CardContent>
        <Button onClick={() => toast.success({ title: 'Synced', description: '12 posts' })}>
          Fetch insights
        </Button>
      </CardContent>
    </Card>
  );
}
```

`<Toaster />` is mounted once in `app/(app)/layout.js`; `toast()` works from
anywhere with no provider. Live examples for every component are at **`/ui`**
(the in-app gallery, auth-gated like the rest of the app).

## Best practices

1. Prefer this kit over new inline styles; extend a component rather than forking
   markup. Legacy `.btn`/`.card` classes still work during migration.
2. Import direct paths in client components (`button.jsx`), the barrel in glue
   code. Don't import the barrel into a Server Component you want to stay static.
3. Add a swatch by adding one `--color-*: var(--token)` line in `@theme inline` —
   never hard-code hex in a component.
4. Keep Radix structure intact (Trigger/Content/Portal) — that's where the
   accessibility lives. Style, don't restructure.
5. Always give dialogs a `DialogTitle` and controls an accessible name.
```
