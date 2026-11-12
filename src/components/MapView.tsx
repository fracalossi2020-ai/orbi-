"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { hangingBobSvg } from "@/lib/prumo-mark";
import { MAP_WORKER_URL, mapAssets } from "@/lib/map-preload";

/** heading: direção do movimento em graus (do GPS do celular), usada para girar o carro. */
export type MapPoint = { id: string; lat: number; lng: number; kind: "origin" | "dest" | "stop" | "car" | "me"; heading?: number | null };
export type MapArea = { lat: number; lng: number; radiusKm: number };
/** Etiquetas presas na partida e no destino: "De …" (com um número em destaque) e "Para …". */
export type MapEndLabel = { lat: number; lng: number; title: string; sub?: string; badge?: string; badgeSub?: string };
export type MapEndLabels = { origin?: MapEndLabel; dest?: MapEndLabel };

/** Lugar que a pessoa está olhando na lista de sugestões, antes de escolher. */
export type MapPreview = { lat: number; lng: number; label: string; detail?: string; kind?: string; osm?: string; extent?: [number, number, number, number] };
const VALE = { lng: -42.58, lat: -19.5 };
const LINE = "prumo-route";
const AREAS = "prumo-areas";
const OUTLINE = "prumo-outline";

// Mapa claro e completo (estilo "liberty" do OpenFreeMap): nomes de ruas e bairros, comércios, escolas, hospitais,
// parques, rios e numeração. O estilo é baixado antes, junto com a biblioteca: ver map-preload.

// Nomes lidos por leitor de tela ao passar pelos marcadores.
const MARK_LABEL: Record<MapPoint["kind"], string> = { me: "Você está aqui", origin: "Partida", dest: "Destino final", stop: "Parada", car: "Carro" };

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * O prumo marca o lugar: a ponta toca o ponto exato. No GPS ele balança de leve e a base pulsa;
 * na partida e no destino ele cai, oscila e assenta, como um prumo de verdade.
 */
function markerEl(kind: MapPoint["kind"]) {
  const el = document.createElement("div");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", MARK_LABEL[kind]);
  if (kind === "car") {
    // Carro do motorista visto de cima; o filho gira com a direção (o MapLibre usa o transform do elemento externo).
    el.className = "live-car";
    el.innerHTML = `<span class="live-car__pulse"></span><span class="live-car__body"><svg width="22" height="38" viewBox="0 0 16 28">
      <rect x="1" y="1" width="14" height="26" rx="5" fill="var(--primary)" stroke="#fff" stroke-width="1.6"/>
      <rect x="3" y="6" width="10" height="5" rx="1.5" fill="#0d1a20" opacity=".8"/>
      <rect x="3" y="18" width="10" height="4" rx="1.5" fill="#0d1a20" opacity=".65"/>
      <path d="M8 -3 11 1H5Z" fill="#fff"/></svg></span>`;
    return el;
  }
  el.className = `prumo-mk prumo-mk--${kind}`;
  el.innerHTML = `<span class="prumo-mk__ring"></span><span class="prumo-mk__drop">${hangingBobSvg(kind)}</span>`;
  return el;
}

/** Gira o carro para a direção do movimento (quando o GPS informa). */
function turn(mk: Marker, heading?: number | null) {
  if (heading == null || Number.isNaN(heading)) return;
  const body = mk.getElement().querySelector<HTMLElement>(".live-car__body");
  if (body) body.style.transform = `rotate(${heading}deg)`;
}

/** O carro desliza até a posição nova em ~1,2 s, em vez de pular a cada atualização do GPS. */
const gliding = new WeakMap<Marker, number>();
function glide(mk: Marker, p: { lat: number; lng: number; heading?: number | null }) {
  turn(mk, p.heading);
  const from = mk.getLngLat();
  if (Math.abs(from.lat - p.lat) < 1e-7 && Math.abs(from.lng - p.lng) < 1e-7) return;
  cancelAnimationFrame(gliding.get(mk) ?? 0);
  if (reducedMotion()) { mk.setLngLat([p.lng, p.lat]); return; }
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min((now - start) / 1200, 1);
    const e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    mk.setLngLat([from.lng + (p.lng - from.lng) * e, from.lat + (p.lat - from.lat) * e]);
    if (t < 1) gliding.set(mk, requestAnimationFrame(step));
  };
  gliding.set(mk, requestAnimationFrame(step));
}

