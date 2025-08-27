# Production Setup Guide

## Overview
This LLM Popularity Tracker can run in two modes:
1. **Simple Mode** (Default): File-based storage, no external dependencies
2. **Production Mode**: PostgreSQL + Redis for high-scale operations (500K+ users/month)

## Quick Start (Simple Mode)

No database setup required! The app will automatically use file-based storage:

```bash
npm install
npm run dev
```

Visit http://localhost:3000

## Production Setup

### Prerequisites

1. **PostgreSQL** (v14+)
2. **Redis** (v6+)
3. **Node.js** (v18+)

### Step 1: Install Dependencies

```bash
# Install PostgreSQL
# macOS
brew install postgresql@14
brew services start postgresql@14

# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Windows
# Download from https://www.postgresql.org/download/windows/

# Install Redis
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt update
sudo apt install redis-server

# Windows
# Download from https://github.com/microsoftarchive/redis/releases
```

### Step 2: Configure Database

```bash
# Create database
psql -U postgres
CREATE DATABASE llm_tracker;
CREATE USER llm_user WITH PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE llm_tracker TO llm_user;
\q
```

### Step 3: Environment Configuration

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your settings
# Required for production mode:
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=llm_tracker
POSTGRES_USER=llm_user
POSTGRES_PASSWORD=secure_password_here

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

NODE_ENV=production
```

### Step 4: Initialize Database

```bash
# Run migrations
npm run db:migrate

# Seed initial data
npm run db:seed

# Or reset and seed in one command
npm run db:reset -- --seed
```

### Step 5: Start Application

```bash
# Development mode
npm run dev

# Production build
npm run build
npm run start
```

### Step 6: Verify Setup

Check the health endpoint:
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "checks": {
    "database": {
      "postgres": true,
      "redis": true
    },
    "cache": {
      "status": "healthy",
      "latency": "2ms"
    }
  }
}
```

## Docker Setup (Recommended for Production)

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: llm_tracker
      POSTGRES_USER: llm_user
      POSTGRES_PASSWORD: secure_password_here
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://llm_user:secure_password_here@postgres:5432/llm_tracker
      REDIS_URL: redis://redis:6379
      NODE_ENV: production
    depends_on:
      - postgres
      - redis

volumes:
  postgres_data:
  redis_data:
```

Run with Docker:
```bash
docker-compose up -d
docker-compose exec app npm run db:migrate
docker-compose exec app npm run db:seed
```

## Scaling Guide

### Current Capacity
- **Simple Mode**: ~10K users/month
- **Production Mode**: 500K+ users/month

### Scaling Steps

#### Phase 1: Single Server (50K users)
- Current setup with optimizations
- Enable Redis caching
- Use PM2 for process management

#### Phase 2: Horizontal Scaling (150K users)
```nginx
# nginx.conf
upstream app_cluster {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}
```

#### Phase 3: Database Scaling (500K users)
- PostgreSQL read replicas
- Redis Cluster mode
- CDN for static assets

#### Phase 4: Microservices (1M+ users)
- Separate vote service
- Analytics service
- Real-time service (WebSockets)

## Monitoring

### Key Metrics
- Response times < 100ms
- Database connections < 80% of pool
- Redis memory usage < 75%
- CPU usage < 70%

### Recommended Tools
- **APM**: New Relic, DataDog
- **Logging**: ELK Stack, Loggly
- **Monitoring**: Prometheus + Grafana
- **Error Tracking**: Sentry

## Security Checklist

✅ Environment variables secured  
✅ Rate limiting enabled  
✅ Input validation active  
✅ SQL injection protection  
✅ XSS protection headers  
✅ CSRF protection  
✅ Fraud detection algorithms  
✅ Security headers configured  

## Troubleshooting

### App falls back to file storage
- Check PostgreSQL connection
- Verify Redis is running
- Review .env configuration
- Check logs: `npm run dev` shows connection status

### Database connection errors
```bash
# Test PostgreSQL
psql -U llm_user -d llm_tracker -h localhost

# Test Redis
redis-cli ping
```

### Performance issues
1. Check database indexes: `npm run db:migrate`
2. Clear Redis cache: `redis-cli FLUSHDB`
3. Review slow queries in logs
4. Enable query logging in .env: `LOG_LEVEL=debug`

## Support

For issues, please check:
1. Application logs
2. Health endpoint: `/api/health`
3. GitHub Issues: https://github.com/yourusername/llm-popularity-tracker/issues