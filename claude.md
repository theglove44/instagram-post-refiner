# Instagram Post Refiner - Project Guide

## Project Overview

**Instagram Post Refiner** is a web application designed to refine Instagram post drafts to match your authentic voice and style for food, drink, and lifestyle content. It acts as both a refinement tool and a training feedback loop:

- Takes draft posts (initially created in Claude Chat)
- Uses Claude AI with your custom voice guidelines to refine them
- Allows manual editing to perfect the tone
- Logs both AI and final versions to create training data
- Tracks edit counts to measure AI refinement accuracy

**Core Innovation**: Each logged post pair (AI version vs. final version) serves as training data to improve future refinement accuracy.

## Technology Stack

- **Next.js 16.0.5** - Full-stack React framework with API routes
- **React 19.2.0** - UI library
- **@anthropic-ai/sdk 0.71.0** - Anthropic SDK for Claude API integration
- **Claude Sonnet 4** - AI model for post refinement
- **Node.js** - Runtime (no version locking)
- **CSS-in-JS + Global CSS** - Styling (no external UI library)

## Project Structure

```
instagram-post-refiner/
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── refine/route.js       # POST: Refine draft using Claude
│   │   ├── log/route.js          # POST: Save post pair to JSON
│   │   └── posts/route.js        # GET: Retrieve post history
│   ├── layout.js                 # Root layout wrapper
│   ├── page.js                   # Main UI (client-side React)
│   └── globals.css               # Global styling (dark theme)
├── lib/
│   ├── system-prompt.js          # Claude system prompt with voice guidelines
│   └── diff.js                   # Diff computation & edit counting utilities
├── data/
│   └── posts.json                # Local JSON storage (gitignored)
├── .env.example                  # Environment variable template
├── next.config.mjs               # Next.js configuration
├── package.json                  # Dependencies & scripts
└── README.md                     # Setup & deployment guide
```

## Core Features

### 1. Three-Tab Interface

**Refine Post Tab** (Main Workflow)
- Input draft and optional topic
- Click "Refine Post" → API calls `/api/refine`
- Claude-refined version appears
- User can edit the refined text
- View live diff showing all changes
- Save with "Log Post" → API calls `/api/log`

**History Tab**
- Browse all logged posts with count
- List shows: topic, edit count, timestamp
- Click post to view full details

**View Post Tab**
- Side-by-side AI version vs final version
- Full diff with added/removed lines highlighted
- Edit count display

### 2. Workflow

```
Draft → Refine (Claude API) → Edit (User tweaks) → Log (Save both versions)
                                                      ↓
                                          Creates training data
```

### 3. Diff & Edit Tracking

- **computeDiff()**: Line-by-line comparison algorithm
- **countEdits()**: Calculates meaningful edits (pairs add/remove as 1 edit)
- Visual diff display with color coding:
  - Green for additions
  - Red for removals
  - Gray for unchanged lines

## API Endpoints

### `POST /api/refine`

Refine a draft post using Claude.

**Request**
```javascript
{
  draft: string,      // Required: User's draft post
  topic?: string      // Optional: Post topic/subject
}
```

**Response**
```javascript
{
  refined: string,    // Claude's refined version
  usage: {
    inputTokens: number,
    outputTokens: number
  }
}
```

**Process**
1. Receives draft + topic
2. Sends to Claude Sonnet 4 with system prompt
3. Returns refined post matching voice guidelines
4. Includes token usage tracking

### `POST /api/log`

Save a post pair (AI version + final user version).

**Request**
```javascript
{
  topic: string,          // Post topic/title
  aiVersion: string,      // Original Claude output
  finalVersion: string,   // User-edited final version
  editCount: number       // Number of meaningful edits
}
```

**Response**
```javascript
{
  success: true,
  post: {
    id: string,                  // Timestamp-based ID
    topic: string,
    aiVersion: string,
    finalVersion: string,
    editCount: number,
    createdAt: string           // ISO timestamp
  },
  totalPosts: number
}
```

**Process**
1. Creates post object with ID and timestamp
2. Loads existing posts from `data/posts.json`
3. Adds new post to beginning of array
4. Saves updated array back to file

### `GET /api/posts`

Retrieve all logged posts.

