# Users, sign-in and cloud sync

DE Dojo uses **online accounts** (email + password on Supabase's free tier)
as the user model. Every account keeps its progress (XP, solved exercises,
streak, exam history) in its **own bucket**, backed up to the cloud and
synced across devices — users never mix or overwrite each other.

- **Guest mode**: visitors who haven't signed in practice under a local
  *guest* bucket (that browser only). Signing in switches to the account's
  own bucket; **guest and account progress never mix**. Signing out returns
  to the guest bucket intact.
- **Offline-first**: local storage is the source of truth and the cloud is
  a synced backup, so a network failure never loses progress.
- The app talks to Supabase's REST APIs directly (no SDK, no build step).
- This deployment ships pre-configured (`SB_DEFAULT` in `index.html`), so
  sign-up/sign-in works out of the box for every visitor. The 👤 →
  *Configurar servidor (admin)* expander can override the backend per
  browser (useful for testing).

## Server setup (already done for this repo; reference for a new project)

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

3. **Authentication → URL Configuration**: set *Site URL* to the deployed
   app (e.g. `https://<user>.github.io/de-dojo/`) so email-confirmation
   links land correctly. Keep **Confirm email** enabled.
4. Copy **Project URL** + **anon public key** (Settings → API) into
   `SB_DEFAULT` in `index.html`. The anon key is **public by design** — it
   grants nothing by itself; the RLS policies above are the actual
   protection (each user can only read/write their own row). Never ship the
   `service_role` key.

## How sync behaves (design notes)

- **Merge, never clobber**: on sign-in / manual sync the app pulls the cloud
  copy and merges — `solved` is a union, XP takes the max, exam history is
  deduplicated. Progress only grows; two devices can't erase each other.
- **Debounced push**: every save schedules a push ~4s later; sign-out also
  pushes a final backup; there's a *Sync now* button in the 👤 modal.
- **Sessions**: access/refresh tokens are stored per account bucket and
  refreshed automatically; if refresh fails the app keeps working locally
  and asks you to sign in again to resume syncing.
- **Security**: passwords are never stored by the app; user-visible strings
  (emails, SQL/Python output) are HTML-escaped.

## Deleting an account

Remove the user in Supabase → **Authentication → Users**; their `progress`
row is deleted automatically (`on delete cascade`).
