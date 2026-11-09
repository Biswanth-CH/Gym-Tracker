# Supabase database for GymTrack

`schema.sql` creates everything GymTrack needs in a Supabase project. Run the whole
file in **Dashboard → SQL Editor**. It is idempotent: re-running it keeps existing data.
For the full step-by-step setup, see `../SUPABASE_SETUP.md`.

## Ownership model
```
auth.users (Supabase accounts)
   ├── account_workout_split_templates   owner_id = auth.uid(); shared split library of the account (Phase 6)
   └── gym_profiles            owner_id = auth.uid(); optional age_years, height_cm (5); theme_key (6)
          ├── profile_pin_security         bcrypt hash + lockout; NO API grants, functions only (Phase 6)
          ├── attendance_records          unique (profile_id, date)
          ├── daily_exercise_selections   unique (profile_id, exercise_id, date)
          ├── exercise_set_templates      unique (profile_id, exercise_id)
          ├── daily_set_tracker_states    unique (profile_id, exercise_id, date)
          ├── exercise_personal_records   unique (profile_id, exercise_id)
          ├── profile_workout_plans       one row per profile: ACTIVE choice (PPL, or CUSTOM + active_account_split_id)
          ├── profile_workout_split_templates  Phase 5 per-profile splits (legacy, kept as migration source)
          └── body_weight_entries         unique (profile_id, recorded_date), weight in kg
local_data_backups                        owner_id = auth.uid()   (one-time import backup)
storage: gym-profile-photos (private)     <auth.uid()>/<profile id>/<file>
```

Migrations for existing projects (run each once, in order, in the SQL Editor; all are idempotent):
- `migrations/20261107_workout_plans_and_body_weight.sql` (Phase 4)
- `migrations/20261108_phase5_profile_details_and_workout_splits.sql` (Phase 5: age / height, per-profile saved splits). Optional once Phase 6 is applied: after Phase 6 its split-copy step no longer runs.
- `migrations/20261109_phase6_shared_splits_themes_pins.sql` (Phase 6: shared account split library with every existing split copied and active choices kept, `theme_key`, PIN lock). See `../SUPABASE_SETUP.md` §8d.

- Shared splits: RLS `owner_id = auth.uid()`; a `source_profile_id` must be one of the caller's profiles. The trigger `check_active_account_split` (SECURITY DEFINER) stops a profile from activating another account's split. Deleting a shared split clears `active_account_split_id` (ON DELETE SET NULL); deleting a profile keeps the shared splits it created.
- PIN functions (SECURITY DEFINER, `search_path = public, extensions, pg_temp`, `owns_gym_profile` check, execute granted to `authenticated` only): `list_locked_profiles()`, `verify_profile_pin(profile, pin)`, `set_profile_pin(profile, new, current)`, `remove_profile_pin(profile, current)`, `reset_profile_pin_after_reauth(profile)` (requires a JWT `amr` sign-in within 10 minutes). The internal `profile_pin_check_internal` is not executable by API roles.

- Deleting a profile cascades to all its child rows (the app also removes its photos).
- Deleting a saved split only clears `profile_workout_plans.active_split_template_id`; the plan row stays.
- Profile names are unique per account (case-insensitive).
- `exercise_id` refers to the app's built-in exercise library (text ids).

## Security (Row Level Security)
- RLS is **enabled on every table**. All policies apply to the `authenticated` role only;
  `anon` has no table privileges, so signed-out visitors can read nothing.
- `gym_profiles`: users can read, insert, update and delete only rows where `owner_id = auth.uid()`,
  and cannot change `owner_id` to another account.
- Child tables: every operation requires `owns_gym_profile(profile_id)`, a `SECURITY DEFINER`
  helper with a pinned `search_path`. It checks the profile both for existing rows (USING)
  and for new or changed rows (WITH CHECK).
- Storage: objects in `gym-profile-photos` are only readable or writable under the caller's own
  `<auth.uid()>/` folder. The bucket is private, so the app shows photos through short-lived signed URLs.
- The frontend only ever uses the **publishable** key. Secret or service-role keys must never
  be used in GymTrack.

## Realtime
The synced tables, including `profile_workout_plans` and `body_weight_entries`, are added to the `supabase_realtime` publication. Realtime applies
RLS, so each signed-in device only receives events for its own account's rows.

## Verified locally (Phase 6)
`schema.sql` and the Phase 6 migration were run in PGlite with pgcrypto (stand-ins for `auth.uid()`,
`auth.jwt()`, roles and `storage`) on a simulated Phase 5 project and on a Phase 4-only project:
62 checks passed — every split copied once with ids / dates / provenance kept, same-named splits
not merged, active and remembered selections kept, three runs without duplicates, a deleted split
not resurrected, cross-account read / write / delete blocked, the ownership trigger, anon denied,
bcrypt hashes never readable, 5-attempt lockout (1 → 2 minutes), change / remove needing the
current PIN, reset only after a recent sign-in, RLS on every table, Realtime entries. Not run
against the real project.

## Verified locally (Phase 5)
`schema.sql` and the Phase 5 migration were run in PGlite (with stand-ins for `auth.uid()`,
roles and `storage`) on a fresh database and on a simulated Phase 4 project: 28 checks passed,
including double runs, the custom-split copy, unchanged legacy columns and attendance, age /
height / split-name constraints, the same-profile foreign key, cross-account RLS, anon denial,
cascades, RLS coverage and the Realtime publication. The check script is not part of this repo.

## Verified locally (Phase 3)
The schema was executed (twice) in PGlite (PostgreSQL compiled to WebAssembly), with minimal
stand-ins for Supabase's `auth.uid()`, `storage` schema and roles. 56 checks passed, covering:

- cross-account read, insert, update, upsert and delete isolation
- no anonymous access
- unique constraints and cascading deletes
- storage folder isolation
- the realtime publication and RLS coverage
- idempotent re-runs that keep data

Run the checks in section 10 of `SUPABASE_SETUP.md` against your real project as well.
