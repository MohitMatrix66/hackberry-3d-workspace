import * as THREE from 'three';
import { Viewer } from '../viewer/Viewer.js';
import { HandModel, COVER_PARTS } from '../model/HandModel.js';
import { SectionPlane } from '../features/SectionPlane.js';
import { MeasureTool } from '../features/MeasureTool.js';
import { ServoLabels } from '../features/ServoLabels.js';
import { InspectMode } from '../features/InspectMode.js';
import { AssemblyTree } from '../ui/AssemblyTree.js';
import { PartsLibrary } from '../ui/PartsLibrary.js';
import { PrintPlanner } from '../ui/PrintPlanner.js';
import { Inspector } from '../ui/Inspector.js';
import { Toolbar } from '../ui/Toolbar.js';
import { ViewBar, VIEWS } from '../ui/ViewBar.js';
import { Legend } from '../ui/Legend.js';
import { MechanismPanel } from '../ui/MechanismPanel.js';
import { StatusBar } from '../ui/StatusBar.js';
import { openModal } from '../ui/Modals.js';
import { toast } from '../ui/Toasts.js';
import { h, svg } from '../ui/dom.js';
import { ICONS } from '../ui/icons.js';
import { Emitter } from '../lib/Emitter.js';
import { download } from '../lib/csv.js';
import { load, save } from '../lib/storage.js';

/**
 * Wires the viewer, the hand model, the tools and the UI panels together.
 * UI modules talk to the app through its public methods and listen to `app.bus` events:
 *   'selection'  - the selection changed           'state'      - a tool or view setting changed
 *   'visibility' - parts were shown or hidden      'pose'       - the mechanism moved (payload: angles)
 */
export class App {
  constructor() {
    this.baseUrl = import.meta.env.BASE_URL;
    this.bus = new Emitter();
    this.selection = null;
    this.lastReadout = null;
    this.state = {
      explode: 0,
      xray: false,
      inside: false,
      section: false,
      measure: false,
      labels: false,
      grid: true,
      colorMode: 'unit',
      theme: load('theme', 'dark'),
      pose: { close: 0, thumb: 0, object: false, contactAngle: 30 },
    };
  }

  async start() {
    this.#applyTheme();
    this.viewer = new Viewer(document.getElementById('viewport'));
    this.viewer.setTheme(this.state.theme === 'dark');
    const bar = document.getElementById('progress-bar');
    const detail = document.getElementById('loading-detail');
    try {
      this.model = await HandModel.load(this.baseUrl, (fraction, id) => {
        bar.style.width = `${Math.round(fraction * 100)}%`;
        detail.textContent = `Loaded ${id}.stl`;
      });
    } catch (err) {
      detail.textContent = `Could not load the model: ${err.message}. Run the site with "npm run dev" (opening index.html directly does not work).`;
      throw err;
    }
    this.viewer.root.add(this.model.root);

    this.section = new SectionPlane(this.viewer, () => this.model.boundingBox(), (planes) => {
      this.model.setClippingPlanes(planes);
      this.viewer.clipPlanes = planes;
    });
    this.measure = new MeasureTool(this.viewer);
    this.labels = new ServoLabels(this.model);
    this.inspect = new InspectMode(this.viewer, this.model);

    new AssemblyTree(this, document.getElementById('assembly-panel'));
    new PartsLibrary(this, document.getElementById('parts-panel'));
    new PrintPlanner(this, document.getElementById('print-panel'));
    new Inspector(this, document.getElementById('inspector'));
    new Toolbar(this, document.getElementById('toolbar'), document.getElementById('viewport'));
    new ViewBar(this, document.getElementById('viewbar'));
    new Legend(this, document.getElementById('legend'));
    this.mechanism = new MechanismPanel(this, document.getElementById('mechanism'));
    new StatusBar(this, document.getElementById('statusbar'));

    this.#bindTabs();
    this.#bindTopbar();
    this.#bindPointer();
    this.#bindKeys();
    this.setPose({});
    if (!this.#applyUrlParams()) this.setView(0, true);
    document.getElementById('loading').classList.add('done');
    window.__app = this; // handy for debugging in the browser console
  }

  /**
   * Shareable links: open the workspace in a given state, e.g.
   *   ?view=3&xray=1&labels=1        ?explode=1&color=print        ?close=0.8&object=30
   *   ?tab=parts&part=R-O-01         ?inspect=R-H-08                ?section=x&cut=0.4
   */
  #applyUrlParams() {
    const q = new URLSearchParams(window.location.search);
    if (![...q.keys()].length) return false;
    const num = (k) => (q.has(k) && q.get(k) !== '' && !Number.isNaN(Number(q.get(k))) ? Number(q.get(k)) : null);
    if (['light', 'dark'].includes(q.get('theme'))) {
      this.state.theme = q.get('theme');
      this.#applyTheme();
      this.viewer.setTheme(this.state.theme === 'dark');
    }
    if (['unit', 'print', 'real'].includes(q.get('color'))) this.setColorMode(q.get('color'));
    for (const flag of ['xray', 'inside', 'labels']) if (q.get(flag) === '1') this.toggle(flag, true);
    if (q.get('grid') === '0') this.toggle('grid', false);
    if (num('explode') !== null) this.setExplode(Math.min(1, Math.max(0, num('explode'))), false);
    const pose = {};
    if (num('close') !== null) pose.close = num('close');
    if (num('thumb') !== null) pose.thumb = num('thumb');
    if (num('object') !== null) Object.assign(pose, { object: true, contactAngle: num('object') });
    if (Object.keys(pose).length) this.setPose(pose);
    if (q.has('tab')) document.querySelector(`.tab[data-tab="${q.get('tab')}"]`)?.click();
    if (q.has('part') && this.model.parts.has(q.get('part'))) this.select({ type: 'part', partId: q.get('part') });
    if (q.has('servo')) this.select({ type: 'servo', servoId: q.get('servo') });
    if (['x', 'y', 'z'].includes(q.get('section'))) {
      this.toggle('section', true);
      this.section.set({ axis: q.get('section'), position: num('cut') ?? 0.5 });
    }
    if (q.has('inspect') && this.model.parts.has(q.get('inspect'))) this.inspectPart(q.get('inspect'));
    else this.setView(Math.min(5, Math.max(0, num('view') ?? 0)), true);
    return true;
  }

