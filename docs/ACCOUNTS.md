# Users, sign-in, approval gate and billing

DE Dojo is **restricted to registered AND approved accounts**. There is no
guest access: the app boots into a lock screen and only unlocks after a
successful sign-in **and** a server-side approval check. This is the access
control that supports charging for the platform.

- **Sign-up is open, access is not.** Anyone can create an account (and
  confirm their email), but every new account starts **unapproved** and sees
  a "pending approval" screen. The admin flips a flag to grant access —
  typically after payment.
- **Server-enforced**: the `approved` flag lives in a `profiles` table that
  users can read but NOT write (no RLS write policies), and the `progress`
  table's policies require approval — an unapproved account can't sync even
  if it tampers with the client.
- **Honest limitation**: this is a static site, so the lock protects the
  *experience* and the *sync*, not the raw HTML (a determined person can
  read the public repo). Hard content protection would require serving
  content from a backend — see "Hardening options" below.

## Server setup (run once in Supabase → SQL Editor)

```sql
-- 1) progress storage (skip if already created)
create table if not exists public.progress (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.progress enable row level security;

-- 2) approval registry: users can READ their own row, never write it
create table if not exists public.profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       text,
  approved    boolean not null default false,
  plan        text default 'free',
  approved_at timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles
  for select using (auth.uid() = user_id);
-- (no insert/update/delete policies on purpose: only the dashboard/service
--  role can approve)

-- 3) auto-create a profile row for every new signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email) values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4) backfill profiles for accounts created before this migration
insert into public.profiles (user_id, email)
select id, email from auth.users
on conflict (user_id) do nothing;

-- 5) progress requires APPROVAL (drop the old open policies first)
drop policy if exists "own row select" on public.progress;
drop policy if exists "own row insert" on public.progress;
drop policy if exists "own row update" on public.progress;
create policy "approved select" on public.progress for select
  using (auth.uid() = user_id
         and exists (select 1 from public.profiles p
                     where p.user_id = auth.uid() and p.approved));
create policy "approved insert" on public.progress for insert
  with check (auth.uid() = user_id
              and exists (select 1 from public.profiles p
                          where p.user_id = auth.uid() and p.approved));
create policy "approved update" on public.progress for update
  using (auth.uid() = user_id
         and exists (select 1 from public.profiles p
                     where p.user_id = auth.uid() and p.approved));
```

Also set **Authentication → URL Configuration → Site URL** to the deployed
app (e.g. `https://<user>.github.io/de-dojo/`) and keep **Confirm email** on.

## Approving a user (admin, ~10 seconds)

Supabase Dashboard → **Table Editor → profiles** → find the row by email →
set `approved` to `true` (optionally fill `plan` / `approved_at`). The user
presses **"Revisar de nuevo"** on their pending screen (or just reloads) and
gets in. Set `approved` back to `false` to revoke access — the app re-checks
on every load and relocks.

Equivalent SQL:

```sql
update public.profiles
set approved = true, approved_at = now(), plan = 'pro'
where email = 'cliente@correo.com';
```

## Charging for access (billing flows)

The gate is payment-processor-agnostic. From simplest to most automated:

1. **Manual (works today, $0 fixed cost)** — share your payment method
   (bank transfer, PayPal.me, etc.). When a payment arrives, approve the
   account (above). The pending screen tells users their account awaits
   approval; put your payment instructions in your landing/contact channel.
2. **Payment link (recommended next)** — create a hosted checkout with
   Stripe **Payment Links**, Lemon Squeezy or Gumroad (no code, no monthly
   fee — they charge per transaction). Set the link in `index.html`
   (`const PAY_LINK='https://buy.stripe.com/...'`) and the pending screen
   shows a **"Completar pago →"** button. Approval is still your manual
   click after the payment notification.
3. **Automated (future)** — a small Cloudflare Worker (free tier) receives
   the Stripe webhook (`checkout.session.completed`), matches the payer's
   email and sets `approved=true` via the Supabase service-role key (which
   lives only in the Worker's secrets). Zero-touch onboarding. Ask Claude to
   scaffold `workers/approve-hook/` when you have a Stripe account.

## Hardening options (when revenue justifies it)

- **Private content delivery**: move exercise/guide data out of the public
  HTML into Supabase tables gated by the same `approved` RLS, fetched after
  login. Protects the actual content, not just the experience.
- **Private repo**: keep the public repo as a demo subset and deploy the
  full version from a private repo (GitHub Pages for private repos needs a
  paid plan; Cloudflare Pages is free for private repos).

## Sync design notes (unchanged)

Grow-only merge (solved = union, XP = max, history deduped), ~4s debounced
push after each save, final backup on sign-out, automatic token refresh,
offline-first local cache. Passwords are never stored by the app; the anon
key is public by design — RLS is the protection.
