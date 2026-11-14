"use client";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon } from "@/components/Icon";
import { brl } from "@/domain/pricing";

/** Tudo aqui é demonstração: mapa esquemático, pontos ilustrativos e valores fictícios. Nada chama o backend. */
const PLACES = [
  { name: "Centro, Ipatinga", x: 610, y: 120 }, { name: "Horto, Ipatinga", x: 690, y: 190 }, { name: "Cariru, Ipatinga", x: 540, y: 190 },
  { name: "Centro, Coronel Fabriciano", x: 340, y: 250 }, { name: "Giovannini, Coronel Fabriciano", x: 410, y: 320 },
  { name: "Centro, Timóteo", x: 200, y: 400 }, { name: "Olaria, Timóteo", x: 300, y: 450 },
];
const CATEGORIES = [
  { id: "essencial", name: "Essencial", note: "Até 4 pessoas", icon: "car", k: 1 },
  { id: "conforto", name: "Conforto", note: "Mais espaço", icon: "car", k: 1.32 },
  { id: "familia", name: "Família", note: "Até 6 pessoas", icon: "users", k: 1.7 },
];

function resolve(text: string, fallbackSeed: number) {
  const t = text.trim().toLowerCase();
  const known = PLACES.find((p) => p.name.toLowerCase() === t) ?? PLACES.find((p) => t && p.name.toLowerCase().includes(t));
  if (known) return known;
  // Texto livre: escolhe um ponto do mapa de forma estável. É ilustração, não busca de endereço.
  let hash = fallbackSeed;
  for (const c of t) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return { ...PLACES[hash % PLACES.length], name: text.trim() };
}

function pathBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
  const midX = (a.x + b.x) / 2;
  return `M${a.x} ${a.y} C ${midX + 50} ${a.y + 12}, ${midX - 50} ${b.y - 12}, ${b.x} ${b.y}`;
}

