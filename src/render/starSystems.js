import * as THREE from 'three';
import { CATALOG, BY_ID } from '../data/catalog.js';
import { GC_POS } from '../core/coords.js';
import { AU_LY, KM_LY, R_SUN_LY, fmtNum, fmtLy } from '../core/units.js';
import { mulberry32, hashString, kelvinToRGB } from '../core/rng.js';
import { makePlanetMaterial, makeAtmosphereMaterial, makeRingMaterial, makeStarSurfaceMaterial } from './materials.js';
import { makeStarMaterial, makeGlowSprite } from './shaders.js';
import { EN } from '../i18n.js';

// ---------------------------------------------------------------------------
// Sterne überall in der Milchstraße & Planetensysteme für jeden Stern.
// ---------------------------------------------------------------------------
const J2000 = Date.UTC(2000, 0, 1, 12);
const tmpQ = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();
const tmpM = new THREE.Matrix4();
const Y = new THREE.Vector3(0, 1, 0);

function hash3(i, j, k) {
  let h = Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ Math.imul(k, 83492791);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

function classOf(T) {
  return T > 30000 ? 'O' : T > 10000 ? 'B' : T > 7500 ? 'A' : T > 6000 ? 'F' : T > 5200 ? 'G' : T > 3700 ? 'K' : 'M';
}

function starObject(id, name, pos, lum, T, extra = {}) {
  const rSun = Math.max(0.1, Math.sqrt(lum) * (5772 / T) ** 2);
  const cls = classOf(T);
  const de = { O: 'blauer Riese', B: 'blau-weißer Stern', A: 'weißer Stern', F: 'gelb-weißer Stern', G: 'sonnenähnlicher gelber Stern', K: 'orangefarbener Stern', M: 'Roter Zwerg' }[cls];
  const en = { O: 'blue giant', B: 'blue-white star', A: 'white star', F: 'yellow-white star', G: 'Sun-like yellow star', K: 'orange star', M: 'red dwarf' }[cls];
  return {
    id, name, cat: 'star', type: (EN ? 'Star · class ' : 'Stern · Klasse ') + cls, pos, lum, tempK: T, radius: rSun * R_SUN_LY,
    dynamic: true, importance: 2, labelMax: 40, view: { r: rSun * R_SUN_LY * 6, pitch: 12 },
    desc: EN
      ? `A ${en} with ${fmtNum(lum, lum < 1 ? 3 : 1)} times the Sun's luminosity. Fly closer to discover its planetary system.`
      : `Ein ${de} mit der ${fmtNum(lum, lum < 1 ? 3 : 1)}-fachen Leuchtkraft der Sonne. Fliege näher heran, um sein Planetensystem zu entdecken.`,
    facts: EN
      ? [['Spectral class', cls], ['Temperature', fmtNum(Math.round(T / 10) * 10, 0) + ' K'], ['Radius', fmtNum(rSun, 2) + ' Suns'], ['Luminosity', fmtNum(lum, lum < 1 ? 3 : 1) + ' Suns']]
      : [['Spektralklasse', cls], ['Temperatur', fmtNum(Math.round(T / 10) * 10, 0) + ' K'], ['Radius', fmtNum(rSun, 2) + ' Sonnen'], ['Leuchtkraft', fmtNum(lum, lum < 1 ? 3 : 1) + ' Sonnen']],
    ...extra,
  };
}

// Echte Sterne (HYG) über ein räumliches Gitter durchsuchbar machen
class HygIndex {
  constructor(hyg) {
    this.hyg = hyg;
    this.cell = 25;
    this.map = new Map();
    const n = hyg.length / 5;
    for (let i = 0; i < n; i++) {
      const k = this.key(Math.floor(hyg[i * 5] / this.cell), Math.floor(hyg[i * 5 + 1] / this.cell), Math.floor(hyg[i * 5 + 2] / this.cell));
      let a = this.map.get(k);
      if (!a) this.map.set(k, (a = []));
      a.push(i);
    }
    this.objs = new Map();
  }
  key(i, j, k) { return `${i},${j},${k}`; }
  nearest(p, maxD, out) {
    const c = this.cell, r = Math.ceil(maxD / c);
    const ci = Math.floor(p.x / c), cj = Math.floor(p.y / c), ck = Math.floor(p.z / c);
    const H = this.hyg;
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let d = -r; d <= r; d++) {
      const list = this.map.get(this.key(ci + a, cj + b, ck + d));
      if (!list) continue;
      for (const i of list) {
        const dx = H[i * 5] - p.x, dy = H[i * 5 + 1] - p.y, dz = H[i * 5 + 2] - p.z;
        const dd = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dd < maxD && H[i * 5 + 3] > 0) out.push([dd, i]);
      }
    }
  }
  object(i) {
    let o = this.objs.get(i);
    if (o) return o;
    const H = this.hyg;
    const ci = Math.min(2, Math.max(-0.4, H[i * 5 + 4]));
    const T = 4600 * (1 / (0.92 * ci + 1.7) + 1 / (0.92 * ci + 0.62));
    o = starObject('hygstar-' + i, 'HYG ' + i, new THREE.Vector3(H[i * 5], H[i * 5 + 1], H[i * 5 + 2]), H[i * 5 + 3], T);
    this.objs.set(i, o);
    return o;
  }
}

