# Users, sign-in and cloud sync

DE Dojo separates progress per user at two levels:

1. **Local profiles (always on, zero setup).** The 👤 button in the top bar
   manages named profiles on the device. Each profile keeps its own XP,
   solved exercises, streak and exam history under isolated storage keys
   (`delab:u:<id>:*`), so people sharing a computer never mix or overwrite
   each other's progress. Existing pre-profiles progress is migrated
   automatically into "Perfil 1" on first load.

2. **Cloud accounts (optional, free).** Real email + password sign-up/sign-in
   backed by [Supabase](https://supabase.com) (free tier: 50k monthly active
   users). A cloud account gets its **own dedicated profile** — it never
   mixes with local profiles — and its progress is backed up and synced
   across devices. The app talks to Supabase's REST APIs directly (no SDK,
   no build step) and stays **offline-first**: local storage is the source
   of truth and the cloud is a synced backup, so a network failure never
   loses progress.

## One-time server setup (admin, ~5 minutes, free)

1. Create a project at [supabase.com](https://supabase.com) (free plan).
2. In **SQL Editor**, run:

   ```sql
   create table public.progress (
     user_id    uuid primary key references auth.users(id) on delete cascade,
     data       jsonb not null default '{}'::jsonb,
     updated_at timestamptz not null default now()
   );

   alter table public.progress enable row level security;

   create policy "own row select" on public.progress
     for select using (auth.uid() = user_id);
   create policy "own row insert" on public.progress
     for insert with check (auth.uid() = user_id);
   create policy "own row update" on public.progress
     for update using (auth.uid() = user_id);
   ```

3. Copy **Settings → API → Project URL** and the **anon public key**.
4. In the app: 👤 → *Configurar servidor (admin)* → paste URL + anon key →
   save. (Stored in that browser only. To ship it enabled for everyone,
   set `SB_DEFAULT={url:'…',key:'…'}` in `index.html` — the anon key is
   public by design; Row Level Security is what protects each user's row.)

Optional hardening in Supabase → Authentication:
- Keep **Confirm email** on (default) so accounts must verify their inbox.
- Restrict allowed redirect/origins to your Pages domain.

## How sync behaves (design notes)

- **Merge, never clobber**: on sign-in / manual sync the app pulls the cloud
  copy and merges — `solved` is a union, XP takes the max, exam history is
  deduplicated by content. Progress can only grow; two devices can't erase
  each other.
- **Debounced push**: every save (solving an exercise, finishing an exam)
  schedules a push ~4s later; there is also a *Sync now* button.
- **Sessions**: the access/refresh token pair is stored per profile and
  refreshed automatically; if the refresh fails, the app keeps working
  locally and asks you to sign in again to resume syncing.
- **Security**: passwords are never stored by the app; SQL/Python results and
  all profile names are HTML-escaped; the anon key grants nothing beyond
  what RLS allows.

## What deleting does

- *Delete profile* (🗑) removes the profile and its **local** progress only.
- To delete a **cloud** account and its data, remove the user in Supabase →
  Authentication → Users (the `progress` row cascades).
