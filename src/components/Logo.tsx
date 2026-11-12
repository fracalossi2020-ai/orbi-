import { OrbiAccent, ORBI_SYMBOL_PATH } from "./OrbiMark";

/*
 * O símbolo vira uma máscara CSS pintada com o degradê. Assim não depende de id de <linearGradient>:
 * com vários símbolos na página (um deles escondido, como o menu lateral no celular), o navegador
 * pegava o degradê do escondido e o símbolo sumia.
 */
const SYMBOL_MASK = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="140 220 960 840"><path d="${ORBI_SYMBOL_PATH}"/></svg>`)}") center / contain no-repeat`;
const SYMBOL_GRADIENT = "linear-gradient(140deg, #00E1FF 6%, #0B6BFF 42%, #0A3BFF 62%, #00E1FF 100%)";

export function OrbiSymbol({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={`inline-block shrink-0 ${className}`}
      style={{ width: size, height: size * 0.875, background: SYMBOL_GRADIENT, WebkitMask: SYMBOL_MASK, mask: SYMBOL_MASK }} />
  );
}

/** Pino de localização (marcadores do mapa e indicadores). `hole` é a cor do miolo. */
export function Bob({ className = "", hole = "var(--deep)", style }: { className?: string; hole?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 36" className={className} style={style} aria-hidden="true">
      <path d="M12 35c-1.300-2.900-3.400-5.700-5.900-8.400A10.600 10.600 0 1 1 17.900 26.600C15.400 29.300 13.300 32.100 12 35Z" fill="currentColor" />
      <circle cx="12" cy="13" r="4.200" fill={hole} />
    </svg>
  );
}

/**
 * Logo da Orbi: símbolo com degradê + "orbí" em Inter, com o acento inclinado azul.
 * O nome usa a cor do texto em volta: branco no fundo escuro, preto no claro (como no manual).
 * `hole` ficou por compatibilidade e não é mais usado.
 */
export function Logo({ className = "", size = 26, symbolOnly }: { className?: string; size?: number; hole?: string; symbolOnly?: boolean }) {
  return (
    <span className={`inline-flex items-center ${className}`} style={{ fontSize: size, gap: size * 0.22 }} aria-label="Orbi" role="img">
      <OrbiSymbol size={size * 1.25} />
      {!symbolOnly && (
        <span aria-hidden="true" className="relative inline-flex items-baseline font-bold" style={{ fontFamily: "var(--f-inter), system-ui, sans-serif", fontSize: size, lineHeight: 1, letterSpacing: "-0.045em" }}>
          orb<span className="relative">ı
            <OrbiAccent className="absolute text-[#1166FF]" style={{ width: "0.42em", left: "0.02em", top: "-0.2em" }} />
          </span>
        </span>
      )}
    </span>
  );
}
