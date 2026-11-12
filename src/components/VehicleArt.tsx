import { ORBI_SYMBOL_PATH } from "./OrbiMark";

/** Aplicação da marca em veículos. As cores vêm da identidade do contêiner. */
function Mark({ x, y, s = 1, color }: { x: number; y: number; s?: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={color}>
      {/* símbolo da Orbi (mesmo desenho do OrbiMark), reduzido a 16 px */}
      <path transform="translate(-1 2) scale(.0175) translate(-140 -220)" d={ORBI_SYMBOL_PATH} />
      <text x="17" y="16" fontFamily="var(--font-display-face)" fontWeight="700" fontSize="15" letterSpacing="-.6">orbi</text>
    </g>
  );
}

function Wheel({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#14171b" />
      <circle cx={cx} cy={cy} r={r * 0.62} fill="#C8CED4" />
      <circle cx={cx} cy={cy} r={r * 0.22} fill="#14171b" />
    </g>
  );
}

export function CarArt({ className = "", title = "Carro com a marca Orbi" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 360 130" className={className} role="img" aria-label={title}>
      <ellipse cx="180" cy="118" rx="165" ry="6" fill="#000" opacity=".16" />
      <path d="M12 96c-4-1-6-5-5-13 1-9 6-15 18-18l48-9 38-26c6-4 13-6 21-6h78c11 0 20 3 28 10l28 24 44 8c14 3 22 11 24 25 1 4-1 7-5 8H12Z" fill="var(--primary)" />
      <path d="M12 96c-4-1-6-5-5-13h345c1 3 2 5 2 9 0 3-2 4-5 4H12Z" fill="var(--accent)" />
      <path d="M92 56l32-22c5-3 11-5 18-5h24v27H92Z M174 29h38c9 0 17 3 23 8l21 19h-82V29Z" fill="#0d1a20" opacity=".82" />
      <rect x="160" y="62" width="110" height="2" fill="#fff" opacity=".22" />
      <path d="M340 72c6 1 11 4 13 9h-16Z" fill="#fff" opacity=".9" />
      <path d="M8 76c3-5 8-8 15-9v9H8Z" fill="#E5484D" />
      <Mark x={150} y={64} color="var(--on-primary)" />
      <Wheel cx={82} cy={98} r={21} />
      <Wheel cx={278} cy={98} r={21} />
    </svg>
  );
}

export function MotoArt({ className = "", title = "Motocicleta com a marca Orbi" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 220 130" className={className} role="img" aria-label={title}>
      <ellipse cx="110" cy="118" rx="96" ry="5" fill="#000" opacity=".16" />
      <Wheel cx={48} cy={94} r={24} />
      <Wheel cx={172} cy={94} r={24} />
      <path d="M48 94 86 66h44l42 28" fill="none" stroke="#14171b" strokeWidth="6" />
      <path d="M172 94 146 36" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" />
      <path d="M62 62c10-14 26-20 44-18l26 3 12 17-14 16H90L62 62Z" fill="var(--primary)" />
      <path d="M38 62c6-6 16-9 30-8l14 8H44Z" fill="var(--accent)" />
      <path d="M134 34h22l8-6" fill="none" stroke="#14171b" strokeWidth="5" strokeLinecap="round" />
      <path d="M150 42c10-4 18-2 22 4l-4 12-20-4Z" fill="var(--primary)" />
      <Mark x={84} y={52} s={0.72} color="var(--on-primary)" />
    </svg>
  );
}
