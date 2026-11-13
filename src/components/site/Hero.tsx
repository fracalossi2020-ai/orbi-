"use client";
import { MapView } from "@/components/LazyMap";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon } from "@/components/Icon";
import { PlaceSearch, type Place } from "@/components/PlaceSearch";
import { PlacePreview } from "@/components/PlacePreview";
import type { MapPoint } from "@/components/MapView";
import { api, ErrorNote, km, mins } from "@/components/ui";
import { brl, quoteFare } from "@/domain/pricing";
import { cityOf, pulseText, usePulse, useTariffs } from "./usePublic";
import { OrbitField } from "./OrbitField";
import { asset, STATIC } from "@/lib/site-mode";

export type HeroCity = { id: string; name: string; state: string; lat: number; lng: number; radiusKm: number; slug?: string };
type Trip = { distanceM: number; durationS: number; geometry: [number, number][]; source: "osrm" | "estimate"; originInArea: boolean; destInArea: boolean };

const WORDS = ["Seu caminho.", "Seu destino.", "Sua órbita."];
const EASE = [.2, .8, .2, 1] as const;

/** Evento disparado por outras partes da página (o panorama do Vale) para preencher o destino daqui. */
export const DEST_EVENT = "prumo:destino";

/**
 * Arte do topo: a constelação do Vale do Aço (ver OrbitField). Cidades são sistemas orbitais,
 * carros são cometas e cada corrida pedida atrai o carro mais próximo.
 */
