// Builds the Lively Wallpaper (Windows) package folder from the web engine.
//
//   node scripts/build-lively.mjs <out-dir> <version>
//
// LivelyProperties.json is generated from the engine's own catalogue, in the same order
// web/lively.js reads it, so the customise panel always matches the dials.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [out = join(root, 'build/lively'), version = '1.0.0'] = process.argv.slice(2);

// Load the catalogue: engine.js only defines data and functions at the top level.
const win = {};
new Function('window', readFileSync(join(root, 'web/engine.js'), 'utf8'))(win);
const E = win.TourbillonEngine;
const D = E.DEFAULTS;

const names = (obj) => Object.values(obj).map((v) => v.name);
const index = (list, value) => Math.max(0, list.indexOf(value));
const dropdown = (text, items, value) => ({ type: 'dropdown', text, items, value });
const modelIds = Object.keys(E.MODELS);

const properties = {
  model: dropdown('Watch', Object.values(E.MODELS).map((m) => `${m.name} · ${m.origin}`), index(modelIds, D.model)),
  dial: dropdown('Dial colour', ['Watch default', ...names(E.DIALS)], 0),
  nightDial: dropdown('Dial at night (dark mode)', ['Watch default', 'Same as day', ...names(E.DIALS)], 0),
  material: dropdown('Hands & indices metal', ['Watch default', ...names(E.MATERIALS)], 0),
  bezel: dropdown('Outer scale ring', ['Watch default', ...names(E.BEZELS)], 0),
  date: dropdown('Date window', ['Watch default', 'On', 'Off'], 0),
  tourbillon: dropdown('Tourbillon', ['Watch default', 'On', 'Off'], 0),
  lume: { type: 'checkbox', text: 'Glowing lume in dark mode', value: D.lume },
  emblem: dropdown('AET', ['Medallion', 'Printed', 'Off'], 0),
  wordmark: { type: 'textbox', text: 'Signature', value: D.wordmark },
  subline: { type: 'textbox', text: 'Second line', value: D.subline },
  font: dropdown('Typeface', names(E.FONTS), index(Object.keys(E.FONTS), D.font)),
  appearance: dropdown('Appearance', ['Auto', 'Light', 'Dark'], 0),
  light: dropdown('Light', ['Time of day', 'Studio'], 0),
  parallax: { type: 'checkbox', text: 'Light follows the cursor', value: D.parallax },
  background: dropdown('Background', ['Studio', 'Spotlight', 'Solid'], 0),
  bgLight: { type: 'color', text: 'Background (light)', value: D.bgLight },
  bgDark: { type: 'color', text: 'Background (dark)', value: D.bgDark },
  position: dropdown('Position', ['Centre', 'Left', 'Right'], 0),
  size: dropdown('Watch size', ['Very small', 'Small', 'Medium', 'Large'], 2),
  fps: dropdown('Frame rate', ['Smooth (60)', 'Balanced (30)', 'Eco (15)'], 0),
  credits: { type: 'label', value: 'Atrapando el tiempo × Caradekid' },
};

const info = {
  AppVersion: '2.1.0.0',
  Title: 'Atrapando el tiempo × Caradekid',
  Thumbnail: 'thumbnail.jpg',
  Preview: 'thumbnail.jpg',
  Desc: `Live, photorealistic watch-dial wallpaper with the real time: ${modelIds.length} dials inspired by Japanese, Swiss and Spanish classics, light that follows the time of day and the cursor, light and dark mode. Works offline. A gift from Caradekid (https://www.instagram.com/caradekid.jpg/) to Atrapando el tiempo (https://www.youtube.com/@AtrapandoelTiempo) · v${version}`,
  Author: 'Caradekid',
  License: 'MIT (code). The channel emblem belongs to Atrapando el tiempo.',
  Contact: 'https://github.com/caradekid/atrapando-el-tiempo',
  Type: 1,
  FileName: 'wallpaper.html',
  Arguments: null,
  IsAbsolutePath: false,
};

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'LivelyInfo.json'), JSON.stringify(info, null, 2));
writeFileSync(join(out, 'LivelyProperties.json'), JSON.stringify(properties, null, 2));
for (const f of ['wallpaper.html', 'gl.js', 'engine.js', 'app.js', 'lively.js', 'styles.css']) {
  copyFileSync(join(root, 'web', f), join(out, f));
}
copyFileSync(join(root, 'assets/lively-thumbnail.jpg'), join(out, 'thumbnail.jpg'));
console.log(`Lively package folder: ${out} (${Object.keys(properties).length} settings, ${modelIds.length} dials)`);
