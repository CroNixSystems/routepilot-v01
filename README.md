# RoutePilot v0.2 — presentation demo

German-language, mobile-friendly route comparison for PKW and light vans. Real road routes and explicit fuel-cost assumptions; no fabricated live numbers, traffic-aware ETA or guaranteed savings.

## What works

- Manual place search in Germany (Photon), with explicit confirmation when several places match. No autocomplete or geocoding timer.
- Real driving geometry, distance and model travel time from OSRM. Up to three provider-supplied alternatives; a provider can return only one.
- Interactive Leaflet / OpenStreetMap map, alternative selection, editable fuel consumption (l/100 km) and price assumption (€/l).
- **Kraftstoffarm** selects the shortest returned alternative under constant consumption; **Schnell** selects the lowest model driving time. This is not a proof of a global optimum or traffic-aware rerouting.
- Transparent estimate: `distance km × consumption / 100 × price`. Maut/tolls, parking, wear, elevation, stops and congestion are excluded. Defaults are labelled examples, not live prices. Changes to assumptions recalculate locally without another provider request.
- Official Autobahn warnings/closures/roadworks for up to five motorway references extracted from actual routing steps or added manually. Events are shown by geometric proximity (3 km) to the selected route, with a motorway-wide view including unlocated events. Direction and actual impact are not inferred. Scheduled events are labelled.
- Best-effort road checks every 15 minutes while the page is visible and after returning to an old tab. Never automatic fuel polling. No reliable background monitoring or push delivery is promised.
- Optional one-time, user-initiated Tankerkönig snapshot within 10 km of the device's current position. This is independent of the cost assumption. Stations are not claimed to be along the route. No key means an explicit error, while route comparison still works.
- Google Maps navigation handoff (Google may choose another route), journey view, trip text export, responsive layouts, keyboard focus and accessible forms.
- `/transparenz` explains providers, data sharing, local storage and limitations. No accounts, database, ads, analytics, AI or paid maps SDK.

## Local use

Node 22.12+; Node 24 and npm recommended.

```bash
npm ci
# Optional: copy .env.example to .env.local and privately set a real Tankerkönig key.
npm run dev
```

In Codex cloud, npm's default home cache may be unwritable: use `npm ci --cache /workspace/.npm-cache`. Node in this cloud needs the platform proxy enabled: `NODE_USE_ENV_PROXY=1 npm run dev` or `NODE_USE_ENV_PROXY=1 npm start`. Preserve the platform certificate settings. Ordinary Vercel deployments do not need this cloud proxy variable.

```bash
npm run test
npm run typecheck
npm run build
npm start -- --hostname 127.0.0.1
# Another terminal; Chromium is installed at /usr/bin/chromium in this cloud:
npm run test:browser
npm audit
```

Browser tests use explicitly isolated test-only route/provider fixtures to test selection, numeric cost changes, exports, errors and road-only timers at 1440/390/320 pixels. Production code never uses fixtures. Live provider checks are recorded separately in VALIDATION.md. Chromium can use the existing HTTPS proxy without disabling certificate checks. `ROUTEPILOT_TEST_URL` selects another test host; `CHROMIUM_PATH` overrides the browser executable.

## Server routes

- `POST /api/routes`: JSON `{origin, destination}`. Each place is a search string (2–180 characters) or a confirmed `{label,lat,lng}` location within the German search bounding box. Coordinates must be numbers. 400 invalid request; 404 unknown place/no route; 409 multiple place matches requiring confirmation; 429 per-process 15-second client cooldown per search/routing phase (confirming a location can proceed immediately); 502 provider/malformed-response/timeout failure. Explicit coordinates bypass geocoding. Provider calls have 8/12-second deadlines. Route data is not stored in browser localStorage.
- `GET /api/traffic?roads=A7,A8`: up to five IDs, 400 invalid input, 429 with `Retry-After`, 502 complete failure, 200 with explicit `partial` status for incomplete data. Five-minute upstream traffic cache; individual calls have 7.5-second deadlines. Truncation at 600 events is disclosed.
- `POST /api/fuel`: JSON numeric `lat`, `lng`, `type` (`diesel/e5/e10`). 400 malformed/out-of-range input, 429 with `Retry-After`, 503 without key, 502 provider failure. 2-KiB JSON cap, 3-second body read deadline, 7.5-second provider timeout. Key stays server-side, never `NEXT_PUBLIC_` or returned in a response.
- All API responses have `Cache-Control: no-store`. Rate limits are bounded **per process**, not shared serverless abuse prevention. Configure host-level limits/provider quotas for a larger audience. On non-Vercel hosts, strip forged client-IP headers at the trusted reverse proxy.

## Provider policies and running cost

The demo has no paid API subscriptions and no account/database/AI costs. Hosting is subject to the chosen Vercel plan; do not advertise unlimited or guaranteed zero-cost operation.

