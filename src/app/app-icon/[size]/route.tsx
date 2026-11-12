import { ImageResponse } from "next/og";
import { ORBI, OrbiMark } from "@/components/OrbiMark";

/** Ícone do app em PNG (Android e iPhone pedem PNG): o símbolo da Orbi em degradê sobre o Preto Profundo, como no manual. "512m": versão com margem para o recorte do Android. */
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const raw = (await params).size;
  const maskable = raw.endsWith("m");
  const size = Math.min(Math.max(Number.parseInt(raw, 10) || 192, 48), 1024);
  const mark = maskable ? size * 0.52 : size * 0.66;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: ORBI.black, borderRadius: maskable ? 0 : size * 0.22 }}>
        <OrbiMark size={mark} />
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
