"use client";
import { MapView } from "@/components/LazyMap";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { RideChat, type Message } from "@/components/app/RideChat";
import { api, ErrorNote, km, METHOD_LABEL, mins, Note, Spinner, Stars, useAction, useLive } from "@/components/ui";
import type { MapEndLabels, MapPoint, MapPreview } from "@/components/MapView";
import { PlaceSearch, type Place } from "@/components/PlaceSearch";
import { PlacePreview } from "@/components/PlacePreview";
import { CarArt, MotoArt } from "@/components/VehicleArt";
import { SaveAs, Shortcuts, useSavedPlaces } from "@/components/app/SavedPlaces";
import { brl } from "@/domain/pricing";
import { KIND_LABEL } from "@/domain/place";
import { METHOD_INFO, type PaymentMethod } from "@/domain/payment-methods";
import { PixPay } from "@/components/app/PixPay";

/** Ordem em que as formas aparecem: primeiro as que funcionam hoje. */
const METHOD_ORDER: PaymentMethod[] = ["pix_driver", "cash", "card_machine", "pix", "card"];


const greeting = () => { const h = new Date().getHours(); return h < 5 ? "Boa noite" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; };

/** Hora prevista, por exemplo "14:52". */
const clock = (inS: number) => new Date(Date.now() + inS * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Computador: o painel flutua à esquerda, então o mapa enquadra o trajeto na parte livre. */
function useWide(minPx = 768) {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = matchMedia(`(min-width: ${minPx}px)`);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [minPx]);
  return wide;
}

type Option = { categoryId: string; slug: string; name: string; description: string; seats: number; grossCents: number; serviceFeeCents: number; discountCents: number; totalCents: number; pickupEtaS: number | null; driversAvailable: number };
type Quote = {
  region: { name: string }; route: { distanceM: number; durationS: number; geometry: [number, number][]; source: string }; options: Option[]; couponApplied: boolean;
  payment: Record<PaymentMethod, { available: boolean; note: string }>;
  /** Motoristas online agora que recebem por Pix na chave e por maquininha. */
  acceptingNow: { pix_driver: number; card_machine: number };
};
type Ride = {
  id: string; status: string; statusLabel: string; categoryName: string; origin: Place; dest: Place; stops: Place[]; scheduledFor: string | null; geometry: [number, number][]; routeSource: string; distanceM: number; durationS: number;
  driver: { name: string; rating: number | null; ratingCount: number; lat: number | null; lng: number | null; hasPhoto: boolean; heading: number | null; accuracyM: number | null; locationAt: string | null } | null;
  driverPix: { key: string; keyType: string | null; payload: string; name: string } | null;
  vehicle: { make: string; model: string; color: string; plate: string } | null;
  rider: { name: string; phone: string | null } | null;
  totalCents: number; grossCents: number; serviceFeeCents: number; discountCents: number; paymentMethod: string; paymentStatus: string; pixCopyPaste: string | null; messages: Message[]; shareToken: string; myRating: number | null;
};

type Pick = "origin" | "dest" | `stop${number}`;
type Stop = { id: number; place: Place | null };

/** Data para o campo datetime-local, no fuso do aparelho. */
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
export const whenLabel = (iso: string) => {
  const s = new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const MAX_STOPS = 2;

type MapState = {
  points: MapPoint[]; route: [number, number][] | null; onPick?: (p: { lat: number; lng: number }) => void; picking?: boolean;
  preview?: MapPreview | null; routeLabel?: { main: string; sub?: string } | null;
  /** Etiquetas na partida ("De …", com o tempo até o motorista chegar) e no destino ("Para …", com a hora de chegada). */
  endLabels?: MapEndLabels | null;
  /** Onde procurar carros por perto: a partida ou o GPS. */
  center?: { lat: number; lng: number } | null;
};

const toPreview = (p: Place | null): MapPreview | null => p && {
  lat: p.lat, lng: p.lng, label: p.label, kind: p.kind, osm: p.osm, extent: p.extent,
  detail: [p.kind ? KIND_LABEL[p.kind] : undefined, p.detail].filter(Boolean).join(" · ") || undefined,
};

/** Celular digitado de qualquer jeito, mostrado como (31) 99999-9999. */
const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d && `(${d}`;
  const split = d.length === 11 ? 7 : 6;
  return d.length <= split ? `(${d.slice(0, 2)}) ${d.slice(2)}` : `(${d.slice(0, 2)}) ${d.slice(2, split)}-${d.slice(split)}`;
};

