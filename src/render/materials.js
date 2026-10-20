import * as THREE from 'three';
import { NOISE_GLSL, shared } from './shaders.js';

const surfVert = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vObjN;
varying vec3 vWorldN;
varying vec3 vWorldPos;
varying vec2 vUv;
void main() {
  vObjN = normal;
  vUv = uv;
  vWorldN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;

// ---------------- Planeten -----------------------------------------------------
const planetFrag = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform vec3 uSunDir;
uniform int uLook;
uniform float uTime;
uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3;
uniform sampler2D uMap; uniform float uUseMap;
uniform sampler2D uNight; uniform float uUseNight;
uniform sampler2D uSpec; uniform float uUseSpec;
uniform vec3 uLightColor;
uniform vec3 uSeed;
uniform mat3 uRot;
varying vec3 vObjN; varying vec3 vWorldN; varying vec3 vWorldPos; varying vec2 vUv;
${NOISE_GLSL}
void main() {
  #include <logdepthbuf_fragment>
  vec3 p = normalize(vObjN);
  vec3 N = normalize(vWorldN);
  vec3 L = normalize(uSunDir);
  vec3 V = normalize(-vWorldPos);
  float lat = p.y;
  vec3 col = uC1;
  float specMask = 0.0;
  vec3 night = vec3(0.0);
  vec3 Nl = N;
  float emissive = 0.0;
  vec3 emisCol = vec3(0.0);
  float cloudA = 0.0;
  if (uUseMap > 0.5) {
    col = texture2D(uMap, vUv).rgb;
    if (uUseSpec > 0.5) specMask = texture2D(uSpec, vUv).r;
    if (uUseNight > 0.5) night = texture2D(uNight, vUv).rgb * vec3(1.0, 0.85, 0.6) * 1.8;
  } else if (uLook >= 10) {
    vec3 q = p + uSeed;
    if (uLook == 15 || uLook == 17 || uLook == 18) {
      // Gasriesen & Giftwelten: Wolkenbänder und Stürme
      float bands = uLook == 17 ? 11.0 : uLook == 18 ? 4.0 : 6.0;
      float warp = fbm(vec3(p.x * 2.0, p.y * 9.0, p.z * 2.0) + uSeed + vec3(uTime * 0.003, 0.0, 0.0));
      float b = lat * bands + warp * (uLook == 18 ? 0.35 : 1.2);
      col = mix(uC1, uC2, 0.5 + 0.5 * sin(b * 3.14159));
      col = mix(col, uC3, (0.5 + 0.5 * sin(b * 7.1 + 1.7)) * 0.35);
      if (uLook == 17) {
        vec3 sp = normalize(vec3(sin(uSeed.x * 3.0), (fract(uSeed.y) - 0.5) * 0.9, cos(uSeed.x * 3.0)));
        vec3 dp = p - sp;
        float e = length(vec2(length(dp.xz) * 0.6, dp.y * 1.2));
        float sw = snoise(vec3(atan(dp.z, dp.x) * 2.0, e * 30.0, uSeed.z));
        col = mix(col, uC3 * 1.15, smoothstep(0.12, 0.05, e) * (0.7 + 0.3 * sw));
      }
      if (uLook == 15) cloudA = smoothstep(0.0, 0.5, fbm3(vec3(p.x * 3.0, p.y * 8.0, p.z * 3.0) + uSeed * 3.0)) * 0.35;
    } else {
      // Feste Oberflächen mit Relief (Normale aus dem Höhenfeld)
      float h = fbm(q * 1.8);
      vec3 t1 = normalize(cross(abs(p.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), p));
      vec3 t2 = cross(p, t1);
      float eps = 0.004;
      float hx = fbm((p + t1 * eps + uSeed) * 1.8);
      float hy = fbm((p + t2 * eps + uSeed) * 1.8);
      float rough = uLook == 12 ? 0.5 : uLook == 11 ? 0.15 : 1.0;
      vec3 nObj = normalize(p - (t1 * (hx - h) + t2 * (hy - h)) / eps * 0.07 * rough);
      Nl = normalize(uRot * nObj);
      if (uLook == 10) {
        // Lavawelt: dunkle Kruste, glühende Risse und Lavaseen
        float rid = 1.0 - abs(snoise(q * 5.0));
        col = mix(vec3(0.05, 0.04, 0.035), vec3(0.2, 0.14, 0.1), smoothstep(-0.3, 0.4, h));
        float lava = smoothstep(0.94, 0.99, rid) * smoothstep(0.1, -0.2, h) + smoothstep(-0.34, -0.48, h);
        emissive = clamp(lava, 0.0, 1.0);
        emisCol = mix(vec3(1.6, 0.28, 0.03), vec3(2.4, 1.1, 0.25), smoothstep(0.975, 1.0, rid));
      } else if (uLook == 11) {
        // Ozeanwelt: endloses Meer mit Inselketten und Wirbelstürmen
        float land = smoothstep(0.42, 0.46, h);
        col = mix(mix(uC1 * 0.45, uC1, smoothstep(-0.4, 0.3, h)), mix(uC2, vec3(0.9), smoothstep(0.55, 0.7, h)), land);
        specMask = 1.0 - land;
        cloudA = smoothstep(0.1, 0.6, fbm(vec3(p.x * 2.5, p.y * 5.0, p.z * 2.5) + uSeed * 2.0 + vec3(uTime * 0.002, 0.0, 0.0)));
      } else if (uLook == 12) {
        // Eiswelt: Gletscher und blaue Spalten
        float cr = 1.0 - abs(snoise(q * 7.0));
        col = mix(vec3(0.85, 0.92, 1.0), uC1, smoothstep(-0.2, 0.4, h) * 0.6);
        col = mix(col, vec3(0.2, 0.42, 0.75), smoothstep(0.93, 0.99, cr) * 0.85);
        specMask = 0.35;
      } else if (uLook == 13) {
        // Wüstenwelt: Dünen, Canyons, Polkappen
        float dunes = 0.5 + 0.5 * sin(p.x * 40.0 + p.z * 25.0 + fbm(q * 3.0) * 8.0);
        col = mix(uC1, uC2, smoothstep(-0.3, 0.4, h));
        col *= 0.85 + 0.25 * dunes;
        float can = 1.0 - abs(snoise(q * 3.5));
        col = mix(col, uC3 * 0.45, smoothstep(0.94, 0.99, can));
        col = mix(col, vec3(0.95, 0.92, 0.88), smoothstep(0.88, 0.93, abs(lat) + h * 0.05));
      } else if (uLook == 14 || uLook == 19) {
        // Dschungel- bzw. erdähnliche Welt
        float land = smoothstep(0.02, 0.06, h);
        vec3 ocean = mix(uC1 * 0.35, uC1, smoothstep(-0.4, 0.0, h));
        vec3 veg = mix(uC2, uC2 * 0.55 + uC3 * 0.3, smoothstep(0.1, 0.4, fbm3(q * 4.0)));
        veg = mix(veg, vec3(0.42, 0.38, 0.33), smoothstep(0.35, 0.5, h));
        col = mix(ocean, veg, land);
        col = mix(col, vec3(0.93, 0.95, 1.0), smoothstep(0.82, 0.88, abs(lat) + h * 0.08));
        specMask = 1.0 - land;
        cloudA = smoothstep(0.2, 0.65, fbm(vec3(p.x * 2.2, p.y * 4.0, p.z * 2.2) + uSeed * 1.7 + vec3(uTime * 0.0015, 0.0, 0.0))) * 0.85;
      } else {
        // karge, verkraterte Welt
        float cr = snoise(q * 9.0);
        float ring = smoothstep(0.55, 0.62, cr) - smoothstep(0.62, 0.75, cr) * 0.6;
        col = mix(uC1, uC2, smoothstep(-0.3, 0.3, h)) * (0.85 + 0.3 * ring);
      }
    }
  } else if (uLook == 0) {
    float n = fbm(p * 1.7 + vec3(4.2, 1.3, 7.7));
    float land = smoothstep(0.03, 0.07, n);
    float m = fbm3(p * 7.0 + 3.0);
    vec3 ocean = mix(vec3(0.005, 0.03, 0.12), vec3(0.02, 0.12, 0.3), smoothstep(-0.35, 0.05, n));
    float dry = smoothstep(-0.05, 0.35, fbm3(p * 2.6 + 9.0) + (0.35 - abs(lat - 0.05)) * 0.6);
    vec3 landc = mix(vec3(0.06, 0.17, 0.05), vec3(0.55, 0.43, 0.25), dry);
    landc = mix(landc, vec3(0.32, 0.29, 0.26), smoothstep(0.28, 0.45, n + m * 0.1));
    col = mix(ocean, landc, land);
    float ice = smoothstep(0.8, 0.86, abs(lat) + m * 0.07);
    col = mix(col, vec3(0.9, 0.93, 0.97), ice);
    specMask = (1.0 - land) * (1.0 - ice);
    float city = pow(max(fbm(p * 22.0 + 1.0) + 0.15, 0.0), 2.5) * 5.0;
    night = vec3(1.0, 0.72, 0.38) * land * (1.0 - ice) * city * smoothstep(0.75, 0.3, abs(lat));
  } else if (uLook == 1) {
    float n = fbm(p * 2.2 + 1.0);
    col = mix(uC1, uC2, smoothstep(-0.2, 0.3, n));
    col = mix(col, uC3, smoothstep(0.25, 0.5, fbm3(p * 5.0)) * 0.5);
    col = mix(col, vec3(0.95, 0.93, 0.9), smoothstep(0.86, 0.9, abs(lat) + n * 0.05));
  } else if (uLook == 2 || uLook == 3 || uLook == 4 || uLook == 5) {
    float bands = uLook == 2 ? 9.0 : uLook == 3 ? 7.0 : 3.0;
    float warp = fbm(vec3(p.x * 2.0, p.y * 10.0, p.z * 2.0) + vec3(uTime * 0.004, 0.0, 0.0));
    float b = lat * bands + warp * (uLook <= 3 ? 0.9 : 0.25);
    float band = 0.5 + 0.5 * sin(b * 3.14159);
    float band2 = 0.5 + 0.5 * sin(b * 7.3 + 1.3);
    col = mix(uC1, uC2, band);
    col = mix(col, uC3, band2 * 0.3);
    if (uLook == 2) {
      vec3 spot = normalize(vec3(0.62, -0.38, 0.69));
      vec3 dp = p - spot;
      float e = length(vec2(length(dp.xz) * 0.55, dp.y));
      col = mix(col, vec3(0.72, 0.32, 0.2), smoothstep(0.09, 0.05, e));
    }
    if (uLook == 5) {
      vec3 spot = normalize(vec3(-0.5, -0.35, 0.79));
      col = mix(col, uC3 * 0.4, smoothstep(0.12, 0.06, distance(p, spot)));
    }
  } else if (uLook == 6 || uLook == 8 || uLook == 9) {
    float n = fbm(p * 3.0 + 2.0);
    float c = fbm3(p * 14.0);
    col = mix(uC1, uC2, smoothstep(-0.3, 0.3, n));
    col *= 0.8 + 0.35 * c;
    if (uLook == 8) col = mix(col, vec3(0.22, 0.22, 0.24), smoothstep(0.1, 0.25, fbm3(p * 1.6 + 5.0)) * 0.7);
    if (uLook == 9) {
      vec3 h = normalize(vec3(0.3, -0.05, 0.95));
      col = mix(col, vec3(0.95, 0.92, 0.86), smoothstep(0.42, 0.3, distance(p, h)));
    }
  } else if (uLook == 7) {
    float n = fbm(vec3(p.x * 2.0, p.y * 5.0, p.z * 2.0) + vec3(uTime * 0.002, 0.0, 0.0));
    col = mix(uC1, uC2, smoothstep(-0.3, 0.4, n));
  }
  float NdL = dot(N, L);
  float NdLb = dot(Nl, L);
  float diff = smoothstep(-0.08, 0.35, NdL) * (0.2 + 0.8 * max(NdLb, 0.0));
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(Nl, H), 0.0), 70.0) * specMask * 0.9 * step(0.0, NdL);
  vec3 c = col * diff * 1.1 * uLightColor + uLightColor * spec * 0.8;
  c += night * (1.0 - smoothstep(-0.18, 0.06, NdL)) * 0.9;
  c += col * 0.012;
  // Wolken & Glut
  c = mix(c, vec3(0.95) * uLightColor * smoothstep(-0.1, 0.4, NdL), cloudA);
  c += emisCol * emissive * (1.0 - cloudA);
  gl_FragColor = vec4(c, 1.0);
}`;

export function makePlanetMaterial(look, c1, c2, c3) {
  const looks = { earth: 0, mars: 1, jupiter: 2, saturn: 3, uranus: 4, neptune: 5, mercury: 6, venus: 7, moon: 8, pluto: 9,
    lava: 10, ocean: 11, ice: 12, desert: 13, jungle: 14, toxic: 15, barren: 16, gas: 17, icegiant: 18, terra: 19 };
  return new THREE.ShaderMaterial({
    vertexShader: surfVert,
    fragmentShader: planetFrag,
    uniforms: {
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uLook: { value: looks[look] ?? 6 },
      uTime: shared.uTime,
      uC1: { value: new THREE.Color(...c1) },
      uC2: { value: new THREE.Color(...c2) },
      uC3: { value: new THREE.Color(...c3) },
      uMap: { value: null }, uUseMap: { value: 0 },
      uNight: { value: null }, uUseNight: { value: 0 },
      uSpec: { value: null }, uUseSpec: { value: 0 },
      uLightColor: { value: new THREE.Color(1, 1, 1) },
      uSeed: { value: new THREE.Vector3(Math.random() * 50, Math.random() * 50, Math.random() * 50) },
      uRot: { value: new THREE.Matrix3() },
    },
  });
}

const cloudFrag = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform vec3 uSunDir; uniform float uTime; uniform sampler2D uMap; uniform float uUseMap;
varying vec3 vObjN; varying vec3 vWorldN; varying vec3 vWorldPos; varying vec2 vUv;
${NOISE_GLSL}
void main() {
  #include <logdepthbuf_fragment>
  vec3 p = normalize(vObjN);
  float a;
  if (uUseMap > 0.5) {
    a = texture2D(uMap, vUv).r;
    a = smoothstep(0.08, 0.9, a) * 0.95;
  } else {
    float n = fbm(p * 2.8 + vec3(uTime * 0.0015, 0.0, 0.0)) + 0.5 * fbm3(p * 9.0);
    a = smoothstep(0.28, 0.7, n) * 0.8;
  }
  float d = smoothstep(-0.1, 0.4, dot(normalize(vWorldN), normalize(uSunDir)));
  gl_FragColor = vec4(vec3(0.92) * d, a * (0.1 + 0.9 * d));
}`;
export function makeCloudMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: surfVert, fragmentShader: cloudFrag, transparent: true, depthWrite: false,
    uniforms: { uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uTime: shared.uTime, uMap: { value: null }, uUseMap: { value: 0 } },
  });
}

