-- ============================================
-- CLEAN SLATE - DROP EVERYTHING FIRST
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
-- CORE TABLES
-- ============================================

-- Create LLMs table
CREATE TABLE llms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  description TEXT,
  logo TEXT,
  image TEXT,
  color TEXT,
  release_year INTEGER,
  use_cases TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create votes table with fingerprint-based voting
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

-- Create sessions table for tracking users
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
-- AGGREGATE TABLE (ONLY ONE - NO GLOBAL_STATS)
-- ============================================

-- Create aggregated stats table
CREATE TABLE vote_stats_aggregate (
  llm_id TEXT PRIMARY KEY REFERENCES llms(id) ON DELETE CASCADE,
  total_votes INTEGER DEFAULT 0,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  unique_voters INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- VIEWS (INCLUDING GLOBAL STATS AS A VIEW)
-- ============================================

-- Global stats as a VIEW - no locking issues!
CREATE VIEW global_stats AS
SELECT 
  1 as id,
  COALESCE(SUM(total_votes), 0) as total_votes,
  COALESCE(SUM(unique_voters), 0) as unique_voters,
  (SELECT COUNT(*) FROM votes WHERE created_at > NOW() - INTERVAL '1 hour') as votes_last_hour,
  (SELECT COUNT(*) FROM votes WHERE created_at > CURRENT_DATE) as votes_today,
  (SELECT llm_id FROM vote_stats_aggregate ORDER BY total_votes DESC LIMIT 1) as top_model,
  (SELECT MAX(total_votes) FROM vote_stats_aggregate) as top_model_votes,
  NOW() as last_updated
FROM vote_stats_aggregate;

-- Backward compatibility view
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
-- FUNCTIONS
-- ============================================

-- Updated handle_vote with rate limiting and no global_stats update
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
  SELECT COUNT(*), MAX(created_at) INTO v_recent_votes, v_last_vote_time
  FROM votes 
  WHERE fingerprint = p_fingerprint 
    AND created_at > NOW() - INTERVAL '1 minute';
  
  IF v_recent_votes >= 5 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Rate limit exceeded. Please wait before voting again.',
      'wait_seconds', 60 - EXTRACT(EPOCH FROM (NOW() - v_last_vote_time))::INTEGER
    );
  END IF;
  
  -- Get previous vote if exists
  SELECT vote_type INTO v_previous_vote
  FROM votes
  WHERE llm_id = p_llm_id AND fingerprint = p_fingerprint
  FOR UPDATE; -- Lock the row to prevent race conditions
  
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
  
  -- Update aggregate for this specific LLM only (no global_stats!)
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
$$ LANGUAGE plpgsql;

-- Function to get user votes
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

-- Periodic aggregate update (for cron job if needed)
CREATE OR REPLACE FUNCTION update_all_aggregates() 
RETURNS void AS $$
BEGIN
  -- Rebuild all aggregates from votes table
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
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE llms ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_stats_aggregate ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICIES (FIXED)
-- ============================================

-- LLMs policies
CREATE POLICY "Public can read LLMs" ON llms
  FOR SELECT USING (true);

-- Votes policies (more restrictive)
CREATE POLICY "Public can read votes" ON votes
  FOR SELECT USING (true);

CREATE POLICY "Public can insert votes" ON votes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can update votes" ON votes
  FOR UPDATE USING (true);

-- DELETE only allowed via the handle_vote function
CREATE POLICY "Only functions can delete votes" ON votes
  FOR DELETE USING (false);

-- Sessions policies
CREATE POLICY "Public can read sessions" ON sessions
  FOR SELECT USING (true);

CREATE POLICY "Public can manage sessions" ON sessions
  FOR ALL USING (true);

-- Aggregate tables policies
CREATE POLICY "Public can read aggregates" ON vote_stats_aggregate
  FOR SELECT USING (true);

-- ============================================
-- INDEXES (OPTIMIZED)
-- ============================================