// Prozedurale Sterne überall in der Milchstraßenscheibe
const STAR_CELL = 40;
const STAR_RADIUS_CELLS = 3;
const MAX_STREAM = 9000;
const CLASSES = [
  [0.0008, 'B', [11000, 25000], [100, 20000]],
  [0.02, 'A', [7500, 10000], [6, 40]],
  [0.06, 'F', [6000, 7500], [1.5, 6]],
  [0.1, 'G', [5300, 6000], [0.6, 1.5]],
  [0.2, 'K', [3900, 5200], [0.1, 0.6]],
  [0.6, 'M', [2600, 3800], [0.001, 0.08]],
];

export class StarStream {
  constructor(world) {
    this.cache = new Map();
    this.list = [];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_STREAM * 3), 3));
    g.setAttribute('acolor', new THREE.BufferAttribute(new Float32Array(MAX_STREAM * 3), 3));
    g.setAttribute('lum', new THREE.BufferAttribute(new Float32Array(MAX_STREAM), 1));
    g.setDrawRange(0, 0);
    this.points = new THREE.Points(g, makeStarMaterial({ magLimit: 9.0, nearHide: 0.02 }));
    this.points.frustumCulled = false;
    this.anchor = new THREE.Vector3();
    world.add(this.points, this.anchor, 1);
    this.camCell = null;
  }
  density(x, y, z) {
    const dx = x - GC_POS.x, dz = z - GC_POS.z, dy = y - GC_POS.y;
    const R = Math.hypot(dx, dz);
    let rho = Math.exp(-(R - 26670) / 8500) * Math.exp(-Math.abs(dy) / 900);
    if (R < 5000) rho *= 1 + 3 * (1 - R / 5000);
    // Spiralarm-Verdichtung (grob, wie im Galaxienmodell)
    const th = Math.atan2(dz, dx);
    const arm = 0.5 + 0.5 * Math.cos(2 * (th - Math.log(Math.max(R, 1000) / 52000) / Math.tan(0.227)));
    return rho * (0.6 + 0.8 * arm * arm);
  }
  cellStars(i, j, k) {
    const key = `${i},${j},${k}`;
    let list = this.cache.get(key);
    if (list) return list;
    list = [];
    const cx = (i + 0.5) * STAR_CELL, cy = (j + 0.5) * STAR_CELL, cz = (k + 0.5) * STAR_CELL;
    // Sonnenumgebung: dort gibt es den echten Katalog
    if (Math.hypot(cx, cy, cz) > 650) {
      const rho = this.density(cx, cy, cz);
      const lambda = Math.min(260, 22 * rho);
      const rnd = mulberry32(hash3(i, j, k) ^ 0x9e3779b9);
      let n = Math.round(lambda + Math.sqrt(lambda) * (rnd() + rnd() - 1));
      for (let s = 0; s < n; s++) {
        let u = rnd(), c = CLASSES[CLASSES.length - 1];
        for (const cl of CLASSES) { if ((u -= cl[0]) <= 0) { c = cl; break; } }
        const T = c[2][0] + (c[2][1] - c[2][0]) * rnd();
        const L = c[3][0] * Math.pow(c[3][1] / c[3][0], rnd());
        const pos = new THREE.Vector3(i * STAR_CELL + rnd() * STAR_CELL, j * STAR_CELL + rnd() * STAR_CELL, k * STAR_CELL + rnd() * STAR_CELL);
        const seed = hash3(i * 977 + s, j * 131 - s, k * 37 + s * 11);
        list.push({ seed, pos, T, L });
      }
    }
    if (this.cache.size > 3000) this.cache.clear();
    this.cache.set(key, list);
    return list;
  }
  object(st) {
    if (st.obj) return st.obj;
    const name = `KOS-S ${String(st.seed % 1000000).padStart(6, '0')}`;
    st.obj = starObject('kstar-' + st.seed, name, st.pos, st.L, st.T);
    return st.obj;
  }
  update(camPos, viewR) {
    const dSun = camPos.length();
    const dGC = camPos.distanceTo(GC_POS);
    const active = viewR < 4000 && dSun > 450 && dGC < 70000;
    this.points.visible = active;
    if (!active) { this.list = []; this.camCell = null; return; }
    const ci = Math.floor(camPos.x / STAR_CELL), cj = Math.floor(camPos.y / STAR_CELL), ck = Math.floor(camPos.z / STAR_CELL);
    const key = `${ci},${cj},${ck}`;
    if (key === this.camCell) return;
    this.camCell = key;
    this.anchor.set((ci + 0.5) * STAR_CELL, (cj + 0.5) * STAR_CELL, (ck + 0.5) * STAR_CELL);
    const list = [];
    const R2 = STAR_RADIUS_CELLS * STAR_RADIUS_CELLS;
    for (let a = -STAR_RADIUS_CELLS; a <= STAR_RADIUS_CELLS; a++) for (let b = -STAR_RADIUS_CELLS; b <= STAR_RADIUS_CELLS; b++) for (let c = -STAR_RADIUS_CELLS; c <= STAR_RADIUS_CELLS; c++) {
      if (a * a + b * b + c * c > R2) continue;
      for (const st of this.cellStars(ci + a, cj + b, ck + c)) { if (list.length < MAX_STREAM) list.push(st); }
    }
    this.list = list;
    const g = this.points.geometry;
    const P = g.attributes.position.array, C = g.attributes.acolor.array, Lm = g.attributes.lum.array;
    list.forEach((st, i) => {
      P[i * 3] = st.pos.x - this.anchor.x; P[i * 3 + 1] = st.pos.y - this.anchor.y; P[i * 3 + 2] = st.pos.z - this.anchor.z;
      const col = kelvinToRGB(st.T);
      C[i * 3] = col[0]; C[i * 3 + 1] = col[1]; C[i * 3 + 2] = col[2];
      Lm[i] = st.L;
    });
    for (const n of ['position', 'acolor', 'lum']) g.attributes[n].needsUpdate = true;
    g.setDrawRange(0, list.length);
  }
  nearest(p, maxD, out) {
    for (const st of this.list) {
      const d = p.distanceTo(st.pos);
      if (d < maxD) out.push([d, st]);
    }
  }
}

