import { h } from './dom.js';

/** Bottom bar: model statistics, current selection and a usage hint. */
export class StatusBar {
  constructor(app, host) {
    this.app = app;
    this.host = host;
    const d = app.model.data;
    // triangles actually drawn (the back cover is shown as a lighter copy)
    const tris = d.instances.reduce((s, i) => s + app.model.geometries.get(i.part).attributes.position.count / 3, 0);
    this.sel = h('span', { class: 'grow' });
    host.replaceChildren(
      h('span', null, `${d.instances.length} printed parts`),
      h('span', null, `${d.hardware.length} bought parts`),
      h('span', null, `${d.shafts.length} shafts`),
      h('span', null, `${(tris / 1e6).toFixed(2)} M triangles`),
      this.sel,
      h('span', null, 'Drag: rotate · Right-drag: pan · Scroll: zoom · Double-click: focus · ? shortcuts'));
    app.bus.on('selection', () => this.render());
    this.render();
  }

  render() {
    const sel = this.app.selection;
    const { model } = this.app;
    let text = '';
    if (sel?.type === 'part') text = `Selected: ${sel.partId} · ${model.parts.get(sel.partId).name}`;
    else if (sel?.type === 'unit') text = `Selected: ${model.units.get(sel.unitId).name}`;
    else if (sel?.type === 'servo') text = `Selected: ${model.servos.find((s) => s.id === sel.servoId).title}`;
    else if (sel?.itemId) text = `Selected: ${model.items.get(sel.itemId).name}`;
    this.sel.textContent = text;
  }
}
