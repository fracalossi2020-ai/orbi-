/**
 * Regras do agendamento. Os números vêm da configuração "schedule" do painel; estes são os valores iniciais.
 * minLeadMin: antecedência mínima ao agendar. maxDays: até quantos dias à frente.
 * searchLeadMin: quantos minutos antes do horário a busca por motorista começa.
 * maxPerPassenger: quantas corridas agendadas uma conta pode ter ao mesmo tempo.
 */
export type ScheduleRules = { minLeadMin: number; maxDays: number; searchLeadMin: number; maxPerPassenger: number };
export const DEFAULT_SCHEDULE: ScheduleRules = { minLeadMin: 30, maxDays: 7, searchLeadMin: 10, maxPerPassenger: 3 };

/** Devolve o motivo da recusa, ou null quando o horário pode ser agendado. */
export function scheduleProblem(at: Date, now: Date, rules: ScheduleRules): string | null {
  if (Number.isNaN(at.getTime())) return "Horário inválido.";
  const diffMin = (at.getTime() - now.getTime()) / 60_000;
  if (diffMin < rules.minLeadMin) return `Agende com pelo menos ${rules.minLeadMin} minutos de antecedência. Para agora, escolha "Agora".`;
  if (diffMin > rules.maxDays * 24 * 60) return `Dá para agendar até ${rules.maxDays} dias à frente.`;
  return null;
}

/** Momento em que a corrida agendada entra na fila de motoristas. */
export const searchStartsAt = (at: Date, rules: ScheduleRules) => new Date(at.getTime() - rules.searchLeadMin * 60_000);
