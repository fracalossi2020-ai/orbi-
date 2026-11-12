"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/components/ui";

/**
 * Rastreamento pelo GPS do celular do motorista (iPhone ou Android), pelo navegador.
 * Não usa o IP: a localização por IP aponta a central da operadora e erra por quilômetros (no 4G, às vezes outra cidade).
 * No 4G funciona igual ao Wi-Fi: a posição vem dos satélites (GPS); a internet só leva as coordenadas, poucos bytes.
 * Quando o sinal cai (túnel, área sem cobertura), a última posição fica guardada e é enviada assim que a conexão volta.
 *
 * - Envia a posição a cada 4 s, ou antes se o carro andou mais de 15 m; sempre a cada 20 s, mesmo parado.
 * - Manda junto a direção do movimento e a precisão informadas pelo aparelho.
 * - Mantém a tela acesa enquanto está online (o celular corta o GPS de páginas com a tela apagada).
 * - Avisa quando o app vai para segundo plano: nesse caso o sistema do celular pausa o GPS do navegador.
 */
export type GpsFix = { lat: number; lng: number; accuracy: number | null; heading: number | null; at: number };
export type GpsState = {
  fix: GpsFix | null; error: string | null; hidden: boolean; screenOn: boolean;
  /** Sem internet (4G caiu, túnel, área sem sinal): a posição fica guardada e vai assim que a conexão voltar. */
  offline: boolean;
  /** A última posição ainda não chegou ao servidor. */
  pending: boolean;
  /** "iPhone", "Android" ou "este aparelho", para as instruções de permissão. */
  device: "iPhone" | "Android" | "este aparelho";
};

const R = 6371000;
const meters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

function detectDevice(): GpsState["device"] {
  if (typeof navigator === "undefined") return "este aparelho";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iPhone";
  if (/Android/.test(ua)) return "Android";
  return "este aparelho";
}

/** Explica como liberar a localização no aparelho da pessoa. */
export function permissionHelp(device: GpsState["device"]) {
  if (device === "iPhone") return "No iPhone: Ajustes › Privacidade e Segurança › Serviços de Localização › Safari (ou o navegador que você usa) › Ao Usar o App, e ative Localização Precisa.";
  if (device === "Android") return "No Android: toque no cadeado ao lado do endereço › Permissões › Local › Permitir. Confira também se a Localização do celular está ligada, no modo de alta precisão.";
  return "Permita o acesso à localização nas configurações do navegador.";
}

export function useDriverGps(active: boolean, onFix?: (f: GpsFix) => void): GpsState {
  const [fix, setFix] = useState<GpsFix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [device] = useState(detectDevice);
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(false);
  const last = useRef<{ at: number; lat: number; lng: number } | null>(null);
  // Última posição que não conseguiu sair (sem internet): enviada assim que a conexão voltar.
  const queued = useRef<GpsFix | null>(null);
  const cb = useRef(onFix);
  cb.current = onFix;

  // Conexão: o 4G cai em túneis e áreas sem sinal. O GPS continua funcionando sem internet (vem dos satélites).
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const on = () => setOffline(!navigator.onLine);
    on();
    addEventListener("online", on);
    addEventListener("offline", on);
    return () => { removeEventListener("online", on); removeEventListener("offline", on); };
  }, []);

  // GPS contínuo
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) { setError("Este aparelho não oferece GPS ao navegador."); return; }
    const send = (f: GpsFix) => {
      last.current = { at: f.at, lat: f.lat, lng: f.lng };
      if (!navigator.onLine) { queued.current = f; setPending(true); return; }
      api("/api/driver/location", { body: { lat: f.lat, lng: f.lng, heading: f.heading, accuracy: f.accuracy } })
        .then(() => { if (queued.current === f) queued.current = null; setPending(false); })
        .catch(() => { queued.current = f; setPending(true); });
    };
    // A conexão voltou: manda na hora a posição mais recente que ficou guardada.
    const flush = () => { const q = queued.current; if (q) send({ ...q, at: Date.now() }); };
    addEventListener("online", flush);
    const retry = setInterval(flush, 10_000);
    const id = navigator.geolocation.watchPosition((pos) => {
      const c = pos.coords;
      const f: GpsFix = {
        lat: c.latitude, lng: c.longitude, at: Date.now(),
        accuracy: Number.isFinite(c.accuracy) ? c.accuracy : null,
        // Parado, o aparelho não sabe a direção: mantém a última conhecida.
        heading: c.heading != null && Number.isFinite(c.heading) && (c.speed ?? 0) > 0.5 ? c.heading : null,
      };
      setFix((prev) => ({ ...f, heading: f.heading ?? prev?.heading ?? null }));
      setError(null);
      cb.current?.(f);
      const prev = last.current;
      if (!prev || f.at - prev.at > 4000 || meters(prev, f) > 15) send({ ...f, heading: f.heading });
    }, (e) => {
      setError(e.code === e.PERMISSION_DENIED ? "Sem permissão para usar a localização." : e.code === e.TIMEOUT ? "O GPS está demorando para responder. Vá para um lugar aberto." : "Não foi possível ler o GPS agora.");
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    // Parado no ponto: renova o sinal para a posição não ser considerada antiga.
    const keep = setInterval(() => {
      if (last.current && Date.now() - last.current.at > 20000 && navigator.onLine) {
        const p = last.current;
        api("/api/driver/location", { body: { lat: p.lat, lng: p.lng } }).catch(() => undefined);
        last.current = { ...p, at: Date.now() };
      }
    }, 5000);
    return () => { navigator.geolocation.clearWatch(id); clearInterval(keep); clearInterval(retry); removeEventListener("online", flush); };
  }, [active]);

  // Tela acesa enquanto online (iPhone com iOS 16.4+ e Android com Chrome). Volta a pedir ao retornar ao app.
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stop = false;
    const ask = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
        setScreenOn(true);
        lock.addEventListener("release", () => setScreenOn(false));
      } catch { setScreenOn(false); }
    };
    const onVis = () => { setHidden(document.hidden); if (!document.hidden && !stop) void ask(); };
    void ask();
    document.addEventListener("visibilitychange", onVis);
    return () => { stop = true; document.removeEventListener("visibilitychange", onVis); void lock?.release().catch(() => undefined); setScreenOn(false); };
  }, [active]);

  return { fix, error, hidden, screenOn, device, offline, pending };
}
