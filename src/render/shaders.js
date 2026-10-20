import * as THREE from 'three';

// Gemeinsame Uniforms (werden pro Frame aktualisiert)
export const shared = {
  uProj: { value: 800 },
  uTime: { value: 0 },
  uPixelRatio: { value: 1 },
};

// --- Generischer Partikel-Shader (Galaxien, Nebel, kosmisches Netz) -------
const pointVert = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float size;
attribute vec3 acolor;
#ifdef USE_SHAPE
attribute vec2 shape;
varying vec2 vShape;
#endif
uniform float uProj;
uniform float uPixelRatio;
uniform float uBright;
uniform float uMinPx;
uniform float uMaxPx;
uniform float uNearFade;
uniform float uFadeLarge;
uniform float uBoost;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float sc = length(modelViewMatrix[0].xyz);
  float dist = -mv.z;
  vColor = acolor;
  #ifdef USE_SHAPE
  vShape = shape;
  #endif
  if (dist <= 0.0) { gl_PointSize = 0.0; gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vAlpha = 0.0; return; }
  float px = size * sc * uProj / dist;
  float a = uBright;
  float dLocal = length(mv.xyz) / sc;
  if (uNearFade > 0.0) a *= smoothstep(uNearFade * 0.4, uNearFade, dLocal / size);
  float minPx = uMinPx * uPixelRatio;
  float maxPx = uMaxPx * uPixelRatio;
  if (px < minPx) { a *= (px * px) / (minPx * minPx); px = minPx; }
  if (px > maxPx) { a *= maxPx / px; px = maxPx; }
  if (uFadeLarge > 0.0) a *= 1.0 - smoothstep(uFadeLarge * 0.5, uFadeLarge, px / uPixelRatio);
  float cull = a;
  a *= uBoost;
  vAlpha = a;
  gl_PointSize = px;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
  // unsichtbare Punkte vor der Rasterisierung verwerfen (sonst stapeln sie sich auf einem Pixel)
  if (cull < 0.0004) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; }
}`

const pointFrag = /* glsl */ `
#include <logdepthbuf_pars_fragment>
varying vec3 vColor;
varying float vAlpha;
#ifdef USE_SHAPE
varying vec2 vShape;
#endif
void main() {
  #include <logdepthbuf_fragment>
  vec2 p = gl_PointCoord - 0.5;
  #ifdef USE_SHAPE
  float c = cos(vShape.x), s = sin(vShape.x);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  p.y /= max(vShape.y, 0.15);
  #endif
  float d = length(p) * 2.0;
  if (d > 1.0) discard;
  float f = exp(-d * d * 4.5) * (1.0 - d * d);
  #ifdef DUST
  gl_FragColor = vec4(0.0, 0.0, 0.0, clamp(f * vAlpha * vColor.r, 0.0, 1.0));
  #else
  gl_FragColor = vec4(vColor * f * vAlpha, 1.0);
  #endif
}`;

export function makePointMaterial(opts = {}) {
  const defines = {};
  if (opts.shape) defines.USE_SHAPE = '';
  if (opts.dust) defines.DUST = '';
  const m = new THREE.ShaderMaterial({
    vertexShader: pointVert,
    fragmentShader: pointFrag,
    defines,
    uniforms: {
      uProj: shared.uProj,
      uPixelRatio: shared.uPixelRatio,
      uBright: { value: opts.bright ?? 1 },
      uMinPx: { value: opts.minPx ?? 1.2 },
      uMaxPx: { value: opts.maxPx ?? 64 },
      uNearFade: { value: opts.nearFade ?? 0 },
      uFadeLarge: { value: opts.fadeLarge ?? 0 },
      uBoost: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
  if (opts.dust) {
    m.blending = THREE.CustomBlending;
    m.blendEquation = THREE.AddEquation;
    m.blendSrc = THREE.ZeroFactor;
    m.blendDst = THREE.OneMinusSrcAlphaFactor;
  } else {
    m.blending = THREE.AdditiveBlending;
  }
  return m;
}

// Punkte zufällig mischen, damit jeder Präfix (drawRange) eine repräsentative Stichprobe ist
function shuffleData(d) {
  const n = d.sizes.length;
  const P = d.positions, C = d.colors, S = d.sizes, H = d.shapes;
  let seed = 1234567;
  for (let i = n - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    for (let k = 0; k < 3; k++) {
      let t = P[i * 3 + k]; P[i * 3 + k] = P[j * 3 + k]; P[j * 3 + k] = t;
      t = C[i * 3 + k]; C[i * 3 + k] = C[j * 3 + k]; C[j * 3 + k] = t;
    }
    let t = S[i]; S[i] = S[j]; S[j] = t;
    if (H) { t = H[i * 2]; H[i * 2] = H[j * 2]; H[j * 2] = t; t = H[i * 2 + 1]; H[i * 2 + 1] = H[j * 2 + 1]; H[j * 2 + 1] = t; }
  }
}

// Detailstufe: nur die ersten n Punkte zeichnen, Helligkeit so anheben, dass der Gesamteindruck gleich bleibt
export function setLod(points, n, baseBright = 1) {
  const N = points.userData.total;
  n = Math.max(1, Math.min(N, Math.floor(n)));
  points.geometry.setDrawRange(0, n);
  points.material.uniforms.uBright.value = baseBright;
  points.material.uniforms.uBoost.value = N / n;
}

export function makePoints(data, opts = {}) {
  if (opts.shuffle) shuffleData(data);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  g.setAttribute('acolor', new THREE.BufferAttribute(data.colors, 3));
  g.setAttribute('size', new THREE.BufferAttribute(data.sizes, 1));
  if (data.shapes) g.setAttribute('shape', new THREE.BufferAttribute(data.shapes, 2));
  g.computeBoundingSphere();
  const pts = new THREE.Points(g, makePointMaterial({ ...opts, shape: !!data.shapes }));
  pts.userData.total = data.sizes.length;
  pts.userData.bright = opts.bright ?? 1;
  pts.renderOrder = opts.renderOrder ?? 0;
  return pts;
}

// --- Stern-Shader (Helligkeit nach Leuchtkraft/Entfernung²) ----------------
const starVert = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float lum;
attribute vec3 acolor;
#ifdef USE_RADIUS
attribute float radius;
uniform float uProj;
#endif
uniform float uPixelRatio;
uniform float uMagLimit;
uniform float uBright;
uniform float uNearHide;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float sc = length(modelViewMatrix[0].xyz);
  float dLy = max(length(mv.xyz) / sc, 1e-12);
  float I = lum / (dLy * dLy);
  float m = -2.5 * log(max(I, 1e-30)) / log(10.0);
  float px = clamp(3.9 - 0.42 * m, 1.0, 6.5) * uPixelRatio;
  float a = clamp((uMagLimit - m) / 3.0, 0.0, 1.0) * uBright;
  if (uNearHide > 0.0) a *= smoothstep(uNearHide * 0.5, uNearHide, dLy);
  #ifdef USE_RADIUS
  float discPx = radius * sc * uProj / max(-mv.z, 1e-30);
  a *= 1.0 - smoothstep(1.5, 5.0, discPx);
  #endif
  vColor = acolor;
  vAlpha = a;
  gl_PointSize = px;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
  if (a < 0.003 || -mv.z <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; }
}`
const starFrag = /* glsl */ `
#include <logdepthbuf_pars_fragment>
varying vec3 vColor;
varying float vAlpha;
void main() {
  #include <logdepthbuf_fragment>
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p) * 2.0;
  if (d > 1.0) discard;
  float core = exp(-d * d * 10.0);
  float halo = exp(-d * 4.5) * 0.18;
  gl_FragColor = vec4(vColor * (core * 1.6 + halo) * vAlpha, 1.0);
}`;

