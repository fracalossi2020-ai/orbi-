import { redirect } from "next/navigation";
import { mfaPending, readSession } from "./auth";
import type { Role } from "@/domain/permissions";

/** Protege as páginas no servidor: quem não pode entrar nem chega a receber a tela. */
export async function requireRole(roles: Role[]) {
  const r = await readSession();
  if (!r) redirect("/entrar");
  // Senha certa, mas falta o código do aplicativo autenticador.
  if (mfaPending(r)) redirect("/entrar?etapa=codigo");
  const user = r.user;
  if (!roles.includes(user.role)) {
    redirect(user.role === "driver" ? "/motorista" : user.role === "passenger" ? "/passageiro" : "/admin");
  }
  return user;
}