function RequestPanel({ onCreated, setMapState, recent, firstName, wide3 = false }: { onCreated: () => void; setMapState: (s: MapState) => void; recent: Place[]; firstName?: string; wide3?: boolean }) {
  const [origin, setOrigin] = useState<Place | null>(null);
  // Sugestão em destaque na busca, mostrada no mapa antes da escolha.
  const [preview, setPreview] = useState<Place | null>(null);
  const [dest, setDest] = useState<Place | null>(null);
  const [picking, setPicking] = useState<Pick | null>(null);
  // Paradas entre a partida e o destino final (até duas), na ordem do trajeto.
  const [stops, setStops] = useState<Stop[]>([]);
  const stopSeq = useRef(0);
  // Quando: agora ou num dia e hora escolhidos.
  const [when, setWhen] = useState<"now" | "later">("now");
  const [at, setAt] = useState("");
  const [booked, setBooked] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [coupon, setCoupon] = useState("");
  const [gpsNote, setGpsNote] = useState<string | null>(null);
  const [askLocation, setAskLocation] = useState(false);
  const [editing, setEditing] = useState(false);
  // Onde o GPS diz que a pessoa está: o prumo pulsa ali no mapa.
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  // Para quem é a corrida: a própria conta ou outra pessoa, com nome e celular para o motorista.
  const [forOther, setForOther] = useState(false);
  const [riderName, setRiderName] = useState("");
  const [riderPhone, setRiderPhone] = useState("");
  const saved = useSavedPlaces();
  const filledStops = stops.map((s) => s.place).filter((p): p is Place => !!p);
  const stopsKey = filledStops.map((p) => `${p.lat},${p.lng}`).join(";");
  const setStop = (id: number, place: Place | null) => setStops((all) => all.map((s) => (s.id === id ? { ...s, place } : s)));
  const addStop = () => setStops((all) => (all.length >= MAX_STOPS ? all : [...all, { id: ++stopSeq.current, place: null }]));
  const removeStop = (id: number) => setStops((all) => all.filter((s) => s.id !== id));
  const { busy, error, run, setError } = useAction();

  const placeFromCoords = async (p: { lat: number; lng: number }): Promise<Place> => {
    try {
      const r = await api<{ place: Place | null; inArea: boolean }>(`/api/geo/reverse?lat=${p.lat}&lng=${p.lng}`);
      return r.place ? { ...r.place, ...p } : { label: "Ponto no mapa", ...p, inArea: r.inArea };
    } catch { return { label: "Ponto no mapa", ...p }; }
  };

  const locate = () => {
    if (!navigator.geolocation) { setGpsNote("Este aparelho não oferece GPS. Digite o endereço ou marque no mapa."); return; }
    setGpsNote("Buscando sua localização…");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGps(here);
        setOrigin(await placeFromCoords(here));
        setGpsNote(null);
      },
      () => setGpsNote("Não foi possível usar o GPS. Digite o endereço ou marque no mapa."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  // O pedido do sistema só aparece depois de explicar o motivo. Quem preferiu digitar não é perguntado de novo.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Trajeto digitado no site antes de entrar na conta.
    try {
      const saved = sessionStorage.getItem("prumo-trip");
      if (saved) {
        sessionStorage.removeItem("prumo-trip");
        const trip = JSON.parse(saved) as { origin: Place | null; dest: Place | null };
        if (trip.dest) setDest(trip.dest);
        if (trip.origin) { setOrigin(trip.origin); return; }
      }
    } catch { /* armazenamento bloqueado */ }
    let declined = false;
    try { declined = localStorage.getItem("prumo-location-declined") === "1"; } catch { /* armazenamento bloqueado */ }
    if (!navigator.permissions) { locate(); return; }
    navigator.permissions.query({ name: "geolocation" }).then(
      (s) => { if (s.state !== "prompt") locate(); else if (!declined) setAskLocation(true); },
      () => locate(),
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (quote) setEditing(false); }, [quote]);
  const declineLocation = () => {
    setAskLocation(false);
    try { localStorage.setItem("prumo-location-declined", "1"); } catch { /* armazenamento bloqueado */ }
  };

  useEffect(() => {
    if (!origin || !dest) { setQuote(null); return; }
    run(async () => {
      const q = await api<Quote>("/api/rides?quote", { body: { origin, dest, stops: filledStops, couponCode: coupon || null } });
      setQuote(q);
      setCategory((c) => (c && q.options.some((o) => o.categoryId === c) ? c : q.options[0]?.categoryId ?? null));
      // Se a forma escolhida foi desligada no painel, passa para a primeira disponível.
      setMethod((m) => (q.payment[m]?.available ? m : METHOD_ORDER.find((x) => q.payment[x]?.available) ?? m));
    });
  }, [origin?.lat, origin?.lng, dest?.lat, dest?.lng, stopsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyCoupon = () => {
    if (!origin || !dest) return;
    run(async () => setQuote(await api<Quote>("/api/rides?quote", { body: { origin, dest, stops: filledStops, couponCode: coupon || null } })));
  };

  // Se a partida é onde o GPS está, ela vira o prumo do GPS; senão os dois aparecem.
  const originIsGps = !!(gps && origin && Math.abs(gps.lat - origin.lat) < 1e-6 && Math.abs(gps.lng - origin.lng) < 1e-6);
  const points = useMemo<MapPoint[]>(() => [
    ...(gps && !originIsGps ? [{ id: "me", kind: "me" as const, ...gps }] : []),
    ...(origin ? [{ id: "origin", kind: originIsGps ? "me" as const : "origin" as const, lat: origin.lat, lng: origin.lng }] : []),
    ...filledStops.map((p, i) => ({ id: `stop${i}`, kind: "stop" as const, lat: p.lat, lng: p.lng })),
    ...(dest ? [{ id: "dest", kind: "dest" as const, lat: dest.lat, lng: dest.lng }] : []),
  ], [origin, dest, gps, originIsGps, stopsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const pickRef = useRef(picking);
  pickRef.current = picking;
  useEffect(() => {
    setMapState({
      points, route: quote?.route.geometry ?? null, picking: !!picking,
      preview: toPreview(preview), center: origin ?? gps,
      routeLabel: quote && !editing ? { main: mins(quote.route.durationS), sub: km(quote.route.distanceM) } : null,
      endLabels: quote && origin && dest ? (() => {
        const opt = quote.options.find((o) => o.categoryId === category) ?? quote.options[0];
        const eta = opt?.pickupEtaS ?? null;
        return {
          origin: { lat: origin.lat, lng: origin.lng, title: `De ${origin.label}`, badge: eta !== null ? String(Math.max(1, Math.round(eta / 60))) : undefined, badgeSub: eta !== null ? "min" : undefined },
          dest: { lat: dest.lat, lng: dest.lng, title: `Para ${dest.label}`, sub: eta !== null ? `chega ${clock(eta + quote.route.durationS)}` : `${mins(quote.route.durationS)} de viagem` },
        };
      })() : null,
      onPick: async (p) => {
        if (!pickRef.current) return;
        const place = await placeFromCoords(p);
        const target = pickRef.current;
        if (target === "origin") setOrigin(place);
        else if (target === "dest") setDest(place);
        else setStop(Number(target.slice(4)), place);
        setPicking(null);
      },
    });
  }, [points, quote, picking, preview, editing, origin, gps, category]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = quote?.options.find((o) => o.categoryId === category);
  if (askLocation) {
    return (
      <div className="anim-rise space-y-3">
        <span className="grid size-12 place-items-center rounded-full bg-surface-2 text-brand"><Icon name="locate" /></span>
        <h1 className="display text-2xl md:text-3xl">Use sua localização</h1>
        <p className="text-muted">Ela preenche o ponto de partida do seu pedido. Se preferir, digite o endereço.</p>
        <button type="button" className="btn btn-primary btn-lg w-full" onClick={() => { setAskLocation(false); locate(); }}>Usar minha localização</button>
        <button type="button" className="btn btn-ghost w-full" onClick={declineLocation}>Digitar endereço</button>
      </div>
    );
  }

  if (booked) {
    return (
      <div className="anim-rise space-y-3" data-testid="booked">
        <span className="grid size-12 place-items-center rounded-full bg-surface-2 text-brand"><Icon name="calendar" weight="duotone" /></span>
        <h1 className="display text-2xl md:text-3xl">Corrida agendada</h1>
        <p className="font-semibold">{whenLabel(booked)}</p>
        <p className="text-sm text-muted">{[origin?.label, ...filledStops.map((p) => p.label), dest?.label].join(" → ")}</p>
        <Note tone="ok">A busca por motorista começa alguns minutos antes do horário, e você recebe um aviso aqui. O preço mostrado fica garantido.</Note>
        <a href="/passageiro/viagens" className="btn btn-soft w-full">Ver agendadas</a>
        <button type="button" className="btn btn-primary w-full" onClick={() => { setBooked(null); setDest(null); setStops([]); setWhen("now"); setAt(""); setQuote(null); }}>Fazer outro pedido</button>
      </div>
    );
  }

  const showFields = !quote || editing || wide3;
  const minAt = toLocalInput(new Date(Date.now() + 31 * 60_000));
  const maxAt = toLocalInput(new Date(Date.now() + 7 * 24 * 3600_000));
  const pickName = (p: Pick) => (p === "origin" ? "a partida" : p === "dest" ? "o destino final" : `a parada ${stops.findIndex((s) => `stop${s.id}` === p) + 1}`);
  const requestDisabled = busy || !category || (forOther && (riderName.trim().length < 2 || riderPhone.length < 10)) || (when === "later" && !at);
  const submitRide = () => { setError(null); run(async () => { await api("/api/rides", { body: { origin, dest, categoryId: category, paymentMethod: method, couponCode: quote?.couponApplied ? coupon : null, rider: forOther ? { name: riderName, phone: riderPhone } : null, stops: filledStops, scheduledFor: when === "later" && at ? new Date(at).toISOString() : null } });
    if (when === "later") setBooked(new Date(at).toISOString());
    onCreated();
  }); };
  const requestLabel = busy ? "Pedindo…" : `${when === "later" ? "Agendar" : "Pedir"} ${selected?.name ?? "corrida"}${forOther && riderName.trim() ? ` para ${riderName.trim().split(" ")[0]}` : ""}${selected ? ` · ${brl(selected.totalCents)}` : ""}`;
  const whenBlock = (
    <fieldset className="space-y-2">
      <legend className="mb-1.5 text-sm font-semibold">Quando</legend>
      <div className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1" role="radiogroup" aria-label="Quando">
        {([["now", "Agora", "bolt"], ["later", "Agendar", "calendar"]] as const).map(([v, label, icon]) => (
          <button key={v} type="button" role="radio" aria-checked={when === v} onClick={() => { setWhen(v); if (v === "later" && !at) setAt(minAt); }}
            className={`flex min-h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold ${when === v ? "bg-surface shadow-[0_1px_4px_rgb(0_0_0/.12)]" : "text-muted"}`}><Icon name={icon} size={16} />{label}</button>
        ))}
      </div>
      {when === "later" && (
        <label className="anim-rise block"><span className="mb-1 block text-xs font-semibold">Dia e hora da partida</span>
          <input className="input num" type="datetime-local" min={minAt} max={maxAt} step={300} value={at} onChange={(e) => setAt(e.target.value)} />
          <span className="mt-1 block text-xs text-muted">A busca por motorista começa alguns minutos antes. O preço de agora fica garantido.</span>
        </label>
      )}
    </fieldset>
  );
  const riderBlock = (
    <fieldset className="space-y-2">
      <legend className="mb-1.5 text-sm font-semibold">Quem vai viajar</legend>
      <div className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1" role="radiogroup" aria-label="Quem vai viajar">
        {([[false, "Eu", "user"], [true, "Outra pessoa", "users"]] as const).map(([v, label, icon]) => (
          <button key={label} type="button" role="radio" aria-checked={forOther === v} onClick={() => setForOther(v)}
            className={`flex min-h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold ${forOther === v ? "bg-surface shadow-[0_1px_4px_rgb(0_0_0/.12)]" : "text-muted"}`}><Icon name={icon} size={16} />{label}</button>
        ))}
      </div>
      {forOther && (
        <div className="anim-rise grid gap-2 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-xs font-semibold">Nome de quem embarca</span>
            <input className="input" autoComplete="off" value={riderName} onChange={(e) => setRiderName(e.target.value)} maxLength={80} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold">Celular dessa pessoa</span>
            <input className="input num" type="tel" inputMode="tel" autoComplete="off" placeholder="(31) 99999-9999" value={maskPhone(riderPhone)} onChange={(e) => setRiderPhone(e.target.value.replace(/\D/g, "").slice(0, 11))} /></label>
          <p className="text-xs text-muted sm:col-span-2">O motorista vê esse nome e pode ligar para esse número só durante a corrida. A cobrança continua na sua conta.</p>
        </div>
      )}
    </fieldset>
  );
  const couponBlock = (
    <>
      <details>
        <summary className="py-1 text-sm font-semibold">Tenho um cupom</summary>
        <div className="mt-2 flex gap-2">
          <input className="input" aria-label="Cupom de desconto" placeholder="Cupom de desconto" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} />
          <button type="button" className="btn btn-soft" onClick={applyCoupon} disabled={busy || !coupon}>Aplicar</button>
        </div>
      </details>
      {quote?.couponApplied && <Note tone="ok">Cupom aplicado.</Note>}
    </>
  );
  // Destaques das categorias: a que chega primeiro e a mais barata.
  const fastest = quote?.options.filter((o) => o.pickupEtaS !== null).sort((a, b) => a.pickupEtaS! - b.pickupEtaS!)[0]?.categoryId;
  const cheapest = quote?.options.slice().sort((a, b) => a.totalCents - b.totalCents)[0]?.categoryId;

  // ---------------------------------------------------------------- computador largo: três colunas
  if (wide3) {
    return (
      <>
        <aside className="card min-h-0 space-y-4 self-start overflow-auto p-5 lg:max-h-full" aria-label="Pedido">
          <div>
            {firstName && <p className="text-sm font-semibold text-brand">{greeting()}, {firstName}</p>}
            <h1 className="display text-2xl">Peça uma viagem</h1>
          </div>
          {fieldsBlock(true)}
          {whenBlock}
          {riderBlock}
          {dest && <SaveAs place={dest} places={saved.places} onSaved={saved.reload} />}
        </aside>
        <section className="flex min-h-0 flex-col" aria-labelledby="escolha">
          <div className="min-h-0 flex-1 space-y-4 overflow-auto pr-1 pb-4">
            <h2 id="escolha" className="display text-3xl xl:text-4xl">{quote ? "Escolha uma viagem" : "Para onde vamos?"}</h2>
            {!quote ? (
              <div className="space-y-4">
                <p className="text-muted">{busy ? "Calculando a rota e os preços…" : dest ? "Calculando…" : "Digite o destino final ao lado ou escolha um atalho: as opções e os preços aparecem aqui."}</p>
                {!dest && <Shortcuts places={saved.places} recent={recent} onPick={setDest} />}
                {busy && <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="map-loading h-24 rounded-2xl" />)}</div>}
              </div>
            ) : (
              <>
                <p className="num text-sm text-muted">{km(quote.route.distanceM)} · cerca de {mins(quote.route.durationS)} de viagem · {quote.region.name}</p>
                {quote.route.source === "estimate" && <Note tone="warn">Serviço de rotas indisponível: distância e preço estimados em linha reta.</Note>}
                <div role="radiogroup" aria-label="Categoria" className="space-y-2">
                  {quote.options.map((o) => {
                    const on = category === o.categoryId;
                    return (
                      <button key={o.categoryId} type="button" role="radio" aria-checked={on} onClick={() => setCategory(o.categoryId)}
                        className={`group flex w-full items-center gap-5 rounded-[22px] px-5 py-4 text-left transition-[box-shadow,background-color,transform] duration-300 ${on ? "bg-surface shadow-[0_0_0_2.5px_var(--primary)_inset,0_18px_40px_-26px_rgb(0_0_0/.5)]" : "hover:bg-surface hover:shadow-[0_0_0_1px_var(--line)_inset]"}`}>
                        <span aria-hidden="true" className={`relative grid h-16 w-28 shrink-0 place-items-center transition-transform duration-500 ${on ? "translate-x-1.5" : "group-hover:translate-x-1"}`}>
                          {o.slug === "moto" ? <MotoArt className="w-20" /> : <CarArt className={o.seats > 4 ? "w-28" : o.slug === "conforto" ? "w-[6.5rem]" : "w-24"} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2"><span className="display text-2xl">{o.name}</span><span className="inline-flex items-center gap-0.5 text-sm text-muted"><Icon name="user" size={14} />{o.seats}</span></span>
                          <span className="num block text-sm">{o.pickupEtaS !== null ? <>Chega {clock(o.pickupEtaS + quote.route.durationS)} · motorista a {mins(o.pickupEtaS)}</> : <span className="text-muted">Sem motoristas online agora</span>}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            {o.categoryId === fastest && <span className="inline-flex items-center gap-1 rounded-md bg-primary px-1.5 py-0.5 text-xs font-semibold text-on-primary"><Icon name="bolt" size={12} />Mais rápido</span>}
                            {o.categoryId === cheapest && quote.options.length > 1 && <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-semibold text-brand">Mais barato</span>}
                            <span className="text-sm text-muted">{o.description}</span>
                          </span>
                        </span>
                        <span className="num text-right text-xl font-bold">{brl(o.totalCents)}{o.discountCents > 0 && <span className="block text-xs font-normal text-muted line-through">{brl(o.totalCents + o.discountCents)}</span>}</span>
                      </button>
                    );
                  })}
                </div>
                {selected && <p className="num text-xs text-muted">Corrida {brl(selected.grossCents)} + taxa de serviço {brl(selected.serviceFeeCents)}{selected.discountCents > 0 && ` − cupom ${brl(selected.discountCents)}`}</p>}
                {couponBlock}
              </>
            )}
          </div>
          {/* Barra fixa: forma de pagamento e o botão de pedir, sempre à vista. */}
          {quote && (
            <div className="card flex flex-wrap items-center gap-3 p-3" data-testid="order-bar">
              <label className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-brand"><Icon name={METHOD_INFO[method].icon} size={20} /></span>
                <span className="min-w-0 flex-1">
                  <span className="sr-only">Forma de pagamento</span>
                  <select aria-label="Forma de pagamento" className="w-full cursor-pointer truncate bg-transparent py-2 font-semibold outline-none" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                    {METHOD_ORDER.filter((m) => quote.payment[m].available).map((m) => <option key={m} value={m}>{METHOD_INFO[m].label}</option>)}
                  </select>
                  <span className="block truncate text-xs text-muted">{METHOD_INFO[method].how}</span>
                </span>
              </label>
              <button type="button" className="btn btn-primary btn-lg min-w-[16rem] flex-1" disabled={requestDisabled} onClick={submitRide}>{requestLabel}</button>
              <div className="basis-full"><ErrorNote>{error}</ErrorNote></div>
            </div>
          )}
          {!quote && <ErrorNote>{error}</ErrorNote>}
        </section>
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        {firstName && <p className="text-sm font-semibold text-brand">{greeting()}, {firstName}</p>}
        <h1 className="display text-2xl md:text-4xl">Para onde vamos?</h1>
      </div>
      {showFields ? fieldsBlock(false) : (
        <div className="space-y-2" data-testid="trip-summary">
          {origin && <PlacePreview compact place={origin} role="Partida" />}
          {filledStops.map((p, i) => <PlacePreview key={i} compact place={p} role={`Parada ${i + 1}`} />)}
          {dest && <PlacePreview compact place={dest} role="Destino final" />}
          <button type="button" className="min-h-11 w-full text-sm font-semibold underline" onClick={() => setEditing(true)}>Alterar partida ou destino</button>
        </div>
      )}
      {narrowQuote()}
      {!(quote && !editing) && <ErrorNote>{error}</ErrorNote>}
    </div>
  );

  function fieldsBlock(inWide: boolean) {
    return (
        <div className="space-y-3">
          {/* A partida vem primeiro; o destino final, depois. O fio de prumo liga os dois pontos. */}
          <div className="relative space-y-2.5">
            <span aria-hidden="true" className="pointer-events-none absolute top-7 bottom-7 left-[21px] z-10 w-[1.5px] bg-primary" />
            <div className="relative focus-within:z-30">
              <span aria-hidden="true" className="pointer-events-none absolute top-[19px] left-4 z-20 block size-3 rounded-full border-[3px] border-primary bg-surface" />
              <PlaceSearch label="Partida" value={origin} onPick={setOrigin} onClear={() => setOrigin(null)} near={gps} onPreview={setPreview} inputClassName="!pl-11 !pr-24" />
              <div className="absolute top-1 right-1 z-20 flex">
                <button type="button" className="grid size-11 place-items-center rounded-full hover:bg-surface" onClick={locate} aria-label="Usar minha localização"><Icon name="locate" size={20} /></button>
                <button type="button" className={`grid size-11 place-items-center rounded-full ${picking === "origin" ? "bg-primary text-on-primary" : "hover:bg-surface"}`} onClick={() => setPicking(picking === "origin" ? null : "origin")} aria-pressed={picking === "origin"} aria-label="Marcar partida no mapa"><Icon name="prumo" size={20} /></button>
              </div>
            </div>
            {stops.map((s, i) => (
              <div key={s.id} className="relative anim-rise focus-within:z-30">
                <span aria-hidden="true" className="pointer-events-none absolute top-[19px] left-4 z-20 block size-3 rounded-[3px] border-[3px] border-primary bg-surface" />
                <PlaceSearch label={`Parada ${i + 1}`} value={s.place} onPick={(p) => setStop(s.id, p)} onClear={() => setStop(s.id, null)} near={origin ?? gps} onPreview={setPreview} inputClassName="!pl-11 !pr-24" />
                <div className="absolute top-1 right-1 z-20 flex">
                  <button type="button" className={`grid size-11 place-items-center rounded-full ${picking === `stop${s.id}` ? "bg-primary text-on-primary" : "hover:bg-surface"}`} onClick={() => setPicking(picking === `stop${s.id}` ? null : `stop${s.id}`)} aria-pressed={picking === `stop${s.id}`} aria-label={`Marcar parada ${i + 1} no mapa`}><Icon name="prumo" size={20} /></button>
                  <button type="button" className="grid size-11 place-items-center rounded-full hover:bg-surface" onClick={() => removeStop(s.id)} aria-label={`Tirar parada ${i + 1}`}><Icon name="close" size={18} /></button>
                </div>
              </div>
            ))}
            <div className="relative focus-within:z-30">
              <span aria-hidden="true" className="pointer-events-none absolute top-[13px] left-[12px] z-20 text-primary"><Icon name="prumo" size={20} weight="fill" /></span>
              <PlaceSearch label="Destino final" value={dest} onPick={setDest} onClear={() => setDest(null)} near={origin ?? gps} onPreview={setPreview} inputClassName="!pl-11 !pr-14" />
              <div className="absolute top-1 right-1 z-20 flex">
                <button type="button" className={`grid size-11 place-items-center rounded-full ${picking === "dest" ? "bg-primary text-on-primary" : "hover:bg-surface"}`} onClick={() => setPicking(picking === "dest" ? null : "dest")} aria-pressed={picking === "dest"} aria-label="Marcar destino final no mapa"><Icon name="prumo" size={20} /></button>
              </div>
            </div>
          </div>
          {stops.length < MAX_STOPS && (
            <button type="button" className="flex min-h-10 items-center gap-2 text-sm font-semibold text-brand" onClick={addStop}><Icon name="plus" size={18} />Adicionar parada</button>
          )}
          {picking && <Note tone="ok">Toque no mapa para marcar {pickName(picking)}.</Note>}
          {gpsNote && <p className="text-xs text-muted">{gpsNote}</p>}
          {!inWide && !dest && !picking && <Shortcuts places={saved.places} recent={recent} onPick={setDest} />}
          {inWide ? (
            (origin || dest) && (
              <div className="space-y-2" data-testid="trip-summary">
                {origin && <PlacePreview compact place={origin} role={originIsGps ? "Partida · você está aqui" : "Partida"} />}
                {filledStops.map((p, i) => <PlacePreview key={i} compact place={p} role={`Parada ${i + 1}`} />)}
                {dest && <PlacePreview compact place={dest} role="Destino final" />}
              </div>
            )
          ) : (
            <>
              {origin && <PlacePreview place={origin} role={originIsGps ? "Partida · você está aqui" : "Partida"} />}
              {stops.map((s, i) => s.place && <PlacePreview key={s.id} place={s.place} role={`Parada ${i + 1}`} />)}
              {dest && <div className="space-y-2"><PlacePreview place={dest} role="Destino final" /><SaveAs place={dest} places={saved.places} onSaved={saved.reload} /></div>}
              {editing && <button type="button" className="btn btn-soft w-full" onClick={() => { setEditing(false); setPicking(null); }}>Ver preços</button>}
            </>
          )}
        </div>
    );
  }

  function narrowQuote() {
    if (!quote || editing) return null;
    return (
        <div className="anim-rise space-y-3">
          <p className="num text-sm text-muted">{km(quote.route.distanceM)} · cerca de {mins(quote.route.durationS)} de viagem · {quote.region.name}</p>
          {quote.route.source === "estimate" && <Note tone="warn">Serviço de rotas indisponível: distância e preço estimados em linha reta.</Note>}
          <div role="radiogroup" aria-label="Categoria" className="space-y-2">
            {quote.options.map((o) => (
              <button key={o.categoryId} type="button" role="radio" aria-checked={category === o.categoryId} onClick={() => setCategory(o.categoryId)}
                className={`group flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-[box-shadow,background-color] ${category === o.categoryId ? "bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] shadow-[0_0_0_2px_var(--primary)_inset]" : "shadow-[0_0_0_1px_var(--line)_inset] hover:bg-surface-2"}`}>
                <span aria-hidden="true" className={`relative grid h-12 w-[4.5rem] shrink-0 place-items-center transition-transform duration-300 ${category === o.categoryId ? "translate-x-1" : "group-hover:translate-x-0.5"}`}>
                  {o.slug === "moto" ? <MotoArt className="w-[3.2rem]" /> : <CarArt className={o.seats > 4 ? "w-[4.5rem]" : o.slug === "conforto" ? "w-[4.1rem]" : "w-[3.8rem]"} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-semibold">{o.name}<span className="inline-flex items-center gap-0.5 text-xs font-medium text-muted"><Icon name="user" size={12} />{o.seats}</span></span>
                  <span className="block text-xs text-muted">{o.pickupEtaS !== null ? `Motorista a ~${mins(o.pickupEtaS)} · você chega ~${clock(o.pickupEtaS + quote.route.durationS)}` : "Sem motoristas online agora"}</span>
                  <span className="block truncate text-xs text-muted">{o.description}</span>
                </span>
                <span className="num text-right font-semibold">{brl(o.totalCents)}{o.discountCents > 0 && <span className="block text-xs font-normal text-muted line-through">{brl(o.totalCents + o.discountCents)}</span>}</span>
              </button>
            ))}
          </div>
          {selected && <p className="num text-xs text-muted">Corrida {brl(selected.grossCents)} + taxa de serviço {brl(selected.serviceFeeCents)}{selected.discountCents > 0 && ` − cupom ${brl(selected.discountCents)}`}</p>}

          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">Pagamento</legend>
            <div className="space-y-2" role="radiogroup" aria-label="Forma de pagamento">
              {METHOD_ORDER.filter((m) => quote.payment[m].available).map((m) => {
                const info = METHOD_INFO[m];
                const n = m === "pix_driver" || m === "card_machine" ? quote.acceptingNow[m] : null;
                return (
                  <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-[box-shadow,background-color] ${method === m ? "bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] shadow-[0_0_0_2px_var(--primary)_inset]" : "shadow-[0_0_0_1px_var(--line)_inset] hover:bg-surface-2"}`}>
                    <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${method === m ? "bg-primary text-on-primary" : "bg-surface-2 text-brand"}`}><Icon name={info.icon} size={20} weight="duotone" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{info.label}</span>
                      <span className="block text-xs text-muted">{info.how}{n !== null ? (n ? ` · ${n} ${n === 1 ? "motorista aceita" : "motoristas aceitam"} agora` : " · nenhum motorista online aceita agora") : ""}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {!quote.payment.pix.available && <p className="mt-1.5 text-xs text-muted">Pix e cartão pelo app entram após o contrato com o provedor de pagamentos.</p>}
          </fieldset>

          {whenBlock}
          {riderBlock}
          {couponBlock}
          <ErrorNote>{error}</ErrorNote>

          {/* Fixo no fim da folha: pedir nunca depende de rolar a lista. */}
          <div className="sticky bottom-0 -mx-4 bg-surface px-4 py-3 shadow-[0_-12px_16px_-12px_rgb(0_0_0/.12)] md:static md:mx-0 md:bg-transparent md:px-0 md:shadow-none">
            <button type="button" className="btn btn-primary btn-lg w-full" disabled={requestDisabled} onClick={submitRide}>{requestLabel}</button>
          </div>
        </div>
    );
  }
}

/**
 * De onde vem a posição do carro: o GPS do celular do motorista (iPhone ou Android), não um rastreador no carro
 * nem o IP da operadora (que erra por quilômetros). Mostra há quanto tempo chegou e a precisão.
 */
function GpsLine({ driver }: { driver: NonNullable<Ride["driver"]> }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const age = driver.locationAt ? Math.max(0, Math.round((now - new Date(driver.locationAt).getTime()) / 1000)) : null;
  const stale = age !== null && age > 60;
  return (
    <p className={`flex items-center gap-2 text-xs ${stale ? "text-warn" : "text-muted"}`} data-testid="gps-line">
      <span className="relative grid size-2 place-items-center"><span className={`absolute size-2 rounded-full ${stale ? "bg-[var(--warn)]" : "pulse-ring bg-[#5BD49B]"}`} /><span className={`size-2 rounded-full ${stale ? "bg-[var(--warn)]" : "bg-[#5BD49B]"}`} /></span>
      <Icon name="phone" size={14} />
      {stale ? `Sem sinal do celular do motorista há ${Math.round(age! / 60)} min` : `GPS do celular do motorista · há ${age} s${driver.accuracyM ? ` · precisão ±${Math.round(driver.accuracyM)} m` : ""}`}
    </p>
  );
}

function ActiveRide({ ride, reload }: { ride: Ride; reload: () => void }) {
  const { busy, error, run } = useAction();
  const [copied, setCopied] = useState(false);
  const [alerted, setAlerted] = useState(false);
  const share = async () => {
    const url = `${location.origin}/v/${ride.shareToken}`;
    const text = `Acompanhe minha viagem na Orbi: ${url}`;
    if (navigator.share) { try { await navigator.share({ title: "Minha viagem", text, url }); return; } catch { /* usuário cancelou */ } }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { window.prompt("Copie o link da viagem:", url); }
  };
  const canCancel = ["searching", "accepted", "arrived"].includes(ride.status);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="display text-2xl md:text-3xl">{ride.statusLabel}</h1>
        {ride.status === "searching" && <div className="anim-swing text-brand"><svg width="14" height="34" viewBox="0 0 14 34" aria-hidden="true"><path d="M7 0v16" stroke="currentColor" /><path d="M7 34c-3-4-6-6-6-10a6 6 0 0 1 12 0c0 4-3 6-6 10Z" fill="currentColor" /></svg></div>}
      </div>
      {ride.status === "searching" && <p className="text-sm text-muted">Estamos oferecendo sua corrida aos motoristas disponíveis. Nada é cobrado se ninguém aceitar.</p>}

      {ride.driver && ride.vehicle && (
        <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
          {ride.driver.hasPhoto
            ? <img src={`/api/rides/${ride.id}/driver-photo`} alt={`Foto de ${ride.driver.name}`} className="size-14 rounded-full object-cover" /> /* eslint-disable-line @next/next/no-img-element */
            : <span className="grid size-14 place-items-center rounded-full bg-primary text-on-primary display text-xl">{ride.driver.name[0]}</span>}
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{ride.driver.name}{ride.driver.rating ? <span className="num text-sm font-normal"> · ★ {ride.driver.rating.toFixed(1).replace(".", ",")}</span> : <span className="text-sm font-normal text-muted"> · novo</span>}</p>
            <p className="truncate text-sm text-muted">{ride.vehicle.make} {ride.vehicle.model} · {ride.vehicle.color}</p>
          </div>
          <span className="num rounded-lg bg-surface px-2.5 py-1.5 font-bold tracking-wider shadow-[0_0_0_1px_var(--line)]" aria-label={`Placa ${ride.vehicle.plate}`}>{ride.vehicle.plate}</span>
        </div>
      )}

      {ride.rider && <Note tone="ok">Corrida para {ride.rider.name}. O motorista vê esse nome e pode ligar para o celular informado.</Note>}
      <dl className="space-y-1 text-sm">
        <div className="flex gap-2"><dt className="text-muted">De</dt><dd className="font-medium">{ride.origin.label}</dd></div>
        {ride.stops.map((p, i) => <div key={i} className="flex gap-2"><dt className="text-muted">Parada {i + 1}</dt><dd className="font-medium">{p.label}</dd></div>)}
        <div className="flex gap-2"><dt className="text-muted">Para</dt><dd className="font-medium">{ride.dest.label}</dd></div>
        <div className="num flex justify-between border-t border-line pt-1.5"><dt className="text-muted">{METHOD_LABEL[ride.paymentMethod]} · {km(ride.distanceM)}</dt><dd className="font-semibold">{brl(ride.totalCents)}</dd></div>
      </dl>
      {ride.driver?.locationAt && ["accepted", "arrived", "in_progress"].includes(ride.status) && <GpsLine driver={ride.driver} />}
      {ride.driverPix && <PixPay pix={ride.driverPix} totalCents={ride.totalCents} />}
      {ride.paymentMethod === "card_machine" && ride.status === "in_progress" && <Note tone="ok">No fim da viagem, pague {brl(ride.totalCents)} na maquininha do motorista.</Note>}

      {ride.driver && <RideChat rideId={ride.id} messages={ride.messages} onSent={reload} />}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-soft" onClick={share}><Icon name="share" size={18} />{copied ? "Link copiado" : "Compartilhar"}</button>
        {ride.status !== "searching" && (
          <a href="tel:190" className="btn btn-danger" onClick={() => { if (!alerted) { setAlerted(true); api(`/api/rides/${ride.id}/emergency`, { body: {} }); } }}><Icon name="sos" size={18} /> Emergência</a>
        )}
      </div>
      {alerted && <Note tone="warn">Chamado de emergência aberto para a nossa equipe. Em perigo, fale com o 190.</Note>}
      {canCancel && <button type="button" className="btn btn-ghost w-full" disabled={busy} onClick={() => run(async () => { await api(`/api/rides/${ride.id}/cancel`, { body: { reason: "Cancelada pelo passageiro" } }); reload(); })}>Cancelar corrida</button>}
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}

function RateLast({ ride, onDone }: { ride: Ride; onDone: () => void }) {
  const [stars, setStars] = useState(0);
  const { busy, error, run } = useAction();
  return (
    <div className="space-y-3">
      <h1 className="display text-2xl md:text-3xl">Você chegou</h1>
      <p className="num text-sm text-muted">{brl(ride.totalCents)} · {METHOD_LABEL[ride.paymentMethod]}{ride.paymentMethod === "cash" ? " (pague ao motorista)" : ride.paymentMethod === "card_machine" ? " (pague na maquininha do motorista)" : ""}</p>
      {ride.driverPix && <PixPay pix={ride.driverPix} totalCents={ride.totalCents} />}
      {ride.pixCopyPaste && <div className="space-y-1"><p className="text-sm font-semibold">Pix copia e cola</p><textarea readOnly className="input text-xs" value={ride.pixCopyPaste} aria-label="Código Pix" /></div>}
      {ride.paymentStatus === "failed" && <Note tone="warn">Não foi possível gerar a cobrança. Nossa equipe vai entrar em contato.</Note>}
      <p className="font-semibold">Como foi a viagem com {ride.driver?.name}?</p>
      <Stars value={stars} onChange={setStars} size={36} />
      <ErrorNote>{error}</ErrorNote>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary flex-1" disabled={!stars || busy} onClick={() => run(async () => { await api(`/api/rides/${ride.id}/rate`, { body: { stars } }); onDone(); })}>Enviar avaliação</button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>Agora não</button>
      </div>
    </div>
  );
}

export default function PassengerHome() {
  const { data, reload, loading } = useLive<{ active: Ride | null; history: Ride[] }>("/api/rides");
  const [mapState, setMapState] = useState<MapState>({ points: [], route: null });
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [startedAt] = useState(() => Date.now());
  const wide = useWide();
  // Computador largo: pedido, opções e mapa lado a lado, em três colunas.
  const wide3 = useWide(1024);
  const [firstName, setFirstName] = useState<string | undefined>();
  useEffect(() => { api<{ user: { name: string } }>("/api/me").then((r) => setFirstName(r.user.name.split(" ")[0])).catch(() => {}); }, []);

  const active = data?.active ?? null;

  // Carros online por perto (dados reais, posição aproximada). Atualiza a cada 15 s enquanto não há corrida.
  const [nearby, setNearby] = useState<{ count: number; cars: { lat: number; lng: number }[] } | null>(null);
  const center = mapState.center;
  const centerKey = center ? `${center.lat.toFixed(3)},${center.lng.toFixed(3)}` : "";
  useEffect(() => {
    if (!center || active) { setNearby(null); return; }
    let live = true;
    const load = () => api<{ count: number; cars: { lat: number; lng: number }[] }>(`/api/rides/nearby?lat=${center.lat}&lng=${center.lng}`)
      .then((r) => { if (live) setNearby(r); }).catch(() => {});
    load();
    const t = setInterval(load, 15_000);
    return () => { live = false; clearInterval(t); };
  }, [centerKey, !!active]); // eslint-disable-line react-hooks/exhaustive-deps
  // Últimos destinos de viagens concluídas, sem repetir.
  const recent = useMemo(() => {
    const seen = new Set<string>();
    return (data?.history ?? []).filter((r) => r.status === "completed").map((r) => r.dest).filter((d) => {
      const k = `${d.lat.toFixed(4)},${d.lng.toFixed(4)}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [data?.history]);
  const justEnded = data?.history.find((r) => r.status === "completed" && !r.myRating && r.id !== dismissed && new Date((r as unknown as { endedAt: string }).endedAt).getTime() > startedAt - 3600_000);
  const lastFailed = data?.history[0] && data.history[0].status === "no_driver" && data.history[0].id !== dismissed && new Date((data.history[0] as unknown as { endedAt: string }).endedAt).getTime() > startedAt - 600_000 ? data.history[0] : null;

  const showRequest = !(loading && !data) && !active && !justEnded && !lastFailed;
  const activePoints: MapPoint[] = active ? [
    { id: "origin", kind: "origin", lat: active.origin.lat, lng: active.origin.lng },
    ...active.stops.map((p, i) => ({ id: `stop${i}`, kind: "stop" as const, lat: p.lat, lng: p.lng })),
    { id: "dest", kind: "dest", lat: active.dest.lat, lng: active.dest.lng },
    ...(active.driver?.lat != null && active.driver.lng != null ? [{ id: "car", kind: "car" as const, lat: active.driver.lat, lng: active.driver.lng, heading: active.driver.heading }] : []),
  ] : [];

  // Celular: tela menos a barra de cima (3,5rem) e a de baixo (4rem + margem do iPhone), para o botão de pedir nunca ficar escondido.
  return (
    <div className="relative flex h-[calc(100svh-3.5rem-4rem-1px-env(safe-area-inset-bottom))] flex-col md:h-[calc(100svh-4rem)] lg:grid lg:grid-cols-[minmax(320px,370px)_minmax(0,1.15fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-6 lg:p-6">
      {/* Celular e tablet: o mapa ocupa a tela e o painel flutua por cima. Computador largo: o mapa é a terceira coluna. */}
      <MapView className="min-h-[32%] flex-1 md:absolute md:inset-0 lg:relative lg:inset-auto lg:col-start-3 lg:row-start-1 lg:min-h-0 lg:overflow-hidden lg:rounded-[28px] lg:shadow-[0_0_0_1px_var(--line),0_30px_60px_-40px_rgb(0_0_0/.5)]" ariaLabel="Mapa da viagem" recenter
        padding={wide3 ? { top: 70, bottom: 60, left: 60, right: 60 } : wide ? { top: 90, bottom: 90, left: 540, right: 90 } : { top: 60, bottom: 50, left: 40, right: 40 }}
        points={active ? activePoints : mapState.points} route={active ? active.geometry : mapState.route} onPick={active ? undefined : mapState.onPick} picking={!active && mapState.picking}
        preview={active ? null : mapState.preview} routeLabel={active || wide3 ? null : mapState.routeLabel} endLabels={active || !wide3 ? null : mapState.endLabels} cars={active ? undefined : nearby?.cars}>
        {!active && nearby && (
          <p className="pointer-events-none absolute top-3 left-1/2 z-10 flex w-max -translate-x-1/2 items-center gap-2 rounded-full bg-[#0f2a33]/90 px-3.5 py-2 text-xs font-semibold whitespace-nowrap text-white shadow-[0_8px_20px_-8px_rgb(0_0_0/.5)] backdrop-blur md:top-6 md:right-6 md:left-auto md:translate-x-0" role="status">
            <span className={`size-2 rounded-full ${nearby.count ? "bg-[#5BD49B] shadow-[0_0_0_3px_rgb(91_212_155/.3)]" : "bg-[#F6C66A]"}`} />
            {nearby.count ? `${nearby.count} ${nearby.count === 1 ? "motorista online" : "motoristas online"} por perto` : "Nenhum motorista online por perto agora"}
          </p>
        )}
      </MapView>
      {/* Computador largo: no pedido, as duas primeiras colunas vêm do próprio painel (a seção "some" com display: contents);
          com corrida em andamento, um cartão ocupa as duas colunas. */}
      <section className={`float-panel anim-sheet z-10 -mt-4 max-h-[calc(68%+1rem)] overflow-auto rounded-t-3xl bg-surface p-4 shadow-[0_-12px_40px_-20px_rgb(0_0_0/.5)] md:absolute md:top-6 md:bottom-6 md:left-6 md:mt-0 md:h-fit md:max-h-[calc(100%-3rem)] md:w-[460px] md:rounded-[28px] md:p-6 ${
        showRequest && wide3 ? "lg:contents" : "lg:static lg:col-span-2 lg:col-start-1 lg:row-start-1 lg:h-fit lg:max-h-full lg:w-auto lg:max-w-2xl"}`}>
        <span aria-hidden="true" className="mx-auto -mt-1 mb-3 block h-1.5 w-10 rounded-full bg-line md:hidden" />
        {loading && !data ? <Spinner />
          : active ? <ActiveRide ride={active} reload={reload} />
          : justEnded ? <RateLast ride={justEnded} onDone={() => { setDismissed(justEnded.id); reload(); }} />
          : lastFailed ? (
            <div className="space-y-3">
              <h1 className="display text-2xl">Nenhum motorista disponível</h1>
              <p className="text-muted">Não encontramos motorista agora e nada foi cobrado. Tente de novo em alguns minutos.</p>
              <button type="button" className="btn btn-primary w-full" onClick={() => setDismissed(lastFailed.id)}>Fazer novo pedido</button>
            </div>
          )
          : <RequestPanel onCreated={reload} setMapState={setMapState} recent={recent} firstName={firstName} wide3={wide3} />}
      </section>
    </div>
  );
}

