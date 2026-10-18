import test from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {POST} from '../src/app/api/routes/route';
let sequence=0;
const origin={label:'Ravensburg',lat:47.782,lng:9.612},destination={label:'München',lat:48.137,lng:11.576};
const call=(body:unknown,id=`route-test-${++sequence}`)=>POST(new NextRequest('http://localhost/api/routes',{method:'POST',headers:{'content-type':'application/json','x-real-ip':id},body:JSON.stringify(body)}));
const fixture={code:'Ok',routes:[{distance:180000,duration:7400,geometry:{coordinates:[[9.612,47.782],[11.576,48.137]]},legs:[{summary:'A96',steps:[{ref:'A 96'}]}]}]};
test('routing endpoint handles input, providers and rate limits',async t=>{
 const original=globalThis.fetch;
 try{
  await t.test('rejects malformed inputs before provider access',async()=>{globalThis.fetch=async()=>{throw new Error('must not fetch');};for(const body of [null,{}, {origin:'a',destination:'Berlin'},{origin:{...origin,lat:null},destination}])assert.equal((await call(body)).status,400);});
  await t.test('returns parsed live-shape geometry without fabricated cost or ETA',async()=>{
   globalThis.fetch=async()=>Response.json(fixture);const id='routing-limit-test';const result=await call({origin,destination},id);assert.equal(result.status,200);const data=await result.json();assert.equal(data.routes[0].distanceMetres,180000);assert.equal(data.trafficAware,false);assert.equal(data.routes[0].cost,undefined);assert.equal(data.routes[0].eta,undefined);const retry=await call({origin,destination},id);assert.equal(retry.status,429);assert.ok(retry.headers.get('retry-after'));
  });
  await t.test('returns safe failures for upstream errors, invalid JSON and no route',async()=>{
   for(const response of [new Response('',{status:429}),new Response('not JSON'),Response.json({code:'Ok',routes:[null]})]){globalThis.fetch=async()=>response;assert.equal((await call({origin,destination})).status,502);}
   globalThis.fetch=async()=>Response.json({code:'NoRoute'});assert.equal((await call({origin,destination})).status,404);
   assert.equal((await call({origin,destination:origin})).status,400);
  });
  await t.test('an ambiguous place requires explicit user confirmation',async()=>{
   globalThis.fetch=async()=>Response.json({features:[{geometry:{coordinates:[13.4,52.5]},properties:{countrycode:'DE',name:'Ort A'}},{geometry:{coordinates:[13.5,52.6]},properties:{countrycode:'DE',name:'Ort B'}}]});
   const result=await call({origin:'Mehrdeutiger Testort',destination});assert.equal(result.status,409);const data=await result.json();assert.equal(data.origins.length,2);assert.equal(data.code,'choose_places');
  });
 }finally{globalThis.fetch=original;}
});
