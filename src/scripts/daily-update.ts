import YahooFinance from "yahoo-finance2";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { getSimulationDate, isSimulationMode } from "../config/simulation";

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
 * Purpose: Fetch current prices and update daily performance tracking
 * Run: Every weekday during/after market hours (e.g., 5 PM ET)
 * Does NOT update scores - just updates current price data for display
 */

function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMondayOfWeek(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();

  // If Sunday (0), go back 6 days. If Monday (1), stay. Otherwise go back (day - 1) days
  const daysBack = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - daysBack);

  return getLocalDateString(d);
}

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
  const TODAY = getLocalDateString(referenceDate);
  const WEEK_START = getMondayOfWeek(referenceDate);

  console.log(`\n📊 Daily Price Update`);
  console.log(`   Today: ${TODAY}`);
  console.log(`   Current week starts: ${WEEK_START}`);
  if (isSimulationMode()) console.log(`   [SIMULATION MODE]`);

  // 1. Get all picks for current week
  const { data: picks, error: picksError } = await supabase
    .from("weekly_picks")
    .select("symbol, user_id, percentage")
    .eq("week_start", WEEK_START);

  if (picksError || !picks?.length) {
    console.log("No picks found for this week. Nothing to update.");
    return;
  }

  const symbols = [...new Set(picks.map((p) => p.symbol))];
  console.log(`\n📈 Fetching prices for ${symbols.length} symbols`);

  // 2. Get existing opening prices for the week
  const { data: openPrices } = await supabase
    .from("stock_prices")
    .select("symbol, open_price, open_date")
    .eq("week_start", WEEK_START);

  const openPriceMap: Record<string, { price: number; date: string }> = {};
  openPrices?.forEach(p => {
    openPriceMap[p.symbol] = { price: p.open_price, date: p.open_date };
  });

  // 3. Fetch current prices and update
  for (const symbol of symbols) {
    // If we don't have opening price yet, fetch it
    if (!openPriceMap[symbol]) {
      const openData = await getActualTradingDay(symbol, WEEK_START, "after");
      if (openData) {
        openPriceMap[symbol] = { price: openData.price, date: openData.date };

        // Store in database
        await supabase.from("stock_prices").upsert({
          symbol,
          week_start: WEEK_START,
          open_price: openData.price,
          open_date: openData.date,
          close_price: openData.price, // Initialize with same value
          close_date: openData.date,
          updated_at: new Date().toISOString(),
        }, { onConflict: "symbol,week_start" });
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
      await supabase
        .from("stock_prices")
        .update({
          close_price: currentPrice,
          close_date: TODAY,
          updated_at: new Date().toISOString(),
        })
        .eq("symbol", symbol)
        .eq("week_start", WEEK_START);
    }
  }

  // 4. Calculate current performance (no score updates)
  console.log(`\n💰 Current Week Performance (unrealized)`);

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

  // Calculate each user's current return
  for (const [user_id, userPicks] of Object.entries(byUser)) {
    let weeklyReturn = 0;

    for (const pick of userPicks) {
      const prices = priceMap[pick.symbol];
      if (!prices || prices.open === 0) continue;

      const stockReturn = (prices.close - prices.open) / prices.open;
      weeklyReturn += stockReturn * (pick.percentage / 100);
    }

    console.log(`  User ${user_id.substring(0, 8)}: ${(weeklyReturn * 100).toFixed(2)}% (unrealized)`);
  }

  console.log("\n✅ Daily update complete.");
}

main().catch(console.error);
