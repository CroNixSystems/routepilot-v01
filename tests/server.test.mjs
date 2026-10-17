import test from 'node:test';
import assert from 'node:assert/strict';
import { createLimiter, mapEvents, mapStations, parseFuelInput, readSmallJson } from '../src/lib/server.mjs';
import { restoreTrip } from '../src/lib/logic.mjs';

test('fuel input rejects coercion, null, arrays and invalid coordinates', () => {
  for (const input of [null, [], {}, {lat:null,lng:9,type:'e5'}, {lat:'48',lng:9,type:'e5'}, {lat:91,lng:9,type:'e5'}, {lat:48,lng:9,type:'gas'}]) assert.throws(()=>parseFuelInput(input));
  assert.deepEqual(parseFuelInput({lat:48,lng:9,type:'e5'}), {lat:48,lng:9,type:'e5'});
});

test('JSON reader bounds request size and rejects non-object input', async () => {
  for (const body of ['null','[]','{', JSON.stringify({x:'a'.repeat(2050)})]) await assert.rejects(readSmallJson(new Request('http://localhost', {method:'POST',headers:{'Content-Type':'application/json'},body})));
  assert.deepEqual(await readSmallJson(new Request('http://localhost', {method:'POST',headers:{'Content-Type':'application/json'},body:'{"lat":48}'})), {lat:48});
});

test('limiter expires entries without clearing other active limits; fails closed at capacity', () => {
  const limit = createLimiter(60000, 2);
  assert.equal(limit('a',0),0);assert.equal(limit('a',1000),59);
  assert.equal(limit('b',2000),0);assert.equal(limit('c',3000),60);
  assert.equal(limit('a',60000),0);assert.equal(limit('b',60000),2);
});

test('Autobahn documented list shapes preserve multiline descriptions and stable IDs', () => {
  for (const type of ['closure','warning','roadworks']) {
    const events = mapEvents({[type]:[{identifier:'real-id',title:'A7',subtitle:'Richtung Nord',description:['Beginn: 09:00','Sperrung']}]},'A7',type);
    assert.equal(events[0].description, 'Beginn: 09:00 · Sperrung');
    assert.equal(events[0].id, `A7-${type}-real-id`);
    assert.deepEqual(mapEvents({[type]:[]},'A7',type),[]);
    assert.throws(()=>mapEvents({},'A7',type));
    assert.throws(()=>mapEvents({[type]:[null]},'A7',type));
  }
});

test('fuel provider errors stay errors and malformed stations cannot create NaN distances', () => {
  assert.throws(()=>mapStations({ok:false,stations:[]}));
  assert.throws(()=>mapStations({ok:true,stations:[null, {id:'a',price:1.7,lat:48,lng:9}]}));
  assert.deepEqual(mapStations({ok:true,stations:[]}), []);
  const station={id:'a',price:1.7,lat:48,lng:9,dist:2,isOpen:false,name:'Station'};
  assert.equal(mapStations({ok:true,stations:[station]})[0].isOpen,false);
  assert.deepEqual(mapStations({ok:true,stations:[{...station,price:false}]}),[]);
});

test('restoring browser state validates nested fuel data while retaining valid snapshots', () => {
  const trip={origin:'Start',destination:'Ziel',roads:['A7'],vehicle:'pkw',fuelType:'e5',createdAt:'2026-10-17T12:00:00Z',fuel:{type:'e5',checkedAt:'2026-10-17T12:00:00Z',scope:'near-current-position',stations:[]}};
  assert.deepEqual(restoreTrip(trip).fuel.stations,[]);
  assert.equal(restoreTrip({...trip,fuel:{...trip.fuel,stations:[{}]}}).fuel,null);
  assert.equal(restoreTrip({}),null);
});
