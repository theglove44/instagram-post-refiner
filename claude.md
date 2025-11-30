# Instagram Post Logger - Project Guide

## Project Overview

**Instagram Post Logger** is a web application designed to track your Instagram post edits and create training data for future refinement. It enables a simple manual editing workflow that captures how you transform Claude-generated posts into your authentic voice:

- Paste posts generated in Claude Chat
- Lock the original and edit manually to match your voice
- Log both versions to create training data
- Tracks edit counts to measure refinement patterns
- Provides diff view to see exactly what changed

**Core Innovation**: By manually editing Claude outputs and logging the results, you create authentic training data that shows your editing patterns and preferences, which can later train an automated refinement system.

## Technology Stack

- **Next.js 16.0.5** - Full-stack React framework with API routes
- **React 19.2.0** - UI library
- **Supabase 2.44.0** - PostgreSQL database for persistent storage
- **Vercel Analytics 1.5.0** - Performance monitoring and Web Vitals tracking
- **Node.js** - Runtime (no version locking)
- **CSS-in-JS + Global CSS** - Styling (no external UI library)

**Note**: Supabase is used for persistent data storage across all API routes. Vercel Analytics provides non-intrusive performance monitoring.

## Project Structure

```
instagram-post-refiner/
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── log/route.js          # POST: Save logged post pair to Supabase
│   │   ├── posts/route.js        # GET: Retrieve post history from Supabase
│   │   └── analyse/route.js      # GET: Compute analytics metrics from posts
│   ├── analysis/
│   │   └── page.js               # Analytics dashboard UI
│   ├── layout.js                 # Root layout wrapper with Analytics
│   ├── layout.test.js            # Unit tests for layout component
│   ├── page.js                   # Main UI (edit, history, view tabs)
│   └── globals.css               # Global styling (dark theme)
├── lib/
│   ├── supabase.js               # Supabase client initialization
│   ├── supabase-schema.sql       # Database schema and migrations
│   ├── diff.js                   # Diff computation utilities
│   └── system-prompt.js          # Voice guidelines (archived, available for reference)
├── data/
│   └── posts.json                # Local JSON storage (gitignored, used for local dev fallback)
├── .env.example                  # Environment variables template
├── next.config.mjs               # Next.js configuration
├── package.json                  # Dependencies & scripts
├── CLAUDE.md                     # This file - developer guide
└── README.md                     # User-facing setup & deployment guide
```

## Core Features

### 1. Four-Tab Interface

**Edit Post Tab** (Main Workflow)
- Paste post from Claude Chat (no API refinement)
- Click "Start Editing" to lock the original and begin editing
- Edit your version in the right column to match your voice
- View live diff showing all your changes
- Save with "Log & Save" → saves both versions to Supabase

**History Tab**
- Browse all logged posts with topic, edit count, and timestamp
- Click post to view full details and diff
- Displays posts in reverse chronological order (newest first)

**Analysis Tab**
- View metrics dashboard with post statistics
- Shows total posts logged, average edits, edit distribution
- Identify trending topics and editing patterns
- Helps measure refinement effectiveness over time

**View Post Tab** (appears when a post is selected from history)
- Side-by-side original (Claude) vs final version (your edit)
- Full diff with added/removed lines highlighted
- Edit count display with breakdown

### 2. Workflow

```
Claude Chat (external) → Paste here → Lock original → Edit manually → Log both versions
                                                               ↓
                                           Creates training data showing your edits
```

### 3. Diff & Edit Tracking

- **computeDiff()**: Line-by-line comparison algorithm
- **countEdits()**: Calculates meaningful edits (pairs add/remove as 1 edit)
- Visual diff display with color coding:
  - Green for additions
  - Red for removals
  - Gray for unchanged lines

## API Endpoints

### `POST /api/log`

Save a logged post pair (original + final version) to Supabase.

**Request**
```javascript
{
  topic: string,          // Post topic/title
  aiVersion: string,      // Original Claude output (from Claude Chat)
  finalVersion: string,   // Your edited version
  editCount: number       // Number of meaningful edits made
}
```

**Response**
```javascript
{
  success: true,
  post: {
    id: number,                  // Auto-incremented Supabase ID
    topic: string,
    aiVersion: string,           // Unchanged original
    finalVersion: string,        // Your edits
    editCount: number,
    createdAt: string           // ISO timestamp
  },
  totalPosts: number
}
```

**Process**
1. Receives logged post with both versions
2. Validates environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
3. Inserts post into Supabase `posts` table
4. Returns created post object and total count

### `GET /api/posts`

Retrieve all logged posts from Supabase.

