import * as THREE from 'three';
import { makePoints, setLod, shared } from './shaders.js';
import { mulberry32 } from '../core/rng.js';
import { BY_ID } from '../data/catalog.js';
import { galacticLB } from '../core/coords.js';
import { fmtNum, fmtLy } from '../core/units.js';
import { EN } from '../i18n.js';

// ---------------------------------------------------------------------------
// Unendliches Galaxienfeld: Überall im Universum entstehen rund um die Kamera
// echte Galaxien. Ihre Dichte folgt dem kosmischen Netz (Filamente, Haufen, Leerräume).
// Jede Galaxie ist deterministisch – sie sieht bei jedem Besuch gleich aus.
// ---------------------------------------------------------------------------
const MLY = 1e6;
const CELL = 3 * MLY;
const RADIUS_CELLS = 4;
const MAX_POINTS = 8000;
const MAX_DETAIL = 6;

function hash3(i, j, k) {
  let h = Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ Math.imul(k, 83492791);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

function poisson(lambda, rnd) {
  if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * (rnd() + rnd() + rnd() - 1.5) * 2));
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rnd(); } while (p > L);
  return k - 1;
}

// Dichtegitter aus den Punkten des kosmischen Netzes
class DensityGrid {
  constructor(positions, bin, rMin, rMax) {
    this.bin = bin;
    this.map = new Map();
    const n = positions.length / 3;
    for (let i = 0; i < n; i++) {
      const k = this.key(Math.floor(positions[i * 3] / bin), Math.floor(positions[i * 3 + 1] / bin), Math.floor(positions[i * 3 + 2] / bin));
      this.map.set(k, (this.map.get(k) || 0) + 1);
    }
    const vol = (4 / 3) * Math.PI * (rMax ** 3 - rMin ** 3);
    this.avg = Math.max(1e-6, (n / vol) * bin ** 3);
  }
  key(i, j, k) { return (i + 4096) * 67108864 + (j + 4096) * 8192 + (k + 4096); }
  get(x, y, z) {
    const b = this.bin;
    const i = Math.floor(x / b), j = Math.floor(y / b), k = Math.floor(z / b);
    let s = 0;
    for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) for (let d = -1; d <= 1; d++) s += this.map.get(this.key(i + a, j + c, k + d)) || 0;
    return s / 27 / this.avg;
  }
}

const COLORS = {
  spiral: [0.75, 0.82, 1.0], elliptical: [1.0, 0.82, 0.58], irregular: [0.62, 0.75, 1.0], dwarf: [0.95, 0.85, 0.7], lenticular: [1.0, 0.9, 0.75],
};
const TYPE_DE = { spiral: 'Spiralgalaxie', barred: 'Balkenspiralgalaxie', elliptical: 'Elliptische Galaxie', irregular: 'Irreguläre Galaxie', dwarf: 'Zwerggalaxie', lenticular: 'Linsenförmige Galaxie', giant: 'Elliptische Riesengalaxie' };
const TYPE_EN = { spiral: 'Spiral galaxy', barred: 'Barred spiral galaxy', elliptical: 'Elliptical galaxy', irregular: 'Irregular galaxy', dwarf: 'Dwarf galaxy', lenticular: 'Lenticular galaxy', giant: 'Giant elliptical galaxy' };

