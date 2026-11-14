"use client";
import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Icon } from "@/components/Icon";
import { Bob } from "@/components/Logo";
import { PhoneFrame } from "./PhoneMock";

const CHAPTERS = [
  { icon: "pin", title: "Diga para onde vai", text: "Digite o destino ou marque no mapa. A partida vem do GPS, se você permitir." },
  { icon: "receipt", title: "Veja o preço antes", text: "Compare categorias, tempo de chegada e formas de pagamento. Só confirma quem quiser." },
  { icon: "car", title: "Um motorista aceita", text: "Nome, foto, carro e placa aparecem na sua tela, e você acompanha a chegada no mapa." },
  { icon: "star", title: "Chegue e avalie", text: "Compartilhe a viagem com quem quiser e avalie o motorista no fim." },
];

const ROUTE = "M40 250 C 90 230, 70 170, 125 150 S 195 95, 215 45";

/** Texto que se escreve sozinho enquanto a tela está ativa. */
function Typed({ text, active }: { text: string; active: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) { setN(0); return; }
    const id = setInterval(() => setN((v) => (v < text.length ? v + 1 : v)), 70);
    return () => clearInterval(id);
  }, [active, text]);
  return <>{text.slice(0, n)}<span className="ml-px inline-block h-3.5 w-px translate-y-0.5 bg-[#242B30]" style={{ animation: "caret 1s steps(1) infinite" }} /></>;
}

function Map({ done, car }: { done?: boolean; car: ReturnType<typeof useMotionValue<number>> }) {
  const offset = useTransform(car, (v) => `${v}%`);
  return (
    <div className="absolute inset-x-0 top-0 h-[320px]">
      <div className="absolute inset-0 opacity-70" style={{ backgroundImage: "linear-gradient(#cfd8d3 1px, transparent 1px), linear-gradient(90deg, #cfd8d3 1px, transparent 1px)", backgroundSize: "34px 34px" }} />
      <svg className="absolute inset-0" width="250" height="320" viewBox="0 0 250 320" fill="none">
        <path d={ROUTE} stroke="#fff" strokeWidth="9" strokeLinecap="round" />
        <path d={ROUTE} stroke="var(--primary)" strokeWidth="4.5" strokeLinecap="round" />
        <circle cx="40" cy="250" r="7" fill="#fff" stroke="var(--accent)" strokeWidth="4" />
      </svg>
      <div className="absolute text-primary" style={{ left: 203, top: 4 }}><Bob className="h-10 w-7" hole="#e8eeea" />{done && <span className="pulse-ring absolute top-6 left-1.5 size-4 rounded-full bg-primary/40" />}</div>
      <motion.span className="absolute size-3.5 rounded-full border-[3px] border-white bg-primary shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_30%,transparent)]" style={{ offsetPath: `path("${ROUTE}")`, offsetDistance: offset, left: 0, top: 0 }} />
    </div>
  );
}

const sheet = "absolute inset-x-0 bottom-0 rounded-t-[26px] bg-white p-4 text-[#242B30] shadow-[0_-10px_30px_-15px_rgb(0_0_0/.4)]";

function Screen({ i, step, car }: { i: number; step: number; car: ReturnType<typeof useMotionValue<number>> }) {
  const on = step === i;
  return (
    <motion.div className="absolute inset-0" animate={{ opacity: on ? 1 : 0, y: on ? 0 : 14 }} transition={{ duration: .35 }} style={{ pointerEvents: "none" }}>
      <Map car={car} done={i === 3} />
      {i === 0 && (
        <div className={sheet}>
          <p className="display text-lg">Para onde vamos?</p>
          <div className="mt-3 rounded-2xl bg-[#e9f0eb] px-3 py-3 text-xs"><Typed text="Coronel Fabriciano" active={on} /></div>
          <div className="mt-2 flex items-center gap-2 px-1 text-[11px] text-[#56636A]"><Icon name="locate" size={14} />Partida: sua localização</div>
        </div>
      )}
      {i === 1 && (
        <div className={sheet}>
          <p className="mono-label text-[#56636A]">Exemplo ilustrativo</p>
          {[["Essencial", "~3 min", "R$ 38,00"], ["Conforto", "~5 min", "R$ 48,00"], ["Família", "~6 min", "R$ 60,00"]].map(([n, t, v], k) => (
            <div key={n} className={`mt-2 flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs ${k === 0 ? "shadow-[0_0_0_2px_var(--primary)_inset]" : "shadow-[0_0_0_1px_#d5dfd9_inset]"}`}>
              <Icon name={n === "Família" ? "users" : "car"} size={16} /><span className="flex-1 font-semibold">{n}<span className="ml-1.5 font-normal text-[#56636A]">{t}</span></span><span className="num font-semibold">{v}</span>
            </div>
          ))}
          <div className="relative mt-3 overflow-hidden rounded-full bg-primary py-2.5 text-center text-xs font-semibold text-on-primary">Pedir Essencial<span className="absolute inset-y-0 w-10 -skew-x-12 bg-white/30" style={{ animation: on ? "sweep 2.2s ease-in-out infinite" : undefined }} /></div>
        </div>
      )}
      {i === 2 && (
        <div className={sheet}>
          <p className="mono-label text-primary">Motorista a caminho</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-full bg-primary text-lg font-bold text-on-primary">M</span>
            <div className="min-w-0 flex-1 text-xs"><p className="text-sm font-semibold">Nome do motorista</p><p className="text-[#56636A]">Modelo · cor · ★ 4,9</p></div>
            <span className="num rounded-lg px-2 py-1.5 text-xs font-bold tracking-wider shadow-[0_0_0_1px_#d5dfd9]">ABC1D23</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs font-semibold"><span className="rounded-full bg-[#e9f0eb] py-2">Chat</span><span className="rounded-full bg-[#e9f0eb] py-2">Compartilhar</span></div>
        </div>
      )}
      {i === 3 && (
        <div className={sheet}>
          <p className="display text-lg">Você chegou</p>
          <p className="mt-0.5 text-xs text-[#56636A]">Como foi a viagem?</p>
          <div className="mt-3 flex gap-1.5">
            {[0, 1, 2, 3, 4].map((s) => (
              <motion.svg key={s} width="30" height="30" viewBox="0 0 24 24" className="text-primary" animate={on ? { scale: [0, 1.2, 1], opacity: 1 } : { scale: 0, opacity: 0 }} transition={{ delay: on ? .15 + s * .09 : 0, duration: .35 }}>
                <path d="m12 3.500 2.600 5.400 5.900.8-4.300 4.100 1 5.900-5.200-2.800-5.200 2.800 1-5.900L3.500 9.700l5.900-.8L12 3.500Z" fill="currentColor" />
              </motion.svg>
            ))}
          </div>
          <div className="mt-3 rounded-full bg-primary py-2.5 text-center text-xs font-semibold text-on-primary">Enviar avaliação</div>
        </div>
      )}
    </motion.div>
  );
}

/**
 * Passo a passo da viagem. No computador, o celular fica fixo e a tela muda conforme a página rola;
 * no celular, os passos avançam sozinhos e também respondem ao toque.
 */
export function StoryPhone() {
  const host = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [stacked, setStacked] = useState(false);
  const car = useMotionValue(0);
  const { scrollYProgress } = useScroll({ target: host, offset: ["start start", "end end"] });

  useEffect(() => {
    const q = matchMedia("(max-width: 1023px)");
    const sync = () => setStacked(q.matches);
    sync();
    q.addEventListener("change", sync);
    return () => q.removeEventListener("change", sync);
  }, []);

  // Computador: o passo e a posição do carro vêm da rolagem
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    if (stacked) return;
    setStep(Math.max(0, Math.min(3, Math.floor(p * 4 - 0.02))));
    car.set(Math.max(0, Math.min(1, p * 4 - 2)) * 88);
  });

  // Celular: avança sozinho enquanto a seção está na tela
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: .3 });
    if (host.current) io.observe(host.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!stacked || !visible || reduce) return;
    const id = setInterval(() => setStep((s) => (s + 1) % 4), 3600);
    return () => clearInterval(id);
  }, [stacked, visible, reduce]);
  useEffect(() => {
    if (!stacked) return;
    const controls = animate(car, step === 2 ? 88 : step === 3 ? 88 : 0, { duration: step === 2 ? 3 : .4, ease: "easeInOut" });
    return () => controls.stop();
  }, [stacked, step, car]);

  const progress = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section ref={host} aria-labelledby="historia" className="on-deep relative bg-deep text-on-deep lg:h-[340svh]">
      <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-5 py-20 md:px-10 lg:sticky lg:top-0 lg:h-svh lg:grid-cols-[1.1fr_1fr] lg:py-0">
        <div className="relative">
          <p className="mono-label text-on-deep-muted">Como pedir uma viagem</p>
          <h2 id="historia" className="display mt-3 max-w-[14ch] text-[clamp(2.2rem,4.6vw,4rem)]">Do toque ao destino.</h2>
          <ol className="relative mt-10 space-y-2">
            <span aria-hidden="true" className="absolute top-3 bottom-3 left-[27px] hidden w-px bg-[color-mix(in_srgb,var(--on-deep)_16%,transparent)] lg:block" />
            <motion.span aria-hidden="true" className="absolute top-3 left-[27px] hidden w-px bg-[var(--mark)] lg:block" style={{ height: progress, maxHeight: "calc(100% - 1.5rem)" }} />
            {CHAPTERS.map((c, i) => {
              const on = step === i;
              return (
                <li key={c.title}>
                  <button type="button" onClick={() => setStep(i)} aria-current={on ? "step" : undefined}
                    className={`relative flex w-full gap-4 rounded-[24px] p-3 text-left transition-all duration-300 ${on ? "bg-[color-mix(in_srgb,var(--on-deep)_8%,transparent)]" : "opacity-55 hover:opacity-90"}`}>
                    <span className={`grid size-12 shrink-0 place-items-center rounded-2xl transition-colors ${on ? "bg-[var(--mark)] text-deep" : "bg-[color-mix(in_srgb,var(--on-deep)_10%,transparent)]"}`}><Icon name={c.icon} size={24} weight={on ? "fill" : "duotone"} /></span>
                    <span className="min-w-0">
                      <span className="mono-label block text-on-deep-muted">Passo {i + 1} de 4</span>
                      <span className="mt-1 block text-lg font-semibold">{c.title}</span>
                      <span className="mt-0.5 block text-on-deep-muted">{c.text}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="flex justify-center py-4">
          <div className="relative">
            <div aria-hidden="true" className="absolute -inset-10 -z-10 rounded-full blur-3xl" style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--primary) 45%, transparent), transparent)" }} />
            <PhoneFrame className="lg:scale-[1.05]">
              {[0, 1, 2, 3].map((i) => <Screen key={i} i={i} step={step} car={car} />)}
            </PhoneFrame>
          </div>
        </div>
      </div>
    </section>
  );
}
