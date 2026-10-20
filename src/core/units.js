// Einheiten & Formatierung. Interne Längeneinheit: Lichtjahr (Lj).
export const LY_KM = 9.4607304725808e12;
export const KM_LY = 1 / LY_KM;
export const AU_LY = 1.581250740982e-5;
export const R_SUN_KM = 696340;
export const R_SUN_LY = R_SUN_KM * KM_LY;
export const SEC_PER_YEAR = 365.25 * 86400;
export const DEG = Math.PI / 180;

import { EN, LOCALE } from '../i18n.js';

const nf = new Map();
export function fmtNum(x, digits = 1) {
  let f = nf.get(digits);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
    nf.set(digits, f);
  }
  return f.format(x);
}

const U = EN
  ? { ly: 'ly', kly: 'thousand ly', mly: 'million ly', gly: 'billion ly', mkm: 'million km', au: 'AU', s: 'seconds', min: 'minutes', h: 'hours', d: 'days', y: 'years', ky: 'thousand years', my: 'million years', gy: 'billion years' }
  : { ly: 'Lj', kly: 'Tsd. Lj', mly: 'Mio. Lj', gly: 'Mrd. Lj', mkm: 'Mio. km', au: 'AE', s: 'Sekunden', min: 'Minuten', h: 'Stunden', d: 'Tage', y: 'Jahre', ky: 'Tsd. Jahre', my: 'Mio. Jahre', gy: 'Mrd. Jahre' };
export const UNIT = U;

export function fmtLy(ly) {
  if (ly < 0.1) return fmtNum(ly, 4) + ' ' + U.ly;
  if (ly < 10) return fmtNum(ly, 2) + ' ' + U.ly;
  if (ly < 1e4) return fmtNum(ly, 0) + ' ' + U.ly;
  if (ly < 1e6) return EN ? fmtNum(ly, 0) + ' ly' : fmtNum(ly / 1e3, ly < 1e5 ? 1 : 0) + ' ' + U.kly;
  if (ly < 1e9) return fmtNum(ly / 1e6, ly < 1e7 ? 2 : ly < 1e8 ? 1 : 0) + ' ' + U.mly;
  return fmtNum(ly / 1e9, ly < 1e10 ? 2 : 1) + ' ' + U.gly;
}

export function fmtDist(ly) {
  const km = ly * LY_KM;
  if (km < 1e6) return fmtNum(km, km < 100 ? 1 : 0) + ' km';
  if (km < 1.5e8) return fmtNum(km / 1e6, 2) + ' ' + U.mkm;
  const au = ly / AU_LY;
  if (au < 8000) return fmtNum(au, au < 10 ? 2 : au < 100 ? 1 : 0) + ' ' + U.au;
  return fmtLy(ly);
}

export function fmtYears(y) {
  if (y < 1 / 365.25 / 24 / 60) return fmtNum(y * SEC_PER_YEAR, y * SEC_PER_YEAR < 10 ? 2 : 0) + ' ' + U.s;
  if (y < 1 / 365.25 / 24) return fmtNum(y * 365.25 * 24 * 60, 1) + ' ' + U.min;
  if (y < 1 / 365.25) return fmtNum(y * 365.25 * 24, 1) + ' ' + U.h;
  if (y < 1) return fmtNum(y * 365.25, 0) + ' ' + U.d;
  if (y < 1e4) return fmtNum(y, y < 10 ? 2 : 0) + ' ' + U.y;
  if (y < 1e6) return fmtNum(y / 1e3, 1) + ' ' + U.ky;
  if (y < 1e9) return fmtNum(y / 1e6, 1) + ' ' + U.my;
  return fmtNum(y / 1e9, 2) + ' ' + U.gy;
}

export function fmtSpeedC(c) {
  if (c < 1e-3) return fmtNum(c * 299792.458, 0) + ' km/s';
  if (c < 10) return fmtNum(c, 2) + ' c';
  const e = Math.floor(Math.log10(c));
  const m = c / Math.pow(10, e);
  return fmtNum(m, 1) + '·10' + sup(e) + ' c';
}

const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
export function sup(n) {
  return String(n).split('').map((c) => SUP[c] || c).join('');
}

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