const atmoFrag = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform vec3 uSunDir; uniform vec3 uColor; uniform float uPower;
varying vec3 vObjN; varying vec3 vWorldN; varying vec3 vWorldPos; varying vec2 vUv;
void main() {
  #include <logdepthbuf_fragment>
  vec3 N = normalize(vWorldN);
  vec3 V = normalize(-vWorldPos);
  float rim = pow(1.0 - max(dot(N, V), 0.0), uPower);
  float day = smoothstep(-0.35, 0.4, dot(N, normalize(uSunDir)));
  gl_FragColor = vec4(uColor * rim * day * 1.1, 1.0);
}`;
export function makeAtmosphereMaterial(color, power = 3.0) {
  return new THREE.ShaderMaterial({
    vertexShader: surfVert, fragmentShader: atmoFrag, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uColor: { value: new THREE.Color(...color) }, uPower: { value: power } },
  });
}

// ---------------- Saturnringe ----------------------------------------------
const ringVert = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying float vR; varying vec3 vWorldPos;
void main() {
  vR = length(position.xy);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;
const ringFrag = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform vec3 uSunDir; uniform vec3 uNormal; uniform vec3 uCenter; uniform float uPlanetR;
uniform sampler2D uMap; uniform float uUseMap;
varying float vR; varying vec3 vWorldPos;
float h(float x) { return fract(sin(x * 12.9898) * 43758.5453); }
void main() {
  #include <logdepthbuf_fragment>
  float r = vR;
  float a = 0.0;
  if (r < 1.53) a = 0.22; else if (r < 1.95) a = 0.9; else if (r < 2.03) a = 0.06; else a = 0.62;
  float n = h(floor(r * 420.0)) * 0.5 + h(floor(r * 97.0)) * 0.5;
  a *= 0.7 + 0.3 * n;
  a *= smoothstep(0.003, 0.009, abs(r - 2.214));
  a *= smoothstep(1.235, 1.26, r) * (1.0 - smoothstep(2.25, 2.27, r));
  vec3 col = mix(vec3(0.62, 0.55, 0.45), vec3(0.95, 0.9, 0.8), n);
  if (uUseMap > 0.5) {
    vec4 t = texture2D(uMap, vec2(clamp((r - 1.24) / 1.03, 0.0, 1.0), 0.5));
    col = t.rgb;
    a = t.a * smoothstep(1.235, 1.25, r) * (1.0 - smoothstep(2.26, 2.27, r));
  }
  vec3 L = normalize(uSunDir);
  float lit = 0.3 + 0.7 * abs(dot(L, normalize(uNormal)));
  vec3 wp = vWorldPos - uCenter;
  float t = dot(wp, L);
  if (t < 0.0 && length(wp - L * t) < uPlanetR) lit *= 0.08;
  gl_FragColor = vec4(col * lit * 1.3, a);
}`;
export function makeRingMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: ringVert, fragmentShader: ringFrag, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uNormal: { value: new THREE.Vector3(0, 1, 0) },
      uCenter: { value: new THREE.Vector3() }, uPlanetR: { value: 1 },
      uMap: { value: null }, uUseMap: { value: 0 },
    },
  });
}

