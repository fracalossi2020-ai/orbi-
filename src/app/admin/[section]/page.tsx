"use client";
import { use, useMemo, useState } from "react";
import type { ScheduleRules } from "@/domain/schedule";
import { DOC_INFO, DOC_KINDS, type DriverRules } from "@/domain/driver-rules";
import { notFound } from "next/navigation";
import { PageTitle } from "@/components/app/AppShell";
import { Crud, DataTable, type Row } from "@/components/app/Crud";
import { api, Badge, dateTime, Empty, ErrorNote, Field, km, METHOD_LABEL, Note, Spinner, useAction, useLive } from "@/components/ui";
import { can } from "@/domain/permissions";
import { brl } from "@/domain/pricing";
import { WEIGHT_LABELS, type DispatchWeights } from "@/domain/dispatch";
import { useRole } from "../shell";

// ------------------------------------------------------------------ cadastros simples

function CrudCoupons() {
  const role = useRole();
  return <><PageTitle sub="Descontos custeados pela Orbi: o líquido do motorista não muda.">Cupons</PageTitle>
    <Crud resource="coupons" canWrite={can(role, "coupons", "write")} canDelete emptyTitle="Nenhum cupom criado" columns={[
      { key: "code", label: "Código", required: true },
      { key: "kind", label: "Tipo", kind: "select", required: true, options: [{ value: "percent", label: "Porcentagem" }, { value: "fixed", label: "Valor fixo" }] },
      { key: "value", label: "Valor", kind: "number", required: true, hint: "Porcentagem em pontos-base (1000 = 10%) ou valor fixo em centavos." },
      { key: "maxDiscountCents", label: "Desconto máximo", kind: "money" },
      { key: "maxUses", label: "Limite de usos", kind: "number" },
      { key: "used", label: "Usados", hideInForm: true },
      { key: "validUntil", label: "Válido até", kind: "date" },
      { key: "active", label: "Ativo", kind: "boolean" },
    ]} /></>;
}
function CrudCampaigns() {
  const role = useRole();
  const { data: regions } = useLive<{ rows: Row[] }>("/api/admin/r/regions", { live: false });
  return <><PageTitle sub="Bônus por corrida entram automaticamente no saldo do motorista.">Campanhas</PageTitle>
    <Crud resource="campaigns" canWrite={can(role, "campaigns", "write")} canDelete emptyTitle="Nenhuma campanha criada" columns={[
      { key: "name", label: "Nome", required: true },
      { key: "audience", label: "Público", kind: "select", required: true, options: [{ value: "driver", label: "Motoristas" }, { value: "passenger", label: "Passageiros" }] },
      { key: "kind", label: "Tipo", kind: "select", required: true, options: [{ value: "promo", label: "Promoção" }, { value: "bonus", label: "Bonificação" }] },
      { key: "bonusPerRideCents", label: "Bônus por corrida", kind: "money" },
      { key: "regionId", label: "Região", kind: "select", options: regions?.rows.map((r) => ({ value: r.id, label: r.name })) ?? [], hint: "Em branco vale para todas." },
      { key: "startsAt", label: "Início", kind: "date" }, { key: "endsAt", label: "Fim", kind: "date" },
      { key: "description", label: "Descrição", kind: "textarea", hideInTable: true },
      { key: "active", label: "Ativa", kind: "boolean" },
    ]} /></>;
}
function CrudPartners() {
  const role = useRole();
  return <><PageTitle sub="Parceiros ativos aparecem no Clube Orbi. Cadastre só parcerias confirmadas.">Parceiros comerciais</PageTitle>
    <Crud resource="partners" canWrite={can(role, "partners", "write")} canDelete emptyTitle="Nenhum parceiro cadastrado" columns={[
      { key: "name", label: "Nome", required: true },
      { key: "category", label: "Segmento", kind: "select", required: true, options: ["Oficina", "Borracharia", "Centro automotivo", "Troca de óleo", "Pneus", "Lava-jato", "Autopeças", "Assistência veicular"].map((v) => ({ value: v, label: v })) },
      { key: "city", label: "Cidade", required: true }, { key: "address", label: "Endereço", hideInTable: true }, { key: "phone", label: "Telefone" },
      { key: "benefit", label: "Benefício", required: true }, { key: "active", label: "Ativo", kind: "boolean" },
    ]} /></>;
}
function CrudPlans() {
  const role = useRole();
  return <><PageTitle sub="O motorista paga o plano com o saldo e tem comissão menor durante o período.">Planos de assinatura</PageTitle>
    <Crud resource="plans" canWrite={can(role, "plans", "write")} emptyTitle="Nenhum plano criado" emptyText="Sem plano, vale a comissão da tarifa." columns={[
      { key: "name", label: "Nome", required: true }, { key: "description", label: "Descrição", hideInTable: true },
      { key: "priceCents", label: "Preço", kind: "money", required: true }, { key: "periodDays", label: "Dias", kind: "number", required: true },
      { key: "commissionBps", label: "Comissão (%)", kind: "percent", required: true }, { key: "active", label: "Ativo", kind: "boolean" },
    ]} /></>;
}
function CrudRegions() {
  const role = useRole();
  return <><PageTitle sub="Nova cidade: cadastre aqui e configure as tarifas. O sistema não precisa ser alterado.">Regiões de atendimento</PageTitle>
    <Crud resource="regions" canWrite={can(role, "regions", "write")} emptyTitle="Nenhuma região" columns={[
      { key: "name", label: "Cidade", required: true }, { key: "state", label: "UF", required: true }, { key: "slug", label: "Identificador", required: true, hideInTable: true },
      { key: "lat", label: "Latitude", kind: "number", required: true }, { key: "lng", label: "Longitude", kind: "number", required: true },
      { key: "radiusKm", label: "Raio (km)", kind: "number", required: true }, { key: "active", label: "Ativa", kind: "boolean" },
    ]} /></>;
}
function CrudModalities() {
  const role = useRole();
  return <><PageTitle sub="Cada modalidade tem regras, documentos e cadastro próprios. Ative só com a validação legal concluída.">Modalidades</PageTitle>
    <Crud resource="modalities" canWrite={can(role, "modalities", "write")} canCreate={false} emptyTitle="Nenhuma modalidade" columns={[
      { key: "name", label: "Modalidade", hideInForm: true }, { key: "description", label: "Descrição", hideInForm: true },
      { key: "requiredDocuments", label: "Documentos", hideInForm: true, render: (r) => (r.requiredDocuments as string[]).join(", ") },
      { key: "legalNote", label: "Observação legal", kind: "textarea" }, { key: "active", label: "Ativa", kind: "boolean" },
    ]} /></>;
}

