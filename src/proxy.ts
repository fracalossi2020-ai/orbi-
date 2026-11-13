import { NextResponse, type NextRequest } from "next/server";

/**
 * Política de Segurança de Conteúdo (CSP) com um código aleatório (nonce) por página.
 * Só rodam scripts do próprio site marcados com esse código: um script injetado por um invasor não executa.
 * O Next coloca o nonce nos próprios scripts sozinho, a partir deste cabeçalho.
 */
const MAP_HOST = "https://tiles.openfreemap.org";

export function proxy(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV === "development";
  const https = (process.env.APP_URL ?? "").startsWith("https://");
  const csp = [
    "default-src 'self'",
    // strict-dynamic: scripts carregados por um script confiável (os pedaços do app) também valem.
    // wasm-unsafe-eval: o decodificador do carro 3D usa WebAssembly. Em desenvolvimento, o React usa eval.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ""}`,
    // Estilos em linha: usados pelo mapa e pelas animações; não executam código.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${MAP_HOST}`,
    "font-src 'self' data:",
    // blob:: o carregador do carro 3D lê as texturas embutidas no modelo por endereços blob criados pela própria página.
    `connect-src 'self' blob: ${MAP_HOST}${dev ? " ws: wss:" : ""}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: [
    {
      // Páginas: a API e os arquivos estáticos não precisam da política (a API recebe os outros cabeçalhos do next.config).
      source: "/((?!api|_next/static|_next/image|maplibre|models|cursors|icon.svg|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
