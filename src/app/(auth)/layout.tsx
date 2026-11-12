import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { currentUser } from "@/server/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Quem já entrou abre direto na própria tela, como em um aplicativo.
  const user = await currentUser();
  if (user) redirect(user.role === "driver" ? "/motorista" : user.role === "passenger" ? "/passageiro" : "/admin");
  return (
    <div className="grid min-h-svh lg:grid-cols-[1fr_1.1fr]">
      <aside className="on-deep relative hidden overflow-hidden bg-deep p-12 text-on-deep lg:flex lg:flex-col lg:justify-between">
        <Link href="/" aria-label="Orbi, página inicial"><Logo size={30} /></Link>
        <p className="display max-w-[12ch] text-6xl">Sua direção, nosso compromisso.</p>
      </aside>
      <main className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="mb-8 inline-block lg:hidden" aria-label="Orbi, página inicial"><Logo size={26} hole="var(--bg)" /></Link>
          {children}
        </div>
      </main>
    </div>
  );
}
