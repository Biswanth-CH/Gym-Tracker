# GymTrack — project context

Technical reference for future work. The source in `src/`, `supabase/schema.sql`, and `vite.config.ts` is the source of truth. Do not rebuild working code, weaken RLS, drop tables, reset LocalStorage, or put credentials in the repo.

Live site: https://biswanth-ch.github.io/Gym-Tracker/  
Repo: https://github.com/Biswanth-CH/Gym-Tracker (`main`, GitHub Pages folder `/docs`).

Phase 4 adds per-profile workout plans (`PPL` or `CUSTOM`), muscle-based stretches, a bottom tab bar, compact attendance, and daily body weight. Apply `supabase/migrations/20261107_workout_plans_and_body_weight.sql` before publishing a build that expects those tables. Until that SQL runs, the app still loads existing data and treats the new tables as empty.

**Phase 5** adds a fixed Forgot Password flow, a two-column profile grid with a small corner Edit icon, Delete Profile inside Edit Profile, optional age / height plus a weight field and live BMI in Edit Profile, a sticky header with the active profile name top-right (opens Profile Overview; the bottom tab bar is kept at the user's request), the Profile Overview page, many saved custom splits per profile, a compact Day Details page, simpler muscle / region pages and image captions, and Apply Weight / Reps to All Sets. Apply `supabase/migrations/20261108_phase5_profile_details_and_workout_splits.sql` **before** publishing this build. Until it runs, the app still loads, shows no saved splits (a legacy custom split still shows as active), and explains that the SQL is needed if the user tries to save age / height or a split.

**Phase 6** makes custom splits an account-wide shared library (active split still per profile), adds Muscle Group → Target Region → Exercise Variation selection with explicit `ALL` / `CUSTOM` modes, eight profile colour themes, an optional server-verified 4-digit profile PIN, a full exercise library route, streak 🔥 badges, header branding (landing hero removed), a compact Add Profile button, inline "Name – Type" split labels, today-only day highlight, a compact Overview card, and dated X-axis labels on the weight graph. Apply `supabase/migrations/20261109_phase6_shared_splits_themes_pins.sql` **before** publishing this build (the Phase 5 file is optional; Phase 6 copies from whichever exists). Until it runs, the app still loads, shows no shared splits (a legacy custom split still shows as active), never shows a lock, and explains that the SQL is needed if the user saves a theme, split or PIN.

**Phase 7** adds five exercises and two equipment records (Roman Chair; Plate-Loaded Back Machine with Cross Lat Pulldown and T-Bar Row grips), **Copy From Another Day** in the split editor, per-variation **Form reference videos** (`profile_exercise_form_videos`), a two-row Consistency summary (Valid Gym Days · Went · Missed / Highest Streak · Current Streak · Consistency) with the colour legend behind an info icon, **Weight Data** (calendar of weights) and **Monthly Statistics** pages replacing the inline weight list and the monthly modal, an exact **custom profile colour** (`gym_profiles.custom_theme_color`), and a **Leaderboard** ranked by current (ongoing) streak on the Profiles page (heading now "Profiles", count removed), plus optional **card background images** (with dim, blur and position) for each profile card and each weekly day card. Apply `supabase/migrations/20261124_phase7_form_videos_custom_theme.sql` **before** publishing; until then form videos, custom colours and card backgrounds show a "run the Phase 7 SQL" message and everything else works.

**Phase 8** (`supabase/migrations/20261125_phase8_shared_videos_split_backgrounds.sql`, apply after Phase 7): profile cards without gender, name bottom-left, optional "Hide picture on the profile card" (`gym_profiles.show_photo_on_card`; the photo itself is kept and still shown elsewhere, e.g. the header button, which now shows name + picture); **Zoom** (100–300 %) for all card backgrounds; weekday backgrounds moved from the Day page into the **split editor** (per shared split + weekday, `account_split_day_backgrounds`) with separate **Copy Workouts** and **Copy Background**; **Create Split** asks *Create from Scratch* or *Duplicate Existing Split* (copies days, selections and backgrounds by reference); the Consistency page's today section is the **Consistency Track** card and holds Monthly Statistics; the weekly plan header shows one status button (red "Log today's data" / yellow "Logged partially!" / green "Logged data") that opens the **Today** page (`#/profile/:id/today`) with "Eeroju gym ki vellava?" (Went / Did Not Go / Clear Mark, heading turns green "Eeroju Vella 🥳" or red "Eeroju Vellala 😞") and "Eeroju weight entha?" (Log today's weight → green "Eeroju weight" + value, tap to edit / delete); **shared form videos** for every account (`exercise_form_videos`) with per-profile Hide / Hidden Videos (`profile_hidden_form_videos`), preview hidden until the eye icon is tapped, "Open", no raw URL, and global warnings before Edit / Delete (creator only); signed-URL reuse for faster image loading; header Logout only on the Profiles page (Profile Overview keeps its own); modals render into `<body>` so the bottom navigation can never cover them.

## Architecture

Mobile-first single-page app. React 18 + TypeScript + Vite 6 + one global stylesheet (`src/index.css`). No React Router. Navigation is the URL hash (`src/hooks/useHashRoute.ts`) so GitHub Pages needs no rewrite rules. Auth codes use the query string (`?code=`) via Supabase PKCE so they do not collide with `#/` routes.

Layers:

1. **Pages and components** (`src/pages`, `src/components`) — UI only.
2. **Hooks** (`src/hooks/useCloud.ts`, `useAttendanceTracker.ts`) — read the in-memory store and call services.
3. **Store** (`src/store/cloudStore.ts`) — in-memory mirror of the signed-in account. Not persisted. Supabase is the source of truth.
4. **Cloud services** (`src/services/cloud/*`) — the only modules that should call `getSupabase()`.
5. **Schema** (`supabase/schema.sql`) — tables, RLS, storage, Realtime publication.

`src/services/*StorageService.ts` and `localStorageClient.ts` are the **legacy LocalStorage API**. The signed-in app does not write those keys. Migration reads them once.

Entry: `src/main.tsx` → `src/App.tsx`.

- Missing/invalid Supabase env → `SetupRequiredPage`.
- `AuthProvider` restores the session, then `cloudStore.start(userId)`.
- Empty cloud account plus leftover local profiles → `MigrationPage` (auto-offered once).
- Otherwise hash routes render the workout UI. `AccountBar` can reopen import if it was dismissed and not completed.

## Folder structure

```
src/main.tsx, App.tsx, index.css, vite-env.d.ts
src/auth/AuthProvider.tsx
src/pages/            Auth, profiles, dashboard, day, muscle, region, exercise, consistency, migration, setup
src/components/       shared UI, consistency/, stretch/, workout/
src/hooks/            useCloud, useHashRoute, useAttendanceTracker, useToast, useToday
src/store/cloudStore.ts
src/services/cloud/   auth, profiles, photos, tracking, migration, db, rows, errors
src/services/         legacy LocalStorage services (migration input only)
src/constants/        schedule, muscles, equipment, exercise library, media, stretches, storage keys
src/lib/              supabaseClient.ts, supabaseConfig.ts
src/types/gym.ts
src/utils/            dates, consistency, weights, PRs, images, profiles
public/exercise-images/custom/   original SVGs (also copied into docs/ by the production build)
supabase/schema.sql, supabase/README.md
scripts/generate-illustrations.mjs
docs/                 GitHub Pages output (do not hand-edit; replace from dist/)
```

## Routes

| Hash | Page |
|---|---|
| `#/` | Profiles |
| `#/profile/:id` | Weekly plan |
| `#/profile/:id/consistency` | Attendance calendar |
| `#/profile/:id/overview` | Profile Overview (opened from the header name) |
| `…/exercise/:e/form` (day and library) | Phase 7 Form reference videos of that variation |
| `#/profile/:id/(overview\|consistency)/(weight-data\|monthly-statistics)` | Phase 7 Weight Data calendar / Monthly Statistics |
| `#/profile/:id/library[/muscle/:m[/region/:r[/alternatives \| /exercise/:e]]]` | Phase 6 full exercise library, not limited by the active split |
| `#/profile/:id/day/:dayId` | Muscle groups + stretches |
| `.../muscle/:muscleId` | Regions |
| `.../region/:regionId` | Machine exercises (default) |
| `.../region/:regionId/alternatives` | Alternative exercises |
| `.../exercise/:exerciseId` | Exercise detail, sets, PR, today’s variation |

Unknown ids render an empty state and a back action. Category tab changes replace history so Back does not step through tabs.

## Data flow (set completed)

1. `SetTracker` toggles a checkbox and calls `onSetCompleted` (optimistic local set, reverted on error).
2. `ExerciseDetailsPage` passes `setCompleted` from `useDailyTracker(profileId, exerciseId, todayKey)`.
3. `useDailyTracker` calls `dailySetTrackerService.setCompleted`.
4. The service validates the date (real, not future), upserts `daily_set_tracker_states` on `(profile_id, exercise_id, date)` with `completed_sets` (zero-based indexes), then `cloudStore.applyUpserts`.
5. Postgres Realtime (`postgres_changes`, event `*`) fires on that table. `cloudStore` debounces 150ms and re-reads the table. Other devices update from that re-read. RLS limits events to the owning account.
6. Focus, visibility, and `online` trigger `refreshAll` (focus is skipped if the last full refresh was under 3 seconds). Channel errors resubscribe with exponential backoff (cap 30s). Photo signed URLs refresh on their own timer.

The same shape applies to attendance, selections, set plans, PRs, and profiles: service write → `applyUpserts` / `applyDeletes` → Realtime re-read.

Daily tracker loads are **not** full history. `loadTable` only fetches `daily_set_tracker_states` with `date >= yesterday`. Older rows can remain in Postgres but the UI never shows them. A new local date starts unchecked. There is no offline write queue: the banner says changes cannot be saved until reconnect.

## Supabase client

`src/lib/supabaseConfig.ts` reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. It rejects a missing URL, a non-HTTPS URL (localhost allowed), an `sb_secret_` key, and a JWT whose `role` is `service_role`.

`getSupabase()` (`src/lib/supabaseClient.ts`): one client, PKCE, `persistSession`, `autoRefreshToken`, `detectSessionInUrl`, storage key `gymtrack-auth`. Bucket constant: `gym-profile-photos`.

`getAppUrl()` is the current origin plus path (trailing slash). It is the email redirect target, so production and `http://localhost:5173/` both work when listed in the Supabase redirect allow-list.

## Authentication

`src/services/cloud/authService.ts` + `src/pages/AuthPage.tsx` + `AuthProvider`.

- Email/password sign-up, sign-in, sign-out. Password minimum 8 characters. Sign-up sets `emailRedirectTo` to `getAppUrl()`. If Supabase returns no session, the UI asks the user to confirm email, then sign in.
- Forgot password (fixed in Phase 5): `resetPasswordForEmail` with `redirectTo: getAppUrl()` (works on the GitHub Pages subpath and on localhost). `INITIAL_AUTH_REDIRECT` (`authService.readAuthRedirect`) captures the URL before supabase-js cleans it, reading both the query and a non-route hash.
  - PKCE link (`?code=`): supabase-js exchanges it and emits `PASSWORD_RECOVERY` → status `recovery` → `ResetPasswordPage`. Works in any tab of the requesting browser.
  - Token-hash link (`?token_hash=…&type=recovery`, needs the optional email template in `SUPABASE_SETUP.md` §8a): `AuthProvider` calls `verifyOtp` once (module guard, StrictMode-safe). Works in any browser.
  - A per-tab `sessionStorage` flag keeps the reset screen after a reload. Sync (`cloudStore`) never starts during recovery.
  - After `updateUser({ password })` the app signs out and Sign In shows "Password updated". Expired / reused links (`otp_expired` in query or hash), codes opened in another browser, and expired recovery sessions each show a clear message; failed links open on Forgot Password. Tokens and passwords are never logged.
- Session restore is `onAuthStateChange` (do not call other Supabase APIs inside that callback). Unexpected `SIGNED_OUT` sets a “session ended” notice.
- There are no public data routes. Signed-out users only see auth (or setup, if env is invalid).
- Friendly errors cover bad credentials, unconfirmed email, duplicate account, rate limit, and weak password. `cloudErrors.ts` maps network, JWT/401, RLS/403, unique violations (`23505`), and check constraints.

## Database

Idempotent script: `supabase/schema.sql`. Apply the whole file in the Supabase SQL editor. Do not drop tables to “simplify” a change. `anon` has no table grants. `authenticated` has CRUD, except `local_data_backups` which is select + insert only.

| Table | Natural key | Notes |
|---|---|---|
| `gym_profiles` | PK `id`; unique `(owner_id, lower(btrim(name)))` | `owner_id` → `auth.users` ON DELETE CASCADE. Gender check. Name 1–30. `photo_path`, `tracking_start_date`. Phase 6: `theme_key` (default `lime`, check list of 8). Phase 5: nullable `age_years` (10–120) and `height_cm` numeric(5,1) (50–272). Current weight is not a column: it is the latest `body_weight_entries` row. |
| `attendance_records` | `(profile_id, date)` | `status` `ATTENDED` \| `MISSED`. |
| `daily_exercise_selections` | `(profile_id, exercise_id, date)` | `exercise_id` text, 1–100 chars. No FK to a library table. |
| `exercise_set_templates` | `(profile_id, exercise_id)` | `set_configuration` jsonb object. |
| `daily_set_tracker_states` | `(profile_id, exercise_id, date)` | `completed_sets` `smallint[]`. |
| `exercise_personal_records` | `(profile_id, exercise_id)` | `best_session` jsonb, `notes` ≤ 500, `record_date`. |
| `profile_workout_plans` | unique `profile_id` | The ACTIVE choice. `plan_type` `PPL` \| `CUSTOM`. Phase 5 `active_split_template_id` → `profile_workout_split_templates (id, profile_id)` (composite FK, `ON DELETE SET NULL (active_split_template_id)`); with PPL it remembers the last custom split. Legacy `split_name` / `weekly_schedule` are kept and mirror the active custom split so older builds still work. |
| `profile_workout_split_templates` | PK `id`; unique `(profile_id, lower(btrim(split_name)))`; unique `(id, profile_id)` | Phase 5 per-profile splits. **Legacy since Phase 6**: kept untouched as the migration source; the app no longer reads or writes it. |
| `account_workout_split_templates` | PK `id` | Phase 6 shared library. `owner_id` → `auth.users` (default `auth.uid()`), optional `source_profile_id` (ON DELETE SET NULL), `split_name` 1–40, `weekly_schedule` jsonb. No unique name (migrated duplicates kept). RLS: `owner_id = auth.uid()`; insert/update also require an owned `source_profile_id`. Realtime published. |
| `profile_workout_plans.active_account_split_id` | FK → `account_workout_split_templates` ON DELETE SET NULL | Phase 6 per-profile active (or remembered) shared split. Trigger `check_active_account_split` rejects a split of another account. |
| `gym_profiles.custom_theme_color` | nullable text, CHECK `^#[0-9A-Fa-f]{6}$` | Phase 7 exact custom colour; NULL = preset `theme_key`. |
| `profile_exercise_form_videos` | PK `id`; index `(profile_id, exercise_id)` | Phase 7. `profile_id` FK cascade, `exercise_id` (stable variation id), `video_name` 1–80, `video_url` http(s) only ≤ 2048, `platform` YOUTUBE \| INSTAGRAM \| OTHER, timestamps + `touch_updated_at`. RLS `owns_gym_profile` for select / insert / update / delete; in Realtime. |
| `profile_pin_security` | PK `profile_id` (FK, cascade) | Phase 6. bcrypt `pin_hash`, `failed_attempts`, `lockout_count`, `locked_until`. RLS on and **no grants** to `anon` / `authenticated`: reachable only through SECURITY DEFINER functions. Not published to Realtime. |
| `workout_split_migration_log` | PK `source_key` | Phase 6 internal copy log (no grants) so re-running the migration never re-creates a deleted shared split. |
| `body_weight_entries` | `(profile_id, recorded_date)` | `weight_kg` numeric, greater than 0 and at most 500. |
| `local_data_backups` | `(owner_id, fingerprint)` | Import payload. No update/delete policy. |

Child FKs use `ON DELETE CASCADE` from `gym_profiles`. `touch_updated_at` maintains `updated_at` on profiles, attendance, templates, tracker states, PRs, workout plans, and body weight (not selections or backups).

`set_configuration` / `best_session` shapes are parsed in `src/services/cloud/rows.ts` (`SetPlan`: `{ unit, sets: [{ weight, reps }] }`; best session: `{ weight, unit, reps, sets }`).

### RLS

Enabled on every table above. Policies are for `authenticated` only.

- Profiles: `owner_id = auth.uid()` for select, insert, update, delete. Update `WITH CHECK` blocks changing `owner_id` to someone else.
- Children: `owns_gym_profile(profile_id)` for select, insert, update, delete. The helper is `SECURITY DEFINER`, `search_path = public`, and checks `gym_profiles.owner_id = auth.uid()`.
- Backups: select/insert where `owner_id = auth.uid()`.

Storage policies (see below) are separate. Realtime still applies RLS.

## Storage

Private bucket `gym-profile-photos`. Limit 1 MB. MIME: webp, jpeg, png. Paths: `<auth.uid()>/<profile id>/<timestamp>.<ext>`. Import uses a fixed file name `imported` so retries upsert the same object.

`profilePhotoService.ts` uploads, deletes, lists a profile folder on profile delete, and creates signed URLs (`SIGNED_URL_TTL_SECONDS` = 3600). The store refreshes URLs about 5 minutes before expiry. Failed signing falls back to initials.

Avatars are cropped in `ImageCropper` (zoom 1–4, pan, pinch) and rendered to 256×256 in `imageUtils.ts` before upload.

## Realtime

`schema.sql` adds these tables to publication `supabase_realtime` (not `local_data_backups`): profiles, attendance, selections, templates, tracker states, personal records, workout plans, and body weight.

`cloudStore.subscribeRealtime` opens one channel per user/generation, listens for `*` on each table, and re-reads that table. It does not patch from the event payload. Successful local writes are applied immediately so the acting device does not wait for the event.

## LocalStorage migration

`src/services/cloud/dataMigrationService.ts`. Legacy keys (`src/constants/storageKeys.ts`):

- `gym-tracker-profiles`
- `gym-tracker-attendance`
- `gym-tracker-workout-logs`
- `gym-tracker-exercise-preferences`

Also written by migration only:

- `gym-tracker-backup-before-cloud` (raw snapshot; created once if missing)
- `gym-tracker-cloud-migration:<userId>` marker: `completed` or `dismissed`

Rules:

- Local keys are read, never deleted or rewritten (except the backup and marker keys).
- Profile ids that are already UUIDs are preserved. Otherwise `deriveProfileUuid(userId, localId)` (SHA-256, UUID v5-shaped). If the preserved id is not visible after upsert (another account owns it), the derived id is used.
- Same cloud id → `already-imported`. Same name (case-insensitive) → `merge-by-name`. Else `create`.
- Upserts use `ignoreDuplicates: true`. Existing cloud rows are not overwritten. Photos upload only when `photo_path` is null.
- Attendance status and date are copied.
- Preferences and the latest workout log become a set template (up to 10 sets, default 12 reps or the exercise’s timed max). Weights convert into the plan unit. Bands store null weight.
- `computePersonalRecords` (`src/utils/personalRecords.ts`) picks one best completed set per exercise. That becomes one manual PR with note `Imported from this device’s GymTrack history`. Full session history is not copied into a cloud log table; there is no cloud workout-log table.
- Daily selections are not part of the legacy store.
- Verification re-reads cloud rows and fails the import if a profile, photo, attendance date, plan, or PR is missing. A status that differs from local counts as `keptCloudValues` (cloud wins). The marker is set only after verification.
- Preview counts come from `buildMigrationPlan` before any write.

## Domain modules

**Profiles.** `profileService.ts`, `ProfileModal`, `ProfilesPage`. Name ≤ 30, unique per account, gender `MALE | FEMALE | OTHER | PREFER_NOT_TO_SAY`, tracking start date not in the future. Delete cascades in the database; the app then deletes that profile’s storage folder.

**Attendance.** `attendanceService` + `useAttendanceTracker` + consistency components. Sundays cannot be marked. Future dates cannot be marked. Status `ATTENDED` (went) or `MISSED` (did not go); delete clears the day. Stats in `consistencyUtils.ts`: valid days are Mon–Sat from `trackingStartDate` through today. Unmarked valid days count against consistency. Sundays do not break the streak. Today unmarked does not break it. Calendar is 12 months, Monday-start week columns (`AttendanceCalendar`). Selected exercises show as a dot; the day modal lists them.

**Schedule.** `workoutSchedule.ts` is the built-in PPL split: Mon/Thu push, Tue/Fri pull, Wed/Sat legs, Sunday rest. Each profile can instead use a custom split in `profile_workout_plans` (`workoutPlanService`, `useWorkoutPlan`, `SplitEditor`). `resolveActiveSchedule` is the source for the dashboard and day pages. Switching back to PPL keeps the saved custom days.

**Shared splits (Phase 6, replaces the per-profile collection below).** One library per ACCOUNT in `account_workout_split_templates`; every profile of the account sees the same list (`useWorkoutPlan().accountWorkoutSplits`, sorted by creation). The ACTIVE choice stays per profile (`profile_workout_plans.plan_type` + `active_account_split_id`), so activating a split for one profile never changes another. `workoutSplitTemplateService.create / update / duplicate / remove` (`source_profile_id` = the creating profile), `workoutPlanService.activatePpl / activateWorkoutSplit(profileId, template)`. Editing a shared split changes it for every profile using it (their legacy mirror columns are refreshed); Duplicate makes an independent copy. Delete asks for confirmation, warns how many profiles use it, switches those profiles to PPL, then deletes. `resolveActiveSplit` returns `PPL`, `CUSTOM`, or `LEGACY_CUSTOM` (plan says CUSTOM but its split is missing — e.g. before the Phase 6 SQL). The selector shows "Name – Built-in / Custom" inline and "used by N" per split. Built-in PPL is labelled "PPL", cannot be deleted, can be duplicated.

**Three-level selection (Phase 6).** Each custom day stores `muscleGroupIds` (level 1, kept for older builds) and optional `muscleGroupSelections` (levels 2–3) inside `weekly_schedule`:
`{ muscleGroupId, regionSelectionMode: 'ALL' | 'CUSTOM', regions: [{ regionId, exerciseSelectionMode: 'ALL' | 'CUSTOM', exerciseIds }] }`.
Rules (`src/utils/workoutSelection.ts`, the only place they live): a selected group with no entry = ALL regions + ALL exercises; a region with no entry = ALL its exercises; CUSTOM stores exactly the chosen stable ids and an empty CUSTOM list means NONE; an unreadable mode falls back to ALL, never NONE. With `regionSelectionMode: 'ALL'`, `regions` only lists regions whose exercises were narrowed. Select All Regions resets the group to ALL; choosing every region / exercise individually collapses to ALL but keeps narrowed exercise lists elsewhere. Stored JSON is canonical (library order, ALL entries omitted). Exercises per region come from the library's explicit `targets` (`getExercisesForRegion`), never from secondary-muscle text. Legacy schedules (no selection fields) therefore show everything, exactly as before. `SplitEditor` renders groups and regions as accordions (collapsed by default) with Select All / Deselect All at both levels, per-group exercise search, and "n/N regions · n/N exercises" counts. Workout-day routes are guarded by the selection (`allowedExerciseIdsByRegion`): unselected regions / exercises are not listed and their URLs show "not found". The full library stays browsable at `#/profile/:id/library` (Overview shortcut and a link on each day page).

**Copy a day (Phase 7).** Each day in `SplitEditor` has **Copy From Another Day**: pick a source day, see "Monday → Thursday", and — if the destination already has a workout — a warning plus a **Replace Thursday** button (otherwise **Copy to Thursday**). `copyDayWorkout` (utils/workoutPlan.ts) deep-copies the whole day: workout name, rest flag, muscle groups and every `muscleGroupSelections` entry verbatim, so ALL stays ALL (never frozen into today's exercise ids), explicit empty CUSTOM lists stay empty, and missing selections stay missing (= ALL). The destination keeps its weekday, is replaced (never merged), the source and other days are untouched, a day cannot be copied onto itself. The copy lives in the editor draft until **Save split**.

**Form reference videos (Phase 7).** Exercise page: **Form** button next to **Target Muscles** → `…/exercise/:id/form` (day and library routes). `ExerciseFormVideosPage` lists every video of the active profile for that variation, with **Add Form Video**, and per video: platform icon (YouTube / Instagram / globe), title, readable URL, preview, **Open Video** (new tab, `rel="noopener noreferrer nofollow"`), Edit, Copy Link (Clipboard API with a fallback) and Delete (confirmation). `utils/formVideoLinks.ts` validates http(s) only (no `javascript:` / `data:`), auto-detects the platform (user can override), extracts YouTube ids from watch / youtu.be / shorts / embed / live and Instagram post / Reel codes. Previews: YouTube via the privacy embed `youtube-nocookie.com/embed/<id>?rel=0&autoplay=0` (sandboxed iframe, never autoplays); Instagram via its official `/embed/` page, loaded only when the user taps "Show Instagram preview"; everything else is a link card. Nothing is scraped and no HTML is injected. Storage: `formVideoService` → `profile_exercise_form_videos` (RLS via `owns_gym_profile`, Realtime, cascade on profile delete). The library's exercise id IS the stable variation id, so no separate variation column exists.

**Consistency + body weight (Phase 7).** `ConsistencySummary` shows two rows of three: Valid Gym Days, Went, Missed (selected month, `calculateRangeStats`) and Highest Streak, Current Streak, Consistency %. Highest Streak is the new `calculateLongestStreak` (same rules as `calculateCurrentStreak`: Sundays skipped, missed / unmarked break, today unmarked doesn't), the single implementation of the historical record (the leaderboard ranks by `calculateCurrentStreak` instead). The calendar header's visit count was replaced by an info button (`AttendanceColourInfo`) whose popover shows the unchanged legend (closes on ✕, Escape or outside click). The body-weight card no longer lists previous entries; it ends with **Weight Data** and **Monthly Statistics** buttons, opening `#/profile/:id/(overview|consistency)/weight-data` and `…/monthly-statistics` (Back returns to the opening screen). Weight Data is a Monday-first month calendar (`utils/weightCalendar.ts`): recorded dates are tinted with the theme and show the value (kg / lb from `useWeightUnitPreference`, a per-device display setting; weights stay stored in kg); tapping a past date opens the existing `WeightLogModal` (now with a start date and Delete + confirmation) — one entry per profile per date via the existing upsert. Monthly Statistics is the existing 12-month attendance breakdown (`MonthlyStatistics`, same maths) moved from a modal to a page; there were no separate monthly weight statistics to move.

**Custom colour (Phase 7).** Edit Profile → Colour theme shows the eight presets plus **Custom** (native colour input + HEX field, live preview, Cancel restores). `gym_profiles.custom_theme_color` stores the exact `#RRGGBB` (NULL = use `theme_key`); choosing a preset clears it. `utils/themeColor.ts` derives `--color-brand`, `--color-brand-hover`, `--color-brand-ink` and `--color-brand-rgb` from it, keeping hue / saturation and lightening only as much as needed for 4.5:1 contrast on GymTrack's dark surfaces, and picks dark or light button text by contrast (a hint says when the colour was lightened). `documentTheme` applies it to `<html data-theme="custom">` as inline variables; profile tiles get the same variables inline. The Profiles page itself stays neutral.

**Background gallery (Phase 8b).** `account_background_images` holds every uploaded background of the account with its uploading profile. Edit Background (profile card, or a split day inside the split editor) opens the gallery on **Choose / Replace Image**: groups "Uploaded by – <profile>" only for profiles that have uploaded something (acting profile open first when it has uploads, deleted-profile group last, one empty message when the account has no images), thumbnails, a selected mark, **Upload new image** (compressed, stored as the acting profile, auto-selected) and **Delete** only on the acting profile's own uploads, with a confirmation; since Phase 8c the uploader can delete an image even while it is used: the confirmation (thumbnail, uploader, where it is used) says every card using it returns to its default background; `delete_background_image()` resets all those cards / split days and removes the gallery row in one transaction, then the app deletes the Storage file (if that fails, `utils/pendingFileDeletes.ts` queues it and the gallery retries later), forgets its signed URL and resets the cards locally at once. Unsaved split-editor drafts using the image are dropped too. Selecting reuses the stored path, so nothing is uploaded again; removing or replacing a background never deletes the image. Database: `delete_background_image()` checks uploader + references; storage update / delete policies refuse gallery and in-use files; card / split rows may only reference gallery images. The settings summary ("Background: custom image · dim … · zoom …") appears only inside Edit Background. The split editor shows seven collapsed days (one open at a time, drafts kept); Copy Background was removed (pick the same gallery image instead); Copy Workouts is unchanged. Day cards show only the day and workout name at the bottom-left (Today badge top-right, no icon, no muscle groups). On the Consistency page the Weight Data button spans the full width.

**Split backgrounds (Phase 8).** Weekday backgrounds belong to the shared split: `account_split_day_backgrounds` (split + weekday, path, dim, blur, zoom, position; RLS = split owner, path inside the caller's folder). The split editor keeps them as drafts (`utils/splitBackgrounds.ts`): an image is either a stored path (reused, never re-uploaded) or a newly chosen blob (uploaded once on Save even if several days use it, to `<user>/splits/backgrounds/`). `planBackgroundChanges` decides uploads / upserts / deletes; files are deleted only when no split day, profile card or avatar still references them (`services/cloud/imageReferences.ts`), including after deleting a split or a profile. Duplicating a split (chooser or the list's copy icon) copies the rows with the same paths. Built-in PPL has no backgrounds (duplicate it to customise). Phase 7 weekday rows in `profile_card_backgrounds` were copied to each profile's active / remembered split by the migration and are no longer read.

**Shared form videos (Phase 8).** `exercise_form_videos` (exercise variation id, name, URL, platform, `created_by`): RLS lets every signed-in account read and add, and only the creator edit / delete (the UI hides Edit / Delete on others' videos and asks for confirmation with a global warning on your own). Hiding is private and per profile (`profile_hidden_form_videos`, `owns_gym_profile`); Hidden Videos lists and restores them. One copy per variation + URL. The Phase 7 per-profile table is kept but unused.

**Image caching (Phase 8).** Profile pictures and backgrounds are private, so they are shown through signed URLs. Signed URLs now live 24 h and are reused until less than 2 h remain (`utils/signedUrlCache.ts`): they are kept per user id in localStorage, only for paths inside that user's own folder, and cleared on sign-out. Reusing the same URL lets the browser's HTTP cache serve the image on later visits; uploads are sent with `Cache-Control: max-age=31536000` because files are immutable (every upload is a new path, so a replaced image is never served stale). No service worker is used.

**Card backgrounds (Phase 7).** Optional photo behind each profile tile (Edit Profile → Card background → **Customize Card Background**) and behind each weekday card of a profile's weekly plan (Day page → **Customize Card Background**). Stored per **profile + card** in `profile_card_backgrounds` (`card_key` = `profile` or `monday`…`sunday`), not in the shared split JSON — so Monday never changes Thursday, other profiles are unaffected, backgrounds survive switching splits, and **Copy From Another Day never touches backgrounds** (it only copies workout name + selections). The profile picture is separate and unchanged. Rendering (`CardBackgroundLayers`): an isolated card with three layers — (1) the image (`background-size: cover`, focal point → `background-position`, blur applied to this layer only, slightly scaled so blurred edges don't show), (2) a black overlay whose opacity is the dim %, (3) the unchanged card content, which gets white text with a soft shadow and darker chips while a background is set. No background = no extra markup or classes, so the existing design is untouched. Editor (`CardBackgroundEditor`): upload (JPG / PNG / WebP up to 20 MB; resized to ≤ 1600 px and re-encoded as WebP/JPEG under 950 KB in the browser), live preview of the real card, Dim 0–90 % (default 45), Blur 0–20 px (default 0), Position ↔ / ↕ 0–100 % (default 50), status messages while preparing / uploading, Save, Cancel (nothing is uploaded before Save, so the saved image and settings stay) and Remove Background (with confirmation). Files live in the existing private `gym-profile-photos` bucket at `<user>/<profile>/backgrounds/<card>-<time>.<ext>` and are shown through the same short-lived signed URLs as avatars. Replacing or removing deletes the old file only if no other card or avatar still references it; deleting a profile also deletes its `backgrounds/` folder (the profile-delete cleanup now lists that sub-folder too).

**Leaderboard (Phase 7).** `ProfileLeaderboard` above the Profiles grid: one horizontally scrolling row of avatar + ordinal rank + **current ongoing streak** 🔥 (0 when there is none). `rankByCurrentStreak` uses competition ranking (12, 12, 8, 5 → 1st, 1st, 3rd, 4th; ties keep profile order); a broken streak drops a profile immediately. Highest Streak is not used here — it stays the historical record on the Consistency page; every first-place profile with a streak above zero gets a crown. Values come from `useProfileStreaks` (attendance slice + `calculateCurrentStreak`, the same calculation as the Current Streak stat), so they update with Realtime attendance / profile changes and only include the signed-in account's profiles.

**Profile themes (Phase 6).** `gym_profiles.theme_key` (lime, blue, purple, crimson, amber, teal, rose, slate; default lime). Colour VALUES exist only in the "Profile themes" block of `index.css` (`[data-theme='…']` sets `--color-brand`, `--color-brand-hover`, `--color-brand-ink`, `--color-brand-rgb`); every former hard-coded lime / green accent now uses those tokens (buttons, focus, selected states, anatomy highlight, heatmap "went", attendance toggles, sync pill, chart line, stat icons, today's card). `constants/profileThemes.ts` holds keys / labels; `services/documentTheme.ts` sets `<html data-theme>` from the open profile (none on the Profiles page) plus a preview layer for Edit Profile (cleared on Save / Cancel). Profile tiles carry their own `data-theme` for a subtle accent only. Day cards are neutral; only today's card (local date via `useToday`) is highlighted in the theme colour.

**Profile PIN lock (Phase 6).** Optional, per profile. Server side (`supabase/migrations/20261109_…`): bcrypt via pgcrypto `crypt(pin, gen_salt('bf', 10))` in `profile_pin_security` (no API grants, not in Realtime, never in profile rows). SECURITY DEFINER functions with `search_path` pinned and `owns_gym_profile` checks: `list_locked_profiles()`, `verify_profile_pin`, `set_profile_pin` (current PIN required to change), `remove_profile_pin` (current PIN required), `reset_profile_pin_after_reauth` (Forgot PIN: allowed only if the JWT `amr` shows a sign-in within the last 10 minutes; the app first re-checks the account password with `signInWithPassword`; the old PIN is never revealed). Lockout: 5 wrong PINs in a row → locked 1, 2, 4 … up to 60 minutes, counters reset on success; enforced in the database, so refreshing cannot bypass it. Client: `profilePinService`, `useProfileLocks`, `ProfilePinGatePage` (shown instead of every screen of a locked profile), `ProfileLockSettings` in Edit Profile. Lock state loads together with the data so a locked profile never flashes open. Unlocked profile ids (never PINs) are kept per tab in `sessionStorage` and cleared on logout.

**Saved splits (Phase 5, superseded).** Each profile has its own collection of saved splits (`workoutSplitTemplateService` create / update / duplicate / remove) and one active choice (`workoutPlanService.activatePpl` / `activateTemplate`). `resolveActiveSplit(plan, templates)` returns `PPL`, `CUSTOM` or `LEGACY_CUSTOM` (pre-migration), and `activeSplitDays` feeds the dashboard and day pages. UI: `WorkoutSplitSelector` ("[split ▼] [+ Create Split]"; list with type, active badge, Edit / Duplicate / Delete with in-dialog confirmation) and `SplitEditor` (create / edit all seven days, rest toggle, several groups per day). A new split is activated when created. Deleting the active split switches to PPL first. Switching never changes saved splits. Names are unique per profile, checked in the app and by a unique index. PPL ("Push Pull Legs") is built in, can be duplicated, never deleted.

**Profile Overview.** `ProfileOverviewPage`: picture, name, gender, age | height, BMI, latest weight; stats (this month's consistency, current streak, this month's visits, latest weight) from `consistencyUtils`; the reused `BodyWeightSection`; shortcuts to Weekly Plan and Consistency Tracker; Switch Profile (to `#/`, session kept) and Logout Account (confirmation, then `AuthProvider.signOut`: stops sync and Realtime, clears the remembered profile and route, signs out). Edit Profile (corner pencil) has age, height, a weight field (saved as today's `body_weight_entries` row only when changed) and a live BMI (`calculateBmi`, never stored), plus a Danger zone with Delete Profile and a confirmation step.

**Phase 6 UI.** Header: logo, "GymTrack", "Built by Bisss!" on the left; sync status (icon only on phones), signed-in email (≥ 640px), import, Logout Account and the profile name on the right; the landing hero was removed so "Your Profiles" follows the header. Profile tiles: "N 🔥" streak top-left (`useProfileStreaks`, same `calculateCurrentStreak` as the tracker), pencil top-right, lock icon before the name when PIN-locked, theme accent. Every streak uses `formatStreak` ("5 🔥"). Overview: picture left, name + gender and Age / Height / Weight / BMI on the right (two per row, one per row ≤ 440px). Weekly plan: smaller heading, larger "Eeroju Gym ki ellava?", training / rest day count removed. Weight graph X axis (`utils/weightAxis.ts`): weekday over date for 1–14 days, "Wk n" + start date for 15–90 days (Last Month), months for longer ranges; ≤ 7 labels; every point is placed at its real date.

**Navigation.** `AppHeader` (sticky) shows the brand and, on profile screens, the active profile name with ▼ (no picture); it opens Profile Overview. `BottomNav` (Profiles / Weekly Plan / Consistency) is kept. On the weekly plan, "Eeroju Gym ki ellava?" (✓ / ✕ / ○, `CompactAttendance`) sits on the same row as the profile name and gender; the large Consistency Tracker button was removed (Overview links to it).

**Day details.** Workout name + "Today", the day name, the assigned groups as text (`Chest • Triceps • Shoulders`), two collapsed stretch toggles (one open at a time), then "Choose Muscle Group" cards. Everything is derived from `day.muscleGroupIds`, so any custom split works. Muscle group pages show only the name, diagram and regions; region pages keep the anatomical name and the short emphasis line. Custom (GymTrack) illustrations have no caption; RepDB images keep their required credit link.

**Muscles.** `muscleGroups.ts`. Eight groups, 27 regions: chest 3, shoulders 3, triceps 3, biceps 3 (includes brachialis), back 4, forearms 3, legs 5 (includes adductors), abs 3. Diagrams: `MuscleAnatomyDiagram.tsx`.

**Library.** `exerciseLibrary.ts` — **139** exercises (53 `MACHINE`, 86 `ALTERNATIVE`). Equipment ids must exist in `gymEquipment.ts` (25 pieces: machines incl. the Phase 7 Plate-Loaded Back Machine, cable station, Smith, assisted pull-up/dip, benches incl. the Phase 7 Roman Chair, dumbbells, barbell, EZ bar, bands, bodyweight, treadmill, cycle). Machines reserved for the Machines section have `allowedInAlternatives: false`. `constants/exerciseLibrary.test.ts` enforces these rules. Load types: weighted (default), 15 bodyweight, 3 assisted, 5 band. Three exercises are timed (`SECONDS`). Difficulty defaults to beginner (29 intermediate, 1 advanced).

**Phase 7 exercises.** Grip choices follow the existing convention: each grip is its own exercise (= selectable variation with its own id, PRs, set plan and form videos), not a separate equipment record. `roman-chair-back-extension` (Alternatives, Back → Lower Back, primary erector spinae, secondary glutes / hamstrings, RepDB `back-extension`; the note says the lower back is emphasised, not isolated, and the mistakes warn against lumbar hyperextension). On the `plate-loaded-back-machine` (Machines): `plate-loaded-cross-lat-pulldown-overhand-grip` and `…-neutral-grip` (Lats; RepDB `lat-pulldown` shown as a close variant with an image note) and `plate-loaded-t-bar-row-wide-grip` (Mid Back) / `…-short-grip` (Lats + Mid Back) (RepDB `t-bar-row`, close variant). Both RepDB ids were checked against the free `exercises.json`. The cross-pulldown grip names (overhand / neutral) are an assumption about the machine — rename the two `name` fields if your handles differ (ids can stay or be renamed before any data exists). Recommended sets default to 3.

**Media.** `exerciseMedia.ts`. RepDB stills from `https://exercise-dataset.com/images/flat/<id>-start|peak|main.webp` (needs network). Custom SVGs are relative `exercise-images/custom/…` (16 exercises). `animationUrl` exists on the type; none are bundled. Attribution: `REPDB_ATTRIBUTION`.

**Stretches.** `stretches.ts` holds 37 stretches. `stretchPlan.ts` maps each muscle group to warm-ups and cooldowns. `DayDetailsPage` keeps those lists collapsed behind Pre-Workout and Post-Workout buttons and shows each shared stretch once. Rest days use `REST_DAY_RECOVERY`. `StretchSection` still renders the cards and the RepDB credit.

**Set tracker.** `SetTracker.tsx`. Default plan 3 × 12 (timed exercises use the recommended max seconds). Unit toggle converts from the original typed value (`workoutUtils.convertWeight`, 6 decimal places). Save is explicit (`exercise_set_templates`). Checkboxes are per local date only. Phase 5: focusing a weight or reps input offers "Apply Weight to All Sets" / "Apply Reps to All Sets" (`utils/setPlanDraft.ts`). It changes only the draft (ids, ticks and PRs untouched; KG/LB stays exact via the copied `weightSource`); the user still taps Save Set Plan.

**PRs.** Manual, one per profile + exercise. `prUtils.beatsRecord` suggests an update when a completed set ranks higher (Epley 1RM for weighted reps, least assistance, then added load, then reps/time). Accepting writes `exercise_personal_records`. The Phase 2 helper `personalRecords.ts` still derives a best set from **local** logs for migration only.

**Today’s variation.** `TodayVariationToggle` → `daily_exercise_selections`. Multiple exercises per date. Removing one date does not affect other dates.

## Environment

Expected variables (publishable only; Vite inlines `VITE_*` into `dist/` and therefore `docs/`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

`.env.local` exists on this machine and is not tracked. `.gitignore` excludes `.env`, `.env.*`, and `node_modules/`. `.env.example` has empty placeholders. Never add a secret or service-role key under a `VITE_` name.

## Build and deploy

```bash
npm install
npm run build    # tsc --noEmit && vite build → dist/
```

`vite.config.ts` sets `base: './'` and splits `react`, `supabase`, and `icons` chunks.

Deploy (manual, no GitHub Action): delete stale `docs/assets/`, copy `dist/index.html`, `dist/favicon.svg`, `dist/assets/`, and `dist/exercise-images/` into `docs/`, commit, push `main`. Pages serves `/docs`.

Dev: `npm run dev` (Vite default `http://localhost:5173/`). Preview: `npm run preview`. Tests: `npm test`.

Hash routes are unchanged apart from the new `/overview`. The sticky header shows the active profile name top-right. A fixed bottom bar (`BottomNav`) jumps to Profiles, the last profile’s weekly plan, or that profile’s consistency tracker. It is hidden on auth and migration screens. The last profile id is `gymtrack-last-profile-id` in `sessionStorage`.

## Tests

`npm test` runs Vitest (`vitest.config.ts`) on `src/**/*.test.ts`: workout-plan and multi-split resolution, split names / duplicates, stretch mapping for all eight groups, body-weight comparisons, Set Tracker bulk apply, age / height / BMI parsing, the overview route and password-recovery URL parsing (37 tests). `npm run build` typechecks and builds.

Card backgrounds add `utils/cardBackground.test.ts` (settings limits, layer styles — blur only on the image — storage paths matching the database policy, row mapping, resize maths, copy-day independence): 103 unit tests in total at the time. A throw-away browser suite with a mocked Supabase Storage (real 2400×1600 PNG uploaded through the file input) passed 49 checks: cancel uploads nothing, save + persistence after refresh, compression under 1 MB, independent profiles and weekdays, copy-day keeps backgrounds, replace deletes the old file, remove with confirmation, sharp text over blurred images, no overflow at 375 / 390 / 430 / 1280 px. The Phase 7 PGlite run now has 39 checks (backgrounds + storage ownership).

Phase 7 adds `constants/exerciseLibrary.test.ts` (library integrity + the new exercises) and `utils/phase7.test.ts` (day copy semantics, form-video URL parsing / embeds, custom colour contrast, highest streak, current-streak leaderboard ranking (ties, zero streaks, attendance-driven re-ranking), weight calendar, routes): 93 tests in total. Throw-away (not in the tree) Phase 7 checks: Playwright-core in Edge against the production build with a mocked Supabase API (125 checks at 375 / 390 / 430 / 1280 px + 12 regression checks for shared splits, Set Tracker, PIN, logout and expired reset links) and PGlite with pgcrypto running `schema.sql` (fresh, twice) and the Phase 7 migration twice on a Phase 6 project with data (25 checks). None ran against the real Supabase project.

Phase 6 adds `workoutSelection.test.ts` (three-level defaults, Select / Deselect All, explicit empty CUSTOM, save → reopen, legacy = ALL, library mapping validation) and `phase6Misc.test.ts` (weight axis, PIN result mapping, themes, streak format, library routes): 64 tests in total. Throw-away (not in the tree) Phase 6 checks: Playwright-core in Edge against the production build with a mocked Supabase API and mocked PIN RPCs (149 checks at 375 / 390 / 430 / 1280 px), plus the Phase 5 recovery checks (19), and PGlite with pgcrypto running `schema.sql` + the Phase 6 migration on simulated Phase 5 and Phase 4 projects (62 checks: copy and ids, idempotence and no resurrection, cross-account RLS, ownership trigger, bcrypt hashing, lockout escalation, re-auth reset, Realtime). None of them ran against the real Supabase project.

Phase 5 was also checked with two throw-away scripts that are not in this tree (no new dependencies were added): a Playwright-core run in Microsoft Edge against the production build with a mocked Supabase API (135 checks at 375 / 390 / 430 / 1280 px: layout and overflow, splits, day page, set tracker, profile edit / delete / overview, logout, and the full recovery flow), and a PGlite run of `schema.sql` plus the Phase 5 migration (28 checks: idempotence, data migration, constraints, RLS isolation, cascade, Realtime). Neither ran against the real Supabase project.

## Conventions

Strict TypeScript (`noUnusedLocals`, `noUnusedParameters`). Avoid `any`. Keep Supabase calls in `src/services/cloud`. Map rows in `rows.ts`. Surface failures with `CloudError` / toasts; do not ignore failed writes. Reuse design classes in `index.css` (mobile-first, 44px targets, `prefers-reduced-motion`). Constants live next to the existing schedule, equipment, and library files.

## Known limitations

- No offline queue. Failed writes must be retried by the user.
- RepDB images need internet. Custom SVGs are on the site.
- No exercise GIF/video assets (`animationUrl` unused).
- Supabase free projects can pause after inactivity (platform limit, not an app flag).
- Daily set checkboxes are not a history log. The client only loads yesterday and today.
- Auth email uses Supabase’s built-in sender unless custom SMTP is configured (`SUPABASE_SETUP.md` §7). Confirmation links must open in the same browser (PKCE).
- Legacy workout sessions are not stored as cloud logs; only a derived PR and a set template survive import.
- Unit tests live in the repo; the browser and PGlite scripts used for Phase 5/6 verification are not committed.
- The profile PIN is a privacy lock inside an already signed-in account. The account owner can still read that profile's rows through the API with their own session; it does not protect data from the account owner.
- Unlocked profiles are remembered per browser tab (`sessionStorage`, ids only), so a refresh of the same tab stays unlocked; a new tab or browser session asks again.
- Lock state reaches other devices when the profile row's Realtime event arrives (PIN changes bump `gym_profiles.updated_at`).
- Shared splits migrated from several profiles may contain duplicate names; they are kept on purpose (no silent merge). New names must be unique.
- `.gitignore` excludes `.env`, `.env.*`, and `node_modules/`. `.env.example` has empty placeholders.

Phase 8 adds `utils/phase8.test.ts` (picture visibility mapping, zoom limits and layer styles, split-background copy / duplicate / save planning, ALL / CUSTOM / empty selections on Copy Workouts and duplicates, Today headings and status button, local-date weight lookup, signed-URL reuse / expiry / isolation, shared video hiding and warnings, Today route): 130 unit tests in total at the time. Throw-away (not in the tree) Phase 8 checks: a Playwright-core run in Edge against the production build with a mocked Supabase API and Storage (147 checks at 375 / 390 / 430 / 1280 px), the earlier regression set (12 checks), and PGlite runs of the Phase 8 migration (57 checks) and the Phase 7 migration (39 checks). None ran against the real Supabase project.

Phase 8b updates `utils/phase8.test.ts` (gallery paths, reference reuse without uploads, removal never releases images, gallery grouping incl. duplicates and deleted profiles, uploader-only delete rule, gallery row mapping, editor-only settings summary): 137 unit tests in total (Phase 8c adds the retry-queue tests). Throw-away browser run (mocked Supabase REST / RPC / Storage mirroring the 8b rules): 173 checks at 375 / 390 / 430 / 1280 px, plus the 12-check regression set; PGlite: Phase 8b 37, Phase 8 57, Phase 7 39 checks. None against the real project.

Phase 8c: PGlite 24 checks for the new delete function; browser run with a mocked Supabase mirroring it (including simulated database and storage failures): 187 checks, plus the 12-check regression set. None against the real project.
