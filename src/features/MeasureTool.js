import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

/** Click two points on the model to measure the straight-line distance between them (mm). */
export class MeasureTool {
  constructor(viewer) {
    this.viewer = viewer;
    this.active = false;
    this.points = [];
    this.group = new THREE.Group();
    this.group.renderOrder = 20;
    viewer.scene.add(this.group);
    this.dotGeometry = new THREE.SphereGeometry(1.4, 16, 12);
    this.dotMaterial = new THREE.MeshBasicMaterial({ color: 0x5b8def, depthTest: false });
  }

  setActive(on) {
    this.active = on;
    if (!on) this.clear();
    this.viewer.renderer.domElement.style.cursor = on ? 'crosshair' : '';
  }

  /** @returns {number|null} the distance once two points are placed */
  addPoint(point) {
    if (this.points.length === 2) this.clear();
    this.points.push(point.clone());
    const dot = new THREE.Mesh(this.dotGeometry, this.dotMaterial);
    dot.position.copy(point);
    dot.renderOrder = 20;
    this.group.add(dot);
    if (this.points.length < 2) return null;
    const [a, b] = this.points;
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([a, b]),
      new THREE.LineBasicMaterial({ color: 0x5b8def, depthTest: false }),
    );
    line.renderOrder = 20;
    this.group.add(line);
    const distance = a.distanceTo(b);
    const el = document.createElement('div');
    el.className = 'label3d measure';
    el.textContent = `${distance.toFixed(1)} mm`;
    const label = new CSS2DObject(el);
    label.position.copy(a).add(b).multiplyScalar(0.5);
    this.group.add(label);
    return distance;
  }

  clear() {
    this.points = [];
    for (const child of [...this.group.children]) {
      if (child.isCSS2DObject) child.element.remove();
      if (child.isLine) child.geometry.dispose();
      this.group.remove(child);
    }
  }
}
