'use client';

import dynamic from 'next/dynamic';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowDownUp,ArrowRight,Check,CheckCircle2,ChevronDown,Clock3,Download,ExternalLink,Fuel,Info,Leaf,Loader2,MapPin,Navigation,Plus,RefreshCw,Route,ShieldAlert,SlidersHorizontal,TriangleAlert,X} from 'lucide-react';
import type {FuelSnapshot,FuelType,Place,RouteOption,RoutePlan,TrafficEvent,TrafficResponse} from '@/lib/types';
import {mapsDirectionsUrl,normalizeRoads} from '@/lib/logic.mjs';
import {fuelEstimate,nearRoute,rankRoutes} from '@/lib/routing.mjs';
const RouteMap=dynamic(()=>import('@/components/RouteMap'),{ssr:false,loading:()=> <div className="map-loading" role="status">Karte wird geladen …</div>});
const euros=(n:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n);
const number=(n:number,digits=0)=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:digits}).format(n);
const duration=(seconds:number)=>`${Math.floor(seconds/3600)} Std. ${Math.round(seconds%3600/60)} Min.`;
const time=(date:string)=>new Date(date).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const presets=[
  {name:'Ravensburg → München',origin:{label:'Ravensburg',lat:47.782,lng:9.612},destination:{label:'München',lat:48.137,lng:11.576}},
  {name:'Berlin → Hamburg',origin:{label:'Berlin',lat:52.52,lng:13.405},destination:{label:'Hamburg',lat:53.551,lng:9.994}},
  {name:'Köln → Frankfurt',origin:{label:'Köln',lat:50.938,lng:6.96},destination:{label:'Frankfurt am Main',lat:50.11,lng:8.682}},
];
const labels={closure:'Sperrung',warning:'Verkehrsmeldung',roadworks:'Baustelle'};
const savedKey='routepilot-v02-plan';

