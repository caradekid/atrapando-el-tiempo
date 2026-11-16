/*
 * Atrapando el tiempo × CARADEKID — page controller.
 * Modes: "settings" (editor with live preview), "wallpaper" and "saver" (full-screen scene).
 * The native shell injects window.TB_BOOT = { mode, config, native } before this script runs.
 * In a plain browser the editor opens and settings are kept in localStorage.
 */
(function () {
  'use strict';
  const E = window.TourbillonEngine;
  const boot = window.TB_BOOT || {};
  const params = new URLSearchParams(location.search);
  const mode = boot.mode || params.get('mode') || 'settings';
  const bridge = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.tourbillon;
  const isNative = !!(boot.native && bridge);
  const STORE_KEY = 'atrapando-el-tiempo.config.v1';
  const CHANNEL = 'https://www.youtube.com/@AtrapandoelTiempo';
  const CREATOR = 'https://www.instagram.com/caradekid.jpg/';
  // In the Mac app links open in the browser, not inside the settings window.
  function openExternal(e) {
    if (!isNative) return;
    e.preventDefault();
    post({ type: 'open', url: e.currentTarget.href });
  }

  function post(msg) {
    try { if (bridge) bridge.postMessage(msg); } catch (e) { /* not native */ }
  }

  function loadConfig() {
    if (boot.config) return E.normalizeConfig(boot.config);
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return E.normalizeConfig(JSON.parse(raw));
    } catch (e) { /* storage unavailable */ }
    return E.normalizeConfig({});
  }

  function saveConfig(cfg) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); } catch (e) { /* ignore */ }
    post({ type: 'config', config: cfg });
  }

  let config = loadConfig();
  const app = document.getElementById('app');
  let scene = null;
  let ui = null;

  /* --------------------------------------------------------- public API */
  window.TBApp = {
    applyConfig(cfg) {
      config = E.normalizeConfig(typeof cfg === 'string' ? JSON.parse(cfg) : cfg);
      if (scene) scene.setConfig(config);
      if (ui) ui.refresh();
    },
    /** Cursor position from the native shell: -1…1 relative to the screen centre. */
    pointer(x, y) { if (scene) scene.setPointer(x, y); },
    pause() { if (scene) scene.pause(); },
    resume() { if (scene) scene.resume(); },
    /** Returns a base64 PNG (no data: prefix) of the full scene at a fixed, photogenic 10:10:31. */
    snapshot(width, height, dark, cfg) {
      const c = document.createElement('canvas');
      const t = new Date();
      t.setHours(10, 10, 31, 0);
      E.composeFrame(c, width, height, cfg || config, !!dark, t);
      return c.toDataURL('image/png').split(',')[1];
    },
    toast(msg) { if (ui) ui.toast(msg); },
    actionDone(name, msg) { if (ui) ui.actionDone(name, msg); },
    getConfig() { return config; },
    /** The live scene, for debugging from the console. */
    get scene() { return scene; },
  };

  /* ------------------------------------------------------- scene modes */
  if (mode !== 'settings') {
    // the screen saver hides the cursor; a wallpaper must not (on Windows it sits under the desktop)
    if (mode === 'saver') document.body.style.cursor = 'none';
    const host = document.createElement('div');
    app.appendChild(host);
    scene = new E.Scene(host, { forceDark: boot.forceDark ?? null });
    scene.setConfig(config);
    scene.start();
    // where the page itself receives the mouse (Lively on Windows, a browser), the light follows it;
    // the Mac app feeds the cursor natively through TBApp.pointer instead
    window.addEventListener('mousemove', (e) => {
      scene.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    }, { passive: true });
    post({ type: 'ready', mode });
    return;
  }

  /* ----------------------------------------------------------- editor */
  if (isNative) document.body.classList.add('native');
  const h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach((c) => c != null && el.append(c.nodeType ? c : document.createTextNode(c)));
    return el;
  };

  let saveTimer = null;
  function update(patch) {
    config = E.normalizeConfig(Object.assign({}, config, patch));
    scene.setConfig(config);
    ui.refresh();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveConfig(config), 120);
  }

  function segmented(key, options, onPick) {
    const wrap = h('div', { class: 'seg', role: 'group' });
    options.forEach(([value, label]) => {
      const b = h('button', { type: 'button', 'data-v': String(value), onclick: () => (onPick ? onPick(value) : update({ [key]: value })) }, label);
      wrap.appendChild(b);
    });
    wrap._sync = (v) => wrap.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === String(v))));
    return wrap;
  }

  function swatches(key, entries, colorOf, extra) {
    const wrap = h('div', { class: 'swatches' });
    if (extra) wrap.appendChild(extra);
    entries.forEach(([id, item]) => {
      wrap.appendChild(h('button', {
        type: 'button', class: 'swatch', title: item.name || id, 'aria-label': item.name || id, 'data-v': id,
        style: `background:${colorOf(item, id)}`,
        onclick: () => update({ [key]: id }),
      }));
    });
    wrap._sync = (v) => wrap.querySelectorAll('.swatch').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === String(v))));
    return wrap;
  }

  function toggle(key, label) {
    const input = h('input', { type: 'checkbox', onchange: (e) => update({ [key]: e.target.checked }) });
    const row = h('div', { class: 'row' }, h('label', {}, label), h('span', { class: 'switch' }, input, h('span')));
    row._sync = () => { input.checked = !!config[key]; };
    return row;
  }

  ui = (() => {
    const syncs = [];
    const reg = (el, fn) => { syncs.push(fn || ((c) => el._sync(c))); return el; };

    // stage
    const previewHost = h('div', { class: 'preview' });
    const toastEl = h('div', { class: 'toast', role: 'status' });
    let previewDark = null;
    const previewSeg = segmented('preview', [['auto', 'System'], ['light', 'Light'], ['dark', 'Dark']], (v) => {
      previewDark = v === 'auto' ? null : v === 'dark';
      scene.setForceDark(previewDark);
      previewSeg._sync(v);
    });
    previewSeg._sync('auto');
    const stage = h('div', { class: 'stage' },
      h('div', { class: 'stage-bar' },
        h('div', { class: 'brand' },
          h('a', { href: CHANNEL, target: '_blank', rel: 'noopener', onclick: openExternal, title: 'Atrapando el tiempo on YouTube' }, 'Atrapando el tiempo'),
          h('small', {}, '× ', h('a', { href: CREATOR, target: '_blank', rel: 'noopener', onclick: openExternal, title: 'CARADEKID on Instagram' }, 'CARADEKID'), ' · live watch wallpaper · works offline')),
        h('div', { class: 'row' }, h('span', { class: 'sub-label', style: 'margin:0' }, 'Preview'), previewSeg)),
      h('div', { class: 'preview-wrap' }, previewHost),
      h('div', { class: 'stage-foot' }, 'Light and dark follow macOS automatically when Appearance is set to Auto.'),
      toastEl);

    // model cards with live-rendered thumbnails
    const modelGrid = h('div', { class: 'models' });
    const modelNote = h('div', { class: 'model-note' });
    const thumbDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const flags = { Japan: 'Japan', Switzerland: 'Switzerland', Spain: 'Spain' };
    let lastOrigin = null;
    Object.entries(E.MODELS).forEach(([id, m]) => {
      if (m.origin !== lastOrigin) {
        lastOrigin = m.origin;
        modelGrid.appendChild(h('div', { class: 'origin' }, flags[m.origin] || m.origin));
      }
      const cv = h('canvas', { width: 128, height: 128 });
      const btn = h('button', {
        type: 'button', class: 'model', 'data-v': id, title: m.note,
        onclick: () => update(Object.assign({ model: id }, m.defaults)),
      }, cv, m.name);
      modelGrid.appendChild(btn);
      requestAnimationFrame(() => {
        const ctx = cv.getContext('2d');
        const t = new Date(); t.setHours(10, 10, 31, 0);
        const cfg = Object.assign({}, E.DEFAULTS, m.defaults, { model: id, wordmark: '', subline: '' });
        E.renderWatch(ctx, 64, 64, 58, cfg, thumbDark, t);
      });
    });
    reg(modelGrid, (c) => {
      modelGrid.querySelectorAll('.model').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === c.model)));
      modelNote.textContent = E.MODELS[c.model].note;
    });

    const dialSw = swatches('dial', Object.entries(E.DIALS), (d) => `linear-gradient(135deg, ${d.a}, ${d.b})`);
    const sameBtn = h('button', { type: 'button', class: 'swatch same', title: 'Same as day', 'data-v': 'same', onclick: () => update({ nightDial: 'same' }) });
    const nightSw = swatches('nightDial', Object.entries(E.DIALS), (d) => `linear-gradient(135deg, ${d.a}, ${d.b})`, sameBtn);
    syncs.push((c) => dialSw._sync(c.dial), (c) => nightSw._sync(c.nightDial));

    const matSw = swatches('material', Object.entries(E.MATERIALS), (m) => `linear-gradient(135deg, ${m.hi}, ${m.mid} 45%, ${m.lo})`);
    syncs.push((c) => matSw._sync(c.material));

    const bezelSw = swatches('bezel', Object.entries(E.BEZELS), (b) => `linear-gradient(180deg, ${b.top} 50%, ${b.bottom} 50%)`);
    const bezelBlock = h('div', {}, h('div', { class: 'sub-label' }, 'Outer scale ring'), bezelSw);
    syncs.push((c) => {
      bezelSw._sync(c.bezel);
      const b = E.MODELS[c.model].bezel;
      bezelBlock.style.display = b === 'diver' || b === 'gmt' ? '' : 'none';
    });

    const toggles = [
      toggle('tourbillon', 'Tourbillon'),
      toggle('tourbillonBridge', 'Tourbillon bridge'),
      toggle('centralSeconds', 'Central seconds hand'),
      toggle('date', 'Date window'),
      toggle('lume', 'Glowing lume in dark mode'),
    ];
    toggles.forEach((t) => syncs.push(() => t._sync()));
    syncs.push((c) => {
      toggles[1].style.display = c.tourbillon ? '' : 'none';
      toggles[3].style.display = E.MODELS[c.model].dateAt ? '' : 'none';
      toggles[2].style.display = E.MODELS[c.model].subdials ? 'none' : '';
    });

    const wordmark = h('input', { type: 'text', maxlength: 24, placeholder: 'Your signature', oninput: (e) => update({ wordmark: e.target.value }) });
    const subline = h('input', { type: 'text', maxlength: 32, placeholder: 'Second line', oninput: (e) => update({ subline: e.target.value }) });
    const emblemSeg = segmented('emblem', [['medallion', 'Medallion'], ['printed', 'Printed'], ['none', 'Off']]);
    syncs.push((c) => emblemSeg._sync(c.emblem));
    const fontSel = h('select', { onchange: (e) => update({ font: e.target.value }) },
      Object.entries(E.FONTS).map(([k, f]) => h('option', { value: k }, f.name)));
    syncs.push((c) => {
      if (document.activeElement !== wordmark) wordmark.value = c.wordmark;
      if (document.activeElement !== subline) subline.value = c.subline;
      fontSel.value = c.font;
    });

    const appearanceSeg = segmented('appearance', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]);
    const bgSeg = segmented('background', [['studio', 'Studio'], ['spotlight', 'Spotlight'], ['solid', 'Solid']]);
    const posSeg = segmented('position', [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']]);
    const fpsSeg = segmented('fps', [[60, 'Smooth'], [30, 'Balanced'], [15, 'Eco']]);
    const lightSeg = segmented('light', [['time', 'Time of day'], ['fixed', 'Studio']]);
    const parallaxToggle = toggle('parallax', 'Light follows the cursor');
    const bgLight = h('input', { type: 'color', oninput: (e) => update({ bgLight: e.target.value }), 'aria-label': 'Light background' });
    const bgDark = h('input', { type: 'color', oninput: (e) => update({ bgDark: e.target.value }), 'aria-label': 'Dark background' });
    // watch diameter as a share of the screen height
    const SIZES = [[0.28, 'Very small'], [0.38, 'Small'], [0.5, 'Medium'], [0.66, 'Large']];
    const sizeSeg = segmented('size', SIZES);
    sizeSeg.classList.add('seg-full');
    syncs.push((c) => {
      lightSeg._sync(c.light); parallaxToggle._sync();
      appearanceSeg._sync(c.appearance); bgSeg._sync(c.background); posSeg._sync(c.position); fpsSeg._sync(c.fps);
      bgLight.value = c.bgLight; bgDark.value = c.bgDark;
      const near = SIZES.reduce((best, [v]) => (Math.abs(v - c.size) < Math.abs(best - c.size) ? v : best), SIZES[0][0]);
      sizeSeg._sync(near);
    });

    // actions
    const actionButtons = {};
    const actionBtn = (name, label, primary) => {
      const b = h('button', { type: 'button', class: 'btn' + (primary ? ' primary' : ''), onclick: () => runAction(name) }, label);
      actionButtons[name] = b;
      return b;
    };
    const actions = isNative
      ? h('div', { class: 'actions' },
        actionBtn('applyLogin', 'Apply to login & lock screen', true),
        actionBtn('installSaver', 'Install screen saver'),
        actionBtn('toggleWallpaper', 'Pause / resume live wallpaper'),
        h('p', { class: 'hint' }, 'The login window shows a light and dark still image at 10:10. The screen saver runs the live animation on the lock screen.'))
      : h('div', { class: 'actions' },
        actionBtn('downloadLight', 'Download wallpaper · Light', true),
        actionBtn('downloadDark', 'Download wallpaper · Dark'),
        h('p', { class: 'hint' }, 'Running in a browser. Build the macOS app for the live wallpaper, the login screen and the screen saver.'));
    const resetBtn = h('button', { type: 'button', class: 'btn', onclick: () => update(Object.assign({}, E.DEFAULTS)) }, 'Reset to defaults');

    function runAction(name) {
      if (name === 'downloadLight' || name === 'downloadDark') {
        const w = Math.round(screen.width * (window.devicePixelRatio || 1));
        const hh = Math.round(screen.height * (window.devicePixelRatio || 1));
        const b64 = window.TBApp.snapshot(w, hh, name === 'downloadDark');
        const a = document.createElement('a');
        a.href = 'data:image/png;base64,' + b64;
        a.download = `atrapando-el-tiempo-${config.model}-${name === 'downloadDark' ? 'dark' : 'light'}.png`;
        a.click();
        return;
      }
      const b = actionButtons[name];
      if (b) b.disabled = true;
      post({ type: 'action', name, config });
    }

    const section = (title, ...kids) => h('section', { class: 'section' }, h('h3', {}, title), ...kids);
    const row = (label, control) => h('div', { class: 'row' }, h('label', {}, label), control);

    const panel = h('aside', { class: 'panel' },
      section('Watch', modelGrid, modelNote),
      section('Dial', dialSw, h('div', { class: 'sub-label' }, 'Dial at night (dark mode)'), nightSw),
      section('Hands & indices', matSw, bezelBlock),
      section('Complications', ...toggles),
      section('Signature', row('AET', emblemSeg), row('Text', wordmark), row('Second line', subline), row('Typeface', fontSel)),
      section('Scene',
        row('Appearance', appearanceSeg),
        row('Light', lightSeg),
        parallaxToggle,
        row('Background', bgSeg),
        row('Light / dark colour', h('span', { class: 'row', style: 'gap:8px' }, bgLight, bgDark)),
        row('Position', posSeg),
        h('div', { class: 'sub-label' }, 'Watch size'),
        sizeSeg,
        row('Frame rate', fpsSeg)),
      section(isNative ? 'Mac' : 'Export', actions),
      section('', resetBtn));

    app.appendChild(h('div', { class: 'settings' }, stage, panel));

    scene = new E.Scene(previewHost, {});
    previewHost.addEventListener('mousemove', (e) => {
      const r = previewHost.getBoundingClientRect();
      scene.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
    });
    previewHost.addEventListener('mouseleave', () => scene.setPointer(0, 0));
    scene.setConfig(config);
    scene.start();

    let toastTimer = null;
    return {
      refresh() { syncs.forEach((fn) => fn(config)); },
      toast(msg) {
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
      },
      actionDone(name, msg) {
        if (actionButtons[name]) actionButtons[name].disabled = false;
        if (msg) this.toast(msg);
      },
    };
  })();

  ui.refresh();
  post({ type: 'ready', mode });
})();
