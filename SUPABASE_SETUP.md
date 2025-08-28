# 🚀 Supabase Setup Guide for LLM Popularity Tracker

This guide will walk you through setting up your LLM Popularity Tracker with Supabase for real-time voting with WebSockets.

## 📋 Prerequisites

- Node.js 18+ installed
- Git installed
- A GitHub account (for Vercel deployment)

## 🔧 Step 1: Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Sign up for a free account (if you don't have one)
3. Click **"New Project"**
4. Fill in:
   - **Project Name**: `llm-popularity-tracker`
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose the closest to your users
5. Click **"Create Project"** and wait ~2 minutes for setup

## 📊 Step 2: Set Up Database Schema

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New Query"**
3. Copy and paste the entire contents of `supabase/schema.sql`
4. Click **"Run"** (or press Ctrl+Enter)
5. You should see "Success. No rows returned" - this means tables are created!

## 🔑 Step 3: Get Your API Keys

1. In Supabase dashboard, click **Settings** (gear icon) → **API**
2. You'll need two values:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **Anon/Public Key**: A long string starting with `eyJ...`
3. Keep this tab open, you'll need these values

## 🌍 Step 4: Configure Environment Variables

### Local Development:

1. Create a `.env.local` file in your project root:
```bash
cp .env.example .env.local
```

2. Edit `.env.local` and add your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key-here
```

### For Vercel Deployment:

You'll add these same values in Vercel's dashboard (Step 6).

## 🏃 Step 5: Test Locally

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000)
4. You should see:
   - The LLM grid loading
   - A green "Live" indicator (top-right) showing WebSocket connection
   - Ability to vote on LLMs

5. **Test Real-time Updates**:
   - Open the app in two browser tabs
   - Vote in one tab
   - See the vote count update instantly in the other tab!

## 🚀 Step 6: Deploy to Vercel

### A. Push to GitHub:

```bash
git add .
git commit -m "Add Supabase real-time voting"
git push origin main
```

### B. Deploy on Vercel:

1. Go to [https://vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click **"Add New Project"**
4. Import your `llm-popularity-tracker` repository
5. In **Environment Variables** section, add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your-supabase-url
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your-anon-key
6. Click **"Deploy"**
7. Wait 2-3 minutes for build to complete

### C. Your App is Live! 🎉

Your app will be available at:
- `https://your-project-name.vercel.app`

## 📊 Step 7: Monitor Your App

### Supabase Dashboard:
- **Database**: View tables, run queries
- **Realtime**: See active WebSocket connections
- **Logs**: Monitor database activity

### Vercel Dashboard:
- **Analytics**: Page views, user metrics
- **Functions**: API route performance
- **Logs**: Application logs

## 🔍 Troubleshooting

### "Failed to connect to voting system"
- Check your `.env.local` has correct Supabase credentials
- Verify Supabase project is active (not paused)

### Votes not updating in real-time
- Check the "Live" indicator is green
- Ensure browser allows WebSocket connections
- Try refreshing the page

### "Subscription quota exceeded"
- Free tier allows 200 concurrent connections
- This error appears if you have >200 users at once
- Upgrade to Pro plan or implement connection pooling

## 📈 Scaling Beyond Free Tier

Your free tier handles:
- ✅ 10,000 monthly users easily
- ✅ 200 concurrent real-time connections
- ✅ 500MB database storage
- ✅ 2GB bandwidth

When you exceed these limits:
1. Supabase Pro: $25/month (unlimited projects)
2. Vercel Pro: $20/month (more bandwidth)

## 🎯 Features Working Out-of-the-Box

- ✅ Real-time vote updates via WebSockets
- ✅ One vote per LLM per user (fingerprint-based)
- ✅ Live statistics and rankings
- ✅ Search and sort functionality
- ✅ Mobile responsive design
- ✅ Instant updates across all connected users
- ✅ No server management required

## 🛠️ Optional Enhancements

### Add Custom Domain:
1. In Vercel dashboard → Settings → Domains
2. Add your domain (e.g., `llm-tracker.com`)
3. Follow DNS configuration instructions

### Enable Analytics:
1. Vercel Analytics (built-in, one click enable)
2. Or add Google Analytics ID in `.env.local`

### Rate Limiting (if needed):
Supabase automatically rate-limits to prevent abuse.

## 📞 Support

- **Supabase Issues**: [Discord](https://discord.supabase.com)
- **Vercel Issues**: [Discord](https://vercel.com/discord)
- **App Issues**: Create an issue in your GitHub repo

---

## 🎉 Congratulations!

You now have a production-ready, real-time voting app that:
- Costs $0 for up to 10k users/month
- Updates instantly for all users
- Requires zero server maintenance
- Scales automatically

Happy voting! 🚀