**Response**
```javascript
{
  posts: array  // All post objects from data/posts.json
}
```

## Voice System Prompt

Located in `lib/system-prompt.js`, this is a **127-line system prompt** that teaches Claude your voice. It includes:

### Core Voice Characteristics

- Conversational, self-aware tone ("catching up with a drink")
- Avoids marketing hype and forced enthusiasm
- Includes Tommo (partner) as active character, not sidekick
- Self-aware humor, acknowledging contradictions
- Genuine opinions without obligatory enthusiasm

### Formatting Rules

- **CAPS sparingly** (2-4 max per post) for: key foods, brands, quality descriptors
- **Emoji at end** of sentences/paragraphs (1 per paragraph max)
- **Avoid these emojis**: 🤩 🔥 💯 🚀 (feel salesy)
- **Short paragraphs** (1-3 sentences) with white space

### Language Patterns

- **Use**: "proper", "brilliant", "lovely", "flipping", "moorish", "bad boys"
- **Avoid**: "absolute BEAUT", "game changer", "to die for", American spellings
- **Be specific**: "tender meat" vs "incredible"

### Real Examples

The system prompt includes 10+ before/after examples showing transformation from generic AI to authentic voice. This is the most important part for training Claude to match your style.

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

# Create .env.local with your API key
cp .env.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY
```

### Running Locally

```bash
# Start development server (port 3000)
npm run dev

# Open http://localhost:3000 in browser
```

**Features**:
- Hot reload enabled by Next.js
- File-based data storage in `./data/posts.json`
- Local API endpoints available immediately

### Production Build

```bash
# Create optimized production build
npm run build

# Start production server
npm start
```

### Environment Variables

**Required**:
- `ANTHROPIC_API_KEY` - Your Anthropic API key (from console.anthropic.com)

**Optional**:
- `DATA_DIR` - Custom data directory path (defaults to `./data`)

## Customization Guide

### 1. Modify Your Voice Guidelines

Edit `lib/system-prompt.js`:
- Update tone and style description
- Add/edit language patterns
- Update before/after examples
- Adjust formatting rules

This is the primary way to train Claude to match your voice better.

### 2. Change Colors & Styling

Edit `app/globals.css`:
- Modify `:root` CSS variables for colors
- Change fonts, sizes, spacing
- Update responsive breakpoints

### 3. Switch AI Models

Edit `app/api/refine/route.js`:
- Change `model: "claude-sonnet-4-20250514"` to another Claude model
- Adjust `max_tokens` (currently 2000)

### 4. Replace Data Storage

Edit `app/api/log/route.js`:
- Replace JSON file storage with database (Vercel KV, Supabase, etc.)
- Modify DATA_DIR environment variable
- Change file path or connection string

## Code Entry Points

| Task | File |
|------|------|
| Main UI & interaction | `app/page.js` |
| Claude refinement logic | `app/api/refine/route.js` |
| Save posts to storage | `app/api/log/route.js` |
| Get post history | `app/api/posts/route.js` |
| Voice guidelines | `lib/system-prompt.js` |
| Diff computation | `lib/diff.js` |
| Styling | `app/globals.css` |
| Root layout | `app/layout.js` |

## Data Model

### Post Schema

Posts are stored in `data/posts.json` as an array of objects:

```javascript
{
  id: "1234567890",              // Timestamp-based ID (unique)
  topic: "M&S Food Hall",        // Post topic/title
  aiVersion: "...",              // Raw Claude output (unchanged)
  finalVersion: "...",           // User-edited version (final)
  editCount: 3,                  // Number of meaningful edits made
  createdAt: "2024-11-28T10:30:00.000Z"  // ISO timestamp
}
```

### Storage Details

**Local Development**:
- Posts saved to `./data/posts.json` (auto-created)
- Human-readable JSON format
- Persists between server restarts

**Vercel Deployment**:
- Uses ephemeral storage (persists per deployment)
- Data resets on redeploy
- Recommendation: Migrate to persistent DB (Vercel KV, Postgres, Supabase)

## Utilities & Helpers

### `lib/diff.js`

**computeDiff(oldText, newText)**
- Line-by-line diff algorithm
- Returns array of change objects `{type, content}`
- Types: `'added'`, `'removed'`, `'unchanged'`

**countEdits(oldText, newText)**
- Calculates meaningful edits
- Computes diff and filters unchanged lines
- Pairs add/remove operations as single edit
- Returns minimum of 1 edit

**calculateSimilarity(a, b)**
- Jaccard index similarity (0-1)
- Compares word sets between texts
- Currently exported but unused

## Client-Side State Management

`app/page.js` uses React hooks (no global state):

```javascript
const [topic, setTopic] = useState('');              // Post topic
const [draft, setDraft] = useState('');              // User draft input
const [refined, setRefined] = useState('');          // Claude output
const [final, setFinal] = useState('');              // User-edited version
const [isRefining, setIsRefining] = useState(false); // API call loading
const [isSaving, setIsSaving] = useState(false);     // Save loading
const [toast, setToast] = useState(null);            // Notification
const [history, setHistory] = useState([]);          // Logged posts
const [activeTab, setActiveTab] = useState('refine');// Current tab
const [selectedPost, setSelectedPost] = useState(null); // Viewing post
```

All state is local to the Home component. No Context API or Redux needed for this scope.

## Deployment

### Quick Start with Vercel

1. Push code to GitHub
2. Import repository in Vercel dashboard
3. Add `ANTHROPIC_API_KEY` environment variable
4. Deploy (automatic on push)

### Self-Hosted

1. Clone repository
2. Install Node.js
3. Run `npm install`
4. Set `ANTHROPIC_API_KEY` in `.env.local`
5. Run `npm run build && npm start`
6. Access on port 3000 (or configure PORT env var)

### Database Considerations

For production, consider migrating from JSON file storage to:

- **Vercel KV** (Redis) - Easy integration with Vercel
- **Vercel Postgres** - Full SQL database
- **Supabase** - PostgreSQL + auth
- **Firebase** - Real-time database
- **MongoDB** - NoSQL option

See README.md for detailed deployment instructions.

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@anthropic-ai/sdk` | ^0.71.0 | Claude API client library |
| `next` | ^16.0.5 | React framework + server |
| `react` | ^19.2.0 | UI library |
| `react-dom` | ^19.2.0 | React DOM rendering |

