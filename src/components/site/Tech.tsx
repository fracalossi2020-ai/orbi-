"use client";
import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon } from "@/components/Icon";
import { brl } from "@/domain/pricing";
import { DEFAULT_WEIGHTS, rankCandidates, type Candidate } from "@/domain/dispatch";

const TABS = [
  { id: "mapas", icon: "map", name: "Mapas", text: "O mapa é o centro da experiência: origem, destino e o carro no mesmo lugar, do pedido à chegada." },
  { id: "rotas", icon: "route", name: "Rotas", text: "Distância e tempo vêm da rota calculada. Se o serviço de rotas falhar, a estimativa aparece marcada como estimativa." },
  { id: "geo", icon: "locate", name: "Geolocalização", text: "Sua posição é usada para o pedido e para a viagem. Sempre com sua autorização no aparelho." },
  { id: "dispatch", icon: "scale", name: "Inteligência de distribuição", text: "A corrida não vai só para o carro mais próximo: quem está parado há mais tempo e ganhou menos no dia também conta." },
  { id: "money", icon: "receipt", name: "Transparência financeira", text: "Antes de aceitar, o motorista vê o valor bruto, a comissão e o que fica para ele." },
  { id: "safe", icon: "shield", name: "Segurança", text: "Documentos validados, viagem compartilhável, botão de emergência e histórico de ocorrências." },
];

function MapPane() {
  return (
    <svg viewBox="0 0 400 300" className="size-full" aria-hidden="true">
      {[50, 100, 150, 200, 250].map((y) => <path key={y} d={`M0 ${y}H400`} stroke="var(--on-deep)" strokeOpacity=".12" />)}
      {[80, 160, 240, 320].map((x) => <path key={x} d={`M${x} 0V300`} stroke="var(--on-deep)" strokeOpacity=".12" />)}
      <path d="M0 240 L120 170 L220 190 L400 60" stroke="var(--on-deep)" strokeOpacity=".3" strokeWidth="8" fill="none" />
      <circle cx="220" cy="190" r="26" fill="var(--on-deep-muted)" opacity=".2" className="pulse-ring" style={{ transformOrigin: "220px 190px" }} />
      <circle cx="220" cy="190" r="7" fill="var(--on-deep-muted)" />
    </svg>
  );
}
function RoutePane() {
  return (
    <svg viewBox="0 0 400 300" className="size-full" aria-hidden="true">
      <motion.path d="M50 250 C 120 250, 110 150, 190 150 S 270 60, 350 50" fill="none" stroke="var(--on-deep-muted)" strokeWidth="6" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4 }} />
      <circle cx="50" cy="250" r="8" fill="var(--on-deep)" /><circle cx="350" cy="50" r="10" fill="var(--on-deep-muted)" />
    </svg>
  );
}
function GeoPane() {
  return (
    <svg viewBox="0 0 400 300" className="size-full" aria-hidden="true">
      {[0, .6, 1.2].map((d) => <circle key={d} cx="200" cy="150" r="40" fill="none" stroke="var(--on-deep-muted)" className="pulse-ring" style={{ transformOrigin: "200px 150px", animationDelay: `${d}s` }} />)}
      <circle cx="200" cy="150" r="11" fill="var(--on-deep-muted)" stroke="var(--deep)" strokeWidth="3" />
    </svg>
  );
}

/** Usa o algoritmo real de distribuição com três motoristas de exemplo. */
function DispatchPane() {
  const [fairness, setFairness] = useState(35);
  const ride = { origin: { lat: -19.47, lng: -42.54 }, categoryId: "c", regionId: "r", driverNetCents: 1800 };
  const base = { online: true, approved: true, busy: false, categoryIds: ["c"], regionId: "r", locationAgeS: 5, offersTotal: 0, offersAccepted: 0, cancelsTotal: 0, ridesTotal: 0, ratingSum: 0, ratingCount: 0, declinedThisRide: false };
  const cands: (Candidate & { label: string; desc: string })[] = [
    { ...base, driverId: "a", label: "Motorista A", desc: "600 m · 2 min parado · muitos ganhos hoje", lat: -19.4745, lng: -42.54, idleS: 120, earnedTodayCents: 26000 },
    { ...base, driverId: "b", label: "Motorista B", desc: "1,4 km · 20 min parado · ganhos médios", lat: -19.4825, lng: -42.54, idleS: 1200, earnedTodayCents: 12000 },
    { ...base, driverId: "c", label: "Motorista C", desc: "2,3 km · 35 min parado · poucos ganhos", lat: -19.4905, lng: -42.54, idleS: 2100, earnedTodayCents: 2000 },
  ];
  const ranked = useMemo(() => {
    const k = fairness / 35;
    return rankCandidates(cands, ride, { ...DEFAULT_WEIGHTS, idle: DEFAULT_WEIGHTS.idle * k, earningsBalance: DEFAULT_WEIGHTS.earningsBalance * k, eta: DEFAULT_WEIGHTS.eta * (2 - k) });
  }, [fairness]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex h-full flex-col justify-center gap-3 p-5 md:p-8">
      {ranked.map((r, i) => {
        const c = cands.find((x) => x.driverId === r.candidate.driverId)!;
        return (
          <motion.div layout key={c.driverId} className={`rounded-xl p-3 ${i === 0 ? "bg-on-deep text-deep" : "bg-[color-mix(in_srgb,var(--on-deep)_9%,transparent)]"}`}>
            <p className="flex justify-between text-sm font-semibold"><span>{i === 0 ? "Recebe a oferta: " : ""}{c.label}</span><span className="num">{(r.score * 100).toFixed(0)} pts</span></p>
            <p className="text-xs opacity-75">{c.desc}</p>
          </motion.div>
        );
      })}
      <label className="mt-2 block text-sm">Peso do equilíbrio entre motoristas
        <input type="range" min={0} max={70} value={fairness} onChange={(e) => setFairness(Number(e.target.value))} className="mt-2 w-full accent-[var(--on-deep-muted)]" />
      </label>
      <p className="text-xs text-on-deep-muted">Motoristas de exemplo, calculados com o algoritmo usado na plataforma.</p>
    </div>
  );
}

