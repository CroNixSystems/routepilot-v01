'use client';
import {useEffect, useRef, useState} from 'react';
import type * as Leaflet from 'leaflet';
import type {RoutePlan} from '@/lib/types';
import 'leaflet/dist/leaflet.css';

export default function RouteMap({plan,selected,onSelect}:{plan:RoutePlan|null;selected:string;onSelect:(id:string)=>void}){
  const host=useRef<HTMLDivElement>(null);
  const map=useRef<Leaflet.Map|null>(null);
  const library=useRef<typeof Leaflet|null>(null);
  const layer=useRef<Leaflet.LayerGroup|null>(null);
  const [ready,setReady]=useState(false);
  const [tileError,setTileError]=useState(false);
  useEffect(()=>{
    let cancelled=false;
    void import('leaflet').then(L=>{
      if(cancelled || !host.current)return;
      library.current=L;
      const instance=L.map(host.current,{zoomControl:false,scrollWheelZoom:false}).setView([51.1,10.2],6);
      L.control.zoom({position:'topright',zoomInTitle:'Vergrößern',zoomOutTitle:'Verkleinern'}).addTo(instance);
      const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(instance);
      tiles.on('tileerror',()=>{if(!cancelled)setTileError(true);});
      map.current=instance;layer.current=L.layerGroup().addTo(instance);setReady(true);
      const observer=new ResizeObserver(()=>instance.invalidateSize());observer.observe(host.current);
      instance.on('unload',()=>observer.disconnect());
    });
    return()=>{cancelled=true;map.current?.remove();map.current=null;};
  },[]);
  useEffect(()=>{
    const L=library.current,group=layer.current,instance=map.current;
    if(!ready || !L || !group || !instance)return;
    group.clearLayers();
    if(!plan)return;
    for(const route of [...plan.routes].sort((a)=>a.id===selected?1:-1)){
      const line=L.polyline(route.geometry.map(([lng,lat])=>[lat,lng] as [number,number]),{color:route.id===selected?'#146c55':'#627696',weight:route.id===selected?6:4,opacity:route.id===selected?1:0.6}).addTo(group);
      line.on('click',()=>onSelect(route.id));
    }
    for(const place of [plan.origin,plan.destination]) L.circleMarker([place.lat,place.lng],{radius:7,color:'#fff',weight:3,fillColor:'#172d2b',fillOpacity:1}).bindTooltip(place.label,{direction:'top'}).addTo(group);
    const route=plan.routes.find(r=>r.id===selected) ?? plan.routes[0];
    instance.fitBounds(L.latLngBounds(route.geometry.map(([lng,lat])=>[lat,lng] as [number,number])),{padding:[32,32],maxZoom:12,animate:false});
  },[ready,plan,selected,onSelect]);
  return <div className="map-shell"><div ref={host} className="map" role="region" aria-label="Interaktive Routenkarte mit OpenStreetMap"/>{!plan && <div className="map-empty"><span className="map-empty-icon">↗</span><strong>Deine nächste Fahrt beginnt hier.</strong><span>Start und Ziel eingeben und echte Routen vergleichen.</span></div>}{tileError && <p className="map-notice" role="status">Kartenhintergrund teilweise nicht verfügbar. Routendaten stehen im Vergleich.</p>}<div className="map-caption">{plan?'Berechnete Straßenroute · keine Live-Verkehrsprognose':'Deutschland · OpenStreetMap'}</div></div>;
}
