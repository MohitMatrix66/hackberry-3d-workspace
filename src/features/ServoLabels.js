import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

/** Vertical offsets (px) so the three labels do not sit on top of each other. */
const OFFSET = { 'servo-index': -34, 'servo-fingers': 30, 'servo-thumb': 8 };

/** Floating HTML labels attached to the three servo meshes (they follow explode and motion). */
export class ServoLabels {
  constructor(model) {
    this.labels = [];
    for (const servo of model.servos) {
      const item = model.items.get(servo.item);
      // CSS2DRenderer owns the container's transform, so the offset goes on an inner element
      const el = document.createElement('div');
      const inner = document.createElement('div');
      inner.className = 'label3d';
      inner.style.transform = `translateY(${OFFSET[servo.id] ?? 0}px)`;
      inner.innerHTML = `${servo.title}<small>${servo.bom} · ${servo.torque.split(',')[1]?.trim() ?? servo.torque}</small>`;
      el.append(inner);
      const label = new CSS2DObject(el);
      item.mesh.geometry.computeBoundingBox();
      label.position.copy(item.mesh.geometry.boundingBox.getCenter(new THREE.Vector3()));
      item.mesh.add(label);
      this.labels.push(label);
    }
    this.setVisible(false);
  }

  setVisible(on) {
    this.visible = on;
    for (const l of this.labels) {
      l.visible = on;
      l.element.style.display = on ? '' : 'none';
    }
  }
}
