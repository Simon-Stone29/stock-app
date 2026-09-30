-- Row Level Security Setup for Portfolio Daily Tracking
-- This creates a daily percent-change model for both user and group performance.

-- ========================================
-- STEP 1: Drop existing daily tracking tables/policies if they exist
-- ========================================

DROP POLICY IF EXISTS "Users can read own daily portfolio" ON public.user_portfolio_daily;
DROP POLICY IF EXISTS "Users can insert own daily portfolio" ON public.user_portfolio_daily;
DROP POLICY IF EXISTS "Users can update own daily portfolio" ON public.user_portfolio_daily;
DROP POLICY IF EXISTS "Users can delete own daily portfolio" ON public.user_portfolio_daily;

DROP POLICY IF EXISTS "Anyone can read group portfolio daily" ON public.group_portfolio_daily;

DROP TABLE IF EXISTS public.user_portfolio_daily;
DROP TABLE IF EXISTS public.group_portfolio_daily;

-- ========================================
-- STEP 2: Create daily percentage-tracking tables
-- ========================================

CREATE TABLE public.user_portfolio_daily (
  user_id uuid NOT NULL,
  snapshot_date date NOT NULL,
  week_start date NOT NULL,
  portfolio_change_pct numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, snapshot_date)
);

CREATE TABLE public.group_portfolio_daily (
  snapshot_date date PRIMARY KEY,
  week_start date NOT NULL,
  portfolio_change_pct numeric NOT NULL DEFAULT 0
);

-- ========================================
-- STEP 3: RLS Policies
-- ========================================

-- Users can only see their own daily portfolio rows.
CREATE POLICY "Users can read own daily portfolio" ON public.user_portfolio_daily
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily portfolio" ON public.user_portfolio_daily
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily portfolio" ON public.user_portfolio_daily
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily portfolio" ON public.user_portfolio_daily
  FOR DELETE USING (auth.uid() = user_id);

-- Group portfolio is public read-only for the app / leaderboard view.
CREATE POLICY "Anyone can read group portfolio daily" ON public.group_portfolio_daily
  FOR SELECT USING (true);

-- ========================================
-- STEP 4: Enable RLS on the new tables
-- ========================================

ALTER TABLE public.user_portfolio_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_portfolio_daily ENABLE ROW LEVEL SECURITY;

-- ========================================
-- Verification: Check RLS is enabled
-- ========================================

SELECT table_name, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND table_name IN ('user_portfolio_daily', 'group_portfolio_daily');

-- Should show rowsecurity = true for both tables

-- ========================================
-- ROLLBACK (if something breaks)
-- ========================================

-- Uncomment these to disable RLS in an emergency:
-- ALTER TABLE public.user_portfolio_daily DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.group_portfolio_daily DISABLE ROW LEVEL SECURITY;
