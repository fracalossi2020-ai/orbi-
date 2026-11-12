"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { api } from "@/components/ui";
import { KIND_ICON, KIND_LABEL, type Place } from "@/domain/place";

export type { Place } from "@/domain/place";

/** Destaca no resultado o trecho que a pessoa digitou. */
function Highlight({ text, term }: { text: string; term: string }) {
  const t = term.trim();
  const i = t.length >= 2 ? text.toLowerCase().indexOf(t.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="bg-transparent font-bold text-brand">{text.slice(i, i + t.length)}</mark>{text.slice(i + t.length)}</>;
}

/**
 * Campo de endereço. Só aceita um local escolhido da lista, para a corrida sempre ter coordenadas reais.
 * Reconhece rua, número, lugar e bairro, e avisa o que está fora da área atendida. Funciona pelo teclado.
 */
/** Distância em linha reta, para dar noção de onde fica cada sugestão. */
function distanceLabel(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  const m = 12_742_000 * Math.asin(Math.sqrt(h));
  return m < 950 ? `${Math.max(50, Math.round(m / 50) * 50)} m` : `${(m / 1000).toFixed(m < 9950 ? 1 : 0).replace(".", ",")} km`;
}

export function PlaceSearch({ label, value, onPick, onClear, near, onPreview, inputClassName = "", inputId, autoFocus }: {
  label: string; value: Place | null; onPick: (p: Place) => void; onClear?: () => void; near?: { lat: number; lng: number } | null;
  /** Sugestão em destaque (ao digitar, passar o mouse ou usar as setas), para mostrar no mapa antes da escolha. */
  onPreview?: (p: Place | null) => void;
  inputClassName?: string; inputId?: string; autoFocus?: boolean;
}) {
  const uid = useId();
  const listId = `${uid}-lista`;
  const [q, setQ] = useState(value?.label ?? "");
  const [results, setResults] = useState<Place[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [searched, setSearched] = useState("");
  const [active, setActive] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(0);

  // Texto digitado nunca é apagado por quem está de fora: só um local escolhido o substitui.
  // Exceção: se o local escolhido for removido de fora (botão "Limpar") e o campo ainda mostra o nome dele, o campo esvazia.
  const prev = useRef(value);
  useEffect(() => {
    const before = prev.current;
    prev.current = value;
    if (value) setQ(value.label);
    else if (before) setQ((cur) => (cur === before.label ? "" : cur));
  }, [value]);

  // Prévia no mapa: a sugestão em destaque, ou a primeira da lista enquanto a pessoa digita.
  const previewRef = useRef(onPreview);
  previewRef.current = onPreview;
  const shown = open && searched === q ? results[active >= 0 ? active : 0] ?? null : null;
  const shownKey = shown ? `${shown.lat},${shown.lng},${shown.label}` : "";
  useEffect(() => { previewRef.current?.(shown); }, [shownKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => previewRef.current?.(null), []);

  const search = (text: string) => {
    setQ(text);
    setActive(-1);
    if (value && text !== value.label) onClear?.();
    clearTimeout(timer.current);
    if (text.trim().length < 3) { setResults([]); setSearched(""); setLoading(false); setOpen(false); return; }
    setLoading(true);
    const request = ++latest.current;
    timer.current = setTimeout(async () => {
      try {
        const around = near ? `&lat=${near.lat}&lng=${near.lng}` : "";
        const r = await api<{ places: Place[] }>(`/api/geo/search?q=${encodeURIComponent(text)}${around}`);
        // Resposta atrasada de uma busca antiga não substitui a mais recente.
        if (request !== latest.current) return;
        setResults(r.places); setErr(null); setSearched(text); setOpen(true);
      } catch (e) { if (request === latest.current) { setErr((e as Error).message); setResults([]); } }
      finally { if (request === latest.current) setLoading(false); }
    }, 350);
  };

  const choose = (p: Place) => { setQ(p.label); setOpen(false); setActive(-1); onPick(p); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!results.length) return;
      e.preventDefault();
      setOpen(true);
      setActive((i) => (e.key === "ArrowDown" ? (i + 1) % results.length : (i <= 0 ? results.length - 1 : i - 1)));
    } else if (e.key === "Enter" && open && results.length && searched === q) {
      e.preventDefault();
      choose(results[active >= 0 ? active : 0]);
    } else if (e.key === "Escape") setOpen(false);
  };

  const empty = open && !loading && searched === q && results.length === 0 && !err;
  // Sugestões de uma busca antiga não aparecem enquanto a nova não chega: evita tocar no lugar errado.
  const fresh = searched === q;
  return (
    <div className="relative">
      <label className="block"><span className="sr-only">{label}</span>
        <input id={inputId} className={`input ${inputClassName}`} placeholder={label} aria-label={label} value={q} autoComplete="off" autoFocus={autoFocus}
          role="combobox" aria-expanded={open && (results.length > 0 || empty)} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={active >= 0 ? `${uid}-op-${active}` : undefined}
          onChange={(e) => search(e.target.value)} onKeyDown={onKey} onFocus={() => { setFocused(true); if (results.length) setOpen(true); }} onBlur={() => { setFocused(false); setTimeout(() => setOpen(false), 150); }} />
      </label>
      <span className="sr-only" role="status">{loading ? "Procurando endereços" : open && results.length ? `${results.length} resultados` : ""}</span>
      {err && <p className="mt-1 text-xs text-danger">{err}</p>}
      {/* Busca em andamento: a pessoa vê que algo está acontecendo, mesmo quando o serviço demora. */}
      {loading && focused && !(open && fresh && results.length > 0) && (
        <div aria-hidden="true" className="card absolute inset-x-0 top-full z-30 mt-1.5 flex items-center gap-3 px-4 py-3 text-sm text-muted">
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Procurando “{q.trim()}”…
        </div>
      )}
      <div id={listId} role="listbox" aria-label={`Sugestões para ${label}`} className={open && fresh && (results.length > 0 || empty) ? "card absolute inset-x-0 top-full z-30 mt-1.5 max-h-80 overflow-auto p-1.5 text-ink" : "hidden"}>
        {results.map((r, i) => {
          const kind = r.kind ?? "place";
          return (
            <div key={`${r.lat}-${r.lng}-${i}`} id={`${uid}-op-${i}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()} onClick={() => choose(r)} onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 ${i === active ? "bg-surface-2" : ""} ${r.inArea === false ? "opacity-60" : ""}`}>
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-brand"><Icon name={KIND_ICON[kind]} size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold"><Highlight text={r.label} term={q} /></span>
                <span className="block truncate text-xs text-muted">{r.approx ? "Posição aproximada na rua" : KIND_LABEL[kind]}{r.detail ? ` · ${r.detail}` : ""}</span>
              </span>
              {near && r.inArea !== false && <span className="num mt-1 shrink-0 text-xs font-semibold text-muted">{distanceLabel(near, r)}</span>}
              {r.inArea === false && <span className="mt-1 shrink-0 rounded-full bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-warn">Fora da área</span>}
            </div>
          );
        })}
        {empty && <p className="px-3 py-3 text-sm text-muted">Não encontramos esse endereço. Tente o nome da rua com o número, ou o nome do lugar.</p>}
      </div>
    </div>
  );
}
