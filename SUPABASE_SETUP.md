# GymTrack — Supabase setup guide

GymTrack's website stays on GitHub Pages. Accounts, data, profile photos and live
sync come from **your own Supabase project**. None of the steps below have been
done for you: Claude had no access to your Supabase dashboard, so every step marked
**(you)** must be done by you.

| Item | Value |
|---|---|
| Website | `https://biswanth-ch.github.io/Gym-Tracker/` |
| Local development | `http://localhost:5173/` |
| Database script | `supabase/schema.sql` |
| Environment template | `.env.example` → copy to `.env.local` |

---

## 1. Create a Supabase account (you)
1. Go to <https://supabase.com> and click **Start your project**.
2. Sign up with GitHub or with your email address.

## 2. Create a project (you)
1. In the dashboard, click **New project**.
2. Name it, for example `gymtrack`.
3. Choose a strong **database password** and store it in your password manager. The app never needs it.
4. Pick the region closest to you, then click **Create new project**. Setup takes about a minute.

## 3. Run the database script (you)
1. Open **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this project, copy **all** of it, paste it into the editor and click **Run**.
3. You should see "Success. No rows returned".

The script is safe to run again later, and it never deletes data. It creates:

- **Tables:** `gym_profiles`, `attendance_records`, `daily_exercise_selections`,
  `exercise_set_templates`, `daily_set_tracker_states`, `exercise_personal_records`
  and `local_data_backups`.
- **Data rules:** foreign keys, unique constraints, indexes and `updated_at` triggers.
- **Row Level Security** on every table, with the ownership policies.
- **Photo storage:** the private Storage bucket `gym-profile-photos` and its policies.
- **Live sync:** adds the six synced tables to the `supabase_realtime` publication.

## 4. Get the project URL (you)
1. Open **Project Settings** → **Data API** (in some dashboards: the **Connect** button).
2. Copy the **Project URL**, which looks like `https://abcdefghijklmnop.supabase.co`.

## 5. Get the publishable key (you)
1. Open **Project Settings** → **API Keys**.
2. Copy the **Publishable key**. It starts with `sb_publishable_`.
   - If your project only shows "legacy" keys, use the **anon public** key instead.
3. **Never** use the **secret** key (`sb_secret_…`) or the **service_role** key. They bypass all
   security rules, and everything in the build is public. GymTrack refuses to start if one is supplied.

## 6. Configure `.env.local` (you)
In the project folder (next to `package.json`), copy `.env.example` to `.env.local` and fill in your values:

```env
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxx
```

`.env.local` stays on your computer. **Do not upload it to GitHub.** It doesn't contain
secrets, but it isn't needed there: the values are built into the files in `docs/`.

## 7. Enable email and password sign-in (you)
1. Open **Authentication** → **Sign In / Providers** → **Email**.
2. Make sure **Enable Email provider** is on.
3. **Confirm email:**
   - **On (recommended):** new users must click a link in their inbox before they can sign in.
     Open that link in the **same browser** where you created the account (sign-in uses a secure
     PKCE flow that is tied to that browser).
   - **Off:** sign-up logs the user in immediately.
4. Supabase's built-in email sender is rate-limited (a few emails per hour). For more,
   add your own SMTP server under **Authentication** → **Emails** → **SMTP Settings**.

## 8. Allowed redirect URLs (you)
Open **Authentication** → **URL Configuration**:

- **Site URL:** `https://biswanth-ch.github.io/Gym-Tracker/`
- **Redirect URLs** (add each one):
  - `https://biswanth-ch.github.io/Gym-Tracker/`
  - `https://biswanth-ch.github.io/Gym-Tracker/**`
  - `http://localhost:5173/`
  - `http://localhost:5173/**`

Confirmation and password-reset emails send people back to these addresses. The app
then finishes the sign-in and removes the `?code=…` from the address bar.

## 9. Realtime (check)
`schema.sql` already adds the tables to Realtime. To confirm:

