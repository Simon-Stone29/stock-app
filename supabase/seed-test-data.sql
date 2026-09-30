-- seed-test-data.sql
-- Run this in Supabase SQL Editor after clearing

-- Users
INSERT INTO users (id, email) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@test.com'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'bob@test.com'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'charlie@test.com')
ON CONFLICT (id) DO NOTHING;

-- Week 1: 2025-05-05
INSERT INTO weekly_picks (user_id, symbol, percentage, week_start) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'AAPL', 50, '2025-05-05'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'MSFT', 50, '2025-05-05'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'NVDA', 60, '2025-05-05'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'TSLA', 40, '2025-05-05'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'SPY',  100, '2025-05-05');

-- Week 2: 2025-05-12
INSERT INTO weekly_picks (user_id, symbol, percentage, week_start) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'AAPL', 30, '2025-05-12'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'NVDA', 70, '2025-05-12'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'MSFT', 50, '2025-05-12'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'SPY',  50, '2025-05-12'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'TSLA', 100, '2025-05-12');

-- Week 3: 2025-05-19
INSERT INTO weekly_picks (user_id, symbol, percentage, week_start) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'GOOGL', 40, '2025-05-19'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'MSFT',  60, '2025-05-19'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'AAPL',  50, '2025-05-19'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'NVDA',  50, '2025-05-19'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'SPY',   100, '2025-05-19');

-- Week 4: 2025-05-26
INSERT INTO weekly_picks (user_id, symbol, percentage, week_start) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'MSFT',  50, '2025-05-26'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'GOOGL', 50, '2025-05-26'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'NVDA',  100, '2025-05-26'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'AAPL',  50, '2025-05-26'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'SPY',   50, '2025-05-26');