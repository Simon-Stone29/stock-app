# Quick Start - Testing Your Stock App

## 1. Set Simulation Date

Edit `src/config/simulation.ts`:

```typescript
export const SIMULATION_DATE: string | null = "2024-01-08"; // Past Monday
```

## 2. Seed Test Data

Edit `src/scripts/seed-test-data.ts` and add your real user ID:

```typescript
const TEST_WEEK_START = "2024-01-08"; // Match simulation date above
const TEST_USERS = [
  { id: "your-real-user-id-here", email: "your-email@gmail.com" },
];
```

**Get your user ID**: Log in → Browser console → Run:
```javascript
supabase.auth.getUser().then(d => console.log(d.data.user.id))
```

Then run:
```bash
npm run script:seed-test
```

## 3. Test Mid-Week Update

Set `SIMULATION_DATE = "2024-01-10"` (Wednesday)

```bash
npm run script:daily-update
```

Should show price updates.

## 4. Test Weekly Finalization

Set `SIMULATION_DATE = "2024-01-15"` (Next Monday)

```bash
npm run script:weekly-finalize
```

Should calculate scores and group portfolio.

## 5. Check Frontend

```bash
npm run dev
```

Visit:
- `http://localhost:3000` → Should show "Simulation Mode Active"
- `http://localhost:3000/leaderboard` → Should show updated scores
- `http://localhost:3000/group-portfolio` → Should show weighted portfolio

## 6. Go to Production

Set `SIMULATION_DATE = null` in `src/config/simulation.ts`

Set up cron jobs (see TESTING.md for GitHub Actions config).

---

**Full documentation**: See `TESTING.md`
