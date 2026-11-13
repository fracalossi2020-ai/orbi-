"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { Identity } from "@/lib/identities";
import { applyLivery } from "./car-livery";

const MODEL = "/models/prumo-car.glb";
const WHEELS = ["WheelFrontL", "WheelFrontR", "WheelRearL", "WheelRearR"];

type SceneProps = {
  colors: Identity["car"]; yaw: React.RefObject<number>; reduced: boolean; mobile: boolean; centered: boolean; onReady: () => void;
};

function useCar(colors: Identity["car"]) {
  // Texturas em WebP (ver scripts/car-textures.ts): sem decodificador KTX2, que a política de segurança bloqueia.
  const gltf = useLoader(GLTFLoader, MODEL, (loader) => { loader.setMeshoptDecoder(MeshoptDecoder); });

  return useMemo(() => {
    const root = gltf.scene;
    const paint = new THREE.Color(colors.paint);
    const trim = new THREE.Color(colors.trim);
    const interior = new THREE.Color(colors.interior);
    root.updateMatrixWorld(true);
    const paintMeshes: THREE.Mesh[] = [];
    let headZ = 0, headN = 0;
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const raw of mats) {
        const m = raw as THREE.MeshPhysicalMaterial;
        const n = m.name;
        if (n === "Paint 1 Carmine") {
          if (!paintMeshes.includes(mesh)) paintMeshes.push(mesh);
          m.color.copy(paint); m.metalness = 0.55; m.roughness = 0.34; m.clearcoat = 1; m.clearcoatRoughness = 0.06; m.normalMap = null; m.needsUpdate = true;
        } else if (n === "Paint 2 Carmine") {
          m.color.copy(trim); m.metalness = 0.5; m.roughness = 0.38; m.clearcoat = 1; m.clearcoatRoughness = 0.08; m.normalMap = null; m.needsUpdate = true;
        } else if (n === "Interior 3 Carmine") {
          m.color.copy(interior);
        } else if (n === "Glass") {
          // Sem transmissão real: ela exigiria um passe extra de renderização a cada quadro.
          m.transmission = 0; m.transparent = true; m.opacity = 0.42; m.color.set("#0b1418"); m.roughness = 0.04; m.metalness = 0.9; m.envMapIntensity = 1.6; m.depthWrite = false; m.needsUpdate = true;
        } else if (n === "Headlight") {
          const hb = new THREE.Box3().setFromObject(mesh); headZ += hb.getCenter(new THREE.Vector3()).z; headN++;
          m.emissive.set("#ffffff"); m.emissiveIntensity = 8; m.toneMapped = false;
        } else if (n === "Brakelight") {
          m.emissive.set("#ff2a2a"); m.emissiveIntensity = 4; m.toneMapped = false;
        }
      }
    });
    // Adesivagem da Orbi (uma vez por modelo carregado). A frente é o lado dos faróis.
    if (!root.userData.livery && paintMeshes.length) {
      try { applyLivery(root, paintMeshes, headN && headZ / headN < 0 ? -1 : 1); } catch { /* sem adesivo, o carro continua */ }
      root.userData.livery = true;
    }
    return { root, wheels: WHEELS.map((w) => root.getObjectByName(w)).filter(Boolean) as THREE.Object3D[] };
  }, [gltf, colors]);
}

