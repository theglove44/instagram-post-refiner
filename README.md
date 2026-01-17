<div align="center">

# 📸 Instagram Post Refiner

**Transform AI-generated content into your authentic voice — and track what actually works.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

[Features](#-features) • [Demo](#-how-it-works) • [Quick Start](#-quick-start) • [Instagram Integration](#-instagram-integration) • [Deploy](#-deploy-to-vercel)

</div>

---

## 🎯 The Problem

You use AI to draft Instagram posts, but the output never quite sounds like *you*. You edit it, post it, and then... forget what you changed. Weeks later, you're making the same edits again.

**Instagram Post Refiner solves this by:**

1. **Capturing your voice** — Log original AI output alongside your refined version
2. **Tracking your patterns** — See exactly what you change and how often
3. **Measuring what works** — Connect to Instagram and correlate your edits with actual engagement
4. **Optimizing your hashtags** — Discover which hashtags drive performance

---

## ✨ Features

### Core Editing
- **Side-by-side editor** — Original AI output on the left, your version on the right
- **Real-time diff** — See every change highlighted as you type
- **Edit tracking** — Automatic counting of meaningful edits
- **Post history** — Browse, search, and filter all logged posts

### 📊 Analytics Dashboard
- **Voice analysis** — Track how your editing patterns evolve
- **Edit distribution** — Visualize your refinement intensity
- **Topic trends** — See what subjects you post about most

### 📈 Performance Tracking (Instagram Connected)
- **Link posts to Instagram** — Match logged posts with published content
- **Engagement metrics** — Track likes, comments, saves, reach, and engagement rate
- **Edit-to-performance correlation** — Discover if more edits = better performance
- **Best posting times** — Analyze when your content performs best

### # Hashtag Analytics
- **Usage tracking** — See your most-used hashtags at a glance
- **Trending detection** — Spot which hashtags you're using more lately
- **Performance ranking** — Identify your best and worst performing hashtags
- **Smart suggestions** — Know which hashtags to keep and which to replace

---

## 🔄 How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │     │                 │
│  1. PASTE       │ ──▶ │  2. EDIT        │ ──▶ │  3. LOG         │ ──▶ │  4. ANALYZE     │
│                 │     │                 │     │                 │     │                 │
│  Paste AI       │     │  Refine to      │     │  Save both      │     │  Link to IG &   │
│  generated post │     │  your voice     │     │  versions       │     │  track metrics  │
│                 │     │                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
```

**The magic:** Every logged post becomes training data. Over time, you'll see exactly how you transform AI content — and which transformations lead to better engagement.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier works great)
- (Optional) Instagram Business/Creator account for performance tracking

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/instagram-post-refiner.git
cd instagram-post-refiner
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `lib/supabase-schema.sql`
3. Get your credentials from **Settings → API**

### 3. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

---

## 📸 Instagram Integration

Connect your Instagram Business or Creator account to unlock performance tracking.

### Setup

1. Create an app at [developers.facebook.com](https://developers.facebook.com)
2. Add the **Instagram Graph API** product
3. Configure OAuth redirect URI: `https://your-domain.com/api/instagram/callback`
4. Add to your environment:

```env
INSTAGRAM_APP_ID=your-facebook-app-id
INSTAGRAM_APP_SECRET=your-facebook-app-secret
INSTAGRAM_REDIRECT_URI=https://your-domain.com/api/instagram/callback
```

5. Go to **Settings** in the app and connect your account

### What You Get

| Feature | Description |
|---------|-------------|
| **Account Overview** | Followers, posts, 28-day reach and engagement |
| **Post Metrics** | Per-post likes, comments, saves, shares, reach |
| **Best Times** | Optimal posting days and hours based on your data |
| **Hashtag Performance** | Which hashtags drive the most engagement |
| **Edit Correlation** | Does editing more lead to better results? |

---

## 🌐 Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/instagram-post-refiner)

1. Click the button above (or import from GitHub)
2. Add your environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `INSTAGRAM_APP_ID` (optional)
   - `INSTAGRAM_APP_SECRET` (optional)
   - `INSTAGRAM_REDIRECT_URI` (optional)
3. Deploy!

---

## 📁 Project Structure

```
instagram-post-refiner/
├── app/
│   ├── api/
│   │   ├── hashtags/          # Hashtag analytics endpoint
│   │   ├── instagram/         # Instagram OAuth & metrics
│   │   │   ├── account/       # Account info
│   │   │   ├── auth/          # OAuth initiation
│   │   │   ├── callback/      # OAuth callback
│   │   │   ├── insights/      # Account insights
│   │   │   ├── metrics/       # Post metrics
│   │   │   └── recent/        # Recent posts
│   │   ├── log/               # Save logged posts
│   │   ├── posts/             # Retrieve & link posts
│   │   └── analyse/           # Analytics computation
│   ├── analysis/              # Analytics dashboard
│   ├── performance/           # Performance tracking page
│   ├── settings/              # Instagram connection settings
│   ├── page.js                # Main editor UI
│   └── globals.css            # Styling
├── lib/
│   ├── supabase.js            # Database client
│   ├── supabase-schema.sql    # Database schema
│   ├── instagram.js           # Instagram API client
│   └── hashtags.js            # Hashtag extraction utilities
└── ...
```

---

## 🛠 Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 16** | Full-stack React framework |
| **React 19** | UI components |
| **Supabase** | PostgreSQL database & auth |
| **Instagram Graph API** | Performance metrics |
| **Vercel Analytics** | Performance monitoring |

---

## 🔒 Privacy

- **Your content stays yours** — All posts are stored in your own Supabase database
- **No PII collected** — Analytics track performance, not personal data
- **Instagram data** — Only accessed with your explicit OAuth consent
- **Open source** — Audit the code yourself

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built for content creators who want their AI-assisted posts to actually sound like them.**

[⬆ Back to top](#-instagram-post-refiner)

</div>
