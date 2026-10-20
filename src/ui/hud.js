import * as THREE from 'three';
import { CATALOG, BY_ID, CAT_LABEL } from '../data/catalog.js';
import { fmtDist, fmtYears, fmtSpeedC, fmtNum, AU_LY, KM_LY, SEC_PER_YEAR, LY_KM } from '../core/units.js';
import { cosmoFromDistance } from '../core/cosmology.js';
import { galacticLB } from '../core/coords.js';
import { t, EN, LANG, LOCALE, setLang } from '../i18n.js';
import { customizeHTML, bindCustomize } from './uiCustom.js';
import { recordingSupported } from './recorder.js';

const $ = (s, r = document) => r.querySelector(s);
const CAT_ICON = { planet: '◐', moon: '☾', star: '✦', nebula: '☁', galaxy: '◎', blackhole: '●', cluster: '⁂', region: '◌', probe: '⌖' };

const SPEEDS = [
  [-3.15576e8, t('−10 Jahre / s')], [-3.15576e7, t('−1 Jahr / s')], [-2.6298e6, t('−1 Monat / s')], [-604800, t('−1 Woche / s')], [-86400, t('−1 Tag / s')], [-3600, t('−1 Stunde / s')],
  [1, t('Echtzeit')], [60, t('1 Minute / s')], [3600, t('1 Stunde / s')], [86400, t('1 Tag / s')], [604800, t('1 Woche / s')], [2.6298e6, t('1 Monat / s')], [3.15576e7, t('1 Jahr / s')], [3.15576e8, t('10 Jahre / s')],
];

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');

export class Hud {
  constructor(app) {
    this.app = app;
    this.speedIdx = 6;
    this.paused = false;
    this._t = 0;
    this.favs = loadJSON('kosmos.favs', []);
    this._setupSearch();
    this._setupInfo();
    this._setupLadder();
    this._setupTools();
    this._setupTime();
    this._setupKeys();
  }

