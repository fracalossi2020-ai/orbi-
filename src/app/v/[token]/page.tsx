"use client";
import { MapView } from "@/components/LazyMap";
import { use, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { api, Empty, Note, Spinner } from "@/components/ui";


type Shared = {
  ended?: boolean; status: string; statusLabel: string; origin: { label: string; lat: number; lng: number }; dest: { label: string; lat: number; lng: number }; stops?: { label: string; lat: number; lng: number }[]; geometry: [number, number][];
  driver: { name: string; lat: number | null; lng: number | null } | null; vehicle: { make: string; model: string; color: string; plate: string } | null;
};

/** Link público de acompanhamento: mostra só o necessário e para de expor dados ao fim da viagem. */
export default function SharedRide({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<Shared | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const load = () => api<Shared>(`/api/public/share/${token}`).then(setData).catch((e) => setError(e.message));
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [token]);

  return (
    <div className="flex min-h-svh flex-col bg-bg">
      <header className="flex h-14 items-center border-b border-line bg-surface px-4"><Logo size={20} hole="var(--surface)" /></header>
      {error ? <Empty icon="route" title={error} />
        : !data ? <Spinner />
        : data.ended ? <Empty icon="check" title="Esta viagem terminou">O acompanhamento só fica disponível durante a corrida.</Empty>
        : (
          <>
            <MapView className="min-h-[50svh] flex-1" ariaLabel="Acompanhamento da viagem" route={data.geometry} points={[
              { id: "o", kind: "origin", lat: data.origin.lat, lng: data.origin.lng }, { id: "d", kind: "dest", lat: data.dest.lat, lng: data.dest.lng },
              ...(data.stops ?? []).map((p, i) => ({ id: `s${i}`, kind: "stop" as const, lat: p.lat, lng: p.lng })),
              ...(data.driver?.lat != null && data.driver.lng != null ? [{ id: "car", kind: "car" as const, lat: data.driver.lat, lng: data.driver.lng }] : []),
            ]} />
            <section className="space-y-2 bg-surface p-5">
              <h1 className="display text-2xl">{data.statusLabel}</h1>
              <p className="text-sm text-muted">{[data.origin.label, ...(data.stops ?? []).map((p) => p.label), data.dest.label].join(" → ")}</p>
              {data.driver && data.vehicle && <p className="font-medium">{data.driver.name} · {data.vehicle.make} {data.vehicle.model} {data.vehicle.color} · <span className="num font-bold tracking-wider">{data.vehicle.plate}</span></p>}
              <Note>Em caso de perigo, ligue para o 190.</Note>
            </section>
          </>
        )}
    </div>
  );
}
