/**
 * Gera public/models/prumo-car.glb a partir do "Car Concept" (Khronos glTF Sample Assets, CC-BY-4.0).
 *
 * O que muda em relação ao original:
 *  - remove marcas de terceiros: a licença do modelo exclui logos, então saem placa, emblema
 *    do volante e todas as texturas emissivas/base onde os logos da Khronos ficam;
 *  - remove variantes de material (a cor vem da identidade em tempo de execução);
 *  - comprime a geometria com meshopt, sem simplificar: simplificar rasga as emendas da lataria.
 *
 * Uso: npm run model:build -- <caminho do CarConcept.glb>
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, meshopt, quantize } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";

const input = process.argv[2];
const output = "public/models/prumo-car.glb";
if (!input) throw new Error("Informe o caminho do CarConcept.glb");

async function main() {
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
  const doc = await io.read(input);
  const root = doc.getRoot();

  const dropNode = /^(License Plate|InteriorSteeringEmblem|InteriorPedal|InteriorFloormats|InteriorSteeringDash)/;
  for (const node of root.listNodes()) {
    if (dropNode.test(node.getName())) node.dispose();
  }
  for (const ext of root.listExtensionsUsed()) {
    if (ext.extensionName === "KHR_materials_variants") ext.dispose();
  }
  for (const mat of root.listMaterials()) {
    mat.setEmissiveTexture(null);
    if (!/light/i.test(mat.getName())) mat.setEmissiveFactor([0, 0, 0]);
    if (mat.getName() === "Tireside") {
      mat.setBaseColorTexture(null);
      mat.setBaseColorFactor([0.03, 0.03, 0.03, 1]);
    }
    if (/Pearl|Graphite/.test(mat.getName()) || mat.getName() === "License") mat.dispose();
  }
  await doc.transform(
    dedup(),
    prune({ keepAttributes: true, keepLeaves: true }),
    quantize(),
    meshopt({ encoder: MeshoptEncoder, level: "high" }),
  );
  await io.write(output, doc);

  const names = root.listNodes().map((n) => n.getName()).filter(Boolean);
  console.log("nós:", names.filter((n) => /Wheel|Tire|Rim/.test(n)).join(" "));
  console.log("materiais:", root.listMaterials().map((m) => m.getName()).join(" | "));
  console.log("texturas:", root.listTextures().length);
}
main().catch((e) => { console.error(e); process.exit(1); });
