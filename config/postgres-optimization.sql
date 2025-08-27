-- PostgreSQL Performance Optimization for 200k+ concurrent users
-- Execute these queries to optimize database performance

-- 1. Create compound indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_user_votes_fingerprint_llm ON user_votes(fingerprint, llm_id);
CREATE INDEX IF NOT EXISTS idx_user_votes_created_at ON user_votes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_votes_llm_created ON user_votes(llm_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_votes_vote_count ON votes(vote_count DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_event_created ON analytics(event_type, created_at DESC);

-- 2. Create partial indexes for common WHERE conditions
CREATE INDEX IF NOT EXISTS idx_user_votes_non_zero ON user_votes(llm_id, created_at) 
WHERE vote_type != 0;

-- 3. Enable query statistics tracking
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 4. Table partitioning for user_votes by month
-- First, recreate user_votes as a partitioned table
ALTER TABLE user_votes RENAME TO user_votes_old;

CREATE TABLE user_votes (
    id SERIAL,
    fingerprint VARCHAR(255) NOT NULL,
    llm_id VARCHAR(100) NOT NULL,
    vote_type SMALLINT NOT NULL DEFAULT 0,
    previous_vote SMALLINT DEFAULT 0,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for the next 12 months
CREATE TABLE user_votes_2025_08 PARTITION OF user_votes
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE user_votes_2025_09 PARTITION OF user_votes
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE user_votes_2025_10 PARTITION OF user_votes
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE user_votes_2025_11 PARTITION OF user_votes
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE user_votes_2025_12 PARTITION OF user_votes
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
CREATE TABLE user_votes_2026_01 PARTITION OF user_votes
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE user_votes_2026_02 PARTITION OF user_votes
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE user_votes_2026_03 PARTITION OF user_votes
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE user_votes_2026_04 PARTITION OF user_votes
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE user_votes_2026_05 PARTITION OF user_votes
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE user_votes_2026_06 PARTITION OF user_votes
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE user_votes_2026_07 PARTITION OF user_votes
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

-- Migrate data from old table
INSERT INTO user_votes SELECT * FROM user_votes_old;

-- Create indexes on each partition
CREATE INDEX idx_user_votes_2025_08_fingerprint ON user_votes_2025_08(fingerprint);
CREATE INDEX idx_user_votes_2025_09_fingerprint ON user_votes_2025_09(fingerprint);
CREATE INDEX idx_user_votes_2025_10_fingerprint ON user_votes_2025_10(fingerprint);
CREATE INDEX idx_user_votes_2025_11_fingerprint ON user_votes_2025_11(fingerprint);
CREATE INDEX idx_user_votes_2025_12_fingerprint ON user_votes_2025_12(fingerprint);
CREATE INDEX idx_user_votes_2026_01_fingerprint ON user_votes_2026_01(fingerprint);
CREATE INDEX idx_user_votes_2026_02_fingerprint ON user_votes_2026_02(fingerprint);
CREATE INDEX idx_user_votes_2026_03_fingerprint ON user_votes_2026_03(fingerprint);
CREATE INDEX idx_user_votes_2026_04_fingerprint ON user_votes_2026_04(fingerprint);
CREATE INDEX idx_user_votes_2026_05_fingerprint ON user_votes_2026_05(fingerprint);
CREATE INDEX idx_user_votes_2026_06_fingerprint ON user_votes_2026_06(fingerprint);
CREATE INDEX idx_user_votes_2026_07_fingerprint ON user_votes_2026_07(fingerprint);

-- Drop old table
DROP TABLE user_votes_old;

-- 5. Create materialized views for vote summaries
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_vote_summary AS
SELECT 
    l.id as llm_id,
    COALESCE(v.vote_count, 0) as vote_count,
    COALESCE(v.positive_votes, 0) as positive_votes,
    COALESCE(v.negative_votes, 0) as negative_votes,
    RANK() OVER (ORDER BY COALESCE(v.vote_count, 0) DESC) as rank,
    NOW() as last_refreshed
FROM llms l
LEFT JOIN votes v ON l.id = v.llm_id
WITH DATA;

CREATE UNIQUE INDEX idx_mv_vote_summary_llm ON mv_vote_summary(llm_id);
CREATE INDEX idx_mv_vote_summary_rank ON mv_vote_summary(rank);

-- 6. Create materialized view for hourly statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_hourly_stats AS
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    llm_id,
    COUNT(*) as vote_count,
    COUNT(CASE WHEN vote_type = 1 THEN 1 END) as upvotes,
    COUNT(CASE WHEN vote_type = -1 THEN 1 END) as downvotes
FROM user_votes
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', created_at), llm_id
WITH DATA;

CREATE INDEX idx_mv_hourly_stats_hour ON mv_hourly_stats(hour DESC);
CREATE INDEX idx_mv_hourly_stats_llm ON mv_hourly_stats(llm_id, hour DESC);

-- 7. Create function for automatic materialized view refresh
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vote_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_hourly_stats;
END;
$$ LANGUAGE plpgsql;

-- 8. Create triggers for vote count caching
CREATE OR REPLACE FUNCTION update_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- New vote
        INSERT INTO votes (llm_id, vote_count, positive_votes, negative_votes)
        VALUES (
            NEW.llm_id,
            NEW.vote_type,
            CASE WHEN NEW.vote_type = 1 THEN 1 ELSE 0 END,
            CASE WHEN NEW.vote_type = -1 THEN 1 ELSE 0 END
        )
        ON CONFLICT (llm_id) DO UPDATE
        SET 
            vote_count = votes.vote_count + NEW.vote_type,
            positive_votes = votes.positive_votes + CASE WHEN NEW.vote_type = 1 THEN 1 ELSE 0 END,
            negative_votes = votes.negative_votes + CASE WHEN NEW.vote_type = -1 THEN 1 ELSE 0 END,
            updated_at = NOW();
    ELSIF TG_OP = 'UPDATE' THEN
        -- Vote changed
        UPDATE votes
        SET 
            vote_count = vote_count - OLD.vote_type + NEW.vote_type,
            positive_votes = positive_votes 
                - CASE WHEN OLD.vote_type = 1 THEN 1 ELSE 0 END
                + CASE WHEN NEW.vote_type = 1 THEN 1 ELSE 0 END,
            negative_votes = negative_votes 
                - CASE WHEN OLD.vote_type = -1 THEN 1 ELSE 0 END
                + CASE WHEN NEW.vote_type = -1 THEN 1 ELSE 0 END,
            updated_at = NOW()
        WHERE llm_id = NEW.llm_id;
    ELSIF TG_OP = 'DELETE' THEN
        -- Vote removed
        UPDATE votes
        SET 
            vote_count = vote_count - OLD.vote_type,
            positive_votes = positive_votes - CASE WHEN OLD.vote_type = 1 THEN 1 ELSE 0 END,
            negative_votes = negative_votes - CASE WHEN OLD.vote_type = -1 THEN 1 ELSE 0 END,
            updated_at = NOW()
        WHERE llm_id = OLD.llm_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_vote_counts ON user_votes;
CREATE TRIGGER trigger_update_vote_counts
    AFTER INSERT OR UPDATE OR DELETE ON user_votes
    FOR EACH ROW
    EXECUTE FUNCTION update_vote_counts();

-- 9. Vacuum and analyze all tables
VACUUM ANALYZE user_votes;
VACUUM ANALYZE votes;
VACUUM ANALYZE user_sessions;
VACUUM ANALYZE analytics;

-- 10. Update table statistics
ANALYZE;