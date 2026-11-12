"use client";
import { PageTitle } from "@/components/app/AppShell";
import { Badge, dateTime, Empty, km, METHOD_LABEL, Spinner, useLive } from "@/components/ui";
import { brl } from "@/domain/pricing";

type Ride = { id: string; status: string; statusLabel: string; createdAt: string; origin: { label: string }; dest: { label: string }; distanceM: number; grossCents: number; commissionCents: number; driverNetCents: number; paymentMethod: string; myRating: number | null };

export default function Corridas() {
  const { data, loading } = useLive<{ rides: Ride[] }>("/api/driver/history");
  return (
    <>
      <PageTitle>Suas corridas</PageTitle>
      {loading && !data ? <Spinner /> : !data?.rides.length ? <Empty title="Nenhuma corrida ainda">Fique online para receber sua primeira oferta.</Empty> : (
        <ul className="space-y-3">
          {data.rides.map((r) => (
            <li key={r.id} className="card p-4">
              <div className="flex items-center justify-between gap-2"><span className="text-sm text-muted">{dateTime(r.createdAt)}</span><Badge tone={r.status === "completed" ? "ok" : r.status === "cancelled" ? "danger" : "brand"}>{r.statusLabel}</Badge></div>
              <p className="mt-2 font-semibold">{r.origin.label} → {r.dest.label}</p>
              <p className="num mt-1 text-sm text-muted">{km(r.distanceM)} · {METHOD_LABEL[r.paymentMethod]} · bruto {brl(r.grossCents)} · comissão {brl(r.commissionCents)} · <strong className="text-ink">líquido {brl(r.driverNetCents)}</strong></p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
