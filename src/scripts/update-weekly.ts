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

 

  const SENSITIVITY = 100;

 

  /**

   * WEEKLY FINALIZATION SCRIPT

   *

   * Purpose: Lock in final prices, calculate returns, update competence scores,

   *          and recalculate group portfolio weights for next week

   * Run: Once per week on Sunday night or Monday 1 AM

   * This DOES update scores and group portfolio

   */

 

  // Set to a date string for testing, or null for production

  const TEST_DATE: string | null = "2024-01-14"; // e.g., "2024-03-15"

 

  function getLocalDateString(date: Date): string {

    const year = date.getFullYear();

    const month = String(date.getMonth() + 1).padStart(2, "0");

    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;

  }

 

  function getLastMonday(date: Date = new Date()): string {

    const d = new Date(date);

    const day = d.getDay();

 

    // Go back to last week's Monday

    const daysBack = day === 0 ? 6 : day - 1;

    d.setDate(d.getDate() - daysBack);

 

    // Go back one more week

    d.setDate(d.getDate() - 7);

 

    return getLocalDateString(d);

  }

 

  function getLastFriday(mondayStr: string): string {

    const d = new Date(mondayStr);

    d.setDate(d.getDate() + 4); // Monday + 4 = Friday

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

    const referenceDate = TEST_DATE ? new Date(TEST_DATE) : new Date();

    const TODAY = getLocalDateString(referenceDate);

    const WEEK_START = getLastMonday(referenceDate);

    const FRIDAY = getLastFriday(WEEK_START);

 

    console.log(`\n📊 Weekly Scoring & Portfolio Calculation`);

    console.log(`   Week to finalize: ${WEEK_START} to ${FRIDAY}`);

    console.log(`   Running on: ${TODAY}`);

    if (TEST_DATE) console.log(`   [TEST MODE]`);

 

    // 0. Check if we already finalized this week

    const { data: existingScores } = await supabase

      .from("scores")

      .select("user_id")

      .eq("week_start", WEEK_START)

      .limit(1);

 

    if (existingScores?.length) {

      console.log(`\n⚠️  Week ${WEEK_START} already finalized. Skipping.`);

      console.log(`   (Delete scores for this week_start to re-run)`);

      return;

    }

 

    // 1. Get all picks for the week

    const { data: picks, error: picksError } = await supabase

      .from("weekly_picks")

      .select("symbol, user_id, percentage")

      .eq("week_start", WEEK_START);

 

    if (picksError || !picks?.length) {

      console.error("No picks found for this week:", picksError);

      return;

    }

 

    const symbols = [...new Set(picks.map((p) => p.symbol))];

    console.log(`\n📈 Finalizing prices for ${symbols.length} symbols`);

 

    // 2. Get or fetch final prices

    const { data: existingPrices } = await supabase

      .from("stock_prices")

      .select("symbol, open_price, open_date, close_price, close_date")

      .eq("week_start", WEEK_START);

 

    const priceMap: Record<string, { open: number; close: number }> = {};

    const existingPriceMap: Record<string, any> = {};

    existingPrices?.forEach(p => {

      existingPriceMap[p.symbol] = p;

    });

 

    for (const symbol of symbols) {

      let openPrice, openDate, closePrice, closeDate;

 

      // Check if we have existing data

      if (existingPriceMap[symbol]) {

        openPrice = existingPriceMap[symbol].open_price;

        openDate = existingPriceMap[symbol].open_date;

        closePrice = existingPriceMap[symbol].close_price;

        closeDate = existingPriceMap[symbol].close_date;

      } else {

        // Fetch from API

        const openData = await getActualTradingDay(symbol, WEEK_START, "after");

        const closeData = await getActualTradingDay(symbol, FRIDAY, "before");

 

        if (!openData || !closeData) {

          console.warn(`  ⚠️  ${symbol}: Could not find trading days. Skipping.`);

          continue;

        }

 

        openPrice = openData.price;

        openDate = openData.date;

        closePrice = closeData.price;

        closeDate = closeData.date;

 

        // Store in database

        await supabase.from("stock_prices").upsert({

          symbol,

          week_start: WEEK_START,

          open_price: openPrice,

          open_date: openDate,

          close_price: closePrice,

          close_date: closeDate,

          updated_at: new Date().toISOString(),

        }, { onConflict: "symbol,week_start" });

      }

 

      priceMap[symbol] = { open: openPrice, close: closePrice };

      const change = ((closePrice - openPrice) / openPrice) * 100;

      console.log(

        `  ${symbol}: ${openDate} $${openPrice.toFixed(2)} → ${closeDate} $${closePrice.toFixed(2)} (${change >= 0 ? '+'

   : ''}${change.toFixed(2)}%)`

      );

    }

 

    // 3. Calculate returns and update scores

    console.log(`\n💰 Calculating final returns and updating scores`);

 

    const byUser: Record<string, { symbol: string; percentage: number }[]> = {};

    for (const pick of picks) {

      if (!byUser[pick.user_id]) byUser[pick.user_id] = [];

      byUser[pick.user_id].push(pick);

    }

 

    for (const [user_id, userPicks] of Object.entries(byUser)) {

      let weeklyReturn = 0;

 

      for (const pick of userPicks) {

        const prices = priceMap[pick.symbol];

        if (!prices || prices.open === 0) continue;

 

        const stockReturn = (prices.close - prices.open) / prices.open;

        weeklyReturn += stockReturn * (pick.percentage / 100);

      }

 

      // Get user's current highest score

      const { data: currentScoreData } = await supabase

        .from("scores")

        .select("competence_score")

        .eq("user_id", user_id)

        .order("competence_score", { ascending: false })

        .limit(1);

 

      const currentScore = currentScoreData?.[0]?.competence_score ?? 1000;

      const delta = weeklyReturn * SENSITIVITY;

      const newScore = currentScore + delta;

 

      await supabase.from("scores").insert({

        user_id,

        week_start: WEEK_START,

        competence_score: newScore,

        leaderboard_ranking: null,

      });

 

      console.log(

        `  User ${user_id.substring(0, 8)}: ${(weeklyReturn * 100).toFixed(2)}% return | ${currentScore.toFixed(0)} +

  ${delta.toFixed(0)} = ${newScore.toFixed(0)}`

      );

    }

 

    // 4. Calculate weighted portfolio for NEXT week

    const nextMonday = new Date(WEEK_START);

    nextMonday.setDate(nextMonday.getDate() + 7);

    const NEXT_WEEK_START = getLocalDateString(nextMonday);

 

    console.log(`\n🎯 Calculating weighted portfolio for week ${NEXT_WEEK_START}`);

 

    // Get all current scores (just calculated)

    const { data: allScores } = await supabase

      .from("scores")

      .select("user_id, competence_score")

      .eq("week_start", WEEK_START);

 

    if (!allScores?.length) {

      console.log("No scores to weight.");

      return;

    }

 

    // Get picks for NEXT week

    const { data: nextWeekPicks } = await supabase

      .from("weekly_picks")

      .select("symbol, user_id, percentage")

      .eq("week_start", NEXT_WEEK_START);

 

    if (!nextWeekPicks?.length) {

      console.log("No picks yet for next week. Portfolio calculation skipped.");

      console.log("(Run this script again after picks are submitted)");

      return;

    }

 

    const maxScore = Math.max(...allScores.map(s => s.competence_score), 1000);

    const contributions: Record<string, number> = {};

 

    for (const pick of nextWeekPicks) {

      const userScore = allScores.find(s => s.user_id === pick.user_id)?.competence_score ?? 1000;

      const normalized = userScore / maxScore;

      const contribution = normalized * (pick.percentage || 0);

 

      contributions[pick.symbol] = (contributions[pick.symbol] || 0) + contribution;

    }

 

    const totalContribution = Object.values(contributions).reduce((a, b) => a + b, 0);

 

    // Clear old portfolio for next week

    await supabase.from("weekly_portfolio").delete().eq("week_start", NEXT_WEEK_START);

 

    // Insert new portfolio

    for (const [symbol, contrib] of Object.entries(contributions)) {

      const percentage = (contrib / totalContribution) * 100;

 

      await supabase.from("weekly_portfolio").insert({

        symbol,

        week_start: NEXT_WEEK_START,

        percentage: percentage,

      });

    }

 

    console.log(`Portfolio for ${NEXT_WEEK_START}:`);

    Object.entries(contributions)

      .map(([symbol, contrib]) => ({ symbol, pct: (contrib / totalContribution) * 100 }))

      .sort((a, b) => b.pct - a.pct)

      .forEach(({ symbol, pct }) => {

        console.log(`  ${symbol}: ${pct.toFixed(1)}%`);

      });

 

    console.log("\n✅ Weekly finalization complete.");

  }

 

  main().catch(console.error);

 

  