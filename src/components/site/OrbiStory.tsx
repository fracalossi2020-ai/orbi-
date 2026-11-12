"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Icon } from "@/components/Icon";
import { ORBI_SYMBOL_PATH } from "@/components/OrbiMark";

/**
 * O que é a Orbi, contado como no manual da marca:
 * 1) a construção do símbolo, montada pela rolagem (Letra O → Movimento → Conexão → Símbolo);
 * 2) a essência da marca, cada valor com o que ele significa no app;
 * 3) onde a Orbi está.
 */

const STEPS = [
  { tag: "Letra O", title: "Tudo começa num O.", text: "O de Orbi, e o desenho de toda viagem: sair de um ponto e voltar a ele. Um círculo é o começo do símbolo." },
  { tag: "Movimento", title: "O vão em forma de folha é o deslocamento.", text: "Agilidade e fluxo contínuo: o caminho que corta o círculo de um lado ao outro, como uma corrida pela cidade." },
  { tag: "Conexão", title: "Duas metades que se encontram.", text: "De um lado, quem precisa ir. Do outro, quem leva. O símbolo só fecha quando passageiro e motorista se conectam." },
  { tag: "Símbolo final", title: "Isso é a Orbi.", text: "Uma plataforma de mobilidade urbana que conecta pessoas e destinos com praticidade, segurança e tecnologia." },
];

// Vão em forma de folha (o negativo do símbolo).
const LEAF = "M220,808 L590,808 C720,808 820,722 862,620 L948,443 L565,443 C380,443 200,560 163,757 C160,790 186,808 220,808 Z";

function SymbolBuild({ p, reduce }: { p: import("motion/react").MotionValue<number>; reduce: boolean }) {
  const circle = useTransform(p, [0.02, 0.22], [0, 1]);
  const leaf = useTransform(p, [0.27, 0.47], [0, 1]);
  const outline = useTransform(p, [0.52, 0.72], [0, 1]);
  const fill = useTransform(p, [0.74, 0.86], [0, 1]);
  const guides = useTransform(p, [0.7, 0.88], [1, 0]);
  const scale = useTransform(p, [0.74, 0.9], [0.94, 1]);
  const spin = useTransform(p, [0, 1], [0, 40]);
  const r = reduce;
  return (
    <svg viewBox="80 160 1080 960" className="h-full w-full overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id="story-g" gradientUnits="userSpaceOnUse" x1="160" y1="300" x2="1080" y2="960">
          <stop offset="0" stopColor="#00E1FF" /><stop offset=".42" stopColor="#0B6BFF" /><stop offset=".6" stopColor="#0A3BFF" /><stop offset="1" stopColor="#00E1FF" />
        </linearGradient>
        <filter id="story-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="40" /></filter>
      </defs>
      {/* órbita de fundo, girando com a rolagem */}
      <motion.g style={{ rotate: r ? 0 : spin, transformOrigin: "620px 640px" }}>
        <ellipse cx="620" cy="640" rx="560" ry="200" fill="none" stroke="rgb(245 247 250 / .07)" />
        <circle cx="1180" cy="640" r="7" fill="#00E1FF" />
      </motion.g>
      {/* guias de construção, como no manual */}
      <motion.g style={{ opacity: r ? 0 : guides }} fill="none" stroke="rgb(245 247 250 / .55)" strokeWidth="3">
        <motion.circle cx="620" cy="640" r="430" style={{ pathLength: r ? 1 : circle }} />
        <motion.path d={LEAF} style={{ pathLength: r ? 1 : leaf }} stroke="#5CC8FF" />
        <motion.path d={ORBI_SYMBOL_PATH} style={{ pathLength: r ? 1 : outline }} stroke="#9CC8FF" />
      </motion.g>
      {/* símbolo final */}
      <motion.g style={{ opacity: r ? 1 : fill, scale: r ? 1 : scale, transformOrigin: "620px 640px" }}>
        <path d={ORBI_SYMBOL_PATH} fill="url(#story-g)" filter="url(#story-glow)" opacity=".5" />
        <path d={ORBI_SYMBOL_PATH} fill="url(#story-g)" />
      </motion.g>
    </svg>
  );
}