function Tariffs() {
  const role = useRole();
  const { data: regions } = useLive<{ rows: Row[] }>("/api/admin/r/regions", { live: false });
  const { data: cats } = useLive<{ rows: Row[] }>("/api/admin/r/categories", { live: false });
  const name = (list: Row[] | undefined, id: string) => list?.find((x) => x.id === id)?.name ?? "…";
  return <><PageTitle sub="Comissão e preços por cidade e categoria. Salvar marca a tarifa como revisada.">Tarifas e comissão</PageTitle>
    <div className="mb-4"><Note tone="warn">Os valores iniciais são apenas pontos de partida para configuração, não uma política definida. Revise cada tarifa antes de operar.</Note></div>
    <Crud resource="tariffs" canWrite={can(role, "tariffs", "write")} canCreate={false} emptyTitle="Nenhuma tarifa" columns={[
      { key: "regionId", label: "Cidade", hideInForm: true, render: (r) => name(regions?.rows, r.regionId) },
      { key: "categoryId", label: "Categoria", hideInForm: true, render: (r) => name(cats?.rows, r.categoryId) },
      { key: "baseCents", label: "Base", kind: "money" }, { key: "perKmCents", label: "Por km", kind: "money" }, { key: "perMinCents", label: "Por min", kind: "money" },
      { key: "minCents", label: "Mínimo", kind: "money" }, { key: "serviceFeeCents", label: "Taxa de serviço", kind: "money" }, { key: "commissionBps", label: "Comissão (%)", kind: "percent" },
      { key: "reviewedAt", label: "Revisada", hideInForm: true, render: (r) => r.reviewedAt ? <Badge tone="ok">Sim</Badge> : <Badge tone="warn">Pendente</Badge> },
    ]} /></>;
}

// ------------------------------------------------------------------ fluxos

