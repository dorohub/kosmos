import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { World } from './world.js';
import { shared } from './render/shaders.js';
import { SolarSystem } from './render/solarSystem.js';
import { Starfield } from './render/stars.js';
import { loadSky, Sky } from './render/sky.js';
import { setMaxAnisotropy } from './render/textures.js';
import { buildUniverse, updateUniverse } from './render/universe.js';
import { Navigator } from './nav/navigator.js';
import { BY_ID, CATALOG, upVector, defaultViewR } from './data/catalog.js';
import { ECL_NORTH, GAL_NORTH, frameFromUp } from './core/coords.js';
import { AU_LY, KM_LY, DEG, SEC_PER_YEAR, fmtNum } from './core/units.js';
import { Labels } from './ui/labels.js';
import { Hud, loadJSON, saveJSON } from './ui/hud.js';
import { Tour } from './ui/tour.js';
import { SpaceAudio } from './ui/audio.js';
import { t, translateDom, EN } from './i18n.js';
import { UI_DEFAULTS, applyUI } from './ui/uiCustom.js';
import { Recorder } from './ui/recorder.js';
import { GalaxyField } from './render/galaxyField.js';
import { WarpTunnelShader } from './render/warp.js';
import { SystemManager } from './render/starSystems.js';
import { MOBILE } from './core/device.js';
import { Autopilot } from './ui/autopilot.js';


const DEFAULTS = { labels: true, constellations: true, orbits: true, bloom: true, warp: true, quality: 'auto', exposure: 1.0, sound: false, autoRes: true, v: 3 };

// Grafikkarte erkennen und eine passende Qualitätsstufe vorschlagen
function detectGPU(renderer) {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  let tier = 'high';
  if (/Apple M\d+ (Pro|Max|Ultra)|Apple M[3-9]|RTX|Radeon RX ?[6-9]\d{3}/i.test(name)) tier = 'ultra';
  else if (/Apple M\d|Apple GPU|GTX|Radeon/i.test(name)) tier = 'high';
  else if (/Intel|Mali|Adreno|PowerVR|SwiftShader|llvmpipe/i.test(name)) tier = 'medium';
  // Handys & Tablets: wenig Grafikspeicher und schmale Kühlung
  if (MOBILE) tier = /Apple/i.test(name) ? 'medium' : 'low';
  const short = (name.match(/Apple M\d+( Pro| Max| Ultra)?|RTX ?\d+\w*|GTX ?\d+\w*|Radeon[^,)]*|Intel[^,)]*/) || [name || '?'])[0];
  return { name: short.trim(), tier };
}