export default function HomePage(){
  const [origin,setOrigin]=useState('');const [destination,setDestination]=useState('');
  const [originPlace,setOriginPlace]=useState<Place|null>(null);const [destinationPlace,setDestinationPlace]=useState<Place|null>(null);
  const [choices,setChoices]=useState<{origins:Place[];destinations:Place[]}|null>(null);
  const [consumption,setConsumption]=useState('8');const [price,setPrice]=useState('1.80');
  const [fuelType,setFuelType]=useState<FuelType>('diesel');const [checkFuel,setCheckFuel]=useState(false);
  const [plan,setPlan]=useState<RoutePlan|null>(null);const [selected,setSelected]=useState('');
  const [preference,setPreference]=useState<'cheapest'|'fastest'>('cheapest');
  const [fuel,setFuel]=useState<FuelSnapshot|null>(null);const [fuelError,setFuelError]=useState('');
  const [traffic,setTraffic]=useState<TrafficResponse|null>(null);const [trafficError,setTrafficError]=useState('');
  const [manualRoad,setManualRoad]=useState('');const [extraRoads,setExtraRoads]=useState<string[]>([]);
  const [loading,setLoading]=useState(false);const [checking,setChecking]=useState(false);const [error,setError]=useState('');
  const [notice,setNotice]=useState('');const [journey,setJourney]=useState(false);const [showAll,setShowAll]=useState(false);
  const [storageReady,setStorageReady]=useState(false);
  const trafficBusy=useRef(false);const lastTraffic=useRef(0);const trafficRequest=useRef<AbortController|null>(null);const requestGeneration=useRef(0);
  const route=plan?.routes.find(r=>r.id===selected) ?? null;
  const allRoads=[...new Set([...(route?.roads ?? []),...extraRoads])];
  const roadKey=allRoads.slice(0,5).join(',');
  const litres=Number(consumption),priceNumber=Number(price);
  const validCosts=Number.isFinite(litres) && litres>=1 && litres<=40 && Number.isFinite(priceNumber) && priceNumber>=0.5 && priceNumber<=5;
  const estimate=route && validCosts ? fuelEstimate(route.distanceMetres,litres,priceNumber) : null;
  const fastest=plan ? rankRoutes(plan.routes,'fastest')[0] : null;
  const difference=route && fastest && validCosts ? Math.max(0,fuelEstimate(fastest.distanceMetres,litres,priceNumber).cost-fuelEstimate(route.distanceMetres,litres,priceNumber).cost) : 0;

  useEffect(()=>{
    try{
      const raw=localStorage.getItem(savedKey);
      if(raw){const value=JSON.parse(raw);if(typeof value.origin==='string' && typeof value.destination==='string'){setOrigin(value.origin.slice(0,180));setDestination(value.destination.slice(0,180));if(typeof value.consumption==='string')setConsumption(value.consumption);if(typeof value.price==='string')setPrice(value.price);}}
    }catch{/* A blocked browser store must not stop planning. */}
    setStorageReady(true);
  },[]);
  useEffect(()=>{if(storageReady)try{localStorage.setItem(savedKey,JSON.stringify({origin,destination,consumption,price}));}catch{/* Session remains usable. */}},[origin,destination,consumption,price,storageReady]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),5000);return()=>clearTimeout(timer);},[notice]);

  const checkTraffic=useCallback(async(roads:string)=>{
    if(!roads || trafficBusy.current)return;
    trafficBusy.current=true;setChecking(true);
    const generation=requestGeneration.current;
    const controller=new AbortController();trafficRequest.current=controller;
    const timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch(`/api/traffic?roads=${encodeURIComponent(roads)}`,{cache:'no-store',signal:controller.signal});
      const data=await response.json();
      if(generation!==requestGeneration.current)return;
      if(!Array.isArray(data.events) || !Array.isArray(data.errors))throw new Error('Ungültige Antwort');
      setTraffic(data);setTrafficError(data.status==='error'?'Verkehrsdaten derzeit nicht verfügbar. Das bedeutet keine freie Fahrt.':'');
      lastTraffic.current=Date.now();
    }catch{
      if(generation===requestGeneration.current){setTraffic(null);setTrafficError('Verkehrsdaten nicht erreichbar. Bitte Verkehrszeichen und Navigation beachten.');}
    }finally{clearTimeout(timeout);if(controller===trafficRequest.current){trafficBusy.current=false;setChecking(false);}}
  },[]);
  useEffect(()=>{
    requestGeneration.current++;trafficRequest.current?.abort();trafficBusy.current=false;setTraffic(null);setTrafficError('');setChecking(false);
    if(!roadKey || loading)return;
    if(document.visibilityState==='visible')void checkTraffic(roadKey);
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void checkTraffic(roadKey);},15*60*1000);
    const visible=()=>{if(document.visibilityState==='visible' && Date.now()-lastTraffic.current>=15*60*1000)void checkTraffic(roadKey);};
    document.addEventListener('visibilitychange',visible);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
  },[roadKey,plan?.checkedAt,loading,checkTraffic]);

  async function loadFuel():Promise<FuelSnapshot|null>{
    if(!checkFuel)return null;
    try{
      if(!navigator.geolocation)throw new Error('Standortfunktion nicht verfügbar.');
      const position=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,maximumAge:120000,timeout:7500}));
      const response=await fetch('/api/fuel',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(12000),body:JSON.stringify({lat:position.coords.latitude,lng:position.coords.longitude,type:fuelType})});
      const data=await response.json();if(!response.ok)throw new Error(data.error || 'Tankpreise nicht verfügbar.');
      return data;
    }catch(e){setFuelError(e instanceof Error?e.message:'Standortfreigabe oder Tankpreisabfrage nicht möglich.');return null;}
  }

  async function compare(event:React.FormEvent){
    event.preventDefault();if(loading)return;
    if(!validCosts){setError('Bitte Verbrauch von 1–40 l/100 km und Preis von 0,50–5,00 €/l angeben.');return;}
    setLoading(true);setError('');setChoices(null);setFuelError('');setJourney(false);
    try{
      const response=await fetch('/api/routes',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(40000),body:JSON.stringify({origin:originPlace ?? origin,destination:destinationPlace ?? destination})});
      const data=await response.json();
      if(response.status===409){setChoices({origins:data.origins,destinations:data.destinations});setError('Mehrere Orte gefunden. Bitte Start und Ziel bestätigen und erneut vergleichen.');return;}
      if(!response.ok)throw new Error(data.error || 'Routenvergleich fehlgeschlagen.');
      const result=data as RoutePlan;
      setPlan(result);setSelected(rankRoutes(result.routes,preference)[0].id);setExtraRoads([]);
      setFuel(await loadFuel());setNotice('Routen berechnet. Wähle die passende Alternative.');
    }catch(e){setError(e instanceof Error && e.name==='TimeoutError'?'Der Routenvergleich hat zu lange gedauert. Bitte erneut versuchen.':e instanceof Error?e.message:'Keine Verbindung zum Routenvergleich.');}
    finally{setLoading(false);}
  }
  function choosePreference(value:'cheapest'|'fastest'){setPreference(value);if(plan)setSelected(rankRoutes(plan.routes,value)[0].id);}
  function loadPreset(index:number){const sample=presets[index];setOrigin(sample.origin.label);setDestination(sample.destination.label);setOriginPlace(sample.origin);setDestinationPlace(sample.destination);setChoices(null);setError('');setNotice('Startpunkte geladen. „Routen vergleichen“ ruft echte Routendaten ab.');}
  function addRoad(){const roads=normalizeRoads(manualRoad);if(!roads.length){setNotice('Bitte eine Autobahn wie A7 angeben.');return;}setExtraRoads(current=>[...new Set([...current,...roads])].slice(0,5));setManualRoad('');}
  function endJourney(){setJourney(false);setPlan(null);setSelected('');setTraffic(null);setFuel(null);setFuelError('');setExtraRoads([]);setNotice('Fahrt beendet. Routendaten und Tankpreissnapshot entfernt.');}
  function exportPlan(){if(!plan || !route || !estimate)return;const text=`RoutePilot · Fahrtübersicht\n${plan.origin.label}\n→ ${plan.destination.label}\n\nStrecke: ${number(route.distanceMetres/1000,1)} km\nModellfahrzeit ohne Live-Verkehr: ${duration(route.durationSeconds)}\nKraftstoffschätzung: ${euros(estimate.cost)} (${number(estimate.litres,1)} l)\nAnnahmen: ${consumption} l/100 km · ${price} €/l\nOhne Maut, Parken, Verschleiß. Kein garantierter Endpreis.\nQuelle: ${plan.source} · ${time(plan.checkedAt)}\nNavigation: ${mapsDirectionsUrl(plan.origin.label,plan.destination.label)}\nGoogle Maps kann eine andere Route wählen.\n`;const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='RoutePilot-Fahrt.txt';a.click();URL.revokeObjectURL(url);}
  const selectRoute=useCallback((id:string)=>{setSelected(id);setShowAll(false);},[]);
  const corridor=route && traffic ? traffic.events.filter(event=>event.coordinate && nearRoute(event.coordinate,route.geometry)) : [];
  const events=showAll ? traffic?.events ?? [] : corridor;

  return <div className="app">
    <header className="topbar"><a className="brand" href="/" aria-label="RoutePilot Startseite"><span><Route size={23}/></span>RoutePilot<span className="brand-dot">.</span></a><nav aria-label="Hauptnavigation"><a href="#planner">Routenplaner</a><a href="#traffic">Verkehrslage</a></nav><span className="demo-label"><span/> Präsentationsdemo · v0.2</span></header>
    <main>
      <section className="intro"><div><p className="eyebrow">WENIGER UMWEGE. MEHR ÜBERBLICK.</p><h1>Deine Route. <span>Deine Kosten.</span></h1><p>Echte Straßenrouten vergleichen. Kraftstoffkosten nachvollziehen. Informiert losfahren.</p></div><div className="intro-note"><ShieldAlert size={19}/><span>Für PKW & leichte Transporter<br/><strong>Keine LKW-Navigation</strong></span></div></section>
      <div className="workspace">
        <aside className="planner panel" id="planner"><div className="panel-title"><span className="step-number">01</span><h2>Wohin geht’s?</h2><SlidersHorizontal size={18}/></div>
          <form onSubmit={compare} aria-busy={loading}><fieldset disabled={loading || !storageReady}>
            <label className="field-label" htmlFor="origin">Startadresse</label><div className="place-input"><MapPin size={18}/><input id="origin" required maxLength={180} placeholder="Ort, PLZ oder Straße" value={origin} onChange={e=>{setOrigin(e.target.value);setOriginPlace(null);}}/></div>
            <div className="swap-row"><span/><button type="button" aria-label="Start und Ziel tauschen" onClick={()=>{setOrigin(destination);setDestination(origin);setOriginPlace(destinationPlace);setDestinationPlace(originPlace);}}><ArrowDownUp size={15}/></button></div>
            <label className="field-label" htmlFor="destination">Zieladresse</label><div className="place-input"><Navigation size={18}/><input id="destination" required maxLength={180} placeholder="Wohin möchtest du fahren?" value={destination} onChange={e=>{setDestination(e.target.value);setDestinationPlace(null);}}/></div>
            {choices && <div className="place-choices"><label htmlFor="resolved-origin">Gefundenen Start bestätigen</label><select id="resolved-origin" value={originPlace ? `${originPlace.lat},${originPlace.lng}` : ''} onChange={e=>setOriginPlace(choices.origins.find(p=>`${p.lat},${p.lng}`===e.target.value) ?? null)} required><option value="">Bitte auswählen …</option>{choices.origins.map(p=><option key={`${p.lat},${p.lng}`} value={`${p.lat},${p.lng}`}>{p.label}</option>)}</select><label htmlFor="resolved-destination">Gefundenes Ziel bestätigen</label><select id="resolved-destination" value={destinationPlace ? `${destinationPlace.lat},${destinationPlace.lng}` : ''} onChange={e=>setDestinationPlace(choices.destinations.find(p=>`${p.lat},${p.lng}`===e.target.value) ?? null)} required><option value="">Bitte auswählen …</option>{choices.destinations.map(p=><option key={`${p.lat},${p.lng}`} value={`${p.lat},${p.lng}`}>{p.label}</option>)}</select></div>}
            <div className="form-separator"/><div className="section-heading"><Fuel size={17}/><h3>Deine Kostenannahmen</h3><span>EDITIERBAR</span></div><p className="hint">Beispielwerte, keine Live-Tankpreise. Passe sie an dein Fahrzeug an.</p>
            <div className="field-pair"><div><label className="field-label" htmlFor="consumption">Verbrauch · l/100 km</label><input id="consumption" type="number" min="1" max="40" step="0.1" value={consumption} onChange={e=>setConsumption(e.target.value)} required/></div><div><label className="field-label" htmlFor="price">Preisannahme · €/l</label><input id="price" type="number" min="0.5" max="5" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} required/></div></div>
            <label className="field-label" htmlFor="fuel-type">Kraftstoff</label><select id="fuel-type" value={fuelType} onChange={e=>setFuelType(e.target.value as FuelType)}><option value="diesel">Diesel</option><option value="e10">Super E10</option><option value="e5">Super E5</option></select>
            <label className="check-row"><input type="checkbox" checked={checkFuel} onChange={e=>setCheckFuel(e.target.checked)}/><span>Tankpreise einmalig prüfen<small>Optional · 10 km um deinen jetzigen Geräte-Standort · Standortfreigabe nötig</small></span></label>
            <button className="primary full" type="submit" disabled={loading}>{loading?<><Loader2 size={18} className="spin"/> Routen werden verglichen …</>:<>Routen vergleichen <ArrowRight size={18}/></>}</button>
            {error && <div className="error" role="alert">{error}{plan && <p>Der bisherige Vergleich bleibt mit seinem ursprünglichen Zeitstempel sichtbar.</p>}</div>}
          </fieldset></form>
          <div className="quickstart"><h3>Schnellstart für die Präsentation</h3><p className="hint">Lädt nur Start und Ziel. Die Route wird live berechnet.</p>{presets.map((sample,i)=><button type="button" key={sample.name} onClick={()=>loadPreset(i)} disabled={loading || !storageReady}><Route size={14}/>{sample.name}<ArrowRight size={14}/></button>)}</div>
          <p className="privacy-note"><Check size={14}/> Kein Konto. Keine Werbung. Keine KI-Aufrufe.</p>
        </aside>
        <section className="results" aria-label="Routenvergleich">
          <div className="map-panel panel"><div className="map-header"><div><span className="overline">{plan?'DEIN ROUTENVERGLEICH':'BEREIT FÜR DEINE NÄCHSTE FAHRT'}</span><h2>{plan?`${plan.origin.label.split(',')[0]} → ${plan.destination.label.split(',')[0]}`:'Gute Entscheidungen beginnen mit echten Daten.'}</h2></div><span className={`data-badge ${plan?'available':''}`}><span/>{plan?`Abgerufen ${time(plan.checkedAt)}`:'Noch keine Route berechnet'}</span></div><RouteMap plan={plan} selected={selected} onSelect={selectRoute}/></div>
          <div className="comparison-heading"><div><span className="overline">02 · VERGLEICHEN & AUSWÄHLEN</span><h2>{plan?`${plan.routes.length} ${plan.routes.length===1?'Route verfügbar':'Routen im Vergleich'}`:'Welche Route passt zu dir?'}</h2></div><div className="segmented" role="group" aria-label="Routenpriorität"><button aria-pressed={preference==='cheapest'} onClick={()=>choosePreference('cheapest')}><Leaf size={14}/> Kraftstoffarm</button><button aria-pressed={preference==='fastest'} onClick={()=>choosePreference('fastest')}><Clock3 size={14}/> Schnell</button></div></div>
          {plan ? <><div className="route-grid">{plan.routes.map((item,i)=>{const cost=validCosts?fuelEstimate(item.distanceMetres,litres,priceNumber):null;const cheapest=rankRoutes(plan.routes,'cheapest')[0].id===item.id;const fast=fastest?.id===item.id;return <button className={`route-card ${selected===item.id?'selected':''}`} key={item.id} aria-pressed={selected===item.id} onClick={()=>selectRoute(item.id)}><div className="route-card-head"><strong>Route {i+1}</strong><span className="radio-dot">{selected===item.id && <Check size={12}/>}</span></div><span className="route-tag">{cheapest?'Geringste Kraftstoffschätzung':fast?'Kürzeste Modellfahrzeit':'Weitere Alternative'}</span><div className="route-cost">{cost?euros(cost.cost):'–'}<small>Kraftstoff · geschätzt</small></div><div className="route-metrics"><span><Route size={14}/>{number(item.distanceMetres/1000,1)} km</span><span><Clock3 size={14}/>{duration(item.durationSeconds)}</span></div><span className="road-summary">{item.roads.length?item.roads.join(' · '):item.summary || 'Straßenroute laut OSRM'}</span></button>;})}</div>{plan.routes.length===1 && <p className="hint">Der Routingdienst hat nur eine Alternative geliefert. Ein Routenvergleich oder eine Ersparnis lässt sich daraus nicht ableiten.</p>}<p className="method-note"><Info size={15}/><span>Vergleich nur unter den vom Dienst angebotenen Routen. Zeit = Modellfahrzeit ohne Live-Verkehr und Pausen. Kosten = Strecke × Verbrauch × Preisannahme. Ohne Maut, Parken und Verschleiß.</span></p></> : <div className="empty-comparison"><Route size={28}/><div><strong>Keine erfundenen Kilometer. Keine geschätzte Ersparnis ohne Route.</strong><p>Starte einen Vergleich. Hier erscheinen die tatsächlich berechneten Alternativen mit transparenten Kraftstoffschätzungen.</p></div></div>}
          {route && estimate && plan && <section className="trip-summary" aria-label="Ausgewählte Route"><div><span className="overline">DEINE AUSWAHL</span><h2>{euros(estimate.cost)} <small>Kraftstoffschätzung</small></h2><p>{number(estimate.litres,1)} l bei {number(litres,1)} l/100 km und {euros(priceNumber)}/l</p>{difference>=0.01 && <span className="saving-note">{euros(difference)} weniger als die schnellste angebotene Route – unter diesen Annahmen.</span>}</div><div className="trip-actions"><a className="primary" target="_blank" rel="noopener noreferrer" href={mapsDirectionsUrl(`${plan.origin.lat},${plan.origin.lng}`,`${plan.destination.lat},${plan.destination.lng}`)}><Navigation size={17}/> In Google Maps öffnen <ExternalLink size={14}/></a><div><button className="secondary" onClick={()=>setJourney(!journey)}><CheckCircle2 size={16}/>{journey?'Fahrtmodus aktiv':'Fahrtmodus starten'}</button><button className="icon-button" aria-label="Fahrtübersicht herunterladen" onClick={exportPlan}><Download size={18}/></button></div><p>Google Maps kann eine andere Route wählen.</p></div></section>}
          {journey && <div className="journey-banner"><Navigation size={20}/><div><strong>Gute Fahrt. Das Wesentliche im Blick.</strong><p>Nur im Stand bedienen. Verkehrsprüfung alle 15 Minuten, solange die Seite sichtbar ist. Kein zuverlässiger Hintergrunddienst.</p></div><button className="secondary" onClick={endJourney}>Fahrt beenden</button></div>}
          <div className="information-grid">
            <section className="panel traffic-panel" id="traffic"><div className="panel-title"><span className="step-number">03</span><h2>Verkehr & Baustellen</h2><button className="icon-button" onClick={()=>void checkTraffic(roadKey)} disabled={!roadKey || checking} aria-label="Verkehrsmeldungen manuell prüfen"><RefreshCw size={17} className={checking?'spin':''}/></button></div><p className="hint">Offizielle Autobahndaten. {route?'Abgleich über die räumliche Nähe zur gewählten Routenlinie.':'Nach dem Routenvergleich werden die erkannten Autobahnen geprüft.'}</p>
              <div className="traffic-meta"><span>{checking?'Wird geprüft …':traffic?`Abruf ${time(traffic.checkedAt)}`:'Noch keine Verkehrsprüfung'}</span><strong>{traffic?.status==='ok'?'Abruf erfolgreich':traffic?.status==='partial'?'Teilweise verfügbar':traffic?.status==='error'?'Nicht verfügbar':'–'}</strong></div>
              {trafficError && <div className="error" role="alert">{trafficError}</div>}
              {!!traffic?.errors.length && <div className="warning" role="status">{traffic.errors.join(' · ')}</div>}
              <div className="road-chips">{allRoads.slice(0,5).map(road=><span key={road}>{road}</span>)}</div>{allRoads.length>5 && <p className="warning">Mehr als fünf Autobahnen erkannt. Nur die ersten fünf werden geprüft; die Abdeckung ist unvollständig.</p>}
              <details><summary>Autobahn zusätzlich auswählen <ChevronDown size={14}/></summary><div className="manual-road"><label className="sr-only" htmlFor="manual-road">Zusätzliche Autobahn</label><input id="manual-road" value={manualRoad} onChange={e=>setManualRoad(e.target.value)} placeholder="z. B. A7" maxLength={10}/><button className="icon-button" onClick={addRoad} aria-label="Autobahn hinzufügen"><Plus size={18}/></button></div><p className="hint">Manuell gewählte Autobahnen sind kein Nachweis für den Verlauf deiner Fahrt.</p></details>
              {traffic && traffic.status!=='error' && <div className="event-toggle"><label><input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)}/> Ganze ausgewählte Autobahnen anzeigen</label></div>}
              {checking && !traffic?<p className="empty" role="status">Offizielle Verkehrsmeldungen werden abgerufen …</p>:traffic && traffic.status!=='error'?<><div className="event-list" role="region" aria-label="Verkehrsmeldungen" tabIndex={0}>{events.length?events.map(event=><TrafficItem key={event.id} event={event}/>):<p className="empty">{showAll?'Keine Meldungen in den empfangenen Kategorien.':'Keine Meldung mit bekanntem Standort im 3-km-Korridor gefunden.'} Das ist keine Garantie für freie Fahrt.</p>}</div><p className="hint">{showAll?'Meldungen gelten für die gesamte Autobahn.':'Geometrische Nähe ist kein Nachweis für Fahrtrichtung oder tatsächliche Betroffenheit. Meldungen ohne Koordinaten erscheinen nur in der Gesamtansicht.'} {traffic.status==='partial'?'Datenabdeckung unvollständig.':''}</p></>:!trafficError && <p className="empty">{plan && !roadKey?'Keine Autobahn in der gewählten Route erkannt. Bei Bedarf manuell ergänzen.':'Nach deiner Planung erscheinen hier verfügbare Meldungen.'}</p>}
            </section>
            <section className="panel fuel-panel"><div className="panel-title"><span className="fuel-icon"><Fuel size={19}/></span><h2>Tankpreise am Standort</h2><span className="optional">OPTIONAL</span></div><p className="hint">Einmaliger Preis-Snapshot bei der Planung. Keine automatische Preisabfrage während der Fahrt.</p>{fuelError && <div className="warning" role="alert">{fuelError} Der Routenvergleich funktioniert trotzdem.</div>}{fuel?<><div className="snapshot-time">{fuel.type.toUpperCase()} · {time(fuel.checkedAt)}</div>{fuel.stations.length?fuel.stations.slice(0,5).map(station=><article className="station" key={station.id}><div><strong>{station.name}</strong><p>{station.address}</p><small>{number(station.distanceKm,1)} km Anbieterentfernung · {station.isOpen?'beim Abruf geöffnet':'beim Abruf geschlossen'}</small></div><div><b>{number(station.price,3)} €<small>/ Liter</small></b><a href={`https://www.google.com/maps/search/?api=1&query=${station.lat},${station.lng}`} target="_blank" rel="noopener noreferrer" aria-label={`${station.name} auf Google Maps anzeigen`}>Anzeigen ↗</a></div></article>):<p className="empty">Keine Stationen mit verfügbarem Preis im abgefragten Umkreis.</p>}<p className="hint">Momentaufnahme, kein garantierter Zapfsäulenpreis. Stationen befinden sich um deinen Geräte-Standort zum Abrufzeitpunkt und nicht zwingend an der Route. Quelle: Tankerkönig / MTS-K (<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>).</p></>:<div className="fuel-empty"><Fuel size={30}/><strong>Nur wenn du es möchtest.</strong><p>Aktiviere die Tankpreisoption vor dem Vergleich. Ein eingerichteter Server-Schlüssel und deine Standortfreigabe sind erforderlich.</p><span>Die Preisannahme im Vergleich bleibt unabhängig davon editierbar.</span></div>}</section>
          </div>
        </section>
      </div>
      <section className="trust-strip"><div><CheckCircle2 size={20}/><span><strong>Nachvollziehbar</strong>Reale Strecken, offene Annahmen</span></div><div><Leaf size={20}/><span><strong>Schlank betrieben</strong>Keine bezahlten Maps- oder KI-Aufrufe</span></div><div><ShieldAlert size={20}/><span><strong>Ehrlich begrenzt</strong>Keine Live-ETA oder LKW-Freigabe</span></div></section>
    </main>
    <footer><a className="footer-brand" href="#planner">RoutePilot.</a><p>Einfach planen. Bewusst fahren.</p><div><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a><a href="https://project-osrm.org/" target="_blank" rel="noreferrer">OSRM Routing</a><a href="https://www.autobahn.de/" target="_blank" rel="noreferrer">Autobahn GmbH</a><a href="/transparenz">Daten & Datenschutz</a></div><small>Präsentationsdemo · Öffentliche Geodienste ohne Verfügbarkeitsgarantie · Keine verbindliche Kosten- oder Sicherheitszusage</small></footer>
    {notice && <div className="toast" role="status"><CheckCircle2 size={18}/>{notice}<button aria-label="Hinweis schließen" onClick={()=>setNotice('')}><X size={17}/></button></div>}
  </div>;
}

function TrafficItem({event}:{event:TrafficEvent}){return <article className="event"><div><span className={`event-tag ${event.type}`}><TriangleAlert size={12}/>{labels[event.type]} · {event.road}</span>{event.future && <span className="planned">Geplant</span>}</div><h3>{event.title}</h3>{event.subtitle && <p>{event.subtitle}</p>}{event.description && <details><summary>Meldung lesen</summary><p>{event.description}</p></details>}</article>;}
