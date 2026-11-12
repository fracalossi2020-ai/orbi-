export type Role = "passenger" | "driver" | "admin" | "gestor" | "atendente";
export const STAFF: Role[] = ["admin", "gestor", "atendente"];

export type Resource =
  | "dashboard" | "users" | "drivers" | "documents" | "vehicles" | "rides" | "payments" | "withdrawals"
  | "tickets" | "coupons" | "campaigns" | "partners" | "plans" | "tariffs" | "regions" | "modalities"
  | "categories" | "leads" | "reports" | "audit" | "settings" | "staff" | "privacy";

const ATTENDANT_READ: Resource[] = ["users", "drivers", "documents", "vehicles", "rides", "payments", "partners", "regions", "leads", "privacy"];

export function can(role: Role, resource: Resource, mode: "read" | "write"): boolean {
  if (role === "admin") return true;
  if (role === "gestor") {
    if (resource === "staff") return false;
    if (resource === "audit" || resource === "settings") return mode === "read";
    return true;
  }
  if (role === "atendente") {
    if (resource === "tickets") return true;
    if (resource === "dashboard") return mode === "read";
    return mode === "read" && ATTENDANT_READ.includes(resource);
  }
  return false;
}
