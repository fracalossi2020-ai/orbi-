import { requireRole } from "@/server/guard";
import { PassengerShell } from "./shell";

export const metadata = { title: "Passageiro" };

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireRole(["passenger"]);
  return <PassengerShell>{children}</PassengerShell>;
}