class App {
  constructor() {
    const stored = loadJSON('kosmos.settings', {});
    // Ältere Einstellungen auf die automatische Qualitätswahl umstellen
    if (stored.v !== 3) { stored.quality = 'auto'; stored.v = 3; }
    this.settings = { ...DEFAULTS, ...JSON.parse(JSON.stringify(UI_DEFAULTS)), ...stored };
    applyUI(this.settings);
    this.simTime = Date.now();
    this.selected = null;
    this.k = 1;

    const canvas = document.getElementById('gl');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, logarithmicDepthBuffer: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    // Qualitätsstufe: "auto" wählt anhand der Grafikkarte
    this.gpu = detectGPU(this.renderer);
    this.tier = this.settings.quality === 'auto' ? this.gpu.tier : this.settings.quality;
    this.quality = { low: 0.35, medium: 0.6, high: 1, ultra: 1.6 }[this.tier] ?? 1;
    const ultra = this.tier === 'ultra';
    // Pixel-Budget: große Monitore werden etwas niedriger aufgelöst gerendert und hochskaliert
    this.pixelBudget = { low: 1.2e6, medium: 2.0e6, high: 3.0e6, ultra: 6.5e6 }[this.tier] ?? 3e6;
    this.perf = { acc: 0, n: 0, cool: 0, frameMin: 1 / 60 };
    this._computeBasePR();
    this.renderer.setPixelRatio(this.maxPR);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.setClearColor(0x000000, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1e-5, 1e24);
    this.world = new World(this.scene);

    // Ultra: Multisampling (MSAA 4×) im HDR-Rendertarget für glatte Kanten
    const pr = this.renderer.getPixelRatio();
    // Auf Retina-Displays ist die hohe Pixeldichte bereits glatt genug – MSAA nur auf normalen Bildschirmen
    const devPx = window.innerWidth * window.innerHeight * pr * pr;
    const rt = new THREE.WebGLRenderTarget(window.innerWidth * pr, window.innerHeight * pr, { type: THREE.HalfFloatType, samples: ultra && (window.devicePixelRatio || 1) < 1.5 && devPx < 2.2e6 ? 4 : 0 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // Hyperraum-Tunnel vor dem Leuchteffekt, damit die Sternstreifen strahlen
    this.tunnel = new ShaderPass(WarpTunnelShader);
    this.tunnel.enabled = false;
    this.composer.addPass(this.tunnel);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.6, 0.5, 0.85);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.nav = new Navigator(this.camera, canvas);
    this.audio = new SpaceAudio();

    this.levels = [
      { name: 'Erde', r: BY_ID.get('earth').radius * 3.4, go: () => this.flyToObject(BY_ID.get('earth')) },
      { name: 'Mondbahn', r: 1.1e6 * KM_LY, go: () => this.nav.flyTo({ obj: BY_ID.get('earth'), r: 1.1e6 * KM_LY, pitch: 0.5, up: ECL_NORTH }) },
      { name: 'Innere Planeten', r: 3.2 * AU_LY, go: () => this.nav.flyTo({ obj: BY_ID.get('sun'), r: 3.2 * AU_LY, pitch: 0.6, up: ECL_NORTH }) },
      { name: 'Sonnensystem', r: 85 * AU_LY, go: () => this.nav.flyTo({ obj: BY_ID.get('sun'), r: 85 * AU_LY, pitch: 0.7, up: ECL_NORTH }) },
      { name: 'Oortsche Wolke', r: 4.2, go: () => this.flyToObject(BY_ID.get('oort')) },
      { name: 'Sternnachbarn', r: 45, go: () => this.nav.flyTo({ obj: BY_ID.get('sun'), r: 45, pitch: 0.35, up: GAL_NORTH }) },
      { name: 'Orion-Arm', r: 6500, go: () => this.nav.flyTo({ obj: BY_ID.get('sun'), r: 6500, pitch: 0.5, up: GAL_NORTH }) },
      { name: 'Milchstraße', r: 135000, go: () => this.flyToObject(BY_ID.get('milkyway')) },
      { name: 'Lokale Gruppe', r: 9.5e6, go: () => this.flyToObject(BY_ID.get('localgroup')) },
      { name: 'Virgo-Superhaufen', r: 1.5e8, go: () => this.flyToObject(BY_ID.get('virgosc')) },
      { name: 'Laniakea', r: 8e8, go: () => this.flyToObject(BY_ID.get('laniakea')) },
      { name: 'Kosmisches Netz', r: 7.5e9, go: () => this.nav.flyTo({ pos: new THREE.Vector3(), r: 7.5e9, pitch: 0.5, up: GAL_NORTH }) },
      { name: 'Universum', r: 1.35e11, go: () => this.flyToObject(BY_ID.get('universe')) },
    ];

    window.addEventListener('resize', () => {
      this._computeBasePR();
      if (this.renderer.getPixelRatio() > this.maxPR) this.renderer.setPixelRatio(this.maxPR);
      this.resize();
    });
    this.resize();
  }

  log(msg, p) {
    const el = document.querySelector('.boot-log');
    el.innerHTML += `<b>›</b> ${msg}\n`;
    el.scrollTop = el.scrollHeight;
    if (p !== undefined) document.querySelector('.boot-bar i').style.width = (p * 100).toFixed(1) + '%';
  }

  async init() {
    const wait = () => new Promise((r) => setTimeout(r, 0));
    this.log(t('Initialisiere Raumzeit-Koordinatensystem …'), 0.02);
    setMaxAnisotropy(this.renderer.capabilities.getMaxAnisotropy());
    const skyData = await loadSky();
    this.log(t('Sternkatalog HYG: {n} echte Sterne, {c} Sternbilder', { n: fmtNum(skyData.hyg.length / 5, 0), c: skyData.constellations.length }), 0.04);
    await wait();
    this.solar = new SolarSystem(this.world, this.quality);
    this.solar.update(this.simTime);
    this.log(t('Sonnensystem: 8 Planeten, 12 Monde, Pluto, Raumsonden & Satelliten, Exoplaneten'), 0.06);
    await wait();
    this.stars = new Starfield(this.world, this.quality, skyData.hyg);
    this.sky = new Sky(this.scene, skyData);
    this.log(t('Milchstraßen-Panorama & Sternbilder bereit'), 0.1);
    await wait();
    let lastMsg = 0;
    this.universe = await buildUniverse(this.world, this.quality, (p, msg) => {
      const now = performance.now();
      document.querySelector('.boot-bar i').style.width = (10 + p * 88).toFixed(1) + '%';
      if (now - lastMsg > 120 || p >= 1) { this.log(t('Generiere {m}', { m: msg })); lastMsg = now; }
    }, this.renderer);
    this.field = new GalaxyField(this.world, this.quality, this.universe.webData);
    this.systems = new SystemManager(this, skyData.hyg);
    this.labels = new Labels(this);
    this.hud = new Hud(this);
    this.tour = new Tour(this);
    this.recorder = new Recorder(this);
    this.autopilot = new Autopilot(this);
    this.applySettings();

    this.nav.addEventListener('pick', (e) => {
      const o = this.labels.pick(e.detail.x, e.detail.y);
      if (o) this.select(o);
    });
    this.nav.addEventListener('dblpick', (e) => {
      const o = this.labels.pick(e.detail.x, e.detail.y);
      if (o) { this.select(o); this.flyToObject(o); }
      else this.nav.zoomAt(e.detail.x, e.detail.y, 0.35);
    });
    this.nav.addEventListener('depart', (e) => { if (e.detail.T > 2.5) this.audio.blip(330, 0.5, 0.05); });
    this.nav.addEventListener('arrive', (e) => {
      this.audio.blip(990, 0.15, 0.05);
      const o = e.detail.obj;
      if (o && (o.cat === 'planet' || o.cat === 'moon')) this.hud.scan(o);
    });
    this.nav.addEventListener('depart', () => { const s = document.getElementById('scan'); if (s && !s.classList.contains('hidden')) s.classList.add('hidden'); });

    // Startansicht: Erde aus der Ferne, sonnenbeschienen
    const earth = BY_ID.get('earth');
    const start = this._viewFor(earth);
    this.nav.setView({ obj: earth, r: earth.radius * 40, yaw: start.yaw + 0.8, pitch: 0.35, up: start.up });
    this.log(t('Navigationssysteme bereit.'), 1);
    document.querySelector('.boot-bar i').style.width = '100%';

    this.last = performance.now();
    this.renderer.setAnimationLoop((t) => this.frame(t));
    const btn = document.getElementById('boot-start');
    btn.classList.remove('hidden');
    btn.focus();
    btn.onclick = () => this.launch();
    if (new URLSearchParams(location.search).has('autostart')) this.launch();
  }

  launch() {
    document.getElementById('boot').classList.add('gone');
    document.getElementById('hud').classList.remove('hidden');
    if (this.settings.sound) this.audio.toggle(true);
    const fromHash = this.applyHash();
    if (!fromHash) {
      const earth = BY_ID.get('earth');
      this.flyToObject(earth, { duration: 4.5 });
      setTimeout(() => this.hud.toast(t('Willkommen an Bord! <b>Suche</b> ein Ziel, nutze die <b>Maßstabsleiter</b> links oder starte die <b>Tour</b>.')), 2500);
    }
  }

  _computeBasePR() {
    const dpr = window.devicePixelRatio || 1;
    const css = window.innerWidth * window.innerHeight;
    const cap = { low: 1, medium: 1.5, high: 2, ultra: 3 }[this.tier] ?? 2;
    this.maxPR = Math.max(0.5, Math.min(dpr, cap, Math.sqrt(this.pixelBudget / css)));
    this.minPR = Math.max(0.4, this.maxPR * 0.55);
  }

  resize() {
    const rec = this.recSize;
    const w = rec ? rec[0] : window.innerWidth, h = rec ? rec[1] : window.innerHeight;
    if (rec) this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, !rec);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const pr = this.renderer.getPixelRatio();
    // Bei fester Aufnahmegröße sollen Punkte & Linien relativ gleich groß wirken wie auf dem Bildschirm
    shared.uPixelRatio.value = rec ? h / window.innerHeight : pr;
    shared.uProj.value = (h * pr) / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
  }

