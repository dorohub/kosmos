import * as THREE from 'three';
import { BY_ID, addObject } from '../data/catalog.js';
import { radecToDir } from '../core/coords.js';
import { R_SUN_LY, fmtNum } from '../core/units.js';
import { loadTexture } from './textures.js';
import { EN } from '../i18n.js';

const base = import.meta.env.BASE_URL;

// Englische Katalognamen -> unsere Objekte
const LINK = {
  sirius: 'Sirius', procyon: 'Procyon', altair: 'Altair', vega: 'Vega', fomalhaut: 'Fomalhaut', arcturus: 'Arcturus',
  capella: 'Capella', aldebaran: 'Aldebaran', regulus: 'Regulus', polaris: 'Polaris', betelgeuse: 'Betelgeuse',
  rigel: 'Rigel', antares: 'Antares', canopus: 'Canopus', deneb: 'Deneb', spica: 'Spica', alphacen: 'Rigil Kentaurus',
};
const DE_NAMES = { Betelgeuse: 'Beteigeuze', Procyon: 'Prokyon', Vega: 'Wega', Capella: 'Kapella', Arcturus: 'Arktur', Polaris: 'Polarstern', 'Rigil Kentaurus': 'Alpha Centauri' };

function tempFromCI(ci) {
  ci = Math.min(2.0, Math.max(-0.4, ci));
  return 4600 * (1 / (0.92 * ci + 1.7) + 1 / (0.92 * ci + 0.62));
}

export async function loadSky() {
  const [bin, json] = await Promise.all([
    fetch(base + 'data/stars.bin').then((r) => r.arrayBuffer()),
    fetch(base + 'data/sky.json').then((r) => r.json()),
  ]);
  const n = new DataView(bin).getUint32(0, true);
  const hyg = new Float32Array(bin, 4, n * 5);
  // Unsere Katalog-Sterne auf die exakten Katalogpositionen setzen und Doppelungen entfernen
  const byName = new Map(json.stars.map((s) => [s.name, s]));
  const linked = new Set();
  for (const [id, name] of Object.entries(LINK)) {
    const s = byName.get(name);
    const o = BY_ID.get(id);
    if (!s || !o) continue;
    o.pos.set(hyg[s.i * 5], hyg[s.i * 5 + 1], hyg[s.i * 5 + 2]);
    hyg[s.i * 5 + 3] = 0;
    linked.add(name);
  }
  // Weitere helle, benannte Sterne als eigene Objekte
  for (const s of json.stars) {
    if (linked.has(s.name)) continue;
    const id = 'hyg-' + s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (BY_ID.has(id)) continue;
    const T = tempFromCI(s.ci);
    const rSun = Math.max(0.3, Math.sqrt(s.lum) * (5772 / T) ** 2);
    const name = EN ? s.name : DE_NAMES[s.name] || s.name;
    const con = EN ? s.conEn || s.con : s.con;
    const bright = EN
      ? (s.mag < 1 ? 'one of the brightest stars in the sky' : s.mag < 2 ? 'a very bright star' : 'a star easily visible to the naked eye')
      : (s.mag < 1 ? 'einer der hellsten Sterne am Himmel' : s.mag < 2 ? 'ein sehr heller Stern' : 'ein mit bloßem Auge gut sichtbarer Stern');
    const o = addObject({
      id, name, cat: 'star', type: `${EN ? 'Star' : 'Stern'} · ${s.spect || '?'} · ${con}`,
      pos: new THREE.Vector3(hyg[s.i * 5], hyg[s.i * 5 + 1], hyg[s.i * 5 + 2]),
      radius: rSun * R_SUN_LY, lum: s.lum, tempK: T, hygIndex: s.i,
      labelMax: Math.min(3000, 20 * Math.pow(s.lum, 0.42) + 30), importance: s.mag < 1.5 ? 5 : 3,
      desc: EN
        ? `${name} is ${bright} in the constellation ${con}. Apparent magnitude ${fmtNum(s.mag, 2)}, ${fmtNum(s.dly, 0)} light-years away, about ${fmtNum(s.lum, s.lum < 10 ? 1 : 0)} times as luminous as the Sun.`
        : `${name} ist ${bright} im Sternbild ${con}. Scheinbare Helligkeit ${fmtNum(s.mag, 2)} mag, ${fmtNum(s.dly, 0)} Lichtjahre entfernt, etwa ${fmtNum(s.lum, s.lum < 10 ? 1 : 0)}-mal so leuchtkräftig wie die Sonne.`,
      facts: EN
        ? [['Constellation', con], ['Spectral type', s.spect || '—'], ['Magnitude', fmtNum(s.mag, 2) + ' mag'], ['Luminosity', fmtNum(s.lum, s.lum < 10 ? 1 : 0) + ' Suns']]
        : [['Sternbild', con], ['Spektralklasse', s.spect || '—'], ['Helligkeit', fmtNum(s.mag, 2) + ' mag'], ['Leuchtkraft', fmtNum(s.lum, s.lum < 10 ? 1 : 0) + ' Sonnen']],
    });
    hyg[s.i * 5 + 3] = 0;
    o.view = { r: o.radius * 6, pitch: 10 };
  }
  return { hyg, constellations: json.constellations };
}