// ---------------------------------------------------------------------------
// Planetensystem-Generator
// ---------------------------------------------------------------------------
const TYPE_INFO = {
  lava: { de: 'Lavawelt', en: 'Lava world', atmo: null, hab: 0 },
  barren: { de: 'Karge Felswelt', en: 'Barren rock world', atmo: null, hab: 2 },
  desert: { de: 'Wüstenwelt', en: 'Desert world', atmo: [1.0, 0.65, 0.35], hab: 12 },
  toxic: { de: 'Giftige Treibhauswelt', en: 'Toxic greenhouse world', atmo: [0.85, 0.95, 0.3], hab: 1 },
  terra: { de: 'Erdähnliche Welt', en: 'Earth-like world', atmo: [0.35, 0.6, 1.0], hab: 85 },
  ocean: { de: 'Ozeanwelt', en: 'Ocean world', atmo: [0.3, 0.6, 1.0], hab: 60 },
  jungle: { de: 'Dschungelwelt', en: 'Jungle world', atmo: [0.45, 0.85, 0.75], hab: 75 },
  ice: { de: 'Eiswelt', en: 'Ice world', atmo: [0.7, 0.85, 1.0], hab: 6 },
  gas: { de: 'Gasriese', en: 'Gas giant', atmo: null, hab: 0 },
  icegiant: { de: 'Eisriese', en: 'Ice giant', atmo: [0.5, 0.85, 1.0], hab: 0 },
};

