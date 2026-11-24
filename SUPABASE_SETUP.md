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

### 8a. Password reset that works in any browser (optional, recommended)
By default the reset email uses a secure PKCE link that only works in the **same browser**
that asked for it. If someone opens it elsewhere (for example the Gmail app's built-in
browser), GymTrack explains that and offers a new link. To make reset links work everywhere:

1. Open **Authentication** → **Emails** → **Templates** → **Reset Password**.
2. Replace the link in the message body with:
   ```html
   <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Reset your password</a>
   ```
3. Save. GymTrack verifies `token_hash` itself and opens the **Reset password** screen.

### 8b. Test the reset flow (you)
1. Sign out, tap **Forgot password?**, enter your email, **Send reset link**.
2. Open the newest email and click the link → the **Reset password** screen appears.
3. Enter and confirm a new password (8+ characters) → **Update Password**.
4. You land on Sign In with "Password updated". Sign in with the new password.
5. Click the same email link again → you should see "invalid, has expired or was already used".

## 8c. Phase 5 database update (you, existing projects)
Run `supabase/migrations/20261108_phase5_profile_details_and_workout_splits.sql` once in
**SQL Editor** before publishing the Phase 5 build. It adds optional age / height, the
`profile_workout_split_templates` table (RLS, policies, trigger, Realtime) and an active-split
reference, copies each existing custom split into the new table, and keeps the current
active choice. It never drops tables or deletes rows and is safe to run twice.
Afterwards these read-only checks should look right:
```sql
select count(*) from public.profile_workout_split_templates;
select profile_id, plan_type, split_name, active_split_template_id from public.profile_workout_plans;
```

## 8d. Phase 6 database update (you, existing projects — required before publishing Phase 6)
1. *(Recommended)* Back up first: **Database → Backups**, or export the tables you care about.
2. Open **SQL Editor → New query**, paste the **whole** file
   `supabase/migrations/20261109_phase6_shared_splits_themes_pins.sql`, and click **Run**.
   It works whether or not you ran the Phase 5 migration.
3. It is additive and idempotent (safe to run again; a split you delete later is not re-created):
   - enables `pgcrypto` (schema `extensions`) for bcrypt PIN hashes;
   - adds `gym_profiles.theme_key` (existing profiles become `lime`);
   - creates the shared library `account_workout_split_templates` and copies **every** existing
     custom split into it (Phase 5 splits keep their ids, names, schedules, dates and source profile;
     same-named splits from different profiles are all kept), adds
     `profile_workout_plans.active_account_split_id` and keeps each profile's current selection;
   - creates `profile_pin_security` (no API access at all) and the PIN functions;
   - RLS, policies, triggers, indexes and the Realtime entry for the new shared table.
4. Check the result (read-only):
   ```sql
   select count(*) as shared_splits from public.account_workout_split_templates;
   select source_key, target_id from public.workout_split_migration_log order by migrated_at;
   select profile_id, plan_type, active_account_split_id from public.profile_workout_plans;
   select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity;  -- must return no rows
   ```
   `shared_splits` should equal the number of Phase 5 saved splits (or, without Phase 5, the
   number of profiles that had a plan row). Every `CUSTOM` plan should have an `active_account_split_id`.
5. Then publish the new `docs/` build.

**Profile PIN notes.** PINs are bcrypt-hashed in the database, checked only by
`SECURITY DEFINER` functions that verify `auth.uid()` owns the profile, and never returned by any
query or Realtime event. Five wrong PINs lock the profile for 1 minute, then 2, 4 … up to 60
minutes on repeated lockouts. **Forgot PIN** asks for the account password, then clears the PIN
(the database requires a sign-in within the last 10 minutes). The PIN is a privacy lock between
people sharing one account, not a replacement for the account password.

## 8e. Phase 7 database update (you — required before publishing Phase 7)
1. Make sure the Phase 6 migration (§8d) has been applied.
2. *(Recommended)* Back up first (**Database → Backups**).
3. Open **SQL Editor → New query**, paste the **whole** file
   `supabase/migrations/20261124_phase7_form_videos_custom_theme.sql`, and click **Run**.
