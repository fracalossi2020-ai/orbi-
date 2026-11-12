import Link from "next/link";
import { Club } from "@/components/site/Club";
import { Dark } from "@/components/site/Page";

export const metadata = { title: "Clube Orbi" };

export default function ClubePage() {
  return (
    <div className="pt-16">
      <Club />
      <Dark className="bg-[color-mix(in_srgb,var(--deep)_88%,#000)]">
        <div className="grid gap-8 lg:grid-cols-2">
          <h2 className="display text-4xl md:text-5xl">Minha Economia</h2>
          <div className="space-y-4 text-lg text-on-deep-muted">
            <p>No aplicativo do motorista, cada uso de um parceiro entra em “Minha Economia”: quanto custaria, quanto você pagou e o total poupado no ano.</p>
            <p>O Clube é exclusivo para motoristas com cadastro aprovado.</p>
            <Link href="/cadastro?perfil=motorista" className="btn btn-lg btn-on-deep">Quero dirigir</Link>
          </div>
        </div>
      </Dark>
    </div>
  );
}
