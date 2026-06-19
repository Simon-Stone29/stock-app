# Testing Guide for Stock App

## Overview

Your app now has a **simulation mode** that lets you test with historical data. This guide explains how to test both the frontend and backend scripts.

---

## Script Architecture

### **1. `daily-update.ts`**
- **Purpose**: Update stock prices during the trading week
- **What it does**: Fetches current prices, updates `stock_prices` table (NO score changes)
- **Run schedule**: Daily during market hours (Mon-Fri, 5 PM ET)
- **Command**: `npm run script:daily-update`

### **2. `weekly-finalize.ts`**
- **Purpose**: Finalize weekly scores and calculate group portfolio
- **What it does**:
  - Locks in final prices (Monday open → Friday close)
  - Calculates user returns and updates competence scores
  - Generates weighted group portfolio for NEXT week
- **Run schedule**: Monday 1 AM (after voting closes Sunday midnight)
- **Command**: `npm run script:weekly-finalize`

### **3. `seed-test-data.ts`**
- **Purpose**: Create sample picks for testing
- **What it does**: Generates random stock picks for test users
- **Run schedule**: Manual (only when you need test data)
- **Command**: `npm run script:seed-test`

---

## Testing Workflow

### **Step 1: Set Up Simulation Mode**

Edit `src/config/simulation.ts`:

```typescript
export const SIMULATION_DATE: string | null = "2024-01-08"; // Set to a past Monday
```

This makes the **entire app** (frontend + scripts) use this date.

### **Step 2: Seed Test Data**

Edit `src/scripts/seed-test-data.ts` and set:

```typescript
const TEST_WEEK_START = "2024-01-08"; // Match your SIMULATION_DATE
const TEST_USERS = [
  { id: "your-actual-user-id", email: "your-email@gmail.com" },
  { id: "test-user-2", email: "test2@example.com" },
];
```

**Get your real user ID:**
1. Log into the app
2. Open browser console
3. Run: `supabase.auth.getUser().then(d => console.log(d.data.user.id))`
4. Copy the UUID and add to TEST_USERS

Then run:

```bash
npm run script:seed-test
```

You should see:
```
🌱 Seeding test data for week 2024-01-08
👥 Creating test users...
  ✓ your-email@gmail.com
📊 Creating random stock picks...
  ✓ your-email@gmail.com: AAPL (30%), MSFT (25%), GOOGL (45%)
✅ Test data seeded successfully!
```

### **Step 3: Run Scripts in Sequence**

#### **3a. Daily Update (Mid-Week)**

First, test a mid-week price update (e.g., Wednesday):

```typescript
// src/config/simulation.ts
export const SIMULATION_DATE = "2024-01-10"; // Wednesday
```

Run:
```bash
npm run script:daily-update
```

Expected output:
```
📊 Daily Price Update
   Today: 2024-01-10
   Current week starts: 2024-01-08
   [SIMULATION MODE]

📈 Fetching prices for 5 symbols
  AAPL: $185.00 → $190.50 (+2.97%)
  MSFT: $370.00 → $375.20 (+1.41%)
  ...

💰 Current Week Performance (unrealized)
  User abc12345: +1.85% (unrealized)
✅ Daily update complete.
```

**Verify**:
- Check Supabase → `stock_prices` table → `close_price` updated
- Frontend should show updated prices (if you refresh)

#### **3b. Weekly Finalize (End of Week)**

Now simulate Monday morning (finalize the previous week):

```typescript
// src/config/simulation.ts
export const SIMULATION_DATE = "2024-01-15"; // Next Monday
```

Run:
```bash
npm run script:weekly-finalize
```

Expected output:
```
📊 Weekly Scoring & Portfolio Calculation
   Week to finalize: 2024-01-08 to 2024-01-12
   Running on: 2024-01-15
   [SIMULATION MODE]

📈 Finalizing prices for 5 symbols
  AAPL: 2024-01-08 $185.00 → 2024-01-12 $192.00 (+3.78%)
  MSFT: 2024-01-08 $370.00 → 2024-01-12 $378.00 (+2.16%)
  ...

💰 Calculating final returns and updating scores
  User abc12345: +2.45% return | 1000 + 2 = 1002

🎯 Calculating weighted portfolio for week 2024-01-15
Portfolio for 2024-01-15:
  AAPL: 35.2%
  MSFT: 28.7%
  ...
✅ Weekly finalization complete.
```

**Verify**:
- Supabase → `scores` table → new row for `week_start = 2024-01-08`
- Supabase → `weekly_portfolio` table → rows for `week_start = 2024-01-15`
- Leaderboard page shows updated scores
- Group Portfolio page shows new allocations

---

## Testing the Frontend

### **With Simulation Mode (Production Testing)**

