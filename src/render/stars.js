import * as THREE from 'three';
import { CATALOG } from '../data/catalog.js';
import { Rng, kelvinToRGB } from '../core/rng.js';
import { makeStarMaterial, makeGlowSprite } from './shaders.js';
import { makeStarSurfaceMaterial } from './materials.js';
import { ZERO } from '../world.js';

// Sternklassen: Anteil, Leuchtkraft-Bereich (L☉), Temperatur, maximale Entfernung (Lj)
const CLASSES = [
  { n: 2600, L: [0.0008, 0.06], T: [2600, 3800], d: 70 },
  { n: 2600, L: [0.08, 0.6], T: [3900, 5200], d: 220 },
  { n: 3000, L: [0.6, 1.6], T: [5300, 6000], d: 380 },
  { n: 3400, L: [1.6, 6], T: [6000, 7500], d: 700 },
  { n: 5200, L: [6, 60], T: [7500, 10500], d: 1500 },
  { n: 5400, L: [80, 8000], T: [11000, 28000], d: 3200 },
  { n: 6500, L: [40, 900], T: [3600, 5000], d: 2400 },
  { n: 700, L: [5000, 150000], T: [3300, 30000], d: 4000 },
];

export class Starfield {
  constructor(world, quality = 1, hyg = null) {
    if (hyg) this._fromCatalog(world, hyg);
    else this._procedural(world, quality);
    this._named(world, quality);
  }

  // Echter Sternkatalog (HYG): x, y, z (Lj, Weltkoordinaten), Leuchtkraft, Farbindex B−V
  _fromCatalog(world, hyg) {
    const n = hyg.length / 5;
    const positions = new Float32Array(n * 3), colors = new Float32Array(n * 3), lum = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      positions[i * 3] = hyg[i * 5]; positions[i * 3 + 1] = hyg[i * 5 + 1]; positions[i * 3 + 2] = hyg[i * 5 + 2];
      lum[i] = hyg[i * 5 + 3];
      const ci = Math.min(2.0, Math.max(-0.4, hyg[i * 5 + 4]));
      const T = 4600 * (1 / (0.92 * ci + 1.7) + 1 / (0.92 * ci + 0.62));
      colors.set(kelvinToRGB(T), i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('acolor', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('lum', new THREE.BufferAttribute(lum, 1));
    g.computeBoundingSphere();
    this.points = new THREE.Points(g, makeStarMaterial({ magLimit: 7.2, nearHide: 0.02 }));
    world.add(this.points, ZERO, 1);
  }

  _procedural(world, quality) {
    const rng = new Rng('starfield');
    const total = CLASSES.reduce((s, c) => s + Math.floor(c.n * quality), 0);
    const positions = new Float32Array(total * 3), colors = new Float32Array(total * 3), lum = new Float32Array(total);
    let i = 0;
    const dir = [0, 0, 0];
    for (const c of CLASSES) {
      const n = Math.floor(c.n * quality);
      for (let k = 0; k < n; k++) {
        // Gleichverteilt im Volumen, vertikal abgeflacht (Scheibe)
        rng.dir(dir);
        const r = c.d * Math.cbrt(rng.next());
        let y = dir[1] * r;
        const hScale = c.d > 500 ? 0.35 : 1.0;
        y *= hScale;
        positions[i * 3] = dir[0] * r; positions[i * 3 + 1] = y; positions[i * 3 + 2] = dir[2] * r;
        const L = c.L[0] * Math.pow(c.L[1] / c.L[0], rng.next());
        const T = c.T[0] + (c.T[1] - c.T[0]) * rng.next();
        const col = kelvinToRGB(T);
        colors.set(col, i * 3);
        lum[i] = L;
        i++;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('acolor', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('lum', new THREE.BufferAttribute(lum, 1));
    g.computeBoundingSphere();
    this.points = new THREE.Points(g, makeStarMaterial({ magLimit: 9.0, nearHide: 0.02 }));
    world.add(this.points, ZERO, 1);
  }

  _named(world, quality) {

    // Benannte Sterne: Körper + Glow + Punkt
    const sphere = quality > 1 ? new THREE.SphereGeometry(1, 128, 80) : new THREE.SphereGeometry(1, 64, 40);
    this.named = [];
    for (const o of CATALOG) {
      if (o.cat !== 'star' || o.id === 'sun') continue;
      const col = kelvinToRGB(o.tempK);
      const body = new THREE.Mesh(sphere, makeStarSurfaceMaterial(col, o.tempK < 4000 ? 0.4 : 0, o.radius > 100 * 0.00000007 ? 5 : 9));
      world.add(body, o.pos, o.radius);
      const glow = makeGlowSprite(new THREE.Color(...col), 0.45);
      world.add(glow, o.pos, o.radius * 7);
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3));
      pg.setAttribute('acolor', new THREE.BufferAttribute(new Float32Array(col), 3));
      pg.setAttribute('lum', new THREE.BufferAttribute(new Float32Array([o.lum]), 1));
      pg.setAttribute('radius', new THREE.BufferAttribute(new Float32Array([o.radius]), 1));
      const pt = new THREE.Points(pg, makeStarMaterial({ radius: true, magLimit: 10 }));
      pt.frustumCulled = false;
      world.add(pt, o.pos, 1);
      this.named.push({ o, body, glow, pt });
    }
  }

  frame(camPos) {
    // Jenseits von ~20.000 Lj ist kein Stern des Feldes mehr sichtbar
    this.points.visible = camPos.length() < 20000;
    for (const s of this.named) {
      const d = camPos.distanceTo(s.o.pos);
      const near = d < s.o.radius * 4000;
      s.body.visible = near;
      s.glow.visible = near;
    }
  }
}
