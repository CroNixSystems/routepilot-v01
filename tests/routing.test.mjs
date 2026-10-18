import test from 'node:test';
import assert from 'node:assert/strict';
import {fuelEstimate,rankRoutes,parsePlace,parseRoutes,nearRoute,parseGeocodes} from '../src/lib/routing.mjs';

test('cost estimates derive from real distance and explicit assumptions without premature rounding',()=>{
 assert.deepEqual(fuelEstimate(100000,8,1.8),{litres:8,cost:14.4});
 assert.equal(fuelEstimate(0,8,1.8).cost,0);
 for(const values of [[-1,8,1.8],[100,0,1.8],[100,8,0],[Infinity,8,1.8],[100,8,NaN]])assert.throws(()=>fuelEstimate(...values));
});
test('route preference ranks only the supplied options with deterministic ties',()=>{
 const options=[{id:'fast',distanceMetres:300,durationSeconds:10},{id:'short',distanceMetres:200,durationSeconds:20}];
 assert.equal(rankRoutes(options,'cheapest')[0].id,'short');assert.equal(rankRoutes(options,'fastest')[0].id,'fast');assert.equal(options[0].id,'fast');
});
test('route geometry and provider code are validated; motorway refs come from actual steps',()=>{
 const data={code:'Ok',routes:[{distance:1000,duration:100,geometry:{coordinates:[[9,48],[10,49]]},legs:[{summary:'A7',steps:[{ref:'A 7; A96'},{ref:'B 30'}]}]}]};
 assert.deepEqual(parseRoutes(data)[0].roads,['A7','A96']);
 for(const invalid of [{code:'NoRoute'}, {code:'Ok',routes:[]}, {code:'Ok',routes:[{...data.routes[0],distance:NaN}]},{code:'Ok',routes:[{...data.routes[0],geometry:{coordinates:[[9,480],[10,49]]}}]}])assert.throws(()=>parseRoutes(invalid));
});
test('input accepts explicit German locations but rejects malformed coordinates and long queries',()=>{
 assert.equal(parsePlace(' Berlin '),'Berlin');assert.deepEqual(parsePlace({label:'Berlin',lat:52.52,lng:13.4}),{label:'Berlin',lat:52.52,lng:13.4});
 for(const value of [null,[],{},'a','a'.repeat(181),{label:'Berlin',lat:'52',lng:13},{label:'Elsewhere',lat:1,lng:1}])assert.throws(()=>parsePlace(value));
});
test('corridor matching uses segment distance and does not match remote events',()=>{
 const line=[[9,48],[10,48]];
 assert.equal(nearRoute({lat:48.01,lng:9.5},line),true);assert.equal(nearRoute({lat:49,lng:9.5},line),false);assert.equal(nearRoute(null,line),false);assert.equal(nearRoute({lat:48,lng:9.5},[]),false);
});
test('Photon parser validates real GeoJSON structure and filters non-German places',()=>{
 const feature={geometry:{coordinates:[9.6,47.7]},properties:{countrycode:'DE',name:'Ravensburg',city:'Ravensburg',state:'Baden-Württemberg'}};
 assert.equal(parseGeocodes({features:[feature]})[0].label,'Ravensburg, Baden-Württemberg');assert.deepEqual(parseGeocodes({features:[{...feature,properties:{...feature.properties,countrycode:'US'}}]}),[]);assert.throws(()=>parseGeocodes({}));
});
