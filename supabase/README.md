# Supabase database for GymTrack

`schema.sql` creates everything GymTrack needs in a Supabase project. Run the whole
file in **Dashboard → SQL Editor**. It is idempotent: re-running it keeps existing data.
For the full step-by-step setup, see `../SUPABASE_SETUP.md`.

## Ownership model
```
auth.users (Supabase accounts)
   └── gym_profiles            owner_id = auth.uid()
          ├── attendance_records          unique (profile_id, date)
          ├── daily_exercise_selections   unique (profile_id, exercise_id, date)
          ├── exercise_set_templates      unique (profile_id, exercise_id)
          ├── daily_set_tracker_states    unique (profile_id, exercise_id, date)
          ├── exercise_personal_records   unique (profile_id, exercise_id)
          ├── profile_workout_plans       one row per profile (PPL or custom split)
          └── body_weight_entries         unique (profile_id, recorded_date), weight in kg
local_data_backups                        owner_id = auth.uid()   (one-time import backup)
storage: gym-profile-photos (private)     <auth.uid()>/<profile id>/<file>
```
- Deleting a profile cascades to all its child rows (the app also removes its photos).
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

## Verified locally
The schema was executed (twice) in PGlite (PostgreSQL compiled to WebAssembly), with minimal
stand-ins for Supabase's `auth.uid()`, `storage` schema and roles. 56 checks passed, covering:

- cross-account read, insert, update, upsert and delete isolation
- no anonymous access
- unique constraints and cascading deletes
- storage folder isolation
- the realtime publication and RLS coverage
- idempotent re-runs that keep data

Run the checks in section 10 of `SUPABASE_SETUP.md` against your real project as well.