  // Aufnahme: size = [B, H] für feste Auflösung, null = Bildschirm (Auflösung eingefroren), undefined = Ende
  setRecording(size) {
    const canvas = this.renderer.domElement;
    if (size === undefined) {
      this.recording = false;
      this.recSize = null;
      document.body.classList.remove('rec-fixed');
      canvas.style.objectFit = '';
      this.renderer.setPixelRatio(this._prBeforeRec || this.maxPR);
      this.resize();
      return;
    }
    this.recording = true;
    this._prBeforeRec = this.renderer.getPixelRatio();
    this.recSize = size;
    if (size) {
      document.body.classList.add('rec-fixed');
      canvas.style.objectFit = 'contain';
      canvas.style.background = '#000';
    }
    this.resize();
  }

  applySettings() {
    const s = this.settings;
    this.bloom.enabled = s.bloom;
    this.renderer.toneMappingExposure = s.exposure;
    if (this.labels) this.labels.enabled = s.labels;
    applyUI(s);
    this.saveSettings();
  }
  saveSettings() { saveJSON('kosmos.settings', this.settings); }

  // ---------------- Auswahl & Flüge ----------------
  select(o, opts = {}) {
    this.selected = o;
    this.hud.showInfo(o);
    const hl = this.universe.highlight;
    hl.mesh.visible = !!o && (o.cat === 'region' || o.cat === 'cluster') && o.id !== 'universe';
    if (hl.mesh.visible) {
      hl.pos.copy(o.pos);
      hl.item.scale = (o.regionR || o.radius) * 1.02;
    }
    if (o && !opts.quiet) this.audio.blip(1320, 0.08, 0.04);
  }