export function RideDemo() {
  const [from, setFrom] = useState("Centro, Ipatinga");
  const [to, setTo] = useState("Centro, Timóteo");
  const [category, setCategory] = useState("essencial");
  const [shown, setShown] = useState<{ a: { x: number; y: number; name: string }; b: { x: number; y: number; name: string } } | null>(null);
  const reduce = useReducedMotion();
  const list = useId();

  const show = (e: React.FormEvent) => {
    e.preventDefault();
    const a = resolve(from || "Centro, Ipatinga", 7);
    let b = resolve(to || "Centro, Timóteo", 13);
    if (a.x === b.x && a.y === b.y) b = { ...PLACES[(PLACES.findIndex((p) => p.x === a.x) + 3) % PLACES.length], name: b.name };
    setShown({ a, b });
  };

  const trip = useMemo(() => {
    if (!shown) return null;
    const px = Math.hypot(shown.a.x - shown.b.x, shown.a.y - shown.b.y);
    const kmEst = Math.max(2, px / 28);
    return { kmEst, min: Math.round(kmEst * 2.2 + 3) };
  }, [shown]);
  const fictitious = (k: number) => Math.round((400 + (trip?.kmEst ?? 0) * 190 + (trip?.min ?? 0) * 30) * k / 50) * 50;

  return (
    <section id="demonstracao" className="bg-bg">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-24 md:px-10 md:py-32 lg:grid-cols-[minmax(340px,5fr)_7fr] lg:gap-14">
        <div>
          <h2 className="display text-[clamp(2.2rem,5vw,4.2rem)]">Veja o preço antes de pedir.</h2>
          <p className="mt-4 max-w-md text-muted">Experimente o caminho de um pedido: de onde, para onde e quanto custa.</p>

          <form onSubmit={show} className="mt-8 space-y-3">
            <datalist id={list}>{PLACES.map((p) => <option key={p.name} value={p.name} />)}</datalist>
            <label className="block"><span className="mb-1 block text-sm font-semibold">Partida de exemplo</span>
              <input className="input" list={list} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Ex.: Centro, Ipatinga" /></label>
            <label className="block"><span className="mb-1 block text-sm font-semibold">Destino de exemplo</span>
              <input className="input" list={list} value={to} onChange={(e) => setTo(e.target.value)} placeholder="Ex.: Centro, Timóteo" /></label>
            <button className="btn btn-primary w-full" type="submit"><Icon name="route" size={18} /> Ver rota de exemplo</button>
          </form>

          <AnimatePresence>
            {trip && (
              <motion.div initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mt-5">
                <div role="radiogroup" aria-label="Categoria" className="space-y-2">
                  {CATEGORIES.map((c) => (
                    <button key={c.id} type="button" role="radio" aria-checked={category === c.id} onClick={() => setCategory(c.id)}
                      className={`flex w-full items-center gap-3 rounded-[min(var(--r),14px)] p-3 text-left transition-shadow ${category === c.id ? "bg-surface shadow-[0_0_0_2px_var(--primary)_inset]" : "bg-surface shadow-[0_0_0_1px_var(--line)_inset]"}`}>
                      <Icon name={c.icon} />
                      <span className="flex-1"><span className="block font-semibold">{c.name}</span><span className="text-sm text-muted">{c.note}</span></span>
                      <span className="text-right"><span className="num block font-semibold">{brl(fictitious(c.k))}</span><span className="text-xs text-muted">fictício</span></span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 rounded-xl border border-dashed border-line p-3 text-sm text-muted">
                  <strong className="text-ink">Demonstração.</strong> Rota ilustrativa e valores fictícios. Nenhuma corrida é solicitada e nada é cobrado.
                </p>
                <Link href="/cadastro?perfil=passageiro" className="btn btn-ghost mt-3 w-full">Criar minha conta para viajar</Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="card relative min-h-[380px] overflow-hidden bg-surface lg:min-h-[640px]">
          <span className="absolute top-4 left-4 z-10 rounded-full bg-deep px-3 py-1 text-xs font-semibold text-on-deep">Mapa esquemático · demonstração</span>
          <svg viewBox="0 0 800 560" className="absolute inset-0 size-full" preserveAspectRatio="xMidYMid slice" role="img" aria-label={shown ? `Rota ilustrativa de ${shown.a.name} até ${shown.b.name}` : "Mapa esquemático do Vale do Aço"}>
            <rect width="800" height="560" fill="var(--surface)" />
            <path d="M-20 490 C 120 470, 180 320, 300 300 S 520 260, 560 150 S 720 20, 830 10" fill="none" stroke="var(--surface-2)" strokeWidth="34" strokeLinecap="round" />
            {[80, 160, 240, 320, 400, 480].map((y) => <path key={y} d={`M0 ${y} H800`} stroke="var(--line)" strokeOpacity=".45" />)}
            {[100, 200, 300, 400, 500, 600, 700].map((x) => <path key={x} d={`M${x} 0 V560`} stroke="var(--line)" strokeOpacity=".45" />)}
            <path d="M120 540 L300 370 L420 290 L620 180 L780 40" fill="none" stroke="var(--line)" strokeWidth="7" strokeLinecap="round" />
            {[["Ipatinga", 610, 80], ["Coronel Fabriciano", 330, 215], ["Timóteo", 190, 365]].map(([t, x, y]) => (
              <text key={String(t)} x={Number(x)} y={Number(y)} textAnchor="middle" fill="var(--muted)" fontSize="15" fontWeight="600">{t}</text>
            ))}
            {PLACES.map((p) => <circle key={p.name} cx={p.x} cy={p.y} r="4" fill="var(--muted)" opacity=".5" />)}
            {shown && (
              <g key={`${shown.a.x}-${shown.b.x}-${shown.a.y}-${shown.b.y}`}>
                <motion.path d={pathBetween(shown.a, shown.b)} fill="none" stroke="var(--primary)" strokeWidth="6" strokeLinecap="round"
                  initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.3, ease: "easeInOut" }} />
                <circle cx={shown.a.x} cy={shown.a.y} r="9" fill="var(--accent)" stroke="var(--surface)" strokeWidth="3" />
                <circle cx={shown.b.x} cy={shown.b.y} r="11" fill="var(--primary)" stroke="var(--surface)" strokeWidth="3" />
                {!reduce && (
                  <circle r="7" fill="var(--surface)" stroke="var(--primary)" strokeWidth="3">
                    <animateMotion dur="3.6s" repeatCount="indefinite" path={pathBetween(shown.a, shown.b)} />
                  </circle>
                )}
              </g>
            )}
          </svg>
          {trip && (
            <div className="absolute right-4 bottom-4 rounded-2xl bg-deep px-4 py-3 text-on-deep">
              <p className="num text-lg font-semibold">{trip.kmEst.toFixed(1).replace(".", ",")} km · {trip.min} min</p>
              <p className="text-xs text-on-deep-muted">Estimativa fictícia</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
