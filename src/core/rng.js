// Deterministischer Zufall & 3D-Rauschen für die prozedurale Generierung.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class Rng {
  constructor(seed) {
    this.r = mulberry32(typeof seed === 'string' ? hashString(seed) : seed);
    this._spare = null;
  }
  next() { return this.r(); }
  range(a, b) { return a + (b - a) * this.r(); }
  int(n) { return Math.floor(this.r() * n); }
  gauss() {
    if (this._spare !== null) { const s = this._spare; this._spare = null; return s; }
    let u, v, s;
    do { u = this.r() * 2 - 1; v = this.r() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
    const m = Math.sqrt(-2 * Math.log(s) / s);
    this._spare = v * m;
    return u * m;
  }
  // gleichverteilte Richtung
  dir(out) {
    const z = this.r() * 2 - 1;
    const t = this.r() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    out[0] = r * Math.cos(t); out[1] = z; out[2] = r * Math.sin(t);
    return out;
  }
  pick(arr) { return arr[Math.floor(this.r() * arr.length)]; }
}

// Klassisches Perlin-Rauschen (3D)
export class Noise3 {
  constructor(seed = 1) {
    const rng = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }
  static fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  static grad(h, x, y, z) {
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
  noise(x, y, z) {
    const P = this.perm;
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = Noise3.fade(x), v = Noise3.fade(y), w = Noise3.fade(z);
    const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z;
    const B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
    const g = Noise3.grad;
    const l1 = (a, b, t) => a + t * (b - a);
    return l1(
      l1(l1(g(P[AA] & 15, x, y, z), g(P[BA] & 15, x - 1, y, z), u),
        l1(g(P[AB] & 15, x, y - 1, z), g(P[BB] & 15, x - 1, y - 1, z), u), v),
      l1(l1(g(P[AA + 1] & 15, x, y, z - 1), g(P[BA + 1] & 15, x - 1, y, z - 1), u),
        l1(g(P[AB + 1] & 15, x, y - 1, z - 1), g(P[BB + 1] & 15, x - 1, y - 1, z - 1), u), v),
      w,
    );
  }
  fbm(x, y, z, oct = 4) {
    let s = 0, a = 0.5, f = 1;
    for (let i = 0; i < oct; i++) {
      s += a * this.noise(x * f, y * f, z * f);
      f *= 2.03; a *= 0.5;
    }
    return s;
  }
}

// Farbtemperatur (Kelvin) -> RGB 0..1 (Näherung nach T. Helland)
export function kelvinToRGB(k) {
  const t = k / 100;
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const c = (x) => Math.min(255, Math.max(0, x)) / 255;
  return [c(r), c(g), c(b)];
}
