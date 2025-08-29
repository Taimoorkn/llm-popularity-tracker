-- ============================================
-- YOUR ORIGINAL SCHEMA WITH ONLY DELETE FIX
-- ============================================
DROP TABLE IF EXISTS votes CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS vote_stats_aggregate CASCADE;
DROP TABLE IF EXISTS global_stats CASCADE;
DROP TABLE IF EXISTS llms CASCADE;
DROP FUNCTION IF EXISTS handle_vote CASCADE;
DROP FUNCTION IF EXISTS get_user_votes CASCADE;
DROP FUNCTION IF EXISTS update_vote_aggregates CASCADE;

-- ============================================
-- CORE TABLES (YOUR ORIGINAL)
-- ============================================

CREATE TABLE llms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  release_year INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  llm_id TEXT NOT NULL REFERENCES llms(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  vote_type INTEGER NOT NULL CHECK (vote_type IN (-1, 1)),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(llm_id, fingerprint)
);

CREATE TABLE sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fingerprint TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  vote_count INTEGER DEFAULT 0,
  last_vote_at TIMESTAMP WITH TIME ZONE,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- AGGREGATE TABLE (YOUR ORIGINAL)
-- ============================================

CREATE TABLE vote_stats_aggregate (
  llm_id TEXT PRIMARY KEY REFERENCES llms(id) ON DELETE CASCADE,
  total_votes INTEGER DEFAULT 0,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  unique_voters INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- VIEWS (YOUR ORIGINAL)
-- ============================================

CREATE VIEW global_stats AS
SELECT 
  1 as id,
  (SELECT COUNT(*) FROM votes) as total_votes,
  COALESCE(SUM(unique_voters), 0) as unique_voters,
  (SELECT COUNT(*) FROM votes WHERE created_at > NOW() - INTERVAL '1 hour') as votes_last_hour,
  (SELECT COUNT(*) FROM votes WHERE created_at > CURRENT_DATE) as votes_today,
  (SELECT llm_id FROM vote_stats_aggregate ORDER BY total_votes DESC LIMIT 1) as top_model,
  (SELECT MAX(total_votes) FROM vote_stats_aggregate) as top_model_votes,
  NOW() as last_updated
FROM vote_stats_aggregate;

CREATE VIEW vote_counts AS
SELECT 
  l.id as llm_id,
  l.name,
  l.company,
  COALESCE(v.total_votes, 0) as total_votes,
  COALESCE(v.upvotes, 0) as upvotes,
  COALESCE(v.downvotes, 0) as downvotes,
  COALESCE(v.unique_voters, 0) as unique_voters
FROM llms l
LEFT JOIN vote_stats_aggregate v ON l.id = v.llm_id
ORDER BY total_votes DESC;

-- ============================================
-- YOUR ORIGINAL HANDLE_VOTE FUNCTION (WORKS!)
-- ============================================

CREATE OR REPLACE FUNCTION handle_vote(
  p_llm_id TEXT,
  p_fingerprint TEXT,
  p_vote_type INTEGER,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_previous_vote INTEGER;
  v_recent_votes INTEGER;
  v_last_vote_time TIMESTAMP;
  v_result JSON;
BEGIN
  -- Check rate limiting (5 votes per minute max)
  SELECT COUNT(*), MIN(created_at) INTO v_recent_votes, v_last_vote_time
  FROM votes 
  WHERE fingerprint = p_fingerprint 
    AND created_at > NOW() - INTERVAL '1 minute';
  
  IF v_recent_votes >= 5 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Rate limit exceeded. Please wait before voting again.',
      'wait_seconds', GREATEST(0, 60 - EXTRACT(EPOCH FROM (NOW() - v_last_vote_time))::INTEGER)
    );
  END IF;
  
  -- Get previous vote if exists
  SELECT vote_type INTO v_previous_vote
  FROM votes
  WHERE llm_id = p_llm_id AND fingerprint = p_fingerprint
  FOR UPDATE;
  
  -- If same vote, do nothing
  IF v_previous_vote = p_vote_type THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Vote unchanged',
      'previous_vote', v_previous_vote
    );
  END IF;
  
  -- Handle vote deletion (vote_type = 0)
  IF p_vote_type = 0 THEN
    DELETE FROM votes 
    WHERE llm_id = p_llm_id AND fingerprint = p_fingerprint;
  ELSE
    -- Insert or update vote
    INSERT INTO votes (llm_id, fingerprint, vote_type, ip_address, user_agent)
    VALUES (p_llm_id, p_fingerprint, p_vote_type, p_ip_address, p_user_agent)
    ON CONFLICT (llm_id, fingerprint)
    DO UPDATE SET 
      vote_type = EXCLUDED.vote_type,
      updated_at = NOW();
  END IF;
  
  -- Update session activity with last vote time
  INSERT INTO sessions (fingerprint, ip_address, user_agent, vote_count, last_vote_at)
  VALUES (p_fingerprint, p_ip_address, p_user_agent, 1, NOW())
  ON CONFLICT (fingerprint)
  DO UPDATE SET 
    vote_count = sessions.vote_count + 1,
    last_vote_at = NOW(),
    last_activity = NOW();
  
  -- Update aggregate for this specific LLM
  WITH vote_summary AS (
    SELECT 
      COALESCE(SUM(vote_type), 0) as total,
      COUNT(CASE WHEN vote_type = 1 THEN 1 END) as ups,
      COUNT(CASE WHEN vote_type = -1 THEN 1 END) as downs,
      COUNT(DISTINCT fingerprint) as voters
    FROM votes
    WHERE llm_id = p_llm_id
  )
  INSERT INTO vote_stats_aggregate (llm_id, total_votes, upvotes, downvotes, unique_voters)
  SELECT p_llm_id, total, ups, downs, voters FROM vote_summary
  ON CONFLICT (llm_id) DO UPDATE SET
    total_votes = EXCLUDED.total_votes,
    upvotes = EXCLUDED.upvotes,
    downvotes = EXCLUDED.downvotes,
    unique_voters = EXCLUDED.unique_voters,
    last_updated = NOW();
  
  -- Return success with vote counts
  SELECT json_build_object(
    'success', true,
    'previous_vote', v_previous_vote,
    'new_vote', p_vote_type,
    'vote_count', (SELECT total_votes FROM vote_stats_aggregate WHERE llm_id = p_llm_id)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- ADD SECURITY DEFINER!

-- ============================================
-- YOUR OTHER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION get_user_votes(p_fingerprint TEXT)
RETURNS JSON AS $$
BEGIN
  RETURN COALESCE(
    (SELECT json_object_agg(llm_id, vote_type)
     FROM votes
     WHERE fingerprint = p_fingerprint),
    '{}'::json
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_all_aggregates() 
RETURNS void AS $$
BEGIN
  INSERT INTO vote_stats_aggregate (llm_id, total_votes, upvotes, downvotes, unique_voters)
  SELECT 
    l.id,
    COALESCE(SUM(v.vote_type), 0),
    COALESCE(COUNT(CASE WHEN v.vote_type = 1 THEN 1 END), 0),
    COALESCE(COUNT(CASE WHEN v.vote_type = -1 THEN 1 END), 0),
    COALESCE(COUNT(DISTINCT v.fingerprint), 0)
  FROM llms l
  LEFT JOIN votes v ON l.id = v.llm_id
  GROUP BY l.id
  ON CONFLICT (llm_id) DO UPDATE SET
    total_votes = EXCLUDED.total_votes,
    upvotes = EXCLUDED.upvotes,
    downvotes = EXCLUDED.downvotes,
    unique_voters = EXCLUDED.unique_voters,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (FIXED!)
-- ============================================

ALTER TABLE llms ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_stats_aggregate ENABLE ROW LEVEL SECURITY;

-- LLMs policies
CREATE POLICY "Public can read LLMs" ON llms
  FOR SELECT USING (true);

-- Votes policies (FIXED FOR DELETE!)
CREATE POLICY "Public can read votes" ON votes
  FOR SELECT USING (true);

CREATE POLICY "Public can insert votes" ON votes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can update votes" ON votes
  FOR UPDATE USING (true);

-- THIS IS THE FIX: Allow deletion
CREATE POLICY "Public can delete votes" ON votes
  FOR DELETE USING (true);

-- Sessions policies
CREATE POLICY "Public can read sessions" ON sessions
  FOR SELECT USING (true);

CREATE POLICY "Public can manage sessions" ON sessions
  FOR ALL USING (true);

-- Aggregate tables policies
CREATE POLICY "Public can read aggregates" ON vote_stats_aggregate
  FOR SELECT USING (true);

-- ============================================
-- INDEXES (YOUR ORIGINAL)
-- ============================================

CREATE INDEX idx_votes_llm_fingerprint ON votes(llm_id, fingerprint);
CREATE INDEX idx_votes_fingerprint_created ON votes(fingerprint, created_at DESC);
CREATE INDEX idx_votes_created_at ON votes(created_at DESC);
CREATE INDEX idx_sessions_fingerprint ON sessions(fingerprint);
CREATE INDEX idx_sessions_last_vote ON sessions(last_vote_at DESC);
CREATE INDEX idx_vote_stats_total_votes ON vote_stats_aggregate(total_votes DESC);

-- ============================================
-- REALTIME (YOUR ORIGINAL)
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE vote_stats_aggregate;

-- ============================================
-- INSERT LLM DATA
-- ============================================

INSERT INTO llms (id, name, company, release_year) VALUES
('gpt-4o', 'GPT-4o', 'OpenAI', 2024),
('claude-3-5-sonnet', 'Claude 3.5 Sonnet', 'Anthropic', 2024),
('gemini-ultra', 'Gemini Ultra', 'Google', 2024),
('llama-3-70b', 'Llama 3 70B', 'Meta', 2024),
('mistral-large', 'Mistral Large', 'Mistral AI', 2024),
('command-r-plus', 'Command R+', 'Cohere', 2024),
('grok', 'Grok', 'xAI', 2023),
('perplexity', 'Perplexity', 'Perplexity AI', 2024),
('qwen-2-5', 'Qwen 2.5', 'Alibaba', 2024),
('deepseek-coder', 'DeepSeek Coder', 'DeepSeek', 2024),
('phi-3', 'Phi-3', 'Microsoft', 2024),
('falcon-180b', 'Falcon 180B', 'TII UAE', 2023),
('vicuna-33b', 'Vicuna-33B', 'LMSYS', 2023),
('solar-10-7b', 'SOLAR-10.7B', 'Upstage AI', 2024),
('yi-34b', 'Yi-34B', '01.AI', 2024),
('mixtral-8x7b', 'Mixtral 8x7B', 'Mistral AI', 2024),
('bard', 'Bard (Gemini Pro)', 'Google', 2024),
('ernie-4', 'ERNIE 4.0', 'Baidu', 2024),
('stablelm-2', 'StableLM 2', 'Stability AI', 2024),
('inflection-2-5', 'Inflection-2.5', 'Inflection AI', 2024);

-- Initialize aggregates
INSERT INTO vote_stats_aggregate (llm_id, total_votes, upvotes, downvotes, unique_voters)
SELECT id, 0, 0, 0, 0 FROM llms;

-- ============================================
-- CRON JOB SETUP
-- ============================================

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the aggregate update function to run every 5 seconds
SELECT cron.schedule(
  'update-vote-aggregates',
  '*/10 * * * * *',
  'SELECT update_all_aggregates();'
);