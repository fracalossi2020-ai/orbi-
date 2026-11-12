"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/Logo";

/** Moldura de celular, só visual: tela escura, ilha no topo e reflexo, como nos aparelhos do manual da marca. */
export function PhoneFrame({ children, className = "", tone = "light" }: { children: React.ReactNode; className?: string; tone?: "light" | "dark" }) {
  return (
    <div aria-hidden="true" className={`relative mx-auto w-[280px] rounded-[48px] bg-[#05080F] p-2.5 shadow-[0_60px_120px_-40px_rgb(3_86_197/.7),0_30px_60px_-30px_rgb(0_0_0/.8),inset_0_0_0_1.5px_rgb(255_255_255/.14)] ${className}`}>
      <div className={`relative h-[570px] overflow-hidden rounded-[39px] ${tone === "dark" ? "bg-[#040B18]" : "bg-[#e8eeea]"}`}>
        {children}
        <span className="pointer-events-none absolute top-2.5 left-1/2 z-40 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black" />
        <span className="pointer-events-none absolute inset-0 z-40 rounded-[39px] bg-[linear-gradient(115deg,rgb(255_255_255/.09),transparent_32%)]" />
      </div>
    </div>
  );
}

/*
 * Demonstração do app em loop (cerca de 14 s): escolher o destino, ver a rota e as categorias (carro ou moto),
 * o motorista a caminho no mapa e a avaliação no fim. É uma ilustração: sem preços nem pessoas reais.
 */
const SCENES = [
  { ms: 3200, chip: { icon: "receipt", text: "Preço antes de pedir" } },
  { ms: 4000, chip: { icon: "moto", text: "Carro ou moto" } },
  { ms: 4200, chip: { icon: "shield", text: "Motorista verificado" } },
  { ms: 3600, chip: { icon: "share", text: "Viagem compartilhada" } },
];
const DEST = "Parque Ipanema";
const ROUTE = "M44 262 C 74 232, 60 182, 112 170 S 196 122, 210 58";
const DRIVER = "M236 316 C 196 300, 150 300, 120 286 S 62 272, 44 262";
const EASE = [.2, .8, .2, 1] as const;

function MapLayer({ scene, reduce }: { scene: number; reduce: boolean }) {
  return (
    <div className="absolute inset-x-0 top-0 h-[330px]">
      {/* Cidade estilizada: quadras e ruas em azul-noturno, como as telas escuras do manual */}
      <svg viewBox="0 0 260 330" className="absolute inset-0 size-full">
        <defs>
          <linearGradient id="pm-route" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#0A3BFF" /><stop offset="1" stopColor="#00E1FF" /></linearGradient>
          <radialGradient id="pm-glow" cx=".7" cy=".2" r=".8"><stop offset="0" stopColor="#0B6BFF" stopOpacity=".28" /><stop offset="1" stopColor="#0B6BFF" stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="260" height="330" fill="url(#pm-glow)" />
        <g stroke="rgb(140 180 255 / .1)" strokeWidth="10" fill="none" strokeLinecap="round">
          <path d="M-10 120 L270 80" /><path d="M-10 230 L270 200" /><path d="M70 -10 L95 340" /><path d="M170 -10 L190 340" />
        </g>
        <g stroke="rgb(140 180 255 / .06)" strokeWidth="4" fill="none">
          <path d="M-10 170 L270 140" /><path d="M-10 290 L270 255" /><path d="M20 -10 L40 340" /><path d="M125 -10 L142 340" /><path d="M225 -10 L240 340" />
        </g>
        <path d="M150 40 q30 -10 60 8 q-6 26 -40 26 q-24 -6 -20 -34Z" fill="rgb(0 225 255 / .07)" />
        {/* Rota da viagem: se desenha quando o destino é escolhido */}
        {scene >= 1 && (
          <>
            <path d={ROUTE} stroke="url(#pm-route)" strokeWidth="11" strokeLinecap="round" fill="none" opacity=".18" />
            <motion.path d={ROUTE} stroke="url(#pm-route)" strokeWidth="5" strokeLinecap="round" fill="none"
              initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.3, ease: EASE }} />
          </>
        )}
        {/* Caminho do motorista até a partida */}
        {scene === 2 && <path d={DRIVER} stroke="rgb(245 247 250 / .35)" strokeWidth="2.5" strokeDasharray="2 7" strokeLinecap="round" fill="none" />}
        <circle cx="44" cy="262" r="16" fill="#00E1FF" opacity=".16"><animate attributeName="r" values="10;20;10" dur="2.4s" repeatCount="indefinite" /></circle>
        <circle cx="44" cy="262" r="7" fill="#fff" stroke="#0B6BFF" strokeWidth="4" />
      </svg>
      {/* Pino do destino */}
      <AnimatePresence>
        {scene >= 1 && (
          <motion.span key="pin" className="absolute top-[30px] left-[198px] text-[#00E1FF]" initial={reduce ? false : { y: -26, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 16, delay: .9 }}>
            <Icon name="pin" size={26} weight="fill" />
          </motion.span>
        )}
      </AnimatePresence>
      {/* Carro andando pelo caminho até a partida */}
      {scene === 2 && (
        <motion.span className="absolute top-0 left-0 grid size-7 place-items-center rounded-full bg-white text-[#0356C5] shadow-[0_0_0_4px_rgb(0_225_255/.25),0_6px_14px_rgb(0_0_0/.5)]"
          style={{ offsetPath: `path("${DRIVER}")`, offsetRotate: "0deg" }}
          initial={{ offsetDistance: "0%" }} animate={{ offsetDistance: reduce ? "100%" : "100%" }} transition={{ duration: reduce ? 0 : 3.6, ease: "easeInOut" }}>
          <Icon name="car" size={16} weight="fill" />
        </motion.span>
      )}
    </div>
  );
}

