// Flaches ΛCDM-Modell (Planck 2018) – Umrechnung mitbewegte Entfernung <-> Rotverschiebung & Rückblickzeit.
const H0 = 67.7;
const DH = (299792.458 / H0) * 3.26156e6; // Hubble-Länge in Lj
const TH = 977.792 / H0; // Hubble-Zeit in Gyr
const Om = 0.31, Or = 9.1e-5, OL = 1 - Om - Or;

const N = 4000;
const zs = new Float64Array(N), dc = new Float64Array(N), tl = new Float64Array(N);
(function build() {
  // Integration über ln(1+z) von 0 bis ln(1+1e5)
  const lmax = Math.log(1 + 1e5);
  let D = 0, L = 0, prevF = 0, prevG = 0;
  for (let i = 0; i < N; i++) {
    const lz = (i / (N - 1)) * lmax;
    const z = Math.exp(lz) - 1;
    const E = Math.sqrt(Or * (1 + z) ** 4 + Om * (1 + z) ** 3 + OL);
    const f = (1 + z) / E; // dD/dlnA
    const g = 1 / E; // dt/dlnA
    if (i > 0) {
      const h = lmax / (N - 1);
      D += 0.5 * (f + prevF) * h;
      L += 0.5 * (g + prevG) * h;
    }
    prevF = f; prevG = g;
    zs[i] = z; dc[i] = D * DH; tl[i] = L * TH;
  }
})();

export const HORIZON_LY = dc[N - 1];
export const UNIVERSE_AGE_GYR = tl[N - 1];

export function cosmoFromDistance(ly) {
  if (ly <= 0) return { z: 0, lookbackYears: 0 };
  if (ly < 1e6) return { z: ly / DH, lookbackYears: ly };
  if (ly >= dc[N - 1]) return { z: Infinity, lookbackYears: tl[N - 1] * 1e9 };
  let lo = 0, hi = N - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (dc[m] < ly) lo = m; else hi = m;
  }
  const t = (ly - dc[lo]) / (dc[hi] - dc[lo]);
  return {
    z: zs[lo] + (zs[hi] - zs[lo]) * t,
    lookbackYears: (tl[lo] + (tl[hi] - tl[lo]) * t) * 1e9,
  };
}
