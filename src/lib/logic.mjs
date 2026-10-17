const allowedFuelTypes = new Set(["diesel", "e5", "e10"]);

export function normalizeRoads(value) {
  const raw = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(raw.map((part) => String(part).trim().toUpperCase().replace(/\s/g, "")))]
    .filter((road) => /^A\d{1,3}$/.test(road))
    .slice(0, 5);
}

export function mapsDirectionsUrl(origin, destination, waypoint = "") {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  if (String(origin).trim()) url.searchParams.set("origin", String(origin).trim());
  url.searchParams.set("destination", String(destination).trim());
  url.searchParams.set("travelmode", "driving");
  url.searchParams.set("dir_action", "navigate");
  if (String(waypoint).trim()) url.searchParams.set("waypoints", String(waypoint).trim());
  return url.toString();
}

export function formatFuelType(type) {
  return allowedFuelTypes.has(type) ? type : "diesel";
}

export function isValidCoordinates(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function previewEventIds(events) {
  return new Set(events.map((event) => event.id));
}

export function newEvents(previous, current) {
  const ids = previewEventIds(previous);
  return current.filter((item) => !ids.has(item.id));
}

// Reject corrupt or outdated browser data before rendering nested fields.
export function restoreTrip(value) {
  if (!value || typeof value !== 'object' || typeof value.origin !== 'string' || !value.origin.trim() || typeof value.destination !== 'string' || !value.destination.trim() || !Array.isArray(value.roads) || !['pkw','transporter'].includes(value.vehicle) || !allowedFuelTypes.has(value.fuelType) || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) return null;
  const fuel = value.fuel;
  const validFuel = fuel && typeof fuel === 'object' && fuel.type === value.fuelType && typeof fuel.checkedAt === 'string' && Number.isFinite(Date.parse(fuel.checkedAt)) && fuel.scope === 'near-current-position' && Array.isArray(fuel.stations) && fuel.stations.length <= 12 && fuel.stations.every(s => s && typeof s.id === 'string' && typeof s.name === 'string' && typeof s.address === 'string' && typeof s.isOpen === 'boolean' && Number.isFinite(s.price) && s.price > 0 && Number.isFinite(s.distanceKm) && s.distanceKm >= 0 && isValidCoordinates(s.lat,s.lng));
  return {...value, roads:normalizeRoads(value.roads), fuel:validFuel ? {...fuel, source:'Tankerkönig / MTS-K (CC BY 4.0)'} : null};
}
