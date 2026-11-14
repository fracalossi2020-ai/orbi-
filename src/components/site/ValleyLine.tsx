"use client";
import { useId, useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "motion/react";
import { api } from "@/components/ui";
import type { Place } from "@/components/PlaceSearch";
import { DEST_EVENT } from "./Hero";

/**
 * Vale do Aço em panorama: as três cidades desenhadas pelo que cada uma tem de seu
 * (a mata e o inox de Timóteo, a Serra dos Cocais em Fabriciano, a usina e o Parque Ipanema em Ipatinga),
 * ligadas pela estrada e pelo Rio Piracicaba. Um carro percorre a estrada conforme a pessoa rola a página.
 * Tocar num bairro faz dele o destino no pedido do topo.
 */
type Stop = { name: string; city: string };
const LINE: Stop[] = [
  { name: "Primavera", city: "Timóteo" }, { name: "John Kennedy", city: "Timóteo" }, { name: "Timirim", city: "Timóteo" },
  { name: "Senador Melo Viana", city: "Coronel Fabriciano" }, { name: "Caladinho", city: "Coronel Fabriciano" }, { name: "Centro", city: "Coronel Fabriciano" },
  { name: "Cariru", city: "Ipatinga" }, { name: "Horto", city: "Ipatinga" }, { name: "Bom Retiro", city: "Ipatinga" }, { name: "Iguaçu", city: "Ipatinga" },
  { name: "Cidade Nobre", city: "Ipatinga" }, { name: "Bethânia", city: "Ipatinga" }, { name: "Veneza", city: "Ipatinga" }, { name: "Canaã", city: "Ipatinga" },
];

const ZONES = [
  { city: "Timóteo", x0: 30, x1: 385, note: "Inox e Mata Atlântica" },
  { city: "Coronel Fabriciano", x0: 400, x1: 730, note: "Serra dos Cocais" },
  { city: "Ipatinga", x0: 745, x1: 1170, note: "Usina e Parque Ipanema" },
];

const W = 1200, H = 480, BASE = 372;
/** Arredonda a 1 casa: servidor e navegador calculam senos com diferenças na última casa decimal. */
const r1 = (v: number) => Math.round(v * 10) / 10;
const road = (x: number) => r1(382 + 9 * Math.sin(x / 170) + 4 * Math.sin(x / 61));
const river = (x: number) => r1(road(x) + 54 + 6 * Math.sin(x / 95 + 1));
const line = (f: (x: number) => number, from = 0, to = W, step = 8) => {
  let d = `M${from},${f(from).toFixed(1)}`;
  for (let x = from + step; x <= to; x += step) d += ` L${x},${f(x).toFixed(1)}`;
  return d;
};
/** Números pseudoaleatórios fixos: o desenho sai igual no servidor e no navegador. */
const rnd = (i: number) => {
  let h = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) % 1000 / 1000;
};
const mix = (a: string, pct: number, b = "var(--bg)") => `color-mix(in srgb, ${a} ${pct}%, ${b})`;

/* ---------- Paisagem ---------- */

function Ridges() {
  // Ao fundo, morros do vale; atrás de Fabriciano, os picos da Serra dos Cocais.
  const far = (x: number) => 238 - 112 * Math.exp(-(((x - 520) / 70) ** 2)) - 92 * Math.exp(-(((x - 640) / 60) ** 2)) - 40 * Math.sin(x / 120) * 0.5 - 30 * Math.exp(-(((x - 1000) / 160) ** 2));
  const near = (x: number) => 292 - 26 * Math.sin(x / 90 + 2) - 18 * Math.exp(-(((x - 180) / 120) ** 2));
  return (
    <g>
      <path d={`${line(far)} L${W},${H} L0,${H}Z`} fill={mix("var(--ink)", 6)} />
      <path d={`${line(near)} L${W},${H} L0,${H}Z`} fill={mix("var(--ink)", 9)} />
    </g>
  );
}

function Forest({ x0, x1, seed }: { x0: number; x1: number; seed: number }) {
  const trees = [];
  for (let i = 0, x = x0; x < x1; i++, x += 11 + rnd(seed + i) * 7) {
    const r = 13 + rnd(seed + i * 3) * 12;
    trees.push(<circle key={`b${i}`} cx={x} cy={BASE - 26 - rnd(seed + i * 7) * 26} r={r} fill={mix("var(--primary)", 30)} />);
  }
  for (let i = 0, x = x0 + 6; x < x1 - 4; i++, x += 13 + rnd(seed + 50 + i) * 6) {
    const r = 11 + rnd(seed + 90 + i) * 8;
    trees.push(<circle key={`f${i}`} cx={x} cy={BASE - 8 - rnd(seed + 70 + i) * 12} r={r} fill={mix("var(--primary)", 46)} />);
  }
  return <g>{trees}</g>;
}