function hsl(h, s, l) { const c = new THREE.Color().setHSL(((h % 1) + 1) % 1, s, l); return [c.r, c.g, c.b]; }

function paletteFor(type, rnd) {
  const h = rnd();
  switch (type) {
    case 'lava': return [[0.1, 0.08, 0.07], [0.2, 0.15, 0.12], [0.3, 0.1, 0.05]];
    case 'barren': return [hsl(0.06 + h * 0.08, 0.15, 0.32), hsl(0.08 + h * 0.06, 0.12, 0.55), [0.3, 0.3, 0.3]];
    case 'desert': return [hsl(0.05 + h * 0.06, 0.55, 0.42), hsl(0.08 + h * 0.05, 0.5, 0.62), hsl(0.02, 0.5, 0.3)];
    case 'toxic': return [hsl(0.16 + h * 0.08, 0.6, 0.45), hsl(0.2 + h * 0.08, 0.5, 0.62), hsl(0.12, 0.55, 0.35)];
    case 'terra': return [hsl(0.6 + h * 0.03, 0.7, 0.32), hsl(0.28 + h * 0.06, 0.5, 0.3), hsl(0.1, 0.4, 0.45)];
    case 'ocean': return [hsl(0.52 + h * 0.1, 0.75, 0.35), hsl(0.3 + h * 0.1, 0.4, 0.45), [0.9, 0.9, 0.9]];
    case 'jungle': return [hsl(0.55 + h * 0.1, 0.6, 0.3), hsl(h < 0.5 ? 0.78 + h * 0.1 : 0.3 + h * 0.1, 0.6, 0.35), hsl(0.9 + h * 0.1, 0.5, 0.4)];
    case 'ice': return [hsl(0.55 + h * 0.05, 0.35, 0.75), [0.9, 0.95, 1.0], [0.3, 0.5, 0.8]];
    case 'gas': return [hsl(h, 0.45, 0.6), hsl(h + 0.05, 0.5, 0.42), hsl(h + 0.5, 0.35, 0.7)];
    case 'icegiant': return [hsl(0.5 + h * 0.12, 0.5, 0.6), hsl(0.52 + h * 0.12, 0.55, 0.5), hsl(0.6, 0.4, 0.7)];
    default: return [[0.5, 0.5, 0.5], [0.6, 0.6, 0.6], [0.3, 0.3, 0.3]];
  }
}

