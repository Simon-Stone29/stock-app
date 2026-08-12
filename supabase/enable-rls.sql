-- Row Level Security Setup for Stock App
-- Run this in Supabase SQL Editor when ready to enable security
-- IMPORTANT: Update admin scripts to use service role key BEFORE running this (see instructions below)

-- ========================================
-- STEP 1: Create Policies (BEFORE enabling RLS)
-- ========================================

-- Users table: anyone can read, users can insert/update their own record
CREATE POLICY "Anyone can read users" ON users
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own record" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own record" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Weekly picks: anyone can read, users can manage their own picks
CREATE POLICY "Anyone can read picks" ON weekly_picks
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own picks" ON weekly_picks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own picks" ON weekly_picks
  FOR DELETE USING (auth.uid() = user_id);

-- Scores: read-only for users (admin scripts write via service role key)
CREATE POLICY "Anyone can read scores" ON scores
  FOR SELECT USING (true);

-- Stock prices: read-only for users
CREATE POLICY "Anyone can read stock_prices" ON stock_prices
  FOR SELECT USING (true);

-- Stocks: read-only for all
CREATE POLICY "Anyone can read stocks" ON stocks
  FOR SELECT USING (true);

-- ========================================
-- STEP 2: Enable RLS on all tables
-- ========================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;

-- ========================================
-- Verification: Check RLS is enabled
-- ========================================

SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Should show rowsecurity = true for all tables

-- ========================================
-- ROLLBACK (if something breaks)
-- ========================================

-- Uncomment these to disable RLS in an emergency:
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE weekly_picks DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE scores DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE stock_prices DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE stocks DISABLE ROW LEVEL SECURITY;
