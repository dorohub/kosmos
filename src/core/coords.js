import * as THREE from 'three';
import { DEG } from './units.js';

// Weltkoordinaten (Lichtjahre), Ursprung = Sonne.
// Abbildung galaktisch -> Welt: X = Richtung galaktisches Zentrum, Y = galaktischer Nordpol, Z = -(Richtung l=90°).
export const SUN_TO_GC = 26670;
export const GC_POS = new THREE.Vector3(SUN_TO_GC, -65, 0);

export function galToWorld(gx, gy, gz, out = new THREE.Vector3()) {
  return out.set(gx, gz, -gy);
}

export function worldToGal(v) {
  return { gx: v.x, gy: -v.z, gz: v.y };
}

// Äquatorial (J2000) -> galaktisch
const T = [
  [-0.0548755604, -0.873437090, -0.4838350155],
  [0.4941094279, -0.44482963, 0.7469822445],
  [-0.867666149, -0.1980763734, 0.4559837762],
];

export function eqVecToWorld(xe, ye, ze, out = new THREE.Vector3()) {
  const gx = T[0][0] * xe + T[0][1] * ye + T[0][2] * ze;
  const gy = T[1][0] * xe + T[1][1] * ye + T[1][2] * ze;
  const gz = T[2][0] * xe + T[2][1] * ye + T[2][2] * ze;
  return galToWorld(gx, gy, gz, out);
}

export function radecToDir(raHours, decDeg, out = new THREE.Vector3()) {
  const a = raHours * 15 * DEG;
  const d = decDeg * DEG;
  return eqVecToWorld(Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d), out);
}

export function radecToWorld(raHours, decDeg, distLy, out = new THREE.Vector3()) {
  return radecToDir(raHours, decDeg, out).multiplyScalar(distLy);
}

// Ekliptik -> Welt
const EPS = 23.4393 * DEG;
export function eclToWorld(x, y, z, out = new THREE.Vector3()) {
  const ye = y * Math.cos(EPS) - z * Math.sin(EPS);
  const ze = y * Math.sin(EPS) + z * Math.cos(EPS);
  return eqVecToWorld(x, ye, ze, out);
}

export const ECL_NORTH = eclToWorld(0, 0, 1).normalize();
export const EQ_NORTH = eqVecToWorld(0, 0, 1).normalize();
export const GAL_NORTH = new THREE.Vector3(0, 1, 0);

// Orbit-Rahmen: lokale Y-Achse = up, lokale X-Achse ~ ref
export function frameFromUp(up, ref = null, out = new THREE.Quaternion()) {
  const Y = up.clone().normalize();
  let r = ref ? ref.clone() : new THREE.Vector3(1, 0, 0);
  if (Math.abs(r.dot(Y)) > 0.95) r = Math.abs(Y.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  const X = r.sub(Y.clone().multiplyScalar(r.dot(Y))).normalize();
  const Z = new THREE.Vector3().crossVectors(X, Y).normalize();
  const m = new THREE.Matrix4().makeBasis(X, Y, Z);
  return out.setFromRotationMatrix(m);
}

export function galacticLB(v) {
  const g = worldToGal(v);
  const d = Math.hypot(g.gx, g.gy, g.gz);
  if (d === 0) return { l: 0, b: 0, d: 0 };
  let l = Math.atan2(g.gy, g.gx) / DEG;
  if (l < 0) l += 360;
  return { l, b: Math.asin(g.gz / d) / DEG, d };
}

// Normale einer Galaxie aus Inklination (zur Sichtlinie) & Positionswinkel
export function galaxyNormal(pos, inclDeg, paDeg) {
  const los = pos.clone().normalize();
  const helper = Math.abs(los.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const e1 = new THREE.Vector3().crossVectors(los, helper).normalize();
  const e2 = new THREE.Vector3().crossVectors(los, e1).normalize();
  const i = inclDeg * DEG, p = paDeg * DEG;
  return los.multiplyScalar(Math.cos(i))
    .add(e1.multiplyScalar(Math.sin(i) * Math.cos(p)))
    .add(e2.multiplyScalar(Math.sin(i) * Math.sin(p)))
    .normalize();
}
