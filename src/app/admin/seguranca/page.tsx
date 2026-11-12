"use client";
import { PageTitle } from "@/components/app/AppShell";
import { SecurityPanel } from "@/components/app/SecurityPanel";

export default function Page() {
  return <><PageTitle sub="Senha, verificação em duas etapas e aparelhos conectados.">Minha segurança</PageTitle><SecurityPanel /></>;
}
