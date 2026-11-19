import { h, svg } from './dom.js';
import { ICONS } from './icons.js';

/** Units -> parts tree with visibility toggles. Clicking a row selects it in the 3D view. */
export class AssemblyTree {
  constructor(app, host) {
    this.app = app;
    this.host = host;
    this.rows = new Map(); // key -> row element
    this.render();
    app.bus.on('selection', () => this.#markSelection());
    app.bus.on('visibility', () => this.#syncEyes());
  }

  render() {
    const { model } = this.app;
    const tools = h('div', { class: 'panel-tools' },
      h('button', { class: 'btn small', type: 'button', onclick: () => this.app.showAll() }, svg(ICONS.eye), 'Show all'),
      h('button', { class: 'btn small', type: 'button', onclick: () => this.#expandAll(false) }, 'Collapse'),
      h('button', { class: 'btn small', type: 'button', onclick: () => this.#expandAll(true) }, 'Expand'));
    const body = h('div', { class: 'panel-body scroll' });
    let group = null;
    for (const unit of model.data.units) {
      if (unit.id === 'accessory') continue;
      if (unit.group !== group) {
        group = unit.group;
        body.append(h('div', { class: 'section-title' }, group));
      }
      body.append(this.#unitNode(unit));
    }
    body.append(h('div', { class: 'section-title' }, 'Servos'));
    for (const servo of model.servos) {
      const row = h('div', { class: 'tree-row', onclick: () => this.app.select({ type: 'servo', servoId: servo.id }) },
        h('span', { class: 'caret' }), svg(ICONS.servo), h('span', { class: 'name' }, servo.title));
      this.rows.set(`servo:${servo.id}`, row);
      body.append(row);
    }
    this.host.replaceChildren(tools, body);
    this.#syncEyes();
  }

  #unitNode(unit) {
    const { model } = this.app;
    const items = model.itemsWhere((it) => it.unit === unit.id);
    const partIds = [...new Set(items.filter((it) => it.kind === 'part').map((it) => it.partId))].sort();
    const bought = items.filter((it) => it.kind === 'hardware');
    const shafts = items.filter((it) => it.kind === 'shaft');
    const node = h('div', { class: 'tree-unit' });
    const eye = this.#eye(() => this.app.toggleVisibility({ unit: unit.id }));
    const caret = h('span', { class: 'caret', html: ICONS.caret });
    caret.addEventListener('click', (e) => {
      e.stopPropagation();
      node.classList.toggle('open');
    });
    const row = h('div', { class: 'tree-row', onclick: () => this.app.select({ type: 'unit', unitId: unit.id }) },
      caret, h('span', { class: 'swatch', style: { background: unit.color } }), h('span', { class: 'name' }, unit.name),
      h('span', { class: 'count', title: partIds.length ? 'printed STL files' : 'bought parts' }, partIds.length || `${bought.length} bought`), eye);
    eye.dataset.key = `unit:${unit.id}`;
    this.rows.set(`unit:${unit.id}`, row);
    const children = h('div', { class: 'tree-children' });
    for (const pid of partIds) {
      const part = model.parts.get(pid);
      const peye = this.#eye(() => this.app.toggleVisibility({ part: pid, unit: unit.id }));
      peye.dataset.key = `part:${unit.id}:${pid}`;
      const prow = h('div', { class: 'tree-row', title: `${pid} · ${part.cadName}`, onclick: () => this.app.select({ type: 'part', partId: pid }) },
        h('span', { class: 'name' }, part.name), h('span', { class: 'count mono' }, pid), peye);
      this.rows.set(`part:${unit.id}:${pid}`, prow);
      children.append(prow);
    }
    if (bought.length) {
      children.append(h('div', { class: 'tree-row', onclick: () => this.app.focusItems(bought.map((b) => b.id), true) },
        h('span', { class: 'name muted' }, `Bought parts (${bought.length})`), h('span', { class: 'count' }, 'screws, springs…')));
    }
    if (shafts.length) {
      children.append(h('div', { class: 'tree-row', onclick: () => this.app.select({ type: 'shaft', itemId: shafts[0].id }) },
        h('span', { class: 'name muted' }, `Steel joint shafts (${shafts.length})`)));
    }
    node.append(row, children);
    return node;
  }

  #eye(onToggle) {
    const btn = h('button', { class: 'eye', type: 'button', title: 'Show / hide', 'aria-label': 'Show or hide' });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onToggle();
    });
    return btn;
  }

  #syncEyes() {
    const { model } = this.app;
    for (const btn of this.host.querySelectorAll('.eye')) {
      const [kind, a, b] = btn.dataset.key.split(':');
      const items = kind === 'unit' ? model.itemsWhere((it) => it.unit === a) : model.itemsWhere((it) => it.unit === a && it.partId === b);
      const visible = items.some((it) => it.mesh.visible);
      btn.classList.toggle('off', !visible);
      btn.innerHTML = visible ? ICONS.eye : ICONS.eyeOff;
    }
  }

  #markSelection() {
    const sel = this.app.selection;
    for (const [key, row] of this.rows) {
      const on = sel && ((sel.type === 'unit' && key === `unit:${sel.unitId}`) ||
        (sel.type === 'part' && key.startsWith('part:') && key.endsWith(`:${sel.partId}`)) ||
        (sel.type === 'servo' && key === `servo:${sel.servoId}`));
      row.classList.toggle('selected', Boolean(on));
    }
  }

  #expandAll(open) {
    this.host.querySelectorAll('.tree-unit').forEach((n) => n.classList.toggle('open', open));
  }
}
