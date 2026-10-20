// Geräteerkennung: Handys & Tablets bekommen leichtere Texturen und eine passende Qualitätsstufe.
const ua = navigator.userAgent || '';
export const MOBILE = /iPhone|iPad|iPod|Android|Mobile/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
