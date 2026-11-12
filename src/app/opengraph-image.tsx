import { ImageResponse } from "next/og";
import { ORBI, OrbiMark } from "@/components/OrbiMark";

/** Imagem que aparece ao compartilhar o site no WhatsApp e nas redes: capa no estilo do manual da marca. */
export const alt = "Orbi — Mobilidade urbana mais simples, rápida e segura. Vale do Aço, MG.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: ORBI.black, color: "#fff", fontFamily: "sans-serif", position: "relative" }}>
        {/* O arco da marca, como na capa do manual */}
        <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: "absolute", left: 0, top: 0 }}>
          <defs>
            <linearGradient id="arc" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#0A3BFF" />
              <stop offset=".6" stopColor="#0B6BFF" />
              <stop offset="1" stopColor="#00E1FF" />
            </linearGradient>
          </defs>
          <path d="M640 640 C 760 420, 930 250, 1210 170 L 1210 330 C 1000 380, 860 500, 800 640 Z" fill="url(#arc)" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 76px", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <OrbiMark size={74} />
            <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -3 }}>orbi</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -4, lineHeight: 1 }}>Mobilidade</div>
            <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -4, lineHeight: 1 }}>na sua cidade.</div>
            <div style={{ fontSize: 32, marginTop: 22, color: "#9AA8BD" }}>Viagens rápidas, seguras e ao seu alcance · Vale do Aço, MG</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