function Typed({ text, reduce }: { text: string; reduce: boolean }) {
  const [n, setN] = useState(reduce ? text.length : 0);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setN((x) => (x >= text.length ? x : x + 1)), 95);
    return () => clearInterval(id);
  }, [text, reduce]);
  return <>{text.slice(0, n)}<span className="ml-px inline-block h-3.5 w-px translate-y-0.5 animate-pulse bg-current" /></>;
}

function Sheet({ scene, reduce }: { scene: number; reduce: boolean }) {
  const enter = reduce ? false : { y: 30, opacity: 0 };
  return (
    <div className="absolute inset-x-2 bottom-2 rounded-[30px] border border-white/10 bg-[#0A1424]/95 p-4 text-white backdrop-blur-md">
      <AnimatePresence mode="wait">
        {scene === 0 && (
          <motion.div key="s0" initial={enter} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: .4, ease: EASE }}>
            <p className="text-[17px] font-bold tracking-tight">Para onde vamos?</p>
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/8 px-3 py-3 text-[13px]"><span className="size-2.5 rounded-[3px] bg-[#0B6BFF]" /><Typed text={DEST} reduce={reduce} /></div>
            <div className="mt-2 flex items-center gap-2 rounded-2xl px-3 py-2 text-[12px] text-white/55"><Icon name="locate" size={14} />Partida: sua localização</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
              {[["home", "Casa"], ["briefcase", "Trabalho"]].map(([i, t]) => <span key={t} className="flex items-center gap-1.5 rounded-xl bg-white/6 px-2.5 py-2 text-white/75"><Icon name={i} size={13} />{t}</span>)}
            </div>
          </motion.div>
        )}
        {scene === 1 && (
          <motion.div key="s1" initial={enter} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: .4, ease: EASE }}>
            <p className="text-[15px] font-bold tracking-tight">Escolha uma viagem</p>
            <div className="mt-2.5 space-y-1.5">
              {[["car", "Essencial", "até 4"], ["car", "Conforto", "até 4"], ["users", "Família", "até 6"], ["moto", "Moto", "1 na garupa"]].map(([icon, name, seats], i) => (
                <motion.div key={name} initial={reduce ? false : { x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: .08 + i * .07, duration: .3, ease: EASE }}
                  className={`flex items-center gap-2.5 rounded-2xl px-3 py-2 text-[12px] ${i === 0 ? "bg-[#0356C5]/25 shadow-[0_0_0_1.5px_#2E7BFF_inset]" : "bg-white/5"}`}>
                  <Icon name={icon} size={17} weight={i === 0 ? "fill" : "regular"} /><span className="font-semibold">{name}</span><span className="ml-auto text-white/50">{seats}</span>
                </motion.div>
              ))}
            </div>
            <motion.div className="mt-3 rounded-full py-2.5 text-center text-[12px] font-semibold" style={{ background: "linear-gradient(115deg,#00E1FF,#0B6BFF 50%,#0A3BFF)" }}
              animate={reduce ? undefined : { scale: [1, 1, .95, 1] }} transition={{ duration: 3.8, times: [0, .82, .9, 1] }}>Pedir Essencial</motion.div>
          </motion.div>
        )}
        {scene === 2 && (
          <motion.div key="s2" initial={enter} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: .4, ease: EASE }}>
            <p className="text-[11px] font-semibold tracking-[.12em] text-[#5CC8FF] uppercase">Motorista a caminho</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-full text-[15px] font-bold" style={{ background: "linear-gradient(135deg,#00E1FF,#0A3BFF)" }}>M</span>
              <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">Motorista verificado</span><span className="block text-[11px] text-white/55">Carro, cor e placa aparecem aqui</span></span>
              <span className="rounded-lg border border-white/15 px-2 py-1 font-mono text-[11px]">ABC1D23</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-[#00E1FF]" initial={{ width: "8%" }} animate={{ width: "100%" }} transition={{ duration: reduce ? 0 : 3.8, ease: "easeInOut" }} /></div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              {[["chat", "Chat"], ["share", "Compartilhar"]].map(([i, t]) => <span key={t} className="flex items-center justify-center gap-1.5 rounded-xl bg-white/8 py-2"><Icon name={i} size={13} />{t}</span>)}
            </div>
          </motion.div>
        )}
        {scene === 3 && (
          <motion.div key="s3" initial={enter} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: .4, ease: EASE }}>
            <p className="text-[17px] font-bold tracking-tight">Você chegou</p>
            <p className="text-[12px] text-white/55">Como foi a viagem?</p>
            <div className="mt-3 flex gap-2">
              {Array.from({ length: 5 }, (_, i) => (
                <motion.span key={i} initial={reduce ? false : { scale: .4, opacity: .25 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: .3 + i * .18, type: "spring", stiffness: 380, damping: 14 }} className="text-[#00E1FF]">
                  <Icon name="star" size={24} weight="fill" />
                </motion.span>
              ))}
            </div>
            <motion.div className="mt-4 rounded-full bg-white py-2.5 text-center text-[12px] font-semibold text-[#02060E]" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}>Enviar avaliação</motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Celular com o app em movimento, em loop. Em "reduzir movimento", fica parado na tela de escolher a viagem. */
