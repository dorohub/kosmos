// Erzeugt Partikelgalaxien im Hintergrund-Thread, damit die Darstellung flüssig bleibt.
import { generateGalaxy } from './galaxyGen.js';

self.onmessage = (e) => {
  const { id, spec, R, seed, quality } = e.data;
  const d = generateGalaxy(spec, R, seed, quality);
  const pack = (b) => ({ positions: b.positions.slice(), colors: b.colors.slice(), sizes: b.sizes.slice(), count: b.count });
  const stars = pack(d.stars), dust = pack(d.dust);
  self.postMessage({ id, stars, dust }, [stars.positions.buffer, stars.colors.buffer, stars.sizes.buffer, dust.positions.buffer, dust.colors.buffer, dust.sizes.buffer]);
};
