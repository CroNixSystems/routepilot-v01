# RoutePilot working brief

Read AGENTS.md and README.md first. The current version is the v0.2 presentation demo with manual Photon geocoding, real OSRM route geometry, Leaflet/OpenStreetMap display, editable fuel-cost assumptions, and official Autobahn monitoring.

Preserve these rules:

- No fabricated route data, live ETA, prices, costs or savings. Costs are explicitly estimates from actual route distance and editable assumptions.
- Compare only provider-supplied alternatives. Model time does not include live traffic. Corridor proximity is not proof of direction or closure impact.
- Fuel data is requested only during a direct manual planning action, with an optional real server-side key. Never poll it.
- No reliable browser background monitoring, heavy-truck navigation or along-route fuel optimization claims.
- Public source is authorized only for the intended GitHub repository. Exclude secrets, node_modules, build outputs and .vercel credentials.
- Verify desktop/mobile UI, provider failures and numeric logic. Run npm run test, npm run typecheck, npm run build and npm run test:browser.
- Temporary Vercel previews expire. Permanent deployment requires authenticated access to cronixsystems-projects and a plan permitting commercial use. Do not buy a plan or enable paid APIs without explicit approval.
