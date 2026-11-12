import { requireRole } from "@/server/guard";
import { DriverShell } from "./shell";

export const metadata = { title: "Motorista" };

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireRole(["driver"]);
  return <DriverShell>{children}</DriverShell>;
}