// ---------------- Sternoberfläche ------------------------------------------
const starSurfFrag = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor; uniform float uTime; uniform float uSpots; uniform float uScale;
uniform sampler2D uMap; uniform float uUseMap;
varying vec3 vObjN; varying vec3 vWorldN; varying vec3 vWorldPos; varying vec2 vUv;
${NOISE_GLSL}
void main() {
  #include <logdepthbuf_fragment>
  vec3 p = normalize(vObjN);
  float g = fbm(p * uScale + vec3(uTime * 0.02, uTime * 0.013, 0.0));
  float g2 = fbm3(p * uScale * 3.5 - vec3(uTime * 0.05));
  float mu = max(dot(normalize(vWorldN), normalize(-vWorldPos)), 0.0);
  float limb = 0.3 + 0.7 * pow(mu, 0.55);
  vec3 c = uColor * (1.3 + 0.7 * g + 0.35 * g2) * limb;
  float s = smoothstep(0.45, 0.75, snoise(p * 3.5 + 11.0)) * smoothstep(0.55, 0.3, abs(p.y)) * uSpots;
  c *= 1.0 - 0.55 * s;
  if (uUseMap > 0.5) {
    vec3 t = texture2D(uMap, vUv).rgb;
    c = t * (1.9 + 0.35 * g2) * limb * vec3(1.05, 0.95, 0.85);
  }
  c = mix(c * vec3(1.15, 0.85, 0.6), c, mu);
  gl_FragColor = vec4(c * 1.1, 1.0);
}`;
export function makeStarSurfaceMaterial(color, spots = 0, scale = 9) {
  return new THREE.ShaderMaterial({
    vertexShader: surfVert, fragmentShader: starSurfFrag,
    uniforms: { uColor: { value: new THREE.Color(...color) }, uTime: shared.uTime, uSpots: { value: spots }, uScale: { value: scale }, uMap: { value: null }, uUseMap: { value: 0 } },
  });
}

// ---------------- Akkretionsscheibe --------------------------------------------
const diskVert = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;
const diskFrag = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform float uTime; uniform float uIn; uniform float uOut; uniform float uGain;
varying vec2 vP;
${NOISE_GLSL}
void main() {
  #include <logdepthbuf_fragment>
  float r = length(vP);
  float a = atan(vP.y, vP.x);
  float t = clamp((r - uIn) / (uOut - uIn), 0.0, 1.0);
  vec3 hot = vec3(1.0, 0.95, 0.88) * 3.2;
  vec3 mid = vec3(1.0, 0.55, 0.18) * 1.7;
  vec3 cool = vec3(0.55, 0.12, 0.04) * 0.7;
  vec3 col = t < 0.3 ? mix(hot, mid, t / 0.3) : mix(mid, cool, (t - 0.3) / 0.7);
  float omega = 2.5 / pow(r / uIn, 1.5);
  float ang = a + uTime * omega * 0.4;
  float sw = snoise(vec3(cos(ang) * 2.0, sin(ang) * 2.0, log(r) * 6.0));
  float sw2 = snoise(vec3(cos(ang) * 6.0, sin(ang) * 6.0, log(r) * 18.0));
  float b = 0.65 + 0.35 * sw + 0.2 * sw2;
  float doppler = 1.0 + 0.55 * sin(a);
  float alpha = smoothstep(0.0, 0.04, t) * pow(1.0 - t, 1.4);
  gl_FragColor = vec4(col * b * doppler * alpha * uGain, 1.0);
}`;
export function makeDiskMaterial(inner, outer, gain = 1) {
  return new THREE.ShaderMaterial({
    vertexShader: diskVert, fragmentShader: diskFrag, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: shared.uTime, uIn: { value: inner }, uOut: { value: outer }, uGain: { value: gain } },
  });
}