function MoneyPane() {
  const [gross, setGross] = useState(2500);
  const commission = Math.round(gross * 0.15);
  return (
    <div className="flex h-full flex-col justify-center gap-3 p-5 md:p-8">
      <dl className="space-y-2 text-lg">
        <div className="flex justify-between"><dt>Valor bruto</dt><dd className="num font-semibold">{brl(gross)}</dd></div>
        <div className="flex justify-between text-on-deep-muted"><dt>Comissão Orbi (exemplo: 15%)</dt><dd className="num">− {brl(commission)}</dd></div>
        <div className="display flex justify-between border-t border-[color-mix(in_srgb,var(--on-deep)_25%,transparent)] pt-3 text-3xl"><dt>Você recebe</dt><dd className="num">{brl(gross - commission)}</dd></div>
      </dl>
      <label className="mt-2 block text-sm">Valor da corrida de exemplo
        <input type="range" min={800} max={8000} step={50} value={gross} onChange={(e) => setGross(Number(e.target.value))} className="mt-2 w-full accent-[var(--on-deep-muted)]" />
      </label>
      <p className="text-xs text-on-deep-muted">O percentual é configurado pela Orbi e sempre aparece antes de o motorista aceitar. Valores ilustrativos.</p>
    </div>
  );
}

function SafePane() {
  const list = ["Validação de CNH e documento do veículo", "Viagem compartilhada por link", "Botão de emergência com chamado prioritário", "Registro de ocorrências", "Seus dados sob a LGPD: exporte ou exclua"];
  return (
    <ul className="flex h-full flex-col justify-center gap-3 p-5 md:p-8">
      {list.map((t, i) => (
        <motion.li key={t} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .08 }} className="flex items-start gap-3">
          <span className="text-on-deep-muted"><Icon name="check" size={20} /></span>{t}
        </motion.li>
      ))}
    </ul>
  );
}

const PANES: Record<string, () => React.ReactNode> = { mapas: MapPane, rotas: RoutePane, geo: GeoPane, dispatch: DispatchPane, money: MoneyPane, safe: SafePane };

export function Tech() {
  const [tab, setTab] = useState("dispatch");
  const reduce = useReducedMotion();
  const Pane = PANES[tab];
  return (
    <section className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 md:py-36">
      <h2 className="display max-w-[16ch] text-[clamp(2.4rem,6vw,5rem)]">Tecnologia a favor dos dois lados.</h2>
      <div className="mt-12 grid gap-6 lg:grid-cols-2 lg:gap-14">
        <div role="tablist" aria-label="Recursos da plataforma" aria-orientation="vertical">
          {TABS.map((t) => {
            const on = t.id === tab;
            return (
              <button key={t.id} id={`tab-${t.id}`} type="button" role="tab" aria-selected={on} aria-controls="tech-pane" onClick={() => setTab(t.id)}
                className="flex w-full items-start gap-4 border-t border-line py-4 text-left transition-colors last:border-b md:py-5">
                <span className={on ? "text-brand" : "text-muted"}><Icon name={t.icon} size={24} /></span>
                <span>
                  <span className={`display block text-xl md:text-2xl ${on ? "text-brand" : ""}`}>{t.name}</span>
                  {on && <span className="anim-rise mt-1.5 block text-muted">{t.text}</span>}
                </span>
              </button>
            );
          })}
        </div>
        <div id="tech-pane" role="tabpanel" aria-labelledby={`tab-${tab}`} className="on-deep min-h-[400px] overflow-hidden rounded-card bg-deep text-on-deep lg:sticky lg:top-24 lg:h-[520px]">
          <AnimatePresence mode="wait">
            <motion.div key={tab} className="h-full" initial={reduce ? false : { opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} exit={reduce ? undefined : { opacity: 0 }} transition={{ duration: .25 }}>
              <Pane />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
