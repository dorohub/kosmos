import * as THREE from 'three';
import { CATALOG, BY_ID } from '../data/catalog.js';
import { fmtDist } from '../core/units.js';
import { t } from '../i18n.js';
import { LABEL_LIMITS } from './uiCustom.js';

const v = new THREE.Vector3();
const vp = new THREE.Matrix4();

export class Labels {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('labels');
    this.offRoot = document.getElementById('offscreen');
    this.reticle = document.getElementById('reticle');
    this.reticleTag = this.reticle.querySelector('.tag');
    this.els = new Map();
    this.visible = [];
    this.enabled = true;
    for (const o of CATALOG) {
      if (o.id === 'universe') continue;
      const el = document.createElement('div');
      el.className = 'lbl c-' + o.cat + (o.importance >= 9 ? ' big' : '');
      el.innerHTML = `<i></i><span>${o.name}</span>`;
      el.style.display = 'none';
      el.addEventListener('click', (e) => { e.stopPropagation(); app.select(o); });
      el.addEventListener('dblclick', (e) => { e.stopPropagation(); app.select(o); app.flyToObject(o); });
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      this.root.appendChild(el);
      this.els.set(o.id, { el, o, shown: false });
    }
    this.offSel = this._mkOff('');
    this.offHome = this._mkOff('home');
    this.offHome.addEventListener('click', () => app.goHome());
    this.offSel.addEventListener('click', () => app.selected && app.flyToObject(app.selected));
  }

  // Dynamische Objekte (Galaxien aus dem Galaxienfeld) ein-/austragen
  syncDynamic(objs) {
    const want = new Set(objs.map((o) => o.id));
    for (const [id, it] of this.els) {
      if (it.o.dynamic && !want.has(id) && it.o !== this.app.selected) {
        it.el.remove();
        this.els.delete(id);
      }
    }
    for (const o of objs) {
      if (this.els.has(o.id)) continue;
      const el = document.createElement('div');
      el.className = 'lbl c-galaxy dyn';
      el.innerHTML = `<i></i><span>${o.name}</span>`;
      el.style.display = 'none';
      el.addEventListener('click', (e) => { e.stopPropagation(); this.app.select(o); });
      el.addEventListener('dblclick', (e) => { e.stopPropagation(); this.app.select(o); this.app.flyToObject(o); });
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      this.root.appendChild(el);
      this.els.set(o.id, { el, o, shown: false });
    }
  }

  _mkOff(cls) {
    const d = document.createElement('div');
    d.className = 'off ' + cls;
    d.innerHTML = '<div class="arr"></div><div><span></span> <small></small></div>';
    d.style.display = 'none';
    this.offRoot.appendChild(d);
    return d;
  }

  project(pos, camPos, k, W, H) {
    v.subVectors(pos, camPos).multiplyScalar(k);
    const camSpaceZ = v.clone().applyMatrix4(this.app.camera.matrixWorldInverse).z;
    v.applyMatrix4(vp);
    return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, behind: camSpaceZ > 0, ndcZ: v.z, depth: -camSpaceZ };
  }

  update() {
    const { camera, nav, selected } = this.app;
    const camPos = nav.camPos;
    const k = this.app.k;
    const W = window.innerWidth, H = window.innerHeight;
    vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const projF = H / (2 * Math.tan((camera.fov * Math.PI) / 360));
    const cands = [];
    // Während des Hyperraum-Sprungs keine Beschriftungen
    const warping = (this.app.warpI || 0) > 0.25;
    // Verdeckende Körper (Planeten, Monde, Sonne, Sterne) mit sichtbarer Scheibe
    const occ = [];
    for (const it of this.els.values()) {
      const o = it.o;
      if (!(o.cat === 'planet' || o.cat === 'moon' || o.cat === 'star' || o.cat === 'blackhole')) continue;
      const d = camPos.distanceTo(o.pos);
      if (d > o.radius * 3000) continue;
      const s = this.project(o.pos, camPos, k, W, H);
      if (s.behind) continue;
      const pxR = (o.radius * k * projF) / Math.max(s.depth, 1e-30);
      if (pxR > 3) occ.push({ o, x: s.x, y: s.y, r: pxR, d });
    }
    this.occ = occ;
    const ctxMax = nav.r * 300;
    for (const it of this.els.values()) {
      const o = it.o;
      const p = o.labelPos || o.pos;
      const d = camPos.distanceTo(p);
      let show = !warping && this.enabled && d < o.labelMax && d > o.radius * 0.35;
      if (o.cat === 'region' || o.cat === 'cluster') show = this.enabled && d < o.labelMax && d > (o.regionR || o.radius) * 0.9;
      if (show && d > ctxMax && o.cat !== 'region') show = false;
      if (o === selected) show = d > o.radius * 0.35;
      if (o.parent && o.cat === 'blackhole') show = show && d < o.labelMax;
      if (!show) { this._hide(it); continue; }
      const s = this.project(p, camPos, k, W, H);
      if (s.behind || s.x < -50 || s.x > W + 50 || s.y < -30 || s.y > H + 30) { this._hide(it); continue; }
      const pxR = (o.radius * k * projF) / Math.max(s.depth, 1e-30);
      if (pxR > H * 0.42 && o !== selected) { this._hide(it); continue; }
      let hidden = false;
      for (const c of occ) {
        if (c.o !== o && c.d < d && Math.hypot(s.x - c.x, s.y - c.y) < c.r) { hidden = true; break; }
      }
      if (hidden) { this._hide(it); continue; }
      const prio = (o === selected ? 1000 : 0) + (nav.focusObj === o ? 200 : 0) + o.importance * 10 - Math.log10(d / o.labelMax + 1e-9) * 4;
      cands.push({ it, s, prio, pxR, d });
    }
    cands.sort((a, b) => b.prio - a.prio);
    const placed = [];
    let n = 0;
    for (const c of cands) {
      const { it, s } = c;
      const ls = this.app.settings.labelScale || 1;
      const w = (it.o.name.length * 7.5 + 22) * ls, h = 18 * ls;
      const ox = c.pxR > 6 ? Math.min(c.pxR * 0.72, 300) : 0;
      const x = s.x + ox - 4, y = s.y - (c.pxR > 6 ? Math.min(c.pxR * 0.72, 300) : 0) - 9;
      const rect = [x, y, x + w, y + h];
      let hit = false;
      for (const r of placed) {
        if (rect[0] < r[2] && rect[2] > r[0] && rect[1] < r[3] && rect[3] > r[1]) { hit = true; break; }
      }
      if (hit || n > (LABEL_LIMITS[this.app.settings.labelDensity] ?? 60)) { this._hide(it); continue; }
      placed.push(rect);
      n++;
      it.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      if (!it.shown) { it.el.style.display = ''; it.shown = true; }
      it.el.classList.toggle('sel', it.o === selected);
    }
    this._updateReticle(W, H, projF);
    this._updateOff(this.offSel, selected && selected !== BY_ID.get('universe') ? selected : null, W, H);
    const earth = BY_ID.get('earth');
    const dEarth = camPos.distanceTo(earth.pos);
    this._updateOff(this.offHome, dEarth > earth.radius * 40 && selected !== earth ? earth : null, W, H, t('Erde'));
  }

  _hide(it) {
    if (it.shown) { it.el.style.display = 'none'; it.shown = false; }
  }

  _updateReticle(W, H, projF) {
    const o = this.app.selected;
    const nav = this.app.nav;
    if (!o || o.id === 'universe') { this.reticle.classList.add('hidden'); return; }
    const p = o.labelPos || o.pos;
    const s = this.project(p, nav.camPos, this.app.k, W, H);
    if (s.behind || s.x < 0 || s.x > W || s.y < 0 || s.y > H) { this.reticle.classList.add('hidden'); return; }
    const pxR = (o.radius * this.app.k * projF) / Math.max(s.depth, 1e-30);
    if (pxR > H * 0.38) { this.reticle.classList.add('hidden'); return; }
    const size = Math.max(34, Math.min(320, pxR * 2.5 + 20));
    this.reticle.classList.remove('hidden');
    this.reticle.style.width = this.reticle.style.height = size + 'px';
    this.reticle.style.transform = `translate(${(s.x - size / 2).toFixed(1)}px, ${(s.y - size / 2).toFixed(1)}px)`;
    this.reticleTag.textContent = fmtDist(nav.camPos.distanceTo(o.pos));
  }

  _updateOff(el, o, W, H, name) {
    if (!o) { el.style.display = 'none'; return; }
    const nav = this.app.nav;
    const s = this.project(o.labelPos || o.pos, nav.camPos, this.app.k, W, H);
    const on = !s.behind && s.x >= 0 && s.x <= W && s.y >= 0 && s.y <= H;
    if (on) { el.style.display = 'none'; return; }
    let dx = s.x - W / 2, dy = s.y - H / 2;
    if (s.behind) { dx = -dx; dy = -dy; }
    if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) dy = 1;
    const m = 70;
    const sx = (W / 2 - m) / Math.abs(dx), sy = (H / 2 - m) / Math.abs(dy);
    const t = Math.min(sx, sy);
    let x = W / 2 + dx * t, y = H / 2 + dy * t;
    if (W > 820) x = Math.max(215, x);
    const ang = Math.atan2(dy, dx) + Math.PI / 2;
    el.style.display = '';
    el.style.transform = `translate(${(x - 10).toFixed(1)}px, ${(y - 10).toFixed(1)}px)` + (x > W * 0.6 ? ' translateX(-100%) translateX(20px)' : '');
    el.style.flexDirection = x > W * 0.6 ? 'row-reverse' : 'row';
    el.querySelector('.arr').style.transform = `rotate(${ang}rad)`;
    el.querySelector('span').textContent = name || o.name;
    el.querySelector('small').textContent = fmtDist(nav.camPos.distanceTo(o.pos));
  }

  pick(x, y) {
    let best = null, bd = 26;
    const { nav } = this.app;
    const W = window.innerWidth, H = window.innerHeight;
    for (const it of this.els.values()) {
      if (!it.shown) continue;
      const s = this.project(it.o.labelPos || it.o.pos, nav.camPos, this.app.k, W, H);
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) { bd = d; best = it.o; }
    }
    return best;
  }
}
