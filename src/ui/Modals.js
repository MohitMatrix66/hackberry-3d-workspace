/** About and keyboard-shortcut dialogs (native <dialog>). */
const SHORTCUTS = [
  ['F', 'Focus the selection (or fit the whole hand)'],
  ['Double-click', 'Focus the part under the cursor'],
  ['H', 'Hide the selection'],
  ['I', 'Isolate the selection'],
  ['A', 'Show everything again'],
  ['E', 'Explode / assemble'],
  ['X', 'X-ray: see servos, shafts and screws inside'],
  ['S', 'Section plane on / off'],
  ['M', 'Measure tool'],
  ['L', 'Servo labels'],
  ['C', 'Cycle colours: units / print profile / printed plastic'],
  ['Space', 'Play the open-close animation'],
  ['P', 'Save a screenshot'],
  ['1 – 6', 'Views: 3D, back, palm, thumb side, little-finger side, front'],
  ['Esc', 'Clear selection, exit tools and part inspection'],
];

export function openModal(kind, model) {
  const dialog = document.getElementById('modal');
  const body = document.getElementById('modal-body');
  body.innerHTML = kind === 'help' ? helpHtml() : aboutHtml(model);
  dialog.showModal();
}

function helpHtml() {
  const rows = SHORTCUTS.map(([k, v]) => `<tr><td style="width:150px"><kbd>${k}</kbd></td><td>${v}</td></tr>`).join('');
  return `<h2>Keyboard and mouse</h2>
    <p>Left-drag to rotate, right-drag (or Shift + drag) to pan, scroll to zoom. Click a part to select it.</p>
    <h3>Shortcuts</h3><table>${rows}</table>`;
}

function aboutHtml(model) {
  const d = model?.data;
  const counts = d
    ? `${d.instances.length} printed part instances (${d.parts.filter((p) => !p.optional).length} different STL files), ${d.hardware.length} bought parts and ${d.shafts.length} steel shafts`
    : '';
  return `<h2>Bionic Hand 3D Workspace</h2>
    <p>An interactive 3D workspace for a UG project at the School of Biomedical Engineering, IIT (BHU) Varanasi:
    an EMG-controlled prosthetic hand for below-elbow amputees, built on the open-source <b>HACKberry</b> design by exiii.</p>
    <h3>What you are looking at</h3>
    <p>${counts}. Every printed part is the real STL print file, placed exactly where it sits in the HACKberry
    assembly. The positions were read from the official STEP assembly file. Servos, screws, springs, boards and the
    battery are simplified models with their real sizes and positions.</p>
    <h3>How the hand works</h3>
    <ul>
      <li><b>Index finger</b>: driven by a standard-size servo through a printed gear pair.</li>
      <li><b>Middle, ring and little fingers</b>: share one micro servo through a chain of coupler links.</li>
      <li><b>Thumb</b>: its own micro servo inside the thumb; a button switches it open or closed.</li>
      <li>Each finger is an <b>underactuated linkage</b>: in free air it closes as one piece; the index finger wraps around an object after its proximal phalanx touches it.</li>
    </ul>
    <h3>Credits and licences</h3>
    <p>HACKberry 3D data © exiii Inc., <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a>,
    from <a href="https://github.com/mission-arm/HACKberry" target="_blank" rel="noopener">github.com/mission-arm/HACKberry</a>.
    Non-commercial use only. Website code: MIT licence. Built with <a href="https://threejs.org" target="_blank" rel="noopener">three.js</a> and Vite.</p>`;
}