function generatePlanets(star) {
  const rnd = mulberry32(hashString(star.id + '-sys'));
  const L = Math.max(1e-4, star.lum);
  const M = Math.min(30, Math.max(0.08, Math.pow(L, 0.25)));
  const count = Math.max(1, Math.round((L < 0.05 ? 2 : 3) + rnd() * (L < 0.05 ? 4 : 6)));
  const snow = 2.7 * Math.sqrt(L);
  let a = (0.04 + rnd() * 0.12) * Math.sqrt(L) + 0.008;
  const planets = [];
  const letters = 'bcdefghijk';
  for (let i = 0; i < count; i++) {
    a *= i === 0 ? 1 : 1.45 + rnd() * 0.7;
    const Teq = (278 * Math.pow(L, 0.25)) / Math.sqrt(a);
    const u = rnd();
    let type;
    if (a > snow) type = u < 0.68 ? 'gas' : 'icegiant';
    else if (Teq > 750) type = 'lava';
    else if (Teq > 420) type = u < 0.5 ? 'desert' : u < 0.8 ? 'barren' : 'toxic';
    else if (Teq > 330) type = u < 0.45 ? 'desert' : u < 0.8 ? 'toxic' : 'barren';
    else if (Teq > 220) type = u < 0.3 ? 'terra' : u < 0.62 ? 'ocean' : u < 0.88 ? 'jungle' : 'desert';
    else type = u < 0.6 ? 'ice' : 'barren';
    const rKm = { lava: 2500 + rnd() * 5000, barren: 1500 + rnd() * 5500, desert: 3500 + rnd() * 5000, toxic: 5000 + rnd() * 3500, terra: 4800 + rnd() * 3500,
      ocean: 5000 + rnd() * 5000, jungle: 4500 + rnd() * 4000, ice: 2500 + rnd() * 5000, gas: 40000 + rnd() * 45000, icegiant: 20000 + rnd() * 10000 }[type];
    const P = 365.25 * Math.sqrt((a * a * a) / M);
    const info = TYPE_INFO[type];
    const gravity = type === 'gas' || type === 'icegiant' ? (rKm / 6371) * 0.25 : (rKm / 6371) * (0.8 + rnd() * 0.4);
    planets.push({
      letter: letters[i], type, a, P, L0: rnd() * 360, rKm, Teq, gravity,
      ring: (type === 'gas' && rnd() < 0.45) || (type === 'icegiant' && rnd() < 0.25),
      tilt: rnd() * 40 - 20, rotH: 8 + rnd() * 50, palette: paletteFor(type, rnd), seed: [rnd() * 60, rnd() * 60, rnd() * 60],
      moons: type === 'gas' ? Math.floor(rnd() * 40) : type === 'icegiant' ? Math.floor(rnd() * 15) : Math.floor(rnd() * 3),
      hab: Math.max(0, Math.round(info.hab * (1 - Math.min(1, Math.abs(Teq - 288) / 90)) + (info.hab > 50 ? rnd() * 10 : 0))),
    });
  }
  // Bahnebene des Systems
  const n = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
  return { planets, normal: n };
}

export class SystemManager {
  constructor(app, hyg) {
    this.app = app;
    this.world = app.world;
    this.index = new HygIndex(hyg);
    this.stream = new StarStream(app.world);
    this.system = null;
    this.nearbyStars = [];
    this.objects = [];
    // Diese Sterne haben bereits echte bzw. eigene Systeme
    this.skip = new Set(['sun', 'proxima', 'trappist1']);
  }

  starCandidates(p, maxD) {
    const out = [];
    this.index.nearest(p, maxD, out);
    const res = out.map(([d, i]) => [d, this.index.object(i)]);
    const s = [];
    this.stream.nearest(p, maxD, s);
    for (const [d, st] of s) res.push([d, this.stream.object(st)]);
    for (const o of CATALOG) {
      if (o.cat !== 'star' || o.dynamic) continue;
      const d = p.distanceTo(o.pos);
      if (d < maxD) res.push([d, o]);
    }
    res.sort((a, b) => a[0] - b[0]);
    return res;
  }

