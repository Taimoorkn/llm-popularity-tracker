# LLM Popularity Tracker - 200K+ Users Scaling Guide

## Overview
This guide documents the implementation for scaling the LLM Popularity Tracker to handle 200,000+ concurrent users using free and open-source technologies.

## Architecture Components Implemented

### 1. Database Layer (PostgreSQL)
- **Connection Pooling**: PgBouncer configured for 10,000 max client connections
- **Read Replicas**: 2-3 PostgreSQL read replicas for load distribution
- **Query Optimizations**:
  - Compound indexes on frequently queried columns
  - Table partitioning for user_votes by month
  - Materialized views for vote summaries (5-minute refresh)
  - Database triggers for automatic vote count updates

### 2. Caching Architecture (Redis)
- **Multi-Layer Caching**:
  - L1: In-memory cache (60-second TTL)
  - L2: Redis distributed cache
  - L3: CDN edge caching via Nginx
- **Redis Sentinel**: 3-node setup for automatic failover
- **Cache Strategies**:
  - Vote counts: 1-minute TTL
  - User sessions: 24-hour TTL
  - Rankings: 5-minute TTL

### 3. Real-Time Communication (Socket.IO)
- WebSocket server with Redis adapter for horizontal scaling
- Room-based subscriptions for targeted updates
- Automatic reconnection with fallback to polling
- Client-side latency monitoring

### 4. Application Scaling
- Horizontal scaling with Docker Compose (4-8 instances)
- PM2 cluster mode for CPU utilization
- Optimized database queries with read replica routing
- Enhanced fraud detection with activity tracking

### 5. Load Balancing (Nginx)
- Least-connection algorithm for even distribution
- Separate upstream pools for HTTP and WebSocket
- Rate limiting zones:
  - API: 100 requests/second
  - Voting: 60 requests/minute
  - Static: 200 requests/second
- Response caching with cache invalidation

### 6. Monitoring Stack
- **Prometheus**: Metrics collection
- **Grafana**: Visualization dashboards
- **Exporters**:
  - Node Exporter (system metrics)
  - PostgreSQL Exporter
  - Redis Exporter
- **Alerts**: CPU, memory, disk, database connections

## Deployment Instructions

### Prerequisites
- Docker and Docker Compose installed
- At least 16GB RAM for production deployment
- SSD storage recommended

### Quick Start

1. **Clone and Configure Environment**
```bash
# Copy environment example
cp .env.example .env

# Edit .env with your configuration
nano .env
```

2. **Start Development Environment**
```bash
# Start PostgreSQL and Redis only
docker-compose up -d
```

3. **Production Deployment with Scaling**
```bash
# Start all services with scaling
docker-compose -f docker-compose.scale.yml up -d --scale app=4

# Monitor logs
docker-compose -f docker-compose.scale.yml logs -f

# Check service health
docker-compose -f docker-compose.scale.yml ps
```

### Database Setup

1. **Initialize Database**
```bash
# Run migrations
npm run db:migrate

# Apply optimizations
docker exec -i llm-postgres-primary psql -U llm_user -d llm_tracker < config/postgres-optimization.sql

# Seed initial data
npm run db:seed
```

2. **Setup Read Replicas**
```bash
# Replicas are automatically configured in docker-compose.scale.yml
# Monitor replication lag
docker exec llm-postgres-primary psql -U llm_user -c "SELECT * FROM pg_stat_replication;"
```

### Monitoring Setup

1. **Access Monitoring Dashboards**
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin)

2. **Import Grafana Dashboards**
- PostgreSQL Dashboard: ID 9628
- Redis Dashboard: ID 11835
- Node Exporter Dashboard: ID 1860

### Performance Tuning

#### PostgreSQL Tuning
```sql
-- Check slow queries
SELECT * FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;

-- Refresh materialized views manually
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vote_summary;
```

#### Redis Tuning
```bash
# Monitor Redis memory
docker exec llm-redis-primary redis-cli INFO memory

# Check Redis latency
docker exec llm-redis-primary redis-cli --latency
```

