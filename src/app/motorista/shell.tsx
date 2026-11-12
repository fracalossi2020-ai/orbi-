"use client";
import { AppShell } from "@/components/app/AppShell";

const NAV = [
  { href: "/motorista", label: "Dirigir", icon: "steering" },
  { href: "/motorista/ganhos", label: "Ganhos", icon: "wallet" },
  { href: "/motorista/corridas", label: "Corridas", icon: "history" },
  { href: "/motorista/clube", label: "Clube", icon: "gift" },
  { href: "/motorista/ajuda", label: "Ajuda", icon: "help" },
  { href: "/motorista/conta", label: "Conta", icon: "user" },
];

export function DriverShell({ children }: { children: React.ReactNode }) {
  return <AppShell nav={NAV} title="Motorista" topNav>{children}</AppShell>;
}
