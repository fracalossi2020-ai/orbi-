/**
 * Marcadores do mapa (GPS, partida, destino, paradas e prévia): pino de localização nas cores da Orbi.
 * Desenho 24 × 44 com a ponta em (12, 43), mostrado em 34 × 62 px. O nome do arquivo ficou do símbolo antigo.
 */
export type MarkKind = "me" | "origin" | "dest" | "stop" | "preview";

const COLORS: Record<MarkKind, [string, string]> = {
  // corpo, miolo
  me: ["var(--primary)", "#fff"],
  origin: ["var(--accent-strong, var(--accent))", "#fff"],
  dest: ["var(--primary)", "#fff"],
  stop: ["color-mix(in srgb, var(--primary) 55%, var(--ink))", "#fff"],
  preview: ["var(--deep)", "var(--mark)"],
};

const PIN = "M12 43C10.5 36 6.5 27.5 4.93 22.07A10 10 0 1 1 19.07 22.07C17.5 27.5 13.5 36 12 43Z";

export function hangingBobSvg(kind: MarkKind) {
  const [body, core] = COLORS[kind];
  // Partida: anel (de onde sai); destino: ponto cheio (aonde chega).
  const inner = kind === "origin"
    ? `<circle cx="12" cy="15" r="4.6" fill="none" stroke="${core}" stroke-width="2.4"/>`
    : `<circle cx="12" cy="15" r="4.2" fill="${core}"/>`;
  return `<svg class="prumo-mk__bob" viewBox="0 0 24 44" width="34" height="62" aria-hidden="true">
    <path d="${PIN}" fill="${body}" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>
    ${inner}
  </svg>`;
}
