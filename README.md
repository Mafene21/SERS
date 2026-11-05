# SERS · Emergency Responder Dashboard

Phase 1 of the **Smart Emergency Response System**, a university Mobile Computing project. A browser-based dashboard for coordinating **road accidents and fire outbreaks**.

**This is a training demonstration. All incident records, responder identities, locations of incidents, notifications, and statistics are simulated. It does not contact emergency services.** The map uses real OpenStreetMap geographic data with fictional incident positions.

## Run locally

Requirements: Node.js 20.20+ (or a supported newer LTS release), npm, and a modern browser.

```bash
cd SERS
npm ci
npm run dev
```

Open **http://localhost:3000**. If port 3000 is occupied, use `npm run dev -- --port 3001` and open the printed URL.

No database credentials are required. `.env.example` documents optional map-tile configuration and the public configuration reserved for Phase 2. Copy it to `.env.local` only if you want to change the defaults. Never put secret or service-role keys in variables starting with `NEXT_PUBLIC_`.

For a production build served locally:

```bash
npm run build
npm start
```

## Implemented in Phase 1

- Responsive command-center interface, mobile navigation, collapsible sidebar, light and dark themes, and keyboard focus states.
- Overview statistics, seven-day Recharts trends, category distribution, team readiness, active incident queue, and recent activity. All metrics are derived from the current training records.
- Incident search, category/status/priority filters, sorting, pagination, and CSV export of matching records, with spreadsheet-formula escaping.
- Dedicated incident details, Leaflet/OpenStreetMap maps, GPS coordinates, missing-coordinate states, assignment controls, append-only demo event timelines, and response notes validated with React Hook Form and Zod.
- Functional `Pending → Accepted → Responding → Resolved` workflow. Administrator cancellation requires a reason. Closed incidents retain their histories.
- Fictional report creation, responder profiles, team availability, active assignment views, and account activation/deactivation previews.
- In-app notification history, unread indicators, mark-as-read, profile/theme/notification preferences, and reset controls.
- Incident history, reported-to-resolved duration statistics, printable reports, and CSV downloads.
- Validated browser-local persistence. Refreshing the browser preserves demo edits. Incompatible saved data loads a fresh demonstration; unavailable storage produces a visible message.
- Loading, empty, missing-record, map-network-error, and application-error states; accessible native modal dialogs.

## Try the workflow

The top banner includes **Preview as**. These are interface previews, **not authentication or backend authorization**.

1. In **Administrator** preview, open **Incidents**, then `SERS-001`.
2. Assign **Sarah Namuli** or **James Kato**, who initially have no active assignment. A responder must be active, on duty, on the correct team, and free of another active assignment.
3. Advance the response with **Accept incident → Start responding → Mark as resolved**. The administrator can operate the full demonstration.
4. To try the dedicated responder experience, switch to **Alex · Road responder**. Open **My assignments**, select `SERS-003`, add a note, then start responding and resolve it. Switch to **Nina · Fire responder** for the fire-team view.
5. To try a newly assigned incident as Alex, finish `SERS-003`, switch to Administrator, create a simulated road accident, assign Alex, then switch back to Alex.
6. Refresh to confirm persistence. Use **Settings → Reset training workspace** to start over.

Responders can see their operational team’s incidents and update their own active assignments. Only the administrator preview can assign, cancel, or activate/deactivate accounts. These checks demonstrate intended product behavior; all data lives in the user’s browser and is editable by the user.

## Pages

| Route             | Purpose                                                                        |
| ----------------- | ------------------------------------------------------------------------------ |
| `/`               | Operational overview                                                           |
| `/incidents`      | Search, filter, and coordinate reports                                         |
| `/incidents/[id]` | Incident record, location, response controls, notes, and timeline              |
| `/map`            | Category, status, and priority filters over incident markers and location list |
| `/assignments`    | Active assignments and personal response history                               |
| `/responders`     | Team readiness, profiles, and availability                                     |
| `/reports`        | Closed records, statistics, print, and CSV export                              |
| `/settings`       | Training profile, preferences, integration information, and reset              |

## Source layout

```text
src/app/                    Next.js App Router routes, metadata, and global styles
src/components/
  demo-provider.tsx         Shared demo state and guarded demo operations
  shell.tsx                 Navigation, role previews, notifications, and app frame
  overview.tsx              Operational overview
  incident-table.tsx        Search, filters, sorting, pagination, and export
  incident-details.tsx      Assignment, status workflow, notes, and timeline
  incident-map.tsx          Client-only React Leaflet implementation
  map-panel.tsx             Lazy map loader, excluded from server rendering
  charts.tsx                Database-ready presentation charts
  pages.tsx                 Supporting dashboard views
  report-dialog.tsx         Validated simulated-report form
  ui.tsx                    Shared badges, dialogs, headers, and empty states
src/lib/
  demo-data.ts              Fictional training fixtures
  types.ts                  Shared domain types
  schemas.ts                Form validation
  utils.ts                  Time formatting, metrics, coordinates, and export
tests/dashboard.spec.ts     Browser workflow and responsive checks
```

## Validation

```bash
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Browser tests start the production server, so run the build first. They use `/usr/bin/google-chrome` if available, otherwise a Playwright Chromium installation. To install the latter, run `npx playwright install chromium`. An alternative browser executable can be supplied with `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

The suite covers the incident lifecycle and persistence, team visibility and assignment controls, search/filter/pagination/export, cancellation with a reason, marker filtering, mobile navigation, theme persistence, and reset. Automated functional tests stub external map tiles to avoid dependence on third-party availability and repeated tile requests. Screenshot artifacts and the test report are written to ignored `test-results/` and `playwright-report/` directories.

## Limits and remaining phases

Phase 1 deliberately stops at the reviewable dashboard demonstration. It has no Supabase connection, secure sign-in, password reset, server authorization, SQL migrations, cross-device synchronization, SMS, push messaging, or actual emergency dispatch. The role selector is available to anyone who can open this prototype. Browser-local data is intended for fictional information only.

Notification events are generated by demo actions. They are not Supabase Realtime events. New simulated reports have no coordinates until a future location-confirmation workflow is implemented; the initial fixtures provide fictional map positions. The UI uses East Africa Time (UTC+3); event timestamps are stored as ISO UTC.

Map tiles require internet access. The default public OSM tile service is intended for normal interactive viewing, has no availability guarantee, and prohibits bulk/offline downloads. Attribution remains visible. See the [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/). For other tile providers, configure the URL and update attribution as required by their terms.

After Phase 1 approval, Phase 2 should:

1. Add Supabase authentication, administrator-provisioned responder accounts, protected routes, session handling, and password reset.
2. Define versioned migrations for profiles, categories, incidents, assignments, teams, availability, notifications, status history, **incident notes**, and administrative audit events.
3. Enforce team access, account activity, field permissions, status transitions, and append-only histories in the database. Implement assignment and status operations atomically to prevent conflicting updates.
4. Add RLS and negative permission tests, including self-promotion, cross-team access, inactive accounts, and competing assignments.
5. Replace the demo data adapter while retaining domain types and presentation components. Define the future mobile reporting contract, reporter permissions, duplicate-submission protection, and coordinate validation.

Later phases add shared real-time notifications and map updates, complete integration checks, and Vercel deployment. Phase 1 can be versioned on GitHub independently of backend integration. No deployment has been created in Phase 1.

## Dependency note

Versions are pinned and `package-lock.json` is included with the source. The `minimatch` override applies only to the TypeScript ESLint parser dependency, replacing the version affected by GHSA-g3hv-75wg-m249 with 11.0.1. The parser’s API usage is checked by the lint command.
