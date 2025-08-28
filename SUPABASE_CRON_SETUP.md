# Supabase Cron Job Setup Guide

## Critical Setup Required for Production

This application requires a periodic cron job to update vote aggregates for optimal performance at scale.

## Why This is Necessary

The app uses aggregate tables (`vote_stats_aggregate` and `global_stats`) to avoid broadcasting individual vote events to all connected clients. Without the cron job, these aggregates become stale and stats won't update properly.

## Setup Instructions

### Method 1: Supabase Dashboard (Recommended)

1. **Navigate to your Supabase project dashboard**
   - Go to https://app.supabase.com
   - Select your project

2. **Go to Database → Extensions**
   - Enable the `pg_cron` extension if not already enabled
   - Click "Enable extension" for pg_cron

3. **Go to SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Create a new query

4. **Create the cron job** by running this SQL:

```sql
-- Schedule the aggregate update function to run every 5 seconds
SELECT cron.schedule(
  'update-vote-aggregates',           -- Job name
  '*/5 * * * * *',                    -- Every 5 seconds
  'SELECT update_vote_aggregates();'   -- Function to run
);

-- Verify the job was created
SELECT * FROM cron.job;
```

### Method 2: Using Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Create the cron job
supabase db push --file supabase/cron.sql
```

Create `supabase/cron.sql`:
```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage on cron schema to postgres
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule aggregate updates every 5 seconds
SELECT cron.schedule(
  'update-vote-aggregates',
  '*/5 * * * * *',
  'SELECT update_vote_aggregates();'
);
```

## Monitoring the Cron Job

### Check if cron job is running:
```sql
-- View all scheduled jobs
SELECT * FROM cron.job;

-- View job run history (last 10 runs)
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;

-- Check if aggregates are being updated
SELECT llm_id, total_votes, last_updated 
FROM vote_stats_aggregate 
ORDER BY last_updated DESC 
LIMIT 5;
```

### Check for errors:
```sql
-- Find failed job runs
SELECT * FROM cron.job_run_details 
WHERE status = 'failed' 
ORDER BY start_time DESC;
```

## Performance Tuning

### For 10k Monthly Active Users

**Recommended settings:**
- **Update frequency**: Every 5-10 seconds
- **Why**: Balances real-time feel with database load

```sql
-- 5 second updates (more real-time)
SELECT cron.schedule('update-vote-aggregates', '*/5 * * * * *', 'SELECT update_vote_aggregates();');

-- 10 second updates (less database load)
SELECT cron.schedule('update-vote-aggregates', '*/10 * * * * *', 'SELECT update_vote_aggregates();');
```

### For higher traffic (>50k MAU)

Consider these optimizations:
1. Increase update interval to 15-30 seconds
2. Add partial indexes on hot paths
3. Consider read replicas

## Troubleshooting

### Issue: Cron job not running
**Solution**: Ensure pg_cron extension is enabled and you have proper permissions

```sql
-- Check if extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Enable if missing
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### Issue: Aggregates not updating
**Solution**: Check the function exists and works

```sql
-- Test the function manually
SELECT update_vote_aggregates();

-- Check function definition
\df update_vote_aggregates
```

### Issue: High database CPU usage
**Solution**: Increase the cron interval

```sql
-- Delete existing job
SELECT cron.unschedule('update-vote-aggregates');

-- Create with longer interval (30 seconds)
SELECT cron.schedule('update-vote-aggregates', '*/30 * * * *', 'SELECT update_vote_aggregates();');
```

## Verification Checklist

- [ ] pg_cron extension is enabled
- [ ] Cron job appears in `cron.job` table
- [ ] Job runs appear in `cron.job_run_details`
- [ ] `vote_stats_aggregate.last_updated` is recent (< 10 seconds old)
- [ ] `global_stats.last_updated` is recent (< 10 seconds old)
- [ ] No failed jobs in last hour

## Alternative: Edge Function (if pg_cron unavailable)

If your Supabase plan doesn't support pg_cron, create an Edge Function:

```typescript
// supabase/functions/update-aggregates/index.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async () => {
  const { data, error } = await supabase.rpc('update_vote_aggregates')
  
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  
  return new Response(JSON.stringify({ success: true, updated: new Date() }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

Then schedule it using an external cron service (Vercel Cron, GitHub Actions, etc.)

## Important Notes

⚠️ **This setup is REQUIRED for production use**
- Without it, vote counts won't update in real-time
- Stats will be incorrect
- Performance will degrade with scale

✅ **Expected behavior after setup:**
- Vote aggregates update every 5-10 seconds
- All connected clients see updates simultaneously
- Minimal database load even with thousands of concurrent users