import * as THREE from 'three';

/**
 * A movable clipping plane along one of the model axes, to look inside the hand.
 * Uses per-material clipping (via `applyPlanes`) so the floor grid and labels are not cut.
 */
export class SectionPlane {
  constructor(viewer, getBox, applyPlanes) {
    this.viewer = viewer;
    this.getBox = getBox;
    this.applyPlanes = applyPlanes;
    this.plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    this.axis = 'x';
    this.position = 0.5; // 0..1 across the model
    this.flip = false;
    this.enabled = false;
    this.helper = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0xe07a2e, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.helper.visible = false;
    this.helper.renderOrder = 10;
    viewer.scene.add(this.helper);
  }

  get planes() {
    return this.enabled ? [this.plane] : [];
  }

  setEnabled(on) {
    this.enabled = on;
    this.applyPlanes(this.planes);
    this.helper.visible = on;
    if (on) this.update();
  }

  set({ axis = this.axis, position = this.position, flip = this.flip } = {}) {
    Object.assign(this, { axis, position, flip });
    this.update();
  }

  update() {
    const box = this.getBox();
    if (box.isEmpty()) return;
    const i = { x: 0, y: 1, z: 2 }[this.axis];
    const min = box.min.getComponent(i);
    const max = box.max.getComponent(i);
    const at = min + (max - min) * this.position;
    const normal = new THREE.Vector3().setComponent(i, this.flip ? 1 : -1);
    // keep the side where normal . p + constant >= 0
    this.plane.set(normal, this.flip ? -at : at);

    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    this.helper.position.copy(centre).setComponent(i, at);
    this.helper.rotation.set(0, 0, 0);
    if (this.axis === 'x') {
      this.helper.rotation.y = Math.PI / 2;
      this.helper.scale.set(size.z * 1.1, size.y * 1.1, 1);
    } else if (this.axis === 'y') {
      this.helper.rotation.x = Math.PI / 2;
      this.helper.scale.set(size.x * 1.1, size.z * 1.1, 1);
    } else {
      this.helper.scale.set(size.x * 1.1, size.y * 1.1, 1);
    }
  }
}
