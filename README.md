# SERS · Emergency Responder Dashboard

SERS is a staff website for coordinating road accident and fire incident reports. Phase 2 connects the administrator and responder dashboards to Supabase Auth and a shared PostgreSQL database.

Open [SERS on Vercel](https://sers-mafene21-5969.vercel.app/). [GitHub Pages](https://mafene21.github.io/SERS/) redirects to the same application. GitHub `main` deploys automatically to the existing Vercel project.

## Administrator setup

The first administrator email has been approved in the database. Use the private administrator setup file supplied during installation to choose a password of at least 12 characters. Keep that file private and delete it after activation. Email activation is also available when your email sender is configured. No initial password or activation token is stored in this repository.

In **Response teams → Staff accounts**, approve staff with their name, email, role and response team. Choose **Fire and road** for a responder who covers both teams with one account. Create an **Activation link** and share it privately with the intended account holder. They open the single-use link and choose their own password. **Reset link** provides the same private delivery option for password recovery. Links confer account access: keep them out of public messages, screenshots and logs.

Staff can also activate through email confirmation and request emailed password resets. Supabase's default sender only delivers to project organization members; configure [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) for general email delivery. Private administrator-generated links do not require SMTP and never send an email automatically.

## Phase 2 behavior

- Real email/password authentication, HTTP-only session cookies, session refresh and global sign-out.
- Administrator-approved access; public sign-up alone never grants dashboard access. Roles come from protected database membership, never browser state or editable user metadata.
- Administrators record incidents, approve staff, manage account access, assign available responders and cancel incidents with a reason.
- Responders see records for their approved team or teams and can accept, respond to, resolve and add notes to their own active assignments. A responder covering both fire and road still has one login and one active assignment at a time across both teams.
- Shared incident records, recorded coordinates, staff availability, append-only timelines and in-app activity notifications. Preferences and read notifications belong to the signed-in account.
- Database rules reject cross-team assignments, skipped workflow states, changes to closed incidents, and multiple active assignments for one responder. Deactivation immediately removes access even from an existing token.
- Manual refresh, refresh on window focus and polling every 30 seconds. WebSocket updates, phone GPS tracking and SMS/push notifications remain later integrations.
- The existing map uses Leaflet and OpenStreetMap. New reports may include confirmed latitude and longitude; missing coordinates are never replaced with an invented incident position.
- No fictional incidents are seeded into the shared database. Local training fixtures remain available only through explicit local demo mode.

This is a university project. Connecting the staff dashboard does not connect it to public emergency services or establish a monitored emergency reporting service.

## Run locally

Use Node.js 22 or newer; `.nvmrc` pins the tested Node.js release.

```bash
npm ci
cp .env.example .env.local
# Set the project URL and publishable key in .env.local.
npm run dev
```

Open http://localhost:3000. For a standalone local demonstration, set `SERS_DEMO_MODE=true` in `.env.local`. Vercel always requires real sign-in and ignores that flag. Missing production configuration fails closed.

Only the Supabase project URL and **publishable** key belong in `NEXT_PUBLIC_` variables. No service-role or secret key is required by the Next.js application. The account-link Edge Function uses Supabase's server-only environment and checks the caller's live session and active administrator membership.

## Database and deployment

The existing Supabase project `wtfjgpvyhkdfhqujlfdz` (displayed as Schoolspace) was resumed and reused at the owner's request. Existing tables were retained. SERS uses `public.sers_*` tables and the non-exposed `sers_private` schema, avoiding collisions with the former application.

Versioned schema changes are in `supabase/migrations/`. Use the pinned Supabase CLI and inspect `--help` before running commands; CLI v3 database commands target local development unless `--remote` is supplied. Hosted mutation commands require explicit `--yes`. Use a separate test project for further schema development. This repository contains the SERS migrations; the reused project also retains its earlier Schoolspace migration history. Synchronize that history before attempting a CLI push to the reused project.

The function source is `supabase/functions/sers-account-link/`. Its gateway JWT switch is disabled because the handler itself validates the bearer token through Auth and checks current database permissions before generating any link. Deploy with that configuration; do not remove the handler's authentication checks.

Production Vercel variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Supabase Authentication URL configuration:

- Site URL: `https://sers-mafene21-5969.vercel.app`
- Redirect URL: `https://sers-mafene21-5969.vercel.app/auth/callback`
- Redirect URL: `https://sers-mafene21-5969.vercel.app/auth/callback?next=/recover`

Vercel Functions run in Frankfurt (`fra1`), close to the reused Supabase project in `eu-central-1`, to reduce database round trips. Do not connect arbitrary preview deployments to production credentials. Existing Vercel preview protection is retained.

## Validation

```bash
npm run lint
npm run typecheck
npm run build
```

`supabase/tests/phase_two_permissions.sql` checks team isolation, unauthorized writes, role promotion attempts, workflow constraints, responder capacity, closed records and account revocation inside a transaction that rolls back its fixtures.

`tests/phase-two.spec.ts` exercises real Auth sessions and the shared database using disposable approved administrator, road and fire accounts plus an unapproved account. Supply their credentials through a private JSON file using `SERS_INTEGRATION_ACCOUNTS`; never commit this file or browser traces containing account information. Run with `npx playwright test tests/phase-two.spec.ts`. `npm run test:e2e` runs the original `tests/dashboard.spec.ts` against explicit local demonstration mode. Setting `SERS_INTEGRATION_ACCOUNTS` switches the test configuration to the real backend suite. Stop any existing server on the test port before running the suite.

The security advisor found no SERS table permission problems. Project-wide [leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) is disabled in the reused project's Auth settings; enable it if available on your plan. Pre-existing Schoolspace index advisories were left untouched.
