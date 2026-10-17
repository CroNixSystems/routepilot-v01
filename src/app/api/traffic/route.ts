import { NextRequest, NextResponse } from "next/server";
import type { RoadEventType, TrafficEvent, TrafficResponse } from "@/lib/types";
import { clientId, createLimiter, mapEvents } from "@/lib/server.mjs";
import { normalizeRoads } from "@/lib/logic.mjs";

export const runtime = "nodejs";

const limit = createLimiter(10_000);

const paths: RoadEventType[] = ["closure", "warning", "roadworks"];

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("roads") ?? "";
  const parts = raw.split(",");
  const roads = normalizeRoads(raw);
  const checkedAt = new Date().toISOString();
  if (!roads.length || raw.length > 100 || parts.length > 5 || parts.some(part => !/^A\d{1,3}$/i.test(part.replace(/\s/g, "")))) {
    return NextResponse.json({status:"error", checkedAt, roads:[], events:[], errors:["Bitte mindestens eine gültige Autobahn angeben."], scope:"motorway-wide"} satisfies TrafficResponse, {status:400, headers:{"Cache-Control":"no-store"}});
  }

  const retry = limit(clientId(request));
  if (retry) return NextResponse.json({status:"error", checkedAt, roads, events:[], errors:["Zu viele Anfragen. Bitte kurz warten."], scope:"motorway-wide"}, {status:429, headers:{"Retry-After":String(retry), "Cache-Control":"no-store"}});

  const checks = await Promise.all(roads.flatMap((road: string) => paths.map(async (type) => {
    try {
      const url = `https://verkehr.autobahn.de/o/autobahn/${road}/services/${type}`;
      const result = await fetch(url, {
        headers: {Accept: "application/json"},
        signal: AbortSignal.timeout(7500),
        next: {revalidate: 300},
      });
      if (!result.ok) throw new Error(`HTTP ${result.status}`);
      return {events: mapEvents(await result.json(), road, type) as TrafficEvent[], error: null as string | null};
    } catch {
      return {events: [] as TrafficEvent[], error: `${road}: ${type} derzeit nicht abrufbar`};
    }
  })));

  const errors = checks.flatMap((item) => item.error ? [item.error] : []);
  const allEvents = checks.flatMap((item) => item.events);
  const events = allEvents.slice(0, 600);
  if (allEvents.length > events.length) errors.push("Anzeige auf 600 Meldungen begrenzt; weitere Meldungen vorhanden.");
  const response: TrafficResponse = {
    status: checks.every(item => item.error) ? "error" : errors.length ? "partial" : "ok",
    checkedAt,
    roads,
    events,
    errors,
    scope: "motorway-wide",
  };
  return NextResponse.json(response, {status: response.status === "error" ? 502 : 200, headers: {"Cache-Control":"no-store"}});
}
