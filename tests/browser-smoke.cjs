const {chromium}=require('playwright-core');
const AxeBuilder=require('@axe-core/playwright').default;
const assert=require('node:assert/strict');
const base=process.env.ROUTEPILOT_TEST_URL || 'http://127.0.0.1:3000';
const proxyUrl=process.env.HTTPS_PROXY ? new URL(process.env.HTTPS_PROXY) : null;
const proxy=proxyUrl ? {server:`${proxyUrl.protocol}//${proxyUrl.hostname}:${proxyUrl.port}`,bypass:'127.0.0.1,localhost',...(proxyUrl.username?{username:decodeURIComponent(proxyUrl.username),password:decodeURIComponent(proxyUrl.password)}:{})} : undefined;
// Isolated test-only route fixture. The application itself has no fixture fallback.
const plan={origin:{label:'Ravensburg',lat:47.782,lng:9.612},destination:{label:'München',lat:48.137,lng:11.576},checkedAt:new Date().toISOString(),source:'OSRM / OpenStreetMap',trafficAware:false,routes:[{id:'route-0',distanceMetres:200000,durationSeconds:7200,geometry:[[9.612,47.782],[10.5,48],[11.576,48.137]],roads:['A96'],summary:'A96'},{id:'route-1',distanceMetres:180000,durationSeconds:7800,geometry:[[9.612,47.782],[10.3,47.9],[11.576,48.137]],roads:['A96'],summary:'A96'}]};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,proxy,args:['--no-sandbox']});
 try{
  for(const width of [1440,390,320]){
   const context=await browser.newContext({viewport:{width,height:950},geolocation:{latitude:48,longitude:9},permissions:['geolocation']});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   let fuels=0,roads=0,routes=0;
   await page.route('**/api/routes',r=>{routes++;return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(plan)});});
   await page.route('**/api/traffic?*',r=>{roads++;return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'ok',checkedAt:new Date().toISOString(),roads:['A96'],events:[],errors:[],scope:'motorway-wide'})});});
   await page.route('**/api/fuel',r=>{fuels++;return r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Tankstellen-API noch nicht eingerichtet.'})});});
   // Capture the real 15-minute callback without changing global clocks used by
   // third-party hosting scripts. All other browser timers run normally.
   await page.addInitScript(()=>{
    const active=new Map();window.__routepilotTimers=active;
    const nativeSet=window.setInterval.bind(window),nativeClear=window.clearInterval.bind(window);
    window.setInterval=(fn,ms,...args)=>{const id=nativeSet(fn,ms,...args);if(ms===900000 && typeof fn==='function')active.set(id,()=>fn(...args));return id;};
    window.clearInterval=id=>{active.delete(id);return nativeClear(id);};
   });
   await page.goto(base);
   await page.getByLabel('Startadresse',{exact:true}).fill('');
   assert.equal(routes,0);assert.equal(fuels,0);
   await page.getByRole('button',{name:'Ravensburg → München',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('#origin').value==='Ravensburg' && document.querySelector('#destination').value==='München');
   assert.equal(await page.locator('#origin').inputValue(),'Ravensburg');
   assert.equal(await page.locator('#destination').inputValue(),'München');
   assert.equal(routes,0,'preset must not fetch');
   await page.getByRole('button',{name:'Routen vergleichen',exact:true}).click();
   await page.getByRole('heading',{name:'2 Routen im Vergleich',exact:true}).waitFor().catch(async e=>{console.log({routes,fuels,roads,errors,headings:await page.locator('h2').allTextContents(),alerts:await page.getByRole('alert').allTextContents()});throw e;});
   assert.equal(routes,1);assert.equal(fuels,0);
   assert.equal(await page.locator('.route-card[aria-pressed=true] strong').textContent(),'Route 2');
   await page.getByRole('button',{name:'Schnell',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.route-card[aria-pressed=true] strong')?.textContent==='Route 1');
   assert.equal(await page.locator('.route-card[aria-pressed=true] strong').textContent(),'Route 1');
   await page.getByLabel('Preisannahme · €/l',{exact:true}).fill('2.00');
   await page.waitForFunction(()=>document.querySelector('.trip-summary h2')?.textContent.includes('32,00'));
   assert.ok((await page.locator('.trip-summary h2').textContent()).includes('32,00'));
   assert.equal(routes,1,'cost editing must not call routing or fuel');
   const href=await page.getByRole('link',{name:'In Google Maps öffnen'}).getAttribute('href');assert.equal(new URL(href).hostname,'www.google.com');
   await page.getByRole('checkbox',{name:/Tankpreise einmalig prüfen/}).check();
   await page.getByRole('button',{name:'Routen vergleichen',exact:true}).click();
   await page.getByRole('alert').filter({hasText:'Tankstellen-API'}).waitFor();assert.equal(fuels,1);
   await page.getByRole('button',{name:'Fahrtmodus starten',exact:true}).click();
   await page.locator('.traffic-panel .icon-button[aria-label="Verkehrsmeldungen manuell prüfen"]:not([disabled])').waitFor();
   const before=roads;const timers=await page.evaluate(()=>{const callbacks=[...window.__routepilotTimers.values()];callbacks.forEach(fn=>fn());return callbacks.length;});
   assert.ok(timers>=1,'a 15-minute foreground interval must be registered');
   await page.waitForTimeout(200);
   assert.ok(roads>before);assert.equal(fuels,1,'timer must never poll fuel');
   const download=page.waitForEvent('download');await page.getByRole('button',{name:'Fahrtübersicht herunterladen'}).click();assert.equal((await download).suggestedFilename(),'RoutePilot-Fahrt.txt');
   await page.getByRole('button',{name:'Hinweis schließen'}).click().catch(()=>{});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);
   const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
   console.log(JSON.stringify({width,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))}));
   assert.deepEqual(axe.violations,[]);
   await page.evaluate(()=>scrollTo(0,0));
   await page.screenshot({path:`/tmp/routepilot-v02-${width}.png`,fullPage:true});
   await page.getByRole('button',{name:'Fahrt beenden'}).click();assert.equal(await page.locator('.route-card').count(),0);
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('Route comparison, cost updates, export, mobile UI and road-only timer passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