/** Prévia: o nome do lugar num balão, em cima de um prumo translúcido. */
function previewEl(p: MapPreview) {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none";
  el.innerHTML = `<div class="map-tag"><b>${esc(p.label)}</b>${p.detail ? `<small>${esc(p.detail)}</small>` : ""}</div>
    <div class="prumo-mk prumo-mk--preview"><span class="prumo-mk__ring"></span><span class="prumo-mk__drop">${hangingBobSvg("preview")}</span></div>`;
  return el;
}

/** Carro online visto de cima, com direção variada para o mapa parecer vivo (a direção não é a real). */
function ambientCarEl(seed: number) {
  const el = document.createElement("div");
  el.className = "ambient-car";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `<span><svg width="16" height="28" viewBox="0 0 16 28" style="transform:rotate(${(seed * 137) % 360}deg)">
    <rect x="1" y="1" width="14" height="26" rx="5" fill="var(--primary)" stroke="#fff" stroke-width="1.5"/>
    <rect x="3" y="6" width="10" height="5" rx="1.5" fill="#0d1a20" opacity=".75"/>
    <rect x="3" y="18" width="10" height="4" rx="1.5" fill="#0d1a20" opacity=".6"/>
    <rect x="3" y="12.5" width="10" height="4.5" rx="1" fill="#fff" opacity=".35"/></svg></span>`;
  return el;
}

/** Círculo como polígono de 64 lados (raio em km, aproximação suficiente para a escala de uma cidade). */
function circle({ lat, lng, radiusKm }: MapArea): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    pts.push([lng + (radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a), lat + (radiusKm / 110.57) * Math.sin(a)]);
  }
  return pts;
}

// Contornos de bairro já baixados nesta visita.
const outlineCache = new Map<string, unknown>();
const EMPTY = { type: "FeatureCollection" as const, features: [] };

/**
 * Mapa real (MapLibre + OpenFreeMap). Sem conexão, mostra o motivo no lugar do mapa.
 * O mapa é sempre claro, mesmo no modo escuro do app, para as ruas e nomes ficarem legíveis.
 * areas desenha a área atendida; glow dá brilho à rota; cooperative evita que a rolagem da página vire zoom no mapa.
 * preview mostra, antes da escolha, onde fica a sugestão da busca (com o contorno, se for bairro).
 */