/** Pavimento com faixas em movimento. Sombreador próprio: um único quadrilátero, custo mínimo. */
function Road({ color, reduced, reflective }: { color: string; reduced: boolean; reflective: boolean }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uGlow: { value: new THREE.Color(color) }, uAlpha: { value: reflective ? 0.8 : 0.72 },
  }), [color, reflective]);
  useFrame((_, dt) => { if (mat.current && !reduced) mat.current.uniforms.uTime.value += dt; });
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0} renderOrder={1}>
      <planeGeometry args={[220, 220]} />
      <shaderMaterial ref={mat} transparent depthWrite={false} uniforms={uniforms}
        vertexShader={`varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.); }`}
        fragmentShader={`
          uniform float uTime; uniform vec3 uGlow; uniform float uAlpha; varying vec3 vW;
          float box(float v,float a,float b,float s){ return smoothstep(a-s,a,v)-smoothstep(b,b+s,v); }
          void main(){
            float z=vW.z+uTime*16.;
            vec3 asphalt=vec3(.012,.016,.019);
            float grain=fract(sin(dot(floor(vW.xz*90.),vec2(12.9,78.2)))*43758.5);
            vec3 col=asphalt+grain*.006;
            float d0=length(vW.xz);
            float dash=box(mod(z,7.),0.,3.2,.03)*box(abs(vW.x-3.6),0.,.07,.02);
            float dash2=box(mod(z,7.),0.,3.2,.03)*box(abs(vW.x+3.6),0.,.07,.02);
            float edge=box(abs(vW.x),10.7,10.82,.02)*smoothstep(40.,12.,d0);
            col+=vec3(.5,.55,.55)*(dash+dash2)+uGlow*edge*.35;
            float d=length(vW.xz);
            float pool=exp(-d*d*.012);
            col+=uGlow*pool*.018;
            float fade=smoothstep(46.,9.,d);
            gl_FragColor=vec4(col,mix(0.,uAlpha,fade)*(1.-.0));
            #include <colorspace_fragment>
          }`} />
    </mesh>
  );
}

/** Rastros de luz nas laterais: passam rente ao carro e dão a sensação de velocidade. */
function Streaks({ color, count, reduced }: { color: string; count: number; reduced: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x: (i % 2 ? 1 : -1) * (6 + Math.random() * 9), y: 0.25 + Math.random() * 2.6, z: Math.random() * 70 - 35, s: 18 + Math.random() * 22, l: 1 + Math.random() * 4,
  })), [count]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const place = (k: number) => {
    seeds.forEach((p, i) => {
      const z = ((p.z - k * p.s + 35) % 70 + 70) % 70 - 35;
      m.makeScale(0.025, 0.025, p.l);
      m.setPosition(p.x, p.y, z);
      ref.current!.setMatrixAt(i, m);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  };
  useEffect(() => { if (ref.current) place(0); }); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(({ clock }) => { if (ref.current && !reduced) place(clock.elapsedTime); });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry />
      <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.75} />
    </instancedMesh>
  );
}

/*
 * Viagem em três lugares, que se alternam: avenida com postes, túnel com anéis de luz e cidade com prédios.
 * O mundo corre para trás do carro; cada lugar entra e sai crescendo do chão.
 */
const PLACE_S = 10; // segundos em cada lugar (2 ângulos de câmera de 5 s)
const SPEED = 16;
const LEN = 120;

type Prop = { x: number; y: number; z: number; sx: number; sy: number; sz: number; color?: THREE.Color };

