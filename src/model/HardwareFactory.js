import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Builds simple, recognisable stand-in geometry for the bought parts (servos, screws, springs, ...).
 * Their sizes and positions come from the STEP file; the shapes are simplified on purpose.
 * Every geometry carries a vertex `color` attribute so multi-colour parts need one material.
 */

const TONE = {
  servo: 0x3d6894,
  servoEar: 0x4a77a5,
  servoTop: 0xe2e5e9,
  brass: 0xc9a227,
  steel: 0xb4bcc5,
  horn: 0xf1f0ea,
  battery: 0x2a3443,
  board: 0x1d6a44,
  metal: 0xb9c0c8,
  dark: 0x3b4048,
  component: 0x23262b,
};

const METAL = { metalness: 0.85, roughness: 0.32 };
const PLASTIC = { metalness: 0.05, roughness: 0.55 };

export function buildHardware(spec) {
  switch (spec.kind) {
    case 'servo':
      return { geometry: servo(spec), ...PLASTIC };
    case 'screw':
      return { geometry: screw(spec), ...METAL };
    case 'ring':
      return { geometry: colorize(ring(spec.axis, spec.range, spec.rOuter, spec.rInner), TONE.steel), ...METAL };
    case 'ball':
      return { geometry: colorize(new THREE.SphereGeometry(spec.r, 20, 14).translate(...spec.center), TONE.steel), ...METAL };
    case 'spring':
      return { geometry: colorize(spring(spec), TONE.steel), ...METAL };
    case 'torsion':
      return { geometry: colorize(torsion(spec), TONE.steel), ...METAL };
    case 'horn-round':
      return { geometry: hornRound(spec), ...PLASTIC };
    case 'horn-arm':
      return { geometry: hornArm(spec), ...PLASTIC };
    case 'battery':
      return { geometry: colorize(battery(spec), TONE.battery), metalness: 0.2, roughness: 0.6 };
    case 'box':
    default:
      return { geometry: colorize(box(spec.min, spec.max), TONE[spec.tone] ?? TONE.dark), ...PLASTIC };
  }
}

/** A Ø2r steel shaft from a to b, built directly in assembly coordinates. */
export function buildShaft(a, b, r) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const dir = end.clone().sub(start);
  const geometry = new THREE.CylinderGeometry(r, r, dir.length(), 18);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()));
  geometry.translate(...start.clone().add(end).multiplyScalar(0.5).toArray());
  return { geometry: colorize(geometry, 0xd6dbe1), ...METAL };
}

// ---------------------------------------------------------------- shapes
function servo(s) {
  const parts = [
    colorize(box(s.body[0], s.body[1]), TONE.servo),
    colorize(box(s.ears[0], s.ears[1]), TONE.servoEar),
    colorize(cylinder(s.axis, s.boss.center, s.boss.r, s.boss.range), TONE.servo),
    colorize(cylinder(s.axis, s.spline.center, s.spline.r, s.spline.range), TONE.brass),
  ];
  return merge(parts);
}

function screw(s) {
  const head = cylinder(s.axis, [0, 0], s.head[2], [s.head[0], s.head[1]], 20);
  const shank = cylinder(s.axis, [0, 0], s.shank[2], [s.shank[0], s.shank[1]], 14);
  return merge([colorize(head, TONE.steel), colorize(shank, TONE.steel)]);
}

function hornRound(s) {
  return merge([
    colorize(cylinder(s.axis, [0, 0], s.disc[2], [s.disc[0], s.disc[1]], 32), TONE.horn),
    colorize(cylinder(s.axis, [0, 0], s.hub[2], [s.hub[0], s.hub[1]], 24), TONE.horn),
  ]);
}

