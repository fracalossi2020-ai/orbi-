"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Icon } from "@/components/Icon";
import { brl } from "@/domain/pricing";
import { PIX_KEY_TYPES, type PixKeyType } from "@/domain/pix";

/**
 * Pix direto para o motorista: QR Code e "copia e cola" com o valor da corrida.
 * O passageiro paga pelo app do banco dele; o dinheiro vai para a conta do motorista, sem passar pela Orbi.
 */
export function PixPay({ pix, totalCents }: { pix: { key: string; keyType: string | null; payload: string; name: string }; totalCents: number }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    QRCode.toString(pix.payload, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0F2C35", light: "#FFFFFF" } }).then(setSvg).catch(() => setSvg(null));
  }, [pix.payload]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(pix.payload); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { window.prompt("Copie o código Pix:", pix.payload); }
  };
  return (
    <div className="rounded-2xl bg-surface-2 p-4" data-testid="pix-driver">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold">Pix para {pix.name.split(" ")[0]}</p>
        <p className="num display text-2xl">{brl(totalCents)}</p>
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center">
        {svg
          ? <div className="mx-auto aspect-square w-[200px] overflow-hidden rounded-xl bg-white p-2 sm:w-full" role="img" aria-label="QR Code do Pix com o valor da corrida" dangerouslySetInnerHTML={{ __html: svg }} />
          : <div className="map-loading mx-auto aspect-square w-[200px] rounded-xl sm:w-full" aria-hidden="true" />}
        <div className="min-w-0 space-y-2 text-sm">
          <p className="text-muted">Abra o app do seu banco, escolha Pix e leia o QR Code, ou copie o código. O valor já vai preenchido.</p>
          <p className="truncate"><span className="text-muted">{PIX_KEY_TYPES[pix.keyType as PixKeyType] ?? "Chave"}:</span> <span className="num font-semibold">{pix.key}</span></p>
          <button type="button" onClick={copy} className="btn btn-primary w-full"><Icon name="copy" size={18} />{copied ? "Código copiado" : "Copiar código Pix"}</button>
          <p className="text-xs text-muted">O pagamento vai direto para o motorista. Confira o nome no seu banco antes de confirmar.</p>
        </div>
      </div>
    </div>
  );
}