  _viewFor(o) {
    const up = upVector(o);
    const r = defaultViewR(o);
    let pitch = ((o.view?.pitch ?? 20) * DEG);
    let yaw;
    if (o.cat === 'planet' || o.cat === 'moon') {
      // auf die Tagseite schauen
      const frame = frameFromUp(up);
      const light = o.lightObj || (o.exo ? BY_ID.get(o.parent) : BY_ID.get('sun'));
      const toSun = new THREE.Vector3().subVectors(light.pos, o.pos).normalize();
      const a = this.nav.directionToAngles(toSun, frame);
      yaw = a.yaw + 0.95;
      pitch = Math.max(-0.6, Math.min(0.6, a.pitch * 0.5 + pitch * 0.5));
    }
    return { up, r, pitch, yaw };
  }

  flyToObject(o, extra = {}) {
    if (!o) return Promise.resolve(false);
    const v = this._viewFor(o);
    return this.nav.flyTo({ obj: o, r: v.r, pitch: v.pitch, yaw: v.yaw, up: v.up, ...extra });
  }
  flyLevel(lv) { lv.go(); }
  goHome() {
    this.tour.active && this.tour.stop();
    const e = BY_ID.get('earth');
    this.select(e, { quiet: true });
    this.flyToObject(e);
  }

