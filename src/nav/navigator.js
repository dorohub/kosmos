import * as THREE from 'three';
import { frameFromUp } from '../core/coords.js';
import { clamp } from '../core/units.js';

// Optimaler Zoom-&-Schwenk-Pfad nach van Wijk & Nuij (2003), numerisch stabil formuliert.
function zoomPath(w0, w1, u1, rho = 1.42) {
  const rho2 = rho * rho;
  if (u1 < 1e-9 * Math.max(w0, w1)) {
    const S = Math.log(w1 / w0) / rho;
    return { S: Math.abs(S), u: () => 0, w: (s) => w0 * Math.exp(rho * s * Math.sign(S || 1)) };
  }
  const b0 = (w1 * w1 - w0 * w0 + rho2 * rho2 * u1 * u1) / (2 * w0 * rho2 * u1);
  const b1 = (w1 * w1 - w0 * w0 - rho2 * rho2 * u1 * u1) / (2 * w1 * rho2 * u1);
  const r0 = -Math.asinh(b0);
  const r1 = -Math.asinh(b1);
  const S = (r1 - r0) / rho;
  const ch0 = Math.cosh(r0);
  return {
    S,
    u: (s) => ((w0 / rho2) * Math.sinh(rho * s)) / Math.cosh(rho * s + r0),
    w: (s) => (w0 * ch0) / Math.cosh(rho * s + r0),
  };
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const angDiff = (a, b) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export class Navigator extends EventTarget {
  constructor(camera, dom) {
    super();
    this.camera = camera;
    this.dom = dom;
    this.focus = new THREE.Vector3();
    this.focusObj = null;
    this.r = 1e-9; this.rT = 1e-9;
    this.yaw = 0.6; this.yawT = 0.6;
    this.pitch = 0.25; this.pitchT = 0.25;
    this.frame = new THREE.Quaternion();
    this.frameT = null;
    this.camPos = new THREE.Vector3();
    this.prevCam = new THREE.Vector3();
    this.speedLyPerSec = 0;
    this.flight = null;
    this.autoOrbit = 0;
    this.keys = new Set();
    this.pointers = new Map();
    this.enabled = true;
    this._bind();
  }

  minR() {
    const o = this.focusObj;
    if (!o) return 1e-10;
    switch (o.cat) {
      case 'planet': case 'moon': return o.radius * 1.08;
      case 'star': return o.radius * 1.25;
      case 'blackhole': return o.radius * 2.2;
      case 'probe': return 1e-12;
      case 'galaxy': return o.radius * 0.004;
      case 'nebula': return o.radius * 0.05;
      default: return Math.max(1e-10, o.radius * 0.002);
    }
  }

  _bind() {
    const el = this.dom;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      el.setPointerCapture(e.pointerId);
      this.spin = null;
      this._vel = { yaw: 0, pitch: 0, t: e.timeStamp };
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), btn: e.button, shift: e.shiftKey });
      if (this.pointers.size === 2) this._pinch = this._pinchDist();
    });
    el.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > 4) this._interrupt();
      if (this.pointers.size === 2) {
        const d = this._pinchDist();
        if (this._pinch && d > 0) this.rT = clamp(this.rT * (this._pinch / d), this.minR(), 2e11);
        this._pinch = d;
        return;
      }
      if (p.btn === 2 || p.shift) this._pan(dx, dy);
      else {
        // "Greifen": nahe an einer Oberfläche dreht sich die Kugel so, dass der Punkt unter dem Finger bleibt
        const sp = this._rotSpeed();
        const dyaw = -dx * sp, dpitch = dy * sp * 0.85;
        this.yawT += dyaw;
        this.pitchT = clamp(this.pitchT + dpitch, -1.52, 1.52);
        const dtm = Math.max(1, e.timeStamp - (this._vel?.t ?? e.timeStamp - 16));
        const k = Math.min(1, dtm / 40);
        this._vel = { yaw: (this._vel?.yaw ?? 0) * (1 - k) + (dyaw / dtm) * 1000 * k, pitch: (this._vel?.pitch ?? 0) * (1 - k) + (dpitch / dtm) * 1000 * k, t: e.timeStamp };
      }
    });
    const up = (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this._pinch = null;
      const moved = Math.hypot(e.clientX - p.sx, e.clientY - p.sy);
      // Schwung nach dem Loslassen
      if (moved >= 5 && p.btn === 0 && !p.shift && this._vel && e.timeStamp - this._vel.t < 90 && this.pointers.size === 0) {
        this.spin = { yaw: clamp(this._vel.yaw, -4, 4), pitch: clamp(this._vel.pitch, -3, 3) };
      }
      if (moved < 5 && performance.now() - p.t < 450 && p.btn === 0) {
        this.dispatchEvent(new CustomEvent('pick', { detail: { x: e.clientX, y: e.clientY } }));
      }
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('dblclick', (e) => this.dispatchEvent(new CustomEvent('dblpick', { detail: { x: e.clientX, y: e.clientY } })));
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!this.enabled) return;
      this._interrupt();
      let d = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
      d = clamp(d, -250, 250);
      this.zoomAt(e.clientX, e.clientY, Math.exp(d * 0.0016));
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'q', 'e', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', '+', '-', '=', 'shift'].includes(k)) {
        if (k.startsWith('arrow')) e.preventDefault();
        this.keys.add(k);
        if (k !== 'shift') this._interrupt();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  _isSphere() {
    const o = this.focusObj;
    return !!o && (o.cat === 'planet' || o.cat === 'moon' || o.cat === 'star' || o.cat === 'blackhole');
  }

  _rotSpeed() {
    if (!this._isSphere()) return 0.0055;
    const R = this.focusObj.radius;
    const pix = ((this.camera.fov * Math.PI) / 180) / (this.dom.clientHeight || 800);
    return clamp((pix * (this.r - R)) / R * 1.1, 0.00012, 0.0055);
  }

  // Blickstrahl durch einen Bildschirmpunkt (Weltrichtung; Kamera sitzt im Ursprung)
  rayDir(x, y) {
    const rect = this.dom.getBoundingClientRect();
    const v = new THREE.Vector3(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1, 0.5);
    return v.unproject(this.camera).normalize();
  }

  // Zoomen zum Mauszeiger (wie Google Earth)
  zoomAt(x, y, f) {
    const old = this.rT;
    this.rT = clamp(this.rT * f, this.minR(), 2e11);
    const ff = this.rT / old;
    if (ff >= 0.999 || x == null) return;
    const dir = this.rayDir(x, y);
    if (this._isSphere()) {
      const o = this.focusObj;
      const C = this.camPos.clone().sub(o.pos);
      const b = C.dot(dir), c = C.lengthSq() - o.radius * o.radius;
      const disc = b * b - c;
      if (disc < 0) return;
      const t = -b - Math.sqrt(disc);
      if (t < 0) return;
      const H = C.clone().addScaledVector(dir, t).normalize();
      const Cn = C.normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(Cn, H);
      const qk = new THREE.Quaternion().slerp(q, (1 - ff) * 0.9);
      const a = this.directionToAngles(Cn.applyQuaternion(qk));
      this.yawT = this.yaw + angDiff(this.yaw, a.yaw);
      this.pitchT = clamp(a.pitch, -1.52, 1.52);
    } else {
      const fwd = new THREE.Vector3();
      this.camera.getWorldDirection(fwd);
      const P = this.camPos.clone().addScaledVector(dir, this.r / Math.max(0.05, dir.dot(fwd)));
      this._detach();
      if (!this.focusT) this.focusT = this.focus.clone();
      this.focusT.lerp(P, 1 - ff);
    }
  }

  _pinchDist() {
    const ps = [...this.pointers.values()];
    return ps.length < 2 ? 0 : Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
  }

  _interrupt() {
    if (this.flight) {
      this.flight.cancel();
    }
  }

  _detach() {
    if (this.focusObj) {
      this.focusObj = null;
      this.dispatchEvent(new CustomEvent('detach'));
    }
  }

  _basis() {
    const fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    up.copy(this.camera.up);
    right.crossVectors(fwd, up).normalize();
    up.crossVectors(right, fwd).normalize();
    return { fwd, right, up };
  }

  _pan(dx, dy) {
    this._detach();
    const { right, up } = this._basis();
    const h = this.dom.clientHeight || 800;
    const s = (this.r * 2 * Math.tan((this.camera.fov * Math.PI) / 360)) / h;
    this.focus.addScaledVector(right, -dx * s).addScaledVector(up, dy * s);
    if (this.focusT) this.focusT.addScaledVector(right, -dx * s).addScaledVector(up, dy * s);
  }

  setView({ obj = null, pos = null, r, yaw, pitch, up }) {
    this.focusT = null;
    this.spin = null;
    this.focusObj = obj;
    this.focus.copy(obj ? obj.pos : pos);
    this.r = this.rT = r;
    if (yaw !== undefined) this.yaw = this.yawT = yaw;
    if (pitch !== undefined) this.pitch = this.pitchT = pitch;
    if (up) frameFromUp(up, null, this.frame);
    this.frameT = null;
  }

  // Blickrichtung (Welt) -> yaw/pitch im aktuellen Rahmen
  directionToAngles(dirWorld, frame = this.frame) {
    const local = dirWorld.clone().normalize().applyQuaternion(frame.clone().invert());
    return { yaw: Math.atan2(local.x, local.z), pitch: Math.asin(clamp(local.y, -1, 1)) };
  }

  flyTo({ obj = null, pos = null, r, pitch, yaw, up, duration }) {
    if (this.flight) this.flight.cancel(true);
    this.focusT = null;
    this.spin = null;
    return new Promise((resolve) => {
      const start = this.focus.clone();
      const endPos = () => (obj ? obj.pos : pos);
      const u1 = start.distanceTo(endPos());
      const w0 = this.r, w1 = r;
      const path = zoomPath(w0, w1, u1);
      const T = duration ?? clamp(1.1 + path.S * 0.24, 1.3, 11);
      const frame0 = this.frame.clone();
      const frame1 = up ? frameFromUp(up, null) : frame0.clone();
      // Blickrichtung (Welt) weich vom Start zur Zielrichtung drehen
      const dir0 = new THREE.Vector3(Math.cos(this.pitch) * Math.sin(this.yaw), Math.sin(this.pitch), Math.cos(this.pitch) * Math.cos(this.yaw)).applyQuaternion(frame0);
      const ang = this.directionToAngles(dir0, frame1);
      const yaw1 = yaw ?? ang.yaw;
      const pitch1 = pitch ?? clamp(ang.pitch, -1.2, 1.2);
      const dir1 = new THREE.Vector3(Math.cos(pitch1) * Math.sin(yaw1), Math.sin(pitch1), Math.cos(pitch1) * Math.cos(yaw1)).applyQuaternion(frame1);
      const qDir = new THREE.Quaternion().setFromUnitVectors(dir0, dir1);
      const qI = new THREE.Quaternion();
      const dirT = new THREE.Vector3();
      let t = 0;
      this.focusObj = null;
      const f = {
        cancelled: false,
        T,
        S: path.S,
        update: (dt) => {
          t = Math.min(1, t + dt / T);
          f.t = t;
          const e = easeInOut(t);
          const s = e * path.S;
          const u = path.u(s);
          const w = path.w(s);
          const ep = endPos();
          if (u1 > 0) this.focus.copy(start).lerp(ep, Math.min(1, u / u1));
          else this.focus.copy(ep);
          this.r = this.rT = w;
          const fe = THREE.MathUtils.smoothstep(t, 0, 1);
          this.frame.copy(frame0).slerp(frame1, fe);
          const ae = THREE.MathUtils.smoothstep(t, 0.05, 0.95);
          qI.identity().slerp(qDir, ae);
          dirT.copy(dir0).applyQuaternion(qI);
          const an = this.directionToAngles(dirT, this.frame);
          this.yaw = this.yawT = an.yaw;
          this.pitch = this.pitchT = an.pitch;
          if (t >= 1) {
            this.flight = null;
            this.focusObj = obj;
            if (obj) this.focus.copy(obj.pos);
            this.r = this.rT = w1;
            this.frame.copy(frame1);
            this.yaw = this.yawT = yaw1;
            this.pitch = this.pitchT = pitch1;
            resolve(true);
            this.dispatchEvent(new CustomEvent('arrive', { detail: { obj } }));
          }
        },
        cancel: (silent) => {
          if (f.cancelled) return;
          f.cancelled = true;
          this.flight = null;
          this.yawT = this.yaw; this.pitchT = this.pitch; this.rT = this.r;
          if (!silent) this.dispatchEvent(new CustomEvent('flightcancel'));
          resolve(false);
        },
      };
      this.flight = f;
      this.dispatchEvent(new CustomEvent('depart', { detail: { obj, S: path.S, T } }));
    });
  }

  update(dt) {
    if (this.flight) {
      this.flight.update(dt);
    } else {
      if (this.focusObj) { this.focus.copy(this.focusObj.pos); this.focusT = null; }
      else if (this.focusT) {
        this.focus.lerp(this.focusT, 1 - Math.exp(-dt * 7));
        if (this.focus.distanceTo(this.focusT) < this.r * 1e-5) this.focusT = null;
      }
      if (this.spin) {
        this.yawT += this.spin.yaw * dt;
        this.pitchT = clamp(this.pitchT + this.spin.pitch * dt, -1.52, 1.52);
        const decay = Math.exp(-dt * 3.2);
        this.spin.yaw *= decay; this.spin.pitch *= decay;
        if (Math.abs(this.spin.yaw) + Math.abs(this.spin.pitch) < 0.002) this.spin = null;
      }
      // Tastatur-Flug
      const K = this.keys;
      const boost = K.has('shift') ? 4 : 1;
      if (K.size) {
        const { fwd, right, up } = this._basis();
        const v = this.r * 1.1 * dt * boost;
        const mv = new THREE.Vector3();
        if (K.has('w')) mv.addScaledVector(fwd, v);
        if (K.has('s')) mv.addScaledVector(fwd, -v);
        if (K.has('d')) mv.addScaledVector(right, v);
        if (K.has('a')) mv.addScaledVector(right, -v);
        if (K.has('e')) mv.addScaledVector(up, v);
        if (K.has('q')) mv.addScaledVector(up, -v);
        if (mv.lengthSq() > 0) { this._detach(); this.focus.add(mv); if (this.focusT) this.focusT.add(mv); }
        if (K.has('arrowleft')) this.yawT += dt * 1.2;
        if (K.has('arrowright')) this.yawT -= dt * 1.2;
        if (K.has('arrowup')) this.pitchT = clamp(this.pitchT + dt, -1.52, 1.52);
        if (K.has('arrowdown')) this.pitchT = clamp(this.pitchT - dt, -1.52, 1.52);
        if (K.has('+') || K.has('=')) this.rT *= Math.exp(-dt * 1.6 * boost);
        if (K.has('-')) this.rT *= Math.exp(dt * 1.6 * boost);
      }
      if (this.autoOrbit) this.yawT += this.autoOrbit * dt;
      this.rT = clamp(this.rT, this.minR(), 2e11);
      const a = 1 - Math.exp(-dt * 9);
      this.yaw += (this.yawT - this.yaw) * a;
      this.pitch += (this.pitchT - this.pitch) * a;
      const b = 1 - Math.exp(-dt * 6);
      this.r = Math.exp(Math.log(this.r) + (Math.log(this.rT) - Math.log(this.r)) * b);
      if (this.frameT) {
        this.frame.slerp(this.frameT, 1 - Math.exp(-dt * 3));
        if (this.frame.angleTo(this.frameT) < 1e-4) this.frameT = null;
      }
    }
    const cp = Math.cos(this.pitch);
    const off = new THREE.Vector3(cp * Math.sin(this.yaw), Math.sin(this.pitch), cp * Math.cos(this.yaw)).applyQuaternion(this.frame);
    this.prevCam.copy(this.camPos);
    this.camPos.copy(this.focus).addScaledVector(off, this.r);
    if (dt > 0) {
      const v = this.prevCam.distanceTo(this.camPos) / dt;
      this.speedLyPerSec += (v - this.speedLyPerSec) * Math.min(1, dt * 4);
    }
    this.camera.position.set(0, 0, 0);
    this.camera.up.set(0, 1, 0).applyQuaternion(this.frame);
    this.camera.lookAt(-off.x, -off.y, -off.z);
    this.camera.updateMatrixWorld();
  }
}
