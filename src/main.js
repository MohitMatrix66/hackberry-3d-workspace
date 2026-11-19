import './styles/theme.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import { App } from './app/App.js';

const app = new App();
app.start().catch((err) => {
  console.error(err);
  const box = document.getElementById('errors') || document.body.appendChild(Object.assign(document.createElement('pre'), { id: 'errors', hidden: true }));
  box.textContent += `${err.stack || err}\n`;
});

// Keep a record of runtime errors in the DOM (used by automated screenshot checks).
window.addEventListener('error', (e) => {
  const box = document.getElementById('errors') || document.body.appendChild(Object.assign(document.createElement('pre'), { id: 'errors', hidden: true }));
  box.textContent += `${e.message} @ ${e.filename}:${e.lineno}\n`;
});
