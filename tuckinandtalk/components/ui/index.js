/**
 * Barrel export for the Tuckin and Talk UI kit.
 *
 * Import either from here for brevity:
 *   import { Button, Card, toast } from '@/components/ui';
 * or directly from the file for the leanest client bundle:
 *   import { Button } from '@/components/ui/button.jsx';
 *
 * Direct imports are preferred in client components — a barrel can pull more
 * 'use client' modules across the server/client boundary than you need.
 */
export { Button, buttonVariants } from './button.jsx';
export { Input } from './input.jsx';
export { Textarea } from './textarea.jsx';
export { Label } from './label.jsx';
export { Field } from './field.jsx';
export { Badge, badgeVariants } from './badge.jsx';
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card.jsx';
export { Separator } from './separator.jsx';
export { Skeleton, SkeletonText, SkeletonCard } from './skeleton.jsx';
export { Spinner } from './spinner.jsx';
export { Alert, AlertTitle, AlertDescription } from './alert.jsx';

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './dialog.jsx';
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuRadioGroup,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from './dropdown-menu.jsx';
export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent } from './popover.jsx';
export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, Tip } from './tooltip.jsx';
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from './select.jsx';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs.jsx';
export { Switch } from './switch.jsx';
export { Checkbox } from './checkbox.jsx';
export { RadioGroup, RadioGroupItem } from './radio-group.jsx';

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from './table.jsx';
export { EmptyState } from './empty-state.jsx';
export { StatCard } from './stat-card.jsx';
export { DataState } from './data-state.jsx';

export { Toaster } from './toaster.jsx';
export { toast, useToast } from './use-toast.js';
