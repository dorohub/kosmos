// Prozeduraler Galaxien-Generator. Lokale Einheiten: Lichtjahre, Scheibe in XZ-Ebene, Normale = +Y.
import { Rng } from '../core/rng.js';

class Buf {
  constructor(n) {
    this.n = Math.max(1, Math.floor(n));
    this.positions = new Float32Array(this.n * 3);
    this.colors = new Float32Array(this.n * 3);
    this.sizes = new Float32Array(this.n);
    this.i = 0;
  }
  push(x, y, z, r, g, b, s) {
    if (this.i >= this.n) return;
    const i = this.i++, j = i * 3;
    this.positions[j] = x; this.positions[j + 1] = y; this.positions[j + 2] = z;
    this.colors[j] = r; this.colors[j + 1] = g; this.colors[j + 2] = b;
    this.sizes[i] = s;
  }
  done() {
    const n = this.i;
    return { positions: this.positions.subarray(0, n * 3), colors: this.colors.subarray(0, n * 3), sizes: this.sizes.subarray(0, n), count: n };
  }
}

const YOUNG = [0.5, 0.68, 1.0];
const WHITE = [0.95, 0.95, 1.0];
const OLD = [1.0, 0.84, 0.62];
const DISKC = [1.0, 0.93, 0.82];
const HII = [1.0, 0.28, 0.5];

function hernquist(rng, a, cap) {
  for (;;) {
    const u = Math.sqrt(rng.next());
    const r = (a * u) / (1 - u + 1e-9);
    if (r < cap) return r;
  }
}
function plummer(rng, a, cap) {
  for (;;) {
    const u = rng.next();
    const r = a / Math.sqrt(Math.pow(u, -2 / 3) - 1 + 1e-9);
    if (r < cap) return r;
  }
}
function expDisk(rng, rd, rmin, rmax) {
  for (let k = 0; k < 50; k++) {
    // Gamma(2)-Verteilung = Flächendichte exp(-r/rd)
    const r = -rd * Math.log(rng.next() * rng.next() + 1e-12);
    if (r >= rmin && r <= rmax) return r;
  }
  return rmin + rng.next() * (rmax - rmin);
}

function jitter(c, rng, amt = 0.08, k = 1) {
  const v = 1 + (rng.next() - 0.5) * 2 * amt;
  return [c[0] * v * k, c[1] * v * k, c[2] * v * k];
}

const tmpDir = [0, 0, 0];