**Response**
```javascript
{
  success: true,
  posts: array  // All post objects from Supabase posts table, newest first
}
```

**Process**
1. Connects to Supabase using environment variables
2. Queries all posts from database, ordered by created_at DESC
3. Returns posts array with fallback error handling

### `GET /api/analyse`

Compute analytics metrics from all logged posts.

**Response**
```javascript
{
  success: true,
  stats: {
    totalPosts: number,              // Total posts logged
    averageEdits: number,            // Mean edits per post
    medianEdits: number,             // Median edits per post
    topTopics: array[{               // Most common topics
      topic: string,
      count: number
    }],
    editDistribution: {              // Posts grouped by edit count ranges
      "1-2": number,
      "3-5": number,
      "6-10": number,
      "10+": number
    }
  }
}
```

**Process**
1. Retrieves all posts from Supabase
2. Computes statistical metrics (total, average, median)
3. Aggregates topics and edit distributions
4. Returns stats object for dashboard display


## Styling & Design

**Design System** (in `app/globals.css`):

- **Dark theme** inspired by Instagram aesthetic
- Color palette:
  - Background: `#0a0a0a` (pure black)
  - Cards: `#141414` (dark gray)
  - Accent: `#e1306c` (Instagram pink)
  - Success: `#22c55e` (green)
  - Error: `#ef4444` (red)

**UI Components**:
- Tab navigation with active states
- Card-based layout (responsive grid)
- Toast notifications (success/error)
- Diff visualization with color coding
- History list with hover effects
- Empty states with SVG icons
- Loading spinners (CSS animation)

**Responsive Design**: Grid converts to single column on screens ≤1024px

## Setup & Development

### Installation

```bash
# Install dependencies
npm install
```

### Running Locally

```bash
# Create .env.local with Supabase credentials
cp .env.example .env.local
# Edit .env.local and add your Supabase URL and API key

# Start development server (port 3000)
npm run dev

# Open http://localhost:3000 in browser
```

**Features**:
- Hot reload enabled by Next.js
- Data storage in Supabase PostgreSQL
- Vercel Analytics for performance monitoring
- Environment-based configuration for different deployments

### Production Build

```bash
# Create optimized production build
npm run build

# Start production server
npm start
```

### Environment Variables