4. It is additive and safe to run twice. It:
   - adds `gym_profiles.custom_theme_color` (nullable; only `#RRGGBB` accepted). Existing profiles keep
     their preset theme (the column stays NULL) and all eight presets stay valid;
   - creates `profile_exercise_form_videos` (one row per saved form video: profile, exercise variation id,
     name, http(s) URL, platform YouTube / Instagram / Other) with a cascade from `gym_profiles`,
     an index, an `updated_at` trigger, RLS (`owns_gym_profile`) for select / insert / update / delete,
     no `anon` access, and a Realtime entry;
   - creates `profile_card_backgrounds` (one row per profile + card: `profile` or a weekday) holding the
     image path and its dim (0–90 %, default 45), blur (0–20 px, default 0) and focal point (0–100 %),
     with RLS that also requires the path to be inside that profile's own `backgrounds/` folder, an
     `updated_at` trigger and a Realtime entry. The images themselves go into the **existing private**
     `gym-profile-photos` bucket (`<user>/<profile>/backgrounds/…`): no new bucket and no storage-policy
     change are needed — the existing policies already keep every file inside its owner's folder and
     the 1 MB limit fits the app's compressed uploads (≤ 950 KB WebP / JPEG);
   - does **not** touch PIN tables or functions, splits, attendance or any other data.
5. Check (read-only):
   ```sql
   select column_name from information_schema.columns where table_name = 'gym_profiles' and column_name = 'custom_theme_color';
   select count(*) from public.profile_exercise_form_videos;   -- 0 right after the migration
   select count(*) from public.profile_card_backgrounds;       -- 0 right after the migration
   select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity;  -- no rows
   ```
6. Then publish the new `docs/` build.

Form videos only store links. Previews use YouTube's privacy embed (no autoplay) and Instagram's
official embed (loaded only when tapped); other links show as a plain link card.

## 8f. Phase 8 database update (you — required before publishing Phase 8)
1. Make sure the Phase 7 migration (§8e) has been applied (the Phase 8 file stops with a clear message otherwise).
2. *(Recommended)* Back up first (**Database → Backups**).
3. Open **SQL Editor → New query**, paste the **whole** file
   `supabase/migrations/20261125_phase8_shared_videos_split_backgrounds.sql`, and click **Run**.
4. It is additive and safe to run twice. It:
   - adds `gym_profiles.show_photo_on_card` (default `true`: every card keeps its picture);
   - adds `zoom_percent` (100–300 %, default 100) to `profile_card_backgrounds`;
   - creates `account_split_day_backgrounds` (one row per **shared split + weekday**, with image path, dim,
     blur, zoom and position). RLS: only the split's owner account can read / write, and the path must be
     inside the caller's own `<user>/` folder. Each existing Phase 7 weekday background is copied to that
     profile's active (or remembered) custom split, **reusing the same image file**;
   - creates `exercise_form_videos` (shared by every signed-in account, per exercise variation; one copy per
     variation + URL) and copies every Phase 7 profile video into it (same id, name, URL, platform and
     dates for the first copy; the adding account becomes `created_by`);
   - creates `profile_hidden_form_videos` (private per-profile "Hide", RLS `owns_gym_profile`);
   - adds the three new tables to Realtime; keeps `profile_exercise_form_videos` and the Phase 7 weekday rows
     untouched (no longer read by the app — they can be dropped later once you are happy);
   - records its one-time copies in `phase8_migration_log`, so re-running it never re-creates something you deleted.
5. **Who can do what with shared form videos:** any signed-in user can read and add; only the account that
   added a video can edit or delete it (the app shows Edit / Delete only on your own videos, after a warning
   that it affects everyone); `anon` has no access. Note: if sign-ups are open on your project, any new account
   can add videos — turn off public sign-ups (**Authentication → Providers → Email → Allow new users**) if
   only people you know use GymTrack.
6. **Storage: no change needed.** New split backgrounds go to the existing private `gym-profile-photos`
   bucket under `<user>/splits/backgrounds/`; the existing owner-folder policies already cover it.
   New uploads are sent with `Cache-Control: max-age=31536000` (files are never overwritten — every upload
   has a new path); files uploaded earlier keep their 1-hour header and still benefit from URL reuse.
7. Check (read-only):
   ```sql
   select column_name from information_schema.columns where table_name = 'gym_profiles' and column_name = 'show_photo_on_card';
   select column_name from information_schema.columns where table_name = 'profile_card_backgrounds' and column_name = 'zoom_percent';
   select count(*) from public.account_split_day_backgrounds;   -- copied weekday backgrounds
   select count(*) from public.exercise_form_videos;            -- ≤ profile_exercise_form_videos (same link per variation merged)
   select count(*) from public.profile_exercise_form_videos;    -- unchanged
   select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity;  -- no rows
   ```
8. Then publish the new `docs/` build.