#### Application Tuning
```javascript
// Environment variables for tuning
PM2_INSTANCES=max         // Use all CPU cores
NODE_OPTIONS="--max-old-space-size=4096"  // Increase Node.js memory
```

## Scaling Phases

### Phase 1: Current Implementation (10K-50K users)
- Single PostgreSQL primary with read replicas
- Redis with Sentinel for HA
- 4 application instances
- Nginx load balancing

### Phase 2: Medium Scale (50K-100K users)
- Add more read replicas (3-4 total)
- Increase application instances (6-8)
- Enable CDN for static assets
- Implement API response compression

### Phase 3: Large Scale (100K-200K users)
- PostgreSQL connection pooling with PgBouncer
- Redis Cluster (6 nodes minimum)
- 8-12 application instances
- Geographic load distribution

### Phase 4: Ultra Scale (200K+ users)
- Database sharding by user fingerprint
- Multi-region deployment
- Edge computing with Cloudflare Workers
- Dedicated WebSocket servers

## Load Testing

### Using Artillery
```bash
# Install Artillery
npm install -g artillery

# Create test script
cat > load-test.yml << EOF
config:
  target: "http://localhost"
  phases:
    - duration: 60
      arrivalRate: 100
      rampTo: 1000
scenarios:
  - name: "Vote Flow"
    flow:
      - get:
          url: "/"
      - think: 5
      - post:
          url: "/api/vote"
          json:
            llmId: "gpt-4"
            voteType: 1
EOF

# Run load test
artillery run load-test.yml
```

### Expected Performance Metrics
- Response time p95: < 500ms
- Response time p99: < 1000ms
- Throughput: 5000+ requests/second
- WebSocket connections: 50,000+ concurrent
- Database connections: < 500 active
- Cache hit rate: > 80%

## Troubleshooting

### Common Issues

1. **Database Connection Exhaustion**
```bash
# Check connection count
docker exec llm-postgres-primary psql -U llm_user -c "SELECT count(*) FROM pg_stat_activity;"

# Kill idle connections
docker exec llm-postgres-primary psql -U llm_user -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < NOW() - INTERVAL '10 minutes';"
```

2. **Redis Memory Issues**
```bash
# Flush cache if needed
docker exec llm-redis-primary redis-cli FLUSHDB

# Monitor memory usage
docker exec llm-redis-primary redis-cli --stat
```

3. **Application Performance**
```bash
# Check Node.js memory
docker stats

# Restart specific instance
docker-compose -f docker-compose.scale.yml restart app_2
```

## Security Considerations

1. **Rate Limiting**: Configured at both Nginx and application level
2. **SQL Injection**: Using parameterized queries
3. **DDoS Protection**: Nginx rate limiting + connection limits
4. **Session Security**: HttpOnly cookies with secure flags
5. **Input Validation**: Joi schemas for all endpoints

## Maintenance

### Daily Tasks
- Monitor error logs
- Check database replication lag
- Review slow query logs

### Weekly Tasks
- Analyze performance metrics
- Update materialized views statistics
- Clean up old session data

### Monthly Tasks
- Database vacuum and analyze
- Update security patches
- Review and rotate logs

## Cost Estimation (Self-Hosted)

### Minimum Requirements
- Server: 16GB RAM, 8 vCPUs, 200GB SSD (~$80-120/month)
- Bandwidth: 1TB/month (~$10-20/month)
- Backup Storage: 100GB (~$5/month)
- **Total: ~$100-150/month**

### Recommended Setup (200K users)
- 3 Servers: 32GB RAM, 16 vCPUs each (~$450/month)
- Load Balancer: Dedicated (~$20/month)
- CDN: Cloudflare Free Tier
- Monitoring: Self-hosted (free)
- **Total: ~$500/month**

## Support

For issues or questions:
1. Check logs: `docker-compose logs [service-name]`
2. Review monitoring dashboards
3. Consult PostgreSQL and Redis documentation
4. Open an issue in the repository

## Next Steps

1. Implement automated backup strategy
2. Setup CI/CD pipeline for deployments
3. Add A/B testing framework
4. Implement feature flags for gradual rollouts
5. Consider microservices architecture for further scaling