import {NextRequest, NextResponse} from 'next/server';
import {clientId, createLimiter, readSmallJson} from '@/lib/server.mjs';
import {parsePlace, parseRoutes, parseGeocodes} from '@/lib/routing.mjs';

export const runtime='nodejs';
export const maxDuration=40;
const limit=createLimiter(15_000);
type Place={label:string;lat:number;lng:number};
const places=new Map<string, Place[]>();
let nextGeocode=0;
let geocodeQueue=Promise.resolve();

async function geocode(value:string|Place):Promise<Place[]> {
  if(typeof value!=='string')return [value];
  const key=value.toLowerCase();
  const cached=places.get(key);
  if(cached)return cached;
  // Photon public demo: manual searches only, cached and serialized per process.
  const job=geocodeQueue.then(async()=>{
    await new Promise(resolve=>setTimeout(resolve,Math.max(0,nextGeocode-Date.now())));
    nextGeocode=Date.now()+1100;
    const url=new URL(process.env.GEOCODING_BASE_URL || 'https://photon.komoot.io/api/');
    if(url.protocol!=='https:')throw new Error('HTTPS required');
    url.search=new URLSearchParams({q:value,limit:'3',lang:'de',bbox:'5.5,47,15.6,55.2'}).toString();
    const response=await fetch(url,{headers:{'User-Agent':'RoutePilot/0.2 (https://github.com/CroNixSystems/routepilot-v01)'},signal:AbortSignal.timeout(8000),cache:'no-store'});
    if(!response.ok)throw new Error('Die Ortssuche ist gerade nicht erreichbar. Bitte einen Schnellstart wählen oder später erneut versuchen.');
    const data=await response.json();
    const result=parseGeocodes(data) as Place[];
    if(places.size>=200)places.delete(places.keys().next().value!);
    places.set(key,result);
    return result;
  });
  geocodeQueue=job.then(()=>undefined,()=>undefined);
  return job;
}

export async function POST(request:NextRequest){
  const headers={'Cache-Control':'no-store'};
  let origin,destination;
  try{const body=await readSmallJson(request);origin=parsePlace(body.origin);destination=parsePlace(body.destination);}
  catch{return NextResponse.json({error:'Bitte gültige Start- und Zielorte in Deutschland angeben.'},{status:400,headers});}
  const retry=limit(clientId(request));
  if(retry)return NextResponse.json({error:'Bitte 15 Sekunden bis zum nächsten Routenvergleich warten.'},{status:429,headers:{...headers,'Retry-After':String(retry)}});
  try{
    const starts=await geocode(origin),ends=await geocode(destination);
    if(!starts.length || !ends.length)return NextResponse.json({error:'Ort nicht gefunden. Bitte Ort, Postleitzahl und bei Bedarf Straße ergänzen.'},{status:404,headers});
    if(starts.length>1 || ends.length>1)return NextResponse.json({code:'choose_places',error:'Bitte die gefundenen Orte bestätigen.',origins:starts,destinations:ends},{status:409,headers});
    const start=starts[0],end=ends[0];
    if(Math.hypot(start.lat-end.lat,start.lng-end.lng)<0.0001)return NextResponse.json({error:'Start und Ziel müssen verschieden sein.'},{status:400,headers});
    const base=process.env.ROUTING_BASE_URL || 'https://router.project-osrm.org';
    const url=new URL(`/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}`,base);
    if(url.protocol!=='https:')throw new Error('HTTPS required');
    url.search=new URLSearchParams({alternatives:'true',steps:'true',overview:'full',geometries:'geojson'}).toString();
    const response=await fetch(url,{signal:AbortSignal.timeout(12000),cache:'no-store',headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error('Der Routingdienst ist gerade nicht erreichbar. Bitte später erneut versuchen.');
    const data=await response.json();
    if(data?.code==='NoRoute')return NextResponse.json({error:'Keine befahrbare Route zwischen diesen Orten gefunden.'},{status:404,headers});
    return NextResponse.json({origin:start,destination:end,routes:parseRoutes(data),checkedAt:new Date().toISOString(),source:'OSRM / OpenStreetMap',trafficAware:false},{headers});
  }catch{
    return NextResponse.json({error:'Routendienst oder Ortssuche derzeit nicht verfügbar. Bitte einen Schnellstart wählen oder später erneut versuchen.'},{status:502,headers});
  }
}
