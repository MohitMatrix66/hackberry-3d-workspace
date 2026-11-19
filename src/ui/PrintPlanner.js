import { h, svg } from './dom.js';
import { ICONS } from './icons.js';
import { MATERIALS, partGrams, planTotals } from '../lib/printEstimate.js';
import { grams, rupees, hours } from '../lib/format.js';
import { toCSV, download } from '../lib/csv.js';
import { load, save } from '../lib/storage.js';

/** Checklist of every STL to print, with filament, cost and time totals. */
export class PrintPlanner {
  constructor(app, host) {
    this.app = app;
    this.host = host;
    this.settings = load('print-settings', { material: 'PETG', price: MATERIALS.PETG.pricePerKg, optional: false });
    this.printed = load('printed', {});
    this.render();
  }

  rows() {
    const material = MATERIALS[this.settings.material];
    return this.app.model.data.parts
      .filter((p) => this.settings.optional || !p.optional)
      .map((p) => ({ part: p, qty: p.qty, grams: partGrams(p.stats, this.app.model.data.profiles[p.profile], material.density) }));
  }

  render() {
    const material = { ...MATERIALS[this.settings.material], pricePerKg: Number(this.settings.price) || 0 };
    const rows = this.rows();
    const totals = planTotals(rows, material);
    const done = rows.filter((r) => this.printed[r.part.id]).reduce((s, r) => s + r.qty, 0);

    const select = h('select', { 'aria-label': 'Material' }, Object.keys(MATERIALS).map((m) => h('option', { value: m, selected: m === this.settings.material }, m)));
    select.addEventListener('change', () => {
      this.settings.material = select.value;
      this.settings.price = MATERIALS[select.value].pricePerKg;
      this.#commit();
    });
    const price = h('input', { type: 'number', min: 0, step: 50, value: this.settings.price, 'aria-label': 'Price per kg' });
    price.addEventListener('change', () => {
      this.settings.price = Number(price.value);
      this.#commit();
    });
    const optional = h('input', { type: 'checkbox', checked: this.settings.optional });
    optional.addEventListener('change', () => {
      this.settings.optional = optional.checked;
      this.#commit();
    });

    const table = h('table', { class: 'plan-table' },
      h('thead', null, h('tr', null, h('th', null, ''), h('th', null, 'Part'), h('th', null, 'Qty'), h('th', { style: { textAlign: 'right' } }, 'Filament'))),
      h('tbody', null, rows.map((r) => {
        const box = h('input', { type: 'checkbox', checked: Boolean(this.printed[r.part.id]), 'aria-label': `Printed ${r.part.id}` });
        box.addEventListener('change', () => {
          this.printed[r.part.id] = box.checked;
          save('printed', this.printed);
          this.render();
        });
        const name = h('span', { style: { cursor: 'pointer' } }, r.part.name);
        name.addEventListener('click', () => this.app.select({ type: 'part', partId: r.part.id }));
        return h('tr', { class: this.printed[r.part.id] ? 'done' : '' },
          h('td', null, box),
          h('td', null, name, h('div', { class: 'mono faint' }, `${r.part.id} · ${this.app.model.data.profiles[r.part.profile].name}`)),
          h('td', { class: 'num' }, `×${r.qty}`),
          h('td', { class: 'num' }, grams(r.grams * r.qty)));
      })));

    const pa12 = this.settings.material.startsWith('PA12');
    this.host.replaceChildren(
      h('div', { class: 'planner-settings' },
        h('label', null, 'Material', select),
        h('label', null, 'Price (₹ per kg)', price),
        h('label', { class: 'check full' }, optional, 'Include optional parts (sensor holder, external battery)')),
      h('div', { class: 'totals' },
        h('div', { class: 'total' }, h('b', null, `${done}/${totals.pieces}`), h('span', null, 'pieces printed')),
        h('div', { class: 'total' }, h('b', null, grams(totals.grams)), h('span', null, `${this.settings.material.split(' ')[0]} filament`)),
        h('div', { class: 'total' }, h('b', null, pa12 ? 'Quote' : rupees(totals.cost)), h('span', null, pa12 ? 'from an SLS service' : `≈ ${hours(totals.hours)} printing`))),
      h('div', { class: 'panel-body scroll', style: { padding: '0 6px' } }, table),
      h('div', { class: 'plan-footer' },
        h('button', { class: 'btn small primary', type: 'button', onclick: () => this.#export(rows, material) }, svg(ICONS.download), 'Export CSV'),
        h('button', { class: 'btn small', type: 'button', onclick: () => this.#reset() }, 'Reset ticks')),
    );
  }

  #commit() {
    save('print-settings', this.settings);
    this.render();
  }

  #reset() {
    this.printed = {};
    save('printed', this.printed);
    this.render();
  }

  #export(rows, material) {
    const header = ['Part ID', 'Name', 'Unit', 'Quantity', 'Print profile', 'Layer', 'Walls', 'Infill', 'Orientation', `Filament each (g, ${this.settings.material})`, 'Filament total (g)', 'Size X×Y×Z (mm)', 'Printed'];
    const body = rows.map((r) => {
      const prof = this.app.model.data.profiles[r.part.profile];
      return [r.part.id, r.part.name, this.app.model.units.get(r.part.unit).name, r.qty, prof.name, prof.layer, prof.walls, prof.infill, prof.orientation,
        r.grams.toFixed(1), (r.grams * r.qty).toFixed(1), r.part.stats.size.join(' x '), this.printed[r.part.id] ? 'yes' : 'no'];
    });
    const t = planTotals(rows, material);
    body.push([], ['TOTAL', '', '', t.pieces, '', '', '', '', '', '', t.grams.toFixed(0), '', '']);
    download('bionic-hand-print-plan.csv', toCSV(header, body));
  }
}