1. Set `SIMULATION_DATE` in `src/config/simulation.ts`
2. Run `npm run dev`
3. Frontend will:
   - Show "Simulation Mode Active" banner
   - Use server time (no manual controls)
   - Voting locked/unlocked based on simulated day

### **Without Simulation Mode (Manual Testing)**

1. Set `SIMULATION_DATE = null` in `src/config/simulation.ts`
2. Run `npm run dev`
3. Frontend will:
   - Show manual date/time picker
   - Let you test voting windows by changing date

**Test Voting Window:**
- Set datetime to `Saturday 10:00 AM` → should show "🔓 VOTING"
- Set datetime to `Monday 10:00 AM` → should show "🔒 LOCKED"

---

## Common Testing Scenarios

### **Scenario 1: Test a Full Week Cycle**

```typescript
// Week 1: Users vote
SIMULATION_DATE = "2024-01-06T10:00"; // Saturday voting open
// → Manually submit picks via frontend

// Week 1: Monday morning finalization
SIMULATION_DATE = "2024-01-15T01:00"; // Monday 1 AM
// → Run: npm run script:weekly-finalize

// Week 2: Users vote for next week
SIMULATION_DATE = "2024-01-13T10:00"; // Saturday voting
// → Submit picks for 2024-01-15

// Week 2: Daily tracking
SIMULATION_DATE = "2024-01-17"; // Wednesday
// → Run: npm run script:daily-update
```

### **Scenario 2: Test Multiple Weeks**

```bash
# Seed week 1
npm run script:seed-test  # TEST_WEEK_START = "2024-01-08"

# Finalize week 1
SIMULATION_DATE = "2024-01-15"
npm run script:weekly-finalize

# Seed week 2
npm run script:seed-test  # TEST_WEEK_START = "2024-01-15"

# Finalize week 2
SIMULATION_DATE = "2024-01-22"
npm run script:weekly-finalize

# Check leaderboard → should show score progression
```

### **Scenario 3: Test Edge Cases**

**No picks submitted:**
```bash
# Seed picks but delete them
# Run weekly-finalize → should skip gracefully
```

**Market closed (holiday):**
```bash
SIMULATION_DATE = "2024-01-15" # MLK Day
npm run script:daily-update
# → Script finds nearest trading day automatically
```

**Re-running finalization:**
```bash
npm run script:weekly-finalize
# First run: scores calculated
# Second run: "Week already finalized. Skipping."
```

---

## Production Deployment

### **Cron Jobs (GitHub Actions)**

Create `.github/workflows/daily-update.yml`:

```yaml
name: Daily Price Update
on:
  schedule:
    - cron: '0 21 * * 1-5'  # 5 PM ET Mon-Fri (21:00 UTC)
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run script:daily-update
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
```

Create `.github/workflows/weekly-finalize.yml`:

```yaml
name: Weekly Finalization
on:
  schedule:
    - cron: '0 5 * * 1'  # 1 AM ET Monday (05:00 UTC)
jobs:
  finalize:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run script:weekly-finalize
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
```

**Set GitHub Secrets:**
1. Go to repo → Settings → Secrets → Actions
2. Add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`

### **Alternative: Vercel Cron Jobs**

If deploying on Vercel, use `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-update",
      "schedule": "0 21 * * 1-5"
    },
    {
      "path": "/api/cron/weekly-finalize",
      "schedule": "0 5 * * 1"
    }
  ]
}
```

Then create API routes that call your scripts.

---

## Troubleshooting

### **"No picks found for this week"**
→ Run `npm run script:seed-test` first

### **"Week already finalized"**
→ Delete rows from `scores` table where `week_start = '2024-01-08'`

### **Prices not updating**
→ Check Yahoo Finance API is accessible (try in browser: `https://finance.yahoo.com/quote/AAPL`)

### **Frontend not updating**
→ Clear browser cache or hard refresh (Ctrl+Shift+R)

### **Simulation mode not working**
→ Restart `npm run dev` after changing `simulation.ts`

---

## Quick Reference

### **Commands**
```bash
npm run dev                    # Start frontend
npm run script:seed-test       # Seed test data
npm run script:daily-update    # Update prices (mid-week)
npm run script:weekly-finalize # Finalize scores (Monday)
```

### **Key Files**
- `src/config/simulation.ts` → Set test date
- `src/scripts/seed-test-data.ts` → Configure test users
- `TESTING.md` → This file

### **Database Tables**
- `weekly_picks` → User stock selections
- `stock_prices` → Price data (open/close)
- `scores` → Competence scores by week
- `weekly_portfolio` → Group portfolio allocations

---

## Next Steps

1. **Test locally** with simulation mode
2. **Verify** all scripts run correctly
3. **Deploy** to production
4. **Set up** GitHub Actions or Vercel cron
5. **Monitor** script runs (check logs)

Questions? Check the inline comments in each script file.