1. Open **Database** → **Publications** → `supabase_realtime`.
2. Make sure these six tables are ticked:
   - `gym_profiles`
   - `attendance_records`
   - `daily_exercise_selections`
   - `exercise_set_templates`
   - `daily_set_tracker_states`
   - `exercise_personal_records`
   - `profile_workout_plans`
   - `body_weight_entries`

   If those last two are missing on an existing project, run `supabase/migrations/20261107_workout_plans_and_body_weight.sql` in the SQL Editor. It only adds tables, policies, and publication entries.

Realtime respects RLS, so each device only receives changes for its own account.

## 10. Verify RLS (recommended)
1. **Table Editor:** every GymTrack table should show **RLS enabled**.
2. **SQL Editor:** run this check. It must return **no rows**:
   ```sql
   select relname from pg_class
   where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity;
   ```
3. **Live test:**
   - Create two accounts, A and B, in two different browsers (or one normal and one private window).
   - Add a profile with account A.
   - Account B must **not** see it, and must be able to create its own profile with the same name.
4. **Storage:** under **Storage** → `gym-profile-photos`, the bucket must show as **Private**.

## 11. Test two-device sync
1. Run `npm install` once, then `npm run dev`, and open `http://localhost:5173/` in two browsers
   (for example Chrome and Edge, or a phone on the same Wi-Fi using the "Network" URL Vite prints).
2. Sign in to the **same account** in both.
3. Check that each change appears on the other device within a second or two, without refreshing:
   - mark today's attendance
   - tick a set in the Set Tracker
   - save a Set Plan
   - add a PR
   - toggle "Today I'm Doing This Variation"
4. Switching to another app or tab and back also re-syncs everything.

## 12. First import of your existing data (do this on the ORIGINAL device)
Your Phase 1 and 2 data lives only in the browser where you used GymTrack before.

1. On **that** browser, open GymTrack (the local dev server, or the website once you've deployed the new build).
2. **Create Account** (or sign in).
3. If your account has no data yet, GymTrack automatically shows **"Bring your data to the cloud"**, with counts of
   profiles, pictures, attendance records, set plans (from your working weights) and personal records
   (from your old workout history).
4. Click **Import data** and wait until every step shows ✓ and **"Import complete and verified"** appears.
5. Your other devices can now simply sign in.

How the import protects your data:

- **Local data is kept.** Nothing in the browser is deleted. A copy is saved locally under
  `gym-tracker-backup-before-cloud`, and another copy goes to the cloud (`local_data_backups`).
- **Cloud data is never overwritten.** Only missing items are added; profiles with the same name are merged.
- **Safe to retry.** If a step fails, click **Retry import**; items already imported are skipped.
- **Optional later.** If you choose **Not now**, the upload icon on the profiles screen reopens the import.

## 13. Build and deploy
1. Make sure `.env.local` exists with your real values (step 6).
2. Run:
   ```bash
   npm install
   npm run build
   ```
3. Replace the contents of `docs/` with the contents of `dist/`:
   - delete the old files in `docs/assets/`
   - copy `dist/index.html`, `dist/favicon.svg`, `dist/assets/` and `dist/exercise-images/` into `docs/`
4. Upload `docs/` and the changed source files to GitHub as usual (Add file → Upload files).
   Never upload `.env.local` or `node_modules/`.
5. GitHub Pages (branch `main`, folder `/docs`) publishes the update in about 1–2 minutes.

If the site shows **"Cloud sync isn't configured yet"**, the build was made without
`.env.local`. Add it and build again.

## Troubleshooting
| Symptom | Fix |
|---|---|
| "Incorrect email or password" right after sign-up | Confirm your email first (step 7), or turn off "Confirm email". |
| Reset or confirmation link opens the sign-in page with an error | Add the redirect URLs from step 8, and open the link in the same browser. |
| Changes don't appear on the other device | Check step 9; the sync badge on the profiles screen should say **Synced**. |
| "You don't have access to that data" | You're signed into a different account than the one that owns that data. |
| Pictures don't show | Re-run `schema.sql` to (re)create the bucket and its policies. |
