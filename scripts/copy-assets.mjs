// Copia para public/ os arquivos de bibliotecas carregados em tempo de execução,
// mantendo-os na mesma versão instalada. Roda sozinho depois de cada npm install.
import fs from "node:fs";

const COPIES = [
  ["node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/maplibre/maplibre-gl-worker.mjs"],
  ["node_modules/three/examples/jsm/libs/basis/basis_transcoder.js", "public/basis/basis_transcoder.js"],
  ["node_modules/three/examples/jsm/libs/basis/basis_transcoder.wasm", "public/basis/basis_transcoder.wasm"],
];
for (const [from, to] of COPIES) {
  fs.mkdirSync(to.slice(0, to.lastIndexOf("/")), { recursive: true });
  fs.copyFileSync(from, to);
}
