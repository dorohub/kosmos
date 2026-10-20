import * as THREE from 'three';
import { BY_ID, CATALOG } from '../data/catalog.js';
import { eclToWorld, eqVecToWorld, EQ_NORTH, ECL_NORTH, radecToDir } from '../core/coords.js';
import { AU_LY, KM_LY, R_SUN_LY, DEG } from '../core/units.js';
import { makePlanetMaterial, makeCloudMaterial, makeAtmosphereMaterial, makeRingMaterial, makeStarSurfaceMaterial } from './materials.js';
import { makePoints, makeStarMaterial, makeGlowSprite } from './shaders.js';
import { Rng, kelvinToRGB } from '../core/rng.js';
import { loadTexture } from './textures.js';
import { ZERO } from '../world.js';

const J2000 = Date.UTC(2000, 0, 1, 12);
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m4 = new THREE.Matrix4(), _Y = new THREE.Vector3(0, 1, 0);

// Farben: Grundfarbe, Zweitfarbe, Akzent, Punktfarbe aus der Ferne, Albedo
const LOOKS = {
  mercury: [[0.42, 0.4, 0.38], [0.62, 0.58, 0.53], [0.3, 0.3, 0.3], [0.75, 0.7, 0.65], 0.14],
  venus: [[0.85, 0.72, 0.45], [0.98, 0.9, 0.7], [0.9, 0.8, 0.6], [1.0, 0.9, 0.7], 0.75],
  earth: [[0.1, 0.3, 0.6], [0.2, 0.4, 0.2], [0.9, 0.9, 0.9], [0.55, 0.7, 1.0], 0.37],
  moon: [[0.48, 0.47, 0.46], [0.7, 0.69, 0.67], [0.3, 0.3, 0.3], [0.8, 0.8, 0.8], 0.12],
  mars: [[0.55, 0.22, 0.1], [0.78, 0.42, 0.22], [0.3, 0.13, 0.08], [1.0, 0.6, 0.4], 0.17],
  jupiter: [[0.82, 0.7, 0.55], [0.6, 0.42, 0.3], [0.95, 0.92, 0.85], [1.0, 0.9, 0.75], 0.52],
  saturn: [[0.88, 0.78, 0.58], [0.75, 0.62, 0.42], [0.95, 0.9, 0.75], [1.0, 0.92, 0.7], 0.47],
  uranus: [[0.62, 0.85, 0.88], [0.55, 0.8, 0.85], [0.7, 0.9, 0.92], [0.7, 0.95, 1.0], 0.51],
  neptune: [[0.22, 0.38, 0.85], [0.3, 0.5, 0.95], [0.15, 0.25, 0.6], [0.45, 0.6, 1.0], 0.41],
  pluto: [[0.62, 0.52, 0.42], [0.82, 0.72, 0.6], [0.4, 0.3, 0.25], [0.9, 0.8, 0.7], 0.5],
  io: [[0.85, 0.7, 0.25], [0.95, 0.9, 0.55], [0.5, 0.25, 0.08], [1.0, 0.9, 0.5], 0.63],
  europa: [[0.85, 0.8, 0.72], [0.62, 0.45, 0.32], [0.9, 0.88, 0.85], [0.95, 0.92, 0.85], 0.67],
  ganymede: [[0.45, 0.42, 0.38], [0.7, 0.66, 0.6], [0.3, 0.3, 0.3], [0.8, 0.78, 0.72], 0.43],
  callisto: [[0.25, 0.23, 0.21], [0.45, 0.42, 0.38], [0.2, 0.2, 0.2], [0.6, 0.58, 0.55], 0.22],
  titan: [[0.85, 0.55, 0.2], [0.95, 0.72, 0.38], [0.8, 0.5, 0.2], [1.0, 0.75, 0.4], 0.22],
  enceladus: [[0.92, 0.94, 0.97], [0.8, 0.86, 0.92], [0.7, 0.8, 0.9], [1.0, 1.0, 1.0], 0.99],
  triton: [[0.8, 0.7, 0.68], [0.92, 0.86, 0.82], [0.6, 0.5, 0.48], [0.95, 0.9, 0.88], 0.76],
  charon: [[0.45, 0.43, 0.42], [0.65, 0.62, 0.6], [0.35, 0.25, 0.2], [0.75, 0.72, 0.7], 0.3],
  phobos: [[0.28, 0.26, 0.24], [0.42, 0.38, 0.34], [0.2, 0.2, 0.2], [0.5, 0.48, 0.45], 0.07],
  barren: [[0.42, 0.3, 0.24], [0.6, 0.48, 0.4], [0.3, 0.2, 0.18], [0.9, 0.6, 0.5], 0.3],
  lava: [[0.1, 0.08, 0.07], [0.2, 0.15, 0.12], [0.3, 0.1, 0.05], [1.0, 0.5, 0.3], 0.2],
  ice: [[0.7, 0.8, 0.92], [0.9, 0.95, 1.0], [0.3, 0.5, 0.8], [0.8, 0.9, 1.0], 0.6],
  desert: [[0.66, 0.4, 0.22], [0.82, 0.6, 0.38], [0.45, 0.2, 0.1], [1.0, 0.7, 0.45], 0.3],
  terra: [[0.1, 0.25, 0.55], [0.22, 0.42, 0.18], [0.5, 0.42, 0.3], [0.6, 0.75, 1.0], 0.35],
  ocean: [[0.08, 0.32, 0.55], [0.35, 0.55, 0.3], [0.9, 0.9, 0.9], [0.5, 0.75, 1.0], 0.4],
};