export function makeStarMaterial(opts = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: starVert,
    fragmentShader: starFrag,
    defines: opts.radius ? { USE_RADIUS: '' } : {},
    uniforms: {
      uProj: shared.uProj,
      uPixelRatio: shared.uPixelRatio,
      uMagLimit: { value: opts.magLimit ?? 9.5 },
      uBright: { value: opts.bright ?? 1 },
      uNearHide: { value: opts.nearHide ?? 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// --- GLSL-Rauschen (Ashima / Gustavson) ------------------------------------
export const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){float s=0.0;float a=0.5;for(int i=0;i<5;i++){s+=a*snoise(p);p*=2.02;a*=0.5;}return s;}
float fbm3(vec3 p){float s=0.0;float a=0.5;for(int i=0;i<3;i++){s+=a*snoise(p);p*=2.02;a*=0.5;}return s;}
`;

// Weiche radiale Textur für Glow-Sprites
let _glowTex = null;
export function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.08, 'rgba(255,255,255,0.75)');
  gr.addColorStop(0.22, 'rgba(255,255,255,0.28)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.07)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  _glowTex = new THREE.CanvasTexture(c);
  _glowTex.colorSpace = THREE.SRGBColorSpace;
  return _glowTex;
}

let _ringTex = null;
export function photonRingTexture() {
  if (_ringTex) return _ringTex;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(256, 256, 0, 256, 256, 256);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(0.36, 'rgba(0,0,0,0)');
  gr.addColorStop(0.385, 'rgba(255,220,170,1)');
  gr.addColorStop(0.42, 'rgba(255,150,60,0.45)');
  gr.addColorStop(0.6, 'rgba(255,110,40,0.12)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 512, 512);
  _ringTex = new THREE.CanvasTexture(c);
  _ringTex.colorSpace = THREE.SRGBColorSpace;
  return _ringTex;
}

export function makeGlowSprite(color, opacity = 1) {
  const m = new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  return new THREE.Sprite(m);
}
