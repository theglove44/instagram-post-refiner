'use client';

/**
 * /ui — living style guide. Renders every component in the kit with its common
 * states so the design system can be eyeballed in one place (and serves as
 * copy-paste usage examples). Auth-gated like the rest of the (app) group.
 */
import { useState } from 'react';
import {
  Inbox,
  RefreshCw,
  Settings,
  Trash2,
  Hash,
  Users,
  TrendingUp,
} from 'lucide-react';

import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton.jsx';
import { Spinner } from '@/components/ui/spinner.jsx';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert.jsx';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog.jsx';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu.jsx';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover.jsx';
import { Tip } from '@/components/ui/tooltip.jsx';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select.jsx';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Label } from '@/components/ui/label.jsx';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group.jsx';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table.jsx';
import { EmptyState } from '@/components/ui/empty-state.jsx';
import { StatCard } from '@/components/ui/stat-card.jsx';
import { DataState } from '@/components/ui/data-state.jsx';
import { toast } from '@/components/ui/use-toast.js';

function Demo({ title, children }) {
  return (
    <section className="mb-2">
      <Separator label={title} />
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  );
}

const competitors = [
  { handle: 'roamrochdale', followers: 531, er: '7.25%' },
  { handle: 'themrskathsymes', followers: 46069, er: '0.42%' },
];

