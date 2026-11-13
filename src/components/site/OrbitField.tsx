"use client";
import { useEffect, useRef } from "react";

/**
 * A constelação do Vale do Aço: o fundo vivo do topo do site.
 *
 * Cada cidade é um pequeno sistema orbital (anéis finos e um satélite, como o símbolo da marca).
 * Os bairros são pontos de luz ligados por rotas em arco. Os carros viajam como cometas.
 * De tempos em tempos uma corrida é pedida (verde); o carro mais próximo muda de rumo, fica verde e vai buscar.
 * Isso mostra, sem uma palavra, o que o produto faz: distribuir a corrida para quem está mais perto.
 *
 * Custo baixo de propósito: um único canvas, ~25 pontos e ~10 cometas, resolução limitada a 1,5x,
 * e o desenho para sozinho quando sai da tela, quando a aba fica escondida ou com movimento reduzido.
 */

type RGB = readonly [number, number, number];
const CYAN: RGB = [0, 225, 255];
const BLUE: RGB = [11, 107, 255];
const MINT: RGB = [91, 212, 155];
const ICE: RGB = [189, 246, 255];
const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** Gerador pseudoaleatório com semente: o desenho é sempre o mesmo, só os carros variam. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Posição aproximada das cidades no vale (espaço 0..1). k é o tamanho do sistema. */
const HUBS = [
  { key: "ipatin", x: 0.47, y: 0.52, z: 1, k: 1 },
  { key: "fabric", x: 0.19, y: 0.66, z: 0.8, k: 0.62 },
  { key: "timote", x: 0.82, y: 0.72, z: 0.85, k: 0.6 },
  { key: "santan", x: 0.62, y: 0.14, z: 0.7, k: 0.5 },
];
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type N = { x: number; y: number; z: number; hub: boolean; k: number; label: string };
type E = { a: number; b: number; bend: number };
type Graph = { nodes: N[]; edges: E[]; adj: { n: number; e: number }[][] };

function build(satellites: number, labels: string[]): Graph {
  const r = rng(11);
  const nodes: N[] = HUBS.map((h) => ({ x: h.x, y: h.y, z: h.z, hub: true, k: h.k, label: "" }));
  const used = new Set<number>();
  for (const l of labels) {
    const i = HUBS.findIndex((h, idx) => !used.has(idx) && plain(l).includes(h.key));
    if (i >= 0) { used.add(i); nodes[i].label = l; }
  }
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  for (let i = 0; i < satellites; i++) {
    const h = nodes[Math.floor(r() * HUBS.length)];
    const a = r() * Math.PI * 2;
    const d = 0.07 + r() * 0.17;
    nodes.push({ x: clamp(h.x + Math.cos(a) * d * 0.9, 0.02, 0.98), y: clamp(h.y + Math.sin(a) * d * 1.3, 0.05, 0.95), z: 0.25 + r() * 0.6, hub: false, k: 0.35 + r() * 0.3, label: "" });
  }
  const edges: E[] = [];
  const seen = new Set<string>();
  const dist = (a: number, b: number) => Math.hypot((nodes[a].x - nodes[b].x) * 1.5, nodes[a].y - nodes[b].y);
  const add = (a: number, b: number) => {
    if (a === b) return;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ a, b, bend: (r() < 0.5 ? -1 : 1) * (0.14 + r() * 0.16) });
  };
  for (let i = 1; i < HUBS.length; i++) add(0, i); // Ipatinga liga tudo: o grafo é sempre conexo
  for (let i = 0; i < HUBS.length; i++) {
    [...HUBS.keys()].filter((j) => j !== i).sort((p, q) => dist(i, p) - dist(i, q)).slice(0, 2).forEach((j) => add(i, j));
  }
  for (let i = HUBS.length; i < nodes.length; i++) {
    const hubs = [...HUBS.keys()].sort((p, q) => dist(i, p) - dist(i, q));
    add(i, hubs[0]);
    const others = nodes.map((_, j) => j).filter((j) => j !== i).sort((p, q) => dist(i, p) - dist(i, q));
    add(i, others[0]);
    if (r() > 0.5) add(i, others[1]);
  }
  const adj: Graph["adj"] = nodes.map(() => []);
  edges.forEach((e, i) => { adj[e.a].push({ n: e.b, e: i }); adj[e.b].push({ n: e.a, e: i }); });
  return { nodes, edges, adj };
}

