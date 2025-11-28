# Instagram Post Refiner 📸

A web app that refines Instagram post drafts to match your authentic voice, then logs both versions for ongoing training data.

## How It Works

1. **Paste** your draft post from Claude Chat
2. **Refine** - sends to Claude API with your voice guidelines
3. **Edit** - tweak the refined version to perfection
4. **Log** - saves both AI and final versions with edit counts

The logged posts create training data to continuously improve the refinement accuracy.

## Setup

### 1. Clone & Install

```bash
cd instagram-post-refiner
npm install
```

### 2. Add Your API Key

Create a `.env.local` file:

```bash
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

Get your key from: https://console.anthropic.com/

### 3. Run Locally

```bash
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

### Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/instagram-post-refiner)

### Manual Deploy

1. Push to GitHub
2. Import in Vercel: https://vercel.com/new
3. Add environment variable: `ANTHROPIC_API_KEY`
4. Deploy!

## Data Storage

Posts are stored in `./data/posts.json` locally. 

For Vercel deployment, this uses ephemeral storage - posts will persist across requests but reset on new deployments. For permanent storage, consider:

- **Vercel KV** (Redis) - easy integration
- **Vercel Postgres** - full database
- **Supabase** - free tier available
- **Export to file** - download JSON periodically

## Customizing the Voice

Edit `lib/system-prompt.js` to update the voice guidelines. Key sections:

- **Core Voice Characteristics** - tone, partner references, humor
- **Formatting Rules** - caps, emoji, paragraph structure
- **Language Patterns** - British expressions, words to avoid
- **Real Examples** - before/after refinement examples

## Project Structure

```
instagram-post-refiner/
├── app/
│   ├── api/
│   │   ├── refine/route.js    # Claude API refinement
│   │   ├── log/route.js       # Save post versions
│   │   └── posts/route.js     # Get post history
│   ├── globals.css            # Styles
│   ├── layout.js              # App layout
│   └── page.js                # Main UI
├── lib/
│   └── system-prompt.js       # Voice guidelines
├── data/                      # Post storage (gitignored)
└── package.json
```

## License

MIT - do whatever you want with it! 🎉
