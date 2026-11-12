"use client";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { PlaceSearch } from "@/components/PlaceSearch";
import { api, ErrorNote, Spinner, useAction, useLive } from "@/components/ui";
import type { Place } from "@/domain/place";

export type SavedPlace = { id: string; kind: "home" | "work" | "other"; name: string; label: string; detail: string | null; lat: number; lng: number };

const KIND_ICON = { home: "home", work: "briefcase", other: "star" } as const;

export function useSavedPlaces() {
  const { data, reload } = useLive<{ places: SavedPlace[] }>("/api/places", { live: false });
  return { places: data?.places ?? null, reload };
}

export const toPlace = (s: { label: string; detail?: string | null; lat: number; lng: number }): Place => ({ label: s.label, detail: s.detail ?? undefined, lat: s.lat, lng: s.lng });

/**
 * Atalhos de destino: casa, trabalho, outros locais salvos e os últimos destinos reais das suas viagens.
 * Nada aqui é sugestão inventada: sem viagens e sem locais salvos, só aparece o convite para salvar.
 */
export function Shortcuts({ places, recent, onPick }: { places: SavedPlace[] | null; recent: Place[]; onPick: (p: Place) => void }) {
  if (!places) return null;
  const home = places.find((p) => p.kind === "home");
  const work = places.find((p) => p.kind === "work");
  const others = places.filter((p) => p.kind === "other");
  const savedKeys = new Set(places.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`));
  const recents = recent.filter((r) => !savedKeys.has(`${r.lat.toFixed(4)},${r.lng.toFixed(4)}`)).slice(0, 3);
  return (
    <div className="space-y-2" data-testid="shortcuts">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {[{ kind: "home" as const, saved: home, name: "Casa" }, { kind: "work" as const, saved: work, name: "Trabalho" }].map(({ kind, saved, name }) => saved ? (
          <button key={kind} type="button" onClick={() => onPick(toPlace(saved))} className="flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-surface-2 py-1.5 pr-4 pl-1.5 text-sm font-semibold hover:bg-[color-mix(in_srgb,var(--primary)_12%,var(--surface-2))]">
            <span className="grid size-8 place-items-center rounded-full bg-primary text-on-primary"><Icon name={KIND_ICON[kind]} size={16} weight="fill" /></span>{name}
          </button>
        ) : (
          <a key={kind} href="/passageiro/conta#locais" className="flex min-h-11 shrink-0 items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 text-sm text-muted shadow-[0_0_0_1px_var(--line)_inset] hover:text-ink">
            <span className="grid size-8 place-items-center rounded-full bg-surface-2"><Icon name="plus" size={16} /></span>Salvar {name.toLowerCase()}
          </a>
        ))}
        {others.map((o) => (
          <button key={o.id} type="button" onClick={() => onPick(toPlace(o))} className="flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-surface-2 py-1.5 pr-4 pl-1.5 text-sm font-semibold">
            <span className="grid size-8 place-items-center rounded-full bg-surface text-brand"><Icon name="star" size={16} weight="fill" /></span>{o.name}
          </button>
        ))}
      </div>
      {recents.length > 0 && (
        <ul aria-label="Destinos recentes" className="divide-y divide-line">
          {recents.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button type="button" onClick={() => onPick(r)} className="flex min-h-12 w-full items-center gap-3 py-2 text-left">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2"><Icon name="history" size={18} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{r.label}</span><span className="block text-xs text-muted">Viagem recente</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Depois de escolher um destino: salvar como casa ou trabalho com um toque. */
export function SaveAs({ place, places, onSaved }: { place: Place; places: SavedPlace[] | null; onSaved: () => void }) {
  const { busy, error, run } = useAction();
  const [done, setDone] = useState<string | null>(null);
  if (!places) return null;
  const same = places.find((p) => Math.abs(p.lat - place.lat) < 1e-4 && Math.abs(p.lng - place.lng) < 1e-4);
  if (same) return <p className="flex items-center gap-1.5 text-xs text-muted"><Icon name={KIND_ICON[same.kind]} size={14} weight="fill" className="text-brand" />Salvo como {same.name}</p>;
  if (done) return <p className="text-xs text-ok">Salvo como {done}.</p>;
  const save = (kind: "home" | "work", name: string) => run(async () => {
    await api("/api/places", { body: { kind, label: place.label, detail: place.detail ?? null, lat: place.lat, lng: place.lng } });
    setDone(name);
    onSaved();
  });
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted">Salvar como</span>
      <button type="button" disabled={busy} className="btn btn-ghost btn-sm !min-h-9 !px-3" onClick={() => save("home", "Casa")}><Icon name="home" size={14} />Casa</button>
      <button type="button" disabled={busy} className="btn btn-ghost btn-sm !min-h-9 !px-3" onClick={() => save("work", "Trabalho")}><Icon name="briefcase" size={14} />Trabalho</button>
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}

/** Na conta: ver, trocar e apagar os locais salvos. */
export function SavedPlacesCard() {
  const { places, reload } = useSavedPlaces();
  const { busy, error, run } = useAction();
  const [adding, setAdding] = useState<"home" | "work" | "other" | null>(null);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Place | null>(null);
  const reset = () => { setAdding(null); setName(""); setPicked(null); };
  // O botão fica sempre ativo: se faltar algo, diz o quê (botão apagado sem motivo parece quebrado).
  const save = () => run(async () => {
    if (!adding) return;
    if (adding === "other" && name.trim().length < 2) throw new Error("Dê um nome ao local, por exemplo Academia.");
    if (!picked) throw new Error("Digite o endereço (rua e número ou nome do lugar) e toque numa das sugestões da lista.");
    await api("/api/places", { body: { kind: adding, name: adding === "other" ? name : undefined, label: picked.label, detail: picked.detail ?? null, lat: picked.lat, lng: picked.lng } });
    reset();
    reload();
  });
  const remove = (id: string) => run(async () => { await api(`/api/places?id=${id}`, { method: "DELETE" }); reload(); });
  const slots = [{ kind: "home" as const, name: "Casa" }, { kind: "work" as const, name: "Trabalho" }];
  return (
    <section id="locais" className="card scroll-mt-24 space-y-3 p-5">
      <h2 className="display text-xl">Locais salvos</h2>
      <p className="text-sm text-muted">Aparecem como atalho na hora de pedir. Ficam só na sua conta.</p>
      {!places ? <Spinner /> : (
        <ul className="divide-y divide-line">
          {slots.map(({ kind, name: label }) => {
            const p = places.find((x) => x.kind === kind);
            return (
              <li key={kind} className="flex items-center gap-3 py-2.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-brand"><Icon name={KIND_ICON[kind]} size={20} weight="duotone" /></span>
                <span className="min-w-0 flex-1"><span className="block font-semibold">{label}</span><span className="block truncate text-sm text-muted">{p ? p.label : "Não salvo"}</span></span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { reset(); setAdding(kind); }}>{p ? "Trocar" : "Adicionar"}</button>
                {p && <button type="button" className="grid size-11 place-items-center rounded-full hover:bg-surface-2" disabled={busy} onClick={() => remove(p.id)} aria-label={`Apagar ${label}`}><Icon name="close" size={18} /></button>}
              </li>
            );
          })}
          {places.filter((p) => p.kind === "other").map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-brand"><Icon name="star" size={20} weight="duotone" /></span>
              <span className="min-w-0 flex-1"><span className="block font-semibold">{p.name}</span><span className="block truncate text-sm text-muted">{p.label}</span></span>
              <button type="button" className="grid size-11 place-items-center rounded-full hover:bg-surface-2" disabled={busy} onClick={() => remove(p.id)} aria-label={`Apagar ${p.name}`}><Icon name="close" size={18} /></button>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <div className="space-y-2 rounded-2xl bg-surface-2 p-3">
          {adding === "other" && (
            <label className="block"><span className="mb-1 block text-sm font-semibold">Nome</span>
              <input className="input" maxLength={40} placeholder="Academia, casa da mãe…" value={name} onChange={(e) => setName(e.target.value)} /></label>
          )}
          <div>
            <p className="mb-1 text-sm font-semibold">{adding === "home" ? "Endereço da sua casa" : adding === "work" ? "Endereço do seu trabalho" : "Endereço"}</p>
            <PlaceSearch label={adding === "home" ? "Rua e número da sua casa" : adding === "work" ? "Rua e número do trabalho" : "Rua e número ou nome do lugar"} value={picked} onPick={setPicked} onClear={() => setPicked(null)} />
            <p className="mt-1 text-xs text-muted">{picked ? `Escolhido: ${picked.label}${picked.detail ? ` · ${picked.detail}` : ""}` : "Digite e toque numa das sugestões que aparecem."}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={save}>{busy ? "Salvando…" : "Salvar local"}</button>
            <button type="button" className="btn btn-ghost" onClick={reset}>Cancelar</button>
          </div>
        </div>
      ) : places && <button type="button" className="btn btn-soft w-full" onClick={() => setAdding("other")}><Icon name="plus" size={18} />Adicionar outro local</button>}
      <ErrorNote>{error}</ErrorNote>
    </section>
  );
}
