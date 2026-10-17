import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/traffic/route';
import { POST } from '../src/app/api/fuel/route';

let ip = 0;
function request(path: string, body?: string, id = `test-${++ip}`) {
  return new NextRequest(`http://localhost${path}`, {method:body === undefined ? 'GET' : 'POST', headers:{'content-type':'application/json','x-real-ip':id}, ...(body === undefined ? {} : {body})});
}

// Provider responses below are deterministic test fixtures, never production fallbacks.
test('public route contracts', async t => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.TANKERKOENIG_API_KEY;
  const originalTimeout = AbortSignal.timeout;
  try {
    await t.test('traffic rejects invalid input without making provider requests', async () => {
      let calls=0;
      globalThis.fetch=async()=>{calls++;throw new Error('should not fetch');};
      for (const roads of ['', 'B7', 'A7,invalid', 'A1,A2,A3,A4,A5,A6']) {
        const response=await GET(request(`/api/traffic?roads=${encodeURIComponent(roads)}`));
        assert.equal(response.status,400);
      }
      assert.equal(calls,0);
    });
    await t.test('traffic maps the three documented lists and limits repeated requests', async () => {
      globalThis.fetch=async input=>{
        const type=String(input).split('/').at(-1)!;
        return Response.json({[type]:[{identifier:type,title:'A7',description:['Test fixture']}]});
      };
      const id=`traffic-${++ip}`;
      const response=await GET(request('/api/traffic?roads=A7',undefined,id));
      assert.equal(response.status,200);
      assert.equal((await response.json()).events.length,3);
      const limited=await GET(request('/api/traffic?roads=A7',undefined,id));
      assert.equal(limited.status,429);assert.ok(limited.headers.get('retry-after'));
    });
    await t.test('traffic truncation is explicit rather than silently hiding events', async () => {
      globalThis.fetch=async input=>{
        const type=String(input).split('/').at(-1)!;
        return Response.json({[type]:type === 'roadworks' ? Array.from({length:601},(_,i)=>({identifier:String(i),title:'Test fixture'})) : []});
      };
      const response=await GET(request('/api/traffic?roads=A7'));
      const data=await response.json();
      assert.equal(response.status,200);assert.equal(data.status,'partial');assert.equal(data.events.length,600);
      assert.ok(data.errors.some((error:string)=>error.includes('600')));
    });
    await t.test('traffic distinguishes partial, malformed, HTTP errors and timeout', async () => {
      globalThis.fetch=async input=>String(input).endsWith('/warning') ? new Response('',{status:429}) : Response.json({[String(input).split('/').at(-1)!]:[]});
      assert.equal((await (await GET(request('/api/traffic?roads=A7'))).json()).status,'partial');
      globalThis.fetch=async()=>Response.json({unexpected:[]});
      assert.equal((await GET(request('/api/traffic?roads=A7'))).status,502);
      AbortSignal.timeout=()=>AbortSignal.abort(new DOMException('timeout','TimeoutError'));
      globalThis.fetch=async(_input, options)=>{options?.signal?.throwIfAborted();throw new Error('expected signal');};
      const response=await GET(request('/api/traffic?roads=A7'));
      assert.equal(response.status,502);assert.equal((await response.json()).events.length,0);
      AbortSignal.timeout=originalTimeout;
    });
    await t.test('fuel rejects malformed bodies and missing configuration safely', async () => {
      delete process.env.TANKERKOENIG_API_KEY;
      for (const body of ['null','[]','{','{"lat":null,"lng":9,"type":"e5"}', JSON.stringify({x:'x'.repeat(3000)})]) assert.equal((await POST(request('/api/fuel',body))).status,400);
      assert.equal((await POST(request('/api/fuel','{"lat":48,"lng":9,"type":"e5"}'))).status,503);
    });
    await t.test('fuel sends a server-only key once and returns no secrets; repeat is limited', async () => {
      process.env.TANKERKOENIG_API_KEY='test-only-key';
      let calls=0;
      globalThis.fetch=async input=>{
        calls++; const url=new URL(String(input));
        assert.equal(url.searchParams.get('apikey'),'test-only-key');
        assert.equal(url.searchParams.get('rad'),'10');
        return Response.json({ok:true,stations:[{id:'test',name:'Test fixture',price:1.5,dist:2,lat:48,lng:9,isOpen:true}]});
      };
      const id=`fuel-${++ip}`;const body='{"lat":48,"lng":9,"type":"e5"}';
      const response=await POST(request('/api/fuel',body,id));
      assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
      const output=await response.text();assert.ok(!output.includes('test-only-key'));assert.ok(output.includes('near-current-position'));
      const limited=await POST(request('/api/fuel',body,id));assert.equal(limited.status,429);assert.ok(limited.headers.get('retry-after'));assert.equal(calls,1);
    });
    await t.test('fuel handles upstream HTTP errors, bad JSON, provider errors and timeout', async () => {
      for (const provider of [new Response('',{status:429}),new Response('not json'),Response.json({ok:false,stations:[]})]) {
        globalThis.fetch=async()=>provider;
        assert.equal((await POST(request('/api/fuel','{"lat":48,"lng":9,"type":"e5"}'))).status,502);
      }
      AbortSignal.timeout=()=>AbortSignal.abort(new DOMException('timeout','TimeoutError'));
      globalThis.fetch=async(_input,options)=>{options?.signal?.throwIfAborted();throw new Error('expected signal');};
      const response=await POST(request('/api/fuel','{"lat":48,"lng":9,"type":"e5"}'));
      assert.equal(response.status,502);assert.ok(!(await response.text()).includes('test-only-key'));
    });
  } finally {
    globalThis.fetch=originalFetch;AbortSignal.timeout=originalTimeout;
    if (originalKey === undefined) delete process.env.TANKERKOENIG_API_KEY; else process.env.TANKERKOENIG_API_KEY=originalKey;
  }
});
