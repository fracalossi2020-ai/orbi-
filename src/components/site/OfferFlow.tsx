"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { Icon } from "@/components/Icon";

/**
 * Para motoristas: o caminho de uma corrida, em ciclo. A oferta chega com o ganho já aberto, é aceita,
 * o trajeto avança e o valor entra no ganho do dia. Valores ilustrativos.
 * Só anima enquanto está na tela; com "reduzir movimento", fica parada na oferta.
 */
const GROSS = 2500, FEE = 375, NET = GROSS - FEE;
const DAY = [3400, 5200, 2800, 6100, 4300]; // corridas anteriores do dia, em centavos
const STEPS = 4;
const STEP_MS = [3200, 1600, 3000, 3400];

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const EASE = [.2, .8, .2, 1] as const;

export function OfferFlow() {
  const reduce = useReducedMotion();
  const host = useRef<HTMLDivElement>(null);
  const visible = useInView(host, { amount: .35 });
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduce || !visible) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % STEPS), STEP_MS[step]);
    return () => clearTimeout(t);
  }, [step, visible, reduce]);

  const done = step === 3;
  const total = DAY.reduce((a, b) => a + b, 0) + (done ? NET : 0);
  const max = Math.max(...DAY, NET);

  return (
    <div ref={host} className="relative grid h-full place-items-center p-5 sm:p-8">

      <div className="relative w-full max-w-[380px]">
        <AnimatePresence mode="wait" initial={false}>
          {!done ? (
            <motion.div key="offer" className="glass-deep rounded-[26px] p-5" initial={{ opacity: 0, y: 24, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -16, scale: .98 }} transition={{ duration: .5, ease: EASE }}>
              <div className="flex items-center justify-between">
                <p className="mono-label text-[var(--mark)]">{step === 0 ? "Nova corrida" : step === 1 ? "Aceita" : "Em viagem"}</p>
                {/* Tempo para decidir: o anel esvazia enquanto a oferta está aberta */}
                <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
                  <circle cx="15" cy="15" r="12" fill="none" stroke="currentColor" strokeOpacity=".15" strokeWidth="3" />
                  <motion.circle cx="15" cy="15" r="12" fill="none" stroke="#00E1FF" strokeWidth="3" strokeLinecap="round" transform="rotate(-90 15 15)" pathLength={1} strokeDasharray="1 1"
                    initial={false} animate={{ strokeDashoffset: step === 0 && !reduce ? [0, .7] : 0 }} transition={{ duration: step === 0 ? STEP_MS[0] / 1000 : .3, ease: "linear" }} />
                </svg>
              </div>

              {/* Mini trajeto: partida, chegada e o carro andando quando a viagem começa */}
              <div className="relative mt-4 h-24 overflow-hidden rounded-2xl bg-[color-mix(in_srgb,var(--deep)_70%,transparent)]">
                <svg viewBox="0 0 300 96" className="absolute inset-0 size-full" aria-hidden="true">
                  <path d="M24 70 C 90 70, 110 26, 170 30 S 250 40, 276 22" fill="none" stroke="#9AA8BD" strokeOpacity=".25" strokeWidth="3" strokeLinecap="round" />
                  <motion.path d="M24 70 C 90 70, 110 26, 170 30 S 250 40, 276 22" fill="none" stroke="url(#of-grad)" strokeWidth="3.5" strokeLinecap="round"
                    initial={false} animate={{ pathLength: step === 2 ? 1 : step === 1 ? .08 : 0 }} transition={{ duration: step === 2 ? STEP_MS[2] / 1000 - .2 : .4, ease: "easeInOut" }} />
                  <defs><linearGradient id="of-grad" x1="0" x2="1"><stop offset="0" stopColor="#00E1FF" /><stop offset="1" stopColor="#0A3BFF" /></linearGradient></defs>
                  <circle cx="24" cy="70" r="5" fill="#F5F7FA" />
                  <rect x="270" y="16" width="12" height="12" rx="3" fill="#00E1FF" />
                </svg>
                <p className="num absolute bottom-2 left-3 text-xs text-on-deep-muted">6,2 km · ~14 min</p>
              </div>

              <dl className="num mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-on-deep-muted">Valor bruto</dt><dd>{brl(GROSS)}</dd></div>
                <div className="flex justify-between"><dt className="text-on-deep-muted">Comissão Orbi</dt><dd>− {brl(FEE)}</dd></div>
                <div className="flex items-baseline justify-between border-t border-[color-mix(in_srgb,var(--on-deep)_14%,transparent)] pt-2">
                  <dt className="font-semibold">Você recebe</dt><dd className="text-2xl font-semibold text-[var(--mark)]">{brl(NET)}</dd>
                </div>
              </dl>

              <div className="mt-4 grid grid-cols-[1fr_2fr] gap-2" aria-hidden="true">
                <span className="rounded-full py-2.5 text-center text-sm font-semibold text-on-deep-muted shadow-[0_0_0_1px_color-mix(in_srgb,var(--on-deep)_18%,transparent)_inset]">Recusar</span>
                <motion.span className="rounded-full bg-[var(--cta)] py-2.5 text-center text-sm font-semibold text-white" initial={false}
                  animate={step === 1 && !reduce ? { scale: [1, .94, 1], boxShadow: ["0 0 0 0 rgb(0 225 255 / 0)", "0 0 0 10px rgb(0 225 255 / .25)", "0 0 0 0 rgb(0 225 255 / 0)"] } : { scale: 1 }}
                  transition={{ duration: .7 }}>
                  {step === 0 ? "Aceitar" : <span className="inline-flex items-center gap-1.5"><Icon name="check" size={16} /> Aceita</span>}
                </motion.span>
              </div>
            </motion.div>
          ) : (
            <motion.div key="day" className="glass-deep rounded-[26px] p-5" initial={{ opacity: 0, y: 24, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -16, scale: .98 }} transition={{ duration: .5, ease: EASE }}>
              <p className="mono-label text-[#5BD49B]">Corrida concluída · + {brl(NET)}</p>
              <p className="mt-4 text-sm text-on-deep-muted">Ganho de hoje</p>
              <p className="num text-4xl font-semibold tracking-tight">{brl(total)}</p>
              {/* Uma barra por corrida do dia; a nova entra por último, no degradê da marca */}
              <div className="mt-5 flex h-28 items-end gap-2">
                {[...DAY, NET].map((v, i) => {
                  const last = i === DAY.length;
                  return (
                    <motion.span key={i} className="flex-1 rounded-t-lg" style={{ background: last ? "linear-gradient(180deg, #00E1FF, #0A3BFF)" : "color-mix(in srgb, var(--on-deep) 16%, transparent)", originY: 1 }}
                      initial={{ scaleY: last ? 0 : 1, height: `${(v / max) * 100}%` }} animate={{ scaleY: 1 }} transition={{ duration: .8, delay: last ? .35 : 0, ease: EASE }} />
                  );
                })}
              </div>
              <p className="mt-4 text-xs text-on-deep-muted">Dinheiro na hora; corridas pagas no app viram saldo para saque.</p>
            </motion.div>
          )}
        </AnimatePresence>
        <p className="mono-label mt-3 text-center text-on-deep-muted">Exemplo ilustrativo</p>
      </div>
    </div>
  );
}
