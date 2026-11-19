/**
 * Finger and thumb kinematics for the HACKberry hand, in plain JavaScript (no three.js),
 * so the maths can be unit-tested in Node.
 *
 * All matrices are 4x4, column-major (the order three.js `Matrix4.fromArray` expects).
 *
 * Finger model (see scripts/hackberry/rigs.py):
 *   - input crank and proximal phalanx both turn about the MCP shaft,
 *   - the coupler joins the input pin to the distal pin on the middle-distal phalanx,
 *   - the middle-distal phalanx turns about the PIP shaft.
 * alpha = input angle, beta = proximal angle. In free air beta = alpha and the finger turns as one
 * piece. When the proximal phalanx is stopped by an object (beta < alpha) the four-bar loop is solved
 * for the PIP angle, which makes the fingertip wrap around the object.
 */

export const DEG = Math.PI / 180;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const addv = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (a) => Math.hypot(a[0], a[1], a[2]);
const normalize = (a) => scale(a, 1 / length(a));

export const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Rotation by `angleDeg` about the line through `point` with direction `axis`. */
export function rotateAbout(axis, point, angleDeg) {
  const [x, y, z] = normalize(axis);
  const t = angleDeg * DEG;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const k = 1 - c;
  // rotation part (row-major r[row][col])
  const r = [
    [c + x * x * k, x * y * k - z * s, x * z * k + y * s],
    [y * x * k + z * s, c + y * y * k, y * z * k - x * s],
    [z * x * k - y * s, z * y * k + x * s, c + z * z * k],
  ];
  // translation = p - R p
  const rp = [0, 1, 2].map((i) => r[i][0] * point[0] + r[i][1] * point[1] + r[i][2] * point[2]);
  const tr = sub(point, rp);
  return [r[0][0], r[1][0], r[2][0], 0, r[0][1], r[1][1], r[2][1], 0, r[0][2], r[1][2], r[2][2], 0, tr[0], tr[1], tr[2], 1];
}

export function translation(v) {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, v[0], v[1], v[2], 1];
}

/** a * b (column-major). */
export function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

export function transformPoint(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

/** Signed angle (deg) from v0 to v1 measured about `axis`, after projecting both onto the plane. */
export function signedAngle(v0, v1, axis) {
  const u = normalize(axis);
  const a = sub(v0, scale(u, dot(v0, u)));
  const b = sub(v1, scale(u, dot(v1, u)));
  return Math.atan2(dot(cross(a, b), u), dot(a, b)) / DEG;
}

/**
 * Solve one finger.
 * @param {object} rig   rig from the data file (axis, mcp, pip, inputPin, distalPin, flexSign)
 * @param {number} alpha input angle in degrees (>= 0 closes the finger)
 * @param {number} beta  proximal-phalanx angle in degrees (beta <= alpha)
 * @param {number} hint  previous PIP angle, used to stay on the same solution branch
 * @returns {{input:number[], proximal:number[], distal:number[], coupler:number[], pip:number}|null}
 */
export function solveFinger(rig, alpha, beta = alpha, hint = 0) {
  const u = normalize(rig.axis);
  const s = rig.flexSign;
  const input = rotateAbout(u, rig.mcp, s * alpha);
  const proximal = rotateAbout(u, rig.mcp, s * beta);
  const i0 = rig.inputPin;
  const d0 = rig.distalPin;
  const i1 = transformPoint(input, i0);
  const p1 = transformPoint(proximal, rig.pip);
  const dCarried = transformPoint(proximal, d0);
  const lc = length(sub(i0, d0));
  const gap = (delta) => length(sub(i1, transformPoint(rotateAbout(u, p1, s * delta), dCarried))) - lc;

  let pip = 0;
  if (Math.abs(alpha - beta) > 1e-9) {
    pip = findRoot(gap, -20, 140, hint);
    if (pip === null) return null;
  }
  const distal = multiply(rotateAbout(u, p1, s * pip), proximal);
  const d1 = transformPoint(distal, d0);
  const phi = signedAngle(sub(d0, i0), sub(d1, i1), u);
  const rot = rotateAbout(u, i0, phi);
  const coupler = multiply(translation(sub(i1, i0)), rot);
  return { input, proximal, distal, coupler, pip };
}

/** Root of f in [lo, hi] closest to `hint` (scan + bisection). Returns null when there is none. */
export function findRoot(f, lo, hi, hint = 0, step = 0.5) {
  const roots = [];
  let x0 = lo;
  let f0 = f(x0);
  for (let x1 = lo + step; x1 <= hi + 1e-9; x1 += step) {
    const f1 = f(x1);
    if (f0 === 0) roots.push(x0);
    else if (f0 * f1 < 0) {
      let a = x0;
      let b = x1;
      let fa = f0;
      for (let i = 0; i < 40; i++) {
        const m = (a + b) / 2;
        const fm = f(m);
        if (fa * fm <= 0) b = m;
        else {
          a = m;
          fa = fm;
        }
      }
      roots.push((a + b) / 2);
    }
    x0 = x1;
    f0 = f1;
  }
  if (!roots.length) return null;
  return roots.reduce((best, r) => (Math.abs(r - hint) < Math.abs(best - hint) ? r : best));
}

/** Rotation of the thumb proximal phalanx about the thumb servo axis. */
export function thumbMatrix(thumbRig, angle) {
  return rotateAbout(thumbRig.axis, thumbRig.point, thumbRig.sign * angle);
}

/** The index motor gear turns the opposite way to the input sector (external gear pair). */
export function gearMatrix(indexRig, alpha) {
  const g = indexRig.gear;
  return rotateAbout(indexRig.axis, g.center, -g.ratio * indexRig.flexSign * alpha);
}