export function PhoneMock({ chips = true }: { chips?: boolean }) {
  const reduce = !!useReducedMotion();
  const [scene, setScene] = useState(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    const id = setTimeout(() => setScene((s) => (s + 1) % SCENES.length), SCENES[scene].ms);
    return () => clearTimeout(id);
  }, [scene, reduce]);
  const chip = SCENES[scene].chip;
  return (
    <div className="relative">
      <PhoneFrame tone="dark">
        <MapLayer scene={scene} reduce={reduce} />
        <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-6 pt-[46px] text-white"><Logo size={13} /><span className="flex gap-1">{SCENES.map((_, i) => <span key={i} className={`h-1 rounded-full transition-all duration-500 ${i === scene ? "w-5 bg-[#00E1FF]" : "w-1.5 bg-white/30"}`} />)}</span></div>
        <Sheet scene={scene} reduce={reduce} />
      </PhoneFrame>
      {/* Etiqueta flutuante: o que cada momento do app garante */}
      {chips && (
        <div aria-hidden="true" className="pointer-events-none absolute top-24 -left-6 z-10 sm:-left-16">
          <AnimatePresence mode="wait">
            <motion.span key={scene} className="flex items-center gap-2 rounded-2xl border border-white/15 bg-[#0A1424]/85 px-3.5 py-2.5 text-[13px] font-semibold whitespace-nowrap text-white shadow-[0_20px_40px_-16px_rgb(0_0_0/.7)] backdrop-blur-md"
              initial={reduce ? false : { opacity: 0, x: -16, scale: .95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: .4, ease: EASE }}>
              <span className="grid size-7 place-items-center rounded-lg" style={{ background: "linear-gradient(135deg,#00E1FF,#0A3BFF)" }}><Icon name={chip.icon} size={15} weight="fill" /></span>{chip.text}
            </motion.span>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
