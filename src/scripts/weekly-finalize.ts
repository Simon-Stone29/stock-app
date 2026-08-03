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
 * WEEKLY FINALIZE SCRIPT
 *
 * Purpose: Initialize group portfolio for the new week starting Monday
 * Run: Monday morning (after picks close Sunday night)
 * Does NOT update scores - that's handled by daily-update.ts
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

  console.log(`\n📊 Weekly Finalize - Group Portfolio Setup`);
  console.log(`   Today: ${TODAY}`);
  console.log(`   New week starts: ${WEEK_START}`);
  if (isSimulationMode()) console.log(`   [SIMULATION MODE]`);

  // 1. Get all picks for current week
  const { data: picks, error: picksError } = await supabase
    .from("weekly_picks")
    .select("symbol, user_id, percentage")
    .eq("week_start", WEEK_START);

  console.log(`\n🧪 Weekly finalize debug: fetched weekly_picks for ${WEEK_START}`, {
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

  console.log(`🧪 Weekly finalize debug: loaded existing stock_prices for ${WEEK_START}`, {
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
          console.error(`🧪 Weekly finalize debug: failed upsert for ${symbol}`, { WEEK_START, openData, upsertError });
        } else {
          console.log(`🧪 Weekly finalize debug: upserted stock_prices for ${symbol}`, { WEEK_START, openData });
        }
      } else {
        console.warn(`🧪 Weekly finalize debug: no openData for ${symbol} on or after ${WEEK_START}`);
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
        console.error(`🧪 Weekly finalize debug: failed update close_price for ${symbol}`, { WEEK_START, TODAY, updateError });
      }
    } else if (!currentPrice) {
      console.warn(`🧪 Weekly finalize debug: no currentPrice found for ${symbol}`, { WEEK_START, TODAY });
    } else if (!openPriceMap[symbol]) {
      console.warn(`🧪 Weekly finalize debug: no openPriceMap entry for ${symbol} while updating current price`, { WEEK_START });
    }
  }

  console.log("\n✅ Weekly finalize complete - group portfolio initialized.");
}

main().catch(console.error);