function BuildStory() {
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [step, setStep] = useState(reduce ? 3 : 0);
  useMotionValueEvent(scrollYProgress, "change", (v) => { if (!reduce) setStep(Math.min(3, Math.floor(v * 4.2))); });
  const s = STEPS[step];
  return (
    <div ref={ref} className={reduce ? "" : "h-[340vh]"}>
      <div className={`${reduce ? "" : "sticky top-0"} flex min-h-[100svh] items-center`}>
        <div className="mx-auto grid w-full max-w-[1280px] items-center gap-8 px-5 pt-20 pb-10 md:px-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <div className="order-2 lg:order-1">
            <p className="mono-label text-[var(--mark)]">O que a Orbi representa</p>
            {/* Etapas da construção: são uma sequência de verdade, por isso numeradas */}
            <ol className="mt-6 flex gap-2" aria-label="Construção do símbolo">
              {STEPS.map((x, i) => (
                <li key={x.tag} className="flex-1">
                  <span className="block h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--on-deep)_12%,transparent)]">
                    <motion.span className="block h-full rounded-full" style={{ background: "var(--grad)" }} initial={false} animate={{ width: i <= step ? "100%" : "0%" }} transition={{ duration: reduce ? 0 : .5 }} />
                  </span>
                  <span className={`mt-2 block text-xs font-semibold transition-colors ${i === step ? "text-on-deep" : "text-on-deep-muted"}`}>{i + 1}. {x.tag}</span>
                </li>
              ))}
            </ol>
            <div className="mt-10 min-h-[15rem]" aria-live="polite">
              <AnimatePresence mode="wait">
                <motion.div key={step} initial={reduce ? false : { opacity: 0, y: 24, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={reduce ? undefined : { opacity: 0, y: -16, filter: "blur(6px)" }} transition={{ duration: .45, ease: [.2, .8, .2, 1] }}>
                  <h2 className={`display text-[clamp(2.2rem,4.6vw,4rem)] leading-[.98] ${step === 3 ? "text-grad" : ""}`}>{s.title}</h2>
                  <p className="mt-5 max-w-[44ch] text-lg leading-relaxed text-on-deep-muted">{s.text}</p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          <div className="order-1 mx-auto aspect-square w-full max-w-[min(520px,46svh)] lg:order-2 lg:max-w-[560px]">
            <SymbolBuild p={scrollYProgress} reduce={reduce} />
          </div>
        </div>
      </div>
    </div>
  );
}

const ESSENCE = [
  { icon: "bolt", title: "Agilidade", text: "Peça em poucos toques e veja quanto custa antes de confirmar.", practice: "Preço estimado sem cadastro, já na primeira tela." },
  { icon: "users", title: "Conexão", text: "Passageiros e motoristas da própria cidade, no mesmo app.", practice: "Chat da corrida, sem trocar número de telefone." },
  { icon: "shield", title: "Segurança", text: "Você sabe quem vem te buscar e alguém de confiança pode acompanhar.", practice: "Motorista verificado, viagem compartilhada e botão de emergência." },
  { icon: "route", title: "Mobilidade", text: "Feita para o dia a dia do Vale do Aço, rua por rua.", practice: "Pagamento em dinheiro, Pix ou maquininha do motorista." },
];

function Essence() {
  const reduce = useReducedMotion();
  return (
    <div className="mx-auto max-w-[1280px] px-5 py-24 md:px-10 md:py-32">
      <div className="grid gap-6 md:grid-cols-[1fr_1fr] md:items-end">
        <div>
          <p className="mono-label text-[var(--mark)]">Essência da marca</p>
          <h2 className="display mt-3 text-[clamp(2.2rem,4.6vw,4rem)] leading-[.98]">Quatro ideias guiam cada tela.</h2>
        </div>
        <p className="max-w-[44ch] text-lg text-on-deep-muted md:justify-self-end">Não são palavras de cartaz: cada uma vira um recurso que você usa no app.</p>
      </div>
      <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ESSENCE.map((e, i) => (
          <motion.li key={e.title} data-glow className="group flex flex-col rounded-[24px] border border-[color-mix(in_srgb,var(--on-deep)_10%,transparent)] bg-[color-mix(in_srgb,#0A1E3D_45%,transparent)] p-6"
            initial={reduce ? false : { opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: .6, delay: i * .08, ease: [.2, .8, .2, 1] }}>
            <span className="grid size-12 place-items-center rounded-2xl text-white shadow-[0_12px_30px_-12px_#0B6BFF]" style={{ background: "var(--grad)" }}><Icon name={e.icon} size={24} weight="fill" /></span>
            <h3 className="display mt-6 text-2xl">{e.title}</h3>
            <p className="mt-2 text-on-deep-muted">{e.text}</p>
            <p className="mt-auto border-t border-[color-mix(in_srgb,var(--on-deep)_10%,transparent)] pt-4 text-sm"><span className="font-semibold text-[var(--mark)]">Na prática · </span>{e.practice}</p>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

const CITY_NOTE: Record<string, string> = { "Ipatinga": "A maior cidade do Vale, onde a Orbi começa.", "Coronel Fabriciano": "Do Centro à Serra dos Cocais.", "Timóteo": "A Capital do Inox, de ponta a ponta." };

function Where({ cities }: { cities: { slug: string; name: string }[] }) {
  const reduce = useReducedMotion();
  if (!cities.length) return null;
  return (
    <div className="mx-auto max-w-[1280px] px-5 pb-24 md:px-10 md:pb-32">
      <div className="rounded-[32px] border border-[color-mix(in_srgb,var(--on-deep)_10%,transparent)] p-6 md:p-10" style={{ background: "radial-gradient(120% 140% at 100% 0%, rgb(11 107 255 / .22), transparent 55%), color-mix(in srgb, #0A1E3D 35%, transparent)" }}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mono-label text-[var(--mark)]">Onde a Orbi está</p>
            <h2 className="display mt-3 text-[clamp(2.4rem,5vw,4.4rem)] leading-[.95]">Do Vale do Aço, <span className="text-grad">pro mundo.</span></h2>
          </div>
          <p className="max-w-[38ch] text-on-deep-muted">A Orbi nasce no Vale do Aço, em Minas Gerais. A primeira operação cobre a área inteira das três cidades.</p>
        </div>
        <ul className="mt-10 grid gap-3 md:grid-cols-3">
          {cities.map((c, i) => (
            <motion.li key={c.slug} initial={reduce ? false : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: .5, delay: i * .08 }}>
              <Link href={`/cidades/${c.slug}`} className="group flex h-full items-center justify-between gap-4 rounded-2xl bg-[color-mix(in_srgb,var(--on-deep)_6%,transparent)] p-5 transition-colors hover:bg-[color-mix(in_srgb,var(--on-deep)_11%,transparent)]">
                <span>
                  <span className="display block text-2xl">{c.name}</span>
                  <span className="mt-1 block text-sm text-on-deep-muted">{CITY_NOTE[c.name] ?? "Tarifas e destinos da cidade."}</span>
                </span>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--on-deep)_10%,transparent)] transition-transform group-hover:translate-x-1"><Icon name="arrow" size={18} /></span>
              </Link>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function OrbiStory({ cities }: { cities: { slug: string; name: string }[] }) {
  return (
    <section aria-label="O que é a Orbi" className="on-deep relative bg-deep text-on-deep">
      <BuildStory />
      <Essence />
      <Where cities={cities} />
    </section>
  );
}