/** Pontinho de luz pré-desenhado: desenhar uma imagem é muito mais barato do que um degradê por quadro. */
function glow(c: RGB) {
  const s = document.createElement("canvas");
  s.width = s.height = 64;
  const x = s.getContext("2d")!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, rgba(c, 1)); g.addColorStop(0.3, rgba(c, 0.35)); g.addColorStop(1, rgba(c, 0));
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return s;
}

type Comet = { e: number; dir: 1 | -1; t: number; v: number; goal: number };
type Ripple = { n: number; born: number; big: boolean };

export function OrbitField({ labels, reduce }: { labels: string[]; reduce: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = labels.join("|");

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const host = cv.parentElement!;
    const small = innerWidth < 768;
    const { nodes, edges, adj } = build(small ? 9 : 15, key ? key.split("|") : []);
    const edgeOf = new Map<string, number>();
    edges.forEach((e, i) => { edgeOf.set(`${e.a}-${e.b}`, i); edgeOf.set(`${e.b}-${e.a}`, i); });
    const sprite = { cyan: glow(CYAN), blue: glow(BLUE), mint: glow(MINT) };
    const r = rng(5);
    const dust = Array.from({ length: small ? 24 : 48 }, () => ({ x: r(), y: r(), s: 0.6 + r() * 1.1, v: 0.004 + r() * 0.012, a: 0.12 + r() * 0.3 }));
    const comets: Comet[] = Array.from({ length: small ? 6 : 11 }, () => ({ e: Math.floor(r() * edges.length), dir: r() < 0.5 ? 1 : -1, t: r(), v: 55 + r() * 55, goal: -1 }));

    let W = 0, H = 0, dpr = 1;
    let reg = { x: 0, y: 0, w: 1, h: 1, a: 1 };
    const par = { x: 0, y: 0, tx: 0, ty: 0 };
    const ptr = { x: -9999, y: -9999 };
    const P = nodes.map(() => ({ x: 0, y: 0 }));
    const ripples: Ripple[] = [];
    let req: { node: number; born: number } | null = null;
    let nextReq = 1.6;

    const layout = () => nodes.forEach((n, i) => { P[i].x = reg.x + n.x * reg.w + par.x * n.z * 30; P[i].y = reg.y + n.y * reg.h + par.y * n.z * 20; });
    const ctrl = (e: E) => {
      const a = nodes[e.a], b = nodes[e.b];
      const dx = b.x - a.x, dy = b.y - a.y, z = (a.z + b.z) / 2;
      return { x: reg.x + ((a.x + b.x) / 2 - dy * e.bend) * reg.w + par.x * z * 30, y: reg.y + ((a.y + b.y) / 2 + dx * e.bend) * reg.h + par.y * z * 20 };
    };
    const at = (a: { x: number; y: number }, c: { x: number; y: number }, b: { x: number; y: number }, u: number) => {
      const w = 1 - u;
      return { x: w * w * a.x + 2 * w * u * c.x + u * u * b.x, y: w * w * a.y + 2 * w * u * c.y + u * u * b.y };
    };
    const cometAt = (c: Comet, t: number) => {
      const e = edges[c.e];
      return at(P[e.a], ctrl(e), P[e.b], c.dir > 0 ? t : 1 - t);
    };
    /** Primeiro passo do menor caminho até o destino. */
    const hop = (from: number, goal: number) => {
      if (from === goal) return -1;
      const prev = new Map<number, number>([[from, -1]]);
      const q = [from];
      for (let i = 0; i < q.length; i++) {
        for (const { n } of adj[q[i]]) {
          if (prev.has(n)) continue;
          prev.set(n, q[i]); q.push(n);
          if (n === goal) { let s = n; while (prev.get(s) !== from) s = prev.get(s)!; return s; }
        }
      }
      return -1;
    };

    const resize = () => {
      W = host.clientWidth; H = host.clientHeight;
      dpr = Math.min(devicePixelRatio || 1, 1.5);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      // Largo: começa onde termina a coluna do texto (600 px + margem), para nunca passar atrás do título.
      // Estreito: ocupa o topo, bem apagado e sem nomes, para não atrapalhar a leitura.
      const x0 = Math.max(W * 0.42, Math.max(0, (W - 1280) / 2) + 40 + 610);
      reg = W >= 1024 ? { x: x0, y: H * 0.14, w: Math.max(320, W * 0.985 - x0), h: H * 0.7, a: 1 } : { x: W * 0.06, y: H * 0.05, w: W * 0.88, h: H * 0.4, a: 0.32 };
      if (!running) render(0);
    };

    const step = (dt: number, time: number) => {
      par.x += (par.tx - par.x) * Math.min(1, dt * 3);
      par.y += (par.ty - par.y) * Math.min(1, dt * 3);
      layout();
      if (!req && time > nextReq) {
        const taken = new Set(comets.map((c) => c.goal));
        const clear = reg.x + reg.w * (W >= 1024 ? 0.2 : 0);
        const free = nodes.map((_, i) => i).filter((i) => !nodes[i].hub && !taken.has(i) && P[i].x > clear);
        if (!free.length) nextReq = time + 1;
        else {
          const node = free[Math.floor(Math.random() * free.length)];
          let best = -1, bd = Infinity;
          comets.forEach((c, i) => { const p = cometAt(c, c.t); const d = Math.hypot(p.x - P[node].x, p.y - P[node].y); if (c.goal < 0 && d < bd) { bd = d; best = i; } });
          if (best >= 0) { req = { node, born: time }; comets[best].goal = node; } else nextReq = time + 1;
        }
      }
      for (const c of comets) {
        const e = edges[c.e];
        const len = Math.hypot(P[e.a].x - P[e.b].x, P[e.a].y - P[e.b].y) * 1.12 + 1;
        c.t += (c.v * dt) / len;
        if (c.t < 1) continue;
        const here = c.dir > 0 ? e.b : e.a, from = c.dir > 0 ? e.a : e.b;
        const done = req?.node === here;
        ripples.push({ n: here, born: time, big: done });
        if (done) { req = null; nextReq = time + 2.8 + Math.random() * 2.4; comets.forEach((o) => { if (o.goal === here) o.goal = -1; }); }
        let next = c.goal >= 0 ? hop(here, c.goal) : -1;
        if (next < 0) {
          const opts = adj[here].filter((x) => x.n !== from);
          const pool = opts.length ? opts : adj[here];
          next = pool[Math.floor(Math.random() * pool.length)].n;
        }
        c.e = edgeOf.get(`${here}-${next}`)!; c.dir = edges[c.e].a === here ? 1 : -1; c.t = 0;
      }
      while (ripples.length && time - ripples[0].born > 2.4) ripples.shift();
    };

    const render = (time: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = reg.a;
      if (!running) layout();

      // poeira de estrelas, subindo devagar
      for (const d of dust) {
        const y = (((d.y - time * d.v) % 1) + 1) % 1;
        ctx.fillStyle = `rgba(190,215,255,${d.a})`;
        ctx.fillRect(reg.x - reg.w * 0.15 + d.x * reg.w * 1.3, reg.y - reg.h * 0.1 + y * reg.h * 1.2, d.s, d.s);
      }

      // rotas em arco; acendem com um carro e com o ponteiro por perto
      const live = new Set(comets.map((c) => c.e));
      ctx.lineWidth = 1;
      edges.forEach((e, i) => {
        const A = P[e.a], B = P[e.b], C = ctrl(e);
        const d = Math.hypot((A.x + B.x) / 2 - ptr.x, (A.y + B.y) / 2 - ptr.y);
        const a = 0.125 + (d < 170 ? (1 - d / 170) * 0.22 : 0);
        ctx.strokeStyle = live.has(i) ? rgba(CYAN, 0.26) : `rgba(140,185,255,${a})`;
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.quadraticCurveTo(C.x, C.y, B.x, B.y); ctx.stroke();
      });

      // sistemas orbitais das cidades
      const S = Math.min(reg.w, reg.h * 1.5);
      const rot = -0.28, cr = Math.cos(rot), sr = Math.sin(rot);
      nodes.forEach((n, i) => {
        if (!n.hub) return;
        const { x, y } = P[i];
        const rx = S * 0.3 * n.k, ry = S * 0.105 * n.k;
        ctx.strokeStyle = "rgba(245,247,250,.1)";
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "rgba(245,247,250,.06)";
        ctx.beginPath(); ctx.ellipse(x, y, rx * 0.63, ry * 0.63, rot, 0, Math.PI * 2); ctx.stroke();
        const th = (time * Math.PI * 2) / (14 + i * 3) + i * 1.7;
        const sx = x + rx * Math.cos(th) * cr - ry * Math.sin(th) * sr, sy = y + rx * Math.cos(th) * sr + ry * Math.sin(th) * cr;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = reg.a * 0.9; ctx.drawImage(sprite.cyan, sx - 9, sy - 9, 18, 18);
        ctx.globalAlpha = reg.a; ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = rgba(ICE, 1); ctx.beginPath(); ctx.arc(sx, sy, 1.9, 0, Math.PI * 2); ctx.fill();
      });

      // pontos: bairros e centros
      ctx.globalCompositeOperation = "lighter";
      nodes.forEach((n, i) => {
        const { x, y } = P[i];
        const near = Math.hypot(x - ptr.x, y - ptr.y);
        if (n.hub) { const s = 54 * n.k + 18; ctx.drawImage(sprite.blue, x - s / 2, y - s / 2, s, s); }
        if (near < 130) { const s = 34 * (1 - near / 130) + 10; ctx.drawImage(sprite.cyan, x - s / 2, y - s / 2, s, s); }
      });
      ctx.globalCompositeOperation = "source-over";
      nodes.forEach((n, i) => {
        const { x, y } = P[i];
        ctx.fillStyle = n.hub ? rgba(ICE, 1) : `rgba(190,220,255,${0.3 + n.z * 0.45})`;
        ctx.beginPath(); ctx.arc(x, y, n.hub ? 3.4 + n.k : 1.5 + n.z * 1.5, 0, Math.PI * 2); ctx.fill();
      });

      // chegadas: um anel que se abre onde o carro chegou
      for (const rp of ripples) {
        const age = time - rp.born, dur = rp.big ? 2.2 : 1.4;
        if (age > dur) continue;
        const p = age / dur, e = 1 - (1 - p) ** 3;
        ctx.strokeStyle = rgba(rp.big ? MINT : CYAN, (1 - p) * (rp.big ? 0.7 : 0.45));
        ctx.lineWidth = rp.big ? 1.6 : 1;
        ctx.beginPath(); ctx.arc(P[rp.n].x, P[rp.n].y, (rp.big ? 70 : 32) * e, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.lineWidth = 1;

      // corrida pedida (verde) até o carro chegar
      if (req) {
        const { x, y } = P[req.node];
        ctx.strokeStyle = rgba(MINT, 0.85);
        ctx.beginPath(); ctx.arc(x, y, 9 + Math.sin(time * 4) * 2, 0, Math.PI * 2); ctx.stroke();
        const k = ((time - req.born) % 1.3) / 1.3;
        ctx.strokeStyle = rgba(MINT, (1 - k) * 0.5);
        ctx.beginPath(); ctx.arc(x, y, 9 + k * 26, 0, Math.PI * 2); ctx.stroke();
        ctx.globalCompositeOperation = "lighter"; ctx.drawImage(sprite.mint, x - 16, y - 16, 32, 32); ctx.globalCompositeOperation = "source-over";
        ctx.font = "600 10.5px Inter, system-ui, sans-serif";
        (ctx as unknown as { letterSpacing: string }).letterSpacing = "1.4px";
        ctx.fillStyle = rgba(MINT, 0.95);
        ctx.fillText(time - req.born < 1 ? "CORRIDA PEDIDA" : "MOTORISTA A CAMINHO", x + 16, y + 4);
      }

      // cometas: cauda em degradê e cabeça brilhante
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      for (const c of comets) {
        const e = edges[c.e];
        const len = Math.hypot(P[e.a].x - P[e.b].x, P[e.a].y - P[e.b].y) * 1.12 + 1;
        const step = 9 / len, tint = c.goal >= 0 ? MINT : CYAN, N = 14;
        let prev = cometAt(c, c.t);
        const head = prev;
        for (let k = 1; k <= N; k++) {
          const p = cometAt(c, Math.max(0, c.t - k * step));
          const f = 1 - k / N;
          ctx.strokeStyle = rgba(tint, f ** 1.6 * 0.85);
          ctx.lineWidth = 0.5 + f * 2;
          ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
          prev = p;
        }
        ctx.drawImage(c.goal >= 0 ? sprite.mint : sprite.cyan, head.x - 11, head.y - 11, 22, 22);
        ctx.fillStyle = rgba(ICE, 1); ctx.beginPath(); ctx.arc(head.x, head.y, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.lineCap = "butt";

      // nomes das cidades
      ctx.font = "600 10.5px Inter, system-ui, sans-serif";
      (ctx as unknown as { letterSpacing: string }).letterSpacing = "1.6px";
      ctx.fillStyle = "rgba(245,247,250,.62)";
      if (W >= 1024) nodes.forEach((n, i) => { if (n.label) ctx.fillText(n.label.toUpperCase(), P[i].x + 12, P[i].y + 22 + n.k * 4); });
      ctx.globalAlpha = 1;
    };

    let running = false, visible = true, raf = 0, last = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const time = (now - t0) / 1000;
      step(dt, time);
      render(time);
      if (running) raf = requestAnimationFrame(tick);
    };
    const sync = () => {
      const go = !reduce && visible && !document.hidden;
      if (go && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(tick); }
      else if (!go && running) { running = false; cancelAnimationFrame(raf); raf = 0; }
    };

    const move = (e: PointerEvent) => {
      const b = cv.getBoundingClientRect();
      ptr.x = e.clientX - b.left; ptr.y = e.clientY - b.top;
      par.tx = e.clientX / innerWidth - 0.5; par.ty = e.clientY / innerHeight - 0.5;
    };
    const leave = () => { ptr.x = ptr.y = -9999; };
    const fine = matchMedia("(pointer: fine)").matches && !reduce;
    if (fine) { addEventListener("pointermove", move, { passive: true }); document.addEventListener("pointerleave", leave); }
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; sync(); });
    io.observe(host);
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    document.addEventListener("visibilitychange", sync);
    resize();
    if (reduce) { layout(); render(0); } else sync();

    return () => {
      running = false; cancelAnimationFrame(raf);
      io.disconnect(); ro.disconnect();
      document.removeEventListener("visibilitychange", sync);
      removeEventListener("pointermove", move); document.removeEventListener("pointerleave", leave);
    };
  }, [key, reduce]);

  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 size-full" />;
}
