"use client";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { api } from "@/components/ui";
import type { Place } from "@/components/PlaceSearch";
import { Reveal } from "./Fx";
import { DEST_EVENT } from "./Hero";

/**
 * Destinos conhecidos de cada cidade. Todos foram conferidos na busca de endereços (OpenStreetMap)
 * e ficam dentro da área atendida. Tocar num deles faz dele o destino do pedido no topo da página.
 */
export type Destination = { label: string; query: string; icon: string; note?: string };

export const DESTINATIONS: Record<string, Destination[]> = {
  Ipatinga: [
    { label: "Shopping do Vale do Aço", query: "Shopping do Vale do Aço, Ipatinga", icon: "store" },
    { label: "Hospital Márcio Cunha", query: "Hospital Márcio Cunha, Ipatinga", icon: "hospital" },
    { label: "Rodoviária de Ipatinga", query: "Rodoviária, Ipatinga", icon: "bus" },
    { label: "Parque Ipanema", query: "Parque Ipanema, Ipatinga", icon: "park" },
    { label: "Estádio Ipatingão", query: "Ipatingão, Ipatinga", icon: "stadium" },
    { label: "Aeroporto Regional do Vale do Aço", query: "Aeroporto Regional do Vale do Aço", icon: "airport", note: "Santana do Paraíso" },
  ],
  "Coronel Fabriciano": [
    { label: "Unileste", query: "Unileste, Coronel Fabriciano", icon: "school" },
    { label: "Hospital José Maria de Morais", query: "Hospital Doutor José Maria Morais, Coronel Fabriciano", icon: "hospital" },
    { label: "Praça da Estação", query: "Praça da Estação, Coronel Fabriciano", icon: "park" },
    { label: "Matriz de São Sebastião", query: "Igreja Matriz, Coronel Fabriciano", icon: "church" },
  ],
  "Timóteo": [
    { label: "Aperam", query: "Aperam, Timóteo", icon: "factory" },
    { label: "Hospital Vital Brasil", query: "Hospital Vital Brazil, Timóteo", icon: "hospital" },
    { label: "Prefeitura de Timóteo", query: "Prefeitura, Timóteo", icon: "civic" },
    { label: "Praça 29 de Abril", query: "Praça 29 de Abril, Timóteo", icon: "park" },
  ],
};

export function Destinations({ city }: { city: string }) {
  const list = DESTINATIONS[city] ?? [];
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (!list.length) return null;
  const go = async (d: Destination) => {
    setBusy(d.label); setMsg(null);
    try {
      const r = await api<{ places: Place[] }>(`/api/geo/search?q=${encodeURIComponent(d.query)}`);
      const hit = r.places.find((p) => p.inArea);
      if (!hit) { setMsg(`Não encontramos ${d.label} no mapa agora. Digite o endereço no topo da página.`); return; }
      dispatchEvent(new CustomEvent(DEST_EVENT, { detail: { ...hit, label: hit.kind === "place" || hit.kind === "area" ? hit.label : d.label } }));
    } catch { setMsg("A busca de endereços não respondeu. Tente de novo em instantes."); }
    finally { setBusy(null); }
  };
  return (
    <section aria-labelledby="destinos" className="relative bg-surface text-ink">
      <div className="mx-auto max-w-[1280px] px-5 py-20 md:px-10 md:py-24">
        <Reveal>
          <p className="mono-label text-brand">Destinos de {city}</p>
          <h2 id="destinos" className="display mt-3 text-[clamp(2.2rem,4.8vw,4.2rem)] leading-[.95]">Para onde a cidade vai.</h2>
          <p className="mt-4 max-w-[48ch] text-muted">Toque num lugar e ele vira o destino da sua viagem, com rota e preço estimado.</p>
        </Reveal>
        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((d, i) => (
            <Reveal as="li" key={d.label} delay={i * .05}>
              <button type="button" onClick={() => go(d)} className="dest-card group flex w-full items-center gap-4 rounded-[22px] bg-bg p-4 text-left shadow-[0_0_0_1px_var(--line)_inset] transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_0_0_2px_var(--primary)_inset,0_18px_40px_-24px_rgb(0_0_0/.45)]">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface-2 text-brand transition-colors group-hover:bg-primary group-hover:text-on-primary"><Icon name={d.icon} size={22} weight="duotone" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{busy === d.label ? "Buscando…" : d.label}</span>
                  <span className="block text-sm text-muted">{d.note ?? city}</span>
                </span>
                <span aria-hidden="true" className="text-muted transition-transform group-hover:translate-x-1 group-hover:text-brand"><Icon name="arrow" size={18} /></span>
              </button>
            </Reveal>
          ))}
        </ul>
        <p role="status" className="mt-4 min-h-6 text-sm text-warn">{msg}</p>
      </div>
    </section>
  );
}
