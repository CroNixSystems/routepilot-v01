// Server-only helpers. Never import this module into the client UI.
import { isValidCoordinates } from './logic.mjs';

export function createLimiter(intervalMs, capacity = 2000) {
  const clients = new Map();
  return (identifier, now = Date.now()) => {
    for (const [id, expiry] of clients) if (expiry <= now) clients.delete(id);
    const expiry = clients.get(identifier);
    if (expiry) return Math.max(1, Math.ceil((expiry - now) / 1000));
    // Fail closed at capacity instead of clearing active limits.
    if (clients.size >= capacity) return Math.ceil(intervalMs / 1000);
    clients.set(identifier, now + intervalMs);
    return 0;
  };
}

export function clientId(request) {
  // Vercel overwrites this header. Other hosts must strip client-supplied IP headers.
  return (request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous').slice(0, 128);
}

export async function readSmallJson(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('invalid');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid');
  let size = 0;
  const chunks = [];
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, 3000);
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) throw new Error('invalid');
      chunks.push(Buffer.from(value));
    }
    if (timedOut) throw new Error('invalid');
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid');
    return value;
  } finally {
    clearTimeout(timeout);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function parseFuelInput(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('invalid');
  const {lat, lng, type} = payload;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !isValidCoordinates(lat, lng) || !['diesel', 'e5', 'e10'].includes(type)) throw new Error('invalid');
  return {lat, lng, type};
}

function toText(value) {
  if (typeof value === 'string') return value.trim().slice(0, 4000);
  if (Array.isArray(value)) return value.slice(0, 30).map(toText).filter(Boolean).join(' · ').slice(0, 4000);
  return '';
}

export function mapEvents(payload, road, type) {
  // Autobahn list endpoints use singular warning/closure, plural roadworks.
  const items = payload?.[type];
  if (!Array.isArray(items)) throw new Error('Invalid traffic response');
  return items.map(item => {
    if (!item || typeof item !== 'object' || typeof item.identifier !== 'string' || !item.identifier || typeof item.title !== 'string') throw new Error('Invalid traffic event');
    return {id:`${road}-${type}-${item.identifier}`, road, type, future:item.future === true, coordinate:item.coordinate && isValidCoordinates(item.coordinate.lat,item.coordinate.long) ? {lat:item.coordinate.lat,lng:item.coordinate.long} : null, title:toText(item.title) || 'Verkehrsmeldung', subtitle:toText(item.subtitle), description:toText(item.description)};
  });
}

export function mapStations(data) {
  if (data?.ok !== true || !Array.isArray(data.stations)) throw new Error('Invalid fuel response');
  if (data.stations.some(s => !s || typeof s !== 'object' || typeof s.id !== 'string' || !s.id || typeof s.dist !== 'number' || !Number.isFinite(s.dist) || s.dist < 0 || typeof s.lat !== 'number' || typeof s.lng !== 'number' || !isValidCoordinates(s.lat, s.lng) || typeof s.isOpen !== 'boolean')) throw new Error('Invalid station response');
  // Closed stations can legitimately have no numeric price. Never invent one.
  return data.stations.filter(s => typeof s.price === 'number' && Number.isFinite(s.price) && s.price > 0).map(s => ({
    id:s.id, name:toText(s.name) || toText(s.brand) || 'Tankstelle', brand:toText(s.brand),
    address:[s.street, s.houseNumber, s.postCode, s.place].filter(v => typeof v === 'string' || typeof v === 'number').join(' '),
    price:s.price, distanceKm:s.dist, isOpen:s.isOpen, lat:s.lat, lng:s.lng,
  })).slice(0, 12);
}