function useProps(mobile: boolean) {
  return useMemo(() => {
    const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    const poles: Prop[] = [], heads: Prop[] = [], rings: Prop[] = [], towers: Prop[] = [], windows: Prop[] = [];
    for (let i = 0; i < (mobile ? 8 : 12); i++) for (const side of [-1, 1]) {
      const z = i * (LEN / (mobile ? 8 : 12)) + (side > 0 ? 5 : 0);
      poles.push({ x: side * 13, y: 2.6, z, sx: 0.09, sy: 5.2, sz: 0.09 });
      heads.push({ x: side * 12.1, y: 5.15, z, sx: 1.9, sy: 0.1, sz: 0.34 });
    }
    const blue = new THREE.Color("#0B6BFF"), cyan = new THREE.Color("#00E1FF");
    for (let i = 0; i < (mobile ? 12 : 18); i++) {
      const z = i * (LEN / (mobile ? 12 : 18)), col = i % 2 ? blue : cyan;
      rings.push({ x: -12.5, y: 3.6, z, sx: 0.18, sy: 7.2, sz: 0.14, color: col });
      rings.push({ x: 12.5, y: 3.6, z, sx: 0.18, sy: 7.2, sz: 0.14, color: col });
      rings.push({ x: 0, y: 7.2, z, sx: 25.2, sy: 0.18, sz: 0.18, color: col });
    }
    for (let i = 0; i < (mobile ? 14 : 24); i++) for (const side of [-1, 1]) {
      const h = 4 + rnd() * 16, w = 3 + rnd() * 3, x = side * (16 + rnd() * 7), z = i * (LEN / (mobile ? 14 : 24)) + rnd() * 3;
      towers.push({ x, y: h / 2, z, sx: w, sy: h, sz: 3 + rnd() * 3 });
      for (let k = 0; k < 3; k++) if (rnd() > 0.35) windows.push({ x: x - side * (w / 2 + 0.02), y: 1.5 + rnd() * (h - 2), z: z + (rnd() - 0.5) * 2, sx: 0.04, sy: 0.35, sz: 1 + rnd() * 1.5, color: rnd() > 0.6 ? cyan : new THREE.Color("#BFD7FF") });
    }
    return { poles, heads, rings, towers, windows };
  }, [mobile]);
}

