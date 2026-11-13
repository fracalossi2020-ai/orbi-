"use client";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useSupport } from "./usePublic";

/** Versão vitrine: no lugar de Entrar e Cadastro, avisa que o app chega em breve e mostra como falar com a Orbi. */
export function DemoNotice() {
  const support = useSupport();
  return (
    <div className="card space-y-5 p-6 md:p-8">
      <p className="text-lg">Você está na versão de apresentação do site. O app de passageiro e o de motorista abrem em breve no Vale do Aço.</p>
      <p className="text-[var(--muted)]">Quer ser avisado no lançamento ou dirigir com a gente? Fale com a Orbi.</p>
      <div className="flex flex-wrap gap-3">
        {support?.whatsapp && (
          <a href={`https://wa.me/${support.whatsapp}?text=${encodeURIComponent("Olá, Orbi! Quero saber do lançamento.")}`} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            <Icon name="chat" size={18} /> Falar no WhatsApp
          </a>
        )}
        <Link href="/como-funciona" className="btn btn-ghost">Ver como funciona</Link>
      </div>
    </div>
  );
}
