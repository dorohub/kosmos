import { t } from '../i18n.js';

// Videoaufnahme der 3D-Ansicht (MediaRecorder auf dem WebGL-Canvas)
const MIME_CANDIDATES = [
  ['video/mp4;codecs=avc1.640033', 'mp4'],
  ['video/mp4;codecs=avc1', 'mp4'],
  ['video/mp4', 'mp4'],
  ['video/webm;codecs=vp9', 'webm'],
  ['video/webm;codecs=vp8', 'webm'],
  ['video/webm', 'webm'],
];

export const REC_SIZES = {
  screen: null,
  '1080': [1920, 1080],
  '1440': [2560, 1440],
  '2160': [3840, 2160],
};

const BITRATE = { screen: 20e6, '1080': 16e6, '1440': 28e6, '2160': 45e6 };

export function recordingSupported() {
  return typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;
}

function pickMime() {
  for (const [m, ext] of MIME_CANDIDATES) {
    try { if (MediaRecorder.isTypeSupported(m)) return { mime: m, ext }; } catch { /* weiter */ }
  }
  return { mime: '', ext: 'webm' };
}

export class Recorder {
  constructor(app) {
    this.app = app;
    this.active = false;
    this.ind = document.getElementById('rec-ind');
    this.timeEl = document.getElementById('rec-time');
    document.getElementById('rec-stop').onclick = () => this.stop();
  }

  start({ res = 'screen', fps = 60, tour = false, audio = true } = {}) {
    if (this.active || !recordingSupported()) return false;
    const app = this.app;
    const size = REC_SIZES[res];
    app.setRecording(size);
    const canvas = app.renderer.domElement;
    const stream = canvas.captureStream(fps);
    // Weltraum-Klang mit aufnehmen, falls eingeschaltet
    if (audio && app.audio.on) {
      const a = app.audio.getStream();
      if (a) a.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    }
    const { mime, ext } = pickMime();
    this.ext = ext;
    this.chunks = [];
    try {
      this.mr = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: BITRATE[res] ?? 20e6 });
    } catch (e) {
      app.setRecording(undefined);
      app.hud.toast(t('Aufnahme nicht möglich: {m}', { m: e.message }));
      return false;
    }
    this.mr.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.mr.onstop = () => this._finish();
    this.mr.start(1000);
    this.active = true;
    this.t0 = performance.now();
    this.res = res;
    this.ind.classList.remove('hidden');
    document.getElementById('btn-rec').classList.add('on');
    this._tick = setInterval(() => {
      const s = Math.floor((performance.now() - this.t0) / 1000);
      this.timeEl.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }, 250);
    this.timeEl.textContent = '00:00';
    app.audio.blip(660, 0.15, 0.05);
    if (tour) {
      this.withTour = true;
      app.tour.onEnd = () => { if (this.active && this.withTour) this.stop(); };
      app.tour.start();
    }
    return true;
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.withTour = false;
    clearInterval(this._tick);
    this.ind.classList.add('hidden');
    document.getElementById('btn-rec').classList.remove('on');
    try { this.mr.stop(); } catch { this._finish(); }
  }

  _finish() {
    const app = this.app;
    app.setRecording(undefined);
    const blob = new Blob(this.chunks, { type: this.mr?.mimeType || (this.ext === 'mp4' ? 'video/mp4' : 'video/webm') });
    this.chunks = [];
    if (!blob.size) { app.hud.toast(t('Aufnahme war leer')); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.download = `kosmos-${app.selected?.id || 'flug'}-${stamp}.${this.ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    const mb = (blob.size / 1e6).toFixed(1);
    app.hud.toast(t('Video <b>gespeichert</b> ({mb} MB, {ext})', { mb, ext: this.ext.toUpperCase() }));
  }
}
