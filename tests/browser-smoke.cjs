const {chromium}=require('playwright-core');
const AxeBuilder=require('@axe-core/playwright').default;
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try {
 const errors=[];
 for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:900},geolocation:{latitude:48,longitude:9},permissions:['geolocation'],extraHTTPHeaders:{'x-real-ip':`browser-smoke-${width}`} });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  let fuelCalls=0,trafficCalls=0;
  page.on('request',r=>{if(r.url().includes('/api/fuel'))fuelCalls++;if(r.url().includes('/api/traffic'))trafficCalls++;});
  // Test-only fuel failure fixture, never a production fallback.
  await page.route('**/api/fuel',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Tankstellen-API noch nicht eingerichtet.'})}));
  await page.clock.install();
  await page.goto(process.env.ROUTEPILOT_TEST_URL || 'http://127.0.0.1:3000');
  if(width<=760){const box=await page.getByRole('navigation',{name:'Ansichten'}).boundingBox();assert.ok(box && box.y>=0 && box.y+box.height<=900,'mobile tabs must stay reachable');}
  await page.getByLabel('Startadresse').fill('Ravensburg, Deutschland');
  await page.getByLabel('Zieladresse').fill('Hamburg, Deutschland');
  await page.getByLabel('Autobahnen überwachen').fill('A7');
  await page.getByRole('button',{name:'Autobahn hinzufügen',exact:true}).click();
  await page.getByRole('button',{name:'Fahrt vorbereiten',exact:true}).click();
  await page.getByRole('link',{name:'Google Maps starten'}).waitFor();
  await page.waitForTimeout(1500);
  const href=await page.getByRole('link',{name:'Google Maps starten'}).getAttribute('href');
  assert.equal(new URL(href).searchParams.get('destination'),'Hamburg, Deutschland');
  assert.equal(fuelCalls,0);
  assert.ok(trafficCalls>=1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);
  let axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  assert.deepEqual(axe.violations,[],`accessibility violations at ${width}`);
  console.log(JSON.stringify({width,stage:'monitor',violations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))}));
  await page.screenshot({path:`/tmp/routepilot-monitor-${width}.png`,fullPage:true});
  // A fuel failure must be visible on the monitor screen, including on narrow phones.
  await page.getByRole('button',{name:'Neu planen',exact:true}).click();
  await page.getByText('Tankpreise bei der Planung prüfen',{exact:true}).click();
  await page.getByRole('button',{name:'Fahrt vorbereiten',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Tankpreise:'}).waitFor();
  assert.ok(await page.getByRole('alert').filter({hasText:'Tankpreise:'}).isVisible());
  assert.equal(fuelCalls,1);
  // Advance foreground timer by 16 minutes, road checks may run but fuel may not.
  await page.getByRole('button',{name:'Jetzt manuell prüfen',exact:true}).waitFor();
  const beforeTimer=trafficCalls;
  await page.clock.fastForward(16*60*1000);
  await page.waitForTimeout(200);
  assert.ok(trafficCalls>beforeTimer,'foreground timer must check roads');
  assert.equal(fuelCalls,1);
  await page.getByRole('button',{name:'Beenden',exact:true}).click();
  await page.getByLabel('Startadresse').waitFor();
  await page.waitForFunction(()=>!localStorage.getItem('routepilot-v01-active-trip'));
  axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  assert.deepEqual(axe.violations,[],`accessibility violations at ${width}`);
  console.log(JSON.stringify({width,stage:'plan',fuelCalls,trafficCalls,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))}));
  await page.screenshot({path:`/tmp/routepilot-${width}.png`,fullPage:true});
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log('Browser workflows passed; no page errors');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
