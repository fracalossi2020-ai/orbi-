"use client";
import Link from "next/link";
import { useState } from "react";
import { api, ErrorNote, Field, useAction } from "@/components/ui";

export function LeadForm({ kind, cta, askCity = true, messageLabel = "Mensagem" }: { kind: "passageiro" | "motorista" | "parceiro" | "contato"; cta: string; askCity?: boolean; messageLabel?: string }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", city: "", message: "", consent: false });
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useAction();
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  if (sent) {
    return <p role="status" className="card anim-rise p-6 font-medium">Recebemos sua mensagem. Vamos responder pelo e-mail informado.</p>;
  }
  return (
    <form className="card space-y-4 p-5 md:p-7" onSubmit={(e) => { e.preventDefault(); run(async () => { await api("/api/public/leads", { body: { kind, ...f } }); setSent(true); }); }}>
      <Field label="Nome"><input className="input" autoComplete="name" required value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="E-mail"><input className="input" type="email" autoComplete="email" required value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Telefone (opcional)"><input className="input" type="tel" autoComplete="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
      </div>
      {askCity && <Field label="Cidade"><input className="input" value={f.city} onChange={(e) => set("city", e.target.value)} /></Field>}
      <Field label={messageLabel}><textarea className="input min-h-28" value={f.message} onChange={(e) => set("message", e.target.value)} /></Field>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-0.5 size-5 accent-[var(--primary)]" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} />
        <span>Autorizo a Orbi a usar estes dados para responder este contato, conforme a <Link href="/privacidade" className="underline">política de privacidade</Link>.</span>
      </label>
      <ErrorNote>{error}</ErrorNote>
      <button className="btn btn-primary w-full sm:w-auto" disabled={busy}>{busy ? "Enviando…" : cta}</button>
    </form>
  );
}