  // ---------------- Toasts & Modals ----------------
  toast(html) {
    if (this.app.settings.ui && this.app.settings.ui.toasts === false) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = html;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 3100);
  }
  openModal(html, onMount) {
    const m = $('#modal');
    $('.modal-body', m).innerHTML = html;
    m.classList.remove('hidden');
    onMount?.($('.modal-body', m));
  }
  closeModal() { $('#modal').classList.add('hidden'); }

  // ---------------- Suche ----------------
  _setupSearch() {
    const input = $('#search');
    const list = $('#results');
    this.searchIdx = -1;
    const render = () => {
      const q = norm(input.value.trim());
      if (!q) { list.classList.remove('open'); return; }
      const earth = BY_ID.get('earth');
      const res = CATALOG.filter((o) => norm(o.name).includes(q) || norm(o.type || '').includes(q) || norm(CAT_LABEL[o.cat] || '').includes(q))
        .map((o) => ({ o, score: (norm(o.name).startsWith(q) ? 0 : 1) - o.importance * 0.01 }))
        .sort((a, b) => a.score - b.score).slice(0, 9);
      this.searchRes = res.map((r) => r.o);
      this.searchIdx = res.length ? 0 : -1;
      list.innerHTML = res.length
        ? res.map((r, i) => `<li data-i="${i}" class="${i === 0 ? 'active' : ''}"><span class="ic">${CAT_ICON[r.o.cat] || '·'}</span><div><b>${r.o.name}</b><small>${r.o.type || ''}</small></div><em>${r.o.id === 'universe' ? '' : fmtDist(r.o.pos.distanceTo(earth.pos))}</em></li>`).join('')
        : `<li class="empty">${t('Kein Objekt gefunden')}</li>`;
      list.classList.add('open');
    };
    input.addEventListener('input', render);
    input.addEventListener('focus', render);
    input.addEventListener('blur', () => setTimeout(() => list.classList.remove('open'), 150));
    input.addEventListener('keydown', (e) => {
      const items = [...list.querySelectorAll('li[data-i]')];
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!items.length) return;
        this.searchIdx = (this.searchIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach((li, i) => li.classList.toggle('active', i === this.searchIdx));
      } else if (e.key === 'Enter') {
        const o = this.searchRes?.[this.searchIdx];
        if (o) this._choose(o);
      } else if (e.key === 'Escape') {
        input.blur();
      }
      e.stopPropagation();
    });
    list.addEventListener('pointerdown', (e) => {
      const li = e.target.closest('li[data-i]');
      if (!li) return;
      e.preventDefault();
      this._choose(this.searchRes[+li.dataset.i]);
    });
  }
  _choose(o) {
    const input = $('#search');
    input.value = '';
    input.blur();
    $('#results').classList.remove('open');
    this.app.select(o);
    this.app.flyToObject(o);
  }

  // ---------------- Info-Panel ----------------
  _setupInfo() {
    const p = $('#info');
    $('.close', p).onclick = () => this.app.select(null);
    $('.act-fly', p).onclick = () => this.app.selected && this.app.flyToObject(this.app.selected);
    $('.act-orbit', p).onclick = () => this.toggleOrbit();
    $('.act-fav', p).onclick = () => this.toggleFav(this.app.selected);
  }
  showInfo(o) {
    const p = $('#info');
    if (!o) { p.classList.add('hidden'); return; }
    p.classList.remove('hidden');
    p.style.animation = 'none'; void p.offsetWidth; p.style.animation = '';
    $('.info-cat', p).textContent = CAT_LABEL[o.cat] || '';
    $('.info-name', p).textContent = o.name;
    $('.info-type', p).textContent = o.type || '';
    $('.info-desc', p).textContent = o.desc || '';
    $('.info-facts', p).innerHTML = (o.facts || []).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    $('.act-fav', p).classList.toggle('on', this.favs.includes(o.id));
    $('.act-orbit', p).classList.toggle('on', !!this.app.nav.autoOrbit);
    this._liveInfo(true);
  }
  _liveInfo(force) {
    const o = this.app.selected;
    if (!o) return;
    const earth = BY_ID.get('earth');
    const dE = o.id === 'universe' ? 46.5e9 : o.pos.distanceTo(earth.pos);
    const dC = this.app.nav.camPos.distanceTo(o.pos);
    const c = cosmoFromDistance(dE);
    const cells = [
      [t('VON DER ERDE'), o.id === 'earth' ? '—' : fmtDist(dE)],
      [t('VON DIR'), fmtDist(dC)],
      [t('LICHT UNTERWEGS'), o.id === 'earth' ? '—' : fmtYears(c.lookbackYears)],
      c.z > 0.005 ? [t('ROTVERSCHIEBUNG'), 'z = ' + fmtNum(c.z, c.z < 1 ? 3 : 2)] : [t('DURCHMESSER'), fmtDist(o.radius * 2)],
    ];
    const html = cells.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    const el = $('#info .info-live');
    if (force || el._last !== html) { el.innerHTML = html; el._last = html; }
  }
  toggleOrbit(force) {
    const nav = this.app.nav;
    nav.autoOrbit = (force ?? !nav.autoOrbit) ? 0.08 : 0;
    $('#info .act-orbit').classList.toggle('on', !!nav.autoOrbit);
    this.toast(nav.autoOrbit ? t('Orbit-Modus <b>aktiv</b>') : t('Orbit-Modus aus'));
  }
  toggleFav(o) {
    if (!o) return;
    const i = this.favs.indexOf(o.id);
    if (i >= 0) this.favs.splice(i, 1); else this.favs.push(o.id);
    saveJSON('kosmos.favs', this.favs);
    $('#info .act-fav').classList.toggle('on', i < 0);
    this.toast(i < 0 ? t('<b>{n}</b> zu Favoriten hinzugefügt', { n: o.name }) : t('{n} entfernt', { n: o.name }));
  }

  // ---------------- Maßstabsleiter ----------------
  _setupLadder() {
    const wrap = $('.ladder-items');
    this.levels = this.app.levels;
    this.logMin = Math.log10(2e-10);
    this.logMax = Math.log10(1.5e11);
    const n = this.levels.length;
    this.levels.forEach((lv, i) => (lv.t = 1 - i / (n - 1)));
    for (const lv of this.levels) {
      const b = document.createElement('button');
      b.innerHTML = `<i></i>${t(lv.name)}`;
      b.style.top = lv.t * 100 + '%';
      b.onclick = () => { this.app.tour.active && this.app.tour.stop(); this.app.flyLevel(lv); };
      lv.el = b;
      wrap.appendChild(b);
    }
  }
  _ladderPos(r) {
    const L = this.levels, lr = Math.log10(r);
    if (lr <= Math.log10(L[0].r)) return L[0].t;
    for (let i = 0; i < L.length - 1; i++) {
      const a = Math.log10(L[i].r), b = Math.log10(L[i + 1].r);
      if (lr <= b) return L[i].t + (L[i + 1].t - L[i].t) * ((lr - a) / (b - a));
    }
    return L[L.length - 1].t;
  }

  // ---------------- Werkzeuge ----------------
  _setupTools() {
    const app = this.app;
    $('#btn-lang').textContent = EN ? 'DE' : 'EN';
    $('#btn-lang').onclick = () => setLang(EN ? 'de' : 'en');
    $('#btn-tour').onclick = () => (app.tour.active ? app.tour.stop() : app.tour.start());
    $('#btn-help').onclick = () => this.showHelp();
    $('#btn-settings').onclick = () => this.showSettings();
    $('#btn-custom').onclick = () => this.showCustomize();
    $('#btn-rec').onclick = () => this.toggleRecord();
    $('#ui-mini').onclick = () => this.showCustomize();
    $('#btn-fav').onclick = () => this.showFavs();
    $('#btn-shot').onclick = () => app.screenshot();
    $('#btn-share').onclick = () => this.share();
    $('#btn-full').onclick = () => this.fullscreen();
    $('#btn-sound').onclick = () => this.toggleSound();
    $('#btn-ui').onclick = () => this.toggleUI(false);
    $('#ui-restore').onclick = () => this.toggleUI(true);
    // Im Kino-Modus erscheint der Einblenden-Knopf kurz bei Mausbewegung oder Berührung
    const hint = () => {
      if (!document.body.classList.contains('ui-off')) return;
      document.body.classList.add('ui-hint');
      clearTimeout(this._hintT);
      this._hintT = setTimeout(() => document.body.classList.remove('ui-hint'), 2200);
    };
    window.addEventListener('pointermove', hint);
    window.addEventListener('pointerdown', hint);
    $('#btn-sound').classList.toggle('on', !!app.settings.sound);
    $('#home-btn').onclick = () => app.goHome();
    $('#nw-compass').onclick = () => this.resetNorth();
    $('#nw-in').onclick = () => { app.nav._interrupt(); app.nav.zoomAt(window.innerWidth / 2, window.innerHeight / 2, 0.4); };
    $('#nw-out').onclick = () => { app.nav._interrupt(); app.nav.zoomAt(null, null, 2.5); };
    $('#modal .close').onclick = () => this.closeModal();
    $('#modal').addEventListener('pointerdown', (e) => { if (e.target.id === 'modal') this.closeModal(); });
  }
  toggleUI(show) {
    const off = show === undefined ? !document.body.classList.contains('ui-off') : !show;
    document.body.classList.toggle('ui-off', off);
    document.body.classList.toggle('ui-hint', off);
    clearTimeout(this._hintT);
    if (off) this._hintT = setTimeout(() => document.body.classList.remove('ui-hint'), 2500);
    else this.toast(t('Oberfläche <b>eingeblendet</b>'));
  }
  resetNorth() {
    const n = this.app.nav;
    n.spin = null;
    n.yawT = n.yaw - (((n.yaw % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
    n.pitchT = 0.35;
  }
  toggleSound() {
    const on = this.app.audio.toggle();
    this.app.settings.sound = on;
    this.app.saveSettings();
    $('#btn-sound').classList.toggle('on', on);
    this.toast(on ? t('Klang <b>an</b>') : t('Klang aus'));
  }
  fullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
  async share() {
    const url = this.app.viewURL();
    try {
      await navigator.clipboard.writeText(url);
      this.toast(t('Link zur Ansicht <b>kopiert</b>'));
    } catch {
      this.openModal(`<h2>${t('ANSICHT TEILEN')}</h2><p class="muted">${t('Kopiere diesen Link:')}</p><input style="width:100%;padding:8px;background:transparent;border:1px solid var(--line);color:var(--text);font:12px var(--mono)" value="${url}" onfocus="this.select()" />`);
    }
  }
  showHelp() {
    if (!EN) return this._helpDe();
    this.openModal(`
      <h2>CONTROLS</h2>
      <div class="keys">
        <kbd>Drag</kbd><span>Rotate the view – planets can be "grabbed", release with momentum</span>
        <kbd>Wheel / pinch</kbd><span>Zoom toward the cursor – seamlessly across 21 orders of magnitude</span>
        <kbd>Double-click</kbd><span>Empty space: zoom in · on an object: fly there</span>
        <kbd>N</kbd><span>Reset orientation (compass)</span>
        <kbd>U</kbd><span>Hide/show interface (cinema mode)</span>
        <kbd>C</kbd><span>Customize interface (elements, size, color)</span>
        <kbd>R</kbd><span>Start / stop video recording</span>
        <kbd>J</kbd><span>Autopilot: journey through all galaxies – at star scale from star to star to their planets</span>
        <kbd>Right-click + drag</kbd><span>Pan (also Shift + drag)</span>
        <kbd>W A S D</kbd><span>Fly freely · <b>Q / E</b> down / up · <b>Shift</b> = boost</span>
        <kbd>Arrow keys</kbd><span>Rotate and tilt</span>
        <kbd>Click</kbd><span>Select object · <b>double-click</b> = fly there</span>
        <kbd>/</kbd><span>Open search</span>
        <kbd>G</kbd><span>Fly to selected object</span>
        <kbd>Home</kbd><span>Back to Earth</span>
        <kbd>T</kbd><span>Start / stop guided tour</span>
        <kbd>O</kbd><span>Orbit mode (slowly circle)</span>
        <kbd>L</kbd><span>Labels on/off</span>
        <kbd>K</kbd><span>Constellations on/off</span>
        <kbd>Space</kbd><span>Pause / resume time</span>
        <kbd>M · P · F · B</kbd><span>Sound · screenshot · fullscreen · favorites</span>
        <kbd>Esc</kbd><span>Close / cancel</span>
      </div>
      <h3>ABOUT THE DATA</h3>
      <p class="muted" style="font-size:14px;line-height:1.5">More than 109,000 stars come from the HYG catalog (astronexus, CC BY-SA 4.0), constellations from d3-celestial (BSD). Planet, Sun and Milky Way textures: Solar System Scope (CC BY 4.0) based on NASA/ESO data. Positions of nebulae, galaxies and clusters are based on real sky coordinates and distances. Planets move on simplified circular orbits in real time. Galaxies, nebulae and the cosmic web are procedurally modeled – with the right size, shape and orientation, but not star by star. Distances beyond ~100 million light-years are comoving distances (ΛCDM, H₀ = 67.7).</p>`);
  }
  _helpDe() {
    this.openModal(`
      <h2>STEUERUNG</h2>
      <div class="keys">
        <kbd>Ziehen</kbd><span>Ansicht drehen – Planeten lassen sich „greifen“, mit Schwung loslassen</span>
        <kbd>Mausrad / Pinch</kbd><span>Zoomen zum Mauszeiger – nahtlos über 21 Größenordnungen</span>
        <kbd>Doppelklick</kbd><span>Ins Leere: hineinzoomen · auf ein Objekt: hinfliegen</span>
        <kbd>N</kbd><span>Ausrichtung zurücksetzen (Kompass)</span>
        <kbd>U</kbd><span>Oberfläche aus-/einblenden (Kino-Modus)</span>
        <kbd>C</kbd><span>Oberfläche anpassen (Elemente, Größe, Farbe)</span>
        <kbd>R</kbd><span>Videoaufnahme starten / beenden</span>
        <kbd>J</kbd><span>Autopilot: Reise durch alle Galaxien – bei Sternen-Maßstab von Stern zu Stern zu ihren Planeten</span>
        <kbd>Rechtsklick + Ziehen</kbd><span>Schwenken (auch Umschalt + Ziehen)</span>
        <kbd>W A S D</kbd><span>Frei fliegen · <b>Q / E</b> runter / hoch · <b>Umschalt</b> = Turbo</span>
        <kbd>Pfeiltasten</kbd><span>Drehen und neigen</span>
        <kbd>Klick</kbd><span>Objekt auswählen · <b>Doppelklick</b> = hinfliegen</span>
        <kbd>/</kbd><span>Suche öffnen</span>
        <kbd>G</kbd><span>Zum ausgewählten Objekt fliegen</span>
        <kbd>Pos1</kbd><span>Zurück zur Erde</span>
        <kbd>T</kbd><span>Geführte Tour starten / stoppen</span>
        <kbd>O</kbd><span>Orbit-Modus (langsam umkreisen)</span>
        <kbd>L</kbd><span>Beschriftungen ein/aus</span>
        <kbd>K</kbd><span>Sternbilder ein/aus</span>
        <kbd>Leertaste</kbd><span>Zeit anhalten / fortsetzen</span>
        <kbd>M · P · F · B</kbd><span>Klang · Screenshot · Vollbild · Favoriten</span>
        <kbd>Esc</kbd><span>Schließen / abbrechen</span>
      </div>
      <h3>ÜBER DIE DATEN</h3>
      <p class="muted" style="font-size:14px;line-height:1.5">Über 109.000 Sterne stammen aus dem HYG-Katalog (astronexus, CC BY-SA 4.0), Sternbilder aus d3-celestial (BSD). Planeten-, Sonnen- und Milchstraßentexturen: Solar System Scope (CC BY 4.0) nach Daten von NASA/ESO. Positionen von Nebeln, Galaxien und Haufen beruhen auf realen Himmelskoordinaten und Entfernungen. Die Planeten bewegen sich auf vereinfachten Kreisbahnen in Echtzeit. Galaxien, Nebel und das kosmische Netz sind prozedural nachgebildet – in der richtigen Größe, Form und Ausrichtung, aber nicht Stern für Stern. Entfernungen jenseits von ~100 Mio. Lichtjahren sind mitbewegte Entfernungen (ΛCDM, H₀ = 67,7).</p>`);
  }
  // Holografischer Scan bei Ankunft an einem Planeten oder Mond
  scan(o) {
    const el = document.getElementById('scan');
    clearTimeout(this._scanT);
    el.classList.remove('hidden', 'out');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    el.querySelectorAll('.scan-ring, .scan-beam').forEach((x) => { x.style.animation = 'none'; void x.offsetWidth; x.style.animation = ''; });
    const rows = [[t('SCAN'), o.name], ...(o.facts || []).slice(0, 6)];
    el.querySelector('.scan-data').innerHTML = rows.map(([k, v], i) => i === 0
      ? `<div class="hd" style="animation-delay:${0.4}s">◈ ${k} · ${v}</div>`
      : `<div style="animation-delay:${0.55 + i * 0.22}s">${k}<b>${v}</b></div>`).join('');
    this.app.audio.blip(520, 0.5, 0.04);
    this._scanT = setTimeout(() => { el.classList.add('out'); this._scanT = setTimeout(() => el.classList.add('hidden'), 800); }, 4800);
  }
  toggleRecord() {
    const rec = this.app.recorder;
    if (rec.active) rec.stop();
    else this.showRecord();
  }
  showRecord() {
    if (!recordingSupported()) {
      this.openModal(`<h2>${t('VIDEO AUFNEHMEN')}</h2><p class="muted">${t('Dein Browser unterstützt keine Videoaufnahme. Bitte Chrome, Edge oder ein aktuelles Safari verwenden.')}</p>`);
      return;
    }
    const o = this.recOpts || (this.recOpts = { res: '1080', fps: 30, tour: false, audio: true, hideUI: false });
    const seg = (key, vals, labels) => `<div class="seg">${vals.map((v, i) => `<button data-${key}="${v}" class="${String(o[key]) === String(v) ? 'on' : ''}">${labels[i]}</button>`).join('')}</div>`;
    const chip = (key, label) => `<button class="chip ${o[key] ? 'on' : ''}" data-opt="${key}">${label}</button>`;
    this.openModal(`
      <h2>${t('VIDEO AUFNEHMEN')}</h2>
      <div class="set-row"><div>${t('Auflösung')}<small>${t('Höher = schärfer, aber anspruchsvoller für den Rechner')}</small></div>
        ${seg('res', ['screen', '1080', '1440', '2160'], [t('Bildschirm'), '1080p', '1440p', '4K'])}</div>
      <div class="set-row"><div>${t('Bildrate')}<small>${t('30 FPS ist auf schwächeren Rechnern gleichmäßiger')}</small></div>
        ${seg('fps', [30, 60], ['30', '60'])}</div>
      <h3>${t('OPTIONEN')}</h3>
      <div class="chips">
        ${chip('tour', t('Geführte Tour aufnehmen'))}
        ${chip('audio', t('Weltraum-Klang mit aufnehmen'))}
        ${chip('hideUI', t('Oberfläche während der Aufnahme ausblenden'))}
      </div>
      <p class="rec-note">${t('Aufgenommen wird die 3D-Ansicht ohne Bedienelemente und Beschriftungen. Beenden mit R oder dem ■-Knopf oben – das Video wird danach automatisch gespeichert.')}</p>
      <button class="rec-start">● ${t('AUFNAHME STARTEN')}</button>
    `, (root) => {
      root.querySelectorAll('[data-res]').forEach((b) => (b.onclick = () => { o.res = b.dataset.res; root.querySelectorAll('[data-res]').forEach((x) => x.classList.toggle('on', x === b)); }));
      root.querySelectorAll('[data-fps]').forEach((b) => (b.onclick = () => { o.fps = +b.dataset.fps; root.querySelectorAll('[data-fps]').forEach((x) => x.classList.toggle('on', x === b)); }));
      root.querySelectorAll('[data-opt]').forEach((b) => (b.onclick = () => { o[b.dataset.opt] = !o[b.dataset.opt]; b.classList.toggle('on', o[b.dataset.opt]); }));
      root.querySelector('.rec-start').onclick = () => {
        this.closeModal();
        if (o.audio && !this.app.audio.on) this.toggleSound();
        if (o.hideUI) this.toggleUI(false);
        setTimeout(() => {
          const ok = this.app.recorder.start({ res: o.res, fps: o.fps, tour: o.tour, audio: o.audio });
          if (ok) this.toast(t('Aufnahme <b>läuft</b> – R zum Beenden'));
        }, 250);
      };
    });
  }
  showCustomize() {
    const render = () => this.openModal(customizeHTML(this.app.settings), (root) => bindCustomize(root, this.app, render));
    render();
  }
  showSettings() {
    const s = this.app.settings;
    const row = (key, title, sub) => `<div class="set-row"><div>${title}<small>${sub}</small></div><button class="toggle ${s[key] ? 'on' : ''}" data-k="${key}"></button></div>`;
    this.openModal(`
      <h2>${t('EINSTELLUNGEN')}</h2>
      <div class="set-row"><div>${t('Oberfläche anpassen')}<small>${t('Elemente, Größe, Farbe & Beschriftungen')}</small></div><button class="seg-btn" data-open-custom style="padding:6px 12px;background:transparent;border:1px solid var(--line-strong);color:var(--accent)">${t('Öffnen')} →</button></div>
      <div class="set-row"><div>${t('Sprache')}<small>${t('Sprache der Oberfläche und Beschreibungen')}</small></div>
        <div class="seg">${['de', 'en'].map((l) => `<button data-lang="${l}" class="${LANG === l ? 'on' : ''}">${l === 'de' ? 'Deutsch' : 'English'}</button>`).join('')}</div></div>
      ${row('labels', t('Beschriftungen'), t('Namen von Objekten anzeigen (L)'))}
      ${row('constellations', t('Sternbilder'), t('Linien & Namen der 88 Sternbilder (K)'))}
      ${row('orbits', t('Umlaufbahnen'), t('Planeten- und Mondbahnen einblenden'))}
      ${row('bloom', t('Leuchteffekt (Bloom)'), t('Helle Objekte strahlen'))}
      ${row('warp', t('Warp-Effekt'), t('Bewegungsunschärfe bei schnellen Flügen'))}
      ${row('autoRes', t('Automatische Auflösung'), t('Senkt die Auflösung kurz, wenn es ruckelt – hält alles flüssig'))}
      <div class="set-row"><div>${t('Helligkeit')}<small>${t('Belichtung der Szene')}</small></div><input type="range" min="0.4" max="2.2" step="0.05" value="${s.exposure}" data-r="exposure" /></div>
      <div class="set-row"><div>${t('Grafikqualität')}<small>${t('Erkannt: {g} · empfohlen „{q}“ · wird nach Neuladen übernommen', { g: this.app.gpu.name, q: t({ low: 'Niedrig', medium: 'Mittel', high: 'Hoch', ultra: 'Ultra' }[this.app.gpu.tier]) })}</small></div>
        <div class="seg">${['auto', 'low', 'medium', 'high', 'ultra'].map((q) => `<button data-q="${q}" class="${s.quality === q ? 'on' : ''}">${t({ auto: 'Auto', low: 'Niedrig', medium: 'Mittel', high: 'Hoch', ultra: 'Ultra' }[q])}</button>`).join('')}</div></div>
    `, (root) => {
      root.querySelectorAll('.toggle').forEach((b) => (b.onclick = () => {
        s[b.dataset.k] = !s[b.dataset.k];
        b.classList.toggle('on', s[b.dataset.k]);
        this.app.applySettings();
      }));
      root.querySelector('[data-open-custom]').onclick = () => this.showCustomize();
      root.querySelectorAll('[data-lang]').forEach((b) => (b.onclick = () => { if (b.dataset.lang !== LANG) setLang(b.dataset.lang); }));
      root.querySelector('[data-r]').oninput = (e) => { s.exposure = +e.target.value; this.app.applySettings(); };
      root.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => {
        s.quality = b.dataset.q;
        this.app.saveSettings();
        root.querySelectorAll('[data-q]').forEach((x) => x.classList.toggle('on', x === b));
        if (confirm(t('Qualität geändert. Jetzt neu laden?'))) location.reload();
      }));
    });
  }
  showFavs() {
    const items = this.favs.map((id) => BY_ID.get(id)).filter(Boolean);
    this.openModal(`<h2>${t('FAVORITEN')}</h2>${items.length
      ? `<ul class="fav-list">${items.map((o) => `<li data-id="${o.id}"><span>${CAT_ICON[o.cat] || ''} <b>${o.name}</b><small>${o.type || ''}</small></span><button class="rm" data-rm="${o.id}" title="${t('Entfernen')}">×</button></li>`).join('')}</ul>`
      : `<p class="muted">${t('Noch keine Favoriten. Wähle ein Objekt aus und klicke auf ★, um es hier zu speichern.')}</p>`}`, (root) => {
      root.querySelectorAll('li[data-id]').forEach((li) => (li.onclick = (e) => {
        if (e.target.dataset.rm) {
          this.favs = this.favs.filter((x) => x !== e.target.dataset.rm);
          saveJSON('kosmos.favs', this.favs);
          li.remove();
          return;
        }
        const o = BY_ID.get(li.dataset.id);
        this.closeModal();
        this.app.select(o);
        this.app.flyToObject(o);
      }));
    });
  }

  // ---------------- Zeit ----------------
  _setupTime() {
    $('#tc-play').onclick = () => this.togglePause();
    $('#tc-fwd').onclick = () => this.setSpeed(Math.min(SPEEDS.length - 1, this.speedIdx + 1));
    $('#tc-back').onclick = () => this.setSpeed(Math.max(0, this.speedIdx - 1));
    $('#tc-now').onclick = () => { this.app.simTime = Date.now(); this.setSpeed(6); if (this.paused) this.togglePause(); this.toast(t('Zeit: <b>Gegenwart</b>')); };
  }
  get timeRate() { return this.paused ? 0 : SPEEDS[this.speedIdx][0]; }
  setSpeed(i) {
    this.speedIdx = i;
    $('#tc-speed').textContent = SPEEDS[i][1];
  }
  togglePause() {
    this.paused = !this.paused;
    $('#tc-play').textContent = this.paused ? '▶' : '❚❚';
    $('#tc-speed').textContent = this.paused ? t('Angehalten') : SPEEDS[this.speedIdx][1];
  }

  // ---------------- Tastatur ----------------
  _setupKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      const app = this.app;
      if (k === '/') { e.preventDefault(); $('#search').focus(); }
      else if (k === 'Escape') {
        if (!$('#modal').classList.contains('hidden')) this.closeModal();
        else if (app.autopilot.active) app.autopilot.stop();
        else if (app.tour.active) app.tour.stop();
        else if (app.nav.flight) app.nav.flight.cancel();
        else app.select(null);
      } else if (k === 'h' || k === 'H' || k === '?') this.showHelp();
      else if (k === 'Home') app.goHome();
      else if (k === 'n' || k === 'N') this.resetNorth();
      else if (k === 't' || k === 'T') app.tour.active ? app.tour.stop() : app.tour.start();
      else if (k === 'l' || k === 'L') { app.settings.labels = !app.settings.labels; app.applySettings(); this.toast(app.settings.labels ? t('Beschriftungen <b>an</b>') : t('Beschriftungen aus')); }
      else if (k === 'o' || k === 'O') this.toggleOrbit();
      else if (k === 'k' || k === 'K') { app.settings.constellations = !app.settings.constellations; app.applySettings(); this.toast(app.settings.constellations ? t('Sternbilder <b>an</b>') : t('Sternbilder aus')); }
      else if (k === 'g' || k === 'G') app.selected && app.flyToObject(app.selected);
      else if (k === ' ') { e.preventDefault(); this.togglePause(); }
      else if (k === 'f' || k === 'F') this.fullscreen();
      else if (k === 'm' || k === 'M') this.toggleSound();
      else if (k === 'p' || k === 'P') app.screenshot();
      else if (k === 'b' || k === 'B') this.showFavs();
      else if (k === 'u' || k === 'U') this.toggleUI();
      else if (k === 'c' || k === 'C') this.showCustomize();
      else if (k === 'r' || k === 'R') this.toggleRecord();
      else if (k === 'j' || k === 'J') app.autopilot.toggle();
    });
  }

  // ---------------- Laufende Anzeigen ----------------
  update(dt) {
    this._t += dt;
    const app = this.app;
    const nav = app.nav;
    // Leiter-Indikator & Kompass jeden Frame
    $('.ladder-ind').style.top = this._ladderPos(nav.r) * 100 + '%';
    if (!this._needle) this._needle = $('#nw-compass .needle');
    this._needle.style.transform = `rotate(${(nav.yaw * 180) / Math.PI}deg)`;
    document.body.classList.toggle('info-open', !!app.selected);
    if (this._t < 0.1) return;
    this._t = 0;
    const earth = BY_ID.get('earth');
    const dE = nav.camPos.distanceTo(earth.pos);
    const c = cosmoFromDistance(dE);
    const fovW = 2 * nav.r * Math.tan((app.camera.fov * Math.PI) / 360) * app.camera.aspect;
    $('#t-earth').textContent = fmtDist(dE);
    $('#t-fov').textContent = fmtDist(fovW);
    $('#t-light').textContent = dE < 1e-12 ? '—' : fmtYears(c.lookbackYears);
    $('#t-z').textContent = c.z < 0.0005 ? '≈ 0' : fmtNum(c.z, c.z < 1 ? 4 : 2);
    const lb = galacticLB(nav.camPos);
    $('#t-lb').textContent = dE < 1e-5 ? '—' : `l ${fmtNum(lb.l, 1)}° · b ${fmtNum(lb.b, 1)}°`;
    const vc = nav.speedLyPerSec * SEC_PER_YEAR;
    if (this.app.fps) $('#t-fps').textContent = `${Math.round(this.app.fps)} / ${this.app.hz || 60} Hz · ${Math.round(this.app.renderer.getPixelRatio() * 100)} %`;
    $('#t-speed').textContent = nav.speedLyPerSec < nav.r * 2e-3 ? t('Stillstand') : fmtSpeedC(vc);
    // Datum
    const d = new Date(app.simTime);
    $('#tc-date').textContent = isFinite(d) ? d.toLocaleString(LOCALE, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '–';
    // Leiter aktiv
    let best = null, bd = Infinity;
    for (const lv of this.levels) {
      const dd = Math.abs(Math.log10(lv.r) - Math.log10(nav.r));
      if (dd < bd) { bd = dd; best = lv; }
    }
    for (const lv of this.levels) lv.el.classList.toggle('active', lv === best);
    this._crumbs();
    this._scalebar();
    this._liveInfo(false);
  }

  _crumbs() {
    const cam = this.app.nav.camPos;
    const list = [];
    for (const o of CATALOG) {
      let R = o.regionR;
      if (!R) {
        if (o.cat === 'planet' || o.cat === 'moon') R = o.radius * 80;
        else if (o.cat === 'star') R = 0.08;
        else if (o.cat === 'nebula') R = o.radius;
        else continue;
      }
      if (cam.distanceTo(o.pos) < R) list.push({ name: o.id === 'sun' ? t('Sonnensystem') : o.name, R });
    }
    if (cam.length() < 3500 && cam.length() > 1.6) list.push({ name: t('Orion-Arm'), R: 3500 });
    list.sort((a, b) => a.R - b.R);
    const html = `<span class="lead">${t('DU BIST HIER')}</span>` + list.slice(0, 7).map((x, i) => `<span class="${i === 0 ? 'here' : ''}">${x.name}</span>`).join('');
    const el = $('#crumbs');
    if (el._last !== html) { el.innerHTML = html; el._last = html; }
  }

  _scalebar() {
    const nav = this.app.nav;
    const H = window.innerHeight;
    const pxPerLy = H / (2 * nav.r * Math.tan((this.app.camera.fov * Math.PI) / 360));
    const target = 140 / pxPerLy; // ly
    let unit, val, toLy;
    const km = target * LY_KM;
    if (km < 1.5e8) { unit = 'km'; val = km; toLy = KM_LY; }
    else if (target / AU_LY < 8000) { unit = 'AU'; val = target / AU_LY; toLy = AU_LY; }
    else { unit = 'Lj'; val = target; toLy = 1; }
    const e = Math.pow(10, Math.floor(Math.log10(val)));
    const m = val / e;
    const nice = (m >= 5 ? 5 : m >= 2 ? 2 : 1) * e;
    const w = (nice * toLy) * pxPerLy;
    $('#scalebar .bar').style.width = w.toFixed(0) + 'px';
    let txt;
    if (unit === 'Lj') txt = fmtDist(nice);
    else if (unit === 'AU') txt = fmtNum(nice, nice < 1 ? 2 : 0) + (EN ? ' AU' : ' AE');
    else txt = nice >= 1e6 ? fmtNum(nice / 1e6, 0) + (EN ? ' million km' : ' Mio. km') : fmtNum(nice, 0) + ' km';
    $('#scalebar-txt').textContent = txt;
  }
}

export function loadJSON(key, def) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; }
}
export function saveJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignorieren */ }
}
