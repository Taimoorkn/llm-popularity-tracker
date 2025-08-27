# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start development server at http://localhost:3000
- `npm run build` - Build production version
- `npm run start` - Start production server
- `npm run lint` - Run ESLint checks

### Database Operations
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed initial data
- `npm run db:reset` - Reset database (use --seed flag to reseed)

### Docker
- `docker-compose up -d` - Start all services (PostgreSQL, Redis, App)
- `docker-compose down` - Stop all services
- `docker-compose logs -f` - View logs
- `docker-compose down -v` - Complete cleanup (removes all data)

## Architecture

### Overview
This is a Next.js 15 application for tracking and voting on LLM popularity. Users can upvote/downvote various LLMs, with real-time updates and persistent storage. The app uses production-ready database storage with PostgreSQL and Redis, designed to handle 500k+ concurrent users.

### Tech Stack
- **Frontend**: Next.js 15, React 19, Zustand, Tailwind CSS, Framer Motion, Recharts
- **Backend**: Node.js, Express middleware
- **Database**: PostgreSQL (production) or file-based JSON (development)
- **Caching**: Redis (production) or in-memory (development)
- **Security**: JWT, bcrypt, rate limiting, Joi validation
- **Real-time**: Pusher (optional), polling-based updates
- **Deployment**: Docker, Docker Compose, Nginx

### Key Components

**Frontend State Management**
- Uses Zustand (`store/useVoteStore.js`) for global state management
- Handles voting, rankings, stats, and real-time polling
- Optimistic UI updates with rollback on failure
- Auto-syncs with backend every 10 seconds

**Data Flow**
1. Client votes trigger optimistic UI updates via Zustand
2. API calls to `/api/vote` persist changes server-side
3. DatabaseVoteManager handles persistence in PostgreSQL
4. Session-based voting using httpOnly cookies prevents manipulation
5. Real-time polling every 5 seconds keeps data fresh
6. Redis caches frequently accessed data and handles pub/sub for real-time updates

**Vote System Design**
- Session-based voting (one vote per LLM per session)
- Vote types: upvote (+1), downvote (-1), neutral (0)
- Tracks per-session votes in memory, aggregate votes on disk/database
- Calculates trending models based on last hour activity
- Fraud detection with fingerprinting and rate limiting

**Storage Architecture**
- **PostgreSQL Database**:
   - `lib/vote-manager-db.js` - Database operations
   - `lib/database.js` - Connection pooling
   - Stores votes, user sessions, and analytics
   - Migrations in `scripts/migrate.js`
   
- **Redis Cache**:
   - Session storage and caching layer
   - Real-time pub/sub for vote updates
   - Rate limiting and fraud detection
   - Activity tracking

**API Endpoints**
- `POST /api/vote` - Submit a vote (rate limited: 60/min)
- `POST /api/vote/sync` - Sync user votes (rate limited: 100/min)
- `GET /api/stats` - Get statistics (rate limited: 200/min)
- `GET /api/health` - Health check (unlimited)

**Key Files Structure**
- `app/page.js` - Main voting interface with search, sort, filtering and real-time polling
- `app/layout.js` - Root layout with metadata and providers
- `app/api/` - API route handlers
- `components/` - React components (Header, LLMCard, StatsPanel, VoteChart)
- `lib/vote-manager-wrapper.js` - Database manager initialization
- `lib/vote-manager-db.js` - PostgreSQL database operations
- `lib/cache.js` - Redis caching and pub/sub
- `lib/llm-data.js` - Static LLM definitions (20 models)
- `lib/middleware.js` - Rate limiting and security middleware
- `lib/logger.js` - Logging configuration (Winston/Pino)
- `store/useVoteStore.js` - Zustand store with real-time sync

**UI Components**
- Framer Motion for smooth animations
- Tailwind CSS with custom dark theme
- Recharts for vote visualization
- Lucide React for icons
- Sonner for toast notifications
- Responsive design with mobile support

**Security Features**
- Rate limiting per endpoint
- Input validation with Joi schemas
- SQL injection protection
- XSS protection headers
- CSRF protection
- Session fingerprinting
- Security headers in Nginx

## Environment Variables

### Required for Production
- `DATABASE_URL` - PostgreSQL connection string
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `REDIS_URL` or `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- `JWT_SECRET` - Secret for JWT tokens
- `SESSION_SECRET` - Secret for sessions

### Optional
- `NEXT_PUBLIC_PUSHER_APP_KEY`, `PUSHER_APP_ID`, `PUSHER_APP_SECRET` - For real-time updates
- `NEXT_PUBLIC_FPJS_PUBLIC_API_KEY` - FingerprintJS for fraud detection
- `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` - Rate limiting config
- `ENABLE_ANALYTICS`, `ENABLE_REAL_TIME` - Feature flags

## Docker Deployment

The project includes a complete Docker setup:
- `Dockerfile` - Multi-stage Alpine build
- `docker-compose.yml` - PostgreSQL + Redis + App + Nginx
- `nginx.conf` - Reverse proxy with caching and rate limiting
- Health checks for all services
- Automatic database migration and seeding

## Scaling Strategy
1. **Phase 1**: Single server, file storage → 10K users
2. **Phase 2**: Database + Redis → 50K users  
3. **Phase 3**: Load balancer + 3 instances → 150K users
4. **Phase 4**: Read replicas + Redis cluster → 500K users
5. **Phase 5**: Microservices + CDN → 1M+ users

## Important Considerations

- Vote data persists to PostgreSQL with Redis caching
- Session cookies expire after 30 days
- Real-time updates via polling every 5 seconds and Redis pub/sub
- Database uses connection pooling and prepared statements
- The app tracks hourly and daily voting statistics
- No authentication system - voting is session-based only
- Rate limiting is enforced at both application and Nginx level
- All LLM logos are loaded from remote CDNs (configured in next.config.mjs)
- The app auto-creates necessary database tables on first run
- Designed to handle 500k+ concurrent users with proper scaling