  buildSystem(star) {
    const { planets, normal } = generatePlanets(star);
    const solar = this.app.solar;
    const e1 = new THREE.Vector3().crossVectors(Math.abs(normal.y) < 0.9 ? Y : new THREE.Vector3(1, 0, 0), normal).normalize();
    const e2 = new THREE.Vector3().crossVectors(normal, e1).normalize();
    const sys = { star, bodies: [], items: [], e1, e2, normal };
    const lc = kelvinToRGB(star.tempK || 5772);
    const lm = Math.max(...lc);
    // Stern-Körper für Sterne ohne eigenes Modell
    if (star.dynamic) {
      const col = kelvinToRGB(star.tempK);
      const body = new THREE.Mesh(solar.sphere, makeStarSurfaceMaterial(col, star.tempK < 4000 ? 0.4 : 0, star.radius > 7e-6 ? 5 : 9));
      const glow = makeGlowSprite(new THREE.Color(...col), 0.45);
      sys.items.push(this.world.add(body, star.pos, star.radius), this.world.add(glow, star.pos, star.radius * 7));
    }
    const circle = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 256 }, (_, i) => new THREE.Vector3(Math.cos((i / 256) * Math.PI * 2), 0, Math.sin((i / 256) * Math.PI * 2))));
    const lineQ = new THREE.Quaternion().setFromRotationMatrix(tmpM.makeBasis(e1, normal, new THREE.Vector3().crossVectors(e1, normal)));
    for (const pl of planets) {
      const info = TYPE_INFO[pl.type];
      const name = `${star.name} ${pl.letter}`;
      const R = pl.rKm * KM_LY;
      const group = new THREE.Group();
      const mat = makePlanetMaterial(pl.type, ...pl.palette);
      mat.uniforms.uSeed.value.set(...pl.seed);
      mat.uniforms.uLightColor.value.setRGB(lc[0] / lm, lc[1] / lm, lc[2] / lm);
      const body = new THREE.Mesh(solar.sphere, mat);
      group.add(body);
      const mats = [mat];
      if (info.atmo) {
        const atmo = new THREE.Mesh(solar.sphereLo, makeAtmosphereMaterial(info.atmo, pl.type === 'toxic' ? 1.8 : 2.6));
        atmo.scale.setScalar(pl.type === 'toxic' ? 1.05 : 1.03);
        group.add(atmo);
        mats.push(atmo.material);
      }
      let ring = null;
      if (pl.ring) {
        ring = new THREE.Mesh(new THREE.RingGeometry(1.3, 2.3, 256, 4), makeRingMaterial());
        ring.rotation.x = -Math.PI / 2;
        group.add(ring);
      }
      const axis = normal.clone().applyAxisAngle(e1, (pl.tilt * Math.PI) / 180).normalize();
      group.quaternion.setFromUnitVectors(Y, axis);
      const o = {
        id: `${star.id}-${pl.letter}`, name, cat: 'planet', type: EN ? info.en : info.de, radius: R, pos: new THREE.Vector3(), dynamic: true, exo: true,
        lightObj: star, parent: star.id, importance: 4, labelMax: pl.a * AU_LY * 60, view: { r: R * (pl.ring ? 6 : 3.4), pitch: 15 },
        planet: pl,
        desc: describePlanet(pl, star, name),
        facts: planetFacts(pl),
      };
      this.world.add(group, o.pos, R);
      sys.items.push({ obj: group });
      const pt = solar.singleStar(lc.map((v) => v / lm), 1e-13 * (R / (6371 * KM_LY)) ** 2, R, 13);
      this.world.add(pt, o.pos, 1);
      sys.items.push({ obj: pt });
      const line = new THREE.LineLoop(circle, new THREE.LineBasicMaterial({ color: 0x5fd8ff, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }));
      line.quaternion.copy(lineQ);
      line.frustumCulled = false;
      this.world.add(line, star.pos, pl.a * AU_LY);
      sys.items.push({ obj: line });
      sys.bodies.push({ o, pl, group, body, mats, ring, axis, line });
    }
    this.system = sys;
    this.objects = sys.bodies.map((b) => b.o);
    this.app.hud.toast(EN ? `Star system <b>${star.name}</b> scanned: ${planets.length} planets` : `Sternsystem <b>${star.name}</b> gescannt: ${planets.length} Planeten`);
  }

  disposeSystem() {
    const sys = this.system;
    if (!sys) return;
    for (const it of sys.items) {
      this.world.remove(it.obj);
      it.obj.traverse?.((x) => { if (x.material) x.material.dispose?.(); });
    }
    this.system = null;
    this.objects = [];
  }

  update(camPos, viewR, dateMs, k) {
    this.stream.update(camPos, viewR);
    // Nächstgelegene Sterne für Beschriftung & Anklicken
    if (viewR < 400) {
      const c = this.starCandidates(camPos, Math.min(60, viewR * 0.8 + 8));
      this.nearbyStars = c.filter(([, o]) => o.dynamic).slice(0, 10).map(([, o]) => o);
    } else this.nearbyStars = [];
    // Planetensystem in der Nähe eines Sterns erzeugen
    const sys = this.system;
    if (sys && camPos.distanceTo(sys.star.pos) > 1.5) this.disposeSystem();
    if (!this.system && viewR < 0.6) {
      const c = this.starCandidates(camPos, 0.35);
      const hit = c.find(([, o]) => !this.skip.has(o.id));
      if (hit) this.buildSystem(hit[1]);
    }
    if (!this.system) return;
    const d = (dateMs - J2000) / 86400000;
    const s = this.system;
    const show = this.app.settings.orbits && !document.body.classList.contains('ui-off');
    for (const b of s.bodies) {
      const th = ((b.pl.L0 + (360 * d) / b.pl.P) * Math.PI) / 180;
      const a = b.pl.a * AU_LY;
      b.o.pos.copy(s.star.pos).addScaledVector(s.e1, Math.cos(th) * a).addScaledVector(s.e2, Math.sin(th) * a);
      const spin = ((d * 24) / b.pl.rotH) * Math.PI * 2;
      b.body.rotation.y = spin % (Math.PI * 2);
      const toStar = new THREE.Vector3().subVectors(s.star.pos, b.o.pos).normalize();
      for (const m of b.mats) m.uniforms.uSunDir.value.copy(toStar);
      tmpQ.copy(b.group.quaternion).multiply(tmpQ2.setFromAxisAngle(Y, b.body.rotation.y));
      b.mats[0].uniforms.uRot.value.setFromMatrix4(tmpM.makeRotationFromQuaternion(tmpQ));
      if (b.ring) {
        const u = b.ring.material.uniforms;
        u.uSunDir.value.copy(toStar);
        u.uNormal.value.copy(b.axis);
        u.uCenter.value.subVectors(b.o.pos, camPos).multiplyScalar(k);
        u.uPlanetR.value = b.o.radius * k;
      }
      const near = camPos.distanceTo(b.o.pos);
      const op = 0.22 * smooth(b.o.radius * 8, b.o.radius * 60, near) * (1 - smooth(a * 30, a * 120, camPos.distanceTo(s.star.pos)));
      b.line.visible = show && op > 0.003;
      b.line.material.opacity = op;
      b.group.visible = near < b.o.radius * 2e5;
    }
  }
}