export class GalaxyField {
  constructor(world, quality, webData) {
    this.world = world;
    this.quality = quality;
    this.cache = new Map();
    this.list = [];
    this.nearby = [];
    this.details = new Map();
    this.pending = new Set();
    this.lg = BY_ID.get('localgroup').pos;
    this.local = new DensityGrid(webData.local, 8 * MLY, 0, 380 * MLY);
    this.mid = new DensityGrid(webData.mid, 40 * MLY, 330 * MLY, 4200 * MLY);
    // Punktwolke für alle Feldgalaxien in Reichweite (aus der Ferne)
    const data = {
      positions: new Float32Array(MAX_POINTS * 3), colors: new Float32Array(MAX_POINTS * 3),
      sizes: new Float32Array(MAX_POINTS), shapes: new Float32Array(MAX_POINTS * 2),
    };
    this.points = makePoints(data, { bright: 2.6, minPx: 1.0, maxPx: 90, fadeLarge: 70 });
    this.points.frustumCulled = false;
    this.points.geometry.setDrawRange(0, 0);
    this.anchor = new THREE.Vector3();
    this.item = world.add(this.points, this.anchor, 1);
    this.camCell = null;
    // Hintergrund-Thread
    try {
      this.worker = new Worker(new URL('./galaxyWorker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => this._onDetail(e.data);
    } catch { this.worker = null; }
  }

  density(x, y, z) {
    const r = Math.hypot(x, y, z);
    if (r < 370 * MLY) return this.local.get(x, y, z);
    if (r < 4.1e9) return this.mid.get(x, y, z) * 1.2;
    return 1;
  }

  cellGalaxies(i, j, k) {
    const key = `${i},${j},${k}`;
    let list = this.cache.get(key);
    if (list) return list;
    list = [];
    const cx = (i + 0.5) * CELL, cy = (j + 0.5) * CELL, cz = (k + 0.5) * CELL;
    const lg = this.lg;
    // Die echte Lokale Gruppe bleibt frei von erfundenen Galaxien
    if (Math.hypot(cx - lg.x, cy - lg.y, cz - lg.z) > 7.5 * MLY) {
      const rho = this.density(cx, cy, cz);
      const lambda = Math.min(22, 0.05 + 0.85 * rho);
      const rnd = mulberry32(hash3(i, j, k));
      const n = poisson(lambda, rnd);
      for (let g = 0; g < n; g++) {
        const seed = hash3(i * 31 + g, j * 17 - g, k * 13 + g * 7);
        const r2 = mulberry32(seed);
        const pos = new THREE.Vector3(i * CELL + r2() * CELL, j * CELL + r2() * CELL, k * CELL + r2() * CELL);
        const dense = rho > 3;
        const u = r2();
        let kind;
        if (r2() < 0.32) kind = 'dwarf';
        else if (dense) kind = u < 0.45 ? 'elliptical' : u < 0.62 ? 'lenticular' : u < 0.9 ? 'spiral' : 'irregular';
        else kind = u < 0.62 ? 'spiral' : u < 0.82 ? 'irregular' : u < 0.93 ? 'elliptical' : 'lenticular';
        let diam;
        if (kind === 'dwarf') diam = 3000 + r2() * 9000;
        else if (kind === 'irregular') diam = 8000 + r2() * 25000;
        else diam = 30000 * Math.exp((r2() - 0.4) * 1.3);
        if (kind === 'elliptical' && dense && r2() < 0.25) { diam *= 2.2; kind = 'giant'; }
        const barred = kind === 'spiral' && r2() < 0.45;
        const nd = [r2() * 2 - 1, r2() * 2 - 1, r2() * 2 - 1];
        const normal = new THREE.Vector3(...nd).normalize();
        list.push({ seed, pos, kind, barred, R: diam / 2, normal, rho, arms: r2() < 0.75 ? 2 : 4, rot: r2() * Math.PI * 2, shapeR: 0.25 + r2() * 0.75 });
      }
    }
    if (this.cache.size > 6000) this.cache.clear();
    this.cache.set(key, list);
    return list;
  }

  // Galaxie-Objekt (für Info-Panel, Beschriftung, Anflug)
  objectFor(g) {
    if (g.obj) return g.obj;
    const name = `KOS ${String(g.seed % 10000000).padStart(7, '0')}`;
    const tk = g.kind === 'spiral' && g.barred ? 'barred' : g.kind;
    const type = (EN ? TYPE_EN : TYPE_DE)[tk];
    const env = g.rho < 0.3 ? 'void' : g.rho < 2.5 ? 'filament' : g.rho < 8 ? 'group' : 'cluster';
    const ENV_DE = { void: 'liegt einsam in einem kosmischen Leerraum – ihre nächsten Nachbarn sind Millionen Lichtjahre entfernt', filament: 'liegt in einem Filament des kosmischen Netzes, umgeben von verstreuten Nachbargalaxien', group: 'gehört zu einer Galaxiengruppe in einem dichten Knoten des kosmischen Netzes', cluster: 'liegt im Herzen eines Galaxienhaufens, wo Galaxien dicht gedrängt kreisen und verschmelzen' };
    const ENV_EN = { void: 'lies alone in a cosmic void – its nearest neighbors are millions of light-years away', filament: 'lies in a filament of the cosmic web, surrounded by scattered neighboring galaxies', group: 'belongs to a galaxy group in a dense node of the cosmic web', cluster: 'lies at the heart of a galaxy cluster, where galaxies orbit tightly and merge' };
    const stars = g.kind === 'dwarf' ? 1e8 * (g.R / 2000) ** 2 : 1e9 * (g.R / 6000) ** 2.3;
    const starsTxt = stars >= 1e12 ? fmtNum(stars / 1e12, 1) + (EN ? ' trillion' : ' Billionen') : stars >= 1e9 ? fmtNum(stars / 1e9, 0) + (EN ? ' billion' : ' Mrd.') : fmtNum(stars / 1e6, 0) + (EN ? ' million' : ' Mio.');
    const lb = galacticLB(g.pos);
    const desc = EN
      ? `A ${type.toLowerCase()} about ${fmtLy(g.R * 2)} across. It ${ENV_EN[env]}. Procedurally generated from the structure of the cosmic web – this is what a typical galaxy at this location could look like.`
      : `Eine ${type} mit rund ${fmtLy(g.R * 2)} Durchmesser. Sie ${ENV_DE[env]}. Prozedural aus der Struktur des kosmischen Netzes erzeugt – so könnte eine typische Galaxie an diesem Ort aussehen.`;
    g.obj = {
      id: 'kos-' + g.seed, name, cat: 'galaxy', type, radius: g.R, pos: g.pos, dynamic: true,
      gal: { normal: g.normal }, up: 'normal', view: { r: g.R * 2.8, pitch: 35 }, importance: 3, labelMax: g.R * 160,
      desc,
      facts: EN
        ? [['Diameter', '≈ ' + fmtLy(g.R * 2)], ['Stars', '≈ ' + starsTxt], ['Environment', { void: 'Void', filament: 'Filament', group: 'Galaxy group', cluster: 'Galaxy cluster' }[env]], ['Galactic l / b', `${fmtNum(lb.l, 1)}° / ${fmtNum(lb.b, 1)}°`]]
        : [['Durchmesser', '≈ ' + fmtLy(g.R * 2)], ['Sterne', '≈ ' + starsTxt], ['Umgebung', { void: 'Leerraum', filament: 'Filament', group: 'Galaxiengruppe', cluster: 'Galaxienhaufen' }[env]], ['Galakt. l / b', `${fmtNum(lb.l, 1)}° / ${fmtNum(lb.b, 1)}°`]],
    };
    return g.obj;
  }

  _rebuild(ci, cj, ck) {
    this.anchor.set((ci + 0.5) * CELL, (cj + 0.5) * CELL, (ck + 0.5) * CELL);
    const list = [];
    const R2 = RADIUS_CELLS * RADIUS_CELLS;
    for (let a = -RADIUS_CELLS; a <= RADIUS_CELLS; a++) for (let b = -RADIUS_CELLS; b <= RADIUS_CELLS; b++) for (let c = -RADIUS_CELLS; c <= RADIUS_CELLS; c++) {
      if (a * a + b * b + c * c > R2) continue;
      for (const g of this.cellGalaxies(ci + a, cj + b, ck + c)) list.push(g);
    }
    this.list = list;
    const geo = this.points.geometry;
    const P = geo.attributes.position.array, C = geo.attributes.acolor.array, S = geo.attributes.size.array, H = geo.attributes.shape.array;
    const n = Math.min(list.length, MAX_POINTS);
    for (let i = 0; i < n; i++) {
      const g = list[i];
      P[i * 3] = g.pos.x - this.anchor.x; P[i * 3 + 1] = g.pos.y - this.anchor.y; P[i * 3 + 2] = g.pos.z - this.anchor.z;
      const col = COLORS[g.kind === 'giant' ? 'elliptical' : g.kind];
      const k = g.kind === 'dwarf' ? 0.45 : 1;
      C[i * 3] = col[0] * k; C[i * 3 + 1] = col[1] * k; C[i * 3 + 2] = col[2] * k;
      S[i] = g.R * 1.6;
      H[i * 2] = g.rot; H[i * 2 + 1] = g.kind === 'elliptical' || g.kind === 'giant' ? 0.7 + g.shapeR * 0.3 : g.shapeR;
    }
    for (const name of ['position', 'acolor', 'size', 'shape']) geo.attributes[name].needsUpdate = true;
    geo.setDrawRange(0, n);
  }

  _specFor(g) {
    switch (g.kind) {
      case 'spiral': return { kind: 'spiral', arms: g.arms, bar: g.barred ? 0.3 : 0, pitch: 11 + (g.seed % 12), bulge: 0.1 + (g.seed % 10) / 50, count: 0.22, flocculent: g.arms === 4 };
      case 'lenticular': return { kind: 'sombrero', count: 0.2 };
      case 'elliptical': return { kind: 'elliptical', count: 0.18, q: 0.6 + g.shapeR * 0.35 };
      case 'giant': return { kind: 'elliptical', count: 0.3, q: 0.85, giant: true };
      case 'irregular': return { kind: 'irregular', count: 0.12, bar: g.seed % 3 === 0 };
      default: return { kind: 'dwarf', count: 0.05, q: 0.5 + g.shapeR * 0.4 };
    }
  }

  _onDetail({ id, stars, dust }) {
    this.pending.delete(id);
    const g = this._waiting?.get(id);
    if (!g || !this.wanted?.has(id)) return;
    const group = new THREE.Group();
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), g.normal);
    group.rotateY(g.rot);
    const sp = makePoints(stars, { bright: 1, minPx: 1.0, maxPx: 48, nearFade: 1.5, shuffle: true });
    group.add(sp);
    let dp = null;
    if (dust.count > 0) { dp = makePoints(dust, { bright: 1, minPx: 1.0, maxPx: 48, nearFade: 1.5, dust: true, renderOrder: 1, shuffle: true }); group.add(dp); }
    this.world.add(group, g.pos, 1);
    this.details.set(id, { g, group, stars: sp, dust: dp, born: performance.now() });
  }

