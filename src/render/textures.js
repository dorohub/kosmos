import * as THREE from 'three';
import { MOBILE } from '../core/device.js';

// Auf Handys kleinere Versionen der großen Texturen laden (weniger Grafikspeicher)
const MOBILE_VARIANTS = new Set(['8k_earth_daymap.jpg', '8k_earth_nightmap.jpg', '8k_stars_milky_way.jpg', '4k_moon.jpg', '4k_mars.jpg', '4k_mercury.jpg', '4k_earth_clouds.jpg', '4k_venus_atmosphere.jpg', '8k_jupiter.jpg', '8k_saturn.jpg', '8k_sun.jpg']);

// Texturen werden erst geladen, wenn sie gebraucht werden (spart Ladezeit & Grafikspeicher).
const loader = new THREE.TextureLoader();
const cache = new Map();
let anisotropy = 8;

export function setMaxAnisotropy(n) { anisotropy = n; }

export function loadTexture(name, srgb = true) {
  if (MOBILE && MOBILE_VARIANTS.has(name)) name = 'm_' + name.replace(/^\d+k_/, '');
  if (cache.has(name)) return cache.get(name);
  const p = new Promise((resolve, reject) => {
    loader.load(`${import.meta.env.BASE_URL}textures/${name}`, (t) => {
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = anisotropy;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.generateMipmaps = true;
      resolve(t);
    }, undefined, reject);
  });
  cache.set(name, p);
  return p;
}
