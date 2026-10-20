import * as THREE from 'three';
import { CATALOG, BY_ID } from '../data/catalog.js';
import { generateGalaxy } from './galaxyGen.js';
import { generateNebula } from './nebulaGen.js';
import { generateWeb } from './cosmicWeb.js';
import { makePoints, photonRingTexture, makeGlowSprite, setLod, shared } from './shaders.js';
import { makeDiskMaterial, makeCMBMaterial, bakeCMBTexture } from './materials.js';
import { hashString, Rng } from '../core/rng.js';
import { radecToWorld, GC_POS } from '../core/coords.js';
import { ZERO } from '../world.js';
import { t } from '../i18n.js';
import { fmtNum } from '../core/units.js';
import { bakeGalaxy, makeImpostorMesh } from './impostor.js';

const MLY = 1e6, GLY = 1e9;
const tick = () => new Promise((r) => setTimeout(r, 0));

export async function buildUniverse(world, quality, progress, renderer) {
  const out = { galaxies: [], nebulae: [], blackholes: [], webs: [] };
  const steps = CATALOG.filter((o) => o.cat === 'galaxy' || o.cat === 'nebula').length + 6;
  let done = 0;
  const step = async (msg) => { done++; progress(done / steps, msg); await tick(); };

  // Milchstraße
  {
    const mw = BY_ID.get('milkyway');
    const data = generateGalaxy({ kind: 'spiral', mw: true, pitch: 13, bulge: 0.13, exposure: 3.0, sizeK: 0.03 }, 52000, 'milkyway', quality);
    const group = new THREE.Group();
    const stars = makePoints(data.stars, { bright: 1, minPx: 1.0, maxPx: 28, nearFade: 5.0, shuffle: true });
    const dust = makePoints(data.dust, { bright: 1, minPx: 1.0, maxPx: 28, nearFade: 4.0, dust: true, renderOrder: 1, shuffle: true });
    group.add(stars, dust);
    world.add(group, mw.pos, 1);
    const g = { o: mw, group, stars, dust, normal: new THREE.Vector3(0, 1, 0) };
    addImpostor(g, renderer, world, quality, false);
    out.galaxies.push(g);
    await step(t('Milchstraße: {n} Sternwolken generiert', { n: fmtNum(data.stars.count, 0) }));
  }

  // Andere Galaxien
  for (const o of CATALOG) {
    if (o.cat !== 'galaxy' || o.id === 'milkyway') continue;
    const data = generateGalaxy(o.gal, o.radius, o.id, quality);
    const group = new THREE.Group();
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), o.gal.normal);
    group.rotateY(new Rng(o.id).next() * Math.PI * 2);
    const stars = makePoints(data.stars, { bright: 1, minPx: 1.0, maxPx: 48, nearFade: 1.5, shuffle: true });
    group.add(stars);
    let dust = null;
    if (data.dust.count > 0) {
      dust = makePoints(data.dust, { bright: 1, minPx: 1.0, maxPx: 48, nearFade: 1.5, dust: true, renderOrder: 1, shuffle: true });
      group.add(dust);
    }
    world.add(group, o.pos, 1);
    const g = { o, group, stars, dust, normal: o.gal.normal.clone() };
    const k = o.gal.kind;
    if (!o.gal.jet && k !== 'starburst' && k !== 'sombrero') addImpostor(g, renderer, world, quality, k === 'elliptical' || k === 'dwarf');
    out.galaxies.push(g);
    await step(o.name);
  }

  // Nebel & Sternhaufen
  for (const o of CATALOG) {
    if (o.cat !== 'nebula') continue;
    const data = generateNebula(o.nebula, o.radius, o.id, quality);
    const group = new THREE.Group();
    const rng = new Rng(o.id + 'rot');
    group.rotation.set(rng.next() * 6.28, rng.next() * 6.28, rng.next() * 6.28);
    const stars = makePoints(data.stars, { bright: 1, minPx: 1.0, maxPx: 90, nearFade: 0.8, shuffle: true });
    group.add(stars);
    let dust = null;
    if (data.dust.count > 0) {
      dust = makePoints(data.dust, { bright: 1, minPx: 1.0, maxPx: 90, nearFade: 0.8, dust: true, renderOrder: 1, shuffle: true });
      group.add(dust);
    }
    world.add(group, o.pos, 1);
    out.nebulae.push({ o, group, stars, dust });
    await step(o.name);
  }

  // Schwarze Löcher
  for (const o of CATALOG) {
    if (o.cat !== 'blackhole') continue;
    out.blackholes.push(makeBlackHole(world, o));
  }
  // Quasare als helle Punkte
  for (const o of CATALOG) {
    if (!o.quasar && !o.early) continue;
    const s = makeGlowSprite(new THREE.Color(o.quasar ? 0.75 : 1.0, o.quasar ? 0.85 : 0.55, o.quasar ? 1.0 : 0.4), 1);
    world.add(s, o.pos, o.quasar ? 160000 : 9000);
    const data = { positions: new Float32Array([0, 0, 0]), colors: new Float32Array(o.quasar ? [6, 7, 9] : [3, 1.6, 1.0]), sizes: new Float32Array([o.quasar ? 400000 : 12000]) };
    const p = makePoints(data, { bright: 1, minPx: 2.0, maxPx: 30 });
    world.add(p, o.pos, 1);
  }
  await step(t('Akkretionsscheiben & Quasare'));

  // Kosmisches Netz
  const forcedLocal = ['virgo', 'fornaxc', 'greatattractor', 'coma', 'perseusc', 'hydrac', 'centaurusc'].map((id) => {
    const p = BY_ID.get(id).pos;
    return { x: p.x, y: p.y, z: p.z, m: id === 'virgo' || id === 'coma' || id === 'greatattractor' ? 10 : 5 };
  });
  const lg = BY_ID.get('localgroup').pos;
  const webLocal = generateWeb({
    rMax: 380 * MLY, cell: 32 * MLY, count: Math.floor(90000 * quality), seed: 11, forced: forcedLocal,
    exclude: [{ x: lg.x, y: lg.y, z: lg.z, r: 6 * MLY }], galSize: 55000,
  });
  out.webs.push(addWeb(world, webLocal, 2.5, 'local', 180));
  await step(t('Lokales Netz: {n} Galaxien', { n: fmtNum(webLocal.count, 0) }));

  const b = BY_ID.get('bootes').pos;
  const forcedMid = ['shapley', 'herculesc', 'coma', 'perseusc'].map((id) => {
    const p = BY_ID.get(id).pos;
    return { x: p.x, y: p.y, z: p.z, m: 11 };
  });
  // Sloan Great Wall als Kette massereicher Knoten
  for (let i = 0; i < 9; i++) {
    const p = radecToWorld(11.8 + i * 0.32, 1 + Math.sin(i) * 3, (0.95 + 0.05 * Math.sin(i * 1.3)) * GLY);
    forcedMid.push({ x: p.x, y: p.y, z: p.z, m: 9 });
  }
  const webMid = generateWeb({
    rMin: 330 * MLY, rMax: 4.2 * GLY, cell: 160 * MLY, count: Math.floor(150000 * quality), seed: 22, forced: forcedMid,
    exclude: [{ x: b.x, y: b.y, z: b.z, r: 165 * MLY }], galSize: 3.5 * MLY,
  });
  out.webs.push(addWeb(world, webMid, 3.5, 'mid', 3.5));
  out.webData = { local: webLocal.positions, mid: webMid.positions };
  await step(t('Supercluster-Netz: {n} Galaxiengruppen', { n: fmtNum(webMid.count, 0) }));

  const webFar = generateWeb({ rMin: 3.8 * GLY, rMax: 46 * GLY, cell: 2.4 * GLY, count: Math.floor(140000 * quality), seed: 33, galSize: 125 * MLY, nodeProb: 0.6 });
  out.webs.push(addWeb(world, webFar, 1.2, 'far'));
  await step(t('Tiefes Universum: {n} Strukturen', { n: fmtNum(webFar.count, 0) }));

  // CMB
  const cmb = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), makeCMBMaterial(bakeCMBTexture(renderer, quality > 1 ? 4096 : 2048)));
  cmb.renderOrder = -1;
  world.add(cmb, ZERO, 46.5 * GLY);
  out.cmb = cmb;
  await step(t('Kosmischer Mikrowellenhintergrund'));

  // Markierung für ausgewählte Regionen
  const hl = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1, 2)),
    new THREE.LineBasicMaterial({ color: 0x5ef2ff, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  hl.visible = false;
  hl.frustumCulled = false;
  out.highlight = { mesh: hl, pos: new THREE.Vector3(), item: world.add(hl, new THREE.Vector3(), 1) };
  out.highlight.pos = out.highlight.item.upos;
  await step(t('Markierungen'));
  return out;
}

function addImpostor(g, renderer, world, quality, billboard) {
  const R = g.o.radius;
  let size = R > 45000 ? 2048 : R > 12000 ? 1024 : 512;
  if (quality <= 1) size /= 2;
  const tex = bakeGalaxy(renderer, g.group, R, size);
  const mesh = makeImpostorMesh(tex, R, billboard);
  if (billboard) world.add(mesh, g.o.pos, 1);
  else g.group.add(mesh);
  g.imp = mesh;
  g.billboard = billboard;
}

function addWeb(world, data, bright, name, nearFade = 0.6) {
  // nearFade: in Kameranähe übernimmt das Galaxienfeld (echte Galaxien statt Punkte)
  const pts = makePoints(data, { bright, minPx: 1.0, maxPx: 22, nearFade, shuffle: true });
  pts.name = 'web-' + name;
  world.add(pts, ZERO, 1);
  return pts;
}

function makeBlackHole(world, o) {
  const group = new THREE.Group();
  const horizon = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  group.add(horizon);
  const disk = new THREE.Mesh(new THREE.RingGeometry(2.6, 14, 192, 8), makeDiskMaterial(2.6, 14, 0.55));
  disk.rotation.x = -Math.PI / 2;
  group.add(disk);
  // Linsenbild der Rückseite (vertikaler Bogen)
  const lens = new THREE.Mesh(new THREE.RingGeometry(2.7, 6, 128, 2), makeDiskMaterial(2.7, 6, 0.3));
  group.add(lens);
  group.userData.lens = lens;
  const ringMat = new THREE.SpriteMaterial({ map: photonRingTexture(), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  const ring = new THREE.Sprite(ringMat);
  ring.scale.setScalar(13.5);
  group.add(ring);
  if (o.bh.jet) {
    const n = 3000;
    const rng = new Rng(o.id);
    const positions = new Float32Array(n * 3), colors = new Float32Array(n * 3), sizes = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = Math.pow(rng.next(), 0.6);
      const side = i % 3 === 0 ? -1 : 1;
      const h = (3 + t * 400) * side;
      const w = 0.5 + t * 18;
      positions.set([rng.gauss() * w, h, rng.gauss() * w], i * 3);
      const k = (side > 0 ? 1.4 : 0.6) * (1 - t * 0.7);
      colors.set([0.5 * k, 0.7 * k, 1.0 * k], i * 3);
      sizes[i] = 2 + t * 18;
    }
    group.add(makePoints({ positions, colors, sizes }, { bright: 2.5, minPx: 1, maxPx: 60 }));
  }
  const parent = o.parent ? BY_ID.get(o.parent) : null;
  const up = parent?.gal?.normal || new THREE.Vector3(0.15, 1, 0.1).normalize();
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
  world.add(group, o.pos, o.bh.rs);
  return { o, group, lens };
}

export function updateUniverse(u, camPos, k, cam) {
  // Milchstraße von innen gedämpft (sonst überstrahlt das Band)
  const mw = u.galaxies[0];
  const h = Math.abs(camPos.y - GC_POS.y);
  const rho = Math.hypot(camPos.x - GC_POS.x, camPos.z - GC_POS.z);
  const inside = (1 - smooth(1500, 30000, h)) * (1 - smooth(45000, 80000, rho));
  const proj = shared.uProj.value;
  // Hintergrund-Galaxien von innerhalb der Milchstraße stark abdunkeln (real kaum sichtbar)
  const dc = camPos.length();
  const webDim = 0.04 + 0.96 * smooth(1.5e5, 8e6, dc);
  u.webs.forEach((w) => { w.material.uniforms.uBright.value = w.userData.bright * webDim; });
  // Detailstufen: Punktzahl ~ belegte Bildschirmfläche
  const lodFor = (o, total, isInside) => {
    const d = camPos.distanceTo(o.pos);
    if (isInside || d < o.radius * 1.6) return total;
    const pxR = (o.radius * proj) / d;
    return Math.min(total, Math.max(pxR < 2 ? 40 : 600, pxR * pxR * (u.lodK ?? 1.8)));
  };
  const toGal = new THREE.Vector3();
  for (const g of u.galaxies) {
    const pano = g === mw ? u.panoAlpha || 0 : 0;
    const base = g === mw ? (1 - 0.72 * inside) * (1 - 0.96 * pano) : 1;
    // Überblendung Foto <-> 3D-Partikel: Foto aus der Ferne und bei nicht zu flachem Blickwinkel
    let w = 0;
    if (g.imp) {
      toGal.subVectors(g.o.pos, camPos);
      const d = toGal.length();
      const dn = d / g.o.radius;
      const facing = g.billboard ? 1 : smooth(0.12, 0.42, Math.abs(toGal.dot(g.normal)) / d);
      w = facing * smooth(1.15, 2.2, dn);
      if (g === mw) w *= 1 - inside;
      g.imp.material.uniforms.uAlpha.value = w * base;
      g.imp.visible = w > 0.002;
      if (g.billboard) g.imp.quaternion.copy(cam.quaternion);
    }
    const partVis = w < 0.995;
    g.stars.visible = partVis;
    if (g.dust) g.dust.visible = partVis;
    if (!partVis) continue;
    const n = lodFor(g.o, g.stars.userData.total, g === mw && inside > 0.01);
    setLod(g.stars, n, base * (1 - w));
    if (g.dust) setLod(g.dust, n * (g.dust.userData.total / g.stars.userData.total), (1 - w) * (1 - 0.97 * pano));
  }
  for (const nb of u.nebulae) {
    const n = lodFor(nb.o, nb.stars.userData.total, false);
    setLod(nb.stars, n, 1);
    if (nb.dust) setLod(nb.dust, n * (nb.dust.userData.total / nb.stars.userData.total), 1);
  }
  mw.stars.material.uniforms.uMaxPx.value = 28 - 14 * inside;
  mw.dust.material.uniforms.uMaxPx.value = 28 - 10 * inside;
  // CMB-Sichtbarkeit
  const d = camPos.length();
  const alpha = Math.min(1, Math.max(0, (d - 16 * GLY) / (22 * GLY)));
  const m = u.cmb.material.uniforms;
  m.uAlpha.value = alpha;
  m.uOutside.value = Math.min(1, Math.max(0, (d - 40 * GLY) / (12 * GLY)));
  u.cmb.visible = alpha > 0.001;
  // Linsenbogen der Schwarzen Löcher zur Kamera drehen
  for (const bh of u.blackholes) {
    const dist = camPos.distanceTo(bh.o.pos);
    bh.group.visible = dist < bh.o.bh.rs * 2e6;
    if (!bh.group.visible) continue;
    // Linsenbogen: senkrecht stehender Ring, der zur Kamera zeigt (Projektion in die Scheibenebene)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(bh.group.quaternion);
    const toCam = camPos.clone().sub(bh.o.pos).normalize();
    toCam.sub(up.multiplyScalar(toCam.dot(up)));
    if (toCam.lengthSq() < 1e-8) continue;
    bh.group.updateMatrixWorld(true);
    const gp = bh.group.position;
    bh.lens.lookAt(gp.x + toCam.x, gp.y + toCam.y, gp.z + toCam.z);
  }
}

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
