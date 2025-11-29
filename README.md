# Instagram Post Logger 📸

A simple web app to track your Instagram post edits for training data. Paste Claude's output, edit to your voice, log both versions.

## How It Works

1. **Claude Chat** → generates initial post using your Instagram skill
2. **Paste** into this app → locks the original
3. **Edit** → refine to match your authentic voice  
4. **Log** → saves original + final with diff & edit count

The logged posts create training data to improve the skill over time.

## Quick Start

```bash
# Install
npm install

# Run locally
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

1. Push to GitHub
2. Import at vercel.com/new
3. Deploy (no environment variables needed!)

## Data Storage

Posts are stored in `./data/posts.json`. 

On Vercel, this uses ephemeral storage - posts persist across requests but reset on new deployments. For permanent storage, consider adding:

- Vercel KV (Redis)
- Vercel Postgres  
- Supabase
- Or just export the JSON periodically

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

No API keys required - all refinement happens manually (that's the point!).
