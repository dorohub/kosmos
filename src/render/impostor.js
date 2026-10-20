import * as THREE from 'three';
import { shared } from './shaders.js';

// "Fotografiert" eine Partikelgalaxie von oben in eine Textur (einmalig beim Start).
// Aus der Ferne wird dieses weiche Bild gezeigt, aus der Nähe die 3D-Partikel.

let bakeRT = null;
const encodeMat = new THREE.ShaderMaterial({
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  // Wurzel-Kodierung: mehr Präzision in den lichtschwachen Außenbereichen bei 8 Bit
  fragmentShader: 'uniform sampler2D tSrc; varying vec2 vUv; void main(){ vec3 c = texture2D(tSrc, vUv).rgb; gl_FragColor = vec4(sqrt(clamp(c / 6.0, 0.0, 1.0)), 1.0); }',
  uniforms: { tSrc: { value: null } },
  depthTest: false, depthWrite: false,
});
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), encodeMat);
const quadScene = new THREE.Scene();
quadScene.add(quad);
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

export function bakeGalaxy(renderer, group, R, size) {
  const BAKE = 2048;
  if (!bakeRT) {
    bakeRT = new THREE.WebGLRenderTarget(BAKE, BAKE, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  }
  const parent = group.parent;
  const saved = { p: group.position.clone(), q: group.quaternion.clone(), s: group.scale.clone() };
  const scene = new THREE.Scene();
  scene.add(group);
  group.position.set(0, 0, 0);
  group.quaternion.identity();
  group.scale.setScalar(1);
  group.updateMatrixWorld(true);
  // Nahezu orthografische Ansicht von oben
  const half = R * 1.15;
  const dist = R * 12;
  const fov = 2 * Math.atan(half / dist);
  const cam = new THREE.PerspectiveCamera((fov * 180) / Math.PI, 1, dist - R * 3, dist + R * 3);
  cam.position.set(0, dist, 0);
  cam.up.set(0, 0, -1);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  const prevProj = shared.uProj.value, prevPR = shared.uPixelRatio.value;
  shared.uProj.value = BAKE / (2 * Math.tan(fov / 2));
  shared.uPixelRatio.value = BAKE / 900;
  // LOD-Werte zurücksetzen, damit alle Partikel einfließen
  const pts = [];
  group.traverse((o) => { if (o.isPoints) { pts.push([o, o.geometry.drawRange.count, o.material.uniforms.uBoost.value, o.material.uniforms.uBright.value]); o.geometry.setDrawRange(0, Infinity); o.material.uniforms.uBoost.value = 1; } });
  const prevRT = renderer.getRenderTarget();
  const prevClear = renderer.getClearColor(new THREE.Color());
  renderer.setClearColor(0x000000, 1);
  renderer.setRenderTarget(bakeRT);
  renderer.clear();
  renderer.render(scene, cam);
  // in 8-Bit-Textur der gewünschten Größe kodieren (Mipmaps der Quelle glätten beim Verkleinern)
  const out = new THREE.WebGLRenderTarget(size, size, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, colorSpace: THREE.NoColorSpace });
  encodeMat.uniforms.tSrc.value = bakeRT.texture;
  renderer.setRenderTarget(out);
  renderer.render(quadScene, quadCam);
  renderer.setRenderTarget(prevRT);
  renderer.setClearColor(prevClear, 1);
  shared.uProj.value = prevProj;
  shared.uPixelRatio.value = prevPR;
  for (const [o, n, boost, bright] of pts) { o.geometry.setDrawRange(0, n); o.material.uniforms.uBoost.value = boost; o.material.uniforms.uBright.value = bright; }
  // zurück in die Szene
  parent.add(group);
  group.position.copy(saved.p);
  group.quaternion.copy(saved.q);
  group.scale.copy(saved.s);
  return out.texture;
}

const impVert = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;
const impFrag = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform sampler2D uMap; uniform float uAlpha;
varying vec2 vUv;
void main() {
  #include <logdepthbuf_fragment>
  vec3 e = texture2D(uMap, vUv).rgb;
  vec3 c = e * e * 6.0;
  float edge = smoothstep(0.5, 0.42, length(vUv - 0.5));
  gl_FragColor = vec4(c * uAlpha * edge, 1.0);
}`;

export function makeImpostorMesh(tex, R, billboard) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: impVert, fragmentShader: impFrag,
    uniforms: { uMap: { value: tex }, uAlpha: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const geo = new THREE.PlaneGeometry(R * 2.3, R * 2.3);
  if (!billboard) geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  return m;
}
