/*
 * Atrapando el tiempo × Caradekid — bridge for Lively Wallpaper (Windows).
 *
 * Lively calls window.livelyPropertyListener(name, value) once per property when the
 * wallpaper loads and again whenever the user changes one in its customise panel.
 * The controls are generated from this same catalogue by scripts/build-lively.mjs,
 * so dropdown indices always line up with the lists below.
 */
(function (root) {
  'use strict';
  const E = root.TourbillonEngine;

  const LISTS = {
    model: Object.keys(E.MODELS),
    dial: ['', ...Object.keys(E.DIALS)],                     // 0 = the watch's own dial
    nightDial: ['', 'same', ...Object.keys(E.DIALS)],        // 0 = the watch's own night dial
    material: ['', ...Object.keys(E.MATERIALS)],
    bezel: ['', ...Object.keys(E.BEZELS)],
    date: ['', true, false],
    tourbillon: ['', true, false],
    emblem: ['medallion', 'printed', 'none'],
    font: Object.keys(E.FONTS),
    appearance: ['auto', 'light', 'dark'],
    light: ['time', 'fixed'],
    background: ['studio', 'spotlight', 'solid'],
    position: ['center', 'left', 'right'],
    size: [0.28, 0.38, 0.5, 0.66],
    fps: [60, 30, 15],
  };

  const state = {};
  let timer = null;

  function build() {
    const model = LISTS.model[state.model | 0] || LISTS.model[0];
    const cfg = Object.assign({}, E.DEFAULTS, E.MODELS[model].defaults, { model });
    for (const key of ['dial', 'nightDial', 'material', 'bezel', 'date', 'tourbillon']) {
      const v = LISTS[key][state[key] | 0];
      if (v !== '' && v !== undefined) cfg[key] = v;
    }
    for (const key of ['emblem', 'font', 'appearance', 'light', 'background', 'position', 'size', 'fps']) {
      if (state[key] !== undefined) cfg[key] = LISTS[key][state[key] | 0];
    }
    for (const key of ['wordmark', 'subline', 'bgLight', 'bgDark']) {
      if (typeof state[key] === 'string') cfg[key] = state[key];
    }
    for (const key of ['lume', 'parallax']) {
      if (typeof state[key] === 'boolean') cfg[key] = state[key];
    }
    return cfg;
  }

  // Lively sends every property on load in quick succession: apply once they settle.
  root.livelyPropertyListener = function (name, value) {
    state[name] = value;
    clearTimeout(timer);
    timer = setTimeout(() => root.TBApp && root.TBApp.applyConfig(build()), 40);
  };

  root.TBLively = { LISTS, build, state };
})(typeof window !== 'undefined' ? window : this);
