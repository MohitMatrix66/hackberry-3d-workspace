import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildHardware, buildShaft } from './HardwareFactory.js';
import { solveFinger, thumbMatrix, gearMatrix } from '../lib/kinematics.js';

const PROFILE_COLOURS = { cover: '#9aa7b5', structural: '#2a9d8f', precision: '#e07a2e' };
const PRINTED_PLASTIC = '#efeee8';
/** Parts hidden by "Show inside": the back cover and the outer shells. */
export const COVER_PARTS = ['R-H-15', 'R-SO-01', 'R-SO-02', 'R-W-08', 'R-T-06'];

/**
 * The assembled hand: one mesh per printed-part instance, bought part and steel shaft.
 *
 * Each mesh's matrix is rebuilt from three pieces whenever something changes:
 *   matrix = explodeOffset * rigMotion * baseMatrix
 * - baseMatrix: where the part sits in the HACKberry assembly (from the STEP file)
 * - rigMotion:  finger/thumb/gear motion from the mechanism demo
 * - explodeOffset: translation for the exploded view
 */
export class HandModel {
  /** Fetch the data file and every STL used by the assembly. */
  static async load(baseUrl, onProgress = () => {}) {
    const data = await fetch(`${baseUrl}data/hackberry-right.json`).then((r) => {
      if (!r.ok) throw new Error(`Could not load data/hackberry-right.json (${r.status})`);
      return r.json();
    });
    const needed = [...new Set(data.instances.map((i) => i.part))];
    const parts = new Map(data.parts.map((p) => [p.id, p]));
    const loader = new STLLoader();
    const geometries = new Map();
    let done = 0;
    await Promise.all(
      needed.map(async (id) => {
        const raw = await loader.loadAsync(baseUrl + parts.get(id).file);
        geometries.set(id, prepare(raw));
        done += 1;
        onProgress(done / needed.length, id);
      }),
    );
    return new HandModel(data, geometries, baseUrl);
  }

