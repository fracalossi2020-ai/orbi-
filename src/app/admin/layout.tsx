import { requireRole } from "@/server/guard";
import { STAFF } from "@/domain/permissions";
import { AdminShell } from "./shell";

export const metadata = { title: "Administração" };

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(STAFF);
  // Equipe sem verificação em duas etapas vê só a tela de ativação: o painel tem dados de todos os usuários.
  const mfaReady = !!user.totpEnabledAt || process.env.PRUMO_REQUIRE_STAFF_MFA === "false";
  return <AdminShell role={user.role} mfaReady={mfaReady}>{children}</AdminShell>;
}