CREATE INDEX idx_votes_llm_fingerprint ON votes(llm_id, fingerprint);
CREATE INDEX idx_votes_fingerprint_created ON votes(fingerprint, created_at DESC);
CREATE INDEX idx_votes_created_at ON votes(created_at DESC);
CREATE INDEX idx_sessions_fingerprint ON sessions(fingerprint);
CREATE INDEX idx_sessions_last_vote ON sessions(last_vote_at DESC);
CREATE INDEX idx_vote_stats_total_votes ON vote_stats_aggregate(total_votes DESC);

-- ============================================
-- REALTIME (ONLY AGGREGATES)
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE vote_stats_aggregate;

-- ============================================
-- INSERT LLM DATA
-- ============================================

INSERT INTO llms (id, name, company, description, logo, image, color, release_year, use_cases) VALUES
('gpt-4o', 'GPT-4o', 'OpenAI', 'Most advanced multimodal AI with vision, analysis, and coding capabilities', '🤖', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/OpenAI_Logo.svg/200px-OpenAI_Logo.svg.png', 'from-green-500 to-emerald-600', 2024, ARRAY['General purpose', 'Code generation', 'Creative writing', 'Vision tasks']),
('claude-3-5-sonnet', 'Claude 3.5 Sonnet', 'Anthropic', 'Balanced model excelling at analysis, coding, and nuanced conversation', '🧠', 'https://www.anthropic.com/_next/static/media/claude-logo.2f5f0b53.svg', 'from-orange-500 to-amber-600', 2024, ARRAY['Code analysis', 'Research', 'Writing', 'Complex reasoning']),
('gemini-ultra', 'Gemini Ultra', 'Google', 'Google''s flagship model with strong multimodal and reasoning abilities', '💎', 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg', 'from-blue-500 to-cyan-600', 2024, ARRAY['Multimodal tasks', 'Scientific research', 'Code', 'Mathematics']),
('llama-3-70b', 'Llama 3 70B', 'Meta', 'Open-source powerhouse for customizable AI applications', '🦙', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Meta_Platforms_Inc._logo.svg/200px-Meta_Platforms_Inc._logo.svg.png', 'from-purple-500 to-violet-600', 2024, ARRAY['Open source projects', 'Fine-tuning', 'Research', 'Commercial use']),
('mistral-large', 'Mistral Large', 'Mistral AI', 'European AI champion with strong multilingual capabilities', '🌪️', 'https://docs.mistral.ai/img/logo.svg', 'from-red-500 to-pink-600', 2024, ARRAY['Multilingual tasks', 'European languages', 'Code', 'Efficiency']),
('command-r-plus', 'Command R+', 'Cohere', 'Enterprise-focused with excellent retrieval and grounding', '📊', 'https://cohere.com/favicon.svg', 'from-indigo-500 to-blue-600', 2024, ARRAY['Enterprise search', 'RAG systems', 'Document analysis', 'Business']),
('grok', 'Grok', 'xAI', 'Real-time knowledge with humor and unconventional responses', '🚀', 'https://grok.x.ai/assets/grok-logo-light.svg', 'from-gray-600 to-slate-700', 2023, ARRAY['Real-time info', 'Social media', 'Humor', 'Current events']),
('perplexity', 'Perplexity', 'Perplexity AI', 'Search-enhanced AI with real-time web access and citations', '🔍', 'https://www.perplexity.ai/favicon.svg', 'from-teal-500 to-cyan-600', 2024, ARRAY['Web search', 'Research', 'Fact-checking', 'Citations']),
('qwen-2-5', 'Qwen 2.5', 'Alibaba', 'Strong Asian language support with competitive performance', '🐉', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Alibaba-Logo.svg/200px-Alibaba-Logo.svg.png', 'from-yellow-500 to-orange-600', 2024, ARRAY['Chinese language', 'Asian markets', 'E-commerce', 'Translation']),
('deepseek-coder', 'DeepSeek Coder', 'DeepSeek', 'Specialized coding model with excellent debugging capabilities', '💻', 'https://github.com/deepseek-ai.png', 'from-green-600 to-teal-700', 2024, ARRAY['Code generation', 'Debugging', 'Code review', 'Documentation']),
('phi-3', 'Phi-3', 'Microsoft', 'Small but mighty model optimized for edge deployment', '⚡', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Microsoft_logo.svg/200px-Microsoft_logo.svg.png', 'from-blue-600 to-indigo-700', 2024, ARRAY['Edge computing', 'Mobile apps', 'Low resource', 'Fast inference']),
('falcon-180b', 'Falcon 180B', 'TII UAE', 'Open-source giant with strong performance across tasks', '🦅', 'https://www.tii.ae/sites/default/files/2022-12/TII-logo-WHITE.png', 'from-amber-600 to-yellow-700', 2023, ARRAY['Open source', 'Research', 'Arabic language', 'General purpose']),
('vicuna-33b', 'Vicuna-33B', 'LMSYS', 'Fine-tuned Llama model with improved conversational abilities', '🦌', 'https://github.com/lm-sys.png', 'from-pink-500 to-rose-600', 2023, ARRAY['Chatbots', 'Open source', 'Fine-tuning base', 'Research']),
('solar-10-7b', 'SOLAR-10.7B', 'Upstage AI', 'Efficient Korean model with strong multilingual capabilities', '☀️', 'https://github.com/upstage-ai.png', 'from-orange-500 to-red-600', 2023, ARRAY['Korean language', 'Efficient inference', 'Asian languages', 'Small models']),
('yi-34b', 'Yi-34B', '01.AI', 'Bilingual model excelling in Chinese and English tasks', '🎯', 'https://github.com/01-ai.png', 'from-purple-600 to-blue-600', 2023, ARRAY['Bilingual tasks', 'Chinese AI', 'Long context', 'Reasoning']),
('mixtral-8x7b', 'Mixtral 8x7B', 'Mistral AI', 'MoE architecture for efficient high-performance inference', '🔀', 'https://docs.mistral.ai/img/logo.svg', 'from-cyan-500 to-blue-600', 2023, ARRAY['Mixture of Experts', 'Efficient scaling', 'Code tasks', 'Multi-language']),
('stablelm-2', 'StableLM 2', 'Stability AI', 'Open model optimized for transparency and customization', '🏔️', 'https://github.com/stability-ai.png', 'from-indigo-500 to-purple-600', 2024, ARRAY['Open weights', 'Research friendly', 'Customization', 'Transparency']),
('internlm-2', 'InternLM 2', 'Shanghai AI Lab', 'Chinese model with strong reasoning and tool use', '🌐', 'https://github.com/internlm.png', 'from-blue-500 to-green-600', 2024, ARRAY['Tool use', 'Chinese tasks', 'Mathematical reasoning', 'Code']),
('wizardlm-2', 'WizardLM 2', 'Microsoft', 'Instruction-following model with complex reasoning', '🧙', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Microsoft_logo.svg/200px-Microsoft_logo.svg.png', 'from-purple-500 to-pink-600', 2024, ARRAY['Instructions', 'Complex tasks', 'Step-by-step', 'Education']),
('openchat-3-5', 'OpenChat 3.5', 'OpenChat', 'Community model achieving GPT-3.5 level performance', '💬', 'https://github.com/imoneoi.png', 'from-green-500 to-blue-600', 2024, ARRAY['Open source', 'Chat optimization', 'Community driven', 'Efficient']);

-- ============================================
-- INITIALIZE AGGREGATES
-- ============================================

-- Initialize empty aggregates for all LLMs
INSERT INTO vote_stats_aggregate (llm_id, total_votes, upvotes, downvotes, unique_voters)
SELECT id, 0, 0, 0, 0 FROM llms;

-- ============================================
-- VERIFICATION
-- ============================================

DO $$ 
BEGIN
  RAISE NOTICE '✅ Database reset completed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Key improvements:';
  RAISE NOTICE '1. ✅ global_stats is now a VIEW - no more locking issues';
  RAISE NOTICE '2. ✅ Added rate limiting (5 votes/minute) in handle_vote';
  RAISE NOTICE '3. ✅ Fixed RLS policies - votes can only be deleted via functions';
  RAISE NOTICE '4. ✅ Added FOR UPDATE lock to prevent race conditions';
  RAISE NOTICE '5. ✅ Better indexes for performance';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Test voting: SELECT handle_vote(''gpt-4o'', ''test-fingerprint'', 1);';
  RAISE NOTICE '2. Check stats: SELECT * FROM global_stats;';
  RAISE NOTICE '3. Update your Next.js to 15.2.3+';
END $$;