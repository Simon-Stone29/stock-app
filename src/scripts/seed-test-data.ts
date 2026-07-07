import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * TEST DATA SEEDING SCRIPT
 *
 * Purpose: Create sample users and picks for historical weeks to test scoring logic
 * Run: Manually when you need test data
 *
 * Usage:
 *   1. Update TEST_USERS with your test user IDs (or run this to create dummy data)
 *   2. Update TEST_WEEK_START to the Monday you want to seed
 *   3. Run: npx tsx src/scripts/seed-test-data.ts
 */

// Configuration
const TEST_WEEK_START = "2022-01-03"; // Monday to seed picks for
const TEST_USERS = [
  { id: "test-user-1", email: "test1@example.com" },
  { id: "test-user-2", email: "test2@example.com" },
  { id: "test-user-3", email: "test3@example.com" },
];

// Sample stock picks (will be randomized per user)
const SAMPLE_STOCKS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA",
  "META", "TSLA", "JPM", "V", "WMT"
];

function generateRandomPicks(numStocks: number = 5): { symbol: string; percentage: number }[] {
  // Randomly select stocks
  const shuffled = [...SAMPLE_STOCKS].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, numStocks);

  // Generate random percentages that sum to 100
  const picks = selected.map(() => Math.random());
  const sum = picks.reduce((a, b) => a + b, 0);
  const normalized = picks.map(p => Math.round((p / sum) * 100));

  // Adjust for rounding errors
  const total = normalized.reduce((a, b) => a + b, 0);
  normalized[0] += (100 - total);

  return selected.map((symbol, i) => ({
    symbol,
    percentage: normalized[i],
  }));
}

async function main() {
  console.log(`\n🌱 Seeding test data for week ${TEST_WEEK_START}`);

  // 1. Ensure test users exist
  console.log("\n👥 Creating test users...");
  for (const user of TEST_USERS) {
    await supabase.from("users").upsert(
      { id: user.id, email: user.email },
      { onConflict: "id" }
    );
    console.log(`  ✓ ${user.email}`);
  }

  // 2. Clear existing picks for this week (if any)
  console.log(`\n🧹 Clearing existing picks for ${TEST_WEEK_START}...`);
  const { error: deleteError } = await supabase
    .from("weekly_picks")
    .delete()
    .eq("week_start", TEST_WEEK_START);

  if (deleteError) {
    console.error("Error clearing picks:", deleteError);
    return;
  }

  // 3. Generate and insert random picks for each user
  console.log(`\n📊 Creating random stock picks...`);
  for (const user of TEST_USERS) {
    const picks = generateRandomPicks(Math.floor(Math.random() * 4) + 3); // 3-6 stocks

    for (const pick of picks) {
      await supabase.from("weekly_picks").insert({
        user_id: user.id,
        symbol: pick.symbol,
        percentage: pick.percentage,
        week_start: TEST_WEEK_START,
      });
    }

    console.log(`  ✓ ${user.email}: ${picks.map(p => `${p.symbol} (${p.percentage}%)`).join(", ")}`);
  }

  console.log(`\n✅ Test data seeded successfully!`);
  console.log(`\nNext steps:`);
  console.log(`  1. Set SIMULATION_DATE = "${TEST_WEEK_START}" in src/config/simulation.ts`);
  console.log(`  2. Run: npm run script:daily-update`);
  console.log(`  3. Run: npm run script:weekly-finalize`);
  console.log(`  4. Check leaderboard and group portfolio on frontend`);
}

main().catch(console.error);
