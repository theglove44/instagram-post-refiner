# Instagram Post Logger 📸

A simple web app to track your Instagram post edits for training data. Paste Claude's output, edit to your voice, log both versions.

## How It Works

1. **Claude Chat** → generates initial post using your Instagram skill
2. **Paste** into this app → locks the original
3. **Edit** → refine to match your authentic voice  
4. **Log** → saves original + final with diff & edit count

The logged posts create training data to improve the skill over time.

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
instagram-post-logger/
├── app/
│   ├── api/
│   │   ├── log/route.js       # Save post versions
│   │   └── posts/route.js     # Get post history
│   ├── globals.css            # Styles
│   ├── layout.js              # App layout
│   └── page.js                # Main UI
└── data/                      # Post storage (gitignored)
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