  // ---------------- Teilen ----------------
  viewURL() {
    const n = this.nav;
    const f = n.focusObj ? n.focusObj.id : `${n.focus.x.toPrecision(12)},${n.focus.y.toPrecision(12)},${n.focus.z.toPrecision(12)}`;
    const q = n.frame;
    const h = `#f=${encodeURIComponent(f)}&r=${n.r.toPrecision(6)}&y=${n.yaw.toFixed(3)}&p=${n.pitch.toFixed(3)}&q=${[q.x, q.y, q.z, q.w].map((x) => x.toFixed(4)).join(',')}${this.selected ? '&s=' + this.selected.id : ''}`;
    return location.origin + location.pathname + h;
  }
  applyHash() {
    if (!location.hash.startsWith('#f=')) return false;
    try {
      const p = new URLSearchParams(location.hash.slice(1));
      const f = p.get('f');
      const obj = BY_ID.get(f) || null;
      const pos = obj ? null : new THREE.Vector3(...f.split(',').map(Number));
      const q = (p.get('q') || '').split(',').map(Number);
      this.nav.setView({ obj, pos, r: +p.get('r'), yaw: +p.get('y'), pitch: +p.get('p') });
      if (q.length === 4 && q.every(isFinite)) this.nav.frame.set(...q).normalize();
      const s = BY_ID.get(p.get('s'));
      if (s) this.select(s, { quiet: true });
      return true;
    } catch { return false; }
  }

  // Dynamische Auflösung: hält die Bildrate flüssig (Ziel ~55+ FPS)
  _autoResolution(dt) {
    const p = this.perf;
    if (document.hidden || dt <= 0 || dt > 0.5) return;
    // Bildwiederholrate des Monitors schätzen (50 / 60 / 120 Hz)
    p.frameMin = Math.min(p.frameMin * 1.0005, Math.max(1 / 240, dt));
    p.acc += dt; p.n++;
    p.cool -= dt;
    if (p.acc < 1.0) return;
    const avg = p.acc / p.n;
    p.acc = 0; p.n = 0;
    this.fps = 1 / avg;
    this.hz = Math.round(1 / p.frameMin);
    if (!this.settings.autoRes || p.cool > 0 || this.recording) return;
    const pr = this.renderer.getPixelRatio();
    let next = pr;
    const target = Math.max(p.frameMin, 1 / 60);
    if (avg > target * 1.22 && pr > this.minPR) next = Math.max(this.minPR, pr - (avg > target * 1.8 ? 0.2 : 0.1));
    else if (avg < target * 1.06 && pr < this.maxPR) next = Math.min(this.maxPR, pr + 0.1);
    if (Math.abs(next - pr) > 0.001) {
      this.renderer.setPixelRatio(next);
      this.resize();
      p.cool = next < pr ? 0.6 : 3;
    }
  }

