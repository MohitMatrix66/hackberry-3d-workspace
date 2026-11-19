import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/**
 * Owns the WebGL renderer, camera, controls, lights and the render loop.
 * Everything else adds objects to `viewer.root` and calls the helpers below.
 */
export class Viewer {
  constructor(container) {
    this.container = container;
    this.frameCallbacks = new Set();
    this.tween = null;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.localClippingEnabled = true; // section plane clips model materials only
    this.clipPlanes = [];
    container.prepend(this.renderer.domElement);
    this.renderer.domElement.tabIndex = 0;

    this.labelRenderer = new CSS2DRenderer();
    Object.assign(this.labelRenderer.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    container.append(this.labelRenderer.domElement);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;

    this.camera = new THREE.PerspectiveCamera(32, 1, 1, 8000);
    this.camera.position.set(420, 260, 420);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 30;
    this.controls.maxDistance = 2500;
    this.controls.addEventListener('start', () => (this.tween = null));

    const hemi = new THREE.HemisphereLight(0xffffff, 0x3a4552, 0.85);
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(1, 1.6, 1.1);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.55);
    fill.position.set(-1.2, 0.4, -0.8);
    const rim = new THREE.DirectionalLight(0xffffff, 0.35);
    rim.position.set(0, -1, 0);
    this.camera.add(new THREE.DirectionalLight(0xffffff, 0.35)); // soft headlight follows the camera
    this.scene.add(hemi, key, fill, rim, this.camera);

    this.root = new THREE.Group();
    this.root.name = 'model-root';
    this.scene.add(this.root);

    this.grid = new THREE.GridHelper(900, 45, 0x56606c, 0x2c3540);
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.35;
    this.scene.add(this.grid);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => this.#frame());
  }

  /** Rebuild the floor grid in the colours of the current theme. */
  setTheme(dark) {
    const { position, visible } = this.grid;
    this.scene.remove(this.grid);
    this.grid.geometry.dispose();
    this.grid.material.dispose();
    this.grid = new THREE.GridHelper(900, 45, dark ? 0x56606c : 0x9aa6b3, dark ? 0x2c3540 : 0xd3dae2);
    this.grid.material.transparent = true;
    this.grid.material.opacity = dark ? 0.35 : 0.6;
    this.grid.position.copy(position);
    this.grid.visible = visible;
    this.scene.add(this.grid);
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.labelRenderer.setSize(w, h);
  }

  onFrame(cb) {
    this.frameCallbacks.add(cb);
    return () => this.frameCallbacks.delete(cb);
  }

  #frame() {
    const now = performance.now();
    if (this.tween) {
      const t = Math.min(1, (now - this.tween.start) / this.tween.duration);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this.camera.position.lerpVectors(this.tween.fromPos, this.tween.toPos, e);
      this.controls.target.lerpVectors(this.tween.fromTarget, this.tween.toTarget, e);
      if (t >= 1) this.tween = null;
    }
    this.frameCallbacks.forEach((cb) => cb(now));
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  /**
   * Smoothly move the camera so `box` fills the view, looking along `direction` (world).
   * Fits the eight projected box corners (tighter than a bounding sphere for a long arm).
   */
  fitBox(box, direction = null, { duration = 650, padding = 1.12 } = {}) {
    if (box.isEmpty()) return;
    const centre = box.getCenter(new THREE.Vector3());
    const dir = (direction ? direction.clone() : this.camera.position.clone().sub(this.controls.target)).normalize();
    const up = Math.abs(dir.y) > 0.98 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, dir).normalize();
    const camUp = new THREE.Vector3().crossVectors(dir, right);
    const tanV = Math.tan((this.camera.fov * Math.PI) / 360);
    const tanH = tanV * this.camera.aspect;
    let dist = 0;
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(centre);
      const depth = p.dot(dir); // towards the camera
      dist = Math.max(dist, Math.abs(p.dot(right)) / tanH + depth, Math.abs(p.dot(camUp)) / tanV + depth);
    }
    dist *= padding;
    this.animateTo(centre.clone().addScaledVector(dir, dist), centre, duration);
  }

  animateTo(position, target, duration = 650) {
    if (duration <= 0) {
      this.camera.position.copy(position);
      this.controls.target.copy(target);
      return;
    }
    this.tween = {
      start: performance.now(),
      duration,
      fromPos: this.camera.position.clone(),
      toPos: position.clone(),
      fromTarget: this.controls.target.clone(),
      toTarget: target.clone(),
    };
  }

  /** Raycast `objects` from a pointer event; skips hits removed by the clipping plane. */
  pick(event, objects) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(objects, false);
    const planes = this.clipPlanes;
    return hits.find((h) => h.object.visible && planes.every((p) => p.distanceToPoint(h.point) >= 0)) || null;
  }

  screenshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
}