const DRIVER_TONE: Record<string, "warn" | "ok" | "danger"> = { pending: "warn", approved: "ok", rejected: "danger", suspended: "danger" };
const DRIVER_LABEL: Record<string, string> = { pending: "Em análise", approved: "Aprovado", rejected: "Recusado", suspended: "Suspenso" };
const REVIEW_LABEL: Record<string, string> = { pending: "Em análise", approved: "Aprovado", rejected: "Recusado" };
const DOC_LABEL: Record<string, string> = Object.fromEntries(Object.entries(DOC_INFO).map(([k, v]) => [k, v.label]));
const br = (iso?: unknown) => (typeof iso === "string" && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

function Drivers() {
  const role = useRole();
  const write = can(role, "drivers", "write");
  const { data, loading, reload } = useLive<{ rows: Row[] }>("/api/admin/drivers");
  const { error, busy, run } = useAction();
  const post = (url: string, body: unknown) => run(async () => { await api(url, { body }); reload(); });
  if (loading && !data) return <Spinner />;
  return (
    <>
      <PageTitle sub="Confira cada documento antes de aprovar. Toda consulta fica no histórico.">Motoristas</PageTitle>
      <ErrorNote>{error}</ErrorNote>
      {!data?.rows.length ? <Empty icon="car" title="Nenhum motorista cadastrado">Os cadastros aparecem aqui para análise.</Empty> : (
        <ul className="space-y-3">
          {data.rows.map((d) => (
            <li key={d.id} className="card p-5" data-testid="driver-row">
              <div className="flex flex-wrap items-center gap-2"><p className="display text-xl">{d.name}</p><Badge tone={DRIVER_TONE[d.status]}>{DRIVER_LABEL[d.status]}</Badge>{d.online && <Badge tone="brand">Online</Badge>}</div>
              <p className="num text-sm text-muted">{[d.email, d.phone].filter(Boolean).join(" · ")} · CPF {d.cpf} · CNH {d.cnh} · {d.ridesTotal} corridas{d.rating ? ` · ★ ${d.rating.toFixed(1)}` : ""}</p>
              {d.address && <p className="text-sm text-muted">{d.address} {d.addressVerified ? "· CEP confirmado" : "· CEP não confirmado"}</p>}
              <p className="num text-sm text-muted">Nascimento {br(d.birthDate)} · CNH categoria {String(d.cnhCategory ?? "—")}, habilitado desde {br(d.cnhFirstLicenseAt)}, validade {br(d.cnhExpiresAt)} · EAR {d.cnhEar ? "declarada" : "não declarada"} · INSS {d.inss ? "declarado" : "não declarado"} · Termo {d.termsAcceptedAt ? `aceito (versão ${String(d.termsVersion)})` : "não aceito"}</p>
              <p className="text-xs text-muted">O sistema confere o cálculo do CPF e da CNH. Compare nome, números, categoria, validade e a observação EAR com a CNH, e confira a certidão de antecedentes, antes de aprovar.</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div><p className="mb-1 text-sm font-semibold">Documentos</p>
                  {!(d.docs as Row[]).length && <p className="text-sm text-muted">Nenhum enviado.</p>}
                  <ul className="space-y-1.5">{(d.docs as Row[]).map((doc) => (
                    <li key={doc.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <a className="font-medium underline" target="_blank" rel="noreferrer" href={`/api/admin/documents/${doc.id}/file`}>{DOC_LABEL[doc.kind] ?? doc.kind}</a>
                      <Badge tone={DRIVER_TONE[doc.status]}>{REVIEW_LABEL[doc.status]}</Badge>
                      {write && doc.status === "pending" && <>
                        <button type="button" className="btn btn-soft btn-sm !min-h-8" disabled={busy} onClick={() => post(`/api/admin/documents/${doc.id}`, { status: "approved" })}>Aprovar</button>
                        <button type="button" className="btn btn-ghost btn-sm !min-h-8" disabled={busy} onClick={() => { const note = prompt("Motivo da recusa (aparece para o motorista):"); if (note) post(`/api/admin/documents/${doc.id}`, { status: "rejected", note }); }}>Recusar</button>
                      </>}
                    </li>
                  ))}</ul>
                </div>
                <div><p className="mb-1 text-sm font-semibold">Veículos</p>
                  {!(d.vehicles as Row[]).length && <p className="text-sm text-muted">Nenhum cadastrado.</p>}
                  <ul className="space-y-1.5">{(d.vehicles as Row[]).map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span>{v.make} {v.model} {v.year} · {v.color} · <span className="num font-semibold">{v.plate}</span>{v.doors ? ` · ${v.doors} portas, ${v.seats} lugares, ${v.airConditioning ? "com" : "sem"} ar · ${String(v.ownership ?? "")}` : ""}</span><Badge tone={DRIVER_TONE[v.status]}>{REVIEW_LABEL[v.status]}</Badge>
                      {write && v.status === "pending" && <button type="button" className="btn btn-soft btn-sm !min-h-8" disabled={busy} onClick={() => post(`/api/admin/vehicles/${v.id}`, { status: "approved" })}>Aprovar</button>}
                    </li>
                  ))}</ul>
                </div>
              </div>
              {write && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                  {d.status !== "approved" && <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => post(`/api/admin/drivers/${d.id}`, { status: "approved" })}>Aprovar cadastro</button>}
                  {d.status === "pending" && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { const note = prompt("Motivo (aparece para o motorista):"); if (note) post(`/api/admin/drivers/${d.id}`, { status: "rejected", note }); }}>Recusar</button>}
                  {d.status === "approved" && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { const note = prompt("Motivo da suspensão:"); if (note) post(`/api/admin/drivers/${d.id}`, { status: "suspended", note }); }}>Suspender</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Vehicles() {
  const role = useRole();
  const { data, loading, reload } = useLive<{ rows: Row[] }>("/api/admin/vehicles");
  const { error, busy, run } = useAction();
  if (loading && !data) return <Spinner />;
  return <><PageTitle>Veículos</PageTitle><ErrorNote>{error}</ErrorNote>
    {!data?.rows.length ? <Empty icon="car" title="Nenhum veículo cadastrado" /> : <DataTable rows={data.rows} columns={[
      { key: "plate", label: "Placa" }, { key: "desc", label: "Veículo", render: (r) => `${r.make} ${r.model} ${r.year} · ${r.color}` }, { key: "categoryName", label: "Categoria" }, { key: "driverName", label: "Motorista" },
      { key: "status", label: "Situação", render: (r) => <Badge tone={DRIVER_TONE[r.status]}>{REVIEW_LABEL[r.status]}</Badge> },
    ]} actions={can(role, "vehicles", "write") ? (r) => r.status === "approved" ? null : (
      <div className="flex gap-1">
        <button type="button" className="btn btn-soft btn-sm" disabled={busy} onClick={() => run(async () => { await api(`/api/admin/vehicles/${r.id}`, { body: { status: "approved" } }); reload(); })}>Aprovar</button>
        {r.status === "pending" && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(async () => { await api(`/api/admin/vehicles/${r.id}`, { body: { status: "rejected" } }); reload(); })}>Recusar</button>}
      </div>
    ) : undefined} />}</>;
}

const ROLE_LABEL: Record<string, string> = { passenger: "Passageiro", driver: "Motorista", admin: "Administrador", gestor: "Gestor", atendente: "Atendente" };

function Users() {
  const role = useRole();
  const { data, loading, reload } = useLive<{ rows: Row[] }>("/api/admin/users");
  const { error, busy, run } = useAction();
  const [q, setQ] = useState("");
  const rows = useMemo(() => data?.rows.filter((u) => `${u.name} ${u.email} ${u.phone}`.toLowerCase().includes(q.toLowerCase())) ?? [], [data, q]);
  if (loading && !data) return <Spinner />;
  return <><PageTitle>Usuários</PageTitle>
    <input className="input mb-4 max-w-sm" placeholder="Buscar por nome, e-mail ou telefone" aria-label="Buscar usuários" value={q} onChange={(e) => setQ(e.target.value)} />
    <ErrorNote>{error}</ErrorNote>
    {!rows.length ? <Empty icon="users" title="Nenhum usuário encontrado" /> : <DataTable rows={rows} columns={[
      { key: "name", label: "Nome" }, { key: "email", label: "E-mail" }, { key: "phone", label: "Telefone" }, { key: "role", label: "Perfil", render: (r) => ROLE_LABEL[r.role] },
      { key: "status", label: "Situação", render: (r) => <Badge tone={r.status === "active" ? "ok" : "danger"}>{({ active: "Ativo", suspended: "Suspenso", deleted: "Excluído" } as Record<string, string>)[r.status]}</Badge> },
      { key: "createdAt", label: "Desde", render: (r) => new Date(r.createdAt).toLocaleDateString("pt-BR") },
    ]} actions={can(role, "users", "write") ? (r) => r.status === "deleted" ? null : (
      <button type="button" className="btn btn-soft btn-sm" disabled={busy} onClick={() => run(async () => { await api(`/api/admin/users/${r.id}`, { body: { status: r.status === "active" ? "suspended" : "active" } }); reload(); })}>{r.status === "active" ? "Suspender" : "Reativar"}</button>
    ) : undefined} />}</>;
}

function Rides() {
  const { data, loading } = useLive<{ rows: Row[] }>("/api/admin/rides");
  if (loading && !data) return <Spinner />;
  return <><PageTitle sub="Últimas 200 corridas, atualizadas em tempo real.">Viagens</PageTitle>
    {!data?.rows.length ? <Empty title="Nenhuma corrida registrada" /> : <DataTable rows={data.rows} columns={[
      { key: "createdAt", label: "Pedido", render: (r) => dateTime(r.createdAt) }, { key: "statusLabel", label: "Situação", render: (r) => <Badge tone={r.status === "completed" ? "ok" : r.status === "cancelled" ? "danger" : "brand"}>{r.statusLabel}</Badge> },
      { key: "route", label: "Trajeto", render: (r) => `${r.origin.label} → ${r.dest.label}` }, { key: "distanceM", label: "Distância", render: (r) => km(r.distanceM) },
      { key: "driver", label: "Motorista", render: (r) => r.driver?.name ?? "—" }, { key: "grossCents", label: "Bruto", kind: "money" }, { key: "commissionCents", label: "Comissão", kind: "money" },
      { key: "paymentMethod", label: "Pagamento", render: (r) => METHOD_LABEL[r.paymentMethod] },
    ]} />}</>;
}

function Payments() {
  const role = useRole();
  const { data, loading, reload } = useLive<{ payments: Row[]; withdrawals: Row[] }>("/api/admin/payments");
  const { error, busy, run } = useAction();
  if (loading && !data) return <Spinner />;
  const act = (id: string, status: string) => run(async () => { await api(`/api/admin/withdrawals/${id}`, { body: { status } }); reload(); });
  return <><PageTitle sub="Marque como pago só depois de transferir: o sistema ainda não movimenta dinheiro sozinho.">Pagamentos e saques</PageTitle>
    <ErrorNote>{error}</ErrorNote>
    <h2 className="display mb-3 text-2xl">Saques</h2>
    {!data?.withdrawals.length ? <Empty icon="wallet" title="Nenhum saque solicitado" /> : <DataTable rows={data.withdrawals} columns={[
      { key: "createdAt", label: "Pedido", render: (r) => dateTime(r.createdAt) }, { key: "driverName", label: "Motorista" }, { key: "amountCents", label: "Valor", kind: "money" }, { key: "pixKey", label: "Chave Pix" },
      { key: "status", label: "Situação", render: (r) => <Badge tone={r.status === "paid" ? "ok" : r.status === "rejected" ? "danger" : "warn"}>{({ requested: "Solicitado", paid: "Pago", rejected: "Recusado" } as Record<string, string>)[r.status]}</Badge> },
    ]} actions={can(role, "payments", "write") ? (r) => r.status !== "requested" ? null : (
      <div className="flex gap-1"><button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => act(r.id, "paid")}>Marcar como pago</button><button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(r.id, "rejected")}>Recusar</button></div>
    ) : undefined} />}
    <h2 className="display mt-8 mb-3 text-2xl">Pagamentos de corridas</h2>
    {!data?.payments.length ? <Empty icon="receipt" title="Nenhum pagamento registrado" /> : <DataTable rows={data.payments} columns={[
      { key: "createdAt", label: "Data", render: (r) => dateTime(r.createdAt) }, { key: "method", label: "Forma", render: (r) => METHOD_LABEL[r.method] }, { key: "provider", label: "Origem", render: (r) => r.provider === "manual" ? "Direto ao motorista" : "Mercado Pago" },
      { key: "amountCents", label: "Valor", kind: "money" }, { key: "status", label: "Situação", render: (r) => <Badge tone={r.status === "paid" ? "ok" : r.status === "failed" ? "danger" : "warn"}>{({ paid: "Pago", pending: "Pendente", failed: "Falhou" } as Record<string, string>)[r.status]}</Badge> },
    ]} />}</>;
}

const TICKET_KIND: Record<string, string> = { ajuda: "Ajuda", reclamacao: "Reclamação", sugestao: "Sugestão", ocorrencia: "Ocorrência", emergencia: "Emergência" };

function Tickets() {
  const { data, loading, reload } = useLive<{ rows: Row[] }>("/api/admin/tickets");
  const { error, busy, run } = useAction();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  if (loading && !data) return <Spinner />;
  const weight: Record<string, number> = { critical: 0, high: 1, normal: 2 };
  const rows = [...(data?.rows ?? [])].sort((a, b) => Number(a.status === "closed") - Number(b.status === "closed") || weight[a.priority] - weight[b.priority]);
  return <><PageTitle sub="Emergências no topo. Motoristas têm prioridade alta.">Chamados</PageTitle><ErrorNote>{error}</ErrorNote>
    {!rows.length ? <Empty icon="help" title="Nenhum chamado aberto" /> : (
      <ul className="space-y-3">{rows.map((t) => (
        <li key={t.id} className="card p-4" style={t.priority === "critical" && t.status !== "closed" ? { boxShadow: "0 0 0 2px var(--danger)" } : undefined}>
          <div className="flex flex-wrap items-center gap-2"><Badge tone={t.priority === "critical" ? "danger" : t.priority === "high" ? "warn" : "neutral"}>{TICKET_KIND[t.kind]}</Badge><Badge tone={t.status === "closed" ? "ok" : "brand"}>{({ open: "Aberto", in_progress: "Em atendimento", closed: "Encerrado" } as Record<string, string>)[t.status]}</Badge><span className="ml-auto text-xs text-muted">{t.userName} · {dateTime(t.createdAt)}</span></div>
          <p className="mt-2 font-semibold">{t.subject}</p><p className="text-sm text-muted">{t.body}</p>
          {t.rideId && <p className="num text-xs text-muted">Corrida {String(t.rideId).slice(0, 8)}</p>}
          {t.response && <p className="mt-2 rounded-xl bg-surface-2 p-3 text-sm"><strong>Resposta:</strong> {t.response}</p>}
          {t.status !== "closed" && (
            <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); run(async () => { await api(`/api/admin/tickets/${t.id}`, { body: { status: "in_progress", response: answers[t.id] } }); setAnswers((a) => ({ ...a, [t.id]: "" })); reload(); }); }}>
              <input className="input" aria-label="Resposta" placeholder="Escreva a resposta" required value={answers[t.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [t.id]: e.target.value }))} />
              <button className="btn btn-primary" disabled={busy}>Responder</button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run(async () => { await api(`/api/admin/tickets/${t.id}`, { body: { status: "closed" } }); reload(); })}>Encerrar</button>
            </form>
          )}
        </li>
      ))}</ul>
    )}</>;
}

