import * as THREE from 'three';
import { CATALOG } from '../data/catalog.js';
import { t } from '../i18n.js';

const MLY = 1e6;

// Autopilot "Galaxien-Reise": fliegt endlos von Galaxie zu Galaxie.
export class Autopilot {
  constructor(app) {
    this.app = app;
    this.active = false;
    this.visited = new Set(['milkyway']);
    this.btn = document.getElementById('nw-auto');
    this.btn.onclick = () => this.toggle();
  }

  toggle() { this.active ? this.stop() : this.start(); }

  start() {
    if (this.app.tour.active) this.app.tour.stop();
    this.active = true;
    this.btn.classList.add('on');
    // Sternen-Maßstab innerhalb der Milchstraße: von Stern zu Stern und zu Planeten
    const app = this.app;
    this.mode = app.nav.r < 2000 && app.nav.camPos.distanceTo(CATALOG.find((o) => o.id === 'milkyway').pos) < 60000 ? 'stars' : 'galaxies';
    this.sysVisits = 0;
    app.hud.toast(this.mode === 'stars'
      ? t('Autopilot <b>Sternenreise</b> – von Stern zu Stern, zu ihren Planeten (J zum Beenden)')
      : t('Autopilot <b>aktiv</b> – Reise durch alle Galaxien (J zum Beenden)'));
    this._loop();
  }

  pickStar() {
    const app = this.app;
    const sys = app.systems.system;
    if (sys && this.sysVisits < 3) {
      const rank = (b) => b.pl.hab * 2 + (b.pl.ring ? 60 : 0) + (b.pl.type === 'lava' ? 35 : 0) + (b.pl.type === 'jungle' || b.pl.type === 'ocean' ? 30 : 0) + b.pl.rKm / 2000;
      const cand = sys.bodies.filter((b) => !this.visited.has(b.o.id)).sort((a, b) => rank(b) - rank(a));
      if (cand.length) { this.sysVisits++; return cand[0].o; }
    }
    if (sys) this.visited.add(sys.star.id);
    const cam = app.nav.camPos;
    const dir = new THREE.Vector3();
    app.camera.getWorldDirection(dir);
    for (const R of [45, 120]) {
      const c = app.systems.starCandidates(cam, R)
        .filter(([d, o]) => !this.visited.has(o.id) && o.id !== 'sun' && d > 0.5)
        .map(([d, o]) => [d * (1.7 - o.pos.clone().sub(cam).normalize().dot(dir)) / Math.pow(o.lum || 1, 0.08), o])
        .sort((a, b) => a[0] - b[0]);
      if (c.length) { this.sysVisits = 0; this.visited.add(c[0][1].id); return c[0][1]; }
    }
    return null;
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.token = null;
    this.app.nav.autoOrbit = 0;
    this.btn.classList.remove('on');
    this.app.hud.toast(t('Autopilot beendet'));
  }

  pick() {
    const app = this.app;
    const cam = app.nav.camPos;
    // 1. echte, benannte Galaxien in der Nähe
    let best = null, bd = Infinity;
    for (const o of CATALOG) {
      if (o.cat !== 'galaxy' || this.visited.has(o.id)) continue;
      const d = cam.distanceTo(o.pos);
      if (d < 16 * MLY && d < bd) { bd = d; best = o; }
    }
    if (best) return best;
    // 2. Galaxien aus dem unendlichen Galaxienfeld, bevorzugt in Flugrichtung
    const dir = new THREE.Vector3();
    app.camera.getWorldDirection(dir);
    return app.field.nextTarget(cam, dir, this.visited);
  }

  async _loop() {
    const token = (this.token = {});
    const app = this.app;
    let jumps = 0;
    while (this.active && token === this.token) {
      const target = this.mode === 'stars' ? this.pickStar() : this.pick();
      let ok;
      if (target) {
        jumps = 0;
        this.visited.add(target.id);
        app.select(target, { quiet: true });
        app.hud.toast(t('Autopilot → <b>{n}</b>', { n: target.name }));
        ok = await app.flyToObject(target);
      } else {
        // Nichts in Reichweite: weiter hinaus ins All, dorthin wo das Netz dichter ist
        jumps++;
        if (this.mode === 'stars') { this.stop(); return; }
        const dir = new THREE.Vector3();
        app.camera.getWorldDirection(dir);
        dir.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.8)).normalize();
        const pos = app.nav.focus.clone().addScaledVector(dir, (8 + jumps * 4) * MLY);
        app.select(null);
        ok = await app.nav.flyTo({ pos, r: 4 * MLY });
      }
      if (token !== this.token) return;
      if (!ok) { this.stop(); return; }
      if (target) {
        app.nav.autoOrbit = 0.07;
        const t0 = performance.now();
        while (performance.now() - t0 < 7000) {
          await new Promise((r) => setTimeout(r, 200));
          if (token !== this.token) return;
        }
        app.nav.autoOrbit = 0;
      }
    }
  }
}
