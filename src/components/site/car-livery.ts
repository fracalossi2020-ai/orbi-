import * as THREE from "three";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import { ORBI_SYMBOL_PATH } from "@/components/OrbiMark";

/**
 * Adesivagem da Orbi, como no manual da marca: faixa azul subindo pela traseira e a logo "orbí" na porta.
 * Desenhada num canvas e projetada na lataria (decal), dos dois lados do carro.
 */

/** Desenha a lateral: `frontLeft` diz se a frente do carro fica à esquerda da imagem. A logo nunca sai espelhada. */
function drawSide(w: number, h: number, frontLeft: boolean) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  // Posições pensadas com a frente à esquerda; do outro lado, só o desenho da faixa é espelhado, o texto não.
  const X = (x: number) => (frontLeft ? x : w - x);

  // Faixa azul: nasce embaixo, na porta de trás, e sobe até o topo da traseira (como no carro do manual).
  const band = g.createLinearGradient(X(w * 0.5), h, X(w), 0);
  band.addColorStop(0, "#0A3BFF"); band.addColorStop(0.55, "#0B6BFF"); band.addColorStop(1, "#0356C5");
  g.fillStyle = band;
  g.beginPath();
  g.moveTo(X(w * 0.6), h);
  g.bezierCurveTo(X(w * 0.68), h * 0.6, X(w * 0.8), h * 0.2, X(w * 0.98), 0);
  g.lineTo(X(w), 0);
  g.lineTo(X(w), h * 0.5);
  g.bezierCurveTo(X(w * 0.92), h * 0.62, X(w * 0.84), h * 0.82, X(w * 0.8), h);
  g.closePath();
  g.fill();

  // Logo no meio do carro: símbolo com degradê + "orbi" em azul-noturno, com o acento inclinado.
  const size = h * 0.4;
  const family = getComputedStyle(document.documentElement).getPropertyValue("--f-inter").trim() || "Inter";
  g.font = `800 ${Math.round(size * 1.05)}px ${family}, system-ui, sans-serif`;
  const textW = g.measureText("orbı").width;
  const symW = size * 1.14, gap = size * 0.22, groupW = symW + gap + textW;
  const cx = X(w * 0.4), cy = h * 0.5;
  const left = cx - groupW / 2;

  g.save();
  g.translate(left, cy - size * 0.5);
  const s = size / 840;
  g.scale(s, s);
  g.translate(-140, -220);
  const sym = g.createLinearGradient(160, 300, 1080, 960);
  sym.addColorStop(0, "#00E1FF"); sym.addColorStop(0.42, "#0B6BFF"); sym.addColorStop(0.6, "#0A3BFF"); sym.addColorStop(1, "#00E1FF");
  g.fillStyle = sym;
  g.fill(new Path2D(ORBI_SYMBOL_PATH));
  g.restore();

  const tx = left + symW + gap;
  g.fillStyle = "#0A1E3D";
  g.textBaseline = "middle";
  g.fillText("orbı", tx, cy + size * 0.04);
  // Acento inclinado sobre o "ı"
  const ix = tx + textW - size * 0.2;
  g.fillStyle = "#0B6BFF";
  g.beginPath();
  g.moveTo(ix + size * 0.12, cy - size * 0.62); g.lineTo(ix + size * 0.34, cy - size * 0.62);
  g.lineTo(ix + size * 0.2, cy - size * 0.4); g.lineTo(ix - size * 0.02, cy - size * 0.4);
  g.closePath(); g.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Projeta a adesivagem nas duas laterais. `paint`: malhas da pintura; `front`: +1 se a frente aponta para +z.
 * O carro precisa estar na origem, sem rotação (as decals ficam em coordenadas do próprio carro).
 */
export function applyLivery(root: THREE.Object3D, paint: THREE.Mesh[], front: 1 | -1) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  for (const m of paint) box.expandByObject(m);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const length = size.z, height = size.y;
  const decalW = length * 0.9, decalH = height * 0.56;
  const y = box.min.y + height * 0.42;

  const made: THREE.Mesh[] = [];
  for (const side of [1, -1] as const) {
    // Projetor na lateral, olhando para dentro do carro; a profundidade só alcança aquele lado.
    const pos = new THREE.Vector3(center.x + side * size.x * 0.5, y, center.z);
    const rot = new THREE.Euler(0, side * Math.PI / 2, 0);
    const dims = new THREE.Vector3(decalW, decalH, size.x * 0.7);
    // Com essa rotação, o eixo x da imagem aponta para -z no lado +x e para +z no lado -x.
    const frontLeft = side === 1 ? front === 1 : front === -1;
    const tex = drawSide(2048, Math.round(2048 * decalH / decalW), frontLeft);
    const mat = new THREE.MeshPhysicalMaterial({
      map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4,
      roughness: 0.32, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06,
    });
    for (const m of paint) {
      const geo = new DecalGeometry(m, pos, rot, dims);
      if (!geo.attributes.position || geo.attributes.position.count === 0) continue;
      const decal = new THREE.Mesh(geo, mat);
      decal.renderOrder = 3;
      made.push(decal);
      root.add(decal);
    }
  }
  return made;
}