function describePlanet(pl, star, name) {
  const t = Math.round(pl.Teq - 273);
  const DE = {
    lava: `${name} kreist so nah um seinen Stern, dass die Oberfläche geschmolzen ist: Ströme aus glühendem Gestein durchziehen eine schwarze Kruste.`,
    barren: `${name} ist eine luftlose, von Kratern übersäte Felswelt – still, kalt und seit Milliarden Jahren unverändert.`,
    desert: `${name} ist eine Wüstenwelt aus endlosen Dünen und tiefen Canyons, über die heiße Winde fegen.`,
    toxic: `${name} ist in eine dichte, giftige Atmosphäre gehüllt. Ein außer Kontrolle geratener Treibhauseffekt heizt die Oberfläche auf.`,
    terra: `${name} liegt in der habitablen Zone: Ozeane, Kontinente und Wolken – eine Welt, die der Erde verblüffend ähnelt.`,
    ocean: `${name} ist fast vollständig von einem globalen Ozean bedeckt, nur vereinzelte Inselketten ragen aus dem Wasser.`,
    jungle: `${name} ist von dichter, fremdartiger Vegetation überzogen – üppige Kontinente unter einer feuchten, warmen Atmosphäre.`,
    ice: `${name} ist eine gefrorene Welt aus Gletschern und tiefblauen Eisspalten, weit draußen in der Kälte seines Systems.`,
    gas: `${name} ist ein Gasriese mit gewaltigen Sturmbändern${pl.ring ? ' und einem prächtigen Ringsystem' : ''}.`,
    icegiant: `${name} ist ein Eisriese aus Wasser, Ammoniak und Methan${pl.ring ? ', umgeben von zarten Ringen' : ''}.`,
  };
  const ENd = {
    lava: `${name} orbits so close to its star that its surface has melted: rivers of glowing rock cross a black crust.`,
    barren: `${name} is an airless, cratered rock world – silent, cold and unchanged for billions of years.`,
    desert: `${name} is a desert world of endless dunes and deep canyons swept by hot winds.`,
    toxic: `${name} is wrapped in a thick, toxic atmosphere. A runaway greenhouse effect bakes the surface.`,
    terra: `${name} lies in the habitable zone: oceans, continents and clouds – a world strikingly similar to Earth.`,
    ocean: `${name} is almost entirely covered by a global ocean; only scattered island chains rise above the water.`,
    jungle: `${name} is covered in dense, alien vegetation – lush continents under a warm, humid atmosphere.`,
    ice: `${name} is a frozen world of glaciers and deep blue crevasses, far out in the cold of its system.`,
    gas: `${name} is a gas giant with enormous storm bands${pl.ring ? ' and a magnificent ring system' : ''}.`,
    icegiant: `${name} is an ice giant of water, ammonia and methane${pl.ring ? ', surrounded by delicate rings' : ''}.`,
  };
  const tail = EN ? ` Equilibrium temperature ≈ ${t} °C. (Procedurally generated system.)` : ` Gleichgewichtstemperatur ≈ ${t} °C. (Prozedural erzeugtes System.)`;
  return (EN ? ENd : DE)[pl.type] + tail;
}

