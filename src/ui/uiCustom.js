import { t } from '../i18n.js';

// Benutzerdefinierte Oberfläche: welche Elemente sichtbar sind und wie sie aussehen.
export const UI_ELEMENTS = [
  ['top', 'Kopfleiste & Suche', '#top'],
  ['ladder', 'Maßstabsleiter', '#ladder'],
  ['info', 'Info-Panel', '#info'],
  ['telemetry', 'Telemetrie', '#telemetry'],
  ['time', 'Zeitsteuerung', '#timectl'],
  ['crumbs', '„Du bist hier“', '#crumbs'],
  ['scalebar', 'Maßstabsbalken', '#scalebar'],
  ['navwidget', 'Kompass & Zoom', '#navwidget'],
  ['home', 'Heim-Knopf', '#home-btn'],
  ['reticle', 'Zielmarkierung', '#reticle'],
  ['offscreen', 'Richtungspfeile', '#offscreen'],
  ['toasts', 'Hinweise', '#toasts'],
  ['effects', 'Scanlines & Vignette', '#fx-scan, #fx-vignette'],
];

const ALL_ON = Object.fromEntries(UI_ELEMENTS.map(([k]) => [k, true]));

export const PRESETS = {
  full: { name: 'Vollständig', sub: 'Alles sichtbar', show: { ...ALL_ON } },
  explorer: { name: 'Entdecker', sub: 'Ohne Zahlen', show: { ...ALL_ON, telemetry: false, time: false, effects: false } },
  minimal: { name: 'Minimal', sub: 'Nur das Nötigste', show: { ...Object.fromEntries(UI_ELEMENTS.map(([k]) => [k, false])), top: true, info: true, reticle: true, toasts: true } },
};

export const ACCENTS = {
  cyan: [110, 231, 255],
  amber: [255, 180, 84],
  green: [93, 255, 176],
  pink: [255, 111, 168],
  violet: [169, 139, 255],
  white: [232, 240, 255],
};

export const UI_DEFAULTS = {
  ui: { ...ALL_ON },
  uiScale: 1,
  uiOpacity: 0.58,
  accent: 'cyan',
  font: 'tech',
  labelScale: 1,
  labelDensity: 'normal',
};

export const LABEL_LIMITS = { low: 18, normal: 60, high: 160 };

let styleEl = null;

export function applyUI(s) {
  const root = document.documentElement.style;
  const ui = { ...ALL_ON, ...(s.ui || {}) };
  // Sichtbarkeit einzelner Elemente
  if (!styleEl) { styleEl = document.createElement('style'); document.head.appendChild(styleEl); }
  styleEl.textContent = UI_ELEMENTS.filter(([k]) => !ui[k])
    .map(([k, , sel]) => sel.split(',').map((x) => `body ${x.trim()}`).join(', ') + ' { display: none !important; }')
    .join('\n');
  for (const [k] of UI_ELEMENTS) document.body.classList.toggle('h-' + k, !ui[k]);
  // Darstellung
  const a = ACCENTS[s.accent] || ACCENTS.cyan;
  const hex = '#' + a.map((v) => v.toString(16).padStart(2, '0')).join('');
  root.setProperty('--accent', hex);
  root.setProperty('--accent-rgb', a.join(', '));
  root.setProperty('--accent-dim', `rgba(${a.join(', ')}, 0.14)`);
  root.setProperty('--line', `rgba(${a.join(', ')}, 0.2)`);
  root.setProperty('--line-strong', `rgba(${a.join(', ')}, 0.5)`);
  root.setProperty('--panel', `rgba(6, 13, 28, ${s.uiOpacity ?? 0.58})`);
  root.setProperty('--ui-scale', String(s.uiScale ?? 1));
  root.setProperty('--label-scale', String(s.labelScale ?? 1));
  document.body.classList.toggle('font-clean', s.font === 'clean');
}

