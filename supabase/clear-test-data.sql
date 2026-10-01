-- clear-test-data.sql
-- Run this in Supabase SQL Editor before seeding

DELETE FROM scores;
DELETE FROM group_portfolio_daily;
DELETE FROM weekly_portfolio;
DELETE FROM stock_prices;
DELETE FROM weekly_picks;
DELETE FROM benchmark_daily;
DELETE FROM llm_output;