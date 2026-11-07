# GymTrack — project context

Technical reference for future work. The source in `src/`, `supabase/schema.sql`, and `vite.config.ts` is the source of truth. Do not rebuild working code, weaken RLS, drop tables, reset LocalStorage, or put credentials in the repo.

Live site: https://biswanth-ch.github.io/Gym-Tracker/  
Repo: https://github.com/Biswanth-CH/Gym-Tracker (`main`, GitHub Pages folder `/docs`).

Phase 4 adds per-profile workout plans (`PPL` or `CUSTOM`), muscle-based stretches, a bottom tab bar, compact attendance, and daily body weight. Apply `supabase/migrations/20261107_workout_plans_and_body_weight.sql` before publishing a build that expects those tables. Until that SQL runs, the app still loads existing data and treats the new tables as empty.

**Phase 5** adds a fixed Forgot Password flow, a two-column profile grid with a small corner Edit icon, Delete Profile inside Edit Profile, optional age / height plus a weight field and live BMI in Edit Profile, a sticky header with the active profile name top-right (opens Profile Overview; the bottom tab bar is kept at the user's request), the Profile Overview page, many saved custom splits per profile, a compact Day Details page, simpler muscle / region pages and image captions, and Apply Weight / Reps to All Sets. Apply `supabase/migrations/20261108_phase5_profile_details_and_workout_splits.sql` **before** publishing this build. Until it runs, the app still loads, shows no saved splits (a legacy custom split still shows as active), and explains that the SQL is needed if the user tries to save age / height or a split.

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
| `gym_profiles` | PK `id`; unique `(owner_id, lower(btrim(name)))` | `owner_id` → `auth.users` ON DELETE CASCADE. Gender check. Name 1–30. `photo_path`, `tracking_start_date`. Phase 5: nullable `age_years` (10–120) and `height_cm` numeric(5,1) (50–272). Current weight is not a column: it is the latest `body_weight_entries` row. |
| `attendance_records` | `(profile_id, date)` | `status` `ATTENDED` \| `MISSED`. |
| `daily_exercise_selections` | `(profile_id, exercise_id, date)` | `exercise_id` text, 1–100 chars. No FK to a library table. |
| `exercise_set_templates` | `(profile_id, exercise_id)` | `set_configuration` jsonb object. |
| `daily_set_tracker_states` | `(profile_id, exercise_id, date)` | `completed_sets` `smallint[]`. |
| `exercise_personal_records` | `(profile_id, exercise_id)` | `best_session` jsonb, `notes` ≤ 500, `record_date`. |
| `profile_workout_plans` | unique `profile_id` | The ACTIVE choice. `plan_type` `PPL` \| `CUSTOM`. Phase 5 `active_split_template_id` → `profile_workout_split_templates (id, profile_id)` (composite FK, `ON DELETE SET NULL (active_split_template_id)`); with PPL it remembers the last custom split. Legacy `split_name` / `weekly_schedule` are kept and mirror the active custom split so older builds still work. |
| `profile_workout_split_templates` | PK `id`; unique `(profile_id, lower(btrim(split_name)))`; unique `(id, profile_id)` | Phase 5. Any number of saved custom splits per profile. `split_name` 1–40, `weekly_schedule` jsonb `{ days: [...] }`. Built-in PPL is never stored here and cannot be deleted. |
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

**Saved splits (Phase 5).** Each profile has its own collection of saved splits (`workoutSplitTemplateService` create / update / duplicate / remove) and one active choice (`workoutPlanService.activatePpl` / `activateTemplate`). `resolveActiveSplit(plan, templates)` returns `PPL`, `CUSTOM` or `LEGACY_CUSTOM` (pre-migration), and `activeSplitDays` feeds the dashboard and day pages. UI: `WorkoutSplitSelector` ("[split ▼] [+ Create Split]"; list with type, active badge, Edit / Duplicate / Delete with in-dialog confirmation) and `SplitEditor` (create / edit all seven days, rest toggle, several groups per day). A new split is activated when created. Deleting the active split switches to PPL first. Switching never changes saved splits. Names are unique per profile, checked in the app and by a unique index. PPL ("Push Pull Legs") is built in, can be duplicated, never deleted.

**Profile Overview.** `ProfileOverviewPage`: picture, name, gender, age | height, BMI, latest weight; stats (this month's consistency, current streak, this month's visits, latest weight) from `consistencyUtils`; the reused `BodyWeightSection`; shortcuts to Weekly Plan and Consistency Tracker; Switch Profile (to `#/`, session kept) and Logout Account (confirmation, then `AuthProvider.signOut`: stops sync and Realtime, clears the remembered profile and route, signs out). Edit Profile (corner pencil) has age, height, a weight field (saved as today's `body_weight_entries` row only when changed) and a live BMI (`calculateBmi`, never stored), plus a Danger zone with Delete Profile and a confirmation step.

**Navigation.** `AppHeader` (sticky) shows the brand and, on profile screens, the active profile name with ▼ (no picture); it opens Profile Overview. `BottomNav` (Profiles / Weekly Plan / Consistency) is kept. On the weekly plan, "Eeroju Gym ki ellava?" (✓ / ✕ / ○, `CompactAttendance`) sits on the same row as the profile name and gender; the large Consistency Tracker button was removed (Overview links to it).

**Day details.** Workout name + "Today", the day name, the assigned groups as text (`Chest • Triceps • Shoulders`), two collapsed stretch toggles (one open at a time), then "Choose Muscle Group" cards. Everything is derived from `day.muscleGroupIds`, so any custom split works. Muscle group pages show only the name, diagram and regions; region pages keep the anatomical name and the short emphasis line. Custom (GymTrack) illustrations have no caption; RepDB images keep their required credit link.

**Muscles.** `muscleGroups.ts`. Eight groups, 27 regions: chest 3, shoulders 3, triceps 3, biceps 3 (includes brachialis), back 4, forearms 3, legs 5 (includes adductors), abs 3. Diagrams: `MuscleAnatomyDiagram.tsx`.

**Library.** `exerciseLibrary.ts` — **134** exercises (49 `MACHINE`, 85 `ALTERNATIVE`). Equipment ids must exist in `gymEquipment.ts` (23 pieces: machines, cable station, Smith, assisted pull-up/dip, benches, dumbbells, barbell, EZ bar, bands, bodyweight, treadmill, cycle). Machines reserved for the Machines section have `allowedInAlternatives: false`. Load types: weighted (default), 14 bodyweight, 3 assisted, 5 band. Three exercises are timed (`SECONDS`). Difficulty defaults to beginner (27 intermediate, 1 advanced). Recommended sets default to 3.

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
- Unit tests cover plan, stretch, and weight maths. There is no browser automation suite.
- `.gitignore` excludes `.env`, `.env.*`, and `node_modules/`. `.env.example` has empty placeholders.
