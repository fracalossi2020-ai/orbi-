/**
 * Símbolo da Orbi, redesenhado em vetor a partir do manual da marca: um "O" em movimento,
 * com o vão em forma de folha (o encontro entre passageiro e motorista) e o degradê ciano → azul elétrico.
 * Sem hooks: funciona também nas imagens geradas no servidor (ícone do app e imagem de compartilhamento).
 */
export const ORBI = {
  electric: "#0356C5", // Azul Elétrico (principal)
  night: "#0A1E3D", // Azul Noturno (secundária)
  black: "#02060E", // Preto Profundo
  gray: "#E6E8EB", // Cinza Neutro
  cyan: "#00E1FF", // ponta clara do degradê do símbolo
  blue: "#0A3BFF", // ponta escura do degradê do símbolo
};

export const ORBI_SYMBOL_PATH =
  "M163,757 C150,690 158,600 200,500 C270,340 410,238 560,238 L775,238 C850,238 910,272 950,322 L1030,440 C1066,494 1080,550 1080,604 C1080,836 900,1040 700,1040 L470,1040 C340,1040 240,962 195,852 C186,826 196,808 220,808 L590,808 C720,808 820,722 862,620 L948,443 L565,443 C380,443 200,560 163,757 Z";

export function OrbiMark({ size = 32, flat, className = "", style, gid = "orbi-g" }: {
  size?: number;
  /** Cor chapada no lugar do degradê (ex.: "currentColor" em fundo de cor). */
  flat?: string;
  className?: string; style?: React.CSSProperties;
  /** Id do degradê: mude quando houver dois símbolos com degradês diferentes na mesma página. */
  gid?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="140 220 960 840" className={className} style={style} aria-hidden="true">
      {!flat && (
        <defs>
          <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="160" y1="300" x2="1080" y2="960">
            <stop offset="0" stopColor={ORBI.cyan} />
            <stop offset=".42" stopColor="#0B6BFF" />
            <stop offset=".6" stopColor={ORBI.blue} />
            <stop offset="1" stopColor={ORBI.cyan} />
          </linearGradient>
        </defs>
      )}
      <path d={ORBI_SYMBOL_PATH} fill={flat ?? `url(#${gid})`} />
    </svg>
  );
}

/** O acento do "í": um paralelogramo inclinado, no azul da marca. */
export function OrbiAccent({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 100 70" className={className} style={style} aria-hidden="true">
      <path d="M38,4 H92 C97,4 99,8 96,13 L66,62 C64,65 61,66 58,66 H8 C3,66 1,62 4,57 L32,8 C33,5 35,4 38,4Z" fill="currentColor" />
    </svg>
  );
}