export function MapView({ points = [], route, onPick, className = "", ariaLabel = "Mapa", areas, glow, cooperative, routeColorVar = "--primary", padding, focus, picking, preview, cars, routeLabel, recenter, tilt = 0, orbit, onCamera, endLabels, children }: {
  endLabels?: MapEndLabels | null;
  /** Inclinação da câmera em graus (0 = visto de cima). Com inclinação, os prédios aparecem em 3D. */
  tilt?: number;
  /** Sem trajeto na tela, a câmera gira devagar sobre a cidade. Pausa fora da tela, ao mexer no mapa e com movimento reduzido. */
  orbit?: boolean;
  /** Posição da câmera (centro, rumo, inclinação, zoom), avisada a cada quadro em que ela muda. */
  onCamera?: (c: { lat: number; lng: number; bearing: number; pitch: number; zoom: number }) => void;
  points?: MapPoint[]; route?: [number, number][] | null; onPick?: (p: { lat: number; lng: number }) => void; className?: string; ariaLabel?: string;
  /** Enquanto a pessoa marca um ponto, o cursor vira o prumo na vertical. */
  picking?: boolean;
  areas?: MapArea[]; glow?: boolean; cooperative?: boolean; routeColorVar?: string;
  padding?: { top: number; bottom: number; left: number; right: number }; focus?: { lat: number; lng: number; zoom: number } | null;
  preview?: MapPreview | null;
  /** Motoristas online por perto, em posição aproximada. */
  cars?: { lat: number; lng: number }[];
  /** Etiqueta no meio da rota, por exemplo o tempo de viagem. */
  routeLabel?: { main: string; sub?: string } | null;
  /** Botão para voltar a enquadrar o trajeto. */
  recenter?: boolean;
  /** Elementos sobre o mapa (avisos, etiquetas), posicionados por quem usa. */
  children?: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const extras = useRef<{ preview?: Marker; eta?: Marker; cars: Marker[] }>({ cars: [] });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [painted, setPainted] = useState(false);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const cssVar = (name: string, fallback: string) => (box.current ? getComputedStyle(box.current).getPropertyValue(name).trim() : "") || fallback;
  const pad = padding ?? { top: 70, bottom: 70, left: 60, right: 60 };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const probe = document.createElement("canvas");
      if (!probe.getContext("webgl2") && !probe.getContext("webgl")) { setFailed(true); return; }
      const { ml, style } = await mapAssets();
      if (cancelled || !box.current) return;
      lib.current = ml;
      try {
        ml.setWorkerUrl(`${location.origin}${MAP_WORKER_URL}`);
        // fadeDuration curto: os nomes das ruas aparecem logo, sem a transição longa padrão.
        const start = focus ?? { ...VALE, zoom: 11 };
        const m = new ml.Map({ container: box.current, style, center: [start.lng, start.lat], zoom: start.zoom, pitch: tilt, maxPitch: 70, attributionControl: { compact: true }, cooperativeGestures: cooperative ?? false, fadeDuration: 120 });
        map.current = m;
        m.on("load", () => { if (!cancelled) setReady(true); });
        // Primeiro desenho completo: o mapa aparece suavemente sobre o fundo.
        m.once("idle", () => { if (!cancelled) setPainted(true); });
        m.on("error", (e) => { if (!m.isStyleLoaded() && String(e.error?.message ?? "").match(/style|fetch|webgl/i)) setFailed(true); });
        m.on("click", (e) => pickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
      } catch { setFailed(true); }
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      markers.current.clear();
      extras.current = { cars: [] };
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Área atendida
  const areasKey = JSON.stringify(areas ?? []);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !areas?.length) return;
    const data = { type: "FeatureCollection" as const, features: areas.map((a) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [circle(a)] } })) };
    const src = m.getSource(AREAS) as { setData?: (d: unknown) => void } | undefined;
    if (src?.setData) { src.setData(data); return; }
    const color = cssVar("--primary", "#176B5B");
    m.addSource(AREAS, { type: "geojson", data });
    m.addLayer({ id: `${AREAS}-fill`, type: "fill", source: AREAS, paint: { "fill-color": color, "fill-opacity": 0.05 } });
    m.addLayer({ id: `${AREAS}-line`, type: "line", source: AREAS, paint: { "line-color": color, "line-opacity": 0.7, "line-width": 1.6, "line-dasharray": [2, 2] } });
  }, [areasKey, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Marcadores
  useEffect(() => {
    const m = map.current;
    const ml = lib.current;
    if (!m || !ml || !ready) return;
    const seen = new Set<string>();
    for (const p of points) {
      // A chave inclui o tipo: a partida pode virar o prumo do GPS e vice-versa.
      const key = `${p.id}|${p.kind}`;
      seen.add(key);
      const existing = markers.current.get(key);
      if (existing && p.kind === "car") glide(existing, p);
      else if (existing) existing.setLngLat([p.lng, p.lat]);
      else {
        const mk = new ml.Marker({ element: markerEl(p.kind), anchor: p.kind === "car" ? "center" : "bottom" }).setLngLat([p.lng, p.lat]).addTo(m);
        markers.current.set(key, mk);
        if (p.kind === "car") turn(mk, p.heading);
      }
    }
    for (const [id, marker] of markers.current) if (!seen.has(id)) { marker.remove(); markers.current.delete(id); }
  }, [points, ready]);

  // Enquadra rota e pontos. Também usado pelo botão de centralizar e ao sair da prévia.
  /** `cinematic`: no mapa 3D, voo mais longo com um leve giro, para a chegada de um endereço novo. */
  const fit = (duration = 700, cinematic = false) => {
    const m = map.current;
    const ml = lib.current;
    if (!m || !ml) return;
    const film = cinematic && !!tilt && !reducedMotion();
    const d = film ? 2200 : duration;
    const bearing = tilt ? m.getBearing() + (film ? -24 : 0) : 0;
    const coords: [number, number][] = [...(route ?? []), ...points.map((p) => [p.lng, p.lat] as [number, number])];
    if (coords.length > 1) {
      const bounds = coords.reduce((b, c) => b.extend(c), new ml.LngLatBounds(coords[0], coords[0]));
      const cam = m.cameraForBounds(bounds, { padding: pad, maxZoom: 15, bearing });
      if (film && cam) m.flyTo({ ...cam, pitch: tilt, bearing, duration: d, curve: 1.25, essential: true });
      else m.fitBounds(bounds, { padding: pad, maxZoom: 15, duration: d, pitch: tilt, bearing });
    } else if (coords.length === 1) {
      // offset, e não padding: o padding do easeTo fica guardado no mapa e, somado ao do fitBounds, impede o enquadramento da rota.
      const opts = { center: coords[0], zoom: 15, pitch: tilt, bearing, offset: [(pad.left - pad.right) / 2, -(pad.bottom - pad.top) / 2] as [number, number] };
      if (film) m.flyTo({ ...opts, duration: d, curve: 1.25, essential: true });
      else m.easeTo({ ...opts, zoom: 14, duration: d });
    }
  };
  const fitRef = useRef(fit);
  fitRef.current = fit;

  // Rota: desenhada aos poucos, do início ao fim, como um fio sendo esticado.
  const fitKey = JSON.stringify([route?.length ?? 0, route?.[0], points.filter((p) => p.kind !== "car").map((p) => [p.lat, p.lng])]);
  const routeKey = JSON.stringify([route?.length ?? 0, route?.[0], route?.at(-1)]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const data = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: route ?? [] } };
    const color = cssVar(routeColorVar, "#176B5B");
    const layers = glow ? [`${LINE}-glow`, LINE] : [`${LINE}-case`, LINE];
    const colors = glow ? [color, color] : ["#ffffff", color];
    const src = m.getSource(LINE) as { setData?: (d: unknown) => void } | undefined;
    if (src?.setData) src.setData(data);
    else {
      m.addSource(LINE, { type: "geojson", data, lineMetrics: true });
      const layout = { "line-cap": "round" as const, "line-join": "round" as const };
      if (glow) m.addLayer({ id: layers[0], type: "line", source: LINE, layout, paint: { "line-color": color, "line-width": 16, "line-blur": 10, "line-opacity": 0.45 } });
      else m.addLayer({ id: layers[0], type: "line", source: LINE, layout, paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": .9 } });
      m.addLayer({ id: LINE, type: "line", source: LINE, layout, paint: { "line-color": color, "line-width": glow ? 4 : 5.5 } });
    }
    if (!route || route.length < 2) return;
    const trim = (t: number) => layers.forEach((id, i) => m.getLayer(id) && m.setPaintProperty(id, "line-gradient", ["step", ["line-progress"], colors[i], Math.min(Math.max(t, 0.0001), 1.0001), "rgba(0,0,0,0)"]));
    if (reducedMotion()) { trim(1.0001); return; }
    let raf = 0;
    const start = performance.now() + 250;
    const tick = (now: number) => {
      const t = Math.min((now - start) / 1100, 1);
      const eased = 1 - Math.pow(1 - Math.max(t, 0), 3);
      trim(t >= 1 ? 1.0001 : eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    trim(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [routeKey, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready || preview) return;
    fitRef.current(700, true);
  }, [fitKey, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tempo de viagem no meio da rota
  const etaKey = routeLabel && route && route.length > 1 ? `${routeKey}|${routeLabel.main}|${routeLabel.sub ?? ""}` : "";
  useEffect(() => {
    const m = map.current;
    const ml = lib.current;
    extras.current.eta?.remove();
    extras.current.eta = undefined;
    if (!m || !ml || !ready || !etaKey || !route || !routeLabel) return;
    const mid = route[Math.floor(route.length / 2)];
    const el = document.createElement("div");
    el.className = "map-eta";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `<span>${esc(routeLabel.main)}${routeLabel.sub ? `<small>${esc(routeLabel.sub)}</small>` : ""}</span>`;
    extras.current.eta = new ml.Marker({ element: el, anchor: "bottom", offset: [0, -10] }).setLngLat(mid).addTo(m);
  }, [etaKey, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Etiquetas na partida e no destino
  const endKey = JSON.stringify(endLabels ?? null);
  const endMarks = useRef<Marker[]>([]);
  useEffect(() => {
    const m = map.current;
    const ml = lib.current;
    const clear = () => { endMarks.current.forEach((x) => x.remove()); endMarks.current = []; };
    clear();
    if (!m || !ml || !ready || !endLabels) return;
    // A etiqueta vai para o lado com mais espaço: ponto na metade direita do mapa, etiqueta à esquerda dele.
    const place = () => {
      clear();
      const width = m.getContainer().clientWidth;
      for (const [side, l] of Object.entries(endLabels) as [string, MapEndLabel | undefined][]) {
        if (!l) continue;
        const toLeft = m.project([l.lng, l.lat]).x > width * 0.55;
        const el = document.createElement("div");
        el.setAttribute("aria-hidden", "true");
        el.className = "end-tag-host";
        el.innerHTML = `<div class="end-tag end-tag--${side}">${l.badge ? `<span class="end-tag__badge">${esc(l.badge)}${l.badgeSub ? `<small>${esc(l.badgeSub)}</small>` : ""}</span>` : ""}<span class="end-tag__text"><b>${esc(l.title)}</b>${l.sub ? `<small>${esc(l.sub)}</small>` : ""}</span></div>`;
        const dy = side === "origin" ? -10 : -58;
        endMarks.current.push(new ml.Marker({ element: el, anchor: toLeft ? "bottom-right" : "bottom-left", offset: [toLeft ? -14 : 14, dy] }).setLngLat([l.lng, l.lat]).addTo(m));
      }
    };
    place();
    m.on("moveend", place);
    return () => { m.off("moveend", place); };
  }, [endKey, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prévia da sugestão: voa até o lugar e, se for bairro, desenha o contorno.
  const previewKey = preview ? `${preview.lat},${preview.lng},${preview.label}` : "";
  useEffect(() => {
    const m = map.current;
    const ml = lib.current;
    if (!m || !ml || !ready) return;
    extras.current.preview?.remove();
    extras.current.preview = undefined;
    const outlineSrc = () => {
      let src = m.getSource(OUTLINE) as { setData?: (d: unknown) => void } | undefined;
      if (!src) {
        const accent = cssVar("--primary", "#176B5B");
        m.addSource(OUTLINE, { type: "geojson", data: EMPTY });
        m.addLayer({ id: `${OUTLINE}-fill`, type: "fill", source: OUTLINE, paint: { "fill-color": accent, "fill-opacity": 0.14 } });
        m.addLayer({ id: `${OUTLINE}-line`, type: "line", source: OUTLINE, layout: { "line-join": "round" }, paint: { "line-color": accent, "line-width": 2.5 } });
        src = m.getSource(OUTLINE) as { setData?: (d: unknown) => void };
      }
      return src;
    };
    if (!preview) {
      if (m.getSource(OUTLINE)) outlineSrc().setData?.(EMPTY);
      fitRef.current(600);
      return;
    }
    extras.current.preview = new ml.Marker({ element: previewEl(preview), anchor: "bottom" }).setLngLat([preview.lng, preview.lat]).addTo(m);
    const duration = reducedMotion() ? 0 : 800;
    const isArea = preview.kind === "area";
    if (isArea && preview.extent) {
      const [w, s, e, n] = preview.extent;
      m.fitBounds([[w, s], [e, n]], { padding: pad, maxZoom: 15.5, duration });
    } else {
      m.flyTo({ center: [preview.lng, preview.lat], zoom: isArea ? 14 : 16, duration, offset: [(pad.left - pad.right) / 2, -(pad.bottom - pad.top) / 2] });
    }
    outlineSrc().setData?.(EMPTY);
    const osm = isArea && preview.osm && /^[RW]/.test(preview.osm) ? preview.osm : null;
    if (!osm) return;
    let live = true;
    const draw = (shape: unknown) => { if (live && shape) outlineSrc().setData?.({ type: "Feature", properties: {}, geometry: shape }); };
    if (outlineCache.has(osm)) draw(outlineCache.get(osm));
    else {
      // Espera um instante: passar rápido pela lista não dispara uma busca por item.
      const t = setTimeout(() => {
        fetch(`/api/geo/outline?osm=${osm}`).then((r) => r.ok ? r.json() : { shape: null }).then((r: { shape: unknown }) => { outlineCache.set(osm, r.shape); draw(r.shape); }).catch(() => {});
      }, 250);
      return () => { live = false; clearTimeout(t); };
    }
    return () => { live = false; };
  }, [previewKey, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Carros por perto
  const carsKey = JSON.stringify(cars ?? []);
  useEffect(() => {
    const m = map.current;
    const ml = lib.current;
    if (!m || !ml || !ready) return;
    const list = cars ?? [];
    const current = extras.current.cars;
    while (current.length > list.length) current.pop()!.remove();
    list.forEach((c, i) => {
      if (current[i]) current[i].setLngLat([c.lng, c.lat]);
      else current.push(new ml.Marker({ element: ambientCarEl(i + 1), anchor: "center" }).setLngLat([c.lng, c.lat]).addTo(m));
    });
  }, [carsKey, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Foco sem pontos: por exemplo, ao trocar de cidade
  const focusKey = focus ? `${focus.lat},${focus.lng},${focus.zoom}` : "";
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !focus || points.length) return;
    // Com inclinação, a troca de cidade é um voo; sem ela, um deslize.
    const opts = { center: [focus.lng, focus.lat] as [number, number], zoom: focus.zoom, pitch: tilt, offset: padding ? [(padding.left - padding.right) / 2, -(padding.bottom - padding.top) / 2] as [number, number] : [0, 0] as [number, number] };
    if (tilt && !reducedMotion()) m.flyTo({ ...opts, duration: 2600, curve: 1.3 });
    else m.easeTo({ ...opts, duration: reducedMotion() ? 0 : 900 });
  }, [focusKey, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Posição da câmera para quem quiser mostrar (no máximo uma vez por quadro).
  const camRef = useRef(onCamera);
  camRef.current = onCamera;
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !camRef.current) return;
    let raf = 0;
    const send = () => { raf = 0; const c = m.getCenter(); camRef.current?.({ lat: c.lat, lng: c.lng, bearing: m.getBearing(), pitch: m.getPitch(), zoom: m.getZoom() }); };
    const on = () => { if (!raf) raf = requestAnimationFrame(send); };
    m.on("move", on);
    send();
    return () => { m.off("move", on); cancelAnimationFrame(raf); };
  }, [ready]);

  // Câmera girando devagar sobre a cidade, enquanto não há trajeto. Para fora da tela, com a aba escondida
  // e por alguns segundos depois que a pessoa mexe no mapa.
  const idleCamera = orbit && !points.length && !(route && route.length > 1) && !preview;
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !idleCamera || reducedMotion() || !box.current) return;
    let raf = 0, last = 0, visible = true, pausedUntil = 0;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(box.current);
    const pause = (e: { originalEvent?: unknown }) => { if (e.originalEvent) pausedUntil = performance.now() + 7000; };
    m.on("dragstart", pause); m.on("zoomstart", pause); m.on("rotatestart", pause); m.on("pitchstart", pause);
    const tick = (now: number) => {
      const dt = last ? Math.min(now - last, 64) : 0;
      last = now;
      if (visible && !document.hidden && now > pausedUntil && !m.isMoving()) m.setBearing(m.getBearing() + dt * 0.0016);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); io.disconnect(); m.off("dragstart", pause); m.off("zoomstart", pause); m.off("rotatestart", pause); m.off("pitchstart", pause); };
  }, [idleCamera, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`relative overflow-hidden bg-[#f2efe9] ${picking ? "map-picking" : ""} ${className}`} data-map-ready={painted ? "1" : "0"}>
      {/* Enquanto o primeiro desenho não termina: fundo com a cor do mapa e um brilho passando. */}
      {!ready && !failed && <div aria-hidden="true" className="map-loading absolute inset-0" />}
      {/* Posição inline: o CSS do MapLibre define position: relative na mesma classe e colapsaria a altura. */}
      <div ref={box} style={{ position: "absolute", inset: 0, opacity: ready ? 1 : 0.001, transition: "opacity .3s ease-out" }} role="application" aria-label={ariaLabel} />
      {children}
      {recenter && ready && (points.length > 0 || (route?.length ?? 0) > 1) && (
        <button type="button" onClick={() => fitRef.current()} aria-label="Centralizar o trajeto no mapa" title="Centralizar"
          className="absolute right-3 bottom-8 z-10 grid size-11 place-items-center rounded-full bg-white text-[#14303a] shadow-[0_6px_18px_-6px_rgb(0_0_0/.45)] hover:bg-[#f1f4f3] md:right-5 md:bottom-10">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" fill="currentColor" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
        </button>
      )}
      {failed && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-[#4b5a60]">
          O mapa não carregou neste aparelho. Você ainda pode digitar os endereços.
        </div>
      )}
    </div>
  );
}