/** Galpões de teto em serra, cor de aço escovado; um brilho passa por eles de tempos em tempos. */
function InoxPlant({ id }: { id: string }) {
  const shed = (x: number, w: number, h: number) => {
    let d = `M${x},${BASE} V${BASE - h}`;
    for (let t = x; t < x + w - 1; t += 16) d += ` l12,-12 v12 h4`;
    return `${d} V${BASE} Z`;
  };
  const sheds = [shed(222, 64, 40), shed(272, 80, 54), shed(334, 48, 34)];
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-inox`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix("var(--ink)", 34)} />
          <stop offset=".5" stopColor={mix("var(--ink)", 16)} />
          <stop offset="1" stopColor={mix("var(--ink)", 26)} />
        </linearGradient>
        <clipPath id={`${id}-sheds`}>{sheds.map((d) => <path key={d} d={d} />)}<rect x={300} y={232} width={10} height={BASE - 232} /></clipPath>
      </defs>
      <rect x={300} y={232} width={10} height={BASE - 232} fill={`url(#${id}-inox)`} />
      {[0, 1, 2].map((i) => <rect key={i} x={300} y={240 + i * 12} width={10} height={4} fill={mix("var(--primary)", 55)} />)}
      {sheds.map((d) => <path key={d} d={d} fill={`url(#${id}-inox)`} />)}
      <g clipPath={`url(#${id}-sheds)`}>
        <rect className="inox-glint" x={150} y={200} width={26} height={200} fill="#fff" opacity={0.45} transform="skewX(-22)" />
      </g>
    </g>
  );
}

/** Casas subindo o morro, com a igreja no alto. */
function Hillside() {
  const x0 = 430, x1 = 720, top = 268;
  const hill = (x: number) => r1(BASE - (BASE - top) * Math.sin(Math.PI * Math.min(Math.max((x - x0) / (x1 - x0), 0), 1)) ** 1.3);
  const houses = [];
  let k = 0;
  for (let row = 0; row < 4; row++) {
    for (let x = x0 + 18 + (row % 2) * 9; x < x1 - 22; x += 22 + rnd(k) * 6, k++) {
      const by = hill(x) + 8 + row * 22;
      if (by > BASE - 4 || Math.abs(x - 575) < 18 && row === 0) continue;
      const w = 13 + rnd(k + 5) * 6, h = 9 + rnd(k + 9) * 6;
      houses.push(
        <g key={k}>
          <rect x={x - w / 2} y={by - h} width={w} height={h} fill={mix("var(--ink)", 17 + row * 3)} />
          <path d={`M${x - w / 2 - 2},${by - h} L${x},${by - h - 7} L${x + w / 2 + 2},${by - h}Z`} fill={mix("var(--primary)", 40 + row * 6)} />
          {rnd(k + 13) > 0.45 && <rect x={x - 2} y={by - h + 3} width={4} height={4} className="valley-window" fill="var(--mark)" />}
        </g>,
      );
    }
  }
  const cy = hill(575);
  return (
    <g>
      <path d={`${line(hill, x0 - 30, x1 + 30, 6)} L${x1 + 30},${BASE + 20} L${x0 - 30},${BASE + 20}Z`} fill={mix("var(--ink)", 12)} />
      {houses}
      <g>
        <rect x={566} y={cy - 26} width={20} height={22} fill={mix("var(--ink)", 26)} />
        <path d={`M564,${cy - 26} L576,${cy - 36} L588,${cy - 26}Z`} fill={mix("var(--ink)", 32)} />
        <rect x={570} y={cy - 54} width={8} height={30} fill={mix("var(--ink)", 30)} />
        <path d={`M574,${cy - 66} v10 M570.5,${cy - 62} h7`} stroke={mix("var(--ink)", 40)} strokeWidth={1.8} />
        <rect x={572} y={cy - 16} width={6} height={12} rx={3} fill="var(--mark)" className="valley-window" />
      </g>
    </g>
  );
}