function Reports() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const qs = `from=${from}&to=${to}`;
  const { data, loading } = useLive<{ rows: Row[] }>(`/api/admin/reports?${qs}`, { live: false });
  const total = (k: string) => data?.rows.reduce((a, r) => a + Number(r[k]), 0) ?? 0;
  return <><PageTitle sub="Corridas concluídas no período.">Relatórios financeiros</PageTitle>
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <Field label="De"><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
      <Field label="Até"><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      <a className="btn btn-soft" href={`/api/admin/reports?${qs}&format=csv`}>Baixar CSV</a>
    </div>
    {loading && !data ? <Spinner /> : !data?.rows.length ? <Empty icon="receipt" title="Nenhuma corrida concluída neste período" /> : <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Bruto", "gross"], ["Comissões", "commission"], ["Taxas", "fees"], ["Líquido motoristas", "net"]].map(([l, k]) => <div key={k} className="card p-4"><p className="text-sm text-muted">{l}</p><p className="display num mt-1 text-2xl">{brl(total(k))}</p></div>)}
      </div>
      <DataTable rows={data.rows.map((r) => ({ ...r, id: r.day }))} columns={[
        { key: "day", label: "Dia" }, { key: "rides", label: "Corridas" }, { key: "gross", label: "Bruto", kind: "money" }, { key: "commission", label: "Comissão", kind: "money" }, { key: "fees", label: "Taxas", kind: "money" }, { key: "discounts", label: "Descontos", kind: "money" }, { key: "net", label: "Líquido motoristas", kind: "money" },
      ]} />
    </>}</>;
}

