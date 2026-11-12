"use client";
import dynamic from "next/dynamic";
import { preloadMap } from "@/lib/map-preload";

/**
 * Mapa carregado só no navegador. Assim que uma tela que usa este arquivo abre, a biblioteca, o estilo,
 * as letras e os ícones começam a baixar juntos, antes mesmo de o mapa ser montado.
 */
export const MapView = dynamic(() => import("@/components/MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="map-loading size-full" />,
});

if (typeof window !== "undefined") {
  preloadMap();
  void import("@/components/MapView");
}