/** Usina: alto-forno com brilho de aço derretido, chaminés soltando vapor e galpões. */
function SteelWorks({ id }: { id: string }) {
  const steel = mix("var(--ink)", 28);
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-melt`} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#FF9A4D" stopOpacity=".85" />
          <stop offset=".45" stopColor="#F2683A" stopOpacity=".35" />
          <stop offset="1" stopColor="#F2683A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse className="melt-glow" cx={806} cy={BASE - 8} rx={70} ry={34} fill={`url(#${id}-melt)`} />
      {/* chaminés */}
      {[[868, 188], [890, 206], [912, 222]].map(([x, top], i) => (
        <g key={x}>
          {[0, 1, 2].map((p) => <circle key={p} className="steam" style={{ animationDelay: `${i * 1.3 + p * 2.2}s` }} cx={x + 4} cy={top - 6} r={9} fill={mix("var(--ink)", 14)} />)}
          <rect x={x} y={top} width={9} height={BASE - top} fill={steel} />
          <rect x={x} y={top + 8} width={9} height={4} fill={mix("var(--primary)", 50)} />
        </g>
      ))}
      {/* alto-forno */}
      <path d={`M792,${BASE} L796,250 L820,250 L824,${BASE}Z`} fill={mix("var(--ink)", 32)} />
      <path d="M794,250 L800,224 L816,224 L822,250Z" fill={mix("var(--ink)", 26)} />
      <path d="M808,224 V196 M808,206 H846 V246" fill="none" stroke={steel} strokeWidth={5} />
      <path d={`M772,${BASE} V270 H794`} fill="none" stroke={steel} strokeWidth={5} />
      <rect x={803} y={BASE - 30} width={10} height={22} rx={2} fill="#FFB067" className="melt-glow" />
      {/* galpões */}
      <rect x={830} y={BASE - 46} width={120} height={46} fill={mix("var(--ink)", 20)} />
      <path d={`M826,${BASE - 46} L890,${BASE - 62} L954,${BASE - 46}Z`} fill={mix("var(--ink)", 24)} />
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={842 + i * 22} y={BASE - 34} width={12} height={5} className="valley-window" fill="var(--mark)" />)}
    </g>
  );
}

/** Centro de Ipatinga: prédios com janelas acesas. */
function Downtown() {
  const blocks = [[962, 30, 92], [994, 26, 128], [1022, 32, 104], [1056, 24, 76]];
  return (
    <g>
      {blocks.map(([x, w, h], b) => (
        <g key={x}>
          <rect x={x} y={BASE - h} width={w} height={h} fill={mix("var(--ink)", 18 + b * 3)} />
          {Array.from({ length: Math.floor((h - 14) / 12) }).flatMap((_, r) => [0, 1].map((c) => rnd(b * 40 + r * 2 + c) > 0.5
            ? <rect key={`${r}-${c}`} x={x + 6 + c * (w - 18)} y={BASE - h + 8 + r * 12} width={6} height={5} className="valley-window" fill="var(--mark)" style={{ animationDelay: `${rnd(r + b) * 6}s` }} />
            : null))}
        </g>
      ))}
    </g>
  );
}

function Park() {
  return (
    <g>
      <ellipse cx={1128} cy={BASE - 4} rx={40} ry={7} fill={mix("var(--primary)", 32)} />
      <Forest x0={1086} x1={1168} seed={400} />
    </g>
  );
}

/** Carro visto de lado, na cor da marca. */
function Car() {
  return (
    <g transform="translate(-24,-19)">
      <ellipse cx={24} cy={19} rx={22} ry={2.5} fill="#000" opacity={0.2} />
      <path d="M3,14 C3,10 6,9 10,8.5 L15,3.5 C16.5,2 18,1.5 21,1.5 H31 C34,1.5 35.5,2.5 37,4.5 L40,8.5 C44,9 46,10.5 46,13.5 V15 C46,16 45,17 44,17 H5 C3.8,17 3,16 3,15Z" fill="var(--primary)" />
      <path d="M17,4.5 C18,3.6 19,3.4 21,3.4 H25 V8.5 H13Z M27,3.4 H31 C33,3.4 34,4 35,5.4 L37.2,8.5 H27Z" fill={mix("var(--bg)", 80, "var(--primary)")} />
      <circle cx={13} cy={17} r={4} fill={mix("var(--ink)", 80)} /><circle cx={13} cy={17} r={1.6} fill="var(--bg)" />
      <circle cx={37} cy={17} r={4} fill={mix("var(--ink)", 80)} /><circle cx={37} cy={17} r={1.6} fill="var(--bg)" />
      <path d="M46,11 L60,8 V16Z" fill="var(--mark)" opacity={0.35} />
      <rect x={44.5} y={10.5} width={2.5} height={2.5} rx={1} fill="#FFE7A3" />
    </g>
  );
}