function Props({ items, weight, color, emissive, reduced }: { items: Prop[]; weight: React.RefObject<number>; color: string; emissive?: boolean; reduced: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const m = useMemo(() => new THREE.Matrix4(), []);
  useEffect(() => {
    if (!ref.current) return;
    items.forEach((p, i) => { if (p.color) ref.current!.setColorAt(i, p.color); });
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [items]);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const w = weight.current ?? 0;
    mesh.visible = w > 0.01;
    if (!mesh.visible) return;
    const shift = reduced ? 0 : clock.elapsedTime * SPEED;
    items.forEach((p, i) => {
      const z = ((p.z - shift) % LEN + LEN) % LEN - LEN / 2;
      m.makeScale(p.sx, p.sy * w, p.sz);
      m.setPosition(p.x, p.y * w, z);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} frustumCulled={false}>
      <boxGeometry />
      {emissive
        ? <meshBasicMaterial color={items[0]?.color ? "#ffffff" : color} toneMapped={false} />
        : <meshStandardMaterial color={color} roughness={0.85} metalness={0.1} />}
    </instancedMesh>
  );
}

/** Ângulos de câmera, como num comercial: lateral (mostra a adesivagem), frente baixa, de cima e traseira. */
const SHOTS: { pos: [number, number, number]; look: [number, number, number] }[] = [
  { pos: [10.6, 1.35, 0.9], look: [0, 0.55, 0.2] },   // lateral direita: a adesivagem inteira
  { pos: [5.4, 0.85, 9.4], look: [0, 0.5, 0.3] },     // frente, três quartos, câmera baixa
  { pos: [-3.4, 9.8, -7.2], look: [0, 0.2, 0.6] },    // de cima, por trás
  { pos: [-10.6, 1.45, -0.7], look: [0, 0.55, 0.2] }, // lateral esquerda
  { pos: [-5.8, 1.9, -9.4], look: [0, 0.6, 0] },      // traseira, três quartos
  { pos: [7.6, 3.8, 8.2], look: [0, 0.45, 0] },       // três quartos, de cima
];

function Scene({ colors, yaw, reduced, mobile, centered, onReady }: SceneProps) {
  const props = useProps(mobile);
  const wAvenue = useRef(1), wTunnel = useRef(0), wCity = useRef(0);
  const camPos = useRef(new THREE.Vector3(10.6, 1.35, 0.9));
  const camLook = useRef(new THREE.Vector3(0, 0.62, 0));
  const { root, wheels } = useCar(colors);
  const reflection = useMemo(() => (mobile ? null : root.clone(true)), [root, mobile]);
  const reflectionWheels = useMemo(() => reflection ? WHEELS.map((w) => reflection.getObjectByName(w)).filter(Boolean) as THREE.Object3D[] : [], [reflection]);
  const rig = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const start = useRef<number | null>(null);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;

  useEffect(() => { onReady(); }, [onReady]);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    start.current ??= t;
    const age = t - start.current;
    // Entrada: o carro chega pela estrada e a câmera assenta.
    const k = reduced ? 1 : Math.min(1, age / 2.4);
    const ease = 1 - Math.pow(1 - k, 3);
    const scroll = typeof window === "undefined" ? 0 : Math.min(1, window.scrollY / window.innerHeight);

    if (rig.current) {
      rig.current.rotation.y = THREE.MathUtils.damp(rig.current.rotation.y, yaw.current!, 7, dt);
      rig.current.position.z = THREE.MathUtils.lerp(-9, 0, ease);
    }
    if (body.current && !reduced) {
      body.current.position.y = Math.sin(t * 7.3) * 0.004 + Math.sin(t * 2.1) * 0.006;
      body.current.rotation.z = Math.sin(t * 1.3) * 0.0035;
    }
    if (!reduced) {
      const spin = dt * 16 / 0.34;
      for (const w of wheels) w.rotateX(spin);
      for (const w of reflectionWheels) w.rotateX(spin);
      // Reflexos deslizam na lataria como luzes passando na estrada.
      scene.environmentRotation.y = Math.sin(t * 0.22) * 0.5;
    }

    // Lugar atual: avenida → túnel → cidade, em loop. Cada um cresce do chão ao entrar.
    const place = reduced ? 0 : Math.floor(age / PLACE_S) % 3;
    const damp = (r: React.RefObject<number>, on: boolean) => { r.current = THREE.MathUtils.damp(r.current!, on ? 1 : 0, 2.4, dt); };
    damp(wAvenue, place === 0); damp(wTunnel, place === 1); damp(wCity, place === 2);

    // Câmera: troca de ângulo a cada 5 s, deslizando (sem corte seco). No celular, mais longe para caber.
    const shot = SHOTS[reduced ? 0 : Math.floor(age / (PLACE_S / 2)) % SHOTS.length];
    const far = mobile ? 1.3 : 1;
    const target = new THREE.Vector3(...shot.pos).multiplyScalar(far);
    const k2 = age < 2.4 ? 1.2 : 1.6;
    camPos.current.x = THREE.MathUtils.damp(camPos.current.x, target.x, k2, dt);
    camPos.current.y = THREE.MathUtils.damp(camPos.current.y, target.y, k2, dt);
    camPos.current.z = THREE.MathUtils.damp(camPos.current.z, target.z, k2, dt);
    camLook.current.lerp(new THREE.Vector3(...shot.look), 1 - Math.exp(-k2 * dt));
    // Respiração leve da câmera: nunca fica parada.
    camera.position.copy(camPos.current).add(new THREE.Vector3(Math.sin(t * 0.5) * 0.15, Math.sin(t * 0.7) * 0.06, 0));
    camera.lookAt(camLook.current);
    if (ease < 1) camera.position.lerp(new THREE.Vector3(...SHOTS[0].pos).multiplyScalar(far * 1.35), 1 - ease);
  });

  return (
    <>
      <group ref={rig}>
        <group ref={body} position={[0, 0.002, -0.24]}>
          <primitive object={root} />
        </group>
        {reflection && <group scale={[1, -1, 1]} position={[0, -0.004, -0.24]}><primitive object={reflection} /></group>}
        {/* Sombra de contato sob a carroceria */}
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, -0.02]} renderOrder={2}>
          <planeGeometry args={[3.5, 6]} />
          <shaderMaterial transparent depthWrite={false}
            vertexShader={`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`}
            fragmentShader={`varying vec2 vUv; void main(){ vec2 p=(vUv-.5)*vec2(1.25,1.2); float d=length(p*vec2(1.3,.86)); gl_FragColor=vec4(0.,0.,0.,smoothstep(.56,.14,d)*.86); }`} />
        </mesh>
      </group>
      <Road color={colors.glow} reduced={reduced} reflective={!mobile} />
      <Streaks color={colors.glow} count={mobile ? 8 : 18} reduced={reduced} />
      {/* Avenida */}
      <Props items={props.poles} weight={wAvenue} color="#1A2436" reduced={reduced} />
      <Props items={props.heads} weight={wAvenue} color="#E8F1FF" emissive reduced={reduced} />
      {/* Túnel */}
      <Props items={props.rings} weight={wTunnel} color="#0B6BFF" emissive reduced={reduced} />
      {/* Cidade */}
      <Props items={props.towers} weight={wCity} color="#0A1424" reduced={reduced} />
      <Props items={props.windows} weight={wCity} color="#BFD7FF" emissive reduced={reduced} />
      <fog attach="fog" args={["#02060E", 30, 70]} />
      <Environment resolution={mobile ? 64 : 128} frames={1} background={false}>
        <color attach="background" args={["#05090b"]} />
        <Lightformer form="rect" intensity={7} position={[0, 7, 0]} rotation-x={Math.PI / 2} scale={[14, 5, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={3.5} position={[-7, 2.5, 2]} rotation-y={Math.PI / 2} scale={[12, 1.1, 1]} color={colors.glow} />
        <Lightformer form="rect" intensity={3.5} position={[7, 2.5, -2]} rotation-y={-Math.PI / 2} scale={[12, 1.1, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={2} position={[0, 2, 9]} scale={[12, 1.4, 1]} color={colors.glow} />
        <Lightformer form="rect" intensity={1.6} position={[0, 3, -9]} rotation-y={Math.PI} scale={[9, 1, 1]} color="#ffb48a" />
      </Environment>
      <directionalLight position={[3, 6, 3]} intensity={0.6} />
      <ambientLight intensity={0.12} />
    </>
  );
}

function useCanvasDrag(yaw: React.RefObject<number>) {
  const drag = useRef<{ x: number; base: number } | null>(null);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      drag.current = { x: e.clientX, base: yaw.current! };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!drag.current) return;
      yaw.current = drag.current.base + ((e.clientX - drag.current.x) / 260);
    },
    onPointerUp: () => { drag.current = null; },
    onPointerCancel: () => { drag.current = null; },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") { yaw.current! -= 0.22; e.preventDefault(); }
      if (e.key === "ArrowRight") { yaw.current! += 0.22; e.preventDefault(); }
    },
  };
}

