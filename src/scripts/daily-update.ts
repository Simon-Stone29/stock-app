import YahooFinance from "yahoo-finance2";
import { GoogleGenAI } from "@google/genai";
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

const DAILY_GROUP_PROMPT =  `
  You are an executive summary writer for a group portfolio dashboard.
  Generate a concise daily performance update (2 to 3 sentences maximum).

  STRICT FORMATTING RULES:
  1. Return ONLY pure prose text. 
  2. Do NOT use title headers, markdown headings (e.g. # or ##), bullet points, bold labels, or section intros.
  3. Keep the tone professional, direct, and analytical.

  REQUIRED CONTENT (Cover in order):
  1. Portfolio Sentiment/Theme: Summarize the overarching investment theme or sentiment of the portfolio picks for this week (e.g., "bullish on big tech", "defensively positioned in blue-chips") without explicitly listing individual stock percentage breakdowns.
  2. Week-to-Date (WTD) Performance: State the group's week-to-date return percentage and total portfolio value.
  3. Benchmark Comparison: Compare the group's week-to-date return against SPY's when benchmark data is available. The benchmark index value is normalized, not SPY's share price. If benchmark data is unavailable, say so without guessing.
  `;

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

async function generateDailyGroupUpdate(
  weekStart: string,
  outputDate: string,
  groupValue: number,
  weeklyReturnPct: number,
  benchmark: { symbol: "SPY"; indexValue: number; weeklyReturnPct: number; dailyReturnPct: number } | null,
  holdings: { symbol: string; allocationPct: number; openPrice: number | null; currentPrice: number | null; returnPct: number | null }[]
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("GEMINI_API_KEY is not set; skipping the daily group update.");
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.interactions.create({
      model: "gemini-3.8-flash",
      input: `${DAILY_GROUP_PROMPT}\n\n${JSON.stringify({ weekStart, outputDate, groupValue, weeklyReturnPct, benchmark, holdings })}`,
      store: false,
    });
    const output = response.output_text?.trim();

    if (!output) {
      console.warn("Gemini returned an empty daily group update.");
      return;
    }

    const { error } = await supabase
      .from("llm_output")
      .upsert({ week_start: weekStart, output_date: outputDate, output }, { onConflict: "week_start,output_date" });

    if (error) throw error;
    console.log(`Saved daily group update to llm_output for ${outputDate}.`);
  } catch (error) {
    console.warn("Could not generate or save the daily group update; continuing daily update.", error);
  }
}