export default function UiGalleryPage() {
  const [tab, setTab] = useState('all');
  const [sort, setSort] = useState('reach');
  const [checked, setChecked] = useState(true);
  const [radio, setRadio] = useState('feed');
  const [loading, setLoading] = useState(false);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>UI Kit</h1>
        <p>Living style guide — every component, its variants and states.</p>
      </div>

      <Demo title="Buttons">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="mustard">Mustard</Button>
        <Button variant="danger">
          <Trash2 /> Danger
        </Button>
        <Button variant="link">Link</Button>
        <Button loading>Saving</Button>
        <Button disabled>Disabled</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
        <Button size="icon" aria-label="Settings">
          <Settings />
        </Button>
      </Demo>

      <Demo title="Badges">
        <Badge>Neutral</Badge>
        <Badge variant="terra">Terra</Badge>
        <Badge variant="mustard">Mustard</Badge>
        <Badge variant="success" dot>
          Live
        </Badge>
        <Badge variant="warning">Expiring</Badge>
        <Badge variant="danger">Expired</Badge>
        <Badge variant="info">Info</Badge>
        <Badge variant="outline">Outline</Badge>
      </Demo>

      <Demo title="Stat cards">
        <div className="metrics-grid w-full">
          <StatCard label="Followers" value="12,840" trend={4.2} trendLabel="vs last week" icon={<Users />} />
          <StatCard label="Reach (7d)" value="48,210" accent="terra" trend={-2.1} icon={<TrendingUp />} />
          <StatCard label="Saves" value="1,902" accent="mustard" sub="median 38 / post" />
          <StatCard label="Reach" loading />
        </div>
      </Demo>

      <Demo title="Inputs & forms">
        <div className="w-full max-w-md flex flex-col gap-4">
          <Field label="Competitor handle" hint="Without the @">
            <Input placeholder="roamrochdale" />
          </Field>
          <Field label="Notes">
            <Textarea placeholder="Why are we tracking them?" />
          </Field>
          <Field label="Hashtag" error="Already at the 30-tag weekly cap.">
            <Input defaultValue="#rochdale" invalid />
          </Field>
          <div className="flex items-center gap-2">
            <Checkbox id="c1" checked={checked} onCheckedChange={setChecked} />
            <Label htmlFor="c1">Include Reels</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="s1" defaultChecked />
            <Label htmlFor="s1">Nightly sync</Label>
          </div>
          <RadioGroup value={radio} onValueChange={setRadio} className="flex gap-4">
            {['feed', 'reels', 'all'].map((v) => (
              <div key={v} className="flex items-center gap-2">
                <RadioGroupItem value={v} id={`r-${v}`} />
                <Label htmlFor={`r-${v}`}>{v}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      </Demo>

      <Demo title="Select & Tabs">
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Sort by…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="reach">Reach</SelectItem>
            <SelectItem value="saves">Saves</SelectItem>
            <SelectItem value="follows">Follows</SelectItem>
            <SelectItem value="skip">Skip rate</SelectItem>
          </SelectContent>
        </Select>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="reels">Reels</TabsTrigger>
            <TabsTrigger value="posts">Posts</TabsTrigger>
          </TabsList>
          <TabsContent value="all">Showing everything.</TabsContent>
          <TabsContent value="reels">Reels only.</TabsContent>
          <TabsContent value="posts">Feed posts only.</TabsContent>
        </Tabs>
      </Demo>

      <Demo title="Overlays">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="danger">
              <Trash2 /> Disconnect
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Disconnect account?</DialogTitle>
              <DialogDescription>
                This removes the stored Instagram token. Analytics stop syncing until you reconnect.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button variant="danger">Disconnect</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary">Actions</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Post</DropdownMenuLabel>
            <DropdownMenuItem>
              <RefreshCw /> Refresh insights
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Hash /> Audit hashtags
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="danger">
              <Trash2 /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">Filters</Button>
          </PopoverTrigger>
          <PopoverContent>
            <div className="flex flex-col gap-3">
              <p className="text-sm text-fg-secondary">Filter the feed.</p>
              <Field label="Min reach">
                <Input type="number" placeholder="0" />
              </Field>
            </div>
          </PopoverContent>
        </Popover>

        <Tip content="Insights are fetched 48h after publish.">
          <Button variant="ghost">Hover me</Button>
        </Tip>
      </Demo>

      <Demo title="Toasts">
        <Button onClick={() => toast.success({ title: 'Synced', description: '12 posts updated.' })}>
          Success
        </Button>
        <Button variant="secondary" onClick={() => toast.error({ title: 'Sync failed', description: 'Token expired.' })}>
          Error
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast({
              title: 'Heads up',
              description: 'You are near the hashtag cap.',
              variant: 'warning',
              action: { label: 'View', onClick: () => {} },
            })
          }
        >
          With action
        </Button>
      </Demo>

      <Demo title="Alerts">
        <div className="w-full flex flex-col gap-3">
          <Alert variant="info">
            <AlertTitle>Connected</AlertTitle>
            <AlertDescription>Token valid for 58 more days.</AlertDescription>
          </Alert>
          <Alert variant="success">Synced 12 posts (0 errors).</Alert>
          <Alert variant="warning" onClose={() => {}}>
            Approaching the 30-tag weekly hashtag cap.
          </Alert>
          <Alert variant="error">
            <AlertTitle>Sync failed</AlertTitle>
            <AlertDescription>(#100) The parameter username is required.</AlertDescription>
          </Alert>
        </div>
      </Demo>

      <Demo title="Table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Handle</TableHead>
              <TableHead numeric>Followers</TableHead>
              <TableHead numeric>Eng. rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {competitors.map((c) => (
              <TableRow key={c.handle}>
                <TableCell>@{c.handle}</TableCell>
                <TableCell numeric>{c.followers.toLocaleString()}</TableCell>
                <TableCell numeric>{c.er}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Demo>

      <Demo title="Loading & skeletons">
        <Spinner />
        <Spinner size="lg" />
        <div className="w-64 flex flex-col gap-3">
          <Skeleton className="h-7 w-32" />
          <SkeletonText lines={3} />
        </div>
      </Demo>

      <Demo title="DataState (loading → error → empty → ready)">
        <div className="w-full">
          <div className="mb-3 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1200); }}>
              Simulate load
            </Button>
          </div>
          <Card>
            <DataState
              loading={loading}
              empty
              emptyState={{
                icon: <Inbox />,
                title: 'No post metrics yet',
                description: 'Fetch insights to pull reach, saves and skip rate.',
                action: <Button onClick={() => toast({ title: 'Fetching…' })}>Fetch insights</Button>,
              }}
            >
              <CardContent>Loaded content goes here.</CardContent>
            </DataState>
          </Card>
        </div>
      </Demo>

      <Demo title="Card">
        <Card interactive className="max-w-sm">
          <CardHeader>
            <CardTitle>Weekly reach</CardTitle>
            <CardDescription>Last 7 days vs the prior week</CardDescription>
          </CardHeader>
          <CardContent className="font-mono text-2xl text-fg-number">48,210</CardContent>
          <CardFooter>
            <Button size="sm" variant="ghost">Details</Button>
          </CardFooter>
        </Card>
        <EmptyState
          className="border border-border rounded-[var(--radius-md)] max-w-sm"
          icon={<Inbox />}
          title="Nothing yet"
          description="This is the EmptyState component on its own."
          action={<Button>Do something</Button>}
        />
      </Demo>
    </div>
  );
}
