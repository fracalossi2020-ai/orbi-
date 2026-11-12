"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { isDarkNow, saveTheme } from "@/lib/theme";

// ------------------------------------------------------------------ dados

export async function api<T = any>(url: string, init?: { method?: string; body?: unknown }): Promise<T> { // eslint-disable-line
  const res = await fetch(url, {
    method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Não foi possível concluir. Verifique a conexão e tente de novo.");
  return data;
}

// Uma única conexão SSE por aba, compartilhada por todos os hooks.
const listeners = new Set<(topic: string) => void>();
let source: EventSource | null = null;
function subscribeLive(fn: (topic: string) => void) {
  listeners.add(fn);
  if (!source) {
    source = new EventSource("/api/events");
    source.onmessage = (e) => { if (e.data !== "ping" && e.data !== "hello") listeners.forEach((l) => l(e.data)); };
  }
  return () => {
    listeners.delete(fn);
    if (!listeners.size && source) { source.close(); source = null; }
  };
}

/** Busca um recurso e refaz a busca quando o servidor avisa que algo mudou. */
export function useLive<T = any>(url: string | null, opts: { live?: boolean; intervalMs?: number } = {}) { // eslint-disable-line
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const urlRef = useRef(url);
  urlRef.current = url;

  const reload = useCallback(async () => {
    if (!urlRef.current) return;
    try {
      const d = await api<T>(urlRef.current);
      setData(d);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [url, reload]);

  useEffect(() => {
    if (opts.live === false) return;
    const unsub = subscribeLive(() => reload());
    const timer = setInterval(reload, opts.intervalMs ?? 15000);
    return () => { unsub(); clearInterval(timer); };
  }, [reload, opts.live, opts.intervalMs]);

  return { data, error, loading, reload, setData };
}

// ------------------------------------------------------------------ componentes

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="rounded-xl px-3 py-2 text-sm font-medium text-danger" style={{ background: "color-mix(in srgb, var(--danger) 10%, transparent)" }}>{children}</p>;
}

export function Note({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "warn" | "ok" }) {
  const color = tone === "warn" ? "var(--warn)" : tone === "ok" ? "var(--ok)" : "var(--muted)";
  return <p className="rounded-xl px-3 py-2 text-sm" style={{ color: tone === "neutral" ? "var(--muted)" : color, background: `color-mix(in srgb, ${color} 11%, transparent)` }}>{children}</p>;
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "ok" | "warn" | "danger" | "brand" }) {
  const color = { neutral: "var(--muted)", ok: "var(--ok)", warn: "var(--warn)", danger: "var(--danger)", brand: "var(--brand-text, var(--primary))" }[tone];
  return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap" style={{ color, background: `color-mix(in srgb, ${color} 13%, transparent)` }}>{children}</span>;
}

export function Empty({ icon = "route", title, children }: { icon?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-surface-2 text-muted"><Icon name={icon} size={28} weight="duotone" /></span>
      <p className="font-semibold">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Spinner({ label = "Carregando" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex justify-center py-10 text-brand">
      <div className="anim-swing"><svg width="20" height="44" viewBox="0 0 20 44" aria-hidden="true"><path d="M10 0v22" stroke="currentColor" strokeWidth="1.5" /><path d="M10 44c-4-5-7-7.800-7-12a7 7 0 0 1 14 0c0 4.200-3 7-7 12Z" fill="currentColor" /></svg></div>
    </div>
  );
}

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try { return await fn(); }
    catch (e) { setError((e as Error).message); return undefined; }
    finally { setBusy(false); }
  }, []);
  return { busy, error, run, setError };
}

export function Stars({ value, onChange, size = 30 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <div className="flex gap-1" role={onChange ? "radiogroup" : "img"} aria-label={onChange ? "Avaliação" : `${value} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        onChange
          ? <button key={n} type="button" role="radio" aria-checked={n === value} aria-label={`${n} estrela${n > 1 ? "s" : ""}`} onClick={() => onChange(n)} className="p-1 transition-transform hover:scale-110">
              <span style={{ color: n <= value ? "var(--primary)" : "var(--line)" }}><svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 3.500 2.600 5.400 5.900.8-4.300 4.100 1 5.900-5.200-2.800-5.200 2.800 1-5.900L3.500 9.700l5.900-.8L12 3.500Z" /></svg></span>
            </button>
          : <span key={n} style={{ color: n <= Math.round(value) ? "var(--primary)" : "var(--line)" }}><svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 3.500 2.600 5.400 5.900.8-4.300 4.100 1 5.900-5.200-2.800-5.200 2.800 1-5.900L3.500 9.700l5.900-.8L12 3.500Z" /></svg></span>
      ))}
    </div>
  );
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(isDarkNow()), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    saveTheme(next ? "dark" : "light");
  };
  return (
    <button type="button" onClick={toggle} aria-label={dark ? "Usar modo claro" : "Usar modo escuro"} className={`grid size-11 place-items-center rounded-full transition-colors hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)] ${className}`}>
      <Icon name={dark ? "sun" : "moon"} size={20} />
    </button>
  );
}

export const dateTime = (d: string | Date | null | undefined) => d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
export const km = (m: number) => `${(m / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
export const mins = (s: number) => `${Math.max(1, Math.round(s / 60))} min`;
export const pct = (bps: number) => `${(bps / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
export const METHOD_LABEL: Record<string, string> = { cash: "Dinheiro", pix: "Pix pelo app", card: "Cartão pelo app", pix_driver: "Pix para o motorista", card_machine: "Maquininha" };
