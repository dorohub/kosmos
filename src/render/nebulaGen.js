// Prozedurale Nebel & Sternhaufen. Lokale Einheiten: Lichtjahre.
import { Rng, Noise3, hashString } from '../core/rng.js';

function makeBuf(n) {
  return { positions: new Float32Array(n * 3), colors: new Float32Array(n * 3), sizes: new Float32Array(n), i: 0, n };
}
function push(b, x, y, z, c, s, k) {
  if (b.i >= b.n) return;
  const j = b.i * 3;
  b.positions[j] = x; b.positions[j + 1] = y; b.positions[j + 2] = z;
  b.colors[j] = c[0] * k; b.colors[j + 1] = c[1] * k; b.colors[j + 2] = c[2] * k;
  b.sizes[b.i++] = s;
}
function done(b) {
  return { positions: b.positions.subarray(0, b.i * 3), colors: b.colors.subarray(0, b.i * 3), sizes: b.sizes.subarray(0, b.i), count: b.i };
}

const HA = [1.0, 0.22, 0.32];
const OIII = [0.25, 0.85, 0.85];
const SII = [1.0, 0.5, 0.25];
const BLUE = [0.55, 0.7, 1.0];
const HOT = [0.8, 0.88, 1.0];

export function generateNebula(type, R, id, quality = 1) {
  const rng = new Rng(id);
  const noise = new Noise3(hashString(id));
  const N = Math.floor(14000 * quality);
  const g = makeBuf(N + 3000);
  const d = makeBuf(Math.floor(N * 0.5) + 2000);
  const dir = [0, 0, 0];
  const s0 = R * 0.09;
  const kI = 2.6 / (N * (s0 / R) ** 2);

  const density = (x, y, z, f = 1.6) => {
    const n = noise.fbm(x * f / R + 3.1, y * f / R, z * f / R - 1.7, 4);
    return Math.max(0, n + 0.15);
  };
  const accept = (x, y, z, pw = 2.2, f) => rng.next() < Math.min(1, Math.pow(density(x, y, z, f) * 2.2, pw));

  if (type === 'emission' || type === 'pillars') {
    let tries = 0;
    while (g.i < N && tries++ < N * 40) {
      rng.dir(dir);
      const r = R * Math.pow(rng.next(), 0.5);
      const x = dir[0] * r, y = dir[1] * r * 0.75, z = dir[2] * r;
      if (!accept(x, y, z)) continue;
      const core = 1 - r / R;
      const u = rng.next();
      const c = u < core * 0.55 ? OIII : u < 0.9 ? HA : SII;
      push(g, x, y, z, c, s0 * rng.range(0.5, 1.2), kI * (0.6 + core));
    }
    // junge Sterne im Inneren
    for (let i = 0; i < 160; i++) {
      push(g, rng.gauss() * R * 0.2, rng.gauss() * R * 0.15, rng.gauss() * R * 0.2, HOT, R * 0.012, 60 * kI * rng.range(0.4, 1.2));
    }
    // Staubwolken
    for (let i = 0; i < N * 0.3; i++) {
      rng.dir(dir);
      const r = R * Math.pow(rng.next(), 0.4);
      const x = dir[0] * r, y = dir[1] * r * 0.7, z = dir[2] * r;
      if (density(x + R * 0.7, y, z, 2.4) < 0.3) continue;
      push(d, x, y, z, [0.5, 0.5, 0.5], s0 * rng.range(0.8, 1.4), 1);
    }
    if (type === 'pillars') {
      const cols = [{ x: -0.12, h: 0.42, w: 0.07 }, { x: 0.02, h: 0.3, w: 0.055 }, { x: 0.15, h: 0.22, w: 0.05 }];
      for (const c of cols) {
        for (let i = 0; i < N * 0.12; i++) {
          const t = rng.next();
          const w = R * c.w * (1.2 - t * 0.6);
          const y = -R * 0.35 + t * R * c.h;
          const x = R * c.x + rng.gauss() * w * 0.5 + Math.sin(t * 5) * R * 0.01;
          const z = rng.gauss() * w * 0.5 + R * 0.25;
          push(d, x, y, z, [0.95, 0.95, 0.95], w * 0.9, 1);
          if (i % 3 === 0) push(g, x + w * 0.45, y, z - w * 0.1, SII, w * 0.35, kI * 1.4);
        }
      }
    }
  } else if (type === 'snr') {
    for (let i = 0; i < N; i++) {
      rng.dir(dir);
      const fil = Math.abs(noise.noise(dir[0] * 4, dir[1] * 4, dir[2] * 4));
      const r = R * (0.75 + 0.25 * rng.next()) * (0.85 + fil * 0.4);
      if (rng.next() > 0.25 + fil * 2.5) continue;
      const c = rng.next() < 0.5 ? [1.0, 0.45, 0.2] : HA;
      push(g, dir[0] * r * 1.3, dir[1] * r * 0.9, dir[2] * r, c, s0 * 0.5, kI * 1.8);
    }
    for (let i = 0; i < N * 0.5; i++) {
      push(g, rng.gauss() * R * 0.35, rng.gauss() * R * 0.25, rng.gauss() * R * 0.3, [0.45, 0.6, 1.0], s0 * rng.range(0.6, 1.2), kI * 0.9);
    }
    push(g, 0, 0, 0, [0.85, 0.9, 1.0], R * 0.03, kI * 400);
  } else if (type === 'planetary') {
    for (let i = 0; i < N; i++) {
      const th = rng.next() * Math.PI * 2;
      const t = rng.gauss();
      const rr = R * (0.7 + t * 0.14);
      const h = rng.gauss() * R * 0.28;
      const x = rr * Math.cos(th), z = rr * Math.sin(th) * 0.85;
      const inner = t < -0.3;
      const c = inner ? OIII : t > 0.7 ? HA : [1.0, 0.6, 0.45];
      push(g, x, h * (0.5 + Math.abs(t) * 0.3), z, c, s0 * 0.55, kI * (inner ? 1.1 : 0.9));
    }
    for (let i = 0; i < N * 0.3; i++) {
      push(g, rng.gauss() * R * 0.3, rng.gauss() * R * 0.3, rng.gauss() * R * 0.25, OIII, s0 * 0.8, kI * 0.5);
    }
    push(g, 0, 0, 0, [0.85, 0.9, 1.0], R * 0.02, kI * 300);
  } else if (type === 'openCluster') {
    for (let i = 0; i < 400; i++) {
      const r = R * Math.abs(rng.gauss()) * 0.45;
      rng.dir(dir);
      const b = rng.next() < 0.1 ? 14 : rng.range(1.5, 5);
      push(g, dir[0] * r, dir[1] * r, dir[2] * r, BLUE, R * 0.012 * Math.sqrt(b), kI * 30 * b);
    }
    for (let i = 0; i < N * 0.7; i++) {
      rng.dir(dir);
      const r = R * Math.pow(rng.next(), 0.6) * 0.8;
      const x = dir[0] * r, y = dir[1] * r, z = dir[2] * r;
      if (!accept(x, y, z, 2.5, 3)) continue;
      push(g, x, y, z, [0.45, 0.6, 1.0], s0 * 0.7, kI * 0.45);
    }
  } else if (type === 'globular') {
    const n = Math.floor(9000 * quality);
    for (let i = 0; i < n; i++) {
      const u = rng.next();
      const r = Math.min(R * 1.2, (R * 0.12) / Math.sqrt(Math.pow(u, -2 / 3) - 1 + 1e-9));
      rng.dir(dir);
      const c = rng.next() < 0.08 ? [1.0, 0.6, 0.35] : rng.next() < 0.1 ? HOT : [1.0, 0.9, 0.7];
      push(g, dir[0] * r, dir[1] * r, dir[2] * r, c, R * 0.03, kI * 1.6);
    }
  }

  return { stars: done(g), dust: done(d) };
}
