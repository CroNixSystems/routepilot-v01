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

- Keep the intended GitHub repository private before pushing. Deploy only to the intended Vercel team after verifying its plan permits the usage; validate a preview before production promotion.