export function generateGalaxy(spec, R, seed, quality = 1) {
  const rng = new Rng(seed);
  const kind = spec.kind;
  const N = Math.floor((spec.mw ? 270000 : 150000 * (spec.count ?? 0.3)) * quality);
  const stars = new Buf(N * 1.25 + 200);
  const dust = new Buf(N * 0.35 + 50);
  const s0 = R * (spec.sizeK ?? 0.03);
  // Intensität so normiert, dass die Gesamterscheinung unabhängig von der Partikelzahl bleibt
  const KIND_EXPOSURE = { dwarf: 0.7, irregular: 2.4, elliptical: 2.6, spiral: 2.8, starburst: 2.6, sombrero: 2.8, ring: 2.8, merger: 2.6 };
  const kI = (spec.exposure ?? KIND_EXPOSURE[kind] ?? 4) * (spec.dim ?? 1) / (N * (s0 / R) ** 2);
  const tint = spec.colorTint || [1, 1, 1];
  const P = (x, y, z, c, s, i) => stars.push(x, y, z, c[0] * i * kI * tint[0], c[1] * i * kI * tint[1], c[2] * i * kI * tint[2], s);
  const D = (x, y, z, s, a) => dust.push(x, y, z, a, a, a, s);

  const addBulge = (n, a, cap, flat, bright = 1.0, col = OLD) => {
    for (let i = 0; i < n; i++) {
      const r = hernquist(rng, a, cap);
      rng.dir(tmpDir);
      P(tmpDir[0] * r, tmpDir[1] * r * flat, tmpDir[2] * r, jitter(col, rng, 0.1), s0 * rng.range(0.7, 1.3), bright * 1.25);
    }
  };
  const addHalo = (n, a, cap, bright = 0.35) => {
    for (let i = 0; i < n; i++) {
      const r = plummer(rng, a, cap);
      rng.dir(tmpDir);
      P(tmpDir[0] * r, tmpDir[1] * r * 0.8, tmpDir[2] * r, OLD, s0 * 0.6, bright);
    }
  };

  if (kind === 'spiral') {
    const tanP = Math.tan(((spec.pitch ?? 13) * Math.PI) / 180);
    let arms;
    if (spec.mw) {
      const ref = (r) => Math.PI + Math.log(r / R) / tanP;
      arms = [
        { phase: ref(15900), w: 1.0 }, // Scutum-Centaurus
        { phase: ref(22900), w: 0.6 }, // Sagittarius-Carina
        { phase: ref(32900), w: 1.0 }, // Perseus
        { phase: ref(47300), w: 0.55 }, // Norma-Outer
      ];
    } else {
      const n = spec.arms ?? 2;
      const ph0 = rng.next() * Math.PI * 2;
      arms = [];
      for (let k = 0; k < n; k++) arms.push({ phase: ph0 + (k * Math.PI * 2) / n, w: 1 });
      if (spec.flocculent) for (let k = 0; k < 10; k++) arms.push({ phase: rng.next() * Math.PI * 2, w: 0.25, seg: rng.range(0.6, 1.6) });
      else for (let k = 0; k < 7; k++) arms.push({ phase: rng.next() * Math.PI * 2, w: 0.07, seg: 1 });
    }
    // individuelle Störung jedes Arms (Knicke, Verdickungen)
    for (const a of arms) { a.wf = rng.range(5, 11); a.wp = rng.next() * 6.28; a.wa = rng.range(0.08, 0.2); }
    const wsum = arms.reduce((s, a) => s + a.w, 0);
    const pickArm = () => {
      let u = rng.next() * wsum;
      for (const a of arms) { if ((u -= a.w) <= 0) return a; }
      return arms[0];
    };
    const barLen = spec.mw ? 15000 : (spec.bar ?? 0) * R;
    const barAng = spec.mw ? Math.PI + (27 * Math.PI) / 180 : rng.next() * Math.PI;
    const rmin = Math.max(barLen * 0.9, R * 0.06);
    const nBulge = Math.floor(N * (spec.bulge ?? 0.15));
    const nBar = barLen > 0 ? Math.floor(N * 0.08) : 0;
    const nHalo = Math.floor(N * 0.02);
    const nArm = Math.floor((N - nBulge - nBar - nHalo) * 0.62);
    const nDisk = N - nBulge - nBar - nHalo - nArm;
    const thick = R * 0.011;

    addBulge(nBulge, R * 0.055, R * 0.4, 0.62, 1.1);
    if (spec.mw) {
      // Kern-Leuchten um Sgr A*
      addBulge(Math.floor(N * 0.01), R * 0.008, R * 0.05, 0.8, 1.6, [1.0, 0.9, 0.75]);
    }
    for (let i = 0; i < nBar; i++) {
      const x = rng.gauss() * barLen * 0.42, z = rng.gauss() * barLen * 0.11, y = rng.gauss() * thick * 1.5;
      const c = Math.cos(barAng), s = Math.sin(barAng);
      P(x * c - z * s, y, x * s + z * c, jitter(OLD, rng, 0.08), s0 * rng.range(0.8, 1.2), 1.15);
    }
    // Spiralarme
    const armPos = (arm, r) => {
      const th = arm.phase - Math.log(r / R) / tanP + (arm.wa || 0) * Math.sin((r / R) * (arm.wf || 0) + (arm.wp || 0));
      return [r * Math.cos(th), r * Math.sin(th)];
    };
    for (let i = 0; i < nArm; i++) {
      const arm = pickArm();
      let r = expDisk(rng, R * 0.33, rmin, R * 1.05);
      if (arm.seg) r = R * rng.range(0.3, 0.9);
      const [cx, cz] = armPos(arm, r);
      const sig = R * (0.022 + 0.045 * (r / R)) * (spec.flocculent ? 1.6 : 1) * (arm.w < 0.7 ? 1.25 : 1);
      const x = cx + rng.gauss() * sig, z = cz + rng.gauss() * sig, y = rng.gauss() * thick * 0.7;
      const u = rng.next();
      if (u < 0.08) P(x, y, z, jitter(HII, rng, 0.15), s0 * rng.range(0.3, 0.6), 2.6);
      else if (u < 0.6) P(x, y, z, jitter(YOUNG, rng, 0.12), s0 * rng.range(0.6, 1.1), 1.05);
      else P(x, y, z, jitter(WHITE, rng, 0.1), s0 * rng.range(0.7, 1.2), 0.85);
    }
    // Orion-Sporn (nur Milchstraße)
    if (spec.mw) {
      const nSp = Math.floor(N * 0.035);
      const spur = { phase: Math.PI + Math.log(26670 / R) / tanP };
      for (let i = 0; i < nSp; i++) {
        const r = rng.range(21500, 33000);
        const [cx, cz] = armPos(spur, r);
        const sig = R * 0.022;
        const u = rng.next();
        const c = u < 0.06 ? HII : u < 0.6 ? YOUNG : WHITE;
        P(cx + rng.gauss() * sig, rng.gauss() * thick * 0.7, cz + rng.gauss() * sig, jitter(c, rng, 0.12), s0 * rng.range(0.5, 0.9), u < 0.06 ? 2 : 0.85);
      }
    }
    // Diffuse Scheibe
    for (let i = 0; i < nDisk; i++) {
      const r = expDisk(rng, R * 0.3, R * 0.03, R * 1.1);
      const th = rng.next() * Math.PI * 2;
      P(r * Math.cos(th), rng.gauss() * thick * 1.6, r * Math.sin(th), jitter(DISKC, rng, 0.08), s0 * rng.range(0.8, 1.4), 0.62);
    }
    addHalo(nHalo, R * 0.35, R * 1.4);
    // weiche Grundhelligkeit (große, schwache Partikel)
    const nGlow = Math.floor(N * 0.025);
    for (let i = 0; i < nGlow; i++) {
      if (rng.next() < 0.35) {
        const r = hernquist(rng, R * 0.07, R * 0.45);
        rng.dir(tmpDir);
        P(tmpDir[0] * r, tmpDir[1] * r * 0.6, tmpDir[2] * r, OLD, s0 * 5, 0.5);
      } else {
        const arm = pickArm();
        const r = expDisk(rng, R * 0.33, rmin, R);
        const [cx, cz] = armPos(arm, r);
        const sig = R * 0.06;
        P(cx + rng.gauss() * sig, rng.gauss() * thick, cz + rng.gauss() * sig, [0.75, 0.82, 1.0], s0 * 5, 0.3);
      }
    }
    // Staub entlang der Innenkanten der Arme
    const nDust = Math.floor(N * (spec.dusty ? 0.3 : 0.18));
    for (let i = 0; i < nDust; i++) {
      const arm = pickArm();
      const r = arm.seg ? R * rng.range(0.25, 0.9) : expDisk(rng, R * 0.33, rmin * 0.8, R * 0.95);
      const [cx, cz] = armPos(arm, r * 0.94);
      const sig = R * (0.012 + 0.025 * (r / R));
      D(cx + rng.gauss() * sig, rng.gauss() * thick * 0.35, cz + rng.gauss() * sig, s0 * rng.range(0.7, 1.3), spec.dusty ? 0.3 : 0.2);
    }
    if (spec.companion) {
      // NGC 5195 neben M51
      const ox = R * 0.62, oz = R * 0.48, oy = -R * 0.06;
      const nC = Math.floor(N * 0.07);
      for (let i = 0; i < nC; i++) {
        const r = hernquist(rng, R * 0.04, R * 0.2);
        rng.dir(tmpDir);
        P(ox + tmpDir[0] * r, oy + tmpDir[1] * r * 0.8, oz + tmpDir[2] * r, jitter(OLD, rng, 0.1), s0 * 0.8, 1.3);
      }
      for (let i = 0; i < nC * 0.5; i++) {
        const t = rng.next();
        const x = ox * (0.55 + 0.45 * t), z = oz * (0.3 + 0.7 * t) - R * 0.12 * Math.sin(t * Math.PI);
        P(x + rng.gauss() * R * 0.03, rng.gauss() * thick, z + rng.gauss() * R * 0.03, YOUNG, s0 * 0.7, 0.6);
      }
    }
  } else if (kind === 'elliptical') {
    const q = spec.q ?? 0.8;
    const a = R * (spec.giant ? 0.14 : 0.17);
    const nCore = Math.floor(N * 0.94);
    for (let i = 0; i < nCore; i++) {
      const r = hernquist(rng, a, R * 1.05);
      rng.dir(tmpDir);
      const warm = rng.next() < 0.5 ? OLD : [1.0, 0.78, 0.55];
      P(tmpDir[0] * r, tmpDir[1] * r * q, tmpDir[2] * r * (0.5 + q * 0.5), jitter(warm, rng, 0.08), s0 * rng.range(0.7, 1.3), 1.0);
    }
    for (let i = 0; i < N * 0.02; i++) {
      const r = hernquist(rng, a, R);
      rng.dir(tmpDir);
      P(tmpDir[0] * r, tmpDir[1] * r * q, tmpDir[2] * r * (0.5 + q * 0.5), OLD, s0 * 5, 0.5);
    }
    const nGc = Math.floor(N * 0.03);
    for (let i = 0; i < nGc; i++) {
      const r = plummer(rng, R * 0.45, R * 1.8);
      rng.dir(tmpDir);
      P(tmpDir[0] * r, tmpDir[1] * r, tmpDir[2] * r, [1, 0.9, 0.7], s0 * 0.25, 1.6);
    }
    if (spec.dustLane) {
      const nD = Math.floor(N * 0.3);
      for (let i = 0; i < nD; i++) {
        const r = Math.abs(rng.gauss()) * R * 0.28;
        const th = rng.next() * Math.PI * 2;
        const warp = Math.sin(th * 2) * r * 0.12;
        D(r * Math.cos(th), rng.gauss() * R * 0.015 + warp, r * Math.sin(th), s0 * rng.range(0.6, 1.2), 0.55);
        if (i % 9 === 0) P(r * Math.cos(th), warp + rng.gauss() * R * 0.01, r * Math.sin(th), i % 2 ? HII : YOUNG, s0 * 0.4, 1.5);
      }
    }
    if (spec.jet) addJet(rng, P, R, s0, spec.giant ? 0.5 : 0.9);
  } else if (kind === 'irregular' || kind === 'dwarf') {
    const q = spec.q ?? 0.6;
    if (kind === 'dwarf') {
      for (let i = 0; i < N; i++) {
        const r = plummer(rng, R * 0.32, R * 1.1);
        rng.dir(tmpDir);
        P(tmpDir[0] * r, tmpDir[1] * r * q, tmpDir[2] * r * (0.6 + q * 0.4), jitter(OLD, rng, 0.08), s0 * rng.range(0.6, 1.1), 0.7);
      }
    } else {
      const nCl = 6 + rng.int(6);
      const clumps = [];
      for (let k = 0; k < nCl; k++) {
        clumps.push({ x: rng.gauss() * R * 0.35, y: rng.gauss() * R * 0.07, z: rng.gauss() * R * 0.25, s: R * rng.range(0.05, 0.15), w: rng.range(0.4, 1) });
      }
      const nBar = spec.bar ? Math.floor(N * 0.22) : 0;
      for (let i = 0; i < nBar; i++) {
        P(rng.gauss() * R * 0.28 - R * 0.06, rng.gauss() * R * 0.04, rng.gauss() * R * 0.07, jitter(DISKC, rng, 0.08), s0 * rng.range(0.8, 1.3), 1.15);
      }
      const nClP = Math.floor((N - nBar) * 0.55);
      for (let i = 0; i < nClP; i++) {
        const c = clumps[rng.int(nCl)];
        const u = rng.next();
        const hii = u < (spec.starburst ? 0.25 : 0.1);
        P(c.x + rng.gauss() * c.s, c.y + rng.gauss() * c.s * 0.4, c.z + rng.gauss() * c.s,
          jitter(hii ? HII : u < 0.6 ? YOUNG : WHITE, rng, 0.12), s0 * rng.range(0.4, 0.9) * (hii ? 0.7 : 1), hii ? 2.2 : 1.0);
      }
      for (let i = 0; i < N - nBar - nClP; i++) {
        P(rng.gauss() * R * 0.4, rng.gauss() * R * 0.09, rng.gauss() * R * 0.3, jitter(DISKC, rng, 0.08), s0 * rng.range(0.8, 1.4), 0.6);
      }
      for (let i = 0; i < N * 0.08; i++) {
        D(rng.gauss() * R * 0.3, rng.gauss() * R * 0.03, rng.gauss() * R * 0.22, s0 * rng.range(0.6, 1.2), 0.25);
      }
    }
  } else if (kind === 'starburst') {
    const thick = R * 0.035;
    for (let i = 0; i < N * 0.7; i++) {
      const r = expDisk(rng, R * 0.22, 0, R * 1.0);
      const th = rng.next() * Math.PI * 2;
      const core = r < R * 0.15;
      P(r * Math.cos(th), rng.gauss() * thick * (core ? 1.4 : 1), r * Math.sin(th) * 0.9, jitter(core ? [1, 0.95, 0.85] : WHITE, rng, 0.1), s0 * rng.range(0.7, 1.2), core ? 1.5 : 0.85);
    }
    for (let i = 0; i < N * 0.3; i++) {
      const side = rng.next() < 0.5 ? -1 : 1;
      const h = Math.abs(rng.gauss()) * R * 0.45 + R * 0.02;
      const rad = (R * 0.05 + h * 0.55) * Math.sqrt(rng.next());
      const th = rng.next() * Math.PI * 2;
      const fil = 0.6 + 0.4 * Math.sin(th * 7 + h / R * 20);
      P(rad * Math.cos(th), side * h, rad * Math.sin(th), jitter([1.0, 0.24, 0.3], rng, 0.15), s0 * rng.range(0.5, 1.0), 0.75 * fil);
    }
    for (let i = 0; i < N * 0.3; i++) {
      const r = expDisk(rng, R * 0.25, 0, R * 0.8);
      const th = rng.next() * Math.PI * 2;
      D(r * Math.cos(th), rng.gauss() * thick * 0.4, r * Math.sin(th) * 0.9, s0 * rng.range(0.6, 1.3), 0.5);
    }
  } else if (kind === 'sombrero') {
    addBulge(Math.floor(N * 0.55), R * 0.1, R * 0.7, 0.75, 1.15);
    for (let i = 0; i < N * 0.35; i++) {
      const r = R * 0.68 + rng.gauss() * R * 0.13;
      const th = rng.next() * Math.PI * 2;
      P(r * Math.cos(th), rng.gauss() * R * 0.012, r * Math.sin(th), jitter(DISKC, rng, 0.08), s0 * rng.range(0.7, 1.2), 0.8);
    }
    for (let i = 0; i < N * 0.32; i++) {
      const r = R * 0.74 + rng.gauss() * R * 0.05;
      const th = rng.next() * Math.PI * 2;
      D(r * Math.cos(th), rng.gauss() * R * 0.006, r * Math.sin(th), s0 * rng.range(0.6, 1.1), 0.7);
    }
    const nGc = Math.floor(N * 0.03);
    for (let i = 0; i < nGc; i++) {
      const r = plummer(rng, R * 0.5, R * 1.6);
      rng.dir(tmpDir);
      P(tmpDir[0] * r, tmpDir[1] * r, tmpDir[2] * r, [1, 0.9, 0.7], s0 * 0.25, 1.6);
    }
  } else if (kind === 'ring') {
    const perfect = !!spec.perfect;
    addBulge(Math.floor(N * (perfect ? 0.25 : 0.12)), R * (perfect ? 0.05 : 0.025), R * (perfect ? 0.3 : 0.12), 0.8, 1.3);
    const nRing = Math.floor(N * 0.55);
    const knots = [];
    for (let k = 0; k < 40; k++) knots.push(rng.next() * Math.PI * 2);
    for (let i = 0; i < nRing; i++) {
      let th = rng.next() * Math.PI * 2;
      if (!perfect && rng.next() < 0.4) th = knots[rng.int(knots.length)] + rng.gauss() * 0.04;
      const rr = R * (perfect ? 0.82 : 0.9) + rng.gauss() * R * (perfect ? 0.055 : 0.045) * (perfect ? 1 : 1 + 0.6 * Math.sin(th * 3));
      const u = rng.next();
      const c = u < (perfect ? 0.04 : 0.16) ? HII : u < 0.75 ? YOUNG : WHITE;
      P(rr * Math.cos(th), rng.gauss() * R * 0.012, rr * Math.sin(th) * (perfect ? 1 : 0.92), jitter(c, rng, 0.12), s0 * rng.range(0.5, 1.0), c === HII ? 2 : 1);
    }
    if (!perfect) {
      for (let i = 0; i < N * 0.08; i++) {
        const r = R * 0.28 + rng.gauss() * R * 0.03;
        const th = rng.next() * Math.PI * 2;
        P(r * Math.cos(th), rng.gauss() * R * 0.01, r * Math.sin(th), jitter(DISKC, rng, 0.1), s0 * 0.8, 1);
      }
      for (let i = 0; i < N * 0.12; i++) {
        const k = rng.int(9);
        const th = (k / 9) * Math.PI * 2 + rng.gauss() * 0.05;
        const r = R * rng.range(0.3, 0.85);
        P(r * Math.cos(th + r / R * 0.4), rng.gauss() * R * 0.01, r * Math.sin(th + r / R * 0.4), DISKC, s0 * 0.8, 0.35);
      }
    } else {
      for (let i = 0; i < N * 0.04; i++) {
        const r = R * rng.range(0.25, 0.7);
        const th = rng.next() * Math.PI * 2;
        P(r * Math.cos(th), rng.gauss() * R * 0.01, r * Math.sin(th), DISKC, s0 * 0.8, 0.12);
      }
    }
  } else if (kind === 'merger') {
    const r2 = R * 0.075;
    const cores = [
      { x: -R * 0.05, z: R * 0.02, tilt: 0.4 },
      { x: R * 0.05, z: -R * 0.02, tilt: -0.6 },
    ];
    for (const c of cores) {
      for (let i = 0; i < N * 0.28; i++) {
        const r = expDisk(rng, r2 * 0.35, 0, r2);
        const th = rng.next() * Math.PI * 2;
        const x = r * Math.cos(th), z = r * Math.sin(th);
        const u = rng.next();
        const col = r < r2 * 0.25 ? OLD : u < 0.12 ? HII : u < 0.6 ? YOUNG : WHITE;
        P(c.x + x, z * Math.sin(c.tilt) + rng.gauss() * r2 * 0.05, c.z + z * Math.cos(c.tilt), jitter(col, rng, 0.12), r2 * 0.12 * rng.range(0.5, 1.1), col === HII ? 2.4 : 1.15);
      }
    }
    // Gezeitenschweife
    const tails = [
      { x: -R * 0.05, z: R * 0.02, a0: 2.2, curv: 1.3, len: 0.95 },
      { x: R * 0.05, z: -R * 0.02, a0: -0.9, curv: 1.1, len: 0.85 },
    ];
    for (const t of tails) {
      for (let i = 0; i < N * 0.18; i++) {
        const s = Math.pow(rng.next(), 0.8);
        const a = t.a0 + t.curv * s;
        const rr = R * t.len * s;
        const sig = R * (0.01 + 0.035 * s);
        P(t.x + rr * Math.cos(a) + rng.gauss() * sig, rng.gauss() * sig * 0.6, t.z + rr * Math.sin(a) + rng.gauss() * sig,
          jitter(rng.next() < 0.8 ? YOUNG : WHITE, rng, 0.1), r2 * 0.18 * rng.range(0.6, 1.2), 0.5 * (1 - 0.6 * s));
      }
    }
    for (let i = 0; i < N * 0.06; i++) {
      D(rng.gauss() * R * 0.03, rng.gauss() * R * 0.006, rng.gauss() * R * 0.02, r2 * 0.12, 0.45);
    }
  }

  return { stars: stars.done(), dust: dust.done() };
}

function addJet(rng, P, R, s0, lenK) {
  const L = R * lenK;
  for (let i = 0; i < 2500; i++) {
    const t = Math.pow(rng.next(), 0.7);
    const h = R * 0.01 + t * L;
    const w = R * 0.004 + t * L * 0.035;
    const knot = 0.6 + 0.8 * Math.max(0, Math.sin(t * 28));
    P(rng.gauss() * w, h, rng.gauss() * w, [0.55, 0.75, 1.0], s0 * 0.35, 3.0 * knot * (1 - t * 0.6));
    if (i % 5 === 0) P(rng.gauss() * w, -h * 0.6, rng.gauss() * w, [0.55, 0.75, 1.0], s0 * 0.35, 0.8 * (1 - t));
  }
}
