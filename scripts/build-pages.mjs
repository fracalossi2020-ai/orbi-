/**
 * Monta a versão vitrine do site para o GitHub Pages (páginas prontas, sem servidor) na pasta out/.
 *
 *   node scripts/build-pages.mjs orbi           # pasta do site no endereço (usuario.github.io/orbi)
 *
 * Tira do caminho os apps, o painel e a API durante o build. No GitHub Actions (CI=true) apaga de vez (a cópia é
 * descartável); no seu computador, guarda tudo em .pages-stash/ e devolve no final, mesmo se o build falhar.
 * Atenção: o build usa a pasta .next (o Next não deixa trocar no modo de páginas prontas). Pare o servidor antes
 * e, para voltar a rodar o servidor normal depois, faça um npx next build de novo.
 * Variáveis opcionais: NEXT_PUBLIC_WHATSAPP (só números, com 55 e DDD), PAGES_URL (endereço final).
 */
import { execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Aceita "orbi" ou "/orbi" (o Git Bash do Windows transforma "/orbi" em caminho de disco, então aqui vale sem barra).
const name = (process.argv[2] ?? "").replace(/^\/+|\/+$/g, "");
if (/[\:]/.test(name)) throw new Error('Passe só o nome da pasta, ex.: node scripts/build-pages.mjs orbi');
const base = name ? `/${name}` : "";
const root = process.cwd();

// Tudo que precisa de servidor sai da vitrine.
const REMOVE = ["src/app/api", "src/app/admin", "src/app/passageiro", "src/app/motorista", "src/app/v", "src/app/(auth)",
  "src/app/(site)/identidade", "src/app/app-icon", "src/app/manifest.ts", "src/proxy.ts"];

// Arquivos que ganham uma linha só na vitrine: o modo de páginas prontas exige marcar estas rotas como fixas.
const FORCE_STATIC = ["src/app/robots.ts", "src/app/sitemap.ts", "src/app/opengraph-image.tsx"];

const DEMO_PAGE = (title) => `import { Body, PageHead } from "@/components/site/Page";
import { DemoNotice } from "@/components/site/DemoNotice";

export const metadata = { title: ${JSON.stringify(title)}, robots: { index: false } };

export default function Page() {
  return (
    <>
      <PageHead title="O app chega em breve." lead="Por enquanto, este é o site de apresentação da Orbi." />
      <Body narrow><DemoNotice /></Body>
    </>
  );
}
`;

// Tarifas do painel num arquivo, gerado pelo próprio build (o navegador lê no lugar da API).
const TARIFFS_ROUTE = `import { publicTariffs } from "@/server/public-data";
export const dynamic = "force-static";
export async function GET() { return Response.json(await publicTariffs()); }
`;

const stash = path.join(root, ".pages-stash");
const created = [];

function prepare() {
  if (fs.existsSync(stash)) throw new Error("Existe .pages-stash/ de um build interrompido: devolva os arquivos de lá para src/ antes.");
  for (const p of REMOVE) {
    const from = path.join(root, p);
    if (!fs.existsSync(from)) continue;
    if (process.env.CI) { fs.rmSync(from, { recursive: true, force: true }); continue; }
    const to = path.join(stash, p);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
  }
  for (const p of FORCE_STATIC) {
    const file = path.join(root, p);
    const text = fs.readFileSync(file, "utf8");
    if (!process.env.CI) {
      fs.mkdirSync(path.dirname(path.join(stash, p)), { recursive: true });
      fs.copyFileSync(file, path.join(stash, p));
    }
    fs.writeFileSync(file, `${text}
export const dynamic = "force-static";
`);
  }
  const write = (rel, text) => {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    created.push(rel.split("/").slice(0, -1).join("/"));
  };
  write("src/app/(site)/entrar/page.tsx", DEMO_PAGE("Entrar"));
  write("src/app/(site)/cadastro/page.tsx", DEMO_PAGE("Criar conta"));
  write("src/app/data/tariffs.json/route.ts", TARIFFS_ROUTE);
}

function restore() {
  for (const dir of created) fs.rmSync(path.join(root, dir), { recursive: true, force: true });
  fs.rmSync(path.join(root, "src/app/data"), { recursive: true, force: true });
  if (!fs.existsSync(stash)) return;
  for (const p of [...REMOVE, ...FORCE_STATIC]) {
    const from = path.join(stash, p);
    if (!fs.existsSync(from)) continue;
    fs.rmSync(path.join(root, p), { recursive: true, force: true });
    fs.renameSync(from, path.join(root, p));
  }
  fs.rmSync(stash, { recursive: true, force: true });
}

const owner = process.env.GITHUB_REPOSITORY_OWNER;
const env = {
  ...process.env,
  NEXT_PUBLIC_STATIC: "1",
  NEXT_PUBLIC_BASE_PATH: base,
  APP_URL: process.env.PAGES_URL || (owner ? `https://${owner}.github.io${base}` : `http://localhost:3200${base}`),
  PRUMO_ALLOW_EMBEDDED_DB: "true",
  PRUMO_DB_MEMORY: "1",
  AUTH_SECRET: crypto.randomBytes(32).toString("hex"),
  NEXT_TELEMETRY_DISABLED: "1",
};

/**
 * No Windows o Next grava os arquivos de navegação como pastas (__next.X/pagina/__PAGE__.txt), porque troca só "/"
 * por "." e o caminho vem com "\\". O navegador pede __next.X.pagina.__PAGE__.txt; aqui os nomes são corrigidos.
 */
function flattenSegments(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (!entry.isDirectory()) continue;
    if (!entry.name.startsWith("__next.")) { flattenSegments(full); continue; }
    const walk = (d, prefix) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const f = path.join(d, e.name);
        if (e.isDirectory()) walk(f, `${prefix}.${e.name}`);
        else fs.renameSync(f, path.join(dir, `${prefix}.${e.name}`));
      }
    };
    walk(full, entry.name);
    fs.rmSync(full, { recursive: true, force: true });
  }
}

try {
  prepare();
  execSync("npx next build", { cwd: root, env, stdio: "inherit" });
  if (process.platform === "win32") flattenSegments(path.join(root, "out"));
  // Sem isto o GitHub Pages esconde a pasta _next (pastas com _ são ignoradas pelo Jekyll).
  fs.writeFileSync(path.join(root, "out/.nojekyll"), "");
  console.log(`\nPronto: out/ (endereço do site termina em ${base || "/"})`);
} finally {
  if (!process.env.CI) restore();
}
