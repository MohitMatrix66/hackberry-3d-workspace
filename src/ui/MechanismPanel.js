import { h, svg } from './dom.js';
import { ICONS } from './icons.js';

/**
 * Finger-mechanism controls: close the fingers, close the thumb, and simulate an object in the hand.
 * The heavy lifting (four-bar solving) is in HandModel.setPose / lib/kinematics.js.
 */
export class MechanismPanel {
  constructor(app, host) {
    this.app = app;
    this.host = host;
    this.playing = false;
    this.render();
    app.bus.on('pose', (readout) => this.#showReadout(readout));
  }

  render() {
    const pose = this.app.state.pose;
    const slider = (value, label, onInput) => {
      const input = h('input', { type: 'range', min: 0, max: 100, value: Math.round(value * 100), 'aria-label': label });
      input.addEventListener('input', () => onInput(input.value / 100));
      return input;
    };
    this.close = slider(pose.close, 'Close fingers', (v) => this.app.setPose({ close: v }));
    this.thumb = slider(pose.thumb, 'Close thumb', (v) => this.app.setPose({ thumb: v }));
    this.contact = h('input', { type: 'range', min: 10, max: 60, value: pose.contactAngle, 'aria-label': 'Contact angle', disabled: !pose.object });
    this.contact.addEventListener('input', () => this.app.setPose({ contactAngle: Number(this.contact.value) }));
    const object = h('input', { type: 'checkbox', checked: pose.object });
    this.object = object;
    object.addEventListener('change', () => {
      this.contact.disabled = !object.checked;
      this.app.setPose({ object: object.checked });
    });
    this.play = h('button', { class: 'btn small', type: 'button', title: 'Play open/close (Space)' }, svg(ICONS.play), 'Play');
    this.play.addEventListener('click', () => this.togglePlay());
    this.out = { close: h('output'), thumb: h('output'), contact: h('output') };
    this.readout = h('div', { class: 'mechanism-note' });
    this.host.replaceChildren(
      h('div', { class: 'mechanism-head' },
        h('h3', null, 'Finger mechanism'),
        h('div', { style: { display: 'flex', gap: '6px' } }, this.play,
          h('button', { class: 'btn small', type: 'button', onclick: () => this.app.setPose({ close: 0, thumb: 0 }) }, 'Open hand'))),
      h('div', { class: 'mechanism-grid' },
        h('span', null, 'Close fingers'), this.close, this.out.close,
        h('span', null, 'Close thumb'), this.thumb, this.out.thumb,
        h('label', { class: 'check' }, object, 'Object in hand'), this.contact, this.out.contact),
      this.readout);
    this.#showReadout(this.app.lastReadout);
  }

  sync() {
    const pose = this.app.state.pose;
    this.close.value = Math.round(pose.close * 100);
    this.thumb.value = Math.round(pose.thumb * 100);
    this.object.checked = pose.object;
    this.contact.disabled = !pose.object;
    this.contact.value = pose.contactAngle;
  }

  togglePlay() {
    this.playing = !this.playing;
    this.play.replaceChildren(svg(this.playing ? ICONS.pause : ICONS.play), this.playing ? 'Pause' : 'Play');
    if (this.playing) {
      const start = performance.now() - Math.asin(Math.min(1, this.app.state.pose.close)) / Math.PI * 4000;
      this.stopLoop = this.app.viewer.onFrame((now) => {
        const t = (Math.sin(((now - start) / 4000) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
        this.app.setPose({ close: t, thumb: t }, true);
        this.sync();
      });
    } else {
      this.stopLoop?.();
    }
  }

  #showReadout(r) {
    if (!r || !this.out) return;
    const pose = this.app.state.pose;
    this.out.close.textContent = `${Math.round(r.input)}°`;
    this.out.thumb.textContent = `${Math.round(r.thumb)}°`;
    this.out.contact.textContent = pose.object ? `${pose.contactAngle}°` : 'off';
    const wrap = pose.object && r.pip > 0.5;
    this.readout.textContent = wrap
      ? `Index: knuckle stopped at ${Math.round(r.mcp)}°, input ${Math.round(r.input)}° → middle joint wraps ${Math.round(r.pip)}°. The other fingers stop at the object.`
      : 'In free air each finger turns as one piece about its knuckle shaft. Tick "Object in hand" to see the index wrap around an object (underactuated linkage).';
  }
}
