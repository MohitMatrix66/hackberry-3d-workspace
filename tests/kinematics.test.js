import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rotateAbout, transformPoint, multiply, identity, solveFinger, findRoot, signedAngle } from '../src/lib/kinematics.js';

const data = JSON.parse(readFileSync(new URL('../public/data/hackberry-right.json', import.meta.url), 'utf8'));
const index = data.rigs.fingers.find((r) => r.finger === 'index');
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('rotateAbout', () => {
  it('keeps the pivot fixed and turns a point by 90 degrees', () => {
    const m = rotateAbout([0, 0, 1], [1, 1, 0], 90);
    expect(transformPoint(m, [1, 1, 0])).toEqual([1, 1, 0].map((v) => expect.closeTo(v, 9)));
    const p = transformPoint(m, [2, 1, 0]); // 1 mm along +x from the pivot -> 1 mm along +y
    expect(p[0]).toBeCloseTo(1, 9);
    expect(p[1]).toBeCloseTo(2, 9);
  });

  it('composes with multiply like successive rotations', () => {
    const a = rotateAbout([0, 1, 0], [0, 0, 0], 30);
    const b = rotateAbout([0, 1, 0], [0, 0, 0], 60);
    const ab = multiply(a, b);
    const c = rotateAbout([0, 1, 0], [0, 0, 0], 90);
    ab.forEach((v, i) => expect(v).toBeCloseTo(c[i], 9));
    multiply(identity(), c).forEach((v, i) => expect(v).toBeCloseTo(c[i], 12));
  });
});

describe('signedAngle and findRoot', () => {
  it('measures angles about an axis', () => {
    expect(signedAngle([1, 0, 0], [0, 1, 0], [0, 0, 1])).toBeCloseTo(90, 9);
    expect(signedAngle([1, 0, 0], [0, 1, 0], [0, 0, -1])).toBeCloseTo(-90, 9);
  });

  it('finds the root closest to the hint', () => {
    const f = (x) => (x - 10) * (x - 50);
    expect(findRoot(f, 0, 100, 0)).toBeCloseTo(10, 6);
    expect(findRoot(f, 0, 100, 60)).toBeCloseTo(50, 6);
    expect(findRoot((x) => x * x + 1, 0, 10)).toBeNull();
  });
});

describe('finger linkage (real HACKberry index rig)', () => {
  it('closes as one rigid piece in free air', () => {
    const sol = solveFinger(index, 40, 40);
    expect(sol.pip).toBe(0);
    for (const body of ['input', 'distal', 'coupler']) sol[body].forEach((v, i) => expect(v).toBeCloseTo(sol.proximal[i], 9));
  });

  it('wraps the middle joint when the proximal phalanx is stopped', () => {
    const sol = solveFinger(index, 60, 30);
    expect(sol).not.toBeNull();
    expect(sol.pip).toBeGreaterThan(5);
    // the coupler link must keep its length
    const before = dist(index.inputPin, index.distalPin);
    const after = dist(transformPoint(sol.input, index.inputPin), transformPoint(sol.distal, index.distalPin));
    expect(after).toBeCloseTo(before, 3);
    // the coupler body carries both of its pins to the right places
    expect(dist(transformPoint(sol.coupler, index.inputPin), transformPoint(sol.input, index.inputPin))).toBeLessThan(1e-6);
    expect(dist(transformPoint(sol.coupler, index.distalPin), transformPoint(sol.distal, index.distalPin))).toBeLessThan(1e-3);
  });

  it('every finger and the thumb have a rig with all moving bodies', () => {
    expect(data.rigs.fingers.map((r) => r.finger).sort()).toEqual(['index', 'little', 'middle', 'ring']);
    for (const rig of data.rigs.fingers) {
      expect(rig.bodies.proximal.length).toBeGreaterThan(0);
      expect(rig.bodies.distal.length).toBeGreaterThan(0);
      expect(rig.bodies.coupler.length).toBeGreaterThan(0);
    }
    expect(data.rigs.thumb.bodies.length).toBeGreaterThan(1);
  });
});
