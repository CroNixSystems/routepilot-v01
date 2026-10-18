import { isValidCoordinates } from './logic.mjs';

export function fuelEstimate(distanceMetres, litresPer100Km, pricePerLitre) {
  if (![distanceMetres, litresPer100Km, pricePerLitre].every(Number.isFinite) || distanceMetres < 0 || litresPer100Km < 1 || litresPer100Km > 40 || pricePerLitre < 0.5 || pricePerLitre > 5) throw new Error('Ungültige Kostenannahmen');
  const litres = distanceMetres / 100000 * litresPer100Km;
  return { litres, cost:litres * pricePerLitre };
}

export function rankRoutes(routes, preference) {
  return [...routes].sort((a,b) => preference === 'fastest' ? a.durationSeconds-b.durationSeconds || a.distanceMetres-b.distanceMetres : a.distanceMetres-b.distanceMetres || a.durationSeconds-b.durationSeconds);
}

export function parsePlace(value) {
  if (typeof value === 'string' && value.trim().length >= 2 && value.length <= 180) return value.trim();
  if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.label === 'string' && value.label.trim().length >= 2 && value.label.length <= 180 && typeof value.lat === 'number' && typeof value.lng === 'number' && isValidCoordinates(value.lat,value.lng) && value.lat >= 47 && value.lat <= 55.2 && value.lng >= 5.5 && value.lng <= 15.6) return {label:value.label.trim(),lat:value.lat,lng:value.lng};
  throw new Error('Bitte gültige Start- und Zielorte in Deutschland angeben.');
}

export function parseRoutes(data) {
  if (data?.code !== 'Ok' || !Array.isArray(data.routes) || !data.routes.length) throw new Error('Keine befahrbare Route gefunden.');
  return data.routes.slice(0,3).map((route,index) => {
    const points=route.geometry?.coordinates;
    if (!Number.isFinite(route.distance) || route.distance <= 0 || route.distance > 2_000_000 || !Number.isFinite(route.duration) || route.duration <= 0 || !Array.isArray(points) || points.length < 2 || points.length > 20000 || points.some(p=>!Array.isArray(p) || p.length < 2 || !isValidCoordinates(p[1],p[0]))) throw new Error('Ungültige Routenantwort.');
    const roads=new Set();
    for (const leg of route.legs ?? []) for (const step of leg.steps ?? []) {
      for (const match of String(step.ref ?? '').matchAll(/\bA\s?(\d{1,3})\b/g)) roads.add(`A${match[1]}`);
    }
    return {id:`route-${index}`,distanceMetres:route.distance,durationSeconds:route.duration,geometry:points,roads:[...roads],summary:(route.legs ?? []).map(l=>typeof l.summary === 'string' ? l.summary : '').filter(Boolean).join(' · ').slice(0,180)};
  });
}

// Geometric proximity only: neither direction nor road connectivity is inferred.
export function nearRoute(point, geometry, radiusKm = 3) {
  if (!point || !isValidCoordinates(point.lat,point.lng) || !Array.isArray(geometry) || geometry.length<2) return false;
  const scale=Math.cos(point.lat*Math.PI/180);
  const xy=p=>[(p[0]-point.lng)*111.32*scale,(p[1]-point.lat)*111.32];
  for(let i=1;i<geometry.length;i++){
    const a=xy(geometry[i-1]),b=xy(geometry[i]);
    const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
    const t=den ? Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/den)) : 0;
    if(Math.hypot(a[0]+t*dx,a[1]+t*dy)<=radiusKm)return true;
  }
  return false;
}

export function parseGeocodes(data) {
  if (!Array.isArray(data?.features)) throw new Error('Ungültige Ortssuche.');
  return data.features.filter(item=>item?.properties?.countrycode==='DE' && Array.isArray(item.geometry?.coordinates) && isValidCoordinates(item.geometry.coordinates[1],item.geometry.coordinates[0])).map(item=>{
    const p=item.properties;
    return {label:[p.name,p.street,p.housenumber,p.postcode,p.city,p.state].filter(v=>typeof v==='string' && v.trim()).filter((v,i,items)=>items.indexOf(v)===i).join(', ').slice(0,180),lat:item.geometry.coordinates[1],lng:item.geometry.coordinates[0]};
  }).filter(p=>p.label.length>=2);
}