async function updateBenchmark(
  today: string,
  weekStart: string
): Promise<{ symbol: "SPY"; indexValue: number; weeklyReturnPct: number; dailyReturnPct: number } | null> {
  try {
    const openingData = await getActualTradingDay("SPY", weekStart, "after");
    const currentPrice = await getCurrentPrice("SPY", isSimulationMode() ? today : undefined);

    if (!openingData || openingData.price <= 0 || !currentPrice || currentPrice <= 0) {
      console.warn(`Skipping SPY benchmark snapshot for ${today}: opening or current price unavailable.`);
      return null;
    }

    const weeklyReturn = (currentPrice - openingData.price) / openingData.price;
    const { data: priorWeekRows, error: priorWeekError } = await supabase
      .from("benchmark_daily")
      .select("benchmark_value")
      .lt("week_start", weekStart)
      .order("snapshot_date", { ascending: false })
      .limit(1);

    if (priorWeekError) {
      console.error("Failed to fetch prior weekly benchmark value; using initial value:", priorWeekError);
    }

    const weekStartValue = Number(priorWeekRows?.[0]?.benchmark_value) || 1000;
    const benchmarkValue = weekStartValue * (1 + weeklyReturn);
    const { data: priorDayRows, error: priorDayError } = await supabase
      .from("benchmark_daily")
      .select("benchmark_value")
      .lt("snapshot_date", today)
      .order("snapshot_date", { ascending: false })
      .limit(1);

    if (priorDayError) {
      console.error("Failed to fetch prior daily benchmark value; using weekly return:", priorDayError);
    }

    const priorDayValue = Number(priorDayRows?.[0]?.benchmark_value);
    const dailyReturn = Number.isFinite(priorDayValue) && priorDayValue > 0
      ? benchmarkValue / priorDayValue - 1
      : weeklyReturn;

    const { error: benchmarkError } = await supabase
      .from("benchmark_daily")
      .upsert({
        snapshot_date: today,
        week_start: weekStart,
        symbol: "SPY",
        benchmark_value: benchmarkValue,
        daily_return_pct: dailyReturn * 100,
      }, { onConflict: "snapshot_date" });

    if (benchmarkError) {
      console.error(`Failed to upsert SPY benchmark snapshot for ${today}:`, benchmarkError);
      return null;
    } else {
      console.log(`SPY benchmark: $${benchmarkValue.toFixed(2)} (${(dailyReturn * 100).toFixed(2)}% daily return)`);
      return {
        symbol: "SPY",
        indexValue: benchmarkValue,
        weeklyReturnPct: weeklyReturn * 100,
        dailyReturnPct: dailyReturn * 100,
      };
    }
  } catch (err) {
    console.error(`Failed to update SPY benchmark for ${today}:`, err);
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

  const benchmark = await updateBenchmark(TODAY, WEEK_START);

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
// Fetch each user's latest historical score prior to today
// Get each user's most recent score from a PREVIOUS week.
// This becomes their starting score for the current week.
  const { data: priorScores } = await supabase
    .from("scores")
    .select("user_id, portfolio_value, competence_score, week_start")
    .in("user_id", Object.keys(byUser))
    .lt("week_start", WEEK_START)
    .order("score_date", { ascending: false });

  const weekStartScoreMap: Record<string, number> = {};
  const weekStartCompetenceMap: Record<string, number> = {};

  priorScores?.forEach(s => {
    // First match per user is their most recent score from a previous week
    if (!(s.user_id in weekStartScoreMap)) {
      weekStartScoreMap[s.user_id] = s.portfolio_value;
      weekStartCompetenceMap[s.user_id] = Number(s.competence_score ?? 100);
    }
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

    const weekStartScore = weekStartScoreMap[user_id] ?? 1000;

    // Calculate today's score from the fixed starting score for this week.
    // weeklyReturn is already the total return since Monday.
    const newScore = (1 + weeklyReturn) * weekStartScore;
    const weekStartCompetence = weekStartCompetenceMap[user_id] ?? 100;
    const newCompetenceScore = Math.max(0, weekStartCompetence + weeklyReturn * 100);

    console.log(`  User ${user_id.substring(0, 8)}:`);
    console.log(`    Weekly return: ${(weeklyReturn * 100).toFixed(2)}%`);
    console.log(`    Week-start score: ${weekStartScore.toFixed(0)}`);
    console.log(`    New score: ${newScore.toFixed(0)}`);
    console.log(`    Competence score: ${newCompetenceScore.toFixed(2)}`);
    // Upsert weekly score for leaderboard/ranking.
    const { error: scoreError } = await supabase
      .from("scores")
      .upsert({
        user_id,
        score_date: TODAY,      // <--- Primary key component
        week_start: WEEK_START, // <--- Preserved week reference
        portfolio_value: newScore,
        competence_score: newCompetenceScore,
      }, { onConflict: "user_id,score_date" });

    if (scoreError) {
      console.error(`Error saving daily score for user ${user_id}:`, scoreError);
    }

    // Store daily percent-change snapshot for graphing.

  }

  // Aggregate today's group portfolio snapshot using weighted `weekly_portfolio`.
  // If weekly allocations or price data are missing, skip upserting the group snapshot
  // and log a clear message (no fallback behavior).
  try {
    const { data: weeklyPortfolio, error: wpError } = await supabase
      .from("weekly_portfolio")
      .select("symbol, percentage")
      .eq("week_start", WEEK_START);

    if (wpError) {
      console.error("🧪 Daily update debug: failed to fetch weekly_portfolio for group snapshot", { wpError });
    } else if (!weeklyPortfolio || !weeklyPortfolio.length) {
      console.log("🧪 Daily update: weekly_portfolio missing for this week — skipping weighted group snapshot.");
    } else {
      let weightedReturn = 0;
      let hasData = false;

      for (const row of weeklyPortfolio) {
        const symbol = row.symbol;
        const weight = Number(row.percentage) || 0; // percent
        const prices = priceMap[symbol];
        if (!prices || prices.open === 0) continue;
        const stockReturn = (prices.close - prices.open) / prices.open;
        weightedReturn += stockReturn * (weight / 100);
        hasData = true;
      }

      if (!hasData) {
        console.log("🧪 Daily update: weekly_portfolio exists but no price data available for its symbols — skipping group snapshot.");
      } else {
  // 1. Fetch group portfolio value from BEFORE this week started (same as priorScores logic)
        const { data: priorGroup } = await supabase
          .from("group_portfolio_daily")
          .select("portfolio_value")
          .lt("week_start", WEEK_START)
          .order("snapshot_date", { ascending: false })
          .limit(1);

        const groupStartValue = Number(priorGroup?.[0]?.portfolio_value) || 1000;

        // 2. Compound starting value with week-to-date return
        const newGroupValue = (1 + weightedReturn) * groupStartValue;

        // 3. Upsert snapshot
        const { error: groupDailyError } = await supabase
          .from("group_portfolio_daily")
          .upsert({
            snapshot_date: TODAY,
            week_start: WEEK_START,
            portfolio_value: newGroupValue,
            portfolio_change_pct: weightedReturn * 100,
          }, { onConflict: "snapshot_date" });

        if (groupDailyError) {
          console.error("🧪 Daily update debug: failed to upsert group portfolio snapshot", { groupDailyError });
        }

        const holdings = weeklyPortfolio.map((row) => {
          const prices = priceMap[row.symbol];
          const openPrice = prices?.open ?? null;
          const currentPrice = prices?.close ?? null;
          return {
            symbol: row.symbol,
            allocationPct: Number(row.percentage) || 0,
            openPrice,
            currentPrice,
            returnPct: openPrice && currentPrice !== null
              ? ((currentPrice - openPrice) / openPrice) * 100
              : null,
          };
        });

        if (process.env.SIMULATION_SKIP_LLM_OUTPUT === "true") {
          console.log(`Skipping LLM output for historical simulation date ${TODAY}.`);
        } else {
          await generateDailyGroupUpdate(
            WEEK_START,
            TODAY,
            newGroupValue,
            weightedReturn * 100,
            benchmark,
            holdings
          );
        }
      }
    }
  } catch (err) {
    console.error("🧪 Daily update debug: error computing weighted group snapshot", err);
  }

  console.log("\n✅ Daily update complete - prices, weekly scores, and daily portfolio snapshots updated.");
}

main().catch(console.error);