  // ------------------------------------------------------------------ selection
  select(sel) {
    this.selection = sel;
    this.model.highlight(this.#idsOf(sel));
    this.bus.emit('selection', sel);
  }

  #idsOf(sel) {
    if (!sel) return [];
    if (sel.type === 'part') return this.model.idsOfPart(sel.partId);
    if (sel.type === 'unit') return this.model.idsOfUnit(sel.unitId);
    if (sel.type === 'servo') return [this.model.servos.find((s) => s.id === sel.servoId).item];
    return sel.itemId ? [sel.itemId] : [];
  }

  #selectionFromItem(item) {
    if (item.kind === 'part') return { type: 'part', partId: item.partId, itemId: item.id };
    const servo = this.model.servos.find((s) => s.item === item.id);
    if (servo) return { type: 'servo', servoId: servo.id };
    return { type: item.kind === 'shaft' ? 'shaft' : 'hardware', itemId: item.id };
  }

  // ------------------------------------------------------------------ camera
  setView(index, instant = false) {
    const box = this.inspect?.active ? new THREE.Box3().setFromObject(this.inspect.group) : this.model.boundingBox();
    this.viewer.fitBox(box, VIEWS[index][1], { duration: instant ? 0 : 650 });
  }

  focusItems(ids, reveal = false) {
    if (this.inspect.active) this.exitInspect();
    if (reveal && !this.state.xray) this.toggle('xray', true);
    ids.forEach((id) => (this.model.items.get(id).mesh.visible = true));
    this.bus.emit('visibility');
    this.viewer.fitBox(this.model.boundingBox(ids), null, { padding: 1.6 });
  }

  focusSelectionOrAll() {
    const ids = this.#idsOf(this.selection);
    if (this.inspect.active) this.setView(0);
    else if (ids.length) this.viewer.fitBox(this.model.boundingBox(ids), null, { padding: 1.6 });
    else this.viewer.fitBox(this.model.boundingBox());
  }

  // ------------------------------------------------------------------ visibility
  toggleVisibility({ unit, part }) {
    const items = this.model.itemsWhere((it) => (!unit || it.unit === unit) && (!part || it.partId === part));
    const show = !items.some((it) => it.mesh.visible);
    items.forEach((it) => (it.mesh.visible = show));
    this.bus.emit('visibility');
  }

  isolate(ids) {
    this.model.isolate(ids);
    this.bus.emit('visibility');
    this.viewer.fitBox(this.model.boundingBox(ids), null, { padding: 1.5 });
  }

  showAll() {
    this.model.showAll();
    this.state.inside = false;
    this.bus.emit('visibility');
    this.bus.emit('state');
  }

  // ------------------------------------------------------------------ tools & settings
  toggle(name, value = !this.state[name]) {
    this.state[name] = value;
    if (name === 'xray') this.model.setXray(value);
    if (name === 'inside') {
      this.model.setVisible((it) => COVER_PARTS.includes(it.partId), !value);
      this.bus.emit('visibility');
    }
    if (name === 'section') this.section.setEnabled(value);
    if (name === 'measure') {
      this.measure.setActive(value);
      if (value) toast('Measure: click two points on the model.');
    }
    if (name === 'labels') this.labels.setVisible(value);
    if (name === 'grid') this.viewer.grid.visible = value;
    this.bus.emit('state');
  }

  setExplode(target, animate = true) {
    this.explodeAnim?.();
    if (!animate) {
      this.#applyExplode(target);
      return;
    }
    const from = this.state.explode;
    const start = performance.now();
    this.explodeAnim = this.viewer.onFrame((now) => {
      const t = Math.min(1, (now - start) / 700);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      this.#applyExplode(from + (target - from) * e);
      if (t >= 1) this.explodeAnim();
    });
  }

  #applyExplode(t) {
    this.state.explode = t;
    this.model.setExplode(t);
    if (this.state.section) this.section.update();
    this.bus.emit('state');
  }

  setColorMode(mode) {
    this.state.colorMode = mode;
    this.model.setColorMode(mode);
    this.bus.emit('state');
  }

  setPose(change, silent = false) {
    const pose = Object.assign(this.state.pose, change);
    this.lastReadout = this.model.setPose({ close: pose.close, thumb: pose.thumb, contact: pose.object ? pose.contactAngle : null });
    this.bus.emit('pose', this.lastReadout);
    if (!silent) this.mechanism?.sync();
  }

  // ------------------------------------------------------------------ part inspection
  async inspectPart(partId) {
    const part = this.model.parts.get(partId);
    if (this.state.section) this.toggle('section', false);
    this.select({ type: 'part', partId });
    await this.inspect.open(partId, this.model.units.get(part.unit).color);
    const banner = document.getElementById('inspect-banner');
    const wire = h('input', { type: 'checkbox' });
    wire.addEventListener('change', () => this.inspect.setWireframe(wire.checked));
    const href = part.fileIsDecimated ? part.sourceUrl : this.baseUrl + part.file;
    banner.replaceChildren(
      h('span', null, 'Inspecting ', h('b', null, part.id), ` · ${part.name}`),
      h('label', { class: 'check', style: { fontSize: '12px' } }, wire, 'Wireframe'),
      h('a', { class: 'btn small', href, download: `${part.id}.stl`, target: part.fileIsDecimated ? '_blank' : null }, svg(ICONS.download), 'STL'),
      h('button', { class: 'btn small primary', type: 'button', onclick: () => this.exitInspect() }, 'Back to assembly'));
    banner.hidden = false;
    this.#setOverlaysHidden(true);
  }

  exitInspect() {
    if (!this.inspect.active) return;
    this.inspect.close();
    document.getElementById('inspect-banner').hidden = true;
    this.#setOverlaysHidden(false);
    this.setView(0);
  }

  /** The mechanism panel and legend are about the assembly; hide them while inspecting one part. */
  #setOverlaysHidden(hidden) {
    document.getElementById('mechanism').hidden = hidden;
    document.getElementById('legend').hidden = hidden;
  }

  showPartInAssembly(partId) {
    if (this.inspect.active) this.exitInspect();
    this.select({ type: 'part', partId });
    const ids = this.model.idsOfPart(partId);
    ids.forEach((id) => (this.model.items.get(id).mesh.visible = true)); // reveal it even if it was hidden
    this.bus.emit('visibility');
    this.viewer.fitBox(this.model.boundingBox(ids), null, { padding: 2.2 });
  }

  screenshot() {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    download(`bionic-hand-${stamp}.png`, this.viewer.screenshot());
    toast('Screenshot saved.');
  }

  // ------------------------------------------------------------------ input
  #bindPointer() {
    const canvas = this.viewer.renderer.domElement;
    const tip = h('div', { class: 'label3d', style: { position: 'absolute', display: 'none', zIndex: 8, transform: 'translate(12px, 12px)' } });
    document.getElementById('viewport').append(tip);
    let down = null;
    let lastHover = 0;
    canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    canvas.addEventListener('pointerup', (e) => {
      if (!down || e.button !== 0 || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      this.#click(e);
    });
    canvas.addEventListener('dblclick', (e) => {
      const hit = this.viewer.pick(e, this.inspect.active ? [] : this.model.meshes);
      if (hit) this.viewer.fitBox(new THREE.Box3().setFromObject(hit.object), null, { padding: 2.2 });
      else this.focusSelectionOrAll();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.buttons || this.inspect.active || performance.now() - lastHover < 110) return;
      lastHover = performance.now();
      const hit = this.viewer.pick(e, this.model.meshes);
      const item = hit && this.model.items.get(hit.object.userData.itemId);
      if (!item) {
        tip.style.display = 'none';
        canvas.style.cursor = this.state.measure ? 'crosshair' : '';
        return;
      }
      const rect = canvas.getBoundingClientRect();
      tip.textContent = item.kind === 'part' ? `${item.partId} · ${item.name}` : item.name;
      tip.style.left = `${e.clientX - rect.left}px`;
      tip.style.top = `${e.clientY - rect.top}px`;
      tip.style.display = '';
      canvas.style.cursor = this.state.measure ? 'crosshair' : 'pointer';
    });
    canvas.addEventListener('pointerleave', () => (tip.style.display = 'none'));
  }

  #click(e) {
    const targets = this.inspect.active ? (this.inspect.mesh ? [this.inspect.mesh] : []) : this.model.meshes;
    const hit = this.viewer.pick(e, targets);
    if (this.state.measure) {
      if (!hit) return;
      const d = this.measure.addPoint(hit.point);
      if (d !== null) toast(`Distance: ${d.toFixed(1)} mm`);
      return;
    }
    if (this.inspect.active) return;
    const item = hit && this.model.items.get(hit.object.userData.itemId);
    this.select(item ? this.#selectionFromItem(item) : null);
  }

  #bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.target.closest('input, select, textarea, dialog[open]') || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const ids = this.#idsOf(this.selection);
      const actions = {
        f: () => this.focusSelectionOrAll(),
        h: () => ids.length && (ids.forEach((id) => (this.model.items.get(id).mesh.visible = false)), this.bus.emit('visibility')),
        i: () => ids.length && this.isolate(ids),
        a: () => this.showAll(),
        e: () => this.setExplode(this.state.explode > 0.5 ? 0 : 1),
        x: () => this.toggle('xray'),
        s: () => this.toggle('section'),
        m: () => this.toggle('measure'),
        l: () => this.toggle('labels'),
        c: () => this.setColorMode({ unit: 'print', print: 'real', real: 'unit' }[this.state.colorMode]),
        p: () => this.screenshot(),
        ' ': () => this.mechanism.togglePlay(),
        '?': () => openModal('help'),
        escape: () => {
          if (this.state.measure) this.toggle('measure', false);
          else if (this.inspect.active) this.exitInspect();
          else this.select(null);
        },
      };
      if (/^[1-6]$/.test(k)) actions[k] = () => this.setView(Number(k) - 1);
      if (actions[k]) {
        e.preventDefault();
        actions[k]();
      }
    });
  }

  #bindTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach((tab) =>
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.toggle('active', t === tab));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.dataset.panel === tab.dataset.tab));
      }));
  }

  #bindTopbar() {
    document.querySelector('[data-action="about"]').addEventListener('click', () => openModal('about', this.model));
    document.querySelector('[data-action="help"]').addEventListener('click', () => openModal('help'));
    const themeBtn = document.querySelector('[data-action="theme"]');
    const paint = () => (themeBtn.innerHTML = this.state.theme === 'dark' ? ICONS.sun : ICONS.moon);
    paint();
    themeBtn.addEventListener('click', () => {
      this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
      save('theme', this.state.theme);
      this.#applyTheme();
      this.viewer.setTheme(this.state.theme === 'dark');
      this.viewer.grid.visible = this.state.grid;
      paint();
    });
  }

  #applyTheme() {
    document.documentElement.dataset.theme = this.state.theme;
  }
}
