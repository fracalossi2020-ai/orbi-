/**
 * Converte as texturas KTX2 (Basis) do modelo para WebP.
 *
 * Por quê: no navegador, o decodificador de KTX2 (basis_transcoder, compilado com Emscripten) cria funções
 * a partir de texto (`new Function`). A política de segurança do site em produção bloqueia isso de propósito,
 * e o carro 3D ficava preso em "Preparando o carro". Decodificando aqui, uma vez, o navegador recebe WebP,
 * que ele já sabe ler sozinho, e a política continua rígida.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import sharp from "sharp";
import type { Document } from "@gltf-transform/core";
import { EXTTextureWebP } from "@gltf-transform/extensions";

const RGBA32 = 13; // basis_universal transcoder_texture_format::cTFRGBA32

type KTX2File = {
  isValid(): boolean; startTranscoding(): boolean; getWidth(): number; getHeight(): number;
  getImageTranscodedSizeInBytes(level: number, layer: number, face: number, format: number): number;
  transcodeImage(dst: Uint8Array, level: number, layer: number, face: number, format: number, flags: number, channel0: number, channel1: number): boolean;
  close(): void; delete(): void;
};
type Basis = { initializeBasis(): void; KTX2File: new (data: Uint8Array) => KTX2File };

export async function ktx2ToWebp(doc: Document): Promise<number> {
  const dir = path.join(process.cwd(), "node_modules/three/examples/jsm/libs/basis");
  const load = createRequire(path.join(process.cwd(), "package.json"))(path.join(dir, "basis_transcoder.js")) as (o: { wasmBinary: Uint8Array }) => Promise<Basis>;
  const basis = await load({ wasmBinary: fs.readFileSync(path.join(dir, "basis_transcoder.wasm")) });
  basis.initializeBasis();

  let converted = 0;
  for (const tex of doc.getRoot().listTextures()) {
    const data = tex.getImage();
    if (tex.getMimeType() !== "image/ktx2" || !data) continue;
    const file = new basis.KTX2File(new Uint8Array(data));
    try {
      if (!file.isValid() || !file.startTranscoding()) throw new Error(`KTX2 inválido: textura ${converted}`);
      const width = file.getWidth(), height = file.getHeight();
      const rgba = new Uint8Array(file.getImageTranscodedSizeInBytes(0, 0, 0, RGBA32));
      if (!file.transcodeImage(rgba, 0, 0, 0, RGBA32, 0, -1, -1)) throw new Error(`Falha ao decodificar a textura ${converted}`);
      const webp = await sharp(Buffer.from(rgba), { raw: { width, height, channels: 4 } }).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toBuffer();
      tex.setImage(new Uint8Array(webp)).setMimeType("image/webp");
      converted++;
    } finally {
      file.close();
      file.delete();
    }
  }
  if (converted) {
    for (const ext of doc.getRoot().listExtensionsUsed()) if (ext.extensionName === "KHR_texture_basisu") ext.dispose();
    doc.createExtension(EXTTextureWebP).setRequired(true);
  }
  return converted;
}