**Required for Supabase**:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (https://[project].supabase.co)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon public key

**Note**: These are public keys prefixed with `NEXT_PUBLIC_` and safe to expose in client code. The anon key is restricted to database row-level security policies.

**Optional**:
- `.env.local` - Local development overrides
- `.env.production` - Production environment variables

## Customization Guide

### 1. Change Colors & Styling

Edit `app/globals.css`:
- Modify `:root` CSS variables for colors
- Change fonts, sizes, spacing
- Update responsive breakpoints
- Customize tab styles and buttons

### 2. Adjust Diff Display

Edit `app/page.js` (lines 6-41):
- Modify `computeDiff()` algorithm for different comparison logic
- Change how diff stats are displayed (currently line-based)
- Update color scheme for diff view

### 3. Replace Data Storage

Edit `app/api/log/route.js`:
- Replace JSON file storage with database (Vercel KV, Supabase, etc.)
- Modify DATA_DIR environment variable
- Change file path or connection string

### 4. Update UI Labels & Placeholder Text

Edit `app/page.js`:
- Change tab names (lines 159-168)
- Update textarea placeholders (lines 217, 260)
- Modify button labels (lines 226, 277, 282)

## Code Entry Points

| Task | File | Notes |
|------|------|-------|
| Main UI & interaction logic | `app/page.js` | Edit, history, and view tabs; state management; client-side diff |
| Analytics dashboard UI | `app/analysis/page.js` | Analytics tab with metrics visualization |
| Save posts to Supabase | `app/api/log/route.js` | POST /api/log - Insert into posts table |
| Get post history | `app/api/posts/route.js` | GET /api/posts - Query all posts from Supabase |
| Compute analytics | `app/api/analyse/route.js` | GET /api/analyse - Calculate metrics from posts |
| Supabase client | `lib/supabase.js` | Client initialization and connection management |
| Database schema | `lib/supabase-schema.sql` | SQL migrations for posts table setup |
| Diff utilities | `lib/diff.js` | Diff computation and edit counting algorithms |
| Styling & design | `app/globals.css` | Colors, fonts, responsive layout, dark theme |
| Root layout | `app/layout.js` | HTML wrapper, metadata, Analytics component |
| Layout tests | `app/layout.test.js` | Unit tests for layout component |

## Data Model

### Post Schema

Posts are stored in Supabase `posts` table as rows:

```sql
-- Table: posts
id          INT PRIMARY KEY AUTO INCREMENT
topic       TEXT NOT NULL
aiVersion   TEXT NOT NULL
finalVersion TEXT NOT NULL
editCount   INT NOT NULL
createdAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**Example Row**:
```javascript
{
  id: 42,                        // Auto-incremented Supabase ID
  topic: "M&S Food Hall",        // Post topic/title
  aiVersion: "...",              // Raw Claude output (unchanged)
  finalVersion: "...",           // User-edited version (final)
  editCount: 3,                  // Number of meaningful edits made
  createdAt: "2024-11-28T10:30:00Z"  // ISO timestamp
}
```

### Storage Details

**Supabase Integration** (Current):
- Posts persisted in PostgreSQL database
- Configured via `lib/supabase.js`
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Row-level security (RLS) policies can restrict access
- Data survives deployments and application restarts
- Real-time capabilities available (future enhancement)

**Local Development Fallback**:
- `./data/posts.json` available for local testing without Supabase
- Useful for offline development or testing
- Not recommended for production

## Diff Computation Logic

The diff computation happens entirely client-side in `app/page.js` (lines 6-41):

**computeDiff(oldText, newText)** (lines 6-34)
- Line-by-line comparison algorithm
- Returns array of change objects `{type, content}`
- Types: `'added'`, `'removed'`, `'unchanged'`
- Used to display visual diff when editing

**countEdits(oldText, newText)** (lines 36-41)
- Calculates meaningful edits for training metrics
- Computes diff and filters unchanged lines
- Pairs add/remove operations as single edit
- Returns minimum of 1 edit (even for single character changes)

## Client-Side State Management

`app/page.js` uses React hooks (no global state):

```javascript
const [topic, setTopic] = useState('');              // Post topic (optional)
const [original, setOriginal] = useState('');        // Pasted from Claude Chat
const [edited, setEdited] = useState('');            // Your edited version
const [isLocked, setIsLocked] = useState(false);     // Whether original is locked
const [isSaving, setIsSaving] = useState(false);     // Save API call loading
const [toast, setToast] = useState(null);            // Notification message
const [history, setHistory] = useState([]);          // All logged posts
const [activeTab, setActiveTab] = useState('edit');  // Current tab: edit/history/view
const [selectedPost, setSelectedPost] = useState(null); // Post being viewed
```

**Key Workflow Variables**:
- `isLocked`: When true, original cannot be edited; edited version becomes editable
- `editCount`: Computed on-the-fly from `countEdits(original, edited)` when locked
- `diff`: Computed on-the-fly from `computeDiff(original, edited)` when locked

All state is local to the Home component. No Context API or Redux needed for this scope.

## Deployment

### Quick Start with Vercel

1. Create Supabase project and set up `posts` table using `lib/supabase-schema.sql`
2. Get Supabase credentials (URL and anon key)
3. Push code to GitHub
4. Import repository in Vercel dashboard
5. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Deploy (automatic on push)

**Note**: Supabase provides persistent storage that survives deployments.

### Self-Hosted (Docker, VPS, etc.)

1. Clone repository
2. Install Node.js 18+
3. Set up Supabase project (self-hosted or managed)
4. Create `.env.local` with Supabase credentials
5. Run `npm install && npm run build && npm start`
6. Access on port 3000 (or configure PORT env var)

**Note**: Requires Supabase project for data persistence.

### Alternative Storage Backends

To use different storage instead of Supabase:

- **Vercel Postgres** - PostgreSQL via Vercel (requires schema migration)
- **Firebase Firestore** - NoSQL option (requires rewrite of API routes)
- **MongoDB** - NoSQL option (requires rewrite of API routes)
- **Local JSON** - For development only (ephemeral on Vercel)

The API structure (`POST /api/log`, `GET /api/posts`, `GET /api/analyse`) can be adapted to any backend by modifying the route handlers in `app/api/`.

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | ^16.0.5 | Full-stack React framework with API routes |
| `react` | ^19.2.0 | UI library |
| `react-dom` | ^19.2.0 | React DOM rendering |
| `@supabase/supabase-js` | ^2.44.0 | Supabase client for PostgreSQL access |
| `@vercel/analytics` | ^1.5.0 | Performance monitoring and Web Vitals tracking |

**Total**: 5 dependencies. No dev dependencies—minimal setup for fast development and deployment.

## Project Rules

### Code Style

- **Naming**: camelCase for variables/functions, PascalCase for React components
- **Async**: Use async/await for API calls (no callbacks)
- **Comments**: Only for non-obvious logic
- **Formatting**: Keep lines readable (let Prettier format if configured)

### Component Design

- Prefer functional components with hooks
- Keep components focused and minimal
- Pass data through props (no deeply nested props)
- Use React keys correctly in lists

### API Design

- Use standard HTTP methods (GET/POST/PUT/DELETE)
- Return consistent JSON structure with `success` field
- Include meaningful error messages
- Log API calls for debugging

### File Organization

- API routes in `app/api/[route]/route.js`
- Utilities in `lib/`
- Styling in `app/globals.css` and inline styles
- Don't create unnecessary files or directories

### Data Logging Best Practices

- Always include a meaningful topic for easier filtering
- The original (aiVersion) is never modified—it's your baseline
- Edit freely to match your authentic voice
- Edit counts help identify which topics need more refinement

### Data Integrity

- Never modify `posts.json` manually (use API)
- Keep both `aiVersion` and `finalVersion` unmodified (for training)
- Use `editCount` to measure AI accuracy over time
- Back up `posts.json` before major updates

## Project Evolution

### v1.1 (Current)
**November 2024** - Enhanced with Supabase persistence, analytics dashboard, and performance monitoring

**Major changes from v1.0**:
- Migrated from ephemeral JSON file storage to Supabase PostgreSQL
- Added analytics dashboard with metrics visualization
- Integrated Vercel Analytics for performance monitoring
- Added unit tests for layout component
- Implemented `/api/analyse` endpoint for computing post statistics
- Fixed HTML structure issues (Analytics component placement)

**Current features**:
- Paste from Claude Chat, lock original, edit manually
- Real-time diff tracking with edit counts
- Persistent data storage in Supabase
- Analytics dashboard showing:
  - Total posts logged
  - Average and median edits per post
  - Top topics by frequency
  - Edit distribution patterns
- Vercel Analytics for performance monitoring
- Unit test coverage for layout component

### v1.0 (Previous Release)
**November 2024** - Launched as Instagram Post Logger with manual editing workflow

**Approach**: Users manually edit Claude-generated posts and log both versions. This creates authentic training data showing real editing patterns.

**Why manual editing?** Manual edits capture genuine user preferences and voice adjustments in a way that pure AI refinement metrics cannot. Each logged post pair becomes valuable training data for future automation.

**Features**:
- Paste from Claude Chat, lock original, edit manually
- Real-time diff tracking with edit counts
- Local JSON-based post history with three-tab interface
- No external dependencies

### v0.1 (Previous Concept)
Earlier iterations explored automatic Claude API refinement using a detailed voice system prompt. The shift to manual logging reflects a decision to prioritize training data quality over automation convenience.

**What was changed and why**:
- Removed `/api/refine` endpoint - Decided manual editing creates better training data
- Removed Anthropic SDK dependency - No external API calls needed
- Simplified to pure client-side diff computation - Faster, no latency

---

## Archived Components

### Voice System Prompt (`lib/system-prompt.js`)

**Current Status**: Available but unused (no active refinement feature)

**Content**: A comprehensive 127-line system prompt designed to teach Claude your voice through:
- Core voice characteristics (conversational, self-aware, authentic)
- Formatting rules (CAPS usage, emoji placement)
- Language patterns (preferred phrases, things to avoid)
- 10+ before/after examples showing voice transformation

**Why it exists**: This can be repurposed when/if an automated refinement feature is re-added in future versions. It documents your voice characteristics for reference.

**Potential future use**:
- Feed to Claude API for automatic refinement (with user approval)
- Compare new posts against documented patterns
- Train a local fine-tuned model
- Export as guidance document for other AI tools

**If you want to maintain it**:
- Keep it updated as your voice evolves
- Add new examples as you log more posts
- Use it as reference when manually editing

**If you want to archive it**:
- Move to `lib/system-prompt.archived.js`
- Can be recovered later if needed

## Quick Reference

**Start Development**: `npm run dev` → http://localhost:3000

**Main Workflow**: Paste from Claude Chat → Lock original → Edit manually → Log both versions

**View Logged Posts**: Click "History" tab or check `data/posts.json`

**Export Data**: Copy `data/posts.json` to backup before major updates

**Deploy**: Push to GitHub, Vercel auto-deploys (no environment variables needed)

**Debug**: Check browser DevTools Network tab or server logs from `npm run dev`

**Customize**: Edit `app/globals.css` for colors, `app/page.js` for behavior, `app/api/log/route.js` for storage

---

Last Updated: November 30, 2024 (Updated for v1.1 - Supabase & Analytics)
