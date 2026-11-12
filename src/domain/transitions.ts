export type RideStatus = "scheduled" | "searching" | "accepted" | "arrived" | "in_progress" | "completed" | "cancelled" | "no_driver";

const ALLOWED: Record<RideStatus, RideStatus[]> = {
  scheduled: ["searching", "cancelled"],
  searching: ["accepted", "cancelled", "no_driver"],
  accepted: ["arrived", "cancelled", "searching"],
  arrived: ["in_progress", "cancelled"],
  in_progress: ["completed"],
  completed: [], cancelled: [], no_driver: [],
};
export const canTransition = (from: RideStatus, to: RideStatus) => ALLOWED[from].includes(to);
export const ACTIVE_STATUSES: RideStatus[] = ["searching", "accepted", "arrived", "in_progress"];
export const STATUS_LABEL: Record<RideStatus, string> = {
  scheduled: "Agendada", searching: "Procurando motorista", accepted: "Motorista a caminho", arrived: "Motorista chegou",
  in_progress: "Em viagem", completed: "Concluída", cancelled: "Cancelada", no_driver: "Sem motorista disponível",
};