function OrbitArt({ dim, reduce, labels }: { dim: boolean; reduce: boolean; labels: string[] }) {
  return (
    <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0" initial={false}
      animate={{ opacity: dim ? .28 : 1, scale: dim ? 1.04 : 1 }} transition={{ duration: reduce ? 0 : 1, ease: EASE }}>
      {/* Profundidade: um brilho azul-noturno atrás do texto, e a grade de pontos da marca */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(60% 70% at 18% 40%, rgb(10 30 61 / .9), transparent 70%)" }} />
      <div className="orbit-grid absolute inset-0 opacity-70" />
      <OrbitField labels={labels} reduce={reduce} />
      {/* Fusão com a faixa de baixo */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-deep to-transparent" />
    </motion.div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return <div><p className="mono-label text-on-deep-muted">{label}</p><p className="num mt-1 text-2xl font-semibold tracking-tight">{value}</p></div>;
}

/**
 * Abertura do site: preto profundo com o arco da marca. Minimalista em repouso;
 * ao escolher um endereço, o título recolhe e o arco se abre numa janela de mapa com a rota, a distância e o preço.
 */
export function Hero({ cities, signedIn = null, words = WORDS, eyebrow = "Primeira operação · Vale do Aço · MG", lead = "Mobilidade urbana mais simples, rápida e segura. Mais respeito para quem dirige, mais confiança para quem chega." }: {
  cities: HeroCity[]; signedIn?: string | null;
  /** Título em três linhas; a última fica com o degradê da marca. */
  words?: string[]; eyebrow?: string; lead?: string;
}) {
  const reduce = !!useReducedMotion();
  const passenger = signedIn === "passenger";
  const [cityId, setCityId] = useState(cities.find((c) => c.name === "Ipatinga")?.id ?? cities[0]?.id ?? "");
  const tariffs = useTariffs();
  const pulse = usePulse();
  const [origin, setOrigin] = useState<Place | null>(null);
  const [dest, setDest] = useState<Place | null>(null);
  const [last, setLast] = useState<"origin" | "dest">("dest");
  const [trip, setTrip] = useState<Trip | null>(null);
  const [routing, setRouting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const city = cities.find((c) => c.id === cityId);
  const near = city ? { lat: city.lat, lng: city.lng } : undefined;

  // Rota real assim que partida e chegada estão escolhidas: distância, tempo e área atendida, antes de qualquer cadastro.
  useEffect(() => {
    setTrip(null);
    if (!origin || !dest) return;
    let stale = false;
    setRouting(true);
    api<Trip>(`/api/geo/route?from=${origin.lat},${origin.lng}&to=${dest.lat},${dest.lng}`)
      .then((t) => { if (!stale) setTrip(t); })
      .catch(() => { if (!stale) setNote("Não foi possível calcular a rota agora. Você ainda pode ver os preços."); })
      .finally(() => { if (!stale) setRouting(false); });
    return () => { stale = true; };
  }, [origin?.lat, origin?.lng, dest?.lat, dest?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Um bairro escolhido mais abaixo na página vira o destino aqui.
  useEffect(() => {
    const on = (e: Event) => {
      setDest((e as CustomEvent<Place>).detail);
      setLast("dest");
      document.getElementById("pedir")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    };
    addEventListener(DEST_EVENT, on);
    return () => removeEventListener(DEST_EVENT, on);
  }, [reduce]);

  const [gpsAt, setGpsAt] = useState<{ lat: number; lng: number } | null>(null);
  const originIsGps = !!(gpsAt && origin && gpsAt.lat === origin.lat && gpsAt.lng === origin.lng);
  const points = useMemo<MapPoint[]>(() => [
    ...(origin ? [{ id: "origin", kind: originIsGps ? "me" as const : "origin" as const, lat: origin.lat, lng: origin.lng }] : []),
    ...(dest ? [{ id: "dest", kind: "dest" as const, lat: dest.lat, lng: dest.lng }] : []),
  ], [origin, dest, originIsGps]);
  const areas = useMemo(() => cities.map((c) => ({ lat: c.lat, lng: c.lng, radiusKm: c.radiusKm })), [cities]);
  const tripCity = trip && origin && tariffs ? cityOf(origin, tariffs) : null;
  const estimates = trip && tripCity && trip.originInArea && trip.destInArea
    ? tripCity.categories.map((c) => ({ name: c.name, seats: c.seats, totalCents: quoteFare(c.tariff, trip.distanceM, trip.durationS).totalCents }))
    : [];
  const live = pulseText(pulse?.find((p) => p.regionId === cityId), city?.name ?? "");
  const shown = last === "origin" ? origin ?? dest : dest ?? origin;
  const shownIsOrigin = shown !== null && shown === origin;
  const outside = trip && (!trip.originInArea || !trip.destInArea);
  // Modo viagem: com um endereço escolhido, o título recolhe e a janela do mapa abre.
  const traveling = !!(origin || dest);

  const locate = () => {
    if (!navigator.geolocation) { setNote("Este aparelho não oferece GPS. Digite o endereço."); return; }
    setNote("Buscando sua localização…");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const p = { lat: coords.latitude, lng: coords.longitude };
        setGpsAt(p);
        try {
          const r = await api<{ place: Place | null; inArea: boolean }>(`/api/geo/reverse?lat=${p.lat}&lng=${p.lng}`);
          setOrigin(r.place ? { ...r.place, ...p } : { label: "Minha localização", ...p, inArea: r.inArea });
        } catch { setOrigin({ label: "Minha localização", ...p }); }
        setLast("origin");
        setNote(null);
      },
      () => setNote("Não foi possível usar o GPS. Digite o endereço."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const clear = () => { setOrigin(null); setDest(null); setNote(null); setError(null); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dest) { setError("Escolha o local de chegada na lista de endereços."); return; }
    setError(null);
    try { sessionStorage.setItem("prumo-trip", JSON.stringify({ origin, dest })); } catch { /* armazenamento bloqueado: a pessoa digita de novo */ }
    window.location.href = STATIC ? asset("/entrar/") : passenger ? "/passageiro" : "/entrar?perfil=passageiro";
  };

  const panel = (
    <div className="glass-map rounded-[22px] p-4 sm:p-5">
      {trip ? (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex gap-7">
            <Readout label="Distância" value={km(trip.distanceM)} />
            <Readout label="Tempo" value={`~${mins(trip.durationS)}`} />
          </div>
          <p className={`mono-label rounded-full px-3 py-1.5 ${outside ? "bg-[color-mix(in_srgb,#F6C66A_22%,transparent)] text-[#F6C66A]" : "bg-[color-mix(in_srgb,var(--mark)_16%,transparent)] text-[var(--mark)]"}`}>
            {outside ? (!trip.originInArea ? "Partida fora da área" : "Chegada fora da área") : "Dentro da área atendida"}
          </p>
          {trip.source === "estimate" && <p className="basis-full text-xs text-on-deep-muted">Serviço de rotas indisponível: distância estimada em linha reta.</p>}
          {estimates.length > 0 && (
            <div className="basis-full border-t border-[color-mix(in_srgb,var(--on-deep)_12%,transparent)] pt-3" data-testid="estimates">
              <p className="mono-label text-on-deep-muted">Preço estimado</p>
              <ul className="mt-2 space-y-1.5">
                {estimates.map((e, i) => (
                  <motion.li key={e.name} className="flex items-baseline justify-between gap-3" initial={reduce ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .08 }}>
                    <span className="font-semibold">{e.name} <span className="text-xs font-normal text-on-deep-muted">· até {e.seats}</span></span>
                    <span className="num text-lg font-semibold text-[var(--mark)]">{brl(e.totalCents)}</span>
                  </motion.li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-on-deep-muted">Pela tarifa atual, com taxa de serviço. O valor final aparece antes de você confirmar.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--on-deep)_10%,transparent)]"><Icon name="route" size={22} weight="duotone" /></span>
          <p className="text-sm text-on-deep-muted">{routing || (origin && dest) ? "Calculando a rota…" : origin ? "Agora escolha o destino final." : "Agora escolha a partida."}</p>
        </div>
      )}
    </div>
  );

  return (
    <section className="on-deep relative isolate overflow-hidden bg-deep text-on-deep">
      <OrbitArt dim={traveling} reduce={reduce} labels={cities.map((c) => c.name)} />

      <div className={`relative z-10 mx-auto grid w-full max-w-[1280px] gap-8 px-5 pt-24 pb-14 md:px-10 lg:min-h-[100svh] lg:grid-cols-[minmax(0,600px)_minmax(0,1fr)] lg:gap-12 lg:pt-28 lg:pb-16 ${traveling ? "lg:items-start" : "lg:items-center"}`}>
        <motion.div layout={!reduce} transition={{ layout: { duration: .8, ease: EASE } }} className="w-full">
          {/* Título: recolhe quando a pessoa escolhe um endereço */}
          <motion.div initial={false} animate={traveling ? { height: 0, opacity: 0, y: -24, filter: "blur(8px)" } : { height: "auto", opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: reduce ? 0 : .75, ease: EASE }} className="overflow-hidden" aria-hidden={traveling}>
            <p className="mono-label inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--on-deep)_12%,transparent)] px-3 py-1.5 text-on-deep-muted">
              <span className="relative grid size-2 place-items-center"><span className="pulse-ring absolute size-2 rounded-full bg-[#00E1FF]" /><span className="size-1.5 rounded-full bg-[#00E1FF]" /></span>
              {eyebrow}
            </p>
            <h1 className="display mt-7 text-[clamp(3rem,5.8vw,5.6rem)] leading-[.92]">
              {words.map((w, i) => (
                <motion.span key={w} className={`block pb-[.06em] ${i === words.length - 1 ? "text-grad" : ""}`} initial={reduce ? false : { opacity: 0, y: 28, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: .7, delay: .15 + i * .12, ease: EASE }}>{w}</motion.span>
              ))}
            </h1>
            <p className="mt-6 mb-8 max-w-[44ch] text-lg leading-relaxed text-on-deep-muted">{lead}</p>
          </motion.div>

          <motion.form id="pedir" onSubmit={submit} className="scroll-mt-24 rounded-[28px] border border-[color-mix(in_srgb,var(--on-deep)_10%,transparent)] bg-[color-mix(in_srgb,#0A1E3D_55%,transparent)] p-3 shadow-[0_40px_90px_-40px_rgb(3_86_197/.55)] backdrop-blur-xl sm:p-4"
            initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, delay: .5, ease: EASE }}>
            {/* No modo viagem, um título curto dentro do cartão, no lugar do grande */}
            <motion.div initial={false} animate={traveling ? { opacity: 1, height: "auto" } : { opacity: 0, height: 0 }} transition={{ duration: reduce ? 0 : .6, delay: traveling && !reduce ? .3 : 0, ease: EASE }}
              className="overflow-hidden" aria-hidden={!traveling}>
              <div className="flex items-center justify-between gap-3 px-1 pt-1 pb-3">
                <p className="display text-2xl">{origin && dest ? "Sua rota" : dest ? "De onde você sai?" : "Para onde vamos?"}</p>
                <button type="button" onClick={clear} tabIndex={traveling ? 0 : -1}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-on-deep-muted hover:bg-[color-mix(in_srgb,var(--on-deep)_10%,transparent)] hover:text-on-deep">
                  <Icon name="close" size={16} /> Limpar
                </button>
              </div>
            </motion.div>
            <div className="relative space-y-2.5 text-ink">
              <span aria-hidden="true" className="pointer-events-none absolute top-7 bottom-7 left-[21px] z-10 w-[1.5px] bg-primary" />
              <div className="relative focus-within:z-30">
                <span aria-hidden="true" className="pointer-events-none absolute top-[22px] left-4 z-20 block size-3 rounded-full border-[3px] border-primary bg-surface" />
                <PlaceSearch label="Local de partida" value={origin} onPick={(p) => { setOrigin(p); setLast("origin"); }} onClear={() => setOrigin(null)} near={near} inputClassName="!min-h-14 !bg-surface !pr-14 !pl-11 focus:relative" />
                <button type="button" onClick={locate} aria-label="Usar minha localização" className="absolute top-1.5 right-1.5 z-20 grid size-11 place-items-center rounded-full text-ink hover:bg-surface-2"><Icon name="locate" size={20} /></button>
              </div>
              <div className="relative focus-within:z-30">
                <span aria-hidden="true" className="pointer-events-none absolute top-[22px] left-4 z-20 block size-3 rounded-[3px] bg-primary" />
                <PlaceSearch label="Local de chegada" inputId="destino-site" value={dest} onPick={(p) => { setDest(p); setLast("dest"); }} onClear={() => setDest(null)} near={near} inputClassName="!min-h-14 !bg-surface !pl-11" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3 px-1">
              <button className="btn btn-lg btn-on-deep">Ver preços <Icon name="arrow" size={18} /></button>
              {!signedIn && <Link href="/entrar" className="border-b border-current pb-0.5 text-sm font-semibold">Já tem conta? Entre</Link>}
            </div>
          </motion.form>
          {traveling && (
            <motion.div className="mt-3 space-y-2" aria-live="polite" initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6, delay: reduce ? 0 : .45, ease: EASE }}>
              {shown && <div className="glass-map rounded-2xl"><PlacePreview place={shown} role={shownIsOrigin ? "Partida" : "Destino final"} variant="deep" inArea={trip ? (shownIsOrigin ? trip.originInArea : trip.destInArea) : undefined} /></div>}
              {panel}
            </motion.div>
          )}
          {note && <p className="mt-3 rounded-xl bg-[color-mix(in_srgb,var(--on-deep)_6%,transparent)] px-3 py-2 text-sm text-on-deep-muted">{note}</p>}
          {error && <div className="mt-3 rounded-xl bg-surface"><ErrorNote>{error}</ErrorNote></div>}
          {!passenger && !traveling && <p className="mt-3 text-sm text-on-deep-muted">{signedIn ? "Para pedir uma viagem, use uma conta de passageiro." : "Rota, tempo e preço estimado aparecem na hora, sem cadastro."}</p>}
          {cities.length > 1 && !traveling && (
            <div className="mt-7" role="group" aria-label="Escolher a cidade">
              <p className="mono-label mb-2.5 text-on-deep-muted">Sua cidade</p>
              <div className="flex flex-wrap gap-2">
                {cities.map((c) => (
                  <button key={c.id} type="button" aria-pressed={c.id === cityId} onClick={() => setCityId(c.id)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${c.id === cityId ? "bg-on-deep text-deep" : "shadow-[0_0_0_1px_color-mix(in_srgb,var(--on-deep)_22%,transparent)_inset] hover:bg-[color-mix(in_srgb,var(--on-deep)_8%,transparent)]"}`}>
                    {c.name}
                  </button>
                ))}
              </div>
              {city?.slug && <Link href={`/cidades/${city.slug}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-on-deep-muted underline-offset-4 hover:text-on-deep hover:underline">Tarifas e destinos de {city.name} <Icon name="arrow" size={16} /></Link>}
            </div>
          )}
        </motion.div>

        {/* Lado direito: em repouso, só a arte e o pulso da cidade; com endereço, a janela do mapa */}
        <div className="relative min-h-0 lg:h-[calc(100svh-11rem)] lg:self-center">
          <AnimatePresence>
            {!traveling && live && (
              <motion.p key="pulse" role="status" data-testid="pulse" initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute right-0 bottom-6 hidden items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--on-deep)_12%,transparent)] bg-[color-mix(in_srgb,var(--deep)_55%,transparent)] px-4 py-2.5 text-sm font-semibold backdrop-blur-md lg:flex">
                <span className="relative grid size-2 place-items-center"><span className="pulse-ring absolute size-2 rounded-full bg-[#5BD49B]" /><span className="size-2 rounded-full bg-[#5BD49B]" /></span>{live}
              </motion.p>
            )}
            {traveling && (
              <motion.div key="map" className="relative h-[460px] overflow-hidden rounded-[32px] border border-[color-mix(in_srgb,var(--on-deep)_12%,transparent)] bg-[#E9EEF5] shadow-[0_50px_120px_-40px_rgb(3_86_197/.6)] lg:h-full"
                initial={reduce ? false : { clipPath: "circle(0% at 85% 85%)", opacity: 0 }} animate={{ clipPath: "circle(150% at 85% 85%)", opacity: 1 }}
                exit={reduce ? undefined : { clipPath: "circle(0% at 85% 85%)", opacity: 0 }} transition={{ duration: reduce ? 0 : 1.1, ease: EASE }}>
                <MapView cooperative tilt={45} areas={areas} points={points} route={trip?.geometry ?? null}
                  focus={city ? { lat: city.lat, lng: city.lng, zoom: 13.5 } : null}
                  padding={{ top: 70, bottom: 70, left: 60, right: 60 }}
                  className="size-full !bg-transparent" ariaLabel="Mapa da sua rota no Vale do Aço" />

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