export default function Car3D({ colors, centered = false, onReady, onFail }: { colors: Identity["car"]; centered?: boolean; onReady: () => void; onFail: () => void }) {
  const yaw = useRef(0);
  const handlers = useCanvasDrag(yaw);
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const reduced = useMemo(() => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const mobile = useMemo(() => typeof innerWidth !== "undefined" && innerWidth < 768, []);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    if (host.current) io.observe(host.current);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={host} {...handlers} tabIndex={0} role="img"
      aria-label="Carro conceito 3D com as cores da Orbi. Arraste para os lados ou use as setas do teclado para girar."
      className="absolute inset-0 cursor-grab active:cursor-grabbing" style={{ touchAction: "pan-y" }}>
      <Canvas dpr={[1, mobile ? 1 : 1.25]} frameloop={visible ? "always" : "never"}
        camera={{ fov: 26, near: 1.5, far: 90, position: [2, 2, 12] }}
        gl={{ antialias: !mobile, alpha: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        onCreated={({ gl }) => { gl.domElement.addEventListener("webglcontextlost", onFail, { once: true }); }}>
        <Suspense fallback={null}>
          <Scene colors={colors} yaw={yaw} reduced={reduced} mobile={mobile} centered={centered} onReady={onReady} />
        </Suspense>
      </Canvas>
    </div>
  );
}
