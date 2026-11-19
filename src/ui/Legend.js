import { h } from './dom.js';

const PROFILE_LEGEND = [
  ['#9aa7b5', 'Covers & frames (25 % infill)'],
  ['#2a9d8f', 'Fingers & structural (50 %)'],
  ['#e07a2e', 'Links, gears & pins (100 %)'],
];

/** Colour key in the bottom-right corner; follows the colour mode. */
export class Legend {
  constructor(app, host) {
    this.app = app;
    this.host = host;
    app.bus.on('state', () => this.render());
    this.render();
  }

  render() {
    const mode = this.app.state.colorMode;
    let title;
    let entries;
    if (mode === 'print') {
      title = 'Print profile';
      entries = PROFILE_LEGEND;
    } else if (mode === 'real') {
      title = 'Colours';
      entries = [['#efeee8', 'Printed parts'], ['#2f4157', 'Servos'], ['#b4bcc5', 'Screws & shafts'], ['#1d6a44', 'Hand board']];
    } else {
      title = 'Units';
      entries = this.app.model.data.units.filter((u) => u.id !== 'accessory').map((u) => [u.color, u.name]);
    }
    this.host.replaceChildren(h('h4', null, title),
      ...entries.map(([c, label]) => h('div', { class: 'legend-item' }, h('span', { class: 'swatch', style: { background: c } }), label)));
  }
}
