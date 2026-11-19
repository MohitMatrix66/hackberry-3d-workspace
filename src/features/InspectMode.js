import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

/**
 * Shows one STL part on its own, in the coordinates of its print file, with a dimensioned
 * bounding box. The rest of the assembly is hidden while inspecting.
 */
export class InspectMode {
  constructor(viewer, model) {
    this.viewer = viewer;
    this.model = model;
    this.group = new THREE.Group();
    this.group.visible = false;
    viewer.scene.add(this.group);
    this.partId = null;
  }

  get active() {
    return this.partId !== null;
  }

  async open(partId, colour) {
    this.close(false);
    this.partId = partId;
    const geometry = await this.model.partGeometry(partId);
    if (this.partId !== partId) return; // another part was opened meanwhile
    const box = geometry.boundingBox.clone();
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    this.material = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.5, metalness: 0.02, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.set(-centre.x, -box.min.y, -centre.z); // stand it on the grid, centred
    this.group.add(this.mesh);

    const shifted = box.clone().translate(this.mesh.position);
    this.group.add(new THREE.Box3Helper(shifted, 0x2a9d8f));
    const label = (text, pos) => {
      const el = document.createElement('div');
      el.className = 'label3d dim';
      el.textContent = text;
      const obj = new CSS2DObject(el);
      obj.position.copy(pos);
      this.group.add(obj);
    };
    const { min, max } = shifted;
    label(`X ${size.x.toFixed(1)} mm`, new THREE.Vector3((min.x + max.x) / 2, min.y, max.z));
    label(`Y ${size.y.toFixed(1)} mm`, new THREE.Vector3(max.x, (min.y + max.y) / 2, max.z));
    label(`Z ${size.z.toFixed(1)} mm`, new THREE.Vector3(max.x, min.y, (min.z + max.z) / 2));

    this.model.root.visible = false;
    this.group.visible = true;
    this.viewer.fitBox(shifted, new THREE.Vector3(1, 0.8, 1.25), { padding: 1.35 });
  }

  setWireframe(on) {
    if (this.material) this.material.wireframe = on;
  }

  close(restore = true) {
    for (const child of [...this.group.children]) {
      if (child.isCSS2DObject) child.element.remove();
      if (child.isBox3Helper) child.geometry.dispose();
      this.group.remove(child);
    }
    this.material?.dispose();
    this.material = null;
    this.mesh = null;
    this.partId = null;
    this.group.visible = false;
    if (restore) this.model.root.visible = true;
  }
}
