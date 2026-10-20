# Validation record — 17 October 2026

## Completed in the cloud workspace

- Imported the supplied ZIP into the existing intended checkout after reading AGENTS.md and README.md.
- Ran `npm install`, then verified frozen-lockfile repeatability with `npm ci` (workspace npm cache).
- `npm run test`: 18 tests passed, no skips/failures; includes direct API handlers with explicit test-only provider fixtures.
- `npm run typecheck` and `npm run build`: passed on Node 24.19.0 / npm 11.9.0.
- `npm audit`: zero reported vulnerabilities after updating Next.js to 15.5.28 and overriding PostCSS/Sharp to patched versions.
- Started the production server with `NODE_USE_ENV_PROXY=1`, preserving platform TLS verification. Node needed this cloud proxy setting; direct Node fetch without it failed DNS resolution.
- Real Autobahn A7 list responses had `roadworks` (274), `warning` (6), and `closure` (37) arrays. All 317 entries parsed, including multiline descriptions. The local production endpoint returned `status: ok` with 317 events and no errors. These counts are observations, not fixed app data or future guarantees.
- Local production endpoint checks: malformed fuel JSON/null → 400, valid fuel request without optional key → 503, mixed invalid motorway input → 400. Handler tests additionally cover 429/Retry-After, provider HTTP failures, malformed provider responses, and aborted provider requests.
- Chromium workflows at 1440, 390, and 320 pixels passed: planning, Google Maps URL handoff, optional fuel failure visible on mobile, ending trips, road-only foreground timer, no extra fuel requests, no horizontal overflow, no page errors. Axe detected no WCAG A/AA violations in checked planning/monitor views. This is not a claim of complete screen-reader/accessibility certification.
- Fuel failure in the browser smoke test is a test-only interception; provider fixtures never run in production. No real fuel provider request was made because no key was available.

## External actions still required

- The exact intended GitHub repository exists and is **public**. Read access and repository metadata work, but attempting to make it private returned **403 Resource not accessible by integration**. No source was pushed. An owner must make it private before pushing; see README for exact steps. Local source/commit does not establish GitHub publication or fresh-task restoration.
- No Vercel token, CLI authentication, or existing project binding was available. No project was created, no deployment was made, and no preview/live Vercel endpoint or production promotion was verified. Follow README under the intended `cronixsystems-projects` team once authenticated.
- Current official Vercel Hobby documentation was checked and limits usage to personal, non-commercial projects. The intended team's actual plan remains unverified. A suitable commercial plan and provider licensing must be verified for commercial use.
- Optional live fuel behavior requires a real server-side Tankerkönig key supplied securely in environment/project settings. Automated failure/validation tests do not prove provider account authorization.
- Rate limiting is bounded per process, not a shared serverless quota. Apply host-level limits/provider quotas before exposing commercial traffic.
- Reusable installation/start instructions and required network domains were saved in the environment configuration draft. Draft saving is not environment publication or verification in a new task.

# v0.2 presentation update — 18 October 2026

- Public source was explicitly approved by the user; the earlier private-repository push restriction no longer applies to this demo.
- Added real manual route search, confirmed-place disambiguation, OSRM geometry/alternatives, transparent editable fuel-cost estimates, interactive Leaflet map, route-proximity traffic filtering and trip text export. Added `/transparenz`; refreshed README/AGENTS.
- `npm run test`: 29 checks passed, including route parsing, cost arithmetic, ranking, geometric proximity, geocoding input and API failure/rate-limit contracts. Typecheck/build passed; npm audit reported zero vulnerabilities.
- Live local routing: Ravensburg–München 179.9592 km (one offered route); Berlin–Hamburg 289.8209 km (one); Köln–Frankfurt 189.9416 km and 215.0772 km (two). Counts/distances are observations, not fixed app values or future guarantees.
- Photon live GeoJSON was retrieved after the cloud network addition took effect. The provider allows moderate fair-use queries without an SLA; it is not a production capacity commitment.
- An anonymous temporary Vercel evaluation preview was created using the CLI's supported `deploy --temporary` flow. It does not establish membership in cronixsystems-projects, a paid/commercial plan, permanent hosting or GitHub continuous deployment. The CLI supplied an expiry of 18 October 2026, 12:59 CEST; the presentation link must not be described as permanent.
- Hosted live checks passed: the page serves successfully; Köln–Frankfurt routing returned both real alternatives; Autobahn A96 returned `status: ok` with 43 events; malformed route input returned 400; missing optional fuel key returned 503; live place search returned 409 with real choices for explicit confirmation.
- Chromium's NSS trust was updated with the authoritative platform-provided proxy CA (filesystem permission granted). No TLS verification was disabled. A real hosted desktop browser session rendered two route cards, actual road geometry, live traffic and 10 loaded OpenStreetMap tiles.
- Browser automation at 1440/390/320 passed with zero detected WCAG A/AA violations; route/cost selection, download, one-time fuel error and foreground road-only polling were exercised using isolated test fixtures. A slow-host hydration timing issue was fixed by keeping planning controls disabled until browser initialization completes.
- Search and route confirmation use separate client cooldown phases, so confirming an ambiguous location is not blocked by the search cooldown. A handler regression assertion verifies this flow.
- Source was pushed successfully to the authorized intended public repository. The permanent Vercel team project, its commercial plan and GitHub continuous deployment remain unconfigured because device sign-in has not completed.
- Final hosted browser smoke suite passed at 1440/390/320 pixels with zero detected accessibility violations. Its test harness waits for observable React state and invokes the registered 15-minute callback without replacing global clocks used by hosting scripts; no timer harness exists in production code. Fixture-powered assertions and real provider checks remain separate.
- A real hosted 390-pixel mobile session also returned two genuine routes with no page errors, no horizontal overflow and no detected axe A/AA violations. The desktop session rendered real map tiles and route geometry. Build/typecheck and the 29 logic/API checks passed; final dependency audit reported zero vulnerabilities.

# Vercel account connection — 20 October 2026

- User completed secure Vercel device authorization. Authenticated access to `cronixsystems-projects` was verified with OWNER membership.
- The team's actual billing metadata reports active **Hobby**, with no active Pro trial. Current official Hobby documentation restricts usage to personal/non-commercial projects. A buyer presentation requires a commercial-eligible plan or another suitable host. No paid plan, trial or billing change was started.
- Created and linked the exact `cronixsystems-projects/routepilot-v01` project, connected to `CroNixSystems/routepilot-v01`, branch `main`. Verified framework Next.js, Node 24.x, install `npm ci`, build `npm run build`.
- Git deployment creation is disabled (`createDeployments: disabled`), and no deployment exists in this project. Keep automatic builds disabled until commercial hosting is resolved and a preview has been validated. No permanent public application URL is claimed.
- Vercel CLI generated ignored local project metadata and a local OIDC binding; neither credential values nor `.env.local` / `.vercel` contents are committed. Source application code is unchanged in this step.
- Remaining decision: upgrade/approve suitable Vercel hosting through team Billing, or choose a free host whose terms permit this commercial demonstration. Authentication is no longer the blocker.
