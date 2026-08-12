# Row Level Security Setup

## When to Enable RLS

- **Now (testing with friends):** Keep RLS off, not urgent
- **Before posting publicly:** Enable RLS to prevent data tampering

## Prerequisites (CRITICAL - Do This First!)

### 1. Get Your Service Role Key

1. Go to Supabase Dashboard → Settings → API
2. Copy the `service_role` key (NOT the anon key)
3. Add to `.env.local`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-service-key-here
   ```

### 2. Create Admin Supabase Client

Create `src/lib/supabase-admin.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
```

### 3. Update Admin Scripts

In `src/scripts/daily-update.ts` and `src/scripts/weekly-finalize.ts`:

```typescript
// OLD:
import { supabase } from "@/src/lib/supabase";

// NEW:
import { supabaseAdmin as supabase } from "@/src/lib/supabase-admin";
```

## Enable RLS

1. Open Supabase Dashboard → SQL Editor
2. Copy/paste contents of `supabase/enable-rls.sql`
3. Click "Run"
4. Verify no errors

## Test Everything

After enabling RLS, test:

- ✅ Login with Google
- ✅ Set username (first time)
- ✅ Add stock picks
- ✅ View leaderboard
- ✅ Run `npm run daily-update` (if you have this command)
- ✅ Run `npm run weekly-finalize` (if you have this command)

## If Something Breaks

Run this in SQL Editor to disable RLS immediately:

```sql
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_picks DISABLE ROW LEVEL SECURITY;
ALTER TABLE scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_prices DISABLE ROW LEVEL SECURITY;
ALTER TABLE stocks DISABLE ROW LEVEL SECURITY;
```

Then debug and re-enable.

## What RLS Prevents

- ❌ Users modifying other users' picks
- ❌ Users changing scores
- ❌ Users deleting leaderboard data
- ❌ Unauthorized database access via browser console

## What RLS Allows

- ✅ Anyone can read leaderboard/picks (public data)
- ✅ Users can create/update their own picks
- ✅ Admin scripts can write anything (via service role key)
