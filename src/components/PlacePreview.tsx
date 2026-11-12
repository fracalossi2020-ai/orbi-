import { Icon } from "@/components/Icon";
import { KIND_ICON, KIND_LABEL, type Place } from "@/domain/place";

/**
 * Prévia do que o sistema reconheceu: nome, tipo, rua e bairro, e se o ponto está dentro da área atendida.
 * variant "deep" é para fundos escuros (site); "app" para as telas do aplicativo.
 */
export function PlacePreview({ place, role, variant = "app", inArea, compact }: { place: Place; role: string; variant?: "deep" | "app"; inArea?: boolean; compact?: boolean }) {
  const kind = place.kind ?? "place";
  const area = inArea ?? place.inArea;
  const deep = variant === "deep";
  // Versão curta, para resumos: mantém o que foi reconhecido sem ocupar a tela.
  if (compact) {
    return (
      <div className={`flex items-center gap-3 rounded-xl px-3 py-2 ${deep ? "bg-[color-mix(in_srgb,var(--on-deep)_8%,transparent)]" : "bg-surface-2"}`}>
        <Icon name={KIND_ICON[kind]} size={20} weight="duotone" className={deep ? "text-[var(--mark)]" : "text-brand"} />
        <div className="min-w-0 flex-1">
          <p className={`mono-label ${deep ? "text-on-deep-muted" : "text-muted"}`}>{role}</p>
          <p className="truncate text-sm font-semibold">{place.label}</p>
          <p className={`truncate text-xs ${deep ? "text-on-deep-muted" : "text-muted"}`}>{[place.approx ? "Posição aproximada na rua" : undefined, place.detail].filter(Boolean).join(" · ")}</p>
        </div>
        {area !== undefined && <span role="img" aria-label={area ? "Dentro da área atendida" : "Fora da área atendida"} className={area ? "text-ok" : "text-warn"}><Icon name={area ? "check" : "sos"} size={20} /></span>}
      </div>
    );
  }
  return (
    <div className={`flex items-start gap-3 rounded-2xl p-3 ${deep ? "bg-[color-mix(in_srgb,var(--on-deep)_8%,transparent)]" : "bg-surface-2"}`}>
      <span className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-full ${deep ? "bg-[color-mix(in_srgb,var(--mark)_18%,transparent)] text-[var(--mark)]" : "bg-surface text-brand"}`}><Icon name={KIND_ICON[kind]} size={20} weight="duotone" /></span>
      <div className="min-w-0 flex-1">
        <p className={`mono-label ${deep ? "text-on-deep-muted" : "text-muted"}`}>{role} · {KIND_LABEL[kind]}</p>
        <p className="mt-0.5 font-semibold [overflow-wrap:anywhere]">{place.label}</p>
        {place.detail && <p className={`text-sm ${deep ? "text-on-deep-muted" : "text-muted"} [overflow-wrap:anywhere]`}>{place.detail}</p>}
        {place.approx && <p className={`mt-1 text-xs ${deep ? "text-[#F6C66A]" : "text-warn"}`}>O número não está no mapa: o ponto fica na rua. Se precisar, ajuste marcando no mapa.</p>}
        {area !== undefined && (
          <p className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${area ? (deep ? "bg-[color-mix(in_srgb,var(--mark)_16%,transparent)] text-[var(--mark)]" : "bg-[color-mix(in_srgb,var(--ok)_14%,transparent)] text-ok") : (deep ? "bg-[color-mix(in_srgb,#F6C66A_18%,transparent)] text-[#F6C66A]" : "bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] text-warn")}`}>
            <Icon name={area ? "check" : "sos"} size={14} />{area ? "Dentro da área atendida" : "Fora da área atendida"}
          </p>
        )}
      </div>
    </div>
  );
}
