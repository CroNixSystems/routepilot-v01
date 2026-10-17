# Prompt for Codex — RoutePilot v0.1

You are working in the RoutePilot v0.1 Next.js repository. Read AGENTS.md and README.md first.

Goal: build a low-cost, driver-first German-language web app that can later be turned into native Android and iOS apps.

Current implementation: German planning UI, Google Maps directions handoff, manually selected Autobahn motorway warnings/closures/roadworks via official Autobahn API, one-time optional user-triggered fuel price check near the phone's present position via Tankerkönig, 15-minute best-effort foreground monitoring. No fake live numbers.

Tasks:
1. Run `npm install`, `npm run test`, `npm run typecheck`, `npm run build` and fix any errors.
2. Launch the app locally and test desktop + mobile widths. Confirm the real Autobahn API response shape and correct parser if necessary.
3. Verify public endpoints handle errors, timeouts, invalid input, and rate limits safely. Keep fuel API key server-side.
4. Improve accessibility and empty/error states without introducing expensive paid APIs.
5. Do NOT add fake route costs, fake ETA, fake jam distance, or imply fuel stations are along a calculated route; we have no route polyline yet.
6. Create a new GitHub repository `CroNixSystems/routepilot-v01` if GitHub credentials/permissions are available. Keep it private initially. Push only source (never .env.local or node_modules). If creation is unavailable, explain the exact manual steps rather than using an unrelated existing repo.
7. Create/import the Vercel project into the intended `cronixsystems-projects` team if permissions allow. Link it to the GitHub repository for continuous deployment, run a preview, and verify live endpoints before promoting to production.
8. If commercial usage is planned, do not assume Vercel Hobby is permitted. Check current plan/licensing constraints.
9. Keep README.md accurate and update AGENTS.md if architecture changes.

Rules: fuel data must be fetched only on direct user planning action. During a journey monitor road issues only, never poll fuel prices. True background monitoring cannot be promised from a normal web app.
