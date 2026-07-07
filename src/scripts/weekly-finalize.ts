import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { getSimulationDate, isSimulationMode } from "../config/simulation";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * WEEKLY PORTFOLIO CALCULATION SCRIPT
 *
 * Purpose: Calculate group portfolio allocation based on current user scores
 * and update user scores from the just-finished prior week.
 * Run: Monday morning before market opens (after picks submitted over weekend)
 * Reads: current week picks, prior week picks, prices, and most recent scores
 * Writes: weekly_portfolio for current week and new user scores when available
 */

function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentMonday(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();

  // Go back to this week's Monday (not previous week)
  const daysBack = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - daysBack);

  return getLocalDateString(d);
}

function getPreviousMonday(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const daysBack = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - daysBack - 7);

  return getLocalDateString(d);
}

async function main() {
  const referenceDate = getSimulationDate();
  const TODAY = getLocalDateString(referenceDate);
  const WEEK_START = getCurrentMonday(referenceDate);
  const PREVIOUS_WEEK_START = getPreviousMonday(referenceDate);

  console.log(`\n🎯 Weekly Portfolio Calculation`);
  console.log(`   Week: ${WEEK_START}`);
  console.log(`   Running on: ${TODAY}`);
  if (isSimulationMode()) console.log(`   [SIMULATION MODE]`);

  // 1. Get all picks for current week
  const { data: picks, error: picksError } = await supabase
    .from("weekly_picks")
    .select("symbol, user_id, percentage")
    .eq("week_start", WEEK_START);

  if (picksError) {
    console.error("Failed to load current week picks:", picksError);
    return;
  }

  console.log(`\n📋 Current week picks: ${picks?.length ?? 0} rows`);

  // 2. Attempt to score the prior week if data exists
  const { data: previousPicks, error: previousPicksError } = await supabase
    .from("weekly_picks")
    .select("symbol, user_id, percentage")
    .eq("week_start", PREVIOUS_WEEK_START);

  if (previousPicksError) {
    console.error("Failed to load previous week picks:", previousPicksError);
  }

  if (previousPicks?.length) {
    const { data: previousPrices, error: previousPricesError } = await supabase
      .from("stock_prices")
      .select("symbol, open_price, close_price")
      .eq("week_start", PREVIOUS_WEEK_START);

    if (previousPricesError) {
      console.error("Failed to load previous week prices:", previousPricesError);
    }

    const priceMap: Record<string, { open: number; close: number }> = {};
    previousPrices?.forEach((row) => {
      priceMap[row.symbol] = { open: row.open_price, close: row.close_price };
    });

    const priorUsers = [...new Set(previousPicks.map((p) => p.user_id))];
    const scoreBaseline: Record<string, number> = {};

    for (const user_id of priorUsers) {
      const { data: scoreData } = await supabase
        .from("scores")
        .select("competence_score")
        .eq("user_id", user_id)
        .order("week_start", { ascending: false })
        .limit(1);

      scoreBaseline[user_id] = scoreData?.[0]?.competence_score ?? 1000;
    }

    const userPicks: Record<string, { symbol: string; percentage: number }[]> = {};
    previousPicks.forEach((pick) => {
      if (!userPicks[pick.user_id]) userPicks[pick.user_id] = [];
      userPicks[pick.user_id].push(pick);
    });

    const scoreUpdates: Array<{ user_id: string; week_start: string; competence_score: number }> = [];

    for (const [user_id, picksForUser] of Object.entries(userPicks)) {
      let skipUser = false;
      let weeklyReturn = 0;

      for (const pick of picksForUser) {
        const prices = priceMap[pick.symbol];
        if (!prices || prices.open === 0 || prices.close === undefined) {
          console.warn(`  Skipping score for user ${user_id.substring(0, 8)}: missing prices for ${pick.symbol}`);
          skipUser = true;
          break;
        }
        weeklyReturn += ((prices.close - prices.open) / prices.open) * (pick.percentage / 100);
      }

      if (skipUser) continue;

      const baseline = scoreBaseline[user_id] ?? 1000;
      const newScore = Math.round(baseline + weeklyReturn * 100);
      scoreUpdates.push({ user_id, week_start: WEEK_START, competence_score: newScore });
      console.log(`  Scored user ${user_id.substring(0, 8)}: ${baseline} → ${newScore} (${(weeklyReturn * 100).toFixed(2)}%)`);
    }

    if (scoreUpdates.length) {
      const { error: scoreUpsertError } = await supabase
        .from("scores")
        .upsert(scoreUpdates, { onConflict: "user_id,week_start" });

      if (scoreUpsertError) {
        console.error("Failed to upsert weekly scores:", scoreUpsertError);
      }
    } else {
      console.log("No previous-week users were scored because required price data was missing.");
    }
  } else {
    console.log(`\n⚠️ No previous week picks found for ${PREVIOUS_WEEK_START}; scores will not be updated.`);
  }

  // 3. Get most recent score for each user
  const uniqueUserIds = [...new Set((picks || []).map((p) => p.user_id))];
  const userScores: Record<string, number> = {};

  for (const user_id of uniqueUserIds) {
    const { data: scoreData } = await supabase
      .from("scores")
      .select("competence_score")
      .eq("user_id", user_id)
      .order("week_start", { ascending: false })
      .limit(1);

    userScores[user_id] = scoreData?.[0]?.competence_score ?? 1000;
  }

  console.log(`\n💾 Current scores:`);
  for (const [user_id, score] of Object.entries(userScores)) {
    console.log(`  User ${user_id.substring(0, 8)}: ${score.toFixed(0)}`);
  }

  // 3. Calculate weighted portfolio allocation
  console.log(`\n📊 Calculating weighted portfolio...`);

  const maxScore = Math.max(...Object.values(userScores), 1000);
  const contributions: Record<string, number> = {};

  for (const pick of picks) {
    const userScore = userScores[pick.user_id];
    const normalized = userScore / maxScore;
    const contribution = normalized * (pick.percentage || 0);

    contributions[pick.symbol] = (contributions[pick.symbol] || 0) + contribution;
  }

  const totalContribution = Object.values(contributions).reduce((a, b) => a + b, 0);

  // 4. Clear and insert portfolio for current week
  await supabase.from("weekly_portfolio").delete().eq("week_start", WEEK_START);

  for (const [symbol, contrib] of Object.entries(contributions)) {
    const percentage = (contrib / totalContribution) * 100;

    await supabase.from("weekly_portfolio").insert({
      symbol,
      week_start: WEEK_START,
      percentage: percentage,
    });
  }

  console.log(`\n📈 Portfolio for ${WEEK_START}:`);
  Object.entries(contributions)
    .map(([symbol, contrib]) => ({ symbol, pct: (contrib / totalContribution) * 100 }))
    .sort((a, b) => b.pct - a.pct)
    .forEach(({ symbol, pct }) => {
      console.log(`  ${symbol}: ${pct.toFixed(1)}%`);
    });

  console.log("\n✅ Portfolio calculation complete.");
}

main().catch(console.error);
