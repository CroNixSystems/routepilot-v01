# RoutePilot development instructions for Codex

## Product rules

- German-language, driver-first UI; prioritize one-handed mobile operation.
- Use Google Maps for navigation. No dedicated turn-by-turn engine in v0.1.
- Fetch fuel prices **only on a direct, user-initiated planning action** and retain a timestamped snapshot. NEVER poll or background-refresh fuel prices.
- Only monitor road closures, warnings, and roadworks at ~15-minute intervals, when technically feasible.
- Do not claim reliable background delivery from a web app. Android native background service will be a later milestone.
- Never invent routes, live data, fuel prices, ETAs, or monetary savings. An API failure must be visible.
- A user-entered Autobahn is not evidence their Google Maps journey actually follows that road. Label scope as motorway-wide.
- Never present ordinary Google Maps as legally sufficient heavy-truck navigation.

## Architecture

- Next.js App Router + TypeScript, minimal npm packages; no account/database needed for v0.1.
- `src/app/api/traffic/route.ts` fetches Autobahn GmbH API on request.
- `src/app/api/fuel/route.ts` fetches Tankerkönig using secret env var and validates coordinates.
- `src/lib/logic.mjs` contains client-safe pure functions and browser-state validation.
- `src/lib/server.mjs` contains server-only provider parsing, bounded JSON reads and per-process cooldowns; never import it into client components.
- Tests run with Node + tsx; API tests mock providers explicitly, never in production. `npm run test:browser` uses Chromium and axe at desktop/mobile widths.
- Local trip state persists only in browser localStorage.

## Change hygiene

- Run `npm run test && npm run typecheck && npm run build` after changes.
- Avoid new paid APIs or services without explicit approval.
- Keep README feature/limitation list accurate. Add tests for new matching/pricing logic.
- Keep `.env.local` out of git. Never commit secrets.

- The user explicitly approved public source for the presentation demo on 18 October 2026. Push only to the intended CroNixSystems/routepilot-v01 repository. Deploy only to the intended Vercel team after verifying its plan permits the usage; validate a preview before production promotion.

## v0.2 routing and presentation

- `/api/routes` performs manual-only Photon geocoding and OSRM routing. No autocomplete/polling. Use editable server URL configuration to switch providers and respect public-service fair-use limits.
- `src/lib/routing.mjs` validates geometry, computes fuel estimates, ranks only returned alternatives, and checks geometric proximity to road events. Do not present the result as globally optimal or traffic-aware.
- Fuel estimates use explicit user-editable consumption and price assumptions. Do not label them live prices or total journey costs; tolls, parking and wear are excluded.
- RouteMap uses Leaflet with attributed OpenStreetMap tiles; respect provider policies, no offline tile prefetch.
- A 3-km corridor is only spatial proximity, not a guarantee of direction, connectivity or actual impact. Events without coordinates remain available in the motorway-wide view.
- `/transparenz` describes data, limitations and browser storage. Do not invent operator/company details.

## Free hosting decision — 20 October 2026

- The user chose to keep hosting free and change provider instead of paying for Vercel Pro. Use the free Render web-service configuration in `render.yaml`; never upgrade a hosting plan, add a paid datastore/disk, or enable billable add-ons without new explicit authorization.
- The Vercel project remains prepared but is not the selected deployment target. Its team is Hobby. Git was disconnected and an automatically triggered, unreviewed deployment was removed; do not re-enable Vercel deployment for this commercial buyer-demo goal on Hobby.
- Render must bind to the platform PORT on 0.0.0.0. Production builds explicitly include development dependencies for TypeScript and tests. The optional Tankerkönig key remains server-only and must be entered securely only if desired.
- A free Render service can sleep and has quotas; never promise always-on hosting or add periodic keep-alive traffic to evade platform limits. Verify the actual hosted URL before presenting it as ready.
