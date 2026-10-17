# RoutePilot v0.1

**Mobile-first web prototype for German drivers.** Google Maps performs turn-by-turn navigation; RoutePilot performs simple route preparation, optional one-time fuel-price lookup, and best-effort foreground monitoring of selected German Autobahns.

## Features actually implemented

- Start/destination and vehicle/fuel profile form in German.
- Google Maps navigation handoff via documented Maps URLs (no Maps API key needed).
- Driver selects motorway numbers manually (e.g. A7, A8); live roadworks, traffic warnings, and closures read from Autobahn GmbH API via Next.js server route.
- Rechecks selected motorways every 15 minutes **while the page is running and visible**; also checks after returning to an older tab. Optional browser notification on newly observed events.
- Optional **single user-triggered** fuel-price snapshot near current device position (10 km radius), fetched via Tankerkönig using a server-side key when route is prepared. Results never automatically refresh during a trip.
- Trip state kept in browser localStorage; no account, database, payment, AI, or telemetry.
- Installable web manifest (basic PWA shell; no service worker or reliable background tasks).

## Deliberately NOT implemented

- No exact route polyline, real ETA, detour calculation, best fuel stop *along the route*, or true minimum-cost route optimization. Google Maps independently chooses the driving route.
- Motorway alerts cover **the entire selected Autobahn**, not necessarily your travel segment.
- No trustworthy web background monitoring while Google Maps is in foreground or the screen is locked. 15-minute polling is a **best-effort foreground** check.
- No GPS tracking after planning, no push notification service, no live Google Maps session reading.
- No truck navigation: standard Google Maps does not account for heavy truck height/weight restrictions.
- No fake demo traffic, invented prices, or hallucinated cost savings.

## Local development

Prerequisites: Node 22.12+ and npm (Node 24 recommended).

```bash
npm install
cp .env.example .env.local  # optional: set TANKERKOENIG_API_KEY privately
npm run dev
```

Open http://localhost:3000 . Without the optional fuel key, route planning and Google Maps links still work; price lookup visibly reports 'not configured'.

```bash
npm run test
npm run typecheck
npm run build
```

## Deploy to Vercel

Follow the private GitHub, team/plan verification, preview validation, and promotion procedure below. Do not treat the first automatic import deployment as verified production.

## v0.2 development priorities

1. Actual route corridor / polyline from a legal driving-route provider; match Autobahn events to the relevant corridor.
2. Fuel stations along that corridor, and compare pump costs **including detour** (requires approved fuel API use and real routing).
3. Persistent scheduled monitoring + server-side event deduplication + push if commercial cloud tier required.
4. Native Android foreground service for reliable GPS and driver notifications; then iOS if needed.
5. Test safety, data licensing, GDPR and navigation restrictions before commercial use.

## API source and attribution

- Motorway traffic incidents: https://verkehr.autobahn.de/o/autobahn (source: Autobahn GmbH des Bundes).
- Fuel: https://creativecommons.tankerkoenig.de (MTS-K data, Tankerkönig; CC BY 4.0).
- Directions: https://developers.google.com/maps/documentation/urls/get-started.

## Codex working brief

Before editing: read `README.md` and `AGENTS.md`. Keep the app in German and mobile-first. Never invent traffic, prices, savings or ETA. Never call fuel API on a timer. Avoid costly maps SDKs until actual route-based optimization is designed. Keep API keys server-side and validate inputs. Implement new functionality with a test and update limitations in README.

## API behavior and safeguards

- `GET /api/traffic?roads=A7,A8`: one to five valid motorway IDs only; invalid/mixed input returns 400. Autobahn responses use `roadworks`, `warning`, and `closure` arrays with `identifier`, `title`, `subtitle`, and multiline `description`. Scheduled events (`future: true`) are marked **Geplant**.
- Each provider request has a 7.5-second timeout. Total traffic failure returns 502, partial data returns 200 with `status: partial` and explicit missing-source warnings. The UI never treats a failed request as zero incidents. Upstream traffic data may be cached for five minutes. At most 600 events are displayed; truncation is reported explicitly.
- `POST /api/fuel`: JSON object with numeric `lat`, `lng`, and `type` (`diesel`, `e5`, `e10`). Coordinates are range-checked without string/null coercion. Body size is limited to 2 KiB with a three-second read deadline. Invalid requests return 400; a missing server key returns 503; provider errors/timeouts return 502.
- Responses are not stored in shared browser/CDN caches. Fuel results are timestamped snapshots and may be retained in the trip's browser localStorage. Ending a trip removes its stored state. Storage denial does not prevent planning.
- Bounded **per-process** cooldowns: traffic 10 seconds/client, fuel 60 seconds/client; 429 includes `Retry-After`. They reset on restart and are **not distributed abuse protection**. On hosts other than Vercel, strip user-supplied `X-Real-IP` / `X-Forwarded-For` and set trusted client addresses at the reverse proxy. Configure host-level request limits/provider quotas before a public commercial launch. No paid rate-limit service is required by this prototype.
- `TANKERKOENIG_API_KEY` is read only by the server route. Never put it in a public variable, client bundle, committed file, or log. All real fuel lookups require a direct planning action; the timer and tab visibility handler request road data only.

