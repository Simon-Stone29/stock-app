import YahooFinance from "yahoo-finance2";
import { createClient } from "@supabase/supabase-js";

import * as dotenv from "dotenv";
import { getSimulationDate, isSimulationMode } from "../config/simulation.ts";
import { getLastMonday, getZonedDateString } from "../lib/weekDates.ts";

dotenv.config({ path: ".env.local" });

const yahooFinance = new YahooFinance({
  suppressNotices: ["ripHistorical"],
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * DAILY UPDATE SCRIPT
 *
 * Purpose: Fetch current prices and update daily performance tracking + user scores
 * Run: Every weekday during/after market hours (e.g., 5 PM ET)
 * Updates stock prices AND calculates/updates user scores for current week
 *
 * NOTE: Week/date calculations use src/lib/weekDates.ts (America/New_York)
 * so this script agrees with the client and the /api/time-context route
 * regardless of what timezone the machine running this cron job is in.
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
      // Find latest trading day on or before target
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
      // Find earliest trading day on or after target
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

async function getCurrentPrice(symbol: string, asOfDate?: string): Promise<number | null> {
  try {
    if (asOfDate) {
      // For simulation - get historical close price
      const result = await getActualTradingDay(symbol, asOfDate, "before");
      return result?.price ?? null;
    }

    // For production - get live quote
    const quote = await yahooFinance.quote(symbol);
    return quote.regularMarketPrice ?? null;
  } catch (err) {
    console.error(`Error fetching current price for ${symbol}:`, err);
    return null;
  }
}

async function main() {
  const referenceDate = getSimulationDate();
  const TODAY = getZonedDateString(referenceDate);
  const WEEK_START = getLastMonday(referenceDate);

  console.log(`\n📊 Daily Price Update`);
  console.log(`   Today: ${TODAY}`);
  console.log(`   Current week starts: ${WEEK_START}`);
  if (isSimulationMode()) console.log(`   [SIMULATION MODE]`);

  // 1. Get all picks for current week
  const { data: picks, error: picksError } = await supabase
    .from("weekly_picks")
    .select("symbol, user_id, percentage")
    .eq("week_start", WEEK_START);

  console.log(`\n🧪 Daily update debug: fetched weekly_picks for ${WEEK_START}`, {
    picksError,
    picksCount: picks?.length ?? 0,
  });

  if (picksError || !picks?.length) {
    console.log("No picks found for this week. Nothing to update.");
    return;
  }

  const symbols = [...new Set(picks.map((p) => p.symbol))];
  console.log(`\n📈 Fetching prices for ${symbols.length} symbols`, { symbols });

  // 2. Get existing opening prices for the week
  const { data: openPrices, error: openPricesError } = await supabase
    .from("stock_prices")
    .select("symbol, open_price")
    .eq("week_start", WEEK_START);

  console.log(`🧪 Daily update debug: loaded existing stock_prices for ${WEEK_START}`, {
    openPricesError,
    openPricesCount: openPrices?.length ?? 0,
  });

  const openPriceMap: Record<string, { price: number }> = {};
  openPrices?.forEach(p => {
    openPriceMap[p.symbol] = { price: p.open_price };
  });

  // 3. Fetch current prices and update
  for (const symbol of symbols) {
    // If we don't have opening price yet, fetch it
    if (!openPriceMap[symbol]) {
      const openData = await getActualTradingDay(symbol, WEEK_START, "after");
      if (openData) {
        openPriceMap[symbol] = { price: openData.price };

        // Store in database
        const { error: upsertError } = await supabase.from("stock_prices").upsert({
          symbol,
          week_start: WEEK_START,
          open_price: openData.price,
          close_price: openData.price, // Initialize with same value
        }, { onConflict: "symbol,week_start" });

        if (upsertError) {
          console.error(`🧪 Daily update debug: failed upsert for ${symbol}`, { WEEK_START, openData, upsertError });
        } else {
          console.log(`🧪 Daily update debug: upserted stock_prices for ${symbol}`, { WEEK_START, openData });
        }
      } else {
        console.warn(`🧪 Daily update debug: no openData for ${symbol} on or after ${WEEK_START}`);
      }
    }

    // Fetch current price
    const currentPrice = await getCurrentPrice(symbol, isSimulationMode() ? TODAY : undefined);

    if (currentPrice && openPriceMap[symbol]) {
      const openPrice = openPriceMap[symbol].price;
      const change = ((currentPrice - openPrice) / openPrice) * 100;

      console.log(
        `  ${symbol}: $${openPrice.toFixed(2)} → $${currentPrice.toFixed(2)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)`
      );

      // Update current price in database
      const { error: updateError } = await supabase
        .from("stock_prices")
        .update({
          close_price: currentPrice,
        })
        .eq("symbol", symbol)
        .eq("week_start", WEEK_START);

      if (updateError) {
        console.error(`🧪 Daily update debug: failed update close_price for ${symbol}`, { WEEK_START, TODAY, updateError });
      }
    } else if (!currentPrice) {
      console.warn(`🧪 Daily update debug: no currentPrice found for ${symbol}`, { WEEK_START, TODAY });
    } else if (!openPriceMap[symbol]) {
      console.warn(`🧪 Daily update debug: no openPriceMap entry for ${symbol} while updating current price`, { WEEK_START });
    }
  }

  // 4. Calculate current performance and update scores
  console.log(`\n💰 Current Week Performance & Score Updates`);

  const { data: currentPrices } = await supabase
    .from("stock_prices")
    .select("symbol, open_price, close_price")
    .eq("week_start", WEEK_START);

  const priceMap: Record<string, { open: number; close: number }> = {};
  currentPrices?.forEach(p => {
    priceMap[p.symbol] = { open: p.open_price, close: p.close_price };
  });

  // Group picks by user
  const byUser: Record<string, { symbol: string; percentage: number }[]> = {};
  for (const pick of picks) {
    if (!byUser[pick.user_id]) byUser[pick.user_id] = [];
    byUser[pick.user_id].push(pick);
  }

  // Get each user's latest score
  const { data: latestScores } = await supabase
    .from("scores")
    .select("user_id, competence_score")
    .in("user_id", Object.keys(byUser))
    .order("week_start", { ascending: false });

  const scoreMap: Record<string, number> = {};
  latestScores?.forEach(s => {
    if (!scoreMap[s.user_id]) scoreMap[s.user_id] = s.competence_score;
  });

  // Calculate each user's current return and update score
  for (const [user_id, userPicks] of Object.entries(byUser)) {
    let weeklyReturn = 0;

    for (const pick of userPicks) {
      const prices = priceMap[pick.symbol];
      if (!prices || prices.open === 0) continue;

      const stockReturn = (prices.close - prices.open) / prices.open;
      weeklyReturn += stockReturn * (pick.percentage / 100);
    }

    const startingScore = scoreMap[user_id] ?? 1000;
    const delta = weeklyReturn * 100; // SENSITIVITY = 100
    const newScore = startingScore + delta;

    console.log(`  User ${user_id.substring(0, 8)}:`);
    console.log(`    Weekly return: ${(weeklyReturn * 100).toFixed(2)}%`);
    console.log(`    Starting score: ${startingScore.toFixed(0)}`);
    console.log(`    Score delta: ${delta >= 0 ? '+' : ''}${delta.toFixed(0)}`);
    console.log(`    New score: ${newScore.toFixed(0)}`);

    // Upsert score for this week
    const { error: scoreError } = await supabase
      .from("scores")
      .upsert({
        user_id,
        week_start: WEEK_START,
        competence_score: newScore,
      }, { onConflict: "user_id,week_start" });

    if (scoreError) {
      console.error(`🧪 Daily update debug: failed to upsert score for user ${user_id.substring(0, 8)}`, { scoreError });
    }
  }

  console.log("\n✅ Daily update complete - prices and scores updated.");
}

main().catch(console.error);