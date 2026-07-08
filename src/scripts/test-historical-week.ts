  import YahooFinance from "yahoo-finance2";

  import { createClient } from "@supabase/supabase-js";

  import * as dotenv from "dotenv";

  dotenv.config({ path: ".env.local" });

 

  const yahooFinance = new YahooFinance({

    suppressNotices: ["ripHistorical"],

  });



const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

 

  // ========================================

  // TEST CONFIGURATION

  // ========================================

  const TEST_WEEK_START = "2022-01-03"; // Monday of the week you want to test

  const TEST_USER_1 = "6b6a9671-c9dc-4d3c-893d-598cfc6dbf45";

  const TEST_USER_2 = "eb94fa15-5498-4bf6-9041-92a9e8e0cf63";

 

  /*

  -- ========================================

  -- SQL SETUP FOR TEST CASE 1: Basic Tech vs Value

  -- Run these in Supabase SQL Editor BEFORE running this script

  -- ========================================

 

  -- Clean up any existing test data

  DELETE FROM scores WHERE user_id IN ('6b6a9671-c9dc-4d3c-893d-598cfc6dbf45', 'test-user-002');

  DELETE FROM weekly_picks WHERE user_id IN ('6b6a9671-c9dc-4d3c-893d-598cfc6dbf45', 'test-user-002');

  DELETE FROM stock_prices WHERE week_start = '2024-01-08';

  DELETE FROM weekly_portfolio WHERE week_start = '2024-01-08';

 

  -- Insert test users


 

  -- Give users starting scores (user 1 is better)

  INSERT INTO scores (user_id, week_start, competence_score) VALUES

    ('6b6a9671-c9dc-4d3c-893d-598cfc6dbf45', '2024-01-01', 1200),

    ('eb94fa15-5498-4bf6-9041-92a9e8e0cf63', '2024-01-01', 900);

 

  -- User 1 picks: Tech heavy (AAPL, MSFT, GOOGL)

  INSERT INTO weekly_picks (user_id, symbol, percentage, week_start) VALUES

    ('6b6a9671-c9dc-4d3c-893d-598cfc6dbf45', 'AAPL', 40, '2024-01-08'),

    ('6b6a9671-c9dc-4d3c-893d-598cfc6dbf45', 'MSFT', 35, '2024-01-08'),

    ('6b6a9671-c9dc-4d3c-893d-598cfc6dbf45', 'GOOGL', 25, '2024-01-08');

 

  -- User 2 picks: Diversified (AAPL, JPM, XOM)

  INSERT INTO weekly_picks (user_id, symbol, percentage, week_start) VALUES

    ('eb94fa15-5498-4bf6-9041-92a9e8e0cf63', 'AAPL', 30, '2024-01-08'),

    ('eb94fa15-5498-4bf6-9041-92a9e8e0cf63', 'JPM', 35, '2024-01-08'),

    ('eb94fa15-5498-4bf6-9041-92a9e8e0cf63', 'XOM', 35, '2024-01-08');

 

  -- Make sure these stocks exist in your stocks table

  INSERT INTO stocks (Symbol, Name) VALUES

    ('AAPL', 'Apple Inc.'),

    ('MSFT', 'Microsoft Corporation'),

    ('GOOGL', 'Alphabet Inc.'),

    ('JPM', 'JPMorgan Chase & Co.'),

    ('XOM', 'Exxon Mobil Corporation')

  ON CONFLICT (Symbol) DO NOTHING;

 

  -- ========================================

  */

 

  /*

  -- ========================================

  -- SQL SETUP FOR TEST CASE 2: Meme Stock Week (GameStop surge)

  -- Week of 2021-01-25 (GameStop short squeeze)

  -- ========================================

 

  DELETE FROM scores WHERE user_id IN ('test-user-001', 'test-user-002');

  DELETE FROM weekly_picks WHERE user_id IN ('test-user-001', 'test-user-002');

  DELETE FROM stock_prices WHERE week_start = '2021-01-25';

  DELETE FROM weekly_portfolio WHERE week_start = '2021-01-25';

 

  INSERT INTO users (id, email) VALUES

    ('test-user-001', 'test1@example.com'),

    ('test-user-002', 'test2@example.com')

  ON CONFLICT (id) DO NOTHING;

 

  INSERT INTO scores (user_id, week_start, competence_score) VALUES

    ('test-user-001', '2021-01-18', 1000),

    ('test-user-002', '2021-01-18', 1000);

 

  -- User 1: All in on GME

  INSERT INTO weekly_picks (user_id, symbol, percentage, week_start) VALUES

    ('test-user-001', 'GME', 100, '2021-01-25');

 

  -- User 2: Conservative (SPY)

  INSERT INTO weekly_picks (user_id, symbol, percentage, week_start) VALUES

    ('test-user-002', 'SPY', 100, '2021-01-25');

 

  INSERT INTO stocks (Symbol, Name) VALUES

    ('GME', 'GameStop Corp.'),

    ('SPY', 'SPDR S&P 500 ETF Trust')

  ON CONFLICT (Symbol) DO NOTHING;

 

  -- ========================================

  */

 

  async function getActualTradingDay(

    symbol: string,

    targetDate: string,

    direction: "before" | "after" = "after"

  ): Promise<{ date: string; price: number } | null> {

    try {

      const start = new Date(targetDate);

      start.setDate(start.getDate() - 14);

 

      const end = new Date(targetDate);

      end.setDate(end.getDate() + 14);

 

      const historical = await yahooFinance.historical(symbol, {

        period1: start,

        period2: end,

        interval: "1d",

      });

 

      if (!historical.length) return null;

 

      if (direction === "before") {

        const matching = historical.filter((bar: any) => {

          const barDate = bar.date instanceof Date

            ? bar.date.toISOString().split("T")[0]

            : bar.date;

          return barDate <= targetDate;

        });

        const result = matching[matching.length - 1];

        if (!result) return null;

 

        return {

          date: result.date instanceof Date

            ? result.date.toISOString().split("T")[0]

            : result.date,

          price: result.close

        };

      } else {

        const matching = historical.find((bar: any) => {

          const barDate = bar.date instanceof Date

            ? bar.date.toISOString().split("T")[0]

            : bar.date;

          return barDate >= targetDate;

        });

        if (!matching) return null;

 

        return {

          date: matching.date instanceof Date

            ? matching.date.toISOString().split("T")[0]

            : matching.date,

          price: matching.open

        };

      }

    } catch (err) {

      console.error(`Error finding trading day for ${symbol}:`, err);

      return null;

    }

  }

 

  async function main() {

    console.log(`\n🧪 HISTORICAL WEEK TEST`);

    console.log(`   Testing week: ${TEST_WEEK_START}`);

    console.log(`   (Make sure you've run the SQL setup above first!)\n`);

 

    const WEEK_START = TEST_WEEK_START;

    const mondayDate = new Date(WEEK_START);

    const fridayDate = new Date(mondayDate);

    fridayDate.setDate(fridayDate.getDate() + 4);

    const FRIDAY = fridayDate.toISOString().split("T")[0];

 

    // 1. Get picks

    const { data: picks } = await supabase

      .from("weekly_picks")

      .select("symbol, user_id, percentage")

      .eq("week_start", WEEK_START);

 

    if (!picks?.length) {

      console.error("❌ No picks found. Did you run the SQL setup?");

      return;

    }

 

    console.log(`Found ${picks.length} picks from ${new Set(picks.map(p => p.user_id)).size} users`);

 

    const symbols = [...new Set(picks.map((p) => p.symbol))];

 

    // 2. Fetch prices

    console.log(`\n📈 Fetching historical prices for ${symbols.length} symbols...`);

 

    const priceMap: Record<string, { open: number; close: number; openDate: string; closeDate: string }> = {};

 

    for (const symbol of symbols) {

      const openData = await getActualTradingDay(symbol, WEEK_START, "after");

      const closeData = await getActualTradingDay(symbol, FRIDAY, "before");

 

      if (openData && closeData) {

        priceMap[symbol] = {

          open: openData.price,

          close: closeData.price,

          openDate: openData.date,

          closeDate: closeData.date

        };

 

        const change = ((closeData.price - openData.price) / openData.price) * 100;

        console.log(

          `  ${symbol}: ${openData.date} $${openData.price.toFixed(2)} → ${closeData.date}

  $${closeData.price.toFixed(2)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)`

        );

      }

    }

 

    // 3. Calculate returns by user

    console.log(`\n💰 User Performance:`);

 

    const byUser: Record<string, { symbol: string; percentage: number }[]> = {};

    for (const pick of picks) {

      if (!byUser[pick.user_id]) byUser[pick.user_id] = [];

      byUser[pick.user_id].push(pick);

    }

 

    const { data: startingScores } = await supabase

      .from("scores")

      .select("user_id, competence_score")

      .in("user_id", Object.keys(byUser))

      .order("week_start", { ascending: false });

 

    const scoreMap: Record<string, number> = {};

    startingScores?.forEach(s => {

      if (!scoreMap[s.user_id]) scoreMap[s.user_id] = s.competence_score;

    });

 

    for (const [user_id, userPicks] of Object.entries(byUser)) {

      let weeklyReturn = 0;

 

      console.log(`\n  User: ${user_id}`);

      console.log(`  Starting score: ${scoreMap[user_id] ?? 1000}`);

 

      for (const pick of userPicks) {

        const prices = priceMap[pick.symbol];

        if (!prices || prices.open === 0) continue;

 

        const stockReturn = (prices.close - prices.open) / prices.open;

        weeklyReturn += stockReturn * (pick.percentage / 100);

 

        console.log(`    ${pick.symbol} (${pick.percentage}%): ${(stockReturn * 100).toFixed(2)}% return`);

      }

 

      const startingScore = scoreMap[user_id] ?? 1000;

      const delta = weeklyReturn * 100; // SENSITIVITY = 100

      const newScore = startingScore + delta;

 

      console.log(`  Portfolio return: ${(weeklyReturn * 100).toFixed(2)}%`);

      console.log(`  Score change: ${delta >= 0 ? '+' : ''}${delta.toFixed(0)}`);

      console.log(`  New score: ${newScore.toFixed(0)}`);

    }

 

    // 4. Calculate what the group portfolio would be

    console.log(`\n🎯 Weighted Group Portfolio:`);

 

    const maxScore = Math.max(...Object.values(scoreMap), 1000);

    const contributions: Record<string, number> = {};

 

    for (const pick of picks) {

      const userScore = scoreMap[pick.user_id] ?? 1000;

      const normalized = userScore / maxScore;

      const contribution = normalized * (pick.percentage || 0);

 

      contributions[pick.symbol] = (contributions[pick.symbol] || 0) + contribution;

    }

 

    const totalContribution = Object.values(contributions).reduce((a, b) => a + b, 0);

 

    let groupReturn = 0;

    const portfolio = Object.entries(contributions)

      .map(([symbol, contrib]) => ({ symbol, pct: (contrib / totalContribution) * 100 }))

      .sort((a, b) => b.pct - a.pct);

 

    for (const { symbol, pct } of portfolio) {

      const prices = priceMap[symbol];

      let stockReturn = 0;

      if (prices && prices.open > 0) {

        stockReturn = (prices.close - prices.open) / prices.open;

        groupReturn += stockReturn * (pct / 100);

      }

      console.log(`  ${symbol}: ${pct.toFixed(1)}% allocation (${(stockReturn * 100).toFixed(2)}% return)`);

    }

 

    console.log(`\n  Group Portfolio Return: ${(groupReturn * 100).toFixed(2)}%`);

 

    console.log("\n✅ Test complete.");

    console.log("\nTo run the actual update-weekly script with this data:");

    console.log(`  1. Edit update-weekly.ts and set: TEST_DATE = "${FRIDAY}"`);

    console.log(`  2. Run: npm run update-weekly`);

  }

 

  main().catch(console.error);