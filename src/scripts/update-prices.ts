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

function getThisMonday(): string {
  const today = new Date();
  const day = today.getDay();
  const daysBack = day === 0 ? 6 : day - 1;
  const monday = new Date(today);
  monday.setDate(monday.getDate() - daysBack);
  return monday.toISOString().split("T")[0];
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function getFriday(mondayStr: string): string {
  const d = new Date(mondayStr);
  d.setDate(d.getDate() + 4);
  return d.toISOString().split("T")[0];
}

async function getNearestTradingDay(
  symbol: string,
  targetDate: string,
  direction: "before" | "after" = "after"
): Promise<string | null> {
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
      return result?.date instanceof Date
        ? result.date.toISOString().split("T")[0]
        : result?.date ?? null;
    } else {
      const matching = historical.find((bar: any) => {
        const barDate = bar.date instanceof Date 
          ? bar.date.toISOString().split("T")[0] 
          : bar.date;
        return barDate >= targetDate;
      });
      return matching?.date instanceof Date
        ? matching.date.toISOString().split("T")[0]
        : matching?.date ?? null;
    }
  } catch (err) {
    console.error(`Error finding trading day for ${symbol}:`, err);
    return null;
  }
}

async function getPrices(symbol: string, mondayDate: string, fridayDate: string): Promise<{ open: number; close: number; openDate: string; closeDate: string } | null> {
  try {
    const tradingMonday = await getNearestTradingDay(symbol, mondayDate, "after");
    const tradingFriday = await getNearestTradingDay(symbol, fridayDate, "before");

    if (!tradingMonday || !tradingFriday) {
      console.warn(`Could not find trading days for ${symbol}`);
      return null;
    }

    const endDate = new Date(tradingFriday);
    endDate.setDate(endDate.getDate() + 1);

    const historical = await yahooFinance.historical(symbol, {
      period1: new Date(tradingMonday),
      period2: endDate,
      interval: "1d",
    });

    const barMonday = historical.find((bar: any) => {
      const barDate = bar.date instanceof Date 
        ? bar.date.toISOString().split("T")[0] 
        : bar.date;
      return barDate === tradingMonday;
    });

    const barFriday = historical.find((bar: any) => {
      const barDate = bar.date instanceof Date 
        ? bar.date.toISOString().split("T")[0] 
        : bar.date;
      return barDate === tradingFriday;
    });

    const open_price = barMonday?.open;
    const close_price = barFriday?.close;

    if (!open_price || !close_price) {
      console.warn(`Missing prices for ${symbol} (${tradingMonday} → ${tradingFriday})`);
      return null;
    }

    return { 
      open: open_price, 
      close: close_price,
      openDate: tradingMonday,
      closeDate: tradingFriday
    };
  } catch (err) {
    console.error(`Error fetching ${symbol}:`, err);
    return null;
  }
}

async function main() {
  const WEEK_START = getThisMonday();
  const TODAY = getToday();
  const FRIDAY = getFriday(WEEK_START);

  console.log(`\n📊 Weekly Scoring Script`);
  console.log(`   Week starts: ${WEEK_START}`);
  console.log(`   Week ends: ${FRIDAY}`);
  console.log(`   Running: ${TODAY}`);

  // 0. Clear old data for this week
  console.log(`\n🧹 Clearing old data for ${WEEK_START}`);
  await supabase.from("stock_prices").delete().eq("week_start", WEEK_START);
  await supabase.from("weekly_portfolio").delete().eq("week_start", WEEK_START);

  // 1. Fetch and store stock prices
  const { data: picks, error: picksError } = await supabase
    .from("weekly_picks")
    .select("symbol")
    .eq("week_start", WEEK_START);

  if (picksError || !picks?.length) {
    console.error("Failed to fetch picks:", picksError);
    return;
  }

  const symbols = [...new Set(picks.map((p) => p.symbol))];
  console.log(`\n📈 Fetching prices for ${symbols.length} symbols: ${symbols.join(", ")}`);

  const priceMap: Record<string, { open: number; close: number }> = {};

  for (const symbol of symbols) {
    const prices = await getPrices(symbol, WEEK_START, FRIDAY);
    if (!prices) continue;

    priceMap[symbol] = { open: prices.open, close: prices.close };

    await supabase.from("stock_prices").insert({
      symbol,
      week_start: WEEK_START,
      open_price: prices.open,
      close_price: prices.close,
    });

    console.log(`  ${symbol}: ${prices.openDate} open $${prices.open.toFixed(2)} → ${prices.closeDate} close $${prices.close.toFixed(2)}`);
  }

  // 2. Get all user picks
  const { data: allPicks } = await supabase
    .from("weekly_picks")
    .select("user_id, symbol, percentage")
    .eq("week_start", WEEK_START);

  if (!allPicks?.length) {
    console.log("No picks found.");
    return;
  }

  // Group by user
  const byUser: Record<string, { symbol: string; percentage: number }[]> = {};
  for (const pick of allPicks) {
    if (!byUser[pick.user_id]) byUser[pick.user_id] = [];
    byUser[pick.user_id].push(pick);
  }

  // 3. Calculate and upsert scores
  console.log(`\n💰 Calculating returns for ${Object.keys(byUser).length} users`);

  for (const [user_id, userPicks] of Object.entries(byUser)) {
    let weeklyReturn = 0;

    for (const pick of userPicks) {
      const prices = priceMap[pick.symbol];
      if (!prices || prices.open === 0) continue;

      const stockReturn = (prices.close - prices.open) / prices.open;
      weeklyReturn += stockReturn * (pick.percentage / 100);
    }

    const delta = weeklyReturn * SENSITIVITY;
    const newScore = 1000 + delta;

    await supabase.from("scores").upsert(
      {
        user_id,
        week_start: WEEK_START,
        competence_score: newScore,
        leaderboard_ranking: null,
      },
      { onConflict: "user_id,week_start" }
    );

    console.log(
      `  ${user_id}: ${(weeklyReturn * 100).toFixed(2)}% return → score ${newScore.toFixed(1)}`
    );
  }

  // 4. Calculate weighted portfolio
  console.log(`\n🎯 Calculating weighted portfolio`);

  const { data: allScores } = await supabase
    .from("scores")
    .select("user_id, competence_score")
    .eq("week_start", WEEK_START);

  if (!allScores?.length) {
    console.log("No scores to weight.");
    return;
  }

  const maxScore = Math.max(...allScores.map(s => s.competence_score), 1000);

  const contributions: Record<string, number> = {};

  for (const pick of allPicks) {
    const userScore = allScores.find(s => s.user_id === pick.user_id)?.competence_score ?? 1000;
    const normalized = userScore / maxScore;
    const contribution = normalized * (pick.percentage || 0);
    
    contributions[pick.symbol] = (contributions[pick.symbol] || 0) + contribution;
  }

  const totalContribution = Object.values(contributions).reduce((a, b) => a + b, 0);
  const portfolio: Record<string, number> = {};

  for (const [symbol, contrib] of Object.entries(contributions)) {
    portfolio[symbol] = (contrib / totalContribution) * 100;
  }

  for (const [symbol, percentage] of Object.entries(portfolio)) {
    await supabase.from("weekly_portfolio").insert({
      symbol,
      week_start: WEEK_START,
      percentage: percentage,
    });
  }

  console.log("Final Portfolio:");
  Object.entries(portfolio)
    .sort((a, b) => b[1] - a[1])
    .forEach(([symbol, pct]) => {
      console.log(`  ${symbol}: ${pct.toFixed(1)}%`);
    });

  console.log("\n✅ Done.");
}

main().catch(console.error);