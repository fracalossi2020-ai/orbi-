"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { Icon } from "@/components/Icon";
import { PhoneFrame } from "./PhoneMock";

/**
 * O que o passageiro vê depois de pedir: o carro vindo no mapa em tempo real, o tempo caindo minuto a minuto,
 * o motorista, o carro e a placa, até "Seu motorista chegou". Ciclo de 12 s, só enquanto aparece na tela;
 * com "reduzir movimento", fica parado no meio do caminho. Ilustração: motorista e placa fictícios.
 */
const CYCLE = 12;
const DRIVE = 9; // segundos do carro até o passageiro; o resto do ciclo é a chegada
const ROUTE = "M 40 70 C 40 160, 120 170, 150 230 S 150 330, 210 350 S 250 410, 196 455";
const DRIVER = { name: "Rafael", rating: "4,9", car: "Fiat Argo", color: "Prata", plate: "ORB1A23" };

export function LiveTrip({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();
  const host = useRef<HTMLDivElement>(null);
  const visible = useInView(host, { amount: .3 });
  const [t, setT] = useState(reduce ? 4 : 0);

  // Relógio da cena: avança de 0,25 em 0,25 s e recomeça no fim do ciclo.
  useEffect(() => {
    if (reduce || !visible) return;
    const id = setInterval(() => setT((x) => (x + .25) % CYCLE), 250);
    return () => clearInterval(id);
  }, [reduce, visible]);

  const arrived = t >= DRIVE;
  const progress = Math.min(1, t / DRIVE);
  const minutes = Math.max(1, Math.ceil(4 * (1 - progress)));

  // Posição e direção do carro no trajeto, no mesmo relógio do tempo de chegada.
  const route = useRef<SVGPathElement>(null);
  const [car, setCar] = useState({ x: 40, y: 70, a: 90 });
  useEffect(() => {
    const el = route.current;
    if (!el) return;
    const len = el.getTotalLength();
    const at = Math.min(len - 1, progress * len);
    const a = el.getPointAtLength(at), b = el.getPointAtLength(Math.min(len, at + 1));
    setCar({ x: a.x, y: a.y, a: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI });
  }, [progress]);

  return (
    <div ref={host} className={className}>
      <PhoneFrame tone="light">
        {/* Mapa: quarteirões claros, ruas brancas e o parque, no estilo do mapa do app */}
        <svg viewBox="0 0 260 570" className="absolute inset-0 size-full" aria-hidden="true">
          <rect width="260" height="570" fill="#EEF2F6" />
          <path d="M150 380 C 200 370, 250 400, 260 440 L260 570 L120 570 C 110 500, 120 420, 150 380 Z" fill="#DDEFE3" />
          <path d="M-10 520 C 60 500, 120 540, 270 505" fill="none" stroke="#CFE6FA" strokeWidth="16" />
          <g fill="none" stroke="#FFFFFF" strokeLinecap="round">
            <path d="M40 0 V 600 M150 0 V 600 M228 0 V 600" strokeWidth="11" />
            <path d="M-10 70 H 270 M-10 230 H 270 M-10 350 H 270 M-10 455 H 270" strokeWidth="11" />
            <path d="M0 150 L 260 110 M90 0 L 120 600" strokeWidth="6" />
          </g>
          {/* Trajeto do motorista: o trecho já percorrido some, o que falta fica azul */}
          <path ref={route} d={ROUTE} fill="none" stroke="#0356C5" strokeOpacity=".18" strokeWidth="7" strokeLinecap="round" />
          <motion.path d={ROUTE} fill="none" stroke="#0356C5" strokeWidth="5" strokeLinecap="round" pathLength={1} strokeDasharray="1 1"
            animate={{ strokeDashoffset: -progress }} transition={{ duration: .25, ease: "linear" }} />
          {/* Você: o ponto de encontro */}
          <g transform="translate(196 455)">
            <circle r="22" fill="#0356C5" opacity=".12" className={arrived || reduce ? "" : "live-ping"} />
            <circle r="9" fill="#FFFFFF" stroke="#0356C5" strokeWidth="4" />
          </g>
          {/* O carro, visto de cima, seguindo a rua */}
          <motion.g initial={false} animate={{ x: car.x, y: car.y }} transition={{ duration: t === 0 ? 0 : .25, ease: "linear" }}>
            {/* Desenhado de frente para a direita (0°): o para-brisa fica do lado de x maior */}
            <g transform={`rotate(${car.a})`}>
              <rect x="-14" y="-9" width="28" height="18" rx="6" fill="#02060E" />
              <rect x="2" y="-6" width="7" height="12" rx="2" fill="#5CC8FF" />
              <rect x="-11" y="-6" width="5" height="12" rx="2" fill="#2A3346" />
            </g>
          </motion.g>
        </svg>

        {/* Faixa do topo: tempo de chegada caindo, depois a chegada */}
        <div className="absolute inset-x-3 top-11 z-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={arrived ? "chegou" : "vindo"} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .3 }}
              className={`flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-white shadow-[0_8px_20px_-10px_rgb(2_6_14/.5)] ${arrived ? "bg-[#1B7F5A]" : "bg-[#02060E]"}`}>
              <Icon name={arrived ? "check" : "car"} size={18} />
              <span className="text-[13px] font-semibold leading-tight">
                {arrived ? "Seu motorista chegou" : <>Motorista a caminho · <span className="num">{minutes} min</span></>}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Cartão do motorista, como no app */}
        <div className="absolute inset-x-0 bottom-0 z-10 rounded-t-[26px] bg-white px-4 pt-3 pb-5 text-[#02060E] shadow-[0_-8px_24px_-16px_rgb(2_6_14/.35)]">
          <span className="mx-auto mb-3 block h-1 w-9 rounded-full bg-[#D5DBE3]" />
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#0356C5] text-base font-bold text-white">{DRIVER.name[0]}</span>
            <div className="min-w-0 flex-1">
              <p className="whitespace-nowrap text-[15px] font-semibold leading-tight">{DRIVER.name} <span className="text-[12px] font-medium text-[#536071]">★ {DRIVER.rating}</span></p>
              <p className="truncate text-[12px] text-[#536071]">{DRIVER.car} · {DRIVER.color}</p>
            </div>
            {/* Placa no padrão Mercosul: faixa azul no alto */}
            <span className="shrink-0 overflow-hidden rounded-md border border-[#02060E] text-center leading-none">
              <span className="block bg-[#0356C5] px-1 py-[2px] text-[7px] font-bold tracking-wider text-white">BRASIL</span>
              <span className="num block px-1 py-0.5 text-[11px] font-bold tracking-wide">{DRIVER.plate}</span>
            </span>
          </div>
          <div className="mt-3.5 grid grid-cols-2 gap-2 text-[13px] font-semibold">
            <span className="flex items-center justify-center gap-1.5 rounded-full bg-[#F1F4F8] py-2"><Icon name="chat" size={16} /> Mensagem</span>
            <span className="flex items-center justify-center gap-1.5 rounded-full bg-[#F1F4F8] py-2"><Icon name="share" size={16} /> Compartilhar</span>
          </div>
        </div>
      </PhoneFrame>
    </div>
  );
}