// Milchstraßen-Panorama (galaktische Koordinaten, Süden oben) als Himmelskugel um die Kamera
const panoVert = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const panoFrag = `
uniform sampler2D uMap; uniform float uAlpha; uniform float uGain;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float l = atan(-d.z, d.x);
  float b = asin(clamp(d.y, -1.0, 1.0));
  vec2 uv = vec2(fract(0.5 - l / 6.28318530718), 0.5 - b / 3.14159265359);
  vec3 c = texture2D(uMap, uv).rgb;
  c = pow(c, vec3(1.15)) * uGain;
  gl_FragColor = vec4(c * uAlpha, 1.0);
}`;

export class Sky {
  constructor(scene, data) {
    this.scene = scene;
    // Panorama
    this.pano = new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 48),
      new THREE.ShaderMaterial({
        vertexShader: panoVert, fragmentShader: panoFrag, side: THREE.BackSide, depthWrite: false, depthTest: true,
        transparent: true, blending: THREE.AdditiveBlending,
        uniforms: { uMap: { value: null }, uAlpha: { value: 0 }, uGain: { value: 4.2 } },
      }),
    );
    this.pano.renderOrder = -20;
    this.pano.frustumCulled = false;
    this.pano.visible = false;
    scene.add(this.pano);
    loadTexture('8k_stars_milky_way.jpg').then((t) => { this.pano.material.uniforms.uMap.value = t; this.panoReady = true; });

    // Sternbilder: Linien auf der Himmelskugel
    const pos = [];
    this.constLabels = [];
    for (const c of data.constellations) {
      for (const seg of c.lines) {
        for (let i = 0; i < seg.length - 1; i++) {
          const a = radecToDir(((seg[i][0] + 360) % 360) / 15, seg[i][1]);
          const b = radecToDir(((seg[i + 1][0] + 360) % 360) / 15, seg[i + 1][1]);
          pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      }
      if (c.label) this.constLabels.push({ name: EN ? c.nameEn || c.name : c.name, dir: radecToDir(((c.label[0] + 360) % 360) / 15, c.label[1]), rank: c.rank });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x6ee7ff, transparent: true, opacity: 0, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending }));
    this.lines.renderOrder = -10;
    this.lines.frustumCulled = false;
    scene.add(this.lines);

    // Beschriftungen der Sternbilder
    const root = document.getElementById('labels');
    for (const l of this.constLabels) {
      l.el = document.createElement('div');
      l.el.className = 'lbl c-const';
      l.el.textContent = l.name;
      l.el.style.display = 'none';
      root.appendChild(l.el);
    }
  }

  update(camera, camPos, opts, occ = []) {
    const dSun = camPos.length();
    // Panorama nur in Sonnennähe (danach übernehmen die 3D-Sterne & Milchstraßen-Partikel)
    const a = this.panoReady ? 1 - smooth(150, 2500, dSun) : 0;
    this.pano.visible = a > 0.002;
    this.pano.material.uniforms.uAlpha.value = a;
    this.panoAlpha = a;
    const big = camera.far * 0.5;
    this.pano.scale.setScalar(Math.min(big, 1e6));
    this.pano.position.set(0, 0, 0);
    // Sternbilder: nur innerhalb des Sonnensystems sinnvoll
    const ca = opts.constellations ? 0.13 * (1 - smooth(0.5, 3, dSun)) : 0;
    this.lines.visible = ca > 0.003;
    this.lines.material.opacity = ca;
    this.lines.scale.setScalar(1e5);
    const W = window.innerWidth, H = window.innerHeight;
    const v = new THREE.Vector3();
    for (const l of this.constLabels) {
      if (!this.lines.visible || !opts.labels) { if (l.shown) { l.el.style.display = 'none'; l.shown = false; } continue; }
      v.copy(l.dir).multiplyScalar(1e5).project(camera);
      const on = v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1;
      if (!on) { if (l.shown) { l.el.style.display = 'none'; l.shown = false; } continue; }
      const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      if (occ.some((c) => Math.hypot(x - c.x, y - c.y) < c.r * 1.05)) { if (l.shown) { l.el.style.display = 'none'; l.shown = false; } continue; }
      l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
      l.el.style.opacity = (ca / 0.13).toFixed(2);
      if (!l.shown) { l.el.style.display = ''; l.shown = true; }
    }
  }
}

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
