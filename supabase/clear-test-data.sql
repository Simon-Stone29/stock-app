-- clear-test-data.sql
-- Run this in Supabase SQL Editor before seeding

DELETE FROM scores;
DELETE FROM group_portfolio_daily;
DELETE FROM weekly_portfolio;
DELETE FROM stock_prices;
DELETE FROM weekly_picks WHERE user_id IN (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000003'
);
DELETE FROM users WHERE id IN (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000003'
);