// Dialog "Oberfläche anpassen"
export function customizeHTML(s) {
  const ui = { ...ALL_ON, ...(s.ui || {}) };
  const pct = (v) => Math.round(v * 100) + ' %';
  return `
    <div class="cust">
      <h2>${t('OBERFLÄCHE ANPASSEN')}</h2>
      <h3>${t('VORLAGEN')}</h3>
      <div class="presets">
        ${Object.entries(PRESETS).map(([k, p]) => `<button data-preset="${k}">${t(p.name)}<small>${t(p.sub)}</small></button>`).join('')}
        <button data-preset="reset">${t('Zurücksetzen')}<small>${t('Standardwerte')}</small></button>
      </div>
      <h3>${t('ANGEZEIGTE ELEMENTE')}</h3>
      <div class="chips">
        ${UI_ELEMENTS.map(([k, label]) => `<button class="chip ${ui[k] ? 'on' : ''}" data-el="${k}">${t(label)}</button>`).join('')}
      </div>
      <h3>${t('DARSTELLUNG')}</h3>
      <div class="set-row"><div>${t('Größe der Oberfläche')}</div><div class="ctl"><input type="range" min="0.75" max="1.4" step="0.05" value="${s.uiScale}" data-num="uiScale" /><span class="range-val">${pct(s.uiScale)}</span></div></div>
      <div class="set-row"><div>${t('Deckkraft der Panels')}</div><div class="ctl"><input type="range" min="0.1" max="0.95" step="0.05" value="${s.uiOpacity}" data-num="uiOpacity" /><span class="range-val">${pct(s.uiOpacity)}</span></div></div>
      <div class="set-row"><div>${t('Akzentfarbe')}</div><div class="swatches">
        ${Object.entries(ACCENTS).map(([k, c]) => `<button data-accent="${k}" class="${s.accent === k ? 'on' : ''}" style="background: rgb(${c.join(',')}); color: rgb(${c.join(',')})" title="${k}"></button>`).join('')}
      </div></div>
      <div class="set-row"><div>${t('Schriftstil')}</div><div class="seg">
        <button data-font="tech" class="${s.font !== 'clean' ? 'on' : ''}">${t('Futuristisch')}</button>
        <button data-font="clean" class="${s.font === 'clean' ? 'on' : ''}">${t('Schlicht')}</button>
      </div></div>
      <h3>${t('BESCHRIFTUNGEN IM ALL')}</h3>
      <div class="chips">
        <button class="chip ${s.labels ? 'on' : ''}" data-flag="labels">${t('Objektnamen')}</button>
        <button class="chip ${s.constellations ? 'on' : ''}" data-flag="constellations">${t('Sternbilder')}</button>
        <button class="chip ${s.orbits ? 'on' : ''}" data-flag="orbits">${t('Umlaufbahnen')}</button>
      </div>
      <div class="set-row"><div>${t('Schriftgröße der Namen')}</div><div class="ctl"><input type="range" min="0.75" max="1.6" step="0.05" value="${s.labelScale}" data-num="labelScale" /><span class="range-val">${pct(s.labelScale)}</span></div></div>
      <div class="set-row"><div>${t('Anzahl der Namen')}</div><div class="seg">
        ${['low', 'normal', 'high'].map((d) => `<button data-density="${d}" class="${s.labelDensity === d ? 'on' : ''}">${t({ low: 'Wenige', normal: 'Normal', high: 'Viele' }[d])}</button>`).join('')}
      </div></div>
      <p class="muted" style="font-size:13px;margin:14px 0 0">${t('Tipp: Mit U blendest du die gesamte Oberfläche jederzeit kurz aus.')}</p>
    </div>`;
}

export function bindCustomize(root, app, rerender) {
  const s = app.settings;
  const save = () => { applyUI(s); app.applySettings(); };
  root.querySelectorAll('[data-preset]').forEach((b) => (b.onclick = () => {
    const k = b.dataset.preset;
    if (k === 'reset') Object.assign(s, JSON.parse(JSON.stringify(UI_DEFAULTS)));
    else s.ui = { ...PRESETS[k].show };
    save();
    rerender();
  }));
  root.querySelectorAll('[data-el]').forEach((b) => (b.onclick = () => {
    s.ui = { ...ALL_ON, ...(s.ui || {}) };
    s.ui[b.dataset.el] = !s.ui[b.dataset.el];
    b.classList.toggle('on', s.ui[b.dataset.el]);
    save();
  }));
  root.querySelectorAll('[data-num]').forEach((inp) => (inp.oninput = () => {
    s[inp.dataset.num] = +inp.value;
    inp.nextElementSibling.textContent = Math.round(+inp.value * 100) + ' %';
    save();
  }));
  root.querySelectorAll('[data-accent]').forEach((b) => (b.onclick = () => {
    s.accent = b.dataset.accent;
    root.querySelectorAll('[data-accent]').forEach((x) => x.classList.toggle('on', x === b));
    save();
  }));
  root.querySelectorAll('[data-font]').forEach((b) => (b.onclick = () => {
    s.font = b.dataset.font;
    root.querySelectorAll('[data-font]').forEach((x) => x.classList.toggle('on', x === b));
    save();
  }));
  root.querySelectorAll('[data-flag]').forEach((b) => (b.onclick = () => {
    s[b.dataset.flag] = !s[b.dataset.flag];
    b.classList.toggle('on', s[b.dataset.flag]);
    save();
  }));
  root.querySelectorAll('[data-density]').forEach((b) => (b.onclick = () => {
    s.labelDensity = b.dataset.density;
    root.querySelectorAll('[data-density]').forEach((x) => x.classList.toggle('on', x === b));
    save();
  }));
}