export function ValleyLine({ activeCities }: { activeCities: string[] }) {
  const uid = useId().replace(/:/g, "");
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 35%"] });
  const p = useTransform(scrollYProgress, [0, 1], reduce ? [0.5, 0.5] : [0, 1]);
  const carX = useTransform(p, (v) => 40 + v * (W - 80));
  const carTransform = useTransform(carX, (x) => {
    const slope = (road(x + 2) - road(x - 2)) / 4;
    return `translate(${x}px, ${road(x) - 2}px) rotate(${(Math.atan(slope) * 180) / Math.PI}deg)`;
  });
  const chipLeft = useTransform(carX, (x) => `${(x / W) * 100}%`);
  const chipTop = useTransform(carX, (x) => `${((road(x) - 40) / H) * 100}%`);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [near, setNear] = useState<string | null>(null);

  const stops = LINE.filter((s) => activeCities.includes(s.city));
  const zones = ZONES.filter((z) => stops.some((s) => s.city === z.city));
  const placed = ZONES.flatMap((z) => {
    const group = stops.filter((s) => s.city === z.city);
    const span = z.x1 - z.x0 - 60;
    return group.map((s, i) => { const x = z.x0 + 30 + (group.length === 1 ? span / 2 : (span * i) / (group.length - 1)); return { ...s, x, y: road(x) }; });
  });

  useMotionValueEvent(carX, "change", (x) => {
    const passed = placed.filter((s) => s.x <= x + 14).at(-1);
    const zone = ZONES.find((z) => x >= z.x0 - 8 && x <= z.x1 + 8);
    setNear(passed && Math.abs(passed.x - x) < 70 ? passed.name : zone?.city ?? null);
  });

  if (!stops.length) return null;
  const many = zones.length > 1;

  const go = async (s: Stop) => {
    setBusy(s.name); setMsg(null);
    try {
      const r = await api<{ places: Place[] }>(`/api/geo/search?q=${encodeURIComponent(`${s.name}, ${s.city}`)}`);
      const plain = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      const hit = r.places.find((p) => p.inArea && p.kind === "area" && plain(p.label).includes(plain(s.name)))
        ?? r.places.find((p) => p.inArea && plain(`${p.label} ${p.detail ?? ""}`).includes(plain(s.name)));
      if (!hit) { setMsg(`Não encontramos ${s.name} no mapa agora. Digite o endereço no topo da página.`); return; }
      dispatchEvent(new CustomEvent(DEST_EVENT, { detail: hit }));
    } catch {
      setMsg("A busca de endereços não respondeu. Tente de novo em instantes.");
    } finally { setBusy(null); }
  };

  const dim = (city: string) => (activeCities.includes(city) ? 1 : 0.28);

  return (
    <section aria-labelledby="linha-titulo" className="relative overflow-hidden bg-bg text-ink">
      <div className="relative mx-auto max-w-[1440px] px-5 pt-20 pb-16 md:px-10 md:pt-28">
        <div className="grid gap-6 md:grid-cols-[1.2fr_1fr] md:items-end">
          <div>
            <p className="mono-label text-brand">Vale do Aço</p>
            <h2 id="linha-titulo" className="display mt-3 text-[clamp(2.4rem,5.4vw,4.8rem)] leading-[.95]">
              {many ? <>Do inox de Timóteo <span className="text-brand">ao aço de Ipatinga.</span></> : <>{zones[0].city}, <span className="text-brand">de ponta a ponta.</span></>}
            </h2>
          </div>
          <p className="max-w-[46ch] text-muted md:justify-self-end">
            Role a página e acompanhe o carro pela estrada do Vale. Toque num bairro, no desenho ou na lista, e ele vira o destino da sua viagem.
          </p>
        </div>
      </div>

      {/* Panorama: no celular, arraste para o lado para ver as três cidades */}
      <div className="relative overflow-x-auto overscroll-x-contain [scrollbar-width:none] md:overflow-visible">
        <div ref={ref} className="relative mx-auto w-[960px] max-w-none md:w-full md:max-w-[1440px] md:px-10">
          <div className="relative" style={{ aspectRatio: `${W} / ${H}` }}>
            <svg viewBox={`0 0 ${W} ${H}`} className="valley-fade absolute inset-0 size-full" aria-hidden="true">
              <Ridges />
              <g opacity={dim("Timóteo")}><Forest x0={40} x1={212} seed={1} /><InoxPlant id={uid} /></g>
              <g opacity={dim("Coronel Fabriciano")}><Hillside /></g>
              <g opacity={dim("Ipatinga")}><SteelWorks id={uid} /><Downtown /><Park /></g>
              {/* chão, rio e estrada */}
              <path d={`${line((x) => road(x) - 8)} L${W},${H} L0,${H}Z`} fill={mix("var(--ink)", 7)} />
              <path d={line(river)} fill="none" stroke={mix("var(--primary)", 42)} strokeWidth={16} strokeLinecap="round" />
              <path d={line(river)} className="river-flow" fill="none" stroke={mix("var(--bg)", 70, "var(--primary)")} strokeWidth={2} strokeDasharray="10 34" strokeLinecap="round" />
              <path d={line(road)} fill="none" stroke={mix("var(--ink)", 26)} strokeWidth={20} strokeLinecap="round" />
              <path d={line(road)} fill="none" stroke="var(--mark)" strokeWidth={2} strokeDasharray="12 12" opacity={0.8} />
              <motion.g style={{ transform: carTransform }}><Car /></motion.g>
            </svg>

            {/* Nomes das cidades sobre o desenho */}
            {ZONES.map((z) => (
              <div key={z.city} className="pointer-events-none absolute top-[3%]" style={{ left: `${(z.x0 / W) * 100}%`, opacity: dim(z.city) }}>
                <p className="display text-[clamp(1.25rem,2.4vw,2rem)] leading-none">{z.city}</p>
                <p className="mono-label mt-1.5 text-muted">{z.note}</p>
              </div>
            ))}
            <p aria-hidden="true" className="mono-label pointer-events-none absolute text-[10px] text-brand" style={{ left: `${(120 / W) * 100}%`, top: `${((river(120) + 14) / H) * 100}%` }}>Rio Piracicaba</p>

            {/* Por onde o carro está passando */}
            {near && (
              <motion.div aria-hidden="true" style={{ left: chipLeft, top: chipTop }} className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full">
                <span className="block rounded-full bg-deep px-3 py-1 text-xs font-semibold whitespace-nowrap text-on-deep shadow-lg">{near}</span>
              </motion.div>
            )}

            {/* Bairros na estrada */}
            {placed.map((s) => (
              <button key={s.name + s.city} type="button" onClick={() => go(s)} aria-label={`Ir para ${s.name}, ${s.city}`}
                style={{ left: `${(s.x / W) * 100}%`, top: `${(s.y / H) * 100}%` }}
                className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full p-2.5">
                <span className={`block size-3.5 rounded-full border-[3px] border-primary bg-surface transition-transform duration-200 group-hover:scale-150 group-focus-visible:scale-150 ${busy === s.name ? "animate-pulse" : ""}`} />
                <span className="pointer-events-none absolute top-full left-1/2 mt-1 -translate-x-1/2 rounded-md bg-surface px-2 py-0.5 text-xs font-semibold whitespace-nowrap opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  {busy === s.name ? "Buscando…" : s.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mono-label px-5 pt-2 text-center text-muted md:hidden">Arraste para o lado para ver as três cidades</p>

      {/* Lista de bairros, por cidade */}
      <div className="relative mx-auto max-w-[1440px] px-5 pt-8 pb-20 md:px-10 md:pb-28">
        <div className={`grid gap-6 ${many ? "md:grid-cols-3" : ""}`}>
          {zones.map((z) => (
            <div key={z.city}>
              <p className="text-sm font-semibold text-muted">{z.city}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {stops.filter((s) => s.city === z.city).map((s) => (
                  <li key={s.name}>
                    <button type="button" onClick={() => go(s)}
                      className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors hover:border-primary hover:bg-surface-2 ${near === s.name ? "border-primary bg-surface-2" : "border-line"}`}>
                      {busy === s.name ? "Buscando…" : s.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm text-muted">Esses são só alguns bairros: a Orbi atende a área inteira das cidades.</p>
        <p role="status" className="mt-2 min-h-6 text-sm text-warn">{msg}</p>
      </div>
    </section>
  );
}
