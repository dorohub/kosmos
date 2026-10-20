// Kosmisches Netz: Knoten (Galaxienhaufen) verbunden durch Filamente, dazwischen Leerräume.
import { Rng } from '../core/rng.js';

export function generateWeb(opts) {
  const { rMin = 0, rMax, cell, count, seed, forced = [], exclude = [], galSize, excludeCenter = 0, nodeProb = 0.55 } = opts;
  const rng = new Rng(seed);
  const nodes = [];
  const n = Math.ceil(rMax / cell);
  const grid = new Map();
  const key = (i, j, k) => (i + 512) * 1048576 + (j + 512) * 1024 + (k + 512);

  const inShell = (x, y, z, pad = 0) => {
    const r = Math.hypot(x, y, z);
    return r <= rMax + pad && r >= rMin - pad;
  };
  const excluded = (x, y, z) => {
    for (const e of exclude) {
      const dx = x - e.x, dy = y - e.y, dz = z - e.z;
      if (dx * dx + dy * dy + dz * dz < e.r * e.r) return true;
    }
    return false;
  };

  for (let i = -n; i < n; i++) {
    for (let j = -n; j < n; j++) {
      for (let k = -n; k < n; k++) {
        if (rng.next() > nodeProb) continue;
        const x = (i + 0.5 + (rng.next() - 0.5) * 0.9) * cell;
        const y = (j + 0.5 + (rng.next() - 0.5) * 0.9) * cell;
        const z = (k + 0.5 + (rng.next() - 0.5) * 0.9) * cell;
        if (!inShell(x, y, z, cell)) continue;
        if (excluded(x, y, z)) continue;
        const m = Math.min(12, 0.4 / Math.pow(rng.next() + 0.02, 0.85));
        const idx = nodes.length;
        nodes.push({ x, y, z, m });
        const kk = key(i, j, k);
        if (!grid.has(kk)) grid.set(kk, []);
        grid.get(kk).push(idx);
      }
    }
  }
  for (const f of forced) {
    const i = Math.floor(f.x / cell), j = Math.floor(f.y / cell), k = Math.floor(f.z / cell);
    const idx = nodes.length;
    nodes.push({ x: f.x, y: f.y, z: f.z, m: f.m ?? 8 });
    const kk = key(i, j, k);
    if (!grid.has(kk)) grid.set(kk, []);
    grid.get(kk).push(idx);
  }

  // Kanten: jeder Knoten zu seinen 3 nächsten Nachbarn
  const edges = [];
  const seen = new Set();
  nodes.forEach((a, ia) => {
    const ci = Math.floor(a.x / cell), cj = Math.floor(a.y / cell), ck = Math.floor(a.z / cell);
    const cand = [];
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (let dk = -1; dk <= 1; dk++) {
      const list = grid.get(key(ci + di, cj + dj, ck + dk));
      if (!list) continue;
      for (const ib of list) {
        if (ib === ia) continue;
        const b = nodes[ib];
        const d2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
        cand.push([d2, ib]);
      }
    }
    cand.sort((p, q) => p[0] - q[0]);
    const kmax = 2 + (rng.next() < 0.5 ? 1 : 0);
    for (let c = 0; c < Math.min(kmax, cand.length); c++) {
      const ib = cand[c][1];
      if (cand[c][0] > (cell * 1.7) ** 2) break;
      const k2 = ia < ib ? ia * 1e7 + ib : ib * 1e7 + ia;
      if (seen.has(k2)) continue;
      seen.add(k2);
      edges.push({ a: ia, b: ib, len: Math.sqrt(cand[c][0]), w: Math.sqrt(a.m * nodes[ib].m) });
    }
  });

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const shapes = new Float32Array(count * 2);
  let p = 0;
  const put = (x, y, z, c, s) => {
    if (p >= count) return false;
    if (!inShell(x, y, z)) return true;
    if (excludeCenter && x * x + y * y + z * z < excludeCenter * excludeCenter) return true;
    if (excluded(x, y, z)) return true;
    const j = p * 3;
    positions[j] = x; positions[j + 1] = y; positions[j + 2] = z;
    colors[j] = c[0]; colors[j + 1] = c[1]; colors[j + 2] = c[2];
    sizes[p] = s;
    shapes[p * 2] = rng.next() * Math.PI;
    shapes[p * 2 + 1] = rng.range(0.25, 1.0);
    p++;
    return true;
  };

  const gold = [1.0, 0.85, 0.65], blue = [0.75, 0.82, 1.0], white = [0.92, 0.9, 1.0];
  const nNode = Math.floor(count * 0.36), nEdge = Math.floor(count * 0.5);
  const totalM = nodes.reduce((s, a) => s + a.m, 0) || 1;
  const totalE = edges.reduce((s, e) => s + e.len * e.w, 0) || 1;

  // Haufen
  let budget = nNode;
  for (const a of nodes) {
    let k = Math.round((a.m / totalM) * nNode * rng.range(0.7, 1.3));
    k = Math.min(k, budget); budget -= k;
    const sig = cell * 0.035 * Math.sqrt(a.m);
    for (let i = 0; i < k; i++) {
      const r = Math.abs(rng.gauss()) * sig;
      const dir = rng.dir([0, 0, 0]);
      const c = rng.next() < 0.65 ? gold : white;
      const v = rng.range(0.5, 1.3);
      put(a.x + dir[0] * r, a.y + dir[1] * r, a.z + dir[2] * r, [c[0] * v, c[1] * v, c[2] * v], galSize * rng.range(0.6, 1.6));
    }
  }
  // Filamente
  for (const e of edges) {
    const A = nodes[e.a], B = nodes[e.b];
    const k = Math.round(((e.len * e.w) / totalE) * nEdge);
    const sig = cell * 0.022;
    // leichte Krümmung
    const mx = (A.x + B.x) / 2 + rng.gauss() * cell * 0.08;
    const my = (A.y + B.y) / 2 + rng.gauss() * cell * 0.08;
    const mz = (A.z + B.z) / 2 + rng.gauss() * cell * 0.08;
    for (let i = 0; i < k; i++) {
      const t = rng.next();
      const u = 1 - t;
      const x = u * u * A.x + 2 * u * t * mx + t * t * B.x;
      const y = u * u * A.y + 2 * u * t * my + t * t * B.y;
      const z = u * u * A.z + 2 * u * t * mz + t * t * B.z;
      const c = rng.next() < 0.75 ? blue : white;
      const v = rng.range(0.4, 1.0);
      put(x + rng.gauss() * sig, y + rng.gauss() * sig, z + rng.gauss() * sig, [c[0] * v, c[1] * v, c[2] * v], galSize * rng.range(0.5, 1.2));
    }
  }
  // Feldgalaxien (dünn)
  let guard = 0;
  while (p < count && guard++ < count * 6) {
    const x = (rng.next() * 2 - 1) * rMax, y = (rng.next() * 2 - 1) * rMax, z = (rng.next() * 2 - 1) * rMax;
    const v = rng.range(0.25, 0.7);
    put(x, y, z, [blue[0] * v, blue[1] * v, blue[2] * v], galSize * rng.range(0.4, 1.0));
  }

  return {
    positions: positions.subarray(0, p * 3), colors: colors.subarray(0, p * 3),
    sizes: sizes.subarray(0, p), shapes: shapes.subarray(0, p * 2), count: p,
  };
}