function hornArm(s) {
  const w = s.rootHalfWidth;
  const [tipX, tipR] = s.tip;
  const shape = new THREE.Shape();
  shape.moveTo(0, -w);
  shape.lineTo(tipX, -tipR);
  shape.absarc(tipX, 0, tipR, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(0, w);
  shape.absarc(0, 0, w, Math.PI / 2, (3 * Math.PI) / 2, false);
  const arm = new THREE.ExtrudeGeometry(shape, { depth: s.arm[1] - s.arm[0], bevelEnabled: false, curveSegments: 10 });
  arm.translate(0, 0, s.arm[0]);
  const hub = cylinder('z', [0, 0], s.hub[2], [s.hub[0], s.hub[1]], 20);
  return merge([colorize(arm, TONE.horn), colorize(hub, TONE.horn)]);
}

function battery(s) {
  const [x0, y0, z0] = s.min;
  const [x1, y1, z1] = s.max;
  const r = Math.min(s.cornerRadius, (x1 - x0) / 2 - 0.1, (y1 - y0) / 2 - 0.1);
  const shape = new THREE.Shape();
  shape.moveTo(x0 + r, y0);
  shape.lineTo(x1 - r, y0);
  shape.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x1, y1 - r);
  shape.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x0 + r, y1);
  shape.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x0, y0 + r);
  shape.absarc(x0 + r, y0 + r, r, Math.PI, 1.5 * Math.PI, false);
  const g = new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, z0);
  return g;
}

function spring(s) {
  const curve = new HelixCurve(s.r, s.range[0], s.range[1], s.turns);
  return alongAxis(new THREE.TubeGeometry(curve, s.turns * 28, s.wire, 6, false), s.axis);
}

function torsion(s) {
  const coil = alongAxis(new THREE.TubeGeometry(new HelixCurve(s.r, s.range[0], s.range[1], s.turns), s.turns * 24, s.wire, 6, false), s.axis);
  const a = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(s.r, 0, s.range[1]), new THREE.Vector3(s.arm, 0, s.range[1])), 2, s.wire, 6, false);
  const b = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, s.r, s.range[0]), new THREE.Vector3(0, s.arm, s.range[0])), 2, s.wire, 6, false);
  return merge([coil, a, b]);
}

class HelixCurve extends THREE.Curve {
  constructor(radius, y0, y1, turns) {
    super();
    Object.assign(this, { radius, y0, y1, turns });
  }

  getPoint(t, target = new THREE.Vector3()) {
    const a = t * this.turns * Math.PI * 2;
    return target.set(this.radius * Math.cos(a), this.y0 + (this.y1 - this.y0) * t, this.radius * Math.sin(a));
  }
}

// ---------------------------------------------------------------- primitives
function box(min, max) {
  const size = [0, 1, 2].map((i) => Math.max(0.2, max[i] - min[i]));
  const g = new THREE.BoxGeometry(...size);
  g.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  return g;
}

/** Cylinder of radius r along `axis`, spanning `range` on that axis, centred at `centre2` in the other two. */
function cylinder(axis, centre2, r, range, segments = 24) {
  const g = alongAxis(new THREE.CylinderGeometry(r, r, Math.max(0.05, range[1] - range[0]), segments), axis);
  const mid = (range[0] + range[1]) / 2;
  const pos = axis === 'x' ? [mid, centre2[0], centre2[1]] : axis === 'y' ? [centre2[0], mid, centre2[1]] : [centre2[0], centre2[1], mid];
  return g.translate(...pos);
}

function ring(axis, range, rOuter, rInner, segments = 32) {
  const profile = [
    [rInner, range[0]],
    [rOuter, range[0]],
    [rOuter, range[1]],
    [rInner, range[1]],
    [rInner, range[0]],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return alongAxis(new THREE.LatheGeometry(profile, segments), axis);
}

/** Primitives are built along +Y; rotate them onto the requested local axis. */
function alongAxis(g, axis) {
  if (axis === 'z') g.rotateX(Math.PI / 2);
  else if (axis === 'x') g.rotateZ(-Math.PI / 2);
  return g;
}

function colorize(g, hex) {
  const geom = g.index ? g.toNonIndexed() : g;
  const c = new THREE.Color(hex);
  const n = geom.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  geom.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geom;
}

function merge(list) {
  const clean = list.map((g) => {
    const geom = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(geom.attributes)) if (!['position', 'normal', 'color'].includes(name)) geom.deleteAttribute(name);
    if (!geom.attributes.normal) geom.computeVertexNormals();
    return geom;
  });
  return mergeGeometries(clean, false);
}
