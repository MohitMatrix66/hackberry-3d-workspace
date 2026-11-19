import { h, svg } from './dom.js';
import { ICONS } from './icons.js';

/**
 * Vertical tool strip in the viewport. Buttons either toggle a feature directly or open a small
 * popover with settings (explode amount, section plane, colour mode).
 */
export class Toolbar {
  constructor(app, host, viewport) {
    this.app = app;
    this.host = host;
    this.viewport = viewport;
    this.buttons = new Map();
    this.popover = null;
    this.render();
    app.bus.on('state', () => this.sync());
    document.addEventListener('pointerdown', (e) => {
      if (this.popover && !this.popover.contains(e.target) && !this.host.contains(e.target)) this.#closePopover();
    });
  }

  render() {
    const tools = [
      ['fit', 'Fit the hand in view (F)', () => this.app.focusSelectionOrAll()],
      ['explode', 'Explode the assembly (E)', (btn) => this.#openPopover(btn, () => this.#explodePopover())],
      ['xray', 'X-ray: see servos and shafts (X)', () => this.app.toggle('xray')],
      ['inside', 'Show inside: hide the covers', () => this.app.toggle('inside')],
      ['section', 'Section plane (S)', (btn) => this.#openPopover(btn, () => this.#sectionPopover(), () => !this.app.state.section && this.app.toggle('section'))],
      'sep',
      ['measure', 'Measure distance (M)', () => this.app.toggle('measure')],
      ['servo', 'Servo labels (L)', () => this.app.toggle('labels')],
      ['palette', 'Colour mode (C)', (btn) => this.#openPopover(btn, () => this.#colourPopover())],
      ['grid', 'Floor grid', () => this.app.toggle('grid')],
      'sep',
      ['camera', 'Save screenshot (P)', () => this.app.screenshot()],
    ];
    for (const t of tools) {
      if (t === 'sep') {
        this.host.append(h('div', { class: 'sep' }));
        continue;
      }
      const [id, tip, action] = t;
      const btn = h('button', { class: 'tool', type: 'button', 'data-tip': tip, 'aria-label': tip }, svg(ICONS[id]));
      btn.addEventListener('click', () => action(btn));
      this.buttons.set(id, btn);
      this.host.append(btn);
    }
    this.sync();
  }

  sync() {
    const s = this.app.state;
    const on = { explode: s.explode > 0.001, xray: s.xray, inside: s.inside, section: s.section, measure: s.measure, servo: s.labels, grid: s.grid };
    for (const [id, btn] of this.buttons) btn.classList.toggle('on', Boolean(on[id]));
    this.popoverSync?.();
  }

  #openPopover(btn, build, onOpen) {
    const same = this.popover && this.popover.dataset.for === btn.getAttribute('aria-label');
    this.#closePopover();
    if (same) return;
    onOpen?.();
    const { node, sync } = build();
    node.dataset.for = btn.getAttribute('aria-label');
    node.style.top = `${btn.offsetTop + 12}px`;
    this.viewport.append(node);
    this.popover = node;
    this.popoverSync = sync;
  }

  #closePopover() {
    this.popover?.remove();
    this.popover = null;
    this.popoverSync = null;
  }

  #explodePopover() {
    const range = h('input', { type: 'range', min: 0, max: 100, value: Math.round(this.app.state.explode * 100), 'aria-label': 'Explode amount' });
    range.addEventListener('input', () => this.app.setExplode(range.value / 100, false));
    const node = h('div', { class: 'popover' },
      h('h4', null, 'Exploded view'),
      range,
      h('div', { class: 'row' },
        h('button', { class: 'btn small', type: 'button', onclick: () => this.app.setExplode(0, true) }, 'Assemble'),
        h('button', { class: 'btn small', type: 'button', onclick: () => this.app.setExplode(1, true) }, 'Explode')),
      h('p', { class: 'faint', style: { marginTop: '8px', fontSize: '12px' } }, 'Units move apart, then parts spread within each unit.'));
    return { node, sync: () => (range.value = Math.round(this.app.state.explode * 100)) };
  }

  #sectionPopover() {
    const sp = this.app.section;
    const axisSeg = h('div', { class: 'seg' }, ['x', 'y', 'z'].map((a) => {
      const b = h('button', { type: 'button', class: sp.axis === a ? 'on' : '' }, { x: 'Length', y: 'Height', z: 'Width' }[a]);
      b.addEventListener('click', () => {
        sp.set({ axis: a });
        axisSeg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      });
      return b;
    }));
    const range = h('input', { type: 'range', min: 0, max: 100, value: Math.round(sp.position * 100), 'aria-label': 'Section position' });
    range.addEventListener('input', () => sp.set({ position: range.value / 100 }));
    const flip = h('input', { type: 'checkbox', checked: sp.flip });
    flip.addEventListener('change', () => sp.set({ flip: flip.checked }));
    const enabled = h('input', { type: 'checkbox', checked: this.app.state.section });
    enabled.addEventListener('change', () => this.app.toggle('section', enabled.checked));
    const node = h('div', { class: 'popover' },
      h('h4', null, 'Section plane'),
      h('label', { class: 'check' }, enabled, 'Cut the model'),
      h('div', { class: 'row' }, axisSeg),
      h('div', { class: 'row' }, range),
      h('label', { class: 'check', style: { marginTop: '6px' } }, flip, 'Keep the other side'));
    return { node, sync: () => (enabled.checked = this.app.state.section) };
  }

  #colourPopover() {
    const modes = [['unit', 'Units'], ['print', 'Print profile'], ['real', 'Printed plastic']];
    const seg = h('div', { class: 'seg' }, modes.map(([id, label]) => {
      const b = h('button', { type: 'button', class: this.app.state.colorMode === id ? 'on' : '', dataset: { id } }, label);
      b.addEventListener('click', () => this.app.setColorMode(id));
      return b;
    }));
    const node = h('div', { class: 'popover' }, h('h4', null, 'Colour by'), seg);
    return { node, sync: () => seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.id === this.app.state.colorMode)) };
  }
}
