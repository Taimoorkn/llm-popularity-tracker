# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start development server at http://localhost:3000
- `npm run build` - Build production version
- `npm run start` - Start production server
- `npm run lint` - Run ESLint checks

## Architecture

### Overview
This is a Next.js 15 application for tracking and voting on LLM popularity. Users can upvote/downvote various LLMs, with real-time updates and persistent storage.

### Key Components

**Frontend State Management**
- Uses Zustand (`store/useVoteStore.js`) for global state management
- Handles voting, rankings, stats, and real-time polling
- Optimistic UI updates with rollback on failure

**Data Flow**
1. Client votes trigger optimistic UI updates via Zustand
2. API calls to `/api/vote` persist changes server-side
3. VoteManager singleton handles vote persistence to `data/votes.json`
4. Session-based voting using httpOnly cookies prevents manipulation
5. Real-time polling every 10 seconds keeps data fresh

**Vote System Design**
- Session-based voting (one vote per LLM per session)
- Vote types: upvote (+1), downvote (-1), neutral (0)
- Tracks per-session votes in memory, aggregate votes on disk
- Calculates trending models based on last hour activity

**Key Files Structure**
- `app/page.js` - Main voting interface with search, sort, and filtering
- `lib/vote-manager.js` - Server-side vote persistence and statistics
- `lib/llm-data.js` - Static LLM definitions (20 models)
- `data/votes.json` - Persistent vote storage (auto-created)

**UI Components**
- Uses Framer Motion for animations
- Tailwind CSS for styling with dark theme support
- Recharts for vote visualization
- Lucide React for icons
- Sonner for toast notifications

## Important Considerations

- Vote data persists to `data/votes.json` - this file is auto-created and managed by VoteManager
- Session cookies expire after 30 days
- Votes save to disk every 10 votes to reduce I/O
- The app tracks hourly and daily voting statistics
- No authentication system - voting is session-based only