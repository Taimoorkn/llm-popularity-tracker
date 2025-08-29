# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **real-time voting application** for tracking LLM popularity using:
- **Frontend**: Next.js 15, React 19, Zustand, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + WebSockets)  
- **Hosting**: Vercel (frontend) + Supabase (backend)
- **Real-time**: WebSocket connections via Supabase Realtime

## Architecture

### Simplified Cloud Architecture
```
Users → Vercel CDN → Next.js App → Supabase Cloud
                                    ├── PostgreSQL
                                    ├── Realtime WebSockets
                                    └── Auto REST APIs
```

### Key Features
- **Real-time voting**: Updates appear instantly for all users (<100ms)
- **Session-based voting**: One vote per LLM per user (fingerprint-based)
- **No server management**: Everything runs in the cloud
- **Free for 10k users/month**: Uses free tiers effectively

## Commands

```bash
npm run dev    # Start development server
npm run build  # Build for production  
npm start      # Start production server
npm run lint   # Run ESLint
```

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Key Files

### Frontend
- `app/page.js` - Main voting interface with real-time updates
- `components/LLMCard.jsx` - Individual LLM voting cards
- `store/useVoteStore.js` - Zustand store with Supabase integration

### Backend (Supabase)
- `lib/supabase/client.js` - Supabase client configuration
- `lib/supabase/vote-manager.js` - Vote management logic
- `supabase/schema.sql` - Database schema

### Data
- `lib/llm-data.js` - Static LLM definitions (20 models)
- `lib/fingerprint.js` - User fingerprinting for sessions

## Development Workflow

1. **Local Development**:
   - Set up Supabase project
   - Add credentials to `.env.local`
   - Run `npm run dev`

2. **Testing Real-time**:
   - Open app in multiple browser tabs
   - Vote in one tab
   - See instant updates in all tabs

3. **Deployment**:
   - Push to GitHub
   - Import to Vercel
   - Add env variables
   - Deploy!

## Important Notes

- **No Docker/PostgreSQL/Redis needed** - Everything is cloud-based
- **WebSockets for real-time** - Not polling
- **Fingerprint-based voting** - No auth required
- **200 concurrent connections** limit on free tier
- **Optimistic UI updates** with rollback on failure

## Deployment

### Vercel (Frontend)
- Automatic deployments from GitHub
- Environment variables in dashboard
- Global CDN included

### Supabase (Backend)
- Database + real-time in one service
- Row-level security for vote protection
- Auto-scaling included

## Performance

- **Response time**: <100ms for vote updates
- **Capacity**: 10,000 users/month on free tier
- **Concurrent users**: 200 WebSocket connections
- **Database**: 500MB storage (millions of votes)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No real-time updates | Check Supabase credentials |
| Votes not saving | Check Supabase dashboard logs |
| Connection errors | Verify WebSocket port not blocked |

## DO NOT

- Don't add complex backend logic (keep it simple)
- Don't add authentication (fingerprint is enough)
- Don't add paid services without asking
- Don't remove real-time WebSocket functionality
- Don't add polling - we use WebSockets!