"use client";
import Link from "next/link";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Icon } from "@/components/Icon";

const ITEMS = [
  { icon: "wrench", name: "Oficinas", text: "Revisão e mecânica em condições combinadas." },
  { icon: "tire", name: "Pneus", text: "Pneu novo com preço negociado para a categoria." },
  { icon: "patch", name: "Borracharias", text: "Conserto rápido, para voltar logo à rua." },
  { icon: "oil", name: "Troca de óleo", text: "Manutenção em dia custando menos." },
  { icon: "wash", name: "Lava-jatos", text: "Carro limpo melhora a nota e a viagem." },
  { icon: "tow", name: "Assistência automotiva", text: "Apoio quando o carro para no meio do dia." },
];

function TiltCard({ item, index }: { item: typeof ITEMS[number]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const onMove = (e: React.PointerEvent) => {
    if (reduce || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.transform = `perspective(800px) rotateX(${-y * 7}deg) rotateY(${x * 7}deg) translateY(-4px)`;
    ref.current.style.setProperty("--gx", `${(x + 0.5) * 100}%`);
    ref.current.style.setProperty("--gy", `${(y + 0.5) * 100}%`);
  };
  const onLeave = () => { if (ref.current) ref.current.style.transform = ""; };
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ delay: (index % 3) * .09, duration: .6 }}>
      <div ref={ref} data-glow onPointerMove={onMove} onPointerLeave={onLeave} className="tilt relative h-full overflow-hidden rounded-card bg-[color-mix(in_srgb,var(--on-deep)_8%,transparent)] p-6 shadow-[0_0_0_1px_color-mix(in_srgb,var(--on-deep)_16%,transparent)_inset] md:p-8"
        style={{ backgroundImage: "radial-gradient(240px circle at var(--gx,50%) var(--gy,0%), color-mix(in srgb, var(--on-deep) 12%, transparent), transparent 70%)" }}>
        <span className="text-on-deep-muted"><Icon name={item.icon} size={34} /></span>
        <h3 className="display mt-8 text-2xl md:text-3xl">{item.name}</h3>
        <p className="mt-2 text-on-deep-muted">{item.text}</p>
      </div>
    </motion.div>
  );
}

export function Club() {
  const host = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: host, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [50, -50]);
  const reduce = useReducedMotion();
  return (
    <section ref={host} className="on-deep overflow-hidden bg-deep text-on-deep">
      <div className="mx-auto max-w-[1280px] px-5 py-24 md:px-10 md:py-36">
        <div className="grid gap-8 lg:grid-cols-[3fr_2fr] lg:items-end">
          <motion.h2 style={reduce ? undefined : { y }} className="display text-[clamp(2.4rem,6vw,5.4rem)]">Quem movimenta a cidade também merece ser valorizado.</motion.h2>
          <div>
            <p className="text-on-deep-muted md:text-lg">O Clube Orbi reúne parceiros locais com condições especiais para motoristas cadastrados. No aplicativo, “Minha Economia” mostra quanto você deixou de gastar.</p>
            <p className="mt-3 text-sm text-on-deep-muted">Estamos buscando as primeiras parcerias no Vale do Aço. Os segmentos abaixo são os que queremos atender.</p>
          </div>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map((item, i) => <TiltCard key={item.name} item={item} index={i} />)}
        </div>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href="/clube" className="btn btn-on-deep">Conhecer o Clube</Link>
          <Link href="/parceiros" className="btn btn-line-deep">Quero ser parceiro</Link>
        </div>
      </div>
    </section>
  );
}