function Leads() {
  const { data, loading } = useLive<{ rows: Row[] }>("/api/admin/r/leads", { live: false });
  if (loading && !data) return <Spinner />;
  return <><PageTitle sub="Pessoas e empresas que falaram com a Orbi pelo site.">Interessados</PageTitle>
    {!data?.rows.length ? <Empty icon="doc" title="Nenhum contato recebido" /> : <DataTable rows={data.rows} columns={[
      { key: "createdAt", label: "Data", render: (r) => dateTime(r.createdAt) }, { key: "kind", label: "Tipo" }, { key: "name", label: "Nome" }, { key: "email", label: "E-mail" }, { key: "phone", label: "Telefone" }, { key: "city", label: "Cidade" }, { key: "message", label: "Mensagem" },
    ]} />}</>;
}

function Audit() {
  const { data, loading } = useLive<{ rows: Row[] }>("/api/admin/r/audit", { live: false });
  if (loading && !data) return <Spinner />;
  return <><PageTitle sub="Registro de login, aprovações, alterações e acesso a documentos.">Histórico de atividades</PageTitle>
    {!data?.rows.length ? <Empty icon="history" title="Nenhuma atividade registrada" /> : <DataTable rows={data.rows} columns={[
      { key: "createdAt", label: "Quando", render: (r) => dateTime(r.createdAt) }, { key: "action", label: "Ação" }, { key: "entity", label: "Tipo" }, { key: "entityId", label: "Registro", render: (r) => r.entityId ? String(r.entityId).slice(0, 8) : "—" }, { key: "actorId", label: "Quem", render: (r) => r.actorId ? String(r.actorId).slice(0, 8) : "Sistema" },
    ]} />}</>;
}

