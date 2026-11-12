"use client";
import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import type { Identity } from "@/lib/identities";
import { CarArt } from "@/components/VehicleArt";
import { OrbiSymbol } from "@/components/Logo";

const Car3D = dynamic(() => import("./Car3D"), { ssr: false });

class Guard extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

/** Palco do carro: 3D quando o aparelho permite; ilustração quando não há WebGL, quando falha ou após 20 s sem carregar. */
export function CarStage({ colors }: { colors: Identity["car"] }) {
  const [mode, setMode] = useState<"pending" | "3d" | "flat">("pending");
  const [ready, setReady] = useState(false);
  // O 3D só começa quando a pessoa rola até perto dele: assim não disputa o carregamento com o mapa do topo.
  const spot = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = spot.current;
    if (!el || typeof IntersectionObserver === "undefined") { setNear(true); return; }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); } }, { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => { if (near) setMode(hasWebGL() ? "3d" : "flat"); }, [near]);
  useEffect(() => {
    if (ready || mode !== "3d") return;
    const t = setTimeout(() => setMode("flat"), 20000);
    return () => clearTimeout(t);
  }, [ready, mode]);
  return (
    <>
      <div ref={spot} aria-hidden="true" className="pointer-events-none absolute inset-0" />
      {mode === "3d" && (
        <Guard onFail={() => setMode("flat")}>
          <Car3D colors={colors} centered onReady={() => setReady(true)} onFail={() => setMode("flat")} />
        </Guard>
      )}
      {mode === "flat" && (
        <div className="absolute inset-0 grid place-items-center px-6">
          <CarArt className="w-full max-w-xl" title="Ilustração de carro com a marca Orbi" />
        </div>
      )}
      {mode === "3d" && !ready && (
        <div role="status" aria-label="Preparando o carro 3D" className="pointer-events-none absolute inset-0 grid place-items-center text-on-deep-muted">
          <div className="grid place-items-center gap-4"><span className="animate-pulse"><OrbiSymbol size={56} /></span><span className="mono-label">Preparando o carro</span></div>
        </div>
      )}
      {mode === "3d" && ready && <p className="mono-label pointer-events-none absolute inset-x-5 top-4 text-on-deep-muted">Arraste para girar · Modelo conceito com a adesivagem da Orbi, não representa a frota</p>}
    </>
  );
}
