"use client";
import { useState } from "react";
import { PageTitle } from "./AppShell";
import { SecurityPanel } from "./SecurityPanel";
import { Icon } from "@/components/Icon";
import { api, Badge, dateTime, Empty, ErrorNote, Field, Note, Spinner, useAction, useLive } from "@/components/ui";

type Ticket = { id: string; kind: string; subject: string; body: string; status: string; response: string | null; createdAt: string; priority: string };
const KIND_LABEL: Record<string, string> = { ajuda: "Ajuda", reclamacao: "Reclamação", sugestao: "Sugestão", ocorrencia: "Ocorrência", emergencia: "Emergência" };
const STATUS: Record<string, [string, "warn" | "brand" | "ok"]> = { open: ["Aberto", "warn"], in_progress: ["Em atendimento", "brand"], closed: ["Encerrado", "ok"] };

export function HelpPage({ priorityNote }: { priorityNote?: string }) {
  const { data, loading, reload } = useLive<{ tickets: Ticket[] }>("/api/account/tickets");
  const [f, setF] = useState({ kind: "ajuda", subject: "", body: "" });
  const { busy, error, run } = useAction();
  return (
    <>
      <PageTitle sub={priorityNote ?? "Ajuda, reclamações e sugestões ficam registradas aqui."}>Central de ajuda</PageTitle>
      <div className="mb-5 flex items-center gap-3 rounded-2xl p-4" style={{ background: "color-mix(in srgb, var(--danger) 10%, transparent)" }}>
        <span className="text-danger"><Icon name="sos" /></span>
        <p className="flex-1 text-sm">Em emergência, ligue para a polícia.</p>
        <a href="tel:190" className="btn btn-danger btn-sm">Ligar 190</a>
      </div>
      <form className="card space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); run(async () => { await api("/api/account/tickets", { body: f }); setF({ kind: "ajuda", subject: "", body: "" }); reload(); }); }}>
        <Field label="Tipo">
          <select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            <option value="ajuda">Preciso de ajuda</option><option value="reclamacao">Quero reclamar</option><option value="sugestao">Tenho uma sugestão</option><option value="ocorrencia">Registrar ocorrência</option>
          </select>
        </Field>
        <Field label="Assunto"><input className="input" required value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
        <Field label="O que aconteceu?"><textarea className="input min-h-28" required value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
        <ErrorNote>{error}</ErrorNote>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Enviando…" : "Enviar"}</button>
      </form>
      <h2 className="display mt-8 mb-3 text-2xl">Seus chamados</h2>
      {loading && !data ? <Spinner /> : !data?.tickets.length ? <Empty icon="help" title="Nenhum chamado aberto" /> : (
        <ul className="space-y-3">
          {data.tickets.map((t) => (
            <li key={t.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2"><Badge>{KIND_LABEL[t.kind] ?? t.kind}</Badge><Badge tone={STATUS[t.status]?.[1]}>{STATUS[t.status]?.[0]}</Badge><span className="ml-auto text-xs text-muted">{dateTime(t.createdAt)}</span></div>
              <p className="mt-2 font-semibold">{t.subject}</p>
              <p className="text-sm text-muted">{t.body}</p>
              {t.response && <p className="mt-2 rounded-xl bg-surface-2 p-3 text-sm"><strong>Resposta:</strong> {t.response}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Confirmação e troca de e-mail por código. É o canal de recuperação de senha, por isso aparece em destaque enquanto não estiver confirmado. */
function EmailCard({ email, verified, onDone }: { email: string | null; verified: boolean; onDone: () => void }) {
  const [editing, setEditing] = useState(!email);
  const [newEmail, setNewEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const { busy, error, run } = useAction();
  const send = (target?: string) => run(async () => {
    const r = await api<{ sentTo: string }>("/api/auth/email-send", { body: target ? { email: target } : {} });
    setSentTo(r.sentTo); setCode(""); setEditing(false); onDone();
  });

  if (email && verified && !editing) {
    return (
      <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div><h2 className="display text-xl">E-mail</h2><p className="text-muted">{email} <Badge tone="ok">Confirmado</Badge></p></div>
        <button type="button" className="btn btn-soft btn-sm" onClick={() => setEditing(true)}>Trocar e-mail</button>
      </section>
    );
  }
  return (
    <section className="card space-y-3 p-5">
      <h2 className="display text-xl">{email ? "Confirme seu e-mail" : "Cadastre um e-mail"}</h2>
      <p className="text-sm text-muted">É por ele que você recupera a conta se esquecer a senha.</p>
      {editing ? (
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); send(newEmail.trim()); }}>
          <input className="input" type="email" required aria-label="Novo e-mail" placeholder="voce@email.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          <button className="btn btn-primary" disabled={busy}>Enviar código</button>
        </form>
      ) : sentTo ? (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await api("/api/auth/email-confirm", { body: { code } }); setSentTo(null); onDone(); }); }}>
          <p className="text-sm">Enviamos um código de 6 dígitos para <strong>{sentTo}</strong>.</p>
          <div className="flex gap-2">
            <input className="input num tracking-[.3em]" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} aria-label="Código de confirmação" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            <button className="btn btn-primary" disabled={busy}>Confirmar</button>
          </div>
          <button type="button" className="text-sm font-semibold underline" disabled={busy} onClick={() => send()}>Enviar outro código</button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="basis-full text-sm break-all">{email} <Badge tone="warn">Não confirmado</Badge></p>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => send()}>Enviar código</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Trocar e-mail</button>
        </div>
      )}
      <ErrorNote>{error}</ErrorNote>
    </section>
  );
}

/** children: seções que só um perfil tem, como os locais salvos do passageiro. */
export function AccountPage({ children }: { children?: React.ReactNode } = {}) {
  const { data, reload } = useLive<{ user: { name: string; email: string | null; emailVerified: boolean; phone: string | null; rating: number | null; ratingCount: number } | null }>("/api/me", { live: false });
  const { busy, error, run } = useAction();
  const [confirming, setConfirming] = useState(false);
  const u = data?.user;
  return (
    <>
      <PageTitle>Conta</PageTitle>
      {!u ? <Spinner /> : (
        <div className="space-y-6">
          <section className="card p-5">
            <p className="display text-2xl">{u.name}</p>
            <p className="text-muted">{[u.email, u.phone].filter(Boolean).join(" · ")}</p>
            <p className="mt-2 text-sm">{u.ratingCount ? <>Sua nota: <strong className="num">{u.rating!.toFixed(1).replace(".", ",")}</strong> em {u.ratingCount} avaliaç{u.ratingCount > 1 ? "ões" : "ão"}</> : "Você ainda não recebeu avaliações."}</p>
          </section>
          <EmailCard email={u.email} verified={u.emailVerified} onDone={reload} />
          {children}
          <SecurityPanel />
          <section className="card space-y-3 p-5">
            <h2 className="display text-xl">Seus dados (LGPD)</h2>
            <p className="text-sm text-muted">Baixe uma cópia completa ou exclua sua conta. Registros financeiros e de viagem ficam retidos sem identificação pelo prazo legal.</p>
            <a href="/api/me/export" className="btn btn-soft">Baixar meus dados</a>
            {!confirming
              ? <button type="button" className="btn btn-ghost block text-danger" onClick={() => setConfirming(true)}>Excluir minha conta</button>
              : (
                <div className="space-y-2">
                  <Note tone="warn">A exclusão é definitiva. Não será possível recuperar a conta.</Note>
                  <div className="flex gap-2">
                    <button type="button" className="btn btn-danger" disabled={busy} onClick={() => run(async () => { await api("/api/me", { method: "DELETE" }); window.location.href = "/entrar"; })}>Excluir definitivamente</button>
                    <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>Manter conta</button>
                  </div>
                </div>
              )}
            <ErrorNote>{error}</ErrorNote>
          </section>
          <button type="button" className="btn btn-soft w-full md:hidden" disabled={busy} onClick={() => run(async () => { await api("/api/auth/logout", { body: {} }); window.location.href = "/entrar"; })}><Icon name="logout" size={18} /> Sair da conta</button>
        </div>
      )}
    </>
  );
}