  // Screenshot in echter 8K-Auflösung (7680 × 4320), unabhängig von der Bildschirmgröße
  async screenshot() {
    if (this.recorder?.active) { this.hud.toast(t('Während der Aufnahme kein Screenshot möglich')); return; }
    const gl = this.renderer.getContext();
    const maxRB = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), gl.getParameter(gl.MAX_TEXTURE_SIZE));
    const W = maxRB >= 7680 ? 7680 : 3840, H = W === 7680 ? 4320 : 2160;
    this.hud.toast(t('Rendere <b>{q}</b>-Screenshot …', { q: W === 7680 ? '8K' : '4K' }));
    await new Promise((r) => setTimeout(r, 50));
    const prev = { pr: this.renderer.getPixelRatio(), aspect: this.camera.aspect };
    const rts = [this.composer.renderTarget1, this.composer.renderTarget2];
    const samples = rts.map((t) => t.samples);
    rts.forEach((t) => { if (t.samples) { t.samples = 0; t.dispose(); } });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(W, H, false);
    this.composer.setPixelRatio(1);
    this.composer.setSize(W, H);
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
    const scale = H / window.innerHeight;
    shared.uPixelRatio.value = scale;
    shared.uProj.value = H / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.k = 1 / this.nav.r;
    this.world.update(this.nav.camPos, this.k);
    this.universe.viewR = this.nav.r;
    updateUniverse(this.universe, this.nav.camPos, this.k, this.camera);
    this.composer.render();
    const blob = await new Promise((r) => this.renderer.domElement.toBlob(r, 'image/png'));
    // zurücksetzen
    rts.forEach((t, i) => { if (samples[i]) { t.samples = samples[i]; t.dispose(); } });
    if (!this.recSize) this.renderer.setPixelRatio(prev.pr);
    this.resize();
    if (!blob) { this.hud.toast(t('Screenshot fehlgeschlagen')); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kosmos-${(this.selected?.id || 'ansicht')}-${W}x${H}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    this.hud.toast(t('{q}-Screenshot <b>gespeichert</b> ({w} × {h})', { q: W === 7680 ? '8K' : '4K', w: W, h: H }));
  }

  // ---------------- Hauptschleife ----------------
  frame(now) {
    const raw = (now - this.last) / 1000;
    const dt = Math.min(0.1, raw);
    this.last = now;
    this._autoResolution(raw);
    if (this.hud) this.simTime += dt * 1000 * this.hud.timeRate;
    this.solar.update(this.simTime);
    this.nav.update(dt);
    this.k = 1 / this.nav.r;
    const cam = this.nav.camPos;
    this.world.update(cam, this.k);
    // Im Kino-Modus (Oberfläche aus) auch Linien & Bahnen ausblenden
    const cine = document.body.classList.contains('ui-off');
    const view = cine ? { ...this.settings, orbits: false, constellations: false, labels: false } : this.settings;
    this.solar.frame(cam, this.k, view, this.nav.r);
    this.stars.frame(cam);
    this.universe.viewR = this.nav.r;
    this.sky.update(this.camera, cam, view, this.labels?.occ);
    this.universe.panoAlpha = this.sky.panoAlpha || 0;
    updateUniverse(this.universe, cam, this.k, this.camera);
    this.field.update(cam, this.nav.r);
    this.systems.update(cam, this.nav.r, this.simTime, this.k);
    if (this.labels) this.labels.syncDynamic([...this.field.nearby, ...this.systems.objects, ...this.systems.nearbyStars]);
    const hl = this.universe.highlight;
    if (hl.mesh.visible) {
      hl.mesh.material.opacity = 0.14 + 0.08 * Math.sin(now / 500);
      hl.mesh.rotation.y = now / 20000;
    }
    shared.uTime.value = now / 1000;
    // Hyperraum-Sternentunnel während längerer Flüge
    const rel = this.nav.speedLyPerSec / this.nav.r;
    const fl = this.nav.flight;
    let wTarget = 0;
    if (fl && this.settings.warp && fl.T > 1.8 && fl.t !== undefined) {
      const ss = (a, b, x) => { const q = Math.min(1, Math.max(0, (x - a) / (b - a))); return q * q * (3 - 2 * q); };
      wTarget = ss(0.03, 0.25, fl.t) * (1 - ss(0.74, 0.97, fl.t)) * Math.min(1, Math.max(0.35, (fl.S - 1.2) / 5));
    }
    const prevW = this.warpI || 0;
    this.warpI = prevW + (wTarget - prevW) * Math.min(1, dt * (wTarget > prevW ? 3 : 6));
    if (prevW > 0.3 && this.warpI < prevW && !fl) this._flash = Math.max(this._flash || 0, 0.55 * prevW);
    this._flash = Math.max(0, (this._flash || 0) - dt * 2.2);
    const tu = this.tunnel.uniforms;
    tu.uI.value = this.warpI;
    tu.uTime.value = now / 1000;
    tu.uAspect.value = this.camera.aspect;
    tu.uFlash.value = this._flash;
    this.tunnel.enabled = this.warpI > 0.004 || this._flash > 0.004;
    // Sichtfeld weitet sich beim Sprung
    const fov = 50 + 26 * this.warpI;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
      shared.uProj.value = (this.renderer.domElement.height) / (2 * Math.tan((fov * Math.PI) / 360));
    }
    this.composer.render();
    if (this.labels) this.labels.update();
    if (this.hud) this.hud.update(dt);
    this.audio.update(Math.log10(this.nav.r), Math.min(1, Math.max(rel / 5, this.warpI)));
  }
}

translateDom();
if (MOBILE) document.querySelector('.boot-hint').textContent = t('Wischen = drehen · Zwei Finger = zoomen · Antippen = auswählen');
const app = new App();
window.kosmos = app;
app.init().catch((e) => {
  console.error(e);
  document.querySelector('.boot-log').innerHTML += `\n<span style="color:#ff6f8f">${t('Fehler: {m}', { m: e.message })}</span>`;
});
