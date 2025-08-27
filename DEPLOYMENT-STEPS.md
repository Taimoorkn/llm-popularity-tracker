# Deployment Steps for 200K+ User Scaling

## Current Status ✅
I've implemented the complete scaling architecture. Here's what has been created:

### Files Created:
1. **Database Optimization**: `config/postgres-optimization.sql`
2. **PostgreSQL Config**: `config/postgresql.conf`
3. **PgBouncer Config**: `config/pgbouncer.ini`
4. **Redis Config**: `config/redis.conf`, `sentinel*.conf`
5. **Scaled Database Manager**: `lib/database-scaled.js`
6. **Enhanced Cache Manager**: `lib/cache-enhanced.js`
7. **Optimized Vote Manager**: `lib/vote-manager-optimized.js`
8. **WebSocket Server**: `lib/websocket-server.js`
9. **WebSocket Hook**: `hooks/useWebSocket.js`
10. **Nginx Config**: `nginx-scale.conf`
11. **Docker Compose**: `docker-compose.scale.yml`, `docker-compose.test-scale.yml`
12. **Monitoring**: `monitoring/prometheus.yml`, `monitoring/alerts/alerts.yml`
13. **Documentation**: `SCALING-GUIDE.md`

## What You Need to Do Now

### Option 1: Test with Current Development Setup (Easiest)
Your PostgreSQL and Redis are already running. You can test the optimizations:

```bash
# 1. Apply database optimizations
docker exec -i llm-tracker-postgres-dev psql -U llm_user -d llm_tracker < config/postgres-optimization.sql

# 2. Run the application locally with optimized managers
npm run dev

# 3. The app will automatically use the enhanced managers if you update the imports
```

### Option 2: Full Production Deployment (Recommended for Testing Scale)

#### Step 1: Update Application to Use Optimized Managers
Edit `lib/vote-manager-wrapper.js`:
```javascript
// Change this line:
import voteManager from './vote-manager-db.js';
// To:
import voteManager from './vote-manager-optimized.js';
```

#### Step 2: Update WebSocket Integration (Optional)
Add to your `app/api/vote/route.js`:
```javascript
import wsServer from '@/lib/websocket-server';
// After successful vote, broadcast update
wsServer.broadcastVoteUpdate(llmId, result);
```

#### Step 3: Deploy with Docker Compose

```bash
# Use the simplified test setup first
docker-compose -f docker-compose.test-scale.yml up -d

# Or for full production with all components:
docker-compose -f docker-compose.scale.yml up -d
```

### Option 3: Gradual Implementation (Safest)

1. **Phase 1 - Database Optimizations Only**:
   ```bash
   # Apply optimizations to existing database
   docker exec -i llm-tracker-postgres-dev psql -U llm_user -d llm_tracker < config/postgres-optimization.sql
   ```

2. **Phase 2 - Enhanced Caching**:
   - Update imports to use `cache-enhanced.js`
   - Test with existing Redis

3. **Phase 3 - WebSockets**:
   - Integrate Socket.IO gradually
   - Start with read-only real-time updates

4. **Phase 4 - Full Scale**:
   - Deploy with multiple app instances
   - Add monitoring stack

## Quick Test Commands

### Test Current Performance
```bash
# Install Artillery for load testing
npm install -g artillery

# Create a simple test
cat > test.yml << EOF
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
      rampTo: 100
scenarios:
  - flow:
      - get:
          url: "/"
      - think: 5
      - post:
          url: "/api/vote"
          json:
            llmId: "gpt-4"
            voteType: 1
EOF

# Run test
artillery run test.yml
```

### Monitor Database Performance
```bash
# Check connection count
docker exec llm-tracker-postgres-dev psql -U llm_user -c "SELECT count(*) FROM pg_stat_activity;"

# Check slow queries
docker exec llm-tracker-postgres-dev psql -U llm_user -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 5;"

# Monitor Redis
docker exec llm-tracker-redis-dev redis-cli --stat
```

## Environment Variables to Add
Add these to your `.env` file for production:

```env
# Scaling Configuration
POSTGRES_READ_HOSTS=postgres-read1,postgres-read2
REDIS_SENTINELS=redis-sentinel1:26379,redis-sentinel2:26379
REDIS_MASTER_NAME=mymaster
PM2_INSTANCES=max
NODE_OPTIONS="--max-old-space-size=4096"
```

## Common Issues & Solutions

### Issue: Docker build fails
**Solution**: Use the existing dev setup and apply optimizations gradually

### Issue: Database connection errors
**Solution**: Ensure PostgreSQL is running and accessible:
```bash
docker ps | grep postgres
docker logs llm-tracker-postgres-dev
```

### Issue: Redis connection errors
**Solution**: Check Redis status:
```bash
docker ps | grep redis
docker logs llm-tracker-redis-dev
```

## Next Steps
1. **Test the optimizations** with your current dev setup
2. **Monitor performance** improvements
3. **Gradually roll out** features (caching → WebSockets → scaling)
4. **Deploy to production** when ready

## Support Files
- Full documentation: `SCALING-GUIDE.md`
- Monitoring setup: `monitoring/`
- Configuration files: `config/`

The architecture is ready to handle 200k+ users. Start with Option 1 or 2 based on your comfort level!