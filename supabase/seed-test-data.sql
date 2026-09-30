-- seed-test-data.sql
-- Run this in Supabase SQL Editor after clearing downstream tables

-- ─── 1. USERS ────────────────────────────────────────────────────────────────
INSERT INTO users (id, email) VALUES
  ('6b6a9671-c9dc-4d3c-893d-598cfc6dbf45', 'simon@test.com'),
  ('899d351f-7c48-4e8c-b77c-6e00b960ff81', 'simon3@test.com'),
  ('eb94fa15-5498-4bf6-9041-92a9e8e0cf63', 'simon2@test.com')
ON CONFLICT (id) DO NOTHING;

-- ─── 2. WEEKLY PICKS (S&P 500 CONSTITUENTS ONLY) ─────────────────────────────

-- WEEK 1: 2025-05-05
INSERT INTO weekly_picks (user_id, symbol, percentage, week_start) VALUES
  -- Simon (Balanced Anchor)
  ('6b6a9671-c9dc-4d3c-893d-598cfc6dbf45', 'JNJ', 50, '2025-05-05'),
  ('6b6a9671-c9dc-4d3c-893d-598cfc6dbf45', 'MSFT', 50, '2025-05-05'),
  -- Simon3 (High-Beta Growth)
  ('899d351f-7c48-4e8c-b77c-6e00b960ff81', 'NVDA', 60, '2025-05-05'),
  ('899d351f-7c48-4e8c-b77c-6e00b960ff81', 'AMZN', 40, '2025-05-05'),
  -- Simon2 (FOMO / Peak Chaser)
  ('eb94fa15-5498-4bf6-9041-92a9e8e0cf63', 'META', 100, '2025-05-05');

-- WEEK 2: 2025-05-12
INSERT INTO weekly_picks (user_id, symbol, percentage, week_start) VALUES
  -- Simon (Balanced Anchor)
  ('6b6a9671-c9dc-4d3c-893d-598cfc6dbf45', 'AAPL', 50, '2025-05-12'),
  ('6b6a9671-c9dc-4d3c-893d-598cfc6dbf45', 'JNJ', 50, '2025-05-12'),
  -- Simon3 (High-Beta Growth)
  ('899d351f-7c48-4e8c-b77c-6e00b960ff81', 'NVDA', 70, '2025-05-12'),
  ('899d351f-7c48-4e8c-b77c-6e00b960ff81', 'META', 30, '2025-05-12'),
  -- Simon2 (FOMO / Peak Chaser)
  ('eb94fa15-5498-4bf6-9041-92a9e8e0cf63', 'NVDA', 100, '2025-05-12');

-- WEEK 3: 2025-05-19
INSERT INTO weekly_picks (user_id, symbol, percentage, week_start) VALUES
  -- Simon (Balanced Anchor)
  ('6b6a9671-c9dc-4d3c-893d-598cfc6dbf45', 'GOOGL', 50, '2025-05-19'),
  ('6b6a9671-c9dc-4d3c-893d-598cfc6dbf45', 'MSFT', 50, '2025-05-19'),
  -- Simon3 (High-Beta Growth)
  ('899d351f-7c48-4e8c-b77c-6e00b960ff81', 'NVDA', 50, '2025-05-19'),
  ('899d351f-7c48-4e8c-b77c-6e00b960ff81', 'AMZN', 50, '2025-05-19'),
  -- Simon2 (FOMO / Peak Chaser)
  ('eb94fa15-5498-4bf6-9041-92a9e8e0cf63', 'AMZN', 100, '2025-05-19');

-- WEEK 4: 2025-05-26
INSERT INTO weekly_picks (user_id, symbol, percentage, week_start) VALUES
  -- Simon (Balanced Anchor)
  ('6b6a9671-c9dc-4d3c-893d-598cfc6dbf45', 'MSFT', 50, '2025-05-26'),
  ('6b6a9671-c9dc-4d3c-893d-598cfc6dbf45', 'GOOGL', 50, '2025-05-26'),
  -- Simon3 (High-Beta Growth)
  ('899d351f-7c48-4e8c-b77c-6e00b960ff81', 'NVDA', 100, '2025-05-26'),
  -- Simon2 (FOMO / Peak Chaser)
  ('eb94fa15-5498-4bf6-9041-92a9e8e0cf63', 'AAPL', 100, '2025-05-26');