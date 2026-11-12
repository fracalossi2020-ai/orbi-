"use client";
import { MapView } from "@/components/LazyMap";
import type { MapArea } from "@/components/MapView";


/** Mapa com as áreas atendidas, rolagem da página livre (o mapa só mexe com dois dedos ou Ctrl). */
export function CoverageMap({ areas, className = "" }: { areas: MapArea[]; className?: string }) {
  const center = areas.length ? { lat: areas.reduce((s, a) => s + a.lat, 0) / areas.length, lng: areas.reduce((s, a) => s + a.lng, 0) / areas.length, zoom: 10.4 } : null;
  return (
    <div className={`relative overflow-hidden rounded-[28px] bg-[#f2efe9] shadow-[0_0_0_1px_color-mix(in_srgb,var(--on-deep)_12%,transparent),0_40px_100px_-40px_rgb(0_0_0/.8)] ${className}`}>
      <div className="absolute inset-0"><MapView cooperative areas={areas} focus={center} className="size-full !bg-transparent" ariaLabel="Mapa da área atendida pela Orbi no Vale do Aço" /></div>
      <p className="mono-label glass-map pointer-events-none absolute top-4 left-4 flex items-center gap-2 rounded-full px-3 py-1.5"><span className="size-2.5 rounded-full border border-dashed border-[var(--mark)]" />Área atendida</p>
    </div>
  );
}