  _disposeDetail(id) {
    const d = this.details.get(id);
    if (!d) return;
    this.world.remove(d.group);
    d.group.traverse((o) => { if (o.isPoints) { o.geometry.dispose(); o.material.dispose(); } });
    this.details.delete(id);
  }

  update(camPos, viewR) {
    // Aktiv, sobald man auf Galaxien-Maßstab herangezoomt ist
    const active = viewR < 80 * MLY;
    this.points.visible = active;
    if (!active) {
      for (const id of [...this.details.keys()]) this._disposeDetail(id);
      this.nearby = [];
      this.camCell = null;
      return;
    }
    const ci = Math.floor(camPos.x / CELL), cj = Math.floor(camPos.y / CELL), ck = Math.floor(camPos.z / CELL);
    const key = `${ci},${cj},${ck}`;
    if (key !== this.camCell) { this.camCell = key; this._rebuild(ci, cj, ck); }
    this.points.material.uniforms.uBright.value = 2.6 * smooth(80 * MLY, 30 * MLY, viewR);

    // Nahe Galaxien: Beschriftungen & Detailansicht
    const near = [];
    for (const g of this.list) {
      const d = camPos.distanceTo(g.pos);
      g.d = d;
      if (d < g.R * 160) near.push(g);
    }
    near.sort((a, b) => a.d / a.R - b.d / b.R);
    this.nearby = near.slice(0, 14).map((g) => this.objectFor(g));
    // Detailgalaxien verwalten
    this.wanted = new Set();
    this._waiting = this._waiting || new Map();
    for (const g of near) {
      if (this.wanted.size >= MAX_DETAIL) break;
      if (g.d < g.R * 45) this.wanted.add('kos-' + g.seed);
      else break;
    }
    for (const g of near) {
      const id = 'kos-' + g.seed;
      if (!this.wanted.has(id) || this.details.has(id) || this.pending.has(id) || !this.worker) continue;
      if (this.pending.size >= 2) break;
      this.pending.add(id);
      this._waiting.set(id, g);
      this.worker.postMessage({ id, spec: this._specFor(g), R: g.R, seed: 'kos' + g.seed, quality: Math.min(1, this.quality) });
    }
    for (const id of [...this.details.keys()]) {
      const d = this.details.get(id);
      if (!this.wanted.has(id) && d.g.d > d.g.R * 60) this._disposeDetail(id);
    }
    // LOD & Einblenden der Detailgalaxien
    const proj = shared.uProj.value;
    for (const d of this.details.values()) {
      const fade = Math.min(1, (performance.now() - d.born) / 800);
      const pxR = (d.g.R * proj) / Math.max(d.g.d, 1);
      const total = d.stars.userData.total;
      const n = d.g.d < d.g.R * 1.6 ? total : Math.min(total, Math.max(600, pxR * pxR * 1.8));
      setLod(d.stars, n, fade);
      if (d.dust) setLod(d.dust, n * (d.dust.userData.total / total), fade);
    }
  }

  // Für den Autopiloten: nächste noch nicht besuchte Galaxie (bevorzugt in Blickrichtung)
  nextTarget(camPos, viewDir, visited) {
    let best = null, bs = Infinity;
    for (const g of this.list) {
      const id = 'kos-' + g.seed;
      if (visited.has(id) || g.kind === 'dwarf') continue;
      const d = camPos.distanceTo(g.pos);
      if (d < g.R * 4 || d > 11 * MLY) continue;
      const dir = g.pos.clone().sub(camPos).normalize();
      const ahead = dir.dot(viewDir);
      const score = (d / MLY + 1) * (1.6 - ahead) / Math.sqrt(g.R / 20000);
      if (score < bs) { bs = score; best = g; }
    }
    return best ? this.objectFor(best) : null;
  }
}

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