// ---------------- Kosmischer Mikrowellenhintergrund ------------------------
// Das Rauschmuster wird einmalig auf der GPU in eine Textur gebacken (statt pro Pixel & Frame).
const cmbBakeFrag = /* glsl */ `
varying vec2 vUv;
${NOISE_GLSL}
vec3 planck(float t) {
  vec3 c0 = vec3(0.02, 0.05, 0.35), c1 = vec3(0.15, 0.55, 0.95), c2 = vec3(0.95, 0.95, 0.85), c3 = vec3(1.0, 0.55, 0.12), c4 = vec3(0.7, 0.08, 0.05);
  if (t < 0.25) return mix(c0, c1, t / 0.25);
  if (t < 0.5) return mix(c1, c2, (t - 0.25) / 0.25);
  if (t < 0.75) return mix(c2, c3, (t - 0.5) / 0.25);
  return mix(c3, c4, (t - 0.75) / 0.25);
}
void main() {
  float phi = vUv.x * 6.28318530718;
  float theta = (1.0 - vUv.y) * 3.14159265359;
  vec3 p = vec3(-cos(phi) * sin(theta), cos(theta), sin(phi) * sin(theta));
  float n = fbm(p * 5.0) * 0.6 + fbm(p * 22.0) * 0.4 + snoise(p * 60.0) * 0.12;
  float t = clamp(0.5 + n * 0.75, 0.0, 1.0);
  gl_FragColor = vec4(planck(t), 1.0);
}`;