  constructor(data, geometries, baseUrl) {
    this.data = data;
    this.baseUrl = baseUrl;
    this.geometries = geometries;
    this.units = new Map(data.units.map((u) => [u.id, u]));
    this.parts = new Map(data.parts.map((p) => [p.id, p]));
    this.servos = data.servos;
    this.rigs = data.rigs;
    this.items = new Map();
    this.explode = 0;
    this.colorMode = 'unit';
    this.xray = false;
    this.highlighted = new Set();
    this.rigMatrices = new Map();
    this.fingerState = new Map();

    this.root = new THREE.Group();
    this.root.name = 'hand';
    this.root.matrixAutoUpdate = false;

    for (const inst of data.instances) {
      const part = this.parts.get(inst.part);
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.02, side: THREE.DoubleSide });
      this.#addItem({ id: inst.id, kind: 'part', partId: inst.part, unit: inst.unit, name: part.name, profile: part.profile },
        geometries.get(inst.part), mat, inst.matrix, inst.center);
    }
    const hwCache = new Map();
    for (const hw of data.hardware) {
      const spec = data.hardwareTypes[hw.type];
      if (!hwCache.has(hw.type)) hwCache.set(hw.type, buildHardware(spec));
      const built = hwCache.get(hw.type);
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: built.metalness, roughness: built.roughness });
      this.#addItem({ id: hw.id, kind: 'hardware', type: hw.type, unit: hw.unit, name: spec.name, hwKind: spec.kind },
        built.geometry, mat, hw.matrix, hw.center);
    }
    for (const sh of data.shafts) {
      const built = buildShaft(sh.a, sh.b, sh.r);
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: built.metalness, roughness: built.roughness });
      this.#addItem({ id: sh.id, kind: 'shaft', unit: sh.unit, name: sh.name, length: sh.length },
        built.geometry, mat, null, sh.center);
    }

    this.#orient(data.meta.frame);
    this.#computeExplodeCentres();
    this.applyColors();
    this.updateTransforms();
  }

  // ------------------------------------------------------------------ building
  #addItem(info, geometry, material, matrixArray, center) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.matrixAutoUpdate = false;
    mesh.userData.itemId = info.id;
    const base = matrixArray ? new THREE.Matrix4().fromArray(matrixArray) : new THREE.Matrix4();
    mesh.matrix.copy(base);
    this.root.add(mesh);
    this.items.set(info.id, { ...info, mesh, base, center: new THREE.Vector3(...center) });
  }

  /** Rotate the assembly so the fingers point along +X and the back of the hand faces +Y. */
  #orient(frame) {
    const f = new THREE.Vector3(...frame.forward).normalize();
    const d = new THREE.Vector3(...frame.dorsal);
    d.addScaledVector(f, -d.dot(f)).normalize();
    const s = new THREE.Vector3().crossVectors(f, d);
    const rot = new THREE.Matrix4().set(f.x, f.y, f.z, 0, d.x, d.y, d.z, 0, s.x, s.y, s.z, 0, 0, 0, 0, 1);
    this.root.matrix.copy(rot);
    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.root);
    const centre = box.getCenter(new THREE.Vector3());
    this.root.matrix.premultiply(new THREE.Matrix4().makeTranslation(-centre.x, -box.min.y, -centre.z));
    this.root.updateMatrixWorld(true);
    this.floorY = 0;
  }

  #computeExplodeCentres() {
    const sums = new Map();
    for (const it of this.items.values()) {
      if (it.kind !== 'part') continue;
      const s = sums.get(it.unit) || { v: new THREE.Vector3(), n: 0 };
      s.v.add(it.center);
      s.n += 1;
      sums.set(it.unit, s);
    }
    this.unitCentres = new Map([...sums].map(([u, s]) => [u, s.v.divideScalar(s.n)]));
    const palm = this.unitCentres.get('palm');
    for (const it of this.items.values()) {
      const uc = this.unitCentres.get(it.unit) || palm;
      it.explodeDir = uc.clone().sub(palm).multiplyScalar(0.9).add(it.center.clone().sub(uc).multiplyScalar(0.55));
    }
  }

  // ------------------------------------------------------------------ transforms
  updateTransforms() {
    const offset = new THREE.Matrix4();
    for (const it of this.items.values()) {
      offset.makeTranslation(it.explodeDir.x * this.explode, it.explodeDir.y * this.explode, it.explodeDir.z * this.explode);
      const rig = this.rigMatrices.get(it.id);
      it.mesh.matrix.copy(offset);
      if (rig) it.mesh.matrix.multiply(rig);
      it.mesh.matrix.multiply(it.base);
      it.mesh.matrixWorldNeedsUpdate = true;
    }
  }

  setExplode(t) {
    this.explode = t;
    this.updateTransforms();
  }

  /**
   * Pose the mechanism.
   * @param {object} pose
   * @param {number} pose.close   0..1 closing of the four fingers (servo input)
   * @param {number} pose.thumb   0..1 thumb closing
   * @param {number|null} pose.contact  angle (deg) at which an object stops the proximal phalanges, or null
   * @returns {object} readout of the main angles for the UI
   */
  setPose({ close = 0, thumb = 0, contact = null }) {
    this.rigMatrices.clear();
    const readout = { mcp: 0, pip: 0, input: 0 };
    for (const rig of this.rigs.fingers) {
      let alpha = close * rig.maxClose;
      let beta = contact === null ? alpha : Math.min(alpha, contact);
      if (!rig.canWrap) alpha = beta; // only the index can wrap; the others simply stop at the object
      const prev = this.fingerState.get(rig.finger) || { pip: 0 };
      let sol = solveFinger(rig, alpha, beta, prev.pip);
      while (!sol && alpha > beta) {
        alpha = Math.max(beta, alpha - 1); // beyond the linkage's reach: hold the last reachable pose
        sol = solveFinger(rig, alpha, beta, prev.pip);
      }
      if (!sol) continue;
      this.fingerState.set(rig.finger, { pip: sol.pip });
      for (const [body, ids] of Object.entries(rig.bodies)) {
        const m = new THREE.Matrix4().fromArray(sol[body]);
        ids.forEach((id) => this.rigMatrices.set(id, m));
      }
      if (rig.gear) {
        const g = new THREE.Matrix4().fromArray(gearMatrix(rig, alpha));
        rig.gear.items.forEach((id) => this.rigMatrices.set(id, g));
      }
      if (rig.finger === 'index') Object.assign(readout, { input: alpha, mcp: beta, pip: sol.pip });
    }
    const t = new THREE.Matrix4().fromArray(thumbMatrix(this.rigs.thumb, thumb * this.rigs.thumb.maxClose));
    this.rigs.thumb.bodies.forEach((id) => this.rigMatrices.set(id, t));
    readout.thumb = thumb * this.rigs.thumb.maxClose;
    this.updateTransforms();
    return readout;
  }

  // ------------------------------------------------------------------ appearance
  setColorMode(mode) {
    this.colorMode = mode;
    this.applyColors();
  }

  setXray(on) {
    this.xray = on;
    this.applyColors();
  }

  applyColors() {
    for (const it of this.items.values()) {
      const m = it.mesh.material;
      if (it.kind === 'part') {
        const c = this.colorMode === 'print' ? PROFILE_COLOURS[it.profile] : this.colorMode === 'real' ? PRINTED_PLASTIC : this.units.get(it.unit).color;
        m.color.set(c);
        const ghost = this.xray && !this.highlighted.has(it.id);
        m.transparent = ghost;
        m.opacity = ghost ? 0.13 : 1;
        m.depthWrite = !ghost;
      }
      m.emissive.set(this.highlighted.has(it.id) ? 0xff7a1a : 0x000000);
      m.emissiveIntensity = this.highlighted.has(it.id) ? 0.38 : 0;
      m.needsUpdate = true;
    }
  }

  highlight(ids) {
    this.highlighted = new Set(ids);
    this.applyColors();
  }

  /** Clip every model material with the given planes (empty array = no section). */
  setClippingPlanes(planes) {
    for (const it of this.items.values()) {
      it.mesh.material.clippingPlanes = planes.length ? planes : null;
      it.mesh.material.needsUpdate = true;
    }
  }

  // ------------------------------------------------------------------ visibility & queries
  get meshes() {
    return [...this.items.values()].map((it) => it.mesh);
  }

  itemsWhere(pred) {
    return [...this.items.values()].filter(pred);
  }

  setVisible(pred, visible) {
    for (const it of this.items.values()) if (pred(it)) it.mesh.visible = visible;
  }

  isolate(ids) {
    const keep = new Set(ids);
    for (const it of this.items.values()) it.mesh.visible = keep.has(it.id);
  }

  showAll() {
    for (const it of this.items.values()) it.mesh.visible = true;
  }

  /** World-space bounding box of the given items (or of everything visible). */
  boundingBox(ids = null) {
    const box = new THREE.Box3();
    this.root.updateMatrixWorld(true);
    const list = ids ? ids.map((id) => this.items.get(id)).filter(Boolean) : [...this.items.values()].filter((it) => it.mesh.visible);
    for (const it of list) box.expandByObject(it.mesh);
    return box;
  }

  idsOfPart(partId) {
    return this.itemsWhere((it) => it.partId === partId).map((it) => it.id);
  }

  idsOfUnit(unitId) {
    return this.itemsWhere((it) => it.unit === unitId).map((it) => it.id);
  }

  /** Load (and cache) the geometry of a part that is not in the assembly, e.g. an accessory. */
  async partGeometry(partId) {
    if (!this.geometries.has(partId)) {
      const raw = await new STLLoader().loadAsync(this.baseUrl + this.parts.get(partId).file);
      this.geometries.set(partId, prepare(raw));
    }
    return this.geometries.get(partId);
  }
}

/** Smooth the faceted STL normals but keep sharp CAD edges crisp. */
function prepare(geometry) {
  geometry.deleteAttribute('normal');
  const smooth = toCreasedNormals(geometry, (32 * Math.PI) / 180);
  smooth.computeBoundingBox();
  smooth.computeBoundingSphere();
  return smooth;
}
