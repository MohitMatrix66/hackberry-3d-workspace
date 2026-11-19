import { h, svg } from './dom.js';
import { ICONS } from './icons.js';
import { size3, grams, plural } from '../lib/format.js';
import { partGrams, MATERIALS } from '../lib/printEstimate.js';

/** Right-hand panel: details and actions for whatever is selected. */
export class Inspector {
  constructor(app, host) {
    this.app = app;
    this.host = host;
    app.bus.on('selection', () => this.render());
    this.render();
  }

  render() {
    const sel = this.app.selection;
    const view = !sel ? this.#empty()
      : sel.type === 'part' ? this.#part(sel.partId)
        : sel.type === 'unit' ? this.#unit(sel.unitId)
          : sel.type === 'servo' ? this.#servo(sel.servoId)
            : sel.type === 'hardware' ? this.#hardware(sel.itemId)
              : sel.type === 'shaft' ? this.#shaft(sel.itemId) : this.#empty();
    this.host.replaceChildren(view);
    this.host.scrollTop = 0;
  }

  #empty() {
    return h('div', { class: 'inspector-empty' },
      h('h3', null, 'Explore the hand'),
      h('p', null, 'Click any part in the 3D view, or pick one from the Assembly or Parts tab.'),
      h('ol', null,
        h('li', null, h('b', null, 'Explode'), ' the assembly to see how the units fit together.'),
        h('li', null, 'Turn on ', h('b', null, 'X-ray'), ' to find the three servos, the joint shafts and the screws.'),
        h('li', null, 'Use the ', h('b', null, 'finger mechanism'), ' panel to close the hand and see the linkages move.'),
        h('li', null, 'Open the ', h('b', null, 'Parts'), ' tab to inspect and download any STL file.'),
        h('li', null, 'Plan filament and cost in the ', h('b', null, 'Print plan'), ' tab.')),
      h('p', { class: 'note' }, 'Every printed part here is the original HACKberry STL, placed where the official STEP assembly puts it.'));
  }

  #kicker(unitId, extra) {
    const unit = this.app.model.units.get(unitId);
    return h('div', { class: 'insp-kicker' }, h('span', { class: 'swatch', style: { background: unit.color } }), unit.name, extra && h('span', { class: 'pill' }, extra));
  }

  #part(partId) {
    const { model, baseUrl } = this.app;
    const p = model.parts.get(partId);
    const profile = model.data.profiles[p.profile];
    const inAssembly = model.idsOfPart(partId).length > 0;
    const g = partGrams(p.stats, profile, MATERIALS.PETG.density);
    const download = p.fileIsDecimated
      ? h('a', { class: 'btn small', href: p.sourceUrl, target: '_blank', rel: 'noopener' }, svg(ICONS.download), 'Download STL (original)')
      : h('a', { class: 'btn small', href: baseUrl + p.file, download: `${p.id}.stl` }, svg(ICONS.download), 'Download STL');
    return h('div', { class: 'inspector' },
      this.#kicker(p.unit, p.id),
      h('h2', { class: 'insp-title' }, p.name),
      h('img', { class: 'insp-thumb', src: baseUrl + p.thumbnail, alt: p.name }),
      h('div', { class: 'insp-actions' },
        h('button', { class: 'btn small primary', type: 'button', onclick: () => this.app.inspectPart(partId) }, svg(ICONS.focus), 'Inspect in 3D'),
        inAssembly && h('button', { class: 'btn small', type: 'button', onclick: () => this.app.showPartInAssembly(partId) }, svg(ICONS.hand), 'Show in assembly'),
        download,
        h('a', { class: 'btn small', href: p.sourceUrl.replace('/raw/', '/blob/'), target: '_blank', rel: 'noopener', title: 'Open on GitHub' }, svg(ICONS.external), 'Source')),
      h('dl', { class: 'kv' },
        h('dt', null, 'CAD name'), h('dd', { class: 'mono' }, p.cadName),
        h('dt', null, 'Quantity'), h('dd', null, `${p.qty} per hand`),
        h('dt', null, 'Size (bounding box)'), h('dd', null, size3(p.stats.size)),
        h('dt', null, 'Volume'), h('dd', null, `${p.stats.volume_cm3.toFixed(2)} cm³`),
        h('dt', null, 'Surface area'), h('dd', null, `${p.stats.area_cm2.toFixed(1)} cm²`),
        h('dt', null, 'Mesh'), h('dd', null, `${p.stats.triangles.toLocaleString()} triangles`),
        h('dt', null, 'Filament (PETG)'), h('dd', null, `≈ ${grams(g)} each`)),
      p.note && h('p', { class: 'note' }, p.note),
      p.fileIsDecimated && h('p', { class: 'note' }, 'The original print file is 79 MB, so the viewer uses a lighter copy. "Download STL" fetches the original from the HACKberry repository.'),
      !inAssembly && h('p', { class: 'note' }, 'Optional part: it is not used in the assembled hand shown here.'),
      h('div', { class: 'insp-section' },
        h('h4', null, `Print profile: ${profile.name}`),
        h('dl', { class: 'kv' },
          h('dt', null, 'Material'), h('dd', null, profile.material),
          h('dt', null, 'Layer height'), h('dd', null, profile.layer),
          h('dt', null, 'Walls'), h('dd', null, profile.walls),
          h('dt', null, 'Infill'), h('dd', null, profile.infill),
          h('dt', null, 'Speed'), h('dd', null, profile.speed),
          h('dt', null, 'Supports'), h('dd', null, profile.supports),
          h('dt', null, 'Orientation'), h('dd', null, profile.orientation))));
  }

  #unit(unitId) {
    const { model } = this.app;
    const unit = model.units.get(unitId);
    const items = model.itemsWhere((it) => it.unit === unitId);
    const partIds = [...new Set(items.filter((it) => it.kind === 'part').map((it) => it.partId))].sort();
    const ids = items.map((it) => it.id);
    const servos = model.servos.filter((s) => model.items.get(s.item)?.unit === unitId);
    return h('div', { class: 'inspector' },
      h('div', { class: 'insp-kicker' }, h('span', { class: 'swatch', style: { background: unit.color } }), unit.group),
      h('h2', { class: 'insp-title' }, unit.name),
      h('p', { class: 'muted' }, unit.description),
      h('div', { class: 'insp-actions' },
        h('button', { class: 'btn small primary', type: 'button', onclick: () => this.app.focusItems(ids) }, svg(ICONS.focus), 'Focus'),
        h('button', { class: 'btn small', type: 'button', onclick: () => this.app.isolate(ids) }, svg(ICONS.isolate), 'Isolate'),
        h('button', { class: 'btn small', type: 'button', onclick: () => this.app.toggleVisibility({ unit: unitId }) }, svg(ICONS.eyeOff), 'Hide / show')),
      h('dl', { class: 'kv' },
        h('dt', null, 'Printed parts'), h('dd', null, plural(partIds.length, 'STL file')),
        h('dt', null, 'Bought parts'), h('dd', null, `${items.filter((it) => it.kind === 'hardware').length}`),
        h('dt', null, 'Steel shafts'), h('dd', null, `${items.filter((it) => it.kind === 'shaft').length}`)),
      servos.length > 0 && h('div', { class: 'insp-section' }, h('h4', null, 'Servos in this unit'),
        servos.map((s) => h('div', { class: 'tree-row', onclick: () => this.app.select({ type: 'servo', servoId: s.id }) }, svg(ICONS.servo), h('span', { class: 'name' }, s.title)))),
      h('div', { class: 'insp-section' }, h('h4', null, 'Parts'),
        partIds.map((pid) => h('div', { class: 'tree-row', onclick: () => this.app.select({ type: 'part', partId: pid }) },
          h('span', { class: 'name' }, model.parts.get(pid).name), h('span', { class: 'count mono' }, pid)))));
  }

  #servo(servoId) {
    const s = this.app.model.servos.find((x) => x.id === servoId);
    return h('div', { class: 'inspector' },
      this.#kicker(this.app.model.items.get(s.item).unit, 'Servo'),
      h('h2', { class: 'insp-title' }, s.title),
      h('div', { class: 'insp-actions' },
        h('button', { class: 'btn small primary', type: 'button', onclick: () => this.app.focusItems([s.item], true) }, svg(ICONS.focus), 'Show inside the hand')),
      h('dl', { class: 'kv' },
        h('dt', null, 'Drives'), h('dd', null, s.drives),
        h('dt', null, 'In the BOM'), h('dd', null, s.bom),
        h('dt', null, 'In the CAD model'), h('dd', null, s.cad),
        h('dt', null, 'Torque'), h('dd', null, s.torque),
        h('dt', null, 'Size, mass'), h('dd', null, s.size),
        h('dt', null, 'Firmware'), h('dd', { class: 'mono' }, s.firmware)),
      h('p', { class: 'note' }, 'The servo is shown as a simplified model with the real size and position from the HACKberry STEP assembly. The CAD file uses a servo model of the same size class as the one in the parts list.'));
  }

  #hardware(itemId) {
    const { model } = this.app;
    const it = model.items.get(itemId);
    const servo = model.servos.find((s) => s.item === itemId);
    if (servo) return this.#servo(servo.id);
    const same = model.itemsWhere((x) => x.type === it.type).length;
    return h('div', { class: 'inspector' },
      this.#kicker(it.unit, 'Bought part'),
      h('h2', { class: 'insp-title' }, it.name),
      h('div', { class: 'insp-actions' },
        h('button', { class: 'btn small primary', type: 'button', onclick: () => this.app.focusItems([itemId], true) }, svg(ICONS.focus), 'Focus'),
        h('button', { class: 'btn small', type: 'button', onclick: () => this.app.focusItems(model.itemsWhere((x) => x.type === it.type).map((x) => x.id), true) }, `Show all ${same}`)),
      h('dl', { class: 'kv' },
        h('dt', null, 'CAD name'), h('dd', { class: 'mono' }, it.type),
        h('dt', null, 'In this hand'), h('dd', null, `${same} piece${same === 1 ? '' : 's'}`)),
      h('p', { class: 'note' }, 'Bought parts are drawn as simplified shapes with their real size and position.'));
  }

  #shaft(itemId) {
    const { model } = this.app;
    const it = model.items.get(itemId);
    const total = model.itemsWhere((x) => x.kind === 'shaft').length;
    return h('div', { class: 'inspector' },
      this.#kicker(it.unit, 'Joint shaft'),
      h('h2', { class: 'insp-title' }, it.name),
      h('div', { class: 'insp-actions' },
        h('button', { class: 'btn small primary', type: 'button', onclick: () => this.app.focusItems(model.itemsWhere((x) => x.kind === 'shaft').map((x) => x.id), true) }, svg(ICONS.focus), `Show all ${total} shafts`)),
      h('dl', { class: 'kv' },
        h('dt', null, 'Diameter'), h('dd', null, '2 mm steel'),
        h('dt', null, 'Length'), h('dd', null, `${it.length} mm`),
        h('dt', null, 'Role'), h('dd', null, 'Pin of a finger joint or linkage')),
      h('p', { class: 'note' }, 'Every finger joint turns on a 2 mm steel shaft. The parts list has 10 shafts of 10 mm and 7 of 15 mm.'));
  }
}
