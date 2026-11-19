import * as THREE from 'three';
import { h } from './dom.js';

/**
 * Camera presets. After HandModel orients the hand: +X = towards the fingertips, +Y = back of the hand,
 * -Z = thumb (radial) side, +Z = little-finger (ulnar) side.
 */
export const VIEWS = [
  ['3D', new THREE.Vector3(0.3, 0.62, -1)],
  ['Back', new THREE.Vector3(0, 1, 0.12)],
  ['Palm', new THREE.Vector3(0, -1, 0.12)],
  ['Thumb side', new THREE.Vector3(0.05, 0.18, -1)],
  ['Little side', new THREE.Vector3(0.05, 0.18, 1)],
  ['Front', new THREE.Vector3(1, 0.22, -0.12)],
];

export class ViewBar {
  constructor(app, host) {
    host.replaceChildren(...VIEWS.map(([name, dir], i) =>
      h('button', { type: 'button', title: `${name} view (${i + 1})`, onclick: () => app.setView(i) }, name)));
  }
}
