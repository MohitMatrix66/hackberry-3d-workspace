import { h } from './dom.js';
import { size3 } from '../lib/format.js';

const FILTERS = [
  ['all', 'All', () => true],
  ['fingers', 'Fingers', (p) => p.unit === 'index' || p.unit === 'middle'],
  ['thumb', 'Thumb', (p) => p.unit === 'thumb'],
  ['palm', 'Palm', (p) => p.unit === 'palm'],
  ['wrist', 'Wrist', (p) => p.unit === 'wrist'],
  ['socket', 'Forearm', (p) => p.unit === 'socket'],
  ['optional', 'Optional', (p) => p.optional],
];

/** Every printable STL as a card grid with search and filters. */
export class PartsLibrary {
  constructor(app, host) {
    this.app = app;
    this.host = host;
    this.filter = 'all';
    this.query = '';
    this.cards = new Map();
    this.render();
    app.bus.on('selection', () => this.#markSelection());
  }

  render() {
    const search = h('input', { type: 'search', placeholder: 'Search name or ID (e.g. R-O-01)', 'aria-label': 'Search parts' });
    search.addEventListener('input', () => {
      this.query = search.value.trim().toLowerCase();
      this.#apply();
    });
    const chips = h('div', { class: 'chips' }, FILTERS.map(([id, label]) => {
      const chip = h('button', { class: `chip${id === this.filter ? ' on' : ''}`, type: 'button', dataset: { id } }, label);
      chip.addEventListener('click', () => {
        this.filter = id;
        chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.id === id));
        this.#apply();
      });
      return chip;
    }));
    this.count = h('span', { class: 'faint' });
    const grid = h('div', { class: 'cards' });
    for (const part of this.app.model.data.parts) {
      const unit = this.app.model.units.get(part.unit);
      const card = h('button', { class: 'card', type: 'button', title: `${part.id} · ${part.cadName}\nDouble-click to inspect in 3D` },
        h('img', { src: this.app.baseUrl + part.thumbnail, alt: part.name, loading: 'lazy' }),
        h('span', { class: 'title' }, part.name),
        h('span', { class: 'meta' }, h('span', { class: 'mono' }, part.id), h('span', null, `×${part.qty}`)),
        h('span', { class: 'meta' }, h('span', null, size3(part.stats.size)), h('span', { class: 'swatch', style: { background: unit.color } })));
      card.addEventListener('click', () => this.app.select({ type: 'part', partId: part.id }));
      card.addEventListener('dblclick', () => this.app.inspectPart(part.id));
      this.cards.set(part.id, { card, part });
      grid.append(card);
    }
    this.host.replaceChildren(
      h('div', { class: 'panel-tools' }, search),
      chips,
      h('div', { style: { padding: '6px 12px 0', fontSize: '12px' } }, this.count),
      h('div', { class: 'panel-body scroll', style: { padding: 0 } }, grid),
    );
    this.#apply();
  }

  #apply() {
    const test = FILTERS.find(([id]) => id === this.filter)[2];
    let n = 0;
    for (const { card, part } of this.cards.values()) {
      const text = `${part.id} ${part.name} ${part.cadName}`.toLowerCase();
      const show = test(part) && (!this.query || text.includes(this.query));
      card.hidden = !show;
      n += show ? 1 : 0;
    }
    this.count.textContent = `${n} STL file${n === 1 ? '' : 's'} · double-click a card to inspect it in 3D`;
  }

  #markSelection() {
    const sel = this.app.selection;
    for (const [id, { card }] of this.cards) card.classList.toggle('selected', sel?.type === 'part' && sel.partId === id);
  }
}