function planetFacts(pl) {
  const t = Math.round(pl.Teq - 273);
  const orbit = pl.P < 2 ? fmtNum(pl.P * 24, 1) + (EN ? ' hours' : ' Stunden') : pl.P < 800 ? fmtNum(pl.P, 1) + (EN ? ' days' : ' Tage') : fmtNum(pl.P / 365.25, 1) + (EN ? ' years' : ' Jahre');
  const atmo = TYPE_INFO[pl.type].atmo ? (EN ? 'yes' : 'ja') : (EN ? 'none' : 'keine');
  return EN
    ? [['Diameter', fmtNum(pl.rKm * 2, 0) + ' km'], ['Temperature', `≈ ${t} °C`], ['Gravity', fmtNum(pl.gravity, 2) + ' g'], ['Orbital period', orbit], ['Atmosphere', atmo], ['Moons', String(pl.moons)], ['Habitability', pl.hab + ' %']]
    : [['Durchmesser', fmtNum(pl.rKm * 2, 0) + ' km'], ['Temperatur', `≈ ${t} °C`], ['Schwerkraft', fmtNum(pl.gravity, 2) + ' g'], ['Umlaufzeit', orbit], ['Atmosphäre', atmo], ['Monde', String(pl.moons)], ['Lebensfreundlichkeit', pl.hab + ' %']];
}

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export { fmtLy };
