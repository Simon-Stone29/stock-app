# AlphaPool

AlphaPool is a stock-picking competition. Users allocate a virtual portfolio to stocks each week, track performance against the week's opening prices, and contribute to a shared portfolio whose allocations are weighted by users' competence scores.

## Get started

### Requirements

- Node.js 22 (the scheduled GitHub Actions workflows use Node 22)
- npm
- A Supabase project with the tables and policies used by the app and scripts

### Install and run

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Create `.env.local` in the project root. The browser app needs:

```text
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

The scheduled scripts also need:

```text
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

`GEMINI_API_KEY` is optional and enables the daily group-portfolio summary. Never expose the service-role key in client-side code or commit secrets. See [Supabase RLS setup](./supabase/RLS-SETUP-INSTRUCTIONS.md) before configuring database access.

## Where the logic lives

### App routes

| File | Responsibility |
| --- | --- |
| `app/page.tsx` | Main “My Picks” experience: authentication state, stock picks, individual portfolio performance, and history. |
| `app/group-portfolio/page.tsx` | Shared portfolio allocations, performance history, benchmark history, and the generated daily summary. |
| `app/leaderboard/page.tsx` | User rankings and latest portfolio values. |
| `app/about/page.tsx` | Product overview and how the weekly competition works. |
| `app/api/time-context/route.ts` | Supplies the current app time, week start, and voting status to the browser. |
| `app/layout.tsx` | Shared page layout, navigation, metadata, and global styles. |

### Shared code

| File | Responsibility |
| --- | --- |
| `src/lib/weekDates.ts` | Shared New York timezone, week-boundary, and voting-window calculations. Use this rather than local-machine date methods for competition timing. |
| `src/lib/supabase.ts` | Browser Supabase client, using the public anon key. |
| `src/lib/supabase-server.ts` | Server Supabase client setup. |
| `src/lib/utils.ts` | Shared UI utility functions. |
| `src/config/simulation.ts` | Simulation date switch used by app timing and scheduled scripts. |
| `src/components/` | Navigation, first-visit handling, username setup, and reusable UI components. |

### Background jobs and database

| File | Responsibility |
| --- | --- |
| `src/scripts/daily-update.ts` | Fetches current or simulated stock prices, updates daily user scores and group snapshots, and optionally generates the group summary. |
| `src/scripts/weekly-finalize.ts` | Initializes weekly prices and calculates the next shared portfolio using users' competence-weighted picks. |
| `src/scripts/run-simulation.ts` | Runs the weekly and daily scripts across configured historical dates. |
| `.github/workflows/daily-update.yml` | Scheduled/manual GitHub Actions workflow for the daily update. |
| `.github/workflows/weekly-finalize.yml` | Scheduled/manual GitHub Actions workflow for weekly finalization. |
| `supabase/` | SQL setup, seed, cleanup, and migration files. |


## Scheduled jobs

GitHub Actions runs the daily update on weekdays and weekly finalization on Mondays; both workflows can also be started manually. Add the following repository Actions secrets for the scheduled jobs:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `GEMINI_API_KEY` (optional; used by the daily update)

The app also requires `NEXT_PUBLIC_SUPABASE_ANON_KEY` locally. Keep private keys in environment variables and configure production app environment variables in the deployment platform.