function Settings() {
  const role = useRole();
  const write = can(role, "settings", "write");
  const { data, reload } = useLive<{ dispatchWeights: DispatchWeights; dispatch: { offerTimeoutS: number; searchTimeoutS: number }; withdrawal: { minCents: number }; schedule: ScheduleRules; support: { whatsapp: string }; payments: { cash: boolean; pix_driver: boolean; card_machine: boolean }; driverRules: DriverRules }>("/api/admin/settings", { live: false });
  const [draft, setDraft] = useState<NonNullable<typeof data> | null>(null);
  const { busy, error, run } = useAction();
  const [saved, setSaved] = useState(false);
  const v = draft ?? data;
  if (!v) return <Spinner />;
  const total = Object.values(v.dispatchWeights).reduce((a, b) => a + Number(b), 0) || 1;
  return <><PageTitle sub="O equilíbrio entre passageiro, motorista e plataforma é definido aqui.">Configurações</PageTitle>
    <section className="card p-5">
      <h2 className="display mb-1 text-xl">Pesos da distribuição de corridas</h2>
      <p className="mb-4 text-sm text-muted">Cada critério vale uma parte da nota do motorista para a corrida.</p>
      <div className="space-y-3">
        {(Object.keys(WEIGHT_LABELS) as (keyof DispatchWeights)[]).map((k) => (
          <label key={k} className="grid items-center gap-2 text-sm sm:grid-cols-[220px_1fr_56px]">
            <span className="font-medium">{WEIGHT_LABELS[k]}</span>
            <input type="range" min={0} max={100} disabled={!write} value={v.dispatchWeights[k]} onChange={(e) => setDraft({ ...v, dispatchWeights: { ...v.dispatchWeights, [k]: Number(e.target.value) } })} className="accent-[var(--primary)]" />
            <span className="num text-right">{Math.round((v.dispatchWeights[k] / total) * 100)}%</span>
          </label>
        ))}
      </div>
    </section>
    <section className="card mt-4 grid gap-3 p-5 sm:grid-cols-3">
      <Field label="Tempo da oferta (s)"><input className="input" inputMode="numeric" disabled={!write} value={v.dispatch.offerTimeoutS} onChange={(e) => setDraft({ ...v, dispatch: { ...v.dispatch, offerTimeoutS: Number(e.target.value) } })} /></Field>
      <Field label="Tempo máximo de busca (s)"><input className="input" inputMode="numeric" disabled={!write} value={v.dispatch.searchTimeoutS} onChange={(e) => setDraft({ ...v, dispatch: { ...v.dispatch, searchTimeoutS: Number(e.target.value) } })} /></Field>
      <Field label="Saque mínimo (centavos)"><input className="input" inputMode="numeric" disabled={!write} value={v.withdrawal.minCents} onChange={(e) => setDraft({ ...v, withdrawal: { minCents: Number(e.target.value) } })} /></Field>
    </section>
    <section className="card mt-4 p-5">
      <h2 className="display mb-1 text-xl">Corridas agendadas</h2>
      <p className="mb-4 text-sm text-muted">O passageiro escolhe dia e hora; a busca por motorista começa alguns minutos antes.</p>
      <div className="grid gap-3 sm:grid-cols-4">
        {([["minLeadMin", "Antecedência mínima (min)"], ["maxDays", "Até quantos dias à frente"], ["searchLeadMin", "Buscar motorista antes (min)"], ["maxPerPassenger", "Agendadas por passageiro"]] as const).map(([k, label]) => (
          <Field key={k} label={label}><input className="input" inputMode="numeric" disabled={!write} value={v.schedule[k]} onChange={(e) => setDraft({ ...v, schedule: { ...v.schedule, [k]: Number(e.target.value) } })} /></Field>
        ))}
      </div>
    </section>
    <section className="card mt-4 p-5">
      <h2 className="display mb-1 text-xl">Requisitos do motorista</h2>
      <p className="mb-4 text-sm text-muted">Base legal: CNH B ou superior com EAR, CRLV em dia, antecedentes criminais e INSS (Lei 13.640/2018). Idade, tempo de habilitação e idade do carro variam conforme a regra do município: ajuste aqui antes de operar.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {([["minAge", "Idade mínima (anos)"], ["minLicenseYears", "Anos de habilitação"], ["maxVehicleAge", "Idade máxima do carro (anos)"], ["minDoors", "Portas, no mínimo"], ["minSeats", "Lugares, no mínimo"]] as const).map(([k, label]) => (
          <Field key={k} label={label}><input className="input" inputMode="numeric" disabled={!write} value={v.driverRules[k]} onChange={(e) => setDraft({ ...v, driverRules: { ...v.driverRules, [k]: Number(e.target.value) } })} /></Field>
        ))}
        <label className="flex items-center gap-3 self-end py-3 font-semibold"><input type="checkbox" className="size-5 accent-[var(--primary)]" disabled={!write} checked={v.driverRules.requireAirConditioning} onChange={(e) => setDraft({ ...v, driverRules: { ...v.driverRules, requireAirConditioning: e.target.checked } })} />Exigir ar-condicionado</label>
      </div>
      <p className="mt-5 mb-1 text-sm font-semibold">Moto (mototáxi)</p>
      <p className="mb-3 text-sm text-muted">Lei 12.009/2009: 2 anos na categoria A, curso de mototaxista e equipamentos de segurança. A modalidade só aparece para passageiros quando ligada em Modalidades, depois de confirmar a autorização de cada município. O certificado do curso é exigido de quem cadastra moto.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {([["motoMinLicenseYears", "Anos na categoria A"], ["maxMotoAge", "Idade máxima da moto (anos)"]] as const).map(([k, label]) => (
          <Field key={k} label={label}><input className="input" inputMode="numeric" disabled={!write} value={v.driverRules[k]} onChange={(e) => setDraft({ ...v, driverRules: { ...v.driverRules, [k]: Number(e.target.value) } })} /></Field>
        ))}
      </div>
      <p className="mt-4 mb-2 text-sm font-semibold">Documentos obrigatórios para aprovar</p>
      <div className="grid gap-1 sm:grid-cols-2">
        {DOC_KINDS.map((k) => (
          <label key={k} className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-2">
            <input type="checkbox" className="size-5 accent-[var(--primary)]" disabled={!write || k === "cnh" || k === "crlv"} checked={v.driverRules.requiredDocs.includes(k)}
              onChange={(e) => setDraft({ ...v, driverRules: { ...v.driverRules, requiredDocs: e.target.checked ? [...v.driverRules.requiredDocs, k] : v.driverRules.requiredDocs.filter((x) => x !== k) } })} />
            <span>{DOC_INFO[k].label}{k === "cnh" || k === "crlv" ? " (sempre)" : ""}</span>
          </label>
        ))}
      </div>
    </section>
    <section className="card mt-4 p-5">
      <h2 className="display mb-1 text-xl">Formas de pagamento</h2>
      <p className="mb-4 text-sm text-muted">Pagas direto ao motorista: ele recebe o valor inteiro e o extrato registra a comissão a acertar. Pix e cartão pelo app dependem do contrato com o provedor.</p>
      <div className="space-y-2">
        {([["cash", "Dinheiro"], ["pix_driver", "Pix na chave do motorista (QR Code gerado pelo app)"], ["card_machine", "Cartão na maquininha do motorista"]] as const).map(([k, label]) => (
          <label key={k} className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-2">
            <input type="checkbox" className="size-5 accent-[var(--primary)]" disabled={!write} checked={v.payments[k]} onChange={(e) => setDraft({ ...v, payments: { ...v.payments, [k]: e.target.checked } })} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </section>
    <section className="card mt-4 p-5">
      <h2 className="display mb-1 text-xl">Atendimento</h2>
      <p className="mb-4 text-sm text-muted">O WhatsApp aparece como botão na central de ajuda do site. Deixe vazio para esconder o botão.</p>
      <Field label="WhatsApp (55 + DDD + número)"><input className="input num" inputMode="tel" disabled={!write} placeholder="5531999999999" value={v.support.whatsapp} onChange={(e) => setDraft({ ...v, support: { whatsapp: e.target.value.replace(/\D/g, "").slice(0, 13) } })} /></Field>
    </section>
    <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>
    {write && <button type="button" className="btn btn-primary mt-4" disabled={busy || !draft} onClick={() => run(async () => { await api("/api/admin/settings", { body: draft }); setDraft(null); setSaved(true); reload(); })}>Salvar configurações</button>}
    {saved && !draft && <p className="mt-2 text-sm text-ok" role="status">Configurações salvas.</p>}
    <p className="mt-6 text-sm text-muted">A identidade visual é escolhida em <a className="underline" href="/identidade">Identidade visual</a>.</p>
  </>;
}

function Staff() {
  const { data, reload } = useLive<{ rows: Row[] }>("/api/admin/users", { live: false });
  const [f, setF] = useState({ name: "", email: "", password: "", role: "atendente" });
  const { busy, error, run } = useAction();
  const rows = data?.rows.filter((u) => ["admin", "gestor", "atendente"].includes(u.role)) ?? [];
  return <><PageTitle sub="Atendente trata chamados. Gestor opera tudo, menos a equipe. Administrador tem acesso total.">Equipe</PageTitle>
    <form className="card mb-4 grid gap-3 p-5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await api("/api/admin/staff", { body: f }); setF({ name: "", email: "", password: "", role: "atendente" }); reload(); }); }}>
      <Field label="Nome"><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="E-mail"><input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      <Field label="Senha inicial" hint="Pelo menos 10 caracteres."><input className="input" type="password" autoComplete="new-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
      <Field label="Nível de acesso"><select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="atendente">Atendente</option><option value="gestor">Gestor</option><option value="admin">Administrador</option></select></Field>
      <div className="sm:col-span-2"><ErrorNote>{error}</ErrorNote></div>
      <button className="btn btn-primary sm:w-fit" disabled={busy}>Adicionar à equipe</button>
    </form>
    {rows.length > 0 && <DataTable rows={rows} columns={[{ key: "name", label: "Nome" }, { key: "email", label: "E-mail" }, { key: "role", label: "Nível", render: (r) => ROLE_LABEL[r.role] }]} />}
  </>;
}

const SECTIONS: Record<string, { res: Parameters<typeof can>[1]; view: () => React.ReactNode }> = {
  motoristas: { res: "drivers", view: Drivers }, veiculos: { res: "vehicles", view: Vehicles }, usuarios: { res: "users", view: Users }, viagens: { res: "rides", view: Rides },
  chamados: { res: "tickets", view: Tickets }, pagamentos: { res: "payments", view: Payments }, relatorios: { res: "reports", view: Reports }, tarifas: { res: "tariffs", view: Tariffs },
  planos: { res: "plans", view: CrudPlans }, cupons: { res: "coupons", view: CrudCoupons }, campanhas: { res: "campaigns", view: CrudCampaigns }, parceiros: { res: "partners", view: CrudPartners },
  interessados: { res: "leads", view: Leads }, regioes: { res: "regions", view: CrudRegions }, modalidades: { res: "modalities", view: CrudModalities }, configuracoes: { res: "settings", view: Settings },
  equipe: { res: "staff", view: Staff }, atividades: { res: "audit", view: Audit },
};

export default function AdminSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = use(params);
  const role = useRole();
  const cfg = SECTIONS[section];
  if (!cfg) notFound();
  if (!can(role, cfg.res, "read")) return <Empty icon="lock" title="Seu nível de acesso não inclui esta área" />;
  const View = cfg.view;
  return <View />;
}

