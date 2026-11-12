"use client";
import { PageTitle } from "@/components/app/AppShell";
import { Icon } from "@/components/Icon";
import { api, Badge, dateTime, Empty, ErrorNote, km, METHOD_LABEL, Spinner, useAction, useLive } from "@/components/ui";
import { brl } from "@/domain/pricing";

type Ride = {
  id: string; status: string; statusLabel: string; origin: { label: string }; dest: { label: string }; stops: { label: string }[]; scheduledFor: string | null;
  createdAt: string; totalCents: number; paymentMethod: string; distanceM: number; driver: { name: string } | null; vehicle: { plate: string } | null; myRating: number | null;
  categoryName: string; rider: { name: string } | null;
};
const TONE: Record<string, "ok" | "danger" | "neutral"> = { completed: "ok", cancelled: "danger", no_driver: "neutral" };
const path = (r: Ride) => [r.origin.label, ...r.stops.map((s) => s.label), r.dest.label].join(" → ");
const whenLabel = (iso: string) => {
  const s = new Date(iso).toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export default function Viagens() {
  const { data, loading, reload } = useLive<{ history: Ride[] }>("/api/rides");
  const { busy, error, run } = useAction();
  const scheduled = (data?.history ?? []).filter((r) => r.status === "scheduled").sort((a, b) => a.scheduledFor!.localeCompare(b.scheduledFor!));
  const past = (data?.history ?? []).filter((r) => r.status !== "scheduled");
  const cancel = (id: string) => run(async () => { await api(`/api/rides/${id}/cancel`, { body: { reason: "Agendamento cancelado pelo passageiro" } }); reload(); });
  return (
    <>
      <PageTitle>Suas viagens</PageTitle>
      {loading && !data ? <Spinner /> : (
        <div className="space-y-8">
          {scheduled.length > 0 && (
            <section aria-labelledby="agendadas" className="space-y-3">
              <h2 id="agendadas" className="display text-xl">Agendadas</h2>
              <ul className="space-y-3">
                {scheduled.map((r) => (
                  <li key={r.id} className="card flex gap-4 p-4" data-testid="scheduled-ride">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-brand"><Icon name="calendar" weight="duotone" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{whenLabel(r.scheduledFor!)}</p>
                      <p className="mt-0.5 text-sm">{path(r)}</p>
                      <p className="num mt-1 text-sm text-muted">{r.categoryName} · {brl(r.totalCents)} · {METHOD_LABEL[r.paymentMethod]}{r.rider ? ` · para ${r.rider.name}` : ""}</p>
                      <button type="button" className="btn btn-ghost btn-sm mt-3" disabled={busy} onClick={() => cancel(r.id)}>Cancelar agendamento</button>
                    </div>
                  </li>
                ))}
              </ul>
              <ErrorNote>{error}</ErrorNote>
            </section>
          )}
          {!past.length ? (!scheduled.length && <Empty title="Você ainda não viajou com a Orbi">Suas viagens aparecem aqui depois do primeiro pedido.</Empty>) : (
            <section aria-label="Histórico" className="space-y-3">
              {scheduled.length > 0 && <h2 className="display text-xl">Histórico</h2>}
              <ul className="space-y-3">
                {past.map((r) => (
                  <li key={r.id} className="card p-4">
                    <div className="flex items-center justify-between gap-2"><span className="text-sm text-muted">{dateTime(r.scheduledFor ?? r.createdAt)}</span><Badge tone={TONE[r.status]}>{r.statusLabel}</Badge></div>
                    <p className="mt-2 font-semibold">{path(r)}</p>
                    <p className="num mt-1 text-sm text-muted">{km(r.distanceM)} · {METHOD_LABEL[r.paymentMethod]}{r.status === "completed" ? ` · ${brl(r.totalCents)}` : ""}{r.driver ? ` · ${r.driver.name}` : ""}{r.vehicle ? ` · ${r.vehicle.plate}` : ""}{r.myRating ? ` · ★ ${r.myRating}` : ""}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
