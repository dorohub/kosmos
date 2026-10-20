import * as THREE from 'three';

// Kamera-relatives Rendering mit dynamischem Maßstab:
// Jedes Objekt hat eine Universumsposition (float64, Lj). Pro Frame wird es relativ zur Kamera
// platziert und mit k skaliert, sodass der Fokus immer ~1 Rendereinheit entfernt ist.
export class World {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
  }
  add(obj, upos, scale = 1, parent = null) {
    const it = { obj, upos, scale };
    this.items.push(it);
    (parent || this.scene).add(obj);
    return it;
  }
  remove(obj) {
    this.items = this.items.filter((it) => it.obj !== obj);
    obj.parent?.remove(obj);
  }
  update(camPos, k) {
    for (const it of this.items) {
      const o = it.obj;
      if (!o.visible) continue;
      o.position.set((it.upos.x - camPos.x) * k, (it.upos.y - camPos.y) * k, (it.upos.z - camPos.z) * k);
      o.scale.setScalar(it.scale * k);
    }
  }
}

export const ZERO = new THREE.Vector3(0, 0, 0);