No dev dependencies—minimal setup for fast development.

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

### Voice System Maintenance

- Regularly review logged posts to identify patterns
- Update system prompt based on real examples
- Keep voice guidelines current as your style evolves
- Use logged data to improve refinement accuracy

### Data Integrity

- Never modify `posts.json` manually (use API)
- Keep both `aiVersion` and `finalVersion` unmodified (for training)
- Use `editCount` to measure AI accuracy over time
- Back up `posts.json` before major updates

## Future Enhancement Ideas

1. **Database Migration**
   - Move from JSON to Postgres/MongoDB
   - Add proper indexing and queries
   - Support concurrent users

2. **Advanced Diff Display**
   - Word-by-word diffs (not just line-by-line)
   - Diff visualization improvements
   - Export diffs as formatted documents

3. **Analytics & Insights**
   - Track average edit count by topic
   - Most common refinements
   - Voice effectiveness metrics
   - Timeline of voice evolution

4. **Batch Processing**
   - Refine multiple posts at once
   - CSV/JSON import/export
   - Scheduled refinement

5. **Collaboration**
   - Share refined posts with Tommo for feedback
   - Comments on versions
   - Version history/rollback

6. **Export Features**
   - Download refined post as .txt, .md, or .docx
   - Export history as CSV
   - Copy to clipboard button

7. **Voice Training**
   - Auto-generate training examples from history
   - Compare new refinements against past voice
   - Measure voice consistency over time

8. **Mobile App**
   - React Native version
   - Offline support
   - Mobile-optimized UI

## Quick Reference

**Start Development**: `npm run dev` → http://localhost:3000

**Add Environment Variables**: Create `.env.local` with `ANTHROPIC_API_KEY=sk-ant-...`

**Train Voice**: Edit `lib/system-prompt.js` and test with real drafts

**View Logged Posts**: Click "History" tab or check `data/posts.json`

**Deploy**: Push to GitHub, Vercel auto-deploys with environment variables set

**Debug API**: Check browser DevTools Network tab or server logs from `npm run dev`

---

Last Updated: November 2024