// Echte Texturen (Solar System Scope, CC BY 4.0, nach NASA-Daten)
const TEX = {
  earth: { map: '8k_earth_daymap.jpg', night: '8k_earth_nightmap.jpg', spec: '2k_earth_specular.jpg', clouds: '4k_earth_clouds.jpg' },
  moon: { map: '4k_moon.jpg' },
  mercury: { map: '4k_mercury.jpg' },
  venus: { map: '4k_venus_atmosphere.jpg' },
  mars: { map: '4k_mars.jpg' },
  jupiter: { map: '8k_jupiter.jpg' },
  saturn: { map: '8k_saturn.jpg', ring: '8k_saturn_ring_alpha.png' },
  uranus: { map: '2k_uranus.jpg' },
  neptune: { map: '2k_neptune.jpg' },
};

const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpM = new THREE.Matrix4();

function perpBasis(axis) {
  const h = Math.abs(axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const e1 = new THREE.Vector3().crossVectors(h, axis).normalize();
  const e2 = new THREE.Vector3().crossVectors(axis, e1).normalize();
  return [e1, e2];
}

export class SolarSystem {
  constructor(world, quality = 1) {
    this.world = world;
    this.bodies = [];
    this.sun = BY_ID.get('sun');
    this.sun.pos.set(0, 0, 0);
    const hi = quality > 1;
    this.sphere = new THREE.SphereGeometry(1, hi ? 192 : 128, hi ? 128 : 80);
    this.sphereLo = new THREE.SphereGeometry(1, hi ? 96 : 64, hi ? 64 : 40);

    // Sonne
    const sunCol = kelvinToRGB(5772);
    this.sunMesh = new THREE.Mesh(this.sphere, makeStarSurfaceMaterial([1.0, 0.6, 0.2], 1, 9));
    world.add(this.sunMesh, this.sun.pos, R_SUN_LY);
    const glow1 = makeGlowSprite(new THREE.Color(1.0, 0.72, 0.4), 0.45);
    world.add(glow1, this.sun.pos, R_SUN_LY * 7);
    const glow2 = makeGlowSprite(new THREE.Color(1.0, 0.6, 0.3), 0.12);
    world.add(glow2, this.sun.pos, R_SUN_LY * 40);
    this.sunGlows = [glow1, glow2];
    this.sunPoint = this.singleStar(sunCol, 1, R_SUN_LY);
    world.add(this.sunPoint, this.sun.pos, 1);

    const lineMat = () => new THREE.LineBasicMaterial({ color: 0x5fd8ff, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending });
    const circle = (n = 256) => {
      const pts = [];
      for (let i = 0; i < n; i++) { const L = (i / n) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(L), 0, Math.sin(L))); }
      return new THREE.BufferGeometry().setFromPoints(pts);
    };
    this.orbitLines = [];

    // Planeten, Monde, Exoplaneten
    const ids = CATALOG.filter((o) => (o.cat === 'planet' || o.cat === 'moon') && LOOKS[o.look]).map((o) => o.id);
    BY_ID.get('moon').moonOrbit = { aKm: 384400, P: 27.321661, L0: 218.316, ecl: true };
    for (const id of ids) {
      const o = BY_ID.get(id);
      const L = LOOKS[o.look];
      const big = ['earth', 'jupiter', 'saturn', 'moon', 'mars'].includes(id);
      const group = new THREE.Group();
      const body = new THREE.Mesh(big ? this.sphere : this.sphereLo, makePlanetMaterial(o.look, L[0], L[1], L[2]));
      group.add(body);
      const b = { o, group, body, mats: [body.material], tex: TEX[id], texState: 0 };
      b.parent = o.parent ? BY_ID.get(o.parent) : this.sun;
      b.light = o.exo ? b.parent : this.sun;
      if (o.exo) {
        const lc = kelvinToRGB(b.parent.tempK || 5772);
        const m = Math.max(...lc);
        body.material.uniforms.uLightColor.value.setRGB(lc[0] / m, lc[1] / m, lc[2] / m);
      }
      if (id === 'earth') {
        b.clouds = new THREE.Mesh(this.sphere, makeCloudMaterial());
        b.clouds.scale.setScalar(1.006);
        group.add(b.clouds);
        b.mats.push(b.clouds.material);
      }
      const atmo = { earth: [[0.3, 0.55, 1.0], 2.6, 1.035], venus: [[1.0, 0.85, 0.55], 2.2, 1.03], mars: [[1.0, 0.55, 0.35], 4.0, 1.015], titan: [[1.0, 0.65, 0.3], 2.0, 1.06],
        uranus: [L[3], 3.0, 1.02], neptune: [L[3], 3.0, 1.02], trappist1e: [[0.35, 0.6, 1.0], 2.6, 1.035], proximab: [[0.8, 0.6, 0.6], 3.0, 1.03] }[id];
      if (atmo) {
        const m = new THREE.Mesh(this.sphereLo, makeAtmosphereMaterial(atmo[0], atmo[1]));
        m.scale.setScalar(atmo[2]);
        group.add(m);
        b.mats.push(m.material);
      }
      if (id === 'saturn') {
        b.ring = new THREE.Mesh(new THREE.RingGeometry(1.24, 2.27, 384, 6), makeRingMaterial());
        b.ring.rotation.x = -Math.PI / 2;
        group.add(b.ring);
      }
      // Rotationsachse & Ausrichtung
      if (id === 'earth') {
        // lokales +X = Frühlingspunkt, damit die Erdrotation (Sternzeit) zur echten Uhrzeit passt
        b.axis = EQ_NORTH.clone();
        b.align = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(eqVecToWorld(1, 0, 0), EQ_NORTH, eqVecToWorld(0, -1, 0)));
      } else if (o.cat === 'moon' || o.exo) {
        b.axis = o.moonOrbit?.ecl ? ECL_NORTH.clone() : (b.parent.body?.axis?.clone() || ECL_NORTH.clone());
        b.locked = true;
      } else {
        const t = (o.tilt ?? 0) * DEG;
        b.axis = eclToWorld(0, Math.sin(t), Math.cos(t)).normalize();
        b.align = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.axis);
      }
      if (b.align) group.quaternion.copy(b.align);
      world.add(group, o.pos, o.radius);
      // Punktdarstellung aus der Ferne
      const RJ = 69911 * KM_LY;
      const aAU = o.orbit?.a ?? (b.parent.orbit?.a ?? 1);
      const lum = o.exo ? 1e-14 : (1.35e-6 * (o.radius / RJ) ** 2 * L[4]) / (aAU * aAU);
      b.point = this.singleStar(L[3], lum, o.radius, 13.5);
      world.add(b.point, o.pos, 1);
      // Bahnlinie
      if (o.orbit) {
        const line = new THREE.LineLoop(circle(512), lineMat());
        line.frustumCulled = false;
        line.quaternion.setFromRotationMatrix(tmpM.makeBasis(eclToWorld(1, 0, 0), ECL_NORTH, eclToWorld(0, -1, 0)));
        world.add(line, ZERO, o.orbit.a * AU_LY);
        this.orbitLines.push({ line, b, a: o.orbit.a * AU_LY, center: this.sun });
      } else if (o.moonOrbit || o.exoOrbit) {
        const a = o.moonOrbit ? o.moonOrbit.aKm * KM_LY : o.exoOrbit.a * AU_LY;
        if (o.moonOrbit?.ecl) b.basis = [eclToWorld(1, 0, 0), eclToWorld(0, 1, 0)];
        else if (o.exo) {
          // Exoplaneten: Bahn von der Erde aus gesehen fast von der Kante (Transit)
          const los = b.parent.pos.clone().normalize();
          const n = new THREE.Vector3().crossVectors(los, new THREE.Vector3(0, 1, 0)).normalize();
          b.basis = [los, new THREE.Vector3().crossVectors(n, los).normalize()];
          b.axis = n;
        } else b.basis = perpBasis(b.axis);
        const nrm = new THREE.Vector3().crossVectors(b.basis[0], b.basis[1]).normalize();
        const line = new THREE.LineLoop(circle(256), lineMat());
        line.frustumCulled = false;
        line.quaternion.setFromRotationMatrix(tmpM.makeBasis(b.basis[0], nrm, new THREE.Vector3().crossVectors(b.basis[0], nrm)));
        world.add(line, b.parent.pos, a);
        this.orbitLines.push({ line, b, a, center: b.parent });
      }
      this.bodies.push(b);
      o.body = b;
    }

    // Kleinkörper
    const rng = new Rng('belts');
    const belt = (n, a0, a1, h, col, size, bright) => {
      const positions = new Float32Array(n * 3), colors = new Float32Array(n * 3), sizes = new Float32Array(n);
      const v = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        const a = a0 + (a1 - a0) * Math.pow(rng.next(), 0.8);
        const L = rng.next() * Math.PI * 2;
        eclToWorld(a * Math.cos(L), a * Math.sin(L), rng.gauss() * h * a, v).multiplyScalar(AU_LY);
        positions.set([v.x, v.y, v.z], i * 3);
        const k = rng.range(0.6, 1.1);
        colors.set([col[0] * k, col[1] * k, col[2] * k], i * 3);
        sizes[i] = size * rng.range(0.5, 1.4);
      }
      return makePoints({ positions, colors, sizes }, { bright, minPx: 1.0, maxPx: 6 });
    };
    this.asteroids = belt(Math.floor(9000 * quality), 2.15, 3.3, 0.05, [0.75, 0.62, 0.48], 0.012 * AU_LY, 0.55);
    world.add(this.asteroids, ZERO, 1);
    this.kuiper = belt(Math.floor(9000 * quality), 30, 52, 0.08, [0.6, 0.72, 0.85], 0.25 * AU_LY, 0.4);
    world.add(this.kuiper, ZERO, 1);
    {
      const n = Math.floor(16000 * quality);
      const positions = new Float32Array(n * 3), colors = new Float32Array(n * 3), sizes = new Float32Array(n);
      const d = [0, 0, 0];
      for (let i = 0; i < n; i++) {
        rng.dir(d);
        const r = (2000 + 98000 * Math.pow(rng.next(), 0.6)) * AU_LY;
        positions.set([d[0] * r, d[1] * r * 0.9, d[2] * r], i * 3);
        colors.set([0.45, 0.62, 0.9], i * 3);
        sizes[i] = 600 * AU_LY * rng.range(0.6, 1.5);
      }
      this.oort = makePoints({ positions, colors, sizes }, { bright: 0.22, minPx: 1.0, maxPx: 10, nearFade: 3 });
      world.add(this.oort, ZERO, 1);
    }

    // Raumfahrzeuge
    BY_ID.get('voyager1').deep = { ra: 17.2, dec: 12.0, au2024: 162, auPerYear: 3.57 };
    this.craft = CATALOG.filter((o) => o.cat === 'probe');
    for (const o of this.craft) {
      const p = this.singleStar([0.6, 1.0, 0.8], 3e-13, 0, 14);
      world.add(p, o.pos, 1);
    }

    // Ankerpunkte für Regionen
    for (const id of ['asteroids', 'kuiper', 'oort']) {
      const o = BY_ID.get(id);
      const [a, L] = o.anchorEcl;
      eclToWorld(a * Math.cos(L), a * Math.sin(L), 0, o.pos).multiplyScalar(AU_LY);
      o.labelPos = o.pos.clone();
      o.pos.set(0, 0, 0);
    }
  }

  singleStar(color, lum, radius, magLimit = 9.5) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3));
    g.setAttribute('acolor', new THREE.BufferAttribute(new Float32Array(color), 3));
    g.setAttribute('lum', new THREE.BufferAttribute(new Float32Array([lum]), 1));
    g.setAttribute('radius', new THREE.BufferAttribute(new Float32Array([radius]), 1));
    const p = new THREE.Points(g, makeStarMaterial({ radius: true, magLimit }));
    p.frustumCulled = false;
    return p;
  }

  update(dateMs) {
    const d = (dateMs - J2000) / 86400000;
    const earth = BY_ID.get('earth');
    // Reihenfolge: erst Planeten, dann Monde (brauchen Elternposition)
    for (const b of this.bodies) {
      const o = b.o;
      if (o.orbit) {
        const L = (o.orbit.L0 + (360 * d) / o.orbit.P) * DEG;
        eclToWorld(Math.cos(L), Math.sin(L), 0, o.pos).multiplyScalar(o.orbit.a * AU_LY);
      }
    }
    for (const b of this.bodies) {
      const o = b.o;
      const orb = o.moonOrbit || o.exoOrbit;
      if (!orb) continue;
      const a = o.moonOrbit ? orb.aKm * KM_LY : orb.a * AU_LY;
      const th = (orb.L0 + (360 * d) / orb.P) * DEG;
      o.pos.copy(b.parent.pos).addScaledVector(b.basis[0], Math.cos(th) * a).addScaledVector(b.basis[1], Math.sin(th) * a);
    }
    for (const b of this.bodies) {
      const o = b.o;
      if (o.id === 'earth') {
        // Sternzeit Greenwich (GMST)
        const gmst = ((280.46061837 + 360.98564736629 * d) % 360) * DEG;
        b.body.rotation.y = gmst;
        if (b.clouds) b.clouds.rotation.y = gmst + d * 0.02;
      } else if (b.locked) {
        // gebundene Rotation: Vorderseite (lokal +X) zeigt zum Mutterkörper
        tmpV.subVectors(b.parent.pos, o.pos).normalize();
        const Y = b.axis;
        const X = tmpV.sub(Y.clone().multiplyScalar(tmpV.dot(Y))).normalize();
        const Z = new THREE.Vector3().crossVectors(X, Y);
        b.group.quaternion.setFromRotationMatrix(tmpM.makeBasis(X, Y, Z));
      } else {
        const spin = ((d * 24) / (o.rotH || 24)) * Math.PI * 2;
        b.body.rotation.y = spin % (Math.PI * 2);
      }
    }
    // Raumfahrzeuge
    const year = 2000 + d / 365.25;
    for (const o of this.craft) {
      if (o.deep) {
        const au = Math.max(0, o.deep.au2024 + o.deep.auPerYear * (year - 2024));
        radecToDir(o.deep.ra, o.deep.dec, o.pos).multiplyScalar(au * AU_LY);
      } else if (o.sat) {
        if (!o._basis) {
          const i = o.sat.incl * DEG;
          const ax = eqVecToWorld(0, -Math.sin(i), Math.cos(i)).normalize();
          o._basis = perpBasis(ax);
        }
        const th = ((d * 1440) / o.sat.Pmin) * Math.PI * 2;
        const r = (6371 + o.sat.altKm) * KM_LY;
        o.pos.copy(earth.pos).addScaledVector(o._basis[0], Math.cos(th) * r).addScaledVector(o._basis[1], Math.sin(th) * r);
      } else if (o.l2) {
        o.pos.copy(earth.pos).addScaledVector(earth.pos.clone().normalize(), 1.5e6 * KM_LY);
      }
    }
  }

  // Texturen nachladen, sobald die Kamera in die Nähe kommt
  ensureTextures(camPos) {
    const near = (o, f) => camPos.distanceTo(o.pos) < o.radius * f;
    if (!this.sunTex && near(this.sun, 3000)) {
      this.sunTex = true;
      loadTexture('8k_sun.jpg').then((t) => { const u = this.sunMesh.material.uniforms; u.uMap.value = t; u.uUseMap.value = 1; });
    }
    for (const b of this.bodies) {
      if (!b.tex || b.texState) continue;
      if (!near(b.o, 30000)) continue;
      b.texState = 1;
      const u = b.body.material.uniforms;
      loadTexture(b.tex.map).then((t) => { u.uMap.value = t; u.uUseMap.value = 1; });
      if (b.tex.night) loadTexture(b.tex.night).then((t) => { u.uNight.value = t; u.uUseNight.value = 1; });
      if (b.tex.spec) loadTexture(b.tex.spec, false).then((t) => { u.uSpec.value = t; u.uUseSpec.value = 1; });
      if (b.tex.clouds) loadTexture(b.tex.clouds, false).then((t) => { const cu = b.clouds.material.uniforms; cu.uMap.value = t; cu.uUseMap.value = 1; });
      if (b.tex.ring) loadTexture(b.tex.ring).then((t) => { const ru = b.ring.material.uniforms; ru.uMap.value = t; ru.uUseMap.value = 1; });
    }
  }

  // pro Frame nach Kameraupdate
  frame(camPos, k, opts, viewR = 1) {
    this.ensureTextures(camPos);
    const tmp = new THREE.Vector3();
    for (const b of this.bodies) {
      tmp.subVectors(b.light.pos, b.o.pos).normalize();
      for (const m of b.mats) m.uniforms.uSunDir.value.copy(tmp);
      _q.copy(b.group.quaternion).multiply(_q2.setFromAxisAngle(_Y, b.body.rotation.y));
      b.body.material.uniforms.uRot.value.setFromMatrix4(_m4.makeRotationFromQuaternion(_q));
      if (b.ring) {
        const u = b.ring.material.uniforms;
        u.uSunDir.value.copy(tmp);
        u.uNormal.value.copy(b.axis);
        u.uCenter.value.subVectors(b.o.pos, camPos).multiplyScalar(k);
        u.uPlanetR.value = b.o.radius * k;
      }
      // weit entfernte Körper nicht zeichnen (spart Grafikleistung)
      b.group.visible = camPos.distanceTo(b.o.pos) < b.o.radius * 2e5;
    }
    // Umlaufbahnen ein-/ausblenden
    const show = opts.orbits;
    const nearFade = smooth(2e-7, 2e-6, viewR);
    for (const { line, b, a, center } of this.orbitLines) {
      const dC = camPos.distanceTo(center.pos);
      const near = camPos.distanceTo(b.o.pos);
      const minR = b.o.cat === 'moon' || b.o.exo ? smooth(b.o.radius * 6, b.o.radius * 40, near) : smooth(b.o.radius * 30, b.o.radius * 400, near) * nearFade;
      const op = (b.o.cat === 'moon' || b.o.exo ? 0.16 : 0.3) * (1 - smooth(a * 25, a * 120, dC)) * minR;
      line.visible = show && op > 0.003;
      line.material.opacity = op;
    }
    const dSun = camPos.length();
    // Kleinkörper-Gürtel sind nur als "Karte" beim Herauszoomen sinnvoll (von der Erde aus unsichtbar)
    const belts = [[this.asteroids, 0.55, 0.6 * AU_LY, 2.5 * AU_LY, 400 * AU_LY], [this.kuiper, 0.4, 8 * AU_LY, 30 * AU_LY, 6000 * AU_LY], [this.oort, 0.22, 600 * AU_LY, 4000 * AU_LY, 30]];
    for (const [pts, br, a, b2, maxD] of belts) {
      const f = smooth(a, b2, viewR) * (dSun < maxD ? 1 : 0);
      pts.visible = f > 0.01;
      pts.material.uniforms.uBright.value = br * f;
    }
    const near = dSun < 0.05;
    for (const g of this.sunGlows) g.visible = near;
    this.sunMesh.visible = dSun < R_SUN_LY * 3e5;
  }
}

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
