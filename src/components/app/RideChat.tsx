"use client";
import { useState } from "react";
import { api, ErrorNote, useAction } from "@/components/ui";
import { Icon } from "@/components/Icon";

export type Message = { id: string; mine: boolean; body: string };

export function RideChat({ rideId, messages, onSent }: { rideId: string; messages: Message[]; onSent: () => void }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const { busy, error, run } = useAction();
  const last = messages[messages.length - 1];
  return (
    <div>
      <button type="button" className="btn btn-soft w-full" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon name="chat" size={18} /> Mensagens{messages.length ? ` (${messages.length})` : ""}
      </button>
      {!open && last && <p className="mt-1.5 truncate text-xs text-muted">Última: {last.body}</p>}
      {open && (
        <div className="anim-rise mt-2 space-y-2">
          <div className="max-h-44 space-y-1.5 overflow-auto rounded-xl bg-surface-2 p-2.5" aria-live="polite">
            {!messages.length && <p className="text-sm text-muted">Nenhuma mensagem ainda.</p>}
            {messages.map((m) => (
              <p key={m.id} className={`w-fit max-w-[85%] rounded-xl px-3 py-1.5 text-sm ${m.mine ? "ml-auto bg-primary text-on-primary" : "bg-surface"}`}>{m.body}</p>
            ))}
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; run(async () => { await api(`/api/rides/${rideId}/message`, { body: { body: text } }); setText(""); onSent(); }); }}>
            <input className="input" aria-label="Mensagem" placeholder="Escreva uma mensagem" value={text} onChange={(e) => setText(e.target.value)} />
            <button className="btn btn-primary" disabled={busy}>Enviar</button>
          </form>
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </div>
  );
}
