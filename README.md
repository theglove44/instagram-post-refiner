# Instagram Post Refiner 📸

A web app to track and refine your Instagram posts with persistent storage. Paste Claude-generated content, edit to match your voice, and log both versions to build authentic training data.

## How It Works

1. **Paste** from Claude Chat → Copy Claude's initial output
2. **Lock & Edit** → Lock the original, refine to your voice
3. **Review** → See real-time diff of all your changes
4. **Log** → Save original + final with edit count to Supabase

The logged posts create training data showing your editing patterns and voice refinements.

## Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up
2. Create a new project
3. In the SQL Editor, run the SQL from `lib/supabase-schema.sql` to create the `posts` table
4. Get your credentials from **Settings → API**:
   - `NEXT_PUBLIC_SUPABASE_URL` (Project URL)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Anon public key)

### 2. Configure Environment Variables

Create `.env.local` in your project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Install & Run

```bash
# Install dependencies
npm install

# Run locally
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

1. Push code to GitHub
2. Import repository at [vercel.com/new](https://vercel.com/new)
3. Add the two environment variables from step 1 above
4. Deploy!

Your data will now persist permanently in Supabase across deployments.

## Project Structure

```
instagram-post-refiner/
├── app/
│   ├── api/
│   │   ├── log/route.js           # POST: Save post to Supabase
│   │   ├── posts/route.js         # GET: Retrieve posts from Supabase
│   │   └── analyse/route.js       # GET: Compute analytics metrics
│   ├── analysis/
│   │   └── page.js                # Analytics dashboard UI
│   ├── layout.js                  # Root layout with Analytics
│   ├── layout.test.js             # Layout unit tests
│   ├── page.js                    # Main UI (Edit, History, View tabs)
│   └── globals.css                # Global styles and dark theme
├── lib/
│   ├── supabase.js                # Supabase client configuration
│   ├── supabase-schema.sql        # Database schema
│   ├── diff.js                    # Diff computation utilities
│   └── system-prompt.js           # Voice guidelines (reference)
├── .env.example                   # Environment variables template
├── package.json                   # Dependencies and scripts
├── next.config.mjs                # Next.js configuration
├── CLAUDE.md                      # Developer guide
└── README.md                      # User guide
```

## Features

- Side-by-side original vs edited view
- Live diff highlighting as you edit
- Edit count tracking
- Post history with clickable entries
- Copy to clipboard
- Dark mode UI
- Analytics dashboard with post metrics
- Performance monitoring via Vercel Analytics

Data persists permanently in Supabase - no more ephemeral storage on Vercel.

## Analytics & Monitoring

### Vercel Analytics

This app includes Vercel Analytics for performance monitoring:
- **Web Vitals**: Tracks Core Web Vitals (LCP, FID, CLS)
- **Custom Events**: Monitors user interactions and feature usage
- **No personal data**: Analytics respects user privacy (see Privacy section below)

The `<Analytics />` component is included in `app/layout.js` and requires no additional configuration.

### Supabase Integration

Supabase provides persistent data storage for all logged posts:
- Configured in `lib/supabase.js`
- Used by all API routes (`/api/log`, `/api/posts`, `/api/analyse`)
- Requires environment variables: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- For local development, ensure `.env.local` is configured (see Setup section)

## Privacy & Analytics Disclosure

This application uses Vercel Analytics to monitor performance and usage patterns. No personally identifiable information (PII) is collected. The analytics data helps us understand how users interact with the app to improve performance and user experience.

**What is tracked:**
- Page views and navigation patterns
- Performance metrics (load times, responsiveness)
- General browser/device information (no personal data)

**What is NOT tracked:**
- Post content (everything stays in your Supabase database)
- Personally identifiable information
- Cookies are not used for tracking

For more information on Vercel Analytics privacy, see [Vercel Analytics Documentation](https://vercel.com/analytics).