export function bakeCMBTexture(renderer, size = 2048) {
  const rt = new THREE.WebGLRenderTarget(size, size / 2, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  const mat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: cmbBakeFrag,
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prev = renderer.getRenderTarget();
  const prevTM = renderer.toneMapping;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setRenderTarget(rt);
  renderer.render(scene, cam);
  renderer.setRenderTarget(prev);
  renderer.toneMapping = prevTM;
  mat.dispose();
  quad.geometry.dispose();
  return rt.texture;
}

const cmbVert = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv; varying vec3 vWorldN; varying vec3 vWorldPos;
void main() {
  vUv = uv;
  vWorldN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;
const cmbFrag = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform float uAlpha; uniform float uOutside; uniform sampler2D uMap;
varying vec2 vUv; varying vec3 vWorldN; varying vec3 vWorldPos;
void main() {
  #include <logdepthbuf_fragment>
  vec3 c = texture2D(uMap, vUv).rgb;
  float a = uAlpha;
  if (gl_FrontFacing) {
    float fres = pow(1.0 - abs(dot(normalize(vWorldN), normalize(-vWorldPos))), 1.5);
    a *= uOutside * (0.16 + 0.6 * fres);
  } else {
    a *= (1.0 - uOutside * 0.65);
  }
  gl_FragColor = vec4(c * a * 0.55, 1.0);
}`;
export function makeCMBMaterial(map) {
  return new THREE.ShaderMaterial({
    vertexShader: cmbVert, fragmentShader: cmbFrag, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uAlpha: { value: 0 }, uOutside: { value: 0 }, uMap: { value: map } },
  });
}
