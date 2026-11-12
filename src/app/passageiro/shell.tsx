"use client";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";

const NAV = [
  { href: "/passageiro", label: "Viajar", icon: "prumo" },
  { href: "/passageiro/viagens", label: "Viagens", icon: "history" },
  { href: "/passageiro/ajuda", label: "Ajuda", icon: "help" },
  { href: "/passageiro/conta", label: "Conta", icon: "user" },
];

export function PassengerShell({ children }: { children: React.ReactNode }) {
  return <AppShell nav={NAV} title="Passageiro" topNav flush={usePathname() === "/passageiro"}>{children}</AppShell>;
}
