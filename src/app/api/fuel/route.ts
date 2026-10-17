import { NextRequest, NextResponse } from "next/server";
import { clientId, createLimiter, readSmallJson, parseFuelInput, mapStations } from "@/lib/server.mjs";
import type { FuelSnapshot, FuelType, Station } from "@/lib/types";

export const runtime = "nodejs";

const limit = createLimiter(60_000);

export async function POST(request: NextRequest) {
  const headers = {"Cache-Control":"no-store"};
  const retry = limit(clientId(request));
  if (retry) return NextResponse.json({error:"Bitte mindestens eine Minute bis zur nächsten manuellen Abfrage warten."}, {status:429, headers:{...headers, "Retry-After":String(retry)}});
  let input;
  try { input = parseFuelInput(await readSmallJson(request)); }
  catch { return NextResponse.json({error:"Ungültiger Standort oder Kraftstofftyp"}, {status:400, headers}); }
  const {lat, lng} = input;
  const type = input.type as FuelType;
  const key = process.env.TANKERKOENIG_API_KEY;
  if (!key) return NextResponse.json({error:"Tankstellen-API noch nicht eingerichtet.", code:"not_configured"}, {status:503, headers});

  const url = new URL("https://creativecommons.tankerkoenig.de/json/list.php");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lng", String(lng));
  url.searchParams.set("rad", "10");
  url.searchParams.set("type", type);
  url.searchParams.set("sort", "price");
  url.searchParams.set("apikey", key);

  try {
    const res = await fetch(url, { cache:"no-store", signal:AbortSignal.timeout(7500) });
    if (!res.ok) throw new Error(`Fuel upstream HTTP ${res.status}`);
    const data = await res.json();
    const stations = mapStations(data) as Station[];
    const result: FuelSnapshot = {checkedAt:new Date().toISOString(), type, stations, source:"Tankerkönig / MTS-K (CC BY 4.0)", scope:"near-current-position"};
    return NextResponse.json(result, {headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({error:"Tankpreise konnten nicht abgerufen werden. Versuche es bei einer späteren Planung erneut."}, {status:502, headers});
  }
}
