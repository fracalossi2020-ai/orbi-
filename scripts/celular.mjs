/**
 * Teste no celular (iPhone ou Android): `npm run celular`.
 *
 * Abre um túnel gratuito da Cloudflare até o servidor de desenvolvimento e mostra um QR Code no terminal.
 * O endereço é https:// de verdade, então o GPS do celular funciona (iPhone e Android só liberam a
 * localização em páginas seguras) e dá para testar até fora do Wi-Fi, no 4G.
 *
 * Na primeira vez, baixa o programa oficial da Cloudflare (cloudflared) para a pasta .tools/.
 * Não precisa de conta. O endereço muda a cada vez que o comando roda.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import QRCode from "qrcode";

const PORT = process.env.PORT || "3000";
const LOCAL = `http://localhost:${PORT}`;
const TOOLS = path.join(process.cwd(), ".tools");

function binaryInfo() {
  const arch = process.arch === "arm64" ? "arm64" : "amd64";
  if (process.platform === "win32") return { file: "cloudflared.exe", url: `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-${arch}.exe` };
  if (process.platform === "linux") return { file: "cloudflared", url: `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${arch}` };
  return null; // macOS: instale com `brew install cloudflared`
}

async function ensureCloudflared() {
  const info = binaryInfo();
  if (!info) return "cloudflared";
  const dest = path.join(TOOLS, info.file);
  if (fs.existsSync(dest)) return dest;
  fs.mkdirSync(TOOLS, { recursive: true });
  console.log("Baixando o cloudflared (programa oficial da Cloudflare, só na primeira vez)…");
  const res = await fetch(info.url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Não foi possível baixar o cloudflared (${res.status}). Baixe manualmente em ${info.url} e coloque em ${dest}.`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  if (process.platform !== "win32") fs.chmodSync(dest, 0o755);
  return dest;
}

async function serverUp() {
  try { const r = await fetch(LOCAL, { signal: AbortSignal.timeout(3000) }); return r.status < 500; } catch { return false; }
}

async function main() {
  const bin = await ensureCloudflared();
  let dev = null;
  if (!(await serverUp())) {
    console.log(`Ligando o servidor de desenvolvimento em ${LOCAL}…`);
    dev = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], { stdio: ["ignore", "inherit", "inherit"], shell: process.platform === "win32" });
    for (let i = 0; i < 90 && !(await serverUp()); i++) await new Promise((ok) => setTimeout(ok, 1000));
  }
  console.log("Abrindo o túnel seguro…");
  const tunnel = spawn(bin, ["tunnel", "--no-autoupdate", "--url", LOCAL], { stdio: ["ignore", "pipe", "pipe"] });
  let shown = false;
  const onData = async (buf) => {
    const m = String(buf).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (!m || shown) return;
    shown = true;
    const url = m[0];
    console.log("\n================================================================");
    console.log("  Orbi no celular");
    console.log(`  Endereço: ${url}`);
    console.log("  Aponte a câmera do celular para o QR Code abaixo:\n");
    console.log(await QRCode.toString(url, { type: "terminal", small: true }));
    console.log("  Passageiro: " + url + "/passageiro");
    console.log("  Motorista:  " + url + "/motorista");
    console.log("\n  Dicas:");
    console.log("  • Permita a localização quando o navegador pedir (GPS do celular).");
    console.log("  • Para o motorista, deixe o app aberto na tela: o celular pausa o GPS de abas em segundo plano.");
    console.log("  • Entrar com Google pelo túnel exige cadastrar este endereço no Google Cloud; use e-mail e senha.");
    console.log("  • O endereço muda a cada vez. Para encerrar: Ctrl + C.");
    console.log("================================================================\n");
  };
  tunnel.stdout.on("data", onData);
  tunnel.stderr.on("data", onData);
  tunnel.on("exit", (code) => { console.log(`Túnel encerrado (${code ?? 0}).`); dev?.kill(); process.exit(code ?? 0); });
  const stop = () => { tunnel.kill(); dev?.kill(); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
