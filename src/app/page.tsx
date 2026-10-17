"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowRight, Bell, Check, ChevronRight, CircleHelp, Clock3, Construction, ExternalLink, Fuel, Gauge, MapPin, Navigation, Plus, RadioTower, RefreshCw, Route, Settings2, ShieldAlert, ShieldCheck, Smartphone, Trash2, X } from "lucide-react";
import type { FuelSnapshot, FuelType, TrafficEvent, TrafficResponse, Trip, VehicleType } from "@/lib/types";
import { mapsDirectionsUrl, newEvents, normalizeRoads, restoreTrip } from "@/lib/logic.mjs";

type ActiveScreen = "plan" | "monitor";
const storageKey = "routepilot-v01-active-trip";
const tagLabels = {closure:"Sperrung",warning:"Verkehrsmeldung",roadworks:"Baustelle"};

function shortTime(iso?: string) {
  if (!iso) return "Noch nicht geprüft";
  return new Date(iso).toLocaleString("de-DE", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
}

function notificationPermission() {
  return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";
}

function HighwayEvents({items}: {items: TrafficEvent[]}) {
  if (items.length === 0) return <div className="empty"><ShieldCheck size={24} style={{margin:"0 auto 9px"}}/>Aktuell keine Meldungen in den abgefragten Kategorien. Das ist keine Garantie für freie Fahrt.</div>;
  return <div className="alert-list" tabIndex={0} role="region" aria-label="Autobahnmeldungen">{items.map(event => <article className="alert" key={event.id}>
    <span className={`tag ${event.type}`}>{event.type === "closure" ? <ShieldAlert size={12}/> : event.type === "warning" ? <AlertTriangle size={12}/> : <Construction size={12}/>} {tagLabels[event.type]} · {event.road}{event.future ? " · Geplant" : ""}</span>
    <div className="alert-title">{event.title}</div>
    {event.subtitle && <p className="alert-desc">{event.subtitle}</p>}
    {event.description && event.description !== event.subtitle && <p className="alert-desc">{event.description.slice(0,340)}</p>}
  </article>)}</div>;
}

export default function HomePage() {
  const [origin,setOrigin] = useState("");
  const [destination,setDestination] = useState("");
  const [roadInput,setRoadInput] = useState("");
  const [roads,setRoads] = useState<string[]>([]);
  const [vehicle,setVehicle] = useState<VehicleType>("transporter");
  const [fuelType,setFuelType] = useState<FuelType>("diesel");
  const [checkFuel,setCheckFuel] = useState(false);
  const [trip,setTrip] = useState<Trip | null>(null);
  const [traffic,setTraffic] = useState<TrafficResponse | null>(null);
  const [screen,setScreen] = useState<ActiveScreen>("plan");
  const [loading,setLoading] = useState(false);
  const [checking,setChecking] = useState(false);
  const [error,setError] = useState("");
  const [fuelError,setFuelError] = useState("");
  const [toast,setToast] = useState("");
  const [ready,setReady] = useState(false);
  const currentTraffic = useRef<TrafficResponse | null>(null);
  const pollInProgress = useRef(false);
  const trafficController = useRef<AbortController | null>(null);
  const trafficGeneration = useRef(0);
  const lastCheckMs = useRef(0);
  const activeTripRoads = trip?.roads.join(",") ?? "";
  const activeTripCreatedAt = trip?.createdAt;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const restored = restoreTrip(JSON.parse(saved)) as Trip | null;
        if (restored) {
          setTrip(restored); setOrigin(restored.origin); setDestination(restored.destination);
          setVehicle(restored.vehicle); setFuelType(restored.fuelType); setRoads(normalizeRoads(restored.roads));
          setScreen("monitor");
        }
      }
    } catch { /* Storage can be unavailable in private mode. */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      if (trip) localStorage.setItem(storageKey, JSON.stringify(trip));
      else localStorage.removeItem(storageKey);
    } catch { setToast("Lokales Speichern nicht verfügbar. Die Fahrt bleibt nur in diesem Tab erhalten."); }
  }, [trip,ready]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(()=>setToast(""), 4500);
    return ()=>clearTimeout(timeout);
  }, [toast]);

  const checkTraffic = useCallback(async (selectedRoads: string[], notify = true) => {
    if (!selectedRoads.length || pollInProgress.current) return;
    pollInProgress.current = true;
    setChecking(true);
    const generation = trafficGeneration.current;
    const controller = new AbortController();
    trafficController.current = controller;
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`/api/traffic?roads=${encodeURIComponent(selectedRoads.join(","))}`, {cache:"no-store", signal:controller.signal});
      const result: TrafficResponse = await response.json();
      if (generation !== trafficGeneration.current) return;
      if (!Array.isArray(result.events) || !Array.isArray(result.errors) || !["ok","partial","error"].includes(result.status)) throw new Error("Invalid traffic response");
      if (result.status === "error") {
        setError("Verkehrsdaten derzeit nicht verfügbar. Bitte Google Maps beachten.");
      } else setError("");
      if (notify && result.status !== "error" && currentTraffic.current) {
        const fresh = newEvents(currentTraffic.current.events, result.events);
        if (fresh.length) {
          setToast(`${fresh.length} neue Verkehrsmeldung${fresh.length > 1 ? "en" : ""} gefunden`);
          if (notificationPermission() === "granted") {
            new Notification("RoutePilot · Neue Verkehrsmeldung", {body:`${fresh.length} neue Meldung(en) für ${selectedRoads.join(", ")}. Bitte sicher anhalten, bevor du Details liest.`});
          }
        }
      }
      currentTraffic.current = result;
      setTraffic(result);
      lastCheckMs.current = Date.now();
    } catch {
      if (generation !== trafficGeneration.current) return;
      setTraffic(null);
      setError("Keine Verbindung zur Verkehrsabfrage. Google Maps bleibt die Hauptnavigation.");
    } finally {
      clearTimeout(timeout);
      if (trafficController.current === controller) {pollInProgress.current = false;setChecking(false);}
    }
  }, []);

  useEffect(() => {
    if (!activeTripRoads || loading) return;
    const activeRoads = normalizeRoads(activeTripRoads);
    if (document.visibilityState === "visible") void checkTraffic(activeRoads, false);
    const timer = window.setInterval(() => {if(document.visibilityState === "visible") void checkTraffic(activeRoads);}, 15 * 60 * 1000);
    const onVisibility = () => {
      if (document.visibilityState === "visible" && Date.now() - lastCheckMs.current >= 15 * 60 * 1000) void checkTraffic(activeRoads);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {window.clearInterval(timer);document.removeEventListener("visibilitychange", onVisibility);};
  }, [activeTripRoads, activeTripCreatedAt, loading, checkTraffic]);

  function addRoad() {
    const [normalized] = normalizeRoads(roadInput);
    if (!normalized) {setToast("Bitte eine Autobahn eingeben, z. B. A8.");return;}
    if (roads.includes(normalized)) {setRoadInput("");return;}
    if (roads.length >= 5) {setToast("Maximal fünf Autobahnen in Version 0.1.");return;}
    setRoads([...roads,normalized]);setRoadInput("");
  }

  async function getFuelSnapshot(): Promise<FuelSnapshot | null> {
    if (!checkFuel) return null;
    if (!navigator.geolocation) {setFuelError("Standortfunktion nicht verfügbar.");return null;}
    try {
      const position = await new Promise<GeolocationPosition>((resolve,reject) => navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,maximumAge:120_000,timeout:7500}));
      const response = await fetch("/api/fuel", {method:"POST",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(12_000),body:JSON.stringify({lat:position.coords.latitude,lng:position.coords.longitude,type:fuelType})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Tankpreise nicht verfügbar");
      return data as FuelSnapshot;
    } catch(e) {
      setFuelError(e instanceof Error && e.message ? e.message : "Standort oder Kraftstoffpreise konnten nicht ermittelt werden.");
      return null;
    }
  }

  async function planTrip() {
    if (!origin.trim() || !destination.trim()) {setError("Bitte Start und Ziel eingeben.");return;}
    trafficGeneration.current += 1;
    trafficController.current?.abort(); pollInProgress.current = false;
    setError("");setFuelError("");setLoading(true);setTraffic(null);currentTraffic.current = null;
    try {
      const fuel = await getFuelSnapshot();
      const newTrip: Trip = {origin:origin.trim(),destination:destination.trim(),roads:[...roads],vehicle,fuelType,createdAt:new Date().toISOString(),fuel};
      setTrip(newTrip);
      setScreen("monitor");setToast("Fahrt vorbereitet – Google Maps kann gestartet werden.");
    } finally {setLoading(false);}
  }

  function endTrip() {
    trafficGeneration.current += 1;
    trafficController.current?.abort(); pollInProgress.current = false;
    setError("");setFuelError("");setChecking(false);
    setTrip(null);setTraffic(null);currentTraffic.current=null;setScreen("plan");setToast("Fahrt beendet und lokale Daten entfernt.");
  }

  async function activateNotifications() {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setToast(permission === "granted" ? "Benachrichtigungen aktiviert, solange der Browser sie zustellt." : "Benachrichtigungen nicht erlaubt.");
    } else setToast("Dieser Browser unterstützt keine Desktop-Benachrichtigungen.");
  }

  function navUrl() {return trip ? mapsDirectionsUrl(trip.origin,trip.destination) : "#";}

  return <main id="main" className="shell">
    <header className="top"><div className="logo"><span className="logo-mark"><Route size={23} strokeWidth={2.8}/></span> RoutePilot <span className="version">V 0.1</span></div><div className="top-right"><span className="pulse"/> WEB PROTOTYP · DEUTSCHLAND</div></header>
    <section className="hero"><div className="eyebrow">Routenassistent für unterwegs</div><h1>Einmal planen.<br/><span>Entspannt fahren.</span></h1><p>Google Maps übernimmt die Navigation. RoutePilot zeigt dir auf Wunsch Tankpreise bei der Planung und überprüft deutsche Autobahnmeldungen, solange die Web-App läuft.</p></section>
    <div className="layout">
      <div className={`stack ${screen === "monitor" ? "mobile-hide" : ""}`}>
        <section className="card"><div className="card-heading"><h2>Neue Fahrt planen</h2><span className="tiny-badge">01 / Planung</span></div>
          <form onSubmit={e=>{e.preventDefault();void planTrip();}} aria-busy={loading}><fieldset disabled={loading}><legend className="sr-only">Fahrt planen</legend><div className="form-grid">
            <div className="field"><label htmlFor="origin">Startadresse</label><div className="input-wrap"><MapPin size={18}/><input required maxLength={300} id="origin" placeholder="z. B. Ravensburg, Deutschland" value={origin} onChange={e=>setOrigin(e.target.value)} autoComplete="street-address"/></div></div>
            <div style={{display:"flex",justifyContent:"center",height:9,color:"#557365"}}><ArrowDown size={17}/></div>
            <div className="field"><label htmlFor="destination">Zieladresse</label><div className="input-wrap"><Navigation size={18}/><input required maxLength={300} id="destination" placeholder="z. B. Hamburg, Deutschland" value={destination} onChange={e=>setDestination(e.target.value)}/></div></div>
            <div className="two-cols">
              <div className="field"><label htmlFor="vehicle">Fahrzeug</label><select id="vehicle" value={vehicle} onChange={e=>setVehicle(e.target.value as VehicleType)}><option value="transporter">Transporter</option><option value="pkw">PKW</option></select></div>
              <div className="field"><label htmlFor="fuel">Kraftstoff</label><select id="fuel" value={fuelType} onChange={e=>setFuelType(e.target.value as FuelType)}><option value="diesel">Diesel</option><option value="e10">Super E10</option><option value="e5">Super E5</option></select></div>
            </div>
            <div className="field"><label htmlFor="road">Autobahnen überwachen (manuell auswählen)</label><div className="add-highway"><input className="highway-input" id="road" maxLength={10} placeholder="z. B. A8" value={roadInput} onChange={e=>setRoadInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addRoad();}}}/><button aria-label="Autobahn hinzufügen" onClick={addRoad} type="button"><Plus size={20}/></button></div>
              <div className="highways">{roads.map(road=><div className="chip" key={road}>{road}<button aria-label={`${road} entfernen`} onClick={()=>setRoads(current=>current.filter(r=>r!==road))}><X size={14}/></button></div>)}</div>
              <p className="subnote">Wähle nur Autobahnen, die du tatsächlich nutzt (z. B. A7, A8). Ohne Auswahl findet keine Verkehrsprüfung statt. Meldungen gelten für die gesamte Autobahn, nicht für deinen genauen Streckenabschnitt.</p>
            </div>
          </div>
          <label className="toggle-row"><input type="checkbox" checked={checkFuel} onChange={e=>setCheckFuel(e.target.checked)}/><div><span>Tankpreise bei der Planung prüfen</span><small>Einmalige Abfrage im Umkreis von 10 km deines aktuellen Standorts. Benötigt Standortfreigabe und einen eingerichteten API-Key.</small></div></label>
          <button className="btn-primary" type="submit" disabled={loading}>{loading ? <><RefreshCw className="spin" size={18}/> Fahrt wird vorbereitet …</> : <>Fahrt vorbereiten <ArrowRight size={18}/></>}</button>
          </fieldset></form>
          {!trip && error && <p className="error" role="alert">{error}</p>}
          <p className="info"><CircleHelp size={13} style={{verticalAlign:"middle",marginRight:6}}/>PKW und Transporter im Test. Für schwere LKW ist Google Maps ohne LKW-spezifische Beschränkungen ungeeignet.</p>
        </section>
        <section className="card"><div className="card-heading"><h2>So funktioniert's</h2><span className="tiny-badge">Minimal & günstig</span></div>
          <div className="status-row"><span><Check size={15} style={{verticalAlign:"middle",color:"var(--mint)",marginRight:8}}/> Google Maps als Navigation</span><ChevronRight size={16}/></div>
          <div className="status-row"><span><Check size={15} style={{verticalAlign:"middle",color:"var(--mint)",marginRight:8}}/> Öffentliche Autobahndaten</span><ChevronRight size={16}/></div>
          <div className="status-row"><span><Check size={15} style={{verticalAlign:"middle",color:"var(--mint)",marginRight:8}}/> Keine dauernden KI-Aufrufe</span><ChevronRight size={16}/></div>
          <p className="info">Wichtig: In v0.1 findet keine automatische Berechnung der günstigsten Gesamtstrecke, kein exakter Streckenabgleich und kein verlässliches Monitoring bei geschlossenem Browser statt.</p>
        </section>
      </div>
      <div className={`stack ${screen === "plan" ? "mobile-hide" : ""}`}>
        <section className="card"><div className="card-heading"><h2>Deine Fahrt</h2><span className={`tiny-badge ${trip?"good":""}`}>{trip ? "Vorbereitet" : "Noch keine Fahrt"}</span></div>
        {trip ? <>
          <div className="trip-line"><small>Start</small><strong>{trip.origin}</strong></div>
          <div className="trip-line"><small>Ziel</small><strong>{trip.destination}</strong></div>
          <div className="inline-actions"><a className="btn-primary" style={{textDecoration:"none"}} href={navUrl()} target="_blank" rel="noopener noreferrer"><Navigation size={17}/> Google Maps starten <ExternalLink size={14}/></a></div>
          <p className="info">Google Maps bestimmt die tatsächliche Navigation selbst. Die gewählten Autobahnen müssen separat zur überwachten Route passen.</p>
          <div className="inline-actions"><button className="btn-muted" onClick={()=>setScreen("plan")}><Settings2 size={15}/> Neu planen</button><button className="btn-muted" onClick={endTrip}><Trash2 size={15}/> Beenden</button></div>
        </> : <div className="empty"><Navigation size={32} style={{margin:"0 auto 10px"}}/>Plane eine Fahrt. Dann erscheint hier der Startknopf für Google Maps.</div>}
        </section>
        <section className="summary">
          <h3><RadioTower size={17} style={{verticalAlign:"middle",marginRight:9,color:"var(--mint)"}}/> Autobahn-Monitor</h3>
          <div className="status-row"><span>Überwachte Autobahnen</span><strong>{trip?.roads.length ? trip.roads.join(", ") : "Keine"}</strong></div>
          <div className="status-row"><span>Prüfintervall</span><strong>15 Minuten (App geöffnet)</strong></div>
          <div className="status-row"><span>Letzte Abfrage</span><strong>{shortTime(traffic?.checkedAt)}</strong></div>
          <div className="status-row"><span>Datenstatus</span><strong style={{color:traffic?.status==="ok"?"var(--mint)":traffic?.status==="error"?"var(--danger)":"var(--warning)"}}>{traffic?.status === "ok" ? "Abruf erfolgreich" : traffic?.status === "partial" ? "Teilweise verfügbar" : traffic?.status === "error" ? "Nicht verfügbar" : "Noch keine Daten"}</strong></div>
          <div className="divider"/>
          <div className="stat-grid"><div className="stat"><span>Sperrungen</span><b>{traffic?.status !== "error" && traffic ? traffic.events.filter(e=>e.type==="closure").length : "–"}</b></div><div className="stat"><span>Weitere Meldungen</span><b>{traffic?.status !== "error" && traffic ? traffic.events.filter(e=>e.type!=="closure").length : "–"}</b></div></div>
          <button className="btn-secondary" style={{width:"100%"}} onClick={()=>void checkTraffic(trip?.roads ?? [],false)} disabled={!trip?.roads.length || checking}>{checking ? <><RefreshCw size={16}/> Wird geprüft …</> : <><RefreshCw size={16}/> Jetzt manuell prüfen</>}</button>
          {trip && <button className="btn-muted" style={{width:"100%",marginTop:9}} onClick={activateNotifications}><Bell size={15}/> Browser-Benachrichtigungen erlauben</button>}
          <p className="info">Die Web-App kann beim Wechsel zu Google Maps oder gesperrtem Bildschirm pausiert werden. Warnungen sind kein sicherheitskritisches Navigationssystem.</p>
        </section>
        <section className="card"><div className="card-heading"><h2>Verkehrsmeldungen</h2><span className="tiny-badge">Autobahn API</span></div>
          {error && <div className="error" role="alert" style={{marginBottom:13}}>{error}</div>}
          {!trip ? <div className="empty">Starte die Planung, um aktuelle Meldungen abzurufen.</div> : !trip.roads.length ? <div className="empty">Keine Autobahn für die Überwachung ausgewählt.</div> : !traffic ? <div className="empty" role="status">{checking ? "Prüfe aktuelle Autobahndaten …" : "Noch keine aktuellen Verkehrsdaten. Bitte erneut manuell prüfen."}</div> : traffic.status === "error" ? <div className="empty">Keine verlässlichen Verkehrsdaten empfangen.</div> : <><HighwayEvents items={traffic.events}/>{traffic.status === "partial" && <p className="info" role="status">Die Liste ist unvollständig. Fehlende Meldungen bedeuten keine freie Fahrt.</p>}</>}
          {!!traffic?.errors.length && <p className="info">Hinweise zur Datenabfrage: {traffic.errors.slice(0,3).join("; ")}{traffic.errors.length>3?" …":""}</p>}
        </section>
        <section className="card"><div className="card-heading"><h2>Tankstellen beim Start</h2><Fuel size={18} color="var(--mint)"/></div>
          {fuelError && <p className="error" role="alert">Tankpreise: {fuelError} Die Fahrt kann trotzdem gestartet werden.</p>}
          {!trip?.fuel ? <div className="empty">Keine Tankpreise geladen. Aktiviere die Option beim Planen und erlaube deinen Standort. Es findet keine Preisabfrage während der Fahrt statt.</div> : <>
            <div className="section-label">{trip.fuelType.toUpperCase()} · Stand: {shortTime(trip.fuel.checkedAt)}</div>
            {trip.fuel.stations.length ? trip.fuel.stations.slice(0,5).map(station=><div className="fuel-item" key={station.id}><div><strong>{station.name}</strong><p>{station.address}<br/>{station.distanceKm.toFixed(1)} km Luftlinie/Anbieterentfernung · {station.isOpen?"Zum Abruf geöffnet":"Zum Abruf geschlossen"}</p></div><div style={{textAlign:"right"}}><div className="price">{station.price.toFixed(3).replace(".",",")} €</div><a aria-label={`${station.name} auf Google Maps anzeigen`} style={{fontSize:11,color:"var(--blue)"}} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${station.lat},${station.lng}`)}`} target="_blank" rel="noopener noreferrer">Anzeigen ↗</a></div></div>) : <div className="empty">Im abgefragten Umkreis wurden keine Tankstellen mit Preis gefunden.</div>}
            <p className="info">Preise sind Momentaufnahmen, keine garantierten Zapfsäulenpreise. Stationen liegen um deinen Startstandort, nicht zwingend entlang deiner Route. Quelle: {trip.fuel.source}.</p>
          </>}
        </section>
      </div>
    </div>
    <nav className="tabs only-mobile" aria-label="Ansichten"><button aria-pressed={screen==="plan"} className={screen==="plan"?"active":""} onClick={()=>setScreen("plan")}><Route size={16}/> Planen</button><button aria-pressed={screen==="monitor"} className={screen==="monitor"?"active":""} onClick={()=>setScreen("monitor")}><Gauge size={16}/> Fahrt & Meldungen</button></nav>
    <footer className="footer"><p>RoutePilot v0.1 · Prototyp · Kein Ersatz für Verkehrszeichen oder sichere Navigation</p><p>Verkehrsdaten: <a href="https://www.autobahn.de/" target="_blank" rel="noreferrer">Autobahn GmbH des Bundes</a> · Optional Tankpreise: <a href="https://creativecommons.tankerkoenig.de/" target="_blank" rel="noreferrer">Tankerkönig / MTS-K (CC BY 4.0)</a></p></footer>
    {toast && <div role="status" className="toast">{toast}</div>}
  </main>;
}