- **OSRM public demo** (`router.project-osrm.org`): low-volume interactive evaluation only; no SLA, live traffic or truck restrictions. For scale use a suitable hosted or self-hosted routing service. Source: https://project-osrm.org/ . `ROUTING_BASE_URL` allows an operator to switch to an HTTPS OSRM-compatible service without a source change.
- **Photon public demo** (`photon.komoot.io`): [fair use](https://github.com/komoot/photon#public-demo-server), reasonable request volume only; extensive use can be throttled/banned and availability is not guaranteed. Searches are manual-only, serialized and cached in a bounded process-local cache. `GEOCODING_BASE_URL` switches to another HTTPS Photon-compatible service without a source change. No default dependency on the public Nominatim service.
- **OpenStreetMap**: attributed data under [ODbL](https://www.openstreetmap.org/copyright); [tile policy](https://operations.osmfoundation.org/policies/tiles/) applies. No tile prefetch or offline downloads. Providers receive network metadata and request coordinates/queries as described in `/transparenz`.
- **Autobahn GmbH**: https://verkehr.autobahn.de/o/autobahn . A nearby event is not proof that the chosen carriageway is affected. Closure-aware route optimization is not implemented.
- **Tankerkönig / MTS-K**: https://creativecommons.tankerkoenig.de/ , CC BY 4.0. Review provider approval, attribution and commercial terms for the intended service. Obtain a real key securely; no sample/invented key.
- **Vercel**: current [Hobby documentation](https://vercel.com/docs/plans/hobby) restricts Hobby to personal/non-commercial usage. A buyer presentation serves a commercial purpose: do not assume Hobby eligibility. Verify the actual team's commercial plan before retaining a permanent business deployment or starting paid usage. No paid plan is purchased automatically.

## GitHub and Vercel

The user approved public source for this demo on 18 October 2026. The intended GitHub repository is `CroNixSystems/routepilot-v01`; the intended permanent Vercel team is `cronixsystems-projects`. Never commit `.env.local`, `.vercel`, `node_modules`, build outputs or deployment credentials.

1. Push the reviewed source to the intended GitHub repository. `git push -u origin main`; never force-push an existing branch.
2. Authenticate Vercel CLI (`vercel login`) with access to the intended team. Inspect that team's Billing and confirm its plan permits the commercial usage; approve any charges separately.
3. Create/link the exact project: `vercel project add routepilot-v01 --scope cronixsystems-projects` (omit if it exists), then `vercel link --project routepilot-v01 --scope cronixsystems-projects`.
4. Next.js framework, root `./`, install `npm ci`, build `npm run build`, supported Node 24. Add the optional real `TANKERKOENIG_API_KEY` securely in Preview/Production settings only if wanted.
5. `vercel deploy --scope cronixsystems-projects` without `--prod` creates a Preview. Test the actual hosted page, map, route and traffic APIs, invalid-input errors and mobile workflow before promotion. Verify manual-only fuel behavior; a missing key must be shown, not replaced with fabricated prices.
6. Promote only a verified preview (`vercel promote <preview-url> --scope cronixsystems-projects`), review the resulting production build and repeat endpoint checks. Then `vercel git connect https://github.com/CroNixSystems/routepilot-v01 --scope cronixsystems-projects`; verify Git integration and production branch `main` in the dashboard.
7. Without account authentication, recent Vercel CLI supports `vercel deploy --temporary --yes`. This creates an **expiring evaluation preview**, not a retained team project or production deployment. Its expiry must be communicated. Retain/claim it only under an appropriately licensed team account; do not assume an anonymous preview supplies permanent hosting, a commercial plan or GitHub continuous deployment.

For a buyer demonstration, use **Köln → Frankfurt** quickstart and click **Routen vergleichen**. The live provider returned two alternatives during validation; results can change. Edit the labelled assumptions, select another route, inspect traffic scope, export the trip and open Google Maps. Network/provider failures remain visible.

## Limits and next steps

Not yet a production dispatch platform: no truck-safe routing, toll calculation, actual traffic-aware ETA/closure avoidance, along-route fuel optimization, reliable native background service, account sync or billing. Heavy trucks require a suitable legal routing provider. Native Android/iOS wrappers can reuse the UI/API model, but reliable background work needs native platform implementation and permissions.

Before broad business launch, the operator must supply accurate company/contact/legal information, review privacy/processor obligations, select providers with adequate capacity and commercial terms, and configure distributed rate protection. The demo does not invent operator details or claim these business requirements are already complete.

## Connected Vercel project status (20 October 2026)

The intended team project `cronixsystems-projects/routepilot-v01` is now created, linked and configured for Next.js / Node 24.x / `npm ci` / `npm run build`. GitHub `CroNixSystems/routepilot-v01` is connected on `main`, but automatic deployment creation is disabled. The actual team plan is Hobby, so no buyer-demo deployment was published under that plan. Resolve commercial hosting before deploying; verify current billing rather than relying on this historical status. After a preview and production checks pass, enable the project's Git deployment creation to complete continuous deployment. No billing upgrade was performed automatically.
