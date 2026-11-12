"use client";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

/** Pares reais: cada promessa ao passageiro depende de uma promessa ao motorista. */
const PAIRS = [
  { p: "Praticidade", d: "Valorização", why: "Motorista respeitado aceita mais, cancela menos e chega antes." },
  { p: "Segurança", d: "Parcerias", why: "Carro bem cuidado, com manutenção acessível, é viagem mais segura." },
  { p: "Transparência", d: "Transparência nos ganhos", why: "Os dois lados veem o valor antes de confirmar: quanto custa e quanto fica." },
  { p: "Liberdade", d: "Benefícios", why: "Quem dirige escolhe quando rodar. Quem viaja escolhe como pagar." },
];

export function Proposal() {
  const [active, setActive] = useState(2);
  const reduce = useReducedMotion();
  return (
    <section className="mx-auto max-w-[1280px] px-5 py-24 md:px-10 md:py-36">
      <motion.h2 initial={reduce ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: .7 }}
        className="display max-w-[14ch] text-[clamp(2.4rem,6vw,5.2rem)]">Mobilidade que pensa em todos.</motion.h2>

      <div className="relative mt-14 md:mt-20">
        <div className="mb-4 grid grid-cols-[1fr_72px_1fr] text-sm font-semibold tracking-wide text-muted md:grid-cols-[1fr_180px_1fr]">
          <span>PASSAGEIRO</span><span /><span className="text-right">MOTORISTA</span>
        </div>
        {PAIRS.map((pair, i) => {
          const on = active === i;
          return (
            <motion.button key={pair.p} type="button" onClick={() => setActive(i)} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} aria-pressed={on}
              initial={reduce ? false : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * .07, duration: .55 }}
              className="grid w-full grid-cols-[1fr_72px_1fr] items-center border-t border-line py-5 text-left md:grid-cols-[1fr_180px_1fr] md:py-7">
              <span className={`display text-[clamp(1.2rem,3.1vw,2.7rem)] transition-colors ${on ? "text-brand" : "text-ink"}`}>{pair.p}</span>
              <svg viewBox="0 0 180 40" className="h-8 w-full md:h-10" preserveAspectRatio="none" aria-hidden="true">
                <path d="M0 20 H180" stroke="var(--line)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                {on && <path className="route-dash" d="M0 20 H180" stroke="var(--primary)" strokeWidth="2.5" fill="none" vectorEffect="non-scaling-stroke" />}
              </svg>
              <span className={`display text-right text-[clamp(1.2rem,3.1vw,2.7rem)] transition-colors ${on ? "text-brand" : "text-ink"}`}>{pair.d}</span>
            </motion.button>
          );
        })}
        <p aria-live="polite" className="min-h-14 border-t border-line pt-6 text-lg text-muted md:text-center">{PAIRS[active].why}</p>
      </div>
    </section>
  );
}