## Repeatable verification

Use `npm ci` after the lockfile has been committed. `npm install` is for intentional dependency updates. Next.js is pinned to 15.5.28; PostCSS and Sharp security fixes are pinned through npm overrides. Recheck `npm audit` when updating dependencies.

```bash
npm run test       # pure logic and API handlers, with explicit test-only provider fixtures
npm run typecheck
npm run build
npm start -- --hostname 127.0.0.1
# In another terminal; requires /usr/bin/chromium:
npm run test:browser
```

The browser smoke test checks 1440, 390, and 320 pixel widths, Maps handoff, form and monitor accessibility, optional fuel failure visibility, and road-only foreground timers. Its fuel failure is intercepted **only in the test**. No fixture is shipped as live application data. Automated accessibility checks supplement manual keyboard/screen-reader testing; they do not certify full accessibility.

Cloud machines that require an outbound HTTPS proxy need Node's proxy support. With the provided Node 24 runtime, set `NODE_USE_ENV_PROXY=1` before `npm run dev` / `npm start`; retain the platform's certificate configuration. This is an environment setting, not a requirement for ordinary Vercel deployments. If npm's default home cache is unwritable, add `--cache /workspace/.npm-cache` to install commands.

## GitHub and Vercel release procedure

The intended repository is **CroNixSystems/routepilot-v01**. Do not use another repository as a deployment workaround.

1. An owner must verify that the repository is private **before** uploading this source. For an existing public repository: GitHub repository **Settings → General → Danger Zone → Change repository visibility → Make private**. If it does not exist, create it under `CroNixSystems`, select **Private**, and leave initialization options empty.
2. From this checkout, verify the origin is `https://github.com/CroNixSystems/routepilot-v01.git`. Stage source, tests, docs, manifest and lockfile; confirm `git status` excludes `.env.local`, `node_modules`, `.next`, and `.vercel`. Commit on `main`, then run `git push -u origin main`. Do not force-push an existing branch.
3. Sign into Vercel with an account permitted to manage **cronixsystems-projects**. Select that team, inspect **Settings → Billing**, and confirm a plan that permits the intended use. Current Vercel Hobby documentation limits Hobby to personal, non-commercial use: https://vercel.com/docs/plans/hobby . For commercial operation choose an appropriate commercial plan (for example Pro), check current pricing/limits, and approve billing before deploying. Team plan/entitlements must be inspected in the authenticated team; this source does not assume them.
4. Create and link the project without an initial production deployment using Vercel CLI from this checkout (authenticate with an account authorized for the intended team):

   ```bash
   npx vercel@latest login
   npx vercel@latest project add routepilot-v01 --scope cronixsystems-projects
   npx vercel@latest link --project routepilot-v01 --scope cronixsystems-projects
   ```

   If the project already exists, omit `project add` and link that exact project. Verify in the team dashboard that the framework is Next.js, root is `./`, install command is `npm ci`, build command is `npm run build`, and Node satisfies `engines.node`. Grant the Vercel GitHub integration access specifically to the private intended repository.
5. Run `npx vercel@latest deploy --scope cronixsystems-projects` **without `--prod`** to create a Preview. Record the returned deployment URL. Configure the optional key in the next step before deploying if live fuel validation is wanted. Do not connect automatic production deployment until preview verification is complete.
6. Add `TANKERKOENIG_API_KEY` securely to the intended Preview/Production environments only if fuel lookup is wanted. Obtain provider approval and review Tankerkönig/MTS-K licensing and attribution for the intended commercial use. Redeploy after changing environment variables. Do not use sample or invented credentials.
7. On the preview URL, test the German desktop/mobile workflow, a real `GET /api/traffic?roads=A7`, invalid traffic input (400), malformed fuel input (400), and a valid manual fuel lookup (200 with a configured key; 503 without one). Check 429/`Retry-After`, empty/error states, and server logs for accidental key exposure. Authenticated preview protection may apply; do not disable it just for testing.
8. Only after those checks pass, run `npx vercel@latest promote <verified-preview-url> --scope cronixsystems-projects`. Current Vercel documentation says promoting a Preview prompts for confirmation and creates a new production deployment; inspect its build/logs and repeat smoke checks with production environment variables. Confirm the production domain. Then connect continuous deployment with `npx vercel@latest git connect https://github.com/CroNixSystems/routepilot-v01 --scope cronixsystems-projects`, verify linkage under **Settings → Git** and the production branch (normally `main`) under **Settings → Environments → Production**. Verify subsequent branch pushes create previews and approved production-branch pushes deploy as intended.

No Vercel project, preview, production promotion, commercial plan, or provider license is implied by a successful local build.