## 8g. Phase 8b database update — background gallery (you — required before publishing Phase 8b)
1. Make sure the Phase 8 migration (§8f) has been applied (8b stops with a clear message otherwise).
2. *(Recommended)* Back up first.
3. In **SQL Editor**, run the whole file `supabase/migrations/20261126_phase8b_background_gallery.sql`. It is additive and safe to run twice. It:
   - creates `account_background_images` (one row per uploaded background: account, **uploading profile**, path). Every profile of the account can read it; inserts must name a profile of the account and a file in that profile's own `backgrounds/` folder; there is **no** UPDATE / DELETE grant;
   - registers every image already used by a profile card or split day (uploader = the profile whose folder holds it; split-folder images → the split's creating profile, else the account's oldest profile). No background row or file is changed;
   - lets profile cards and split days point at **any gallery image of the account** (so a profile can use another profile's image by reference), and only at gallery images;
   - adds `delete_background_image(image, acting profile)` (SECURITY DEFINER): only the uploading profile may delete (images of a deleted profile: any profile of the account), never while a card or split day uses the image;
   - **changes two Storage policies** on `gym-profile-photos`: `gym_photos_update_own` and `gym_photos_delete_own` keep the owner-folder rule and additionally refuse files that are still in the gallery or used by a card / split day. Select / insert are unchanged; avatars behave as before;
   - adds the gallery to Realtime.
   The Phase 7 and Phase 8 files now skip their older card / split policies once the gallery exists, so re-running them never weakens 8b.
4. Check (read-only):
   ```sql
   select count(*) from public.account_background_images;
   select count(*) from (select storage_path from public.profile_card_backgrounds union select storage_path from public.account_split_day_backgrounds) used
     where storage_path not in (select storage_path from public.account_background_images);   -- 0
   select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'gym_photos%';
   ```
5. Then publish the new `docs/` build.

**About "only the uploader can delete":** profiles are not separate logins; all profiles of an account share one Supabase sign-in. The database checks that the acting profile is the uploader *and* belongs to the signed-in account, and it always blocks other accounts and images still in use. Someone signed in to the same account could still claim to be the uploading profile in a hand-made request; true per-profile enforcement would need per-profile sign-in.

## 8h. Phase 8c database update — deleting images that are in use (you)
1. Make sure the Phase 8b migration (§8g) has been applied.
2. In **SQL Editor**, run the whole file `supabase/migrations/20261127_phase8c_background_delete_cleanup.sql`. It only replaces the function `delete_background_image`; no table, policy or data changes; safe to re-run.
3. New behaviour: the uploader can delete an image even while it is used. In **one transaction** the function checks that the image belongs to the signed-in account, that the acting profile belongs to the account and is the uploader, then removes every profile-card and split-day background using the image (those cards return to their default look) and the gallery row. The app then deletes the Storage file (allowed only now, by the unchanged 8b storage policy). If any database step fails, nothing changes and the file is kept. If only the file deletion fails, the file is queued in the browser and retried automatically the next time the gallery opens; nothing references it, so it is never shown.
4. Check (read-only):
   ```sql
   select prosrc like '%for update%' as new_version from pg_proc where proname = 'delete_background_image';  -- true
   ```
5. If you ever re-run the Phase 8b file after this, run this file again (8b contains the older refuse-while-in-use function).

The same limitation as §8g applies: profiles share one sign-in, so "acting profile = uploader" is checked within the account; other accounts can never delete.

## 9. Realtime (check)
`schema.sql` already adds the tables to Realtime. To confirm:

1. Open **Database** → **Publications** → `supabase_realtime`.
2. Make sure these tables are ticked (`account_workout_split_templates` is the one the Phase 6
   app uses; `profile_workout_split_templates` is the Phase 5 legacy table; `profile_pin_security`
   must **not** be published):
   - `account_workout_split_templates`
   - `profile_exercise_form_videos` (Phase 7)
   - `profile_card_backgrounds` (Phase 7)
   - `account_split_day_backgrounds`, `exercise_form_videos`, `profile_hidden_form_videos` (Phase 8)
   - `account_background_images` (Phase 8b)
   - `gym_profiles`
   - `attendance_records`
   - `daily_exercise_selections`
   - `exercise_set_templates`
   - `daily_set_tracker_states`
   - `exercise_personal_records`
   - `profile_workout_plans`
   - `body_weight_entries`
   - `profile_workout_split_templates`

   If `profile_workout_plans` / `body_weight_entries` are missing on an existing project, run `supabase/migrations/20261107_workout_plans_and_body_weight.sql`; if `profile_workout_split_templates` is missing, run the Phase 5 migration (§8c). They only add tables, columns, policies, and publication entries.

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
