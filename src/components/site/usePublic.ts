"use client";
import { useEffect, useState } from "react";
import type { CityPulse, PublicCity } from "@/server/public-data";
import { findRegion } from "@/domain/geo";

export type { CityPulse, PublicCity };

// Uma busca por visita para cada tipo de dado; várias partes da página usam a mesma resposta.
const cache = new Map<string, Promise<unknown>>();
function load<T>(what: string, ttlMs = 0): Promise<T> {
  const key = what;
  if (!cache.has(key)) {
    const p = fetch(`/api/public/${what}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
    p.catch(() => cache.delete(key));
    cache.set(key, p);
    if (ttlMs) setTimeout(() => cache.delete(key), ttlMs);
  }
  return cache.get(key) as Promise<T>;
}

/** Tarifas como estão no painel, por cidade ativa. */
export function useTariffs() {
  const [cities, setCities] = useState<PublicCity[] | null>(null);
  useEffect(() => { load<{ cities: PublicCity[] }>("tariffs").then((r) => setCities(r.cities)).catch(() => setCities([])); }, []);
  return cities;
}

/** Motoristas online agora (só a contagem), atualizado a cada 30 s. */
export function usePulse() {
  const [pulse, setPulse] = useState<CityPulse[] | null>(null);
  useEffect(() => {
    let live = true;
    const get = () => load<{ cities: CityPulse[] }>("pulse", 25_000).then((r) => { if (live) setPulse(r.cities); }).catch(() => {});
    get();
    const t = setInterval(get, 30_000);
    return () => { live = false; clearInterval(t); };
  }, []);
  return pulse;
}

export function useSupport() {
  const [s, setS] = useState<{ whatsapp: string } | null>(null);
  useEffect(() => { load<{ whatsapp: string }>("support").then(setS).catch(() => setS({ whatsapp: "" })); }, []);
  return s;
}

/** Cidade atendida onde fica um ponto. */
export const cityOf = (p: { lat: number; lng: number }, cities: PublicCity[]) => findRegion(p, cities.map((c) => ({ ...c, active: true })));

/** Texto do pulso: número real de motoristas online, ou o horário de pico quando não há ninguém agora. */
export function pulseText(p: CityPulse | undefined, cityName: string) {
  if (!p) return null;
  if (p.online > 0) return `${p.online} ${p.online === 1 ? "motorista online" : "motoristas online"} agora em ${cityName}`;
  if (p.peak) return `Mais motoristas em ${cityName} entre ${p.peak.from}h e ${p.peak.to}h`;
  return null;
}
