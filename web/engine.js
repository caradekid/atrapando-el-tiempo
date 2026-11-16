/*
 * Tourbillon — watch rendering engine.
 * Pure Canvas 2D. No network, no external assets, system fonts only.
 *
 * Coordinates: origin at the watch centre, y grows downwards.
 * Angles are clockwise from 12 o'clock.
 */
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ------------------------------------------------------------------ colour */
  function hexToRgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(c) {
    return '#' + c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  }
  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    return rgbToHex(A.map((v, i) => v + (B[i] - v) * t));
  }
  function rgba(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }
  function luminance(hex) {
    const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /* --------------------------------------------------------------- catalogue */
  const MATERIALS = {
    steel:      { name: 'Steel',          hi: '#fbfcfd', mid: '#b9bdc4', lo: '#666b73', edge: '#43474e' },
    whitegold:  { name: 'White gold',     hi: '#ffffff', mid: '#d3d1cc', lo: '#86847f', edge: '#5b5955' },
    platinum:   { name: 'Platinum',       hi: '#f6f8fa', mid: '#c4c8cd', lo: '#7a8088', edge: '#50555c' },
    yellowgold: { name: 'Yellow gold',    hi: '#fff3cc', mid: '#d8ae57', lo: '#86601f', edge: '#5a4013' },
    rosegold:   { name: 'Rose gold',      hi: '#ffe7da', mid: '#d59c80', lo: '#8a4e37', edge: '#5c3323' },
    titanium:   { name: 'Titanium',       hi: '#d9dbde', mid: '#8e9297', lo: '#4a4e53', edge: '#303337' },
    ceramic:    { name: 'Black ceramic',  hi: '#74767c', mid: '#222327', lo: '#070708', edge: '#000000' },
  };

  // pattern: dial texture. sub: chronograph sub-dial colour.
  const DIALS = {
    snow:         { name: 'Snow white',     a: '#f6f7f8', b: '#dfe3e7', ink: '#1d2430' },
    birch:        { name: 'Birch silver',   a: '#f1f2f1', b: '#cfd4d6', ink: '#1f2328' },
    ivory:        { name: 'Ivory opaline',  a: '#f7f2e7', b: '#e4dccb', ink: '#2b2620' },
    white:        { name: 'Lacquer white',  a: '#fcfcfa', b: '#e9e8e4', ink: '#1b1b1d' },
    silver:       { name: 'Silver',         a: '#f0f2f4', b: '#c4cad1', ink: '#22252a' },
    champagne:    { name: 'Champagne',      a: '#f1dfb4', b: '#c4a464', ink: '#3a2d17' },
    salmon:       { name: 'Salmon',         a: '#f3c6aa', b: '#d08a64', ink: '#3b2219' },
    ice:          { name: 'Ice blue',       a: '#dcedf4', b: '#9cc4d4', ink: '#1c3440' },
    sky:          { name: 'Sky blue',       a: '#5fb1d6', b: '#14507c', ink: '#f4f6f8' },
    turquoise:    { name: 'Robin egg',      a: '#8fd8cf', b: '#3f9a90', ink: '#103430' },
    blue:         { name: 'Midnight blue',  a: '#2f5394', b: '#0b1c40', ink: '#f2f0e9' },
    green:        { name: 'Forest green',   a: '#3a6e50', b: '#0f2d1d', ink: '#efe9db' },
    burgundy:     { name: 'Burgundy',       a: '#7c2532', b: '#330a11', ink: '#f4eae1' },
    slate:        { name: 'Slate grey',     a: '#6a717a', b: '#262b31', ink: '#f2f2f0' },
    black:        { name: 'Black',          a: '#2a2b2f', b: '#08080a', ink: '#f4f2ed' },
    panda:        { name: 'Panda',          a: '#f5f5f3', b: '#d6d6d2', ink: '#151517', sub: '#151618' },
    reversepanda: { name: 'Reverse panda',  a: '#1b1c1f', b: '#060607', ink: '#f2f1ec', sub: '#ecebe7' },
  };

  const BEZELS = {
    black:      { name: 'Black',          top: '#151517', bottom: '#151517' },
    blue:       { name: 'Blue',           top: '#1d3c80', bottom: '#1d3c80' },
    green:      { name: 'Green',          top: '#1c5a3b', bottom: '#1c5a3b' },
    burgundy:   { name: 'Burgundy',       top: '#5e1a25', bottom: '#5e1a25' },
    white:      { name: 'White ceramic',  top: '#f0f0ee', bottom: '#f0f0ee' },
    redblue:    { name: 'Red / Blue',     top: '#a8212f', bottom: '#1f3b8c' },
    blueblack:  { name: 'Blue / Black',   top: '#1f3f8f', bottom: '#141416' },
    greenblack: { name: 'Green / Black',  top: '#1c5b3a', bottom: '#141416' },
    brownblack: { name: 'Root beer',      top: '#5a3424', bottom: '#151213' },
  };

  const FONTS = {
    didot:       { name: 'Didot',        css: '"Didot","Bodoni 72",serif' },
    bodoni:      { name: 'Bodoni',       css: '"Bodoni 72","Didot",serif' },
    baskerville: { name: 'Baskerville',  css: 'Baskerville,"Times New Roman",serif' },
    optima:      { name: 'Optima',       css: 'Optima,"Avenir Next",sans-serif' },
    futura:      { name: 'Futura',       css: 'Futura,"Avenir Next",sans-serif' },
    avenir:      { name: 'Avenir',       css: '"Avenir Next","Helvetica Neue",sans-serif' },
    copperplate: { name: 'Copperplate',  css: 'Copperplate,"Didot",serif' },
  };

  // Style families inspired by the great classics. No brand names, logos or trade dress.
  // Dial styles inspired by the great Japanese, Swiss and Spanish classics.
  // Deliberately no brand names, logos or trade dress: the signature text is yours.
  //   texture  procedural dial surface      bezel   flat outer scale ring (diver | gmt | tachy | compressor | none)
  //   motion   seconds: glide | beat6 | beat8 | tick
  const MODELS = {
    snowfield: {
      name: 'Snowfield', origin: 'Japan', note: 'Wind-swept snow texture, gliding seconds, power reserve',
      bezel: 'none', texture: 'snow', indices: 'faceted', hands: 'faceted', secondsHand: 'needle', blueSeconds: true,
      motion: 'glide', powerReserve: true, dateAt: 3,
      defaults: { dial: 'snow', material: 'steel', tourbillon: false, centralSeconds: true, date: true, nightDial: 'slate' },
    },
    birch: {
      name: 'Birch', origin: 'Japan', note: 'Vertical bark relief, razor-sharp hands',
      bezel: 'none', texture: 'birch', indices: 'faceted', hands: 'faceted', secondsHand: 'needle',
      motion: 'beat8', dateAt: 3,
      defaults: { dial: 'birch', material: 'steel', tourbillon: false, centralSeconds: true, date: true, nightDial: 'slate' },
    },
    cocktail: {
      name: 'Cocktail', origin: 'Japan', note: 'Radial sunray grooves, dauphine hands',
      bezel: 'none', texture: 'cocktail', indices: 'baton', hands: 'dauphine', secondsHand: 'needle',
      motion: 'beat6', dateAt: 3,
      defaults: { dial: 'sky', material: 'steel', tourbillon: false, centralSeconds: true, date: true, nightDial: 'same' },
    },
    shellDiver: {
      name: 'Shell Diver', origin: 'Japan', note: 'Big lume plots, day-date, dive scale',
      bezel: 'diver', texture: 'matte', indices: 'bigdots', hands: 'arrow', secondsHand: 'lollipop',
      motion: 'beat6', dateAt: 3, dayDate: true, sport: true,
      defaults: { dial: 'black', material: 'steel', bezel: 'black', tourbillon: false, centralSeconds: true, date: true, nightDial: 'same' },
    },
    submersible: {
      name: 'Submersible', origin: 'Switzerland', note: 'Gloss dial, round plots, 60-minute scale',
      bezel: 'diver', texture: 'gloss', indices: 'dots', hands: 'sword', secondsHand: 'lollipop',
      motion: 'beat8', dateAt: 3, cyclops: true, sport: true,
      defaults: { dial: 'black', material: 'steel', bezel: 'black', tourbillon: false, centralSeconds: true, date: false, nightDial: 'same' },
    },
    gmt: {
      name: 'GMT', origin: 'Switzerland', note: 'Second time zone on a two-tone 24 h scale',
      bezel: 'gmt', texture: 'gloss', indices: 'dots', hands: 'sword', secondsHand: 'lollipop', gmt: true,
      motion: 'beat8', dateAt: 3, cyclops: true, sport: true,
      defaults: { dial: 'black', material: 'steel', bezel: 'redblue', tourbillon: false, centralSeconds: true, date: true, nightDial: 'same' },
    },
    moonChrono: {
      name: 'Moon Chrono', origin: 'Switzerland', note: 'Matte black, three registers, tachymeter',
      bezel: 'tachy', texture: 'matte', indices: 'baton', hands: 'baton', secondsHand: 'needle', whiteSeconds: true,
      motion: 'beat6', subdials: 3, sport: true,
      defaults: { dial: 'black', material: 'steel', tourbillon: false, nightDial: 'same' },
    },
    datum: {
      name: 'Datum', origin: 'Switzerland', note: 'Sunburst dial, date under a magnifier',
      bezel: 'none', texture: 'sunray', indices: 'baton', hands: 'baton', secondsHand: 'needle',
      motion: 'beat8', dateAt: 3, cyclops: true,
      defaults: { dial: 'blue', material: 'whitegold', tourbillon: false, centralSeconds: true, date: true, nightDial: 'same' },
    },
    calatrava: {
      name: 'Calatrava', origin: 'Switzerland', note: 'Ultra-thin dress dial, small seconds',
      bezel: 'none', texture: 'opaline', indices: 'baton', hands: 'dauphine', secondsHand: 'needle',
      motion: 'beat6',
      defaults: { dial: 'ivory', material: 'rosegold', tourbillon: false, centralSeconds: false, nightDial: 'same' },
    },
    octagon: {
      name: 'Octagon', origin: 'Switzerland', note: 'Tapisserie grid, integrated-sport spirit',
      bezel: 'none', texture: 'tapisserie', indices: 'baton', hands: 'baton', secondsHand: 'needle',
      motion: 'beat8', dateAt: 3, sport: true,
      defaults: { dial: 'blue', material: 'steel', tourbillon: false, centralSeconds: true, date: true, nightDial: 'same' },
    },
    guilloche: {
      name: 'Guilloché', origin: 'Switzerland', note: 'Engine-turned silver, pomme hands, tourbillon',
      bezel: 'none', texture: 'guilloche', indices: 'roman', hands: 'breguet', secondsHand: 'needle',
      motion: 'beat6',
      defaults: { dial: 'silver', material: 'yellowgold', tourbillon: true, centralSeconds: false, nightDial: 'same' },
    },
    pilot: {
      name: 'Pilot', origin: 'Switzerland', note: 'Big aviation numerals, blued hands',
      bezel: 'none', texture: 'matte', indices: 'arabic', hands: 'pilot', secondsHand: 'needle',
      motion: 'beat8', sport: true,
      defaults: { dial: 'black', material: 'titanium', tourbillon: false, centralSeconds: true, nightDial: 'same' },
    },
    skeleton: {
      name: 'Skeleton', origin: 'Switzerland', note: 'Open-worked movement with tourbillon',
      bezel: 'none', texture: 'skeleton', indices: 'chapter', hands: 'feuille', secondsHand: 'needle',
      motion: 'beat6',
      defaults: { dial: 'slate', material: 'platinum', tourbillon: true, centralSeconds: false, nightDial: 'same' },
    },
    racing: {
      name: 'Racing Chrono', origin: 'Spain', note: 'Bold sports chronograph, red accents, quartz tick',
      bezel: 'tachy', texture: 'sunray', indices: 'sport', hands: 'baton', secondsHand: 'needle',
      motion: 'tick', subdials: 3, racing: true, sport: true,
      defaults: { dial: 'blue', material: 'steel', tourbillon: false, nightDial: 'same' },
    },
    mediterraneo: {
      name: 'Mediterráneo', origin: 'Spain', note: 'Vintage compressor diver, inner scale, orange accents',
      bezel: 'compressor', texture: 'matte', indices: 'baton', hands: 'baton', secondsHand: 'needle', orange: true,
      motion: 'beat6', dateAt: 3, sport: true,
      defaults: { dial: 'black', material: 'steel', tourbillon: false, centralSeconds: true, date: true, nightDial: 'same' },
    },
  };

  const DEFAULTS = {
    version: 1,
    model: 'snowfield',
    dial: 'snow',
    nightDial: 'slate',
    material: 'steel',
    bezel: 'black',
    tourbillon: false,
    tourbillonBridge: true,
    centralSeconds: true,
    date: true,
    lume: true,
    wordmark: 'MAISON',
    subline: 'Automatic',
    font: 'didot',
    appearance: 'auto',
    background: 'studio',
    bgLight: '#ece9e3',
    bgDark: '#0d0e10',
    position: 'center',
    size: 0.62,
    fps: 60,
  };

  function normalizeConfig(cfg) {
    const c = Object.assign({}, DEFAULTS, cfg || {});
    if (!MODELS[c.model]) c.model = DEFAULTS.model;
    if (!DIALS[c.dial]) c.dial = DEFAULTS.dial;
    if (c.nightDial !== 'same' && !DIALS[c.nightDial]) c.nightDial = 'same';
    if (!MATERIALS[c.material]) c.material = DEFAULTS.material;
    if (!BEZELS[c.bezel]) c.bezel = DEFAULTS.bezel;
    if (!FONTS[c.font]) c.font = DEFAULTS.font;
    c.size = clamp(Number(c.size) || DEFAULTS.size, 0.2, 0.9);
    c.fps = Number(c.fps) === 30 ? 30 : Number(c.fps) === 15 ? 15 : 60;
    c.wordmark = String(c.wordmark ?? '').slice(0, 24);
    c.subline = String(c.subline ?? '').slice(0, 32);
    return c;
  }

  /* -------------------------------------------------------------- environment */
  // Metals reflect the room: in a dark scene highlights are dimmer and shadows deeper.
  function envMaterial(mat, dark) {
    if (!dark) return mat;
    return {
      hi: mix(mat.hi, mat.mid, 0.25),
      mid: mix(mat.mid, '#000000', 0.18),
      lo: mix(mat.lo, '#000000', 0.35),
      edge: mix(mat.edge, '#000000', 0.4),
    };
  }

  function makeEnv(cfg, dark, date) {
    const model = MODELS[cfg.model];
    const dialId = dark && cfg.nightDial !== 'same' ? cfg.nightDial : cfg.dial;
    const dial = Object.assign({}, DIALS[dialId]);
    if (!dial.sub) dial.sub = mix(dial.b, luminance(dial.a) > 0.5 ? '#000000' : '#ffffff', 0.06);
    const mat = envMaterial(MATERIALS[cfg.material], dark);
    const lightDial = luminance(dial.a) > 0.5;
    const lumeGlow = dark && cfg.lume;
    return {
      cfg, model, dial, mat, dark, date: date || new Date(),
      lightDial,
      lume: lumeGlow ? '#c9f7b5' : '#f1ecdc',
      lumeGlow,
      accent: model.orange ? '#ff7a1c' : model.blueSeconds ? '#2a52c9' : model.whiteSeconds ? '#f2f0ea'
        : model.racing ? '#e0262b' : model.sport ? '#d23a2c' : lightDial ? mat.lo : mat.hi,
      blued: '#22408f',
      shadow: dark ? 'rgba(0,0,0,0.62)' : 'rgba(45,32,20,0.30)',
      bezel: BEZELS[cfg.bezel],
      font: FONTS[cfg.font].css,
    };
  }

  /* ----------------------------------------------------------------- helpers */
  function polar(r, a) { return { x: Math.sin(a) * r, y: -Math.cos(a) * r }; }

  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }

  function ring(ctx, x, y, r1, r2) {
    ctx.beginPath();
    ctx.arc(x, y, r2, 0, TAU);
    ctx.arc(x, y, r1, 0, TAU, true);
  }

  function metalConic(ctx, x, y, mat, rot) {
    const g = ctx.createConicGradient((rot || 0) - Math.PI * 0.75, x, y);
    const s = [mat.hi, mat.mid, mat.lo, mat.mid, mat.hi, mat.mid, mat.lo, mat.mid, mat.hi];
    s.forEach((c, i) => g.addColorStop(i / (s.length - 1), c));
    return g;
  }

  function metalLinear(ctx, x0, y0, x1, y1, mat) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, mat.hi);
    g.addColorStop(0.45, mat.mid);
    g.addColorStop(0.55, mat.lo);
    g.addColorStop(1, mat.mid);
    return g;
  }

  function spacedText(ctx, text, x, y, spacing) {
    const chars = [...text];
    const widths = chars.map((c) => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
    let cx = x - total / 2;
    const align = ctx.textAlign;
    ctx.textAlign = 'left';
    chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += widths[i] + spacing; });
    ctx.textAlign = align;
  }

  let noiseCanvas = null;
  function noisePattern(ctx) {
    if (!noiseCanvas) {
      noiseCanvas = document.createElement('canvas');
      noiseCanvas.width = noiseCanvas.height = 128;
      const n = noiseCanvas.getContext('2d');
      const img = n.createImageData(128, 128);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      n.putImageData(img, 0, 0);
    }
    return ctx.createPattern(noiseCanvas, 'repeat');
  }

  function gearPath(ctx, r, teeth, depth, x, y, rot) {
    x = x || 0; y = y || 0; rot = rot || 0;
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a0 = rot + (i / teeth) * TAU;
      const step = TAU / teeth;
      const pts = [
        [r - depth, a0],
        [r, a0 + step * 0.18],
        [r, a0 + step * 0.48],
        [r - depth, a0 + step * 0.66],
      ];
      pts.forEach(([rr, aa], j) => {
        const px = x + Math.sin(aa) * rr, py = y - Math.cos(aa) * rr;
        if (i === 0 && j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
    }
    ctx.closePath();
  }

  /* ---------------------------------------------------------------- geometry */
  function geometry(model, R, cfg) {
    const Rd = RING_MODELS[model.bezel] ? R * 0.83 : R;
    const g = { R, Rd };
    if (cfg.tourbillon) {
      const ra = Rd * (model.subdials ? 0.235 : model.indices === 'arabic' ? 0.25 : 0.265);
      g.ap = { x: 0, y: Rd * (model.subdials ? 0.47 : 0.43), r: ra };
    }
    if (model.subdials) {
      // running seconds at 9, 30-minute counter at 3, 12-hour counter at 6
      const sr = Rd * 0.2;
      g.subs = [
        { x: -Rd * 0.47, y: 0, r: sr, kind: 'sec' },
        { x: Rd * 0.47, y: 0, r: sr, kind: 'min' },
      ];
      if (!cfg.tourbillon) g.subs.push({ x: 0, y: Rd * 0.47, r: sr, kind: 'hour' });
    } else if (!cfg.tourbillon && !cfg.centralSeconds) {
      g.smallSeconds = { x: 0, y: Rd * 0.45, r: Rd * 0.22 };
    }
    if (model.powerReserve) g.pr = { x: -Rd * 0.42, y: Rd * 0.3, r: Rd * 0.2 };
    return g;
  }

  function blocked(g, p, margin) {
    const hit = (o, k) => o && Math.hypot(p.x - o.x, p.y - o.y) < o.r * (k || 1) + margin;
    if (hit(g.ap, 1.4)) return true;
    if (g.subs && g.subs.some((o) => hit(o))) return true;
    if (hit(g.smallSeconds)) return true;
    if (hit(g.pr)) return true;
    return false;
  }

  /* -------------------------------------------------------------- dial disc */
  // Dial only: a floating disc with a soft shadow. Sports models keep their scale as a flat outer ring.
  const RING_MODELS = { diver: 1, gmt: 1, tachy: 1, compressor: 1 };

  function drawDisc(ctx, R, env, g) {
    ctx.save();
    ctx.shadowColor = env.shadow;
    ctx.shadowBlur = R * 0.12;
    ctx.shadowOffsetY = R * 0.05;
    circle(ctx, 0, 0, R);
    ctx.fillStyle = env.dial.b;
    ctx.fill();
    ctx.restore();
    if (RING_MODELS[env.model.bezel]) drawBezelInsert(ctx, R, env, g);
  }

  function drawDiscEdge(ctx, R, env) {
    circle(ctx, 0, 0, R - R * 0.002);
    ctx.strokeStyle = env.lightDial ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = R * 0.004;
    ctx.stroke();
  }

  function drawBezelInsert(ctx, R, env, g) {
    const { model } = env;
    const r1 = g.Rd, r2 = R;
    const flat = mix(env.dial.b, '#000000', model.bezel === 'compressor' ? 0.25 : 0.4);
    const bz = model.bezel === 'tachy' || model.bezel === 'compressor' ? { top: flat, bottom: flat } : env.bezel;
    // two halves
    for (const [color, a0, a1] of [[bz.top, -Math.PI, 0], [bz.bottom, 0, Math.PI]]) {
      ctx.beginPath();
      ctx.arc(0, 0, r2, a0, a1);
      ctx.arc(0, 0, r1, a1, a0, true);
      ctx.closePath();
      const gr = ctx.createRadialGradient(0, -R * 0.4, r1 * 0.3, 0, 0, r2 * 1.1);
      gr.addColorStop(0, mix(color, '#ffffff', 0.12));
      gr.addColorStop(1, mix(color, '#000000', 0.25));
      ctx.fillStyle = gr;
      ctx.fill();
    }
    const ink = luminance(bz.top) > 0.6 ? '#1a1a1c' : '#efece3';
    const mid = (r1 + r2) / 2;
    const fs = (r2 - r1) * 0.5;
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (model.bezel === 'diver') {
      ctx.font = `600 ${fs}px "Avenir Next","Helvetica Neue",sans-serif`;
      for (let m = 0; m < 60; m++) {
        const a = (m / 60) * TAU;
        ctx.save();
        ctx.rotate(a);
        if (m === 0) {
          // lume pip triangle
          ctx.beginPath();
          ctx.moveTo(0, -mid + fs * 0.55);
          ctx.lineTo(-fs * 0.6, -mid - fs * 0.5);
          ctx.lineTo(fs * 0.6, -mid - fs * 0.5);
          ctx.closePath();
          ctx.fillStyle = env.lume;
          if (env.lumeGlow) { ctx.shadowColor = env.lume; ctx.shadowBlur = R * 0.03; }
          ctx.fill();
        } else if (m % 10 === 0) {
          ctx.fillText(String(m), 0, -mid);
        } else if (m % 5 === 0) {
          ctx.fillRect(-R * 0.012, -mid - fs * 0.45, R * 0.024, fs * 0.9);
        } else if (m < 15) {
          ctx.fillRect(-R * 0.004, -mid - fs * 0.35, R * 0.008, fs * 0.5);
        }
        ctx.restore();
      }
    } else if (model.bezel === 'gmt') {
      ctx.font = `600 ${fs * 0.9}px "Avenir Next","Helvetica Neue",sans-serif`;
      for (let h = 0; h < 24; h++) {
        const a = (h / 24) * TAU;
        ctx.save();
        ctx.rotate(a);
        if (h === 0) {
          ctx.beginPath();
          ctx.moveTo(0, -mid + fs * 0.55);
          ctx.lineTo(-fs * 0.6, -mid - fs * 0.5);
          ctx.lineTo(fs * 0.6, -mid - fs * 0.5);
          ctx.closePath();
          ctx.fill();
        } else if (h % 2 === 0) {
          ctx.fillText(String(h), 0, -mid);
        } else {
          ctx.fillRect(-R * 0.01, -mid - fs * 0.15, R * 0.02, fs * 0.3);
        }
        ctx.restore();
      }
    } else if (model.bezel === 'compressor') {
      // inner rotating scale of a vintage super-compressor diver
      ctx.font = `600 ${fs * 0.75}px Futura,"Avenir Next",sans-serif`;
      for (let m = 0; m < 60; m++) {
        const a = (m / 60) * TAU;
        ctx.save();
        ctx.rotate(a);
        if (m === 0) {
          ctx.fillStyle = '#ff7a1c';
          ctx.beginPath();
          ctx.moveTo(0, -mid + fs * 0.5);
          ctx.lineTo(-fs * 0.55, -mid - fs * 0.45);
          ctx.lineTo(fs * 0.55, -mid - fs * 0.45);
          ctx.closePath();
          ctx.fill();
        } else if (m % 5 === 0) {
          ctx.fillStyle = m <= 15 ? '#ff7a1c' : ink;
          ctx.fillText(String(m), 0, -mid);
        } else {
          ctx.fillStyle = m < 15 ? '#ff7a1c' : ink;
          ctx.fillRect(-R * 0.003, -mid - fs * 0.2, R * 0.006, fs * 0.4);
        }
        ctx.restore();
      }
      circle(ctx, 0, 0, r1);
      ctx.strokeStyle = rgba(ink, 0.3);
      ctx.lineWidth = R * 0.003;
      ctx.stroke();
    } else {
      // tachymeter
      ctx.font = `500 ${fs * 0.62}px "Avenir Next","Helvetica Neue",sans-serif`;
      const vals = [500, 400, 300, 250, 200, 180, 160, 140, 120, 110, 100, 90, 80, 70, 65, 60];
      vals.forEach((v) => {
        const a = (3600 / v / 60) * TAU;
        ctx.save();
        ctx.rotate(a);
        ctx.fillText(String(v), 0, -mid - fs * 0.15);
        ctx.fillRect(-R * 0.003, -r1 - fs * 0.05, R * 0.006, fs * 0.28);
        ctx.restore();
      });
    }
  }

  /* ------------------------------------------------------------ textures */
  // Procedural dial surfaces, shaded per pixel with a key light from the upper left.
  // Rendered once per design/size and cached, so the live loop never pays for them.
  function hash2(x, y) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, oct) {
    let sum = 0, amp = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { sum += amp * vnoise(x * f, y * f); f *= 2.03; amp *= 0.5; }
    return sum;
  }

  const LX = -0.6, LY = -0.8;          // light direction (towards the light), screen space
  const LIGHT_THETA = -Math.PI / 4;    // 10:30, where sunray dials flare

  // Each texture returns [brightness multiplier, additive white sheen] for a point.
  const TEXTURES = {
    snow(u, v, r, th, ctx) {
      // drifting, wind-blown snow: warped ridged noise, lit as a height field
      const h = (x, y) => {
        const w = fbm(x * 0.35, y * 0.35, 2) * 2.2;
        const n = fbm(x + w, y * 1.25 + w, 4);
        return 1 - Math.abs(n * 2 - 1);
      };
      const X = u * 34, Y = v * 34, e = 0.05;
      const h0 = h(X, Y);
      const dx = (h(X + e, Y) - h0) / e, dy = (h(X, Y + e) - h0) / e;
      const lit = (dx * -LX + dy * -LY) * -0.038;
      const spark = hash2(Math.floor(u * ctx.px), Math.floor(v * ctx.px)) > 0.9985 ? 0.25 : 0;
      return [1 + lit + (h0 - 0.5) * 0.05, Math.max(0, lit) * 0.35 + spark];
    },
    birch(u, v, r, th, ctx) {
      // vertical bark: sharp ridged grooves that wander and break, lit from the side
      const h = (x, y) => {
        const warp = (fbm(y * 0.035, x * 0.012, 3) - 0.5) * 14;
        const n = fbm(x + warp, y * 0.025, 4);
        const ridge = 1 - Math.abs(n * 2 - 1);
        return ridge * ridge;
      };
      const X = u * 95, Y = v * 95, e = 0.07;
      const h0 = h(X, Y);
      const dx = (h(X + e, Y) - h0) / e;
      const lit = dx * 0.06;
      const knot = vnoise(X * 0.05, Y * 0.5) > 0.88 ? -0.05 : 0;
      return [0.95 + lit + h0 * 0.1 + knot, Math.max(0, lit) * 0.45];
    },
    sunray(u, v, r, th, ctx) {
      const lines = vnoise((th / TAU) * 1400, r * 3) - 0.5;
      const aniso = Math.pow(Math.abs(Math.cos(th - LIGHT_THETA)), 6);
      const k = ctx.lightDial ? 0.14 : 0.5;
      return [1 + lines * 0.07 - 0.06 + aniso * k * 0.6, aniso * (ctx.lightDial ? 0.08 : 0.16)];
    },
    cocktail(u, v, r, th, ctx) {
      // deep radial grooves of varying length that throw light like cut glass
      const seg = (th / TAU) * 420;
      const id = Math.floor(seg);
      const f = seg - id;
      const len = 0.35 + hash2(id, 7) * 0.65;
      const fade = Math.min(1, Math.max(0, (r - 0.08) / 0.3));
      const groove = r < len ? 0.4 + (Math.sin(f * Math.PI) - 0.4) * fade : 0.4;
      const slope = r < len ? Math.cos(f * Math.PI) * fade : 0;
      const aniso = Math.pow(Math.abs(Math.cos(th - LIGHT_THETA)), 4);
      const side = slope * Math.sin(th - LIGHT_THETA);
      return [0.86 + groove * 0.1 + aniso * 0.45 + side * 0.12, aniso * 0.18 + Math.max(0, side) * 0.08];
    },
    gloss(u, v, r) {
      const d = (u + 0.32) * (u + 0.32) + (v + 0.42) * (v + 0.42);
      return [1 + Math.exp(-d * 4) * 0.25, Math.exp(-d * 9) * 0.05];
    },
    matte(u, v, r, th, ctx) {
      const n = hash2(Math.floor(u * ctx.px * 0.7), Math.floor(v * ctx.px * 0.7)) - 0.5;
      return [1 + n * 0.05 + (fbm(u * 6, v * 6, 2) - 0.5) * 0.04, 0];
    },
    opaline(u, v, r, th, ctx) {
      const n = fbm(u * 160, v * 160, 2) - 0.5;
      const grain = hash2(Math.floor(u * ctx.px), Math.floor(v * ctx.px)) - 0.5;
      return [1 + n * 0.05 + grain * 0.03, 0];
    },
  };

  const textureCache = new Map();
  function dialTexture(kind, dial, sizePx) {
    const px = Math.max(64, Math.min(2048, Math.round(sizePx)));
    const key = `${kind}|${dial.a}|${dial.b}|${px}`;
    if (textureCache.has(key)) return textureCache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d');
    const img = g.createImageData(px, px);
    const data = img.data;
    const A = hexToRgb(dial.a), B = hexToRgb(dial.b);
    const fn = TEXTURES[kind];
    const ctx = { px, lightDial: luminance(dial.a) > 0.5 };
    for (let y = 0; y < px; y++) {
      const v = ((y + 0.5) / px) * 2 - 1;
      for (let x = 0; x < px; x++) {
        const u = ((x + 0.5) / px) * 2 - 1;
        const r = Math.sqrt(u * u + v * v);
        if (r > 1.004) continue;
        const th = Math.atan2(u, -v);
        const t = Math.min(1, Math.pow(r, 1.4));
        const [mul, sheen] = fn(u, v, r, th, ctx);
        const dome = 1 + (u * LX + v * LY) * 0.05;
        const k = mul * dome;
        const o = (y * px + x) * 4;
        for (let ch = 0; ch < 3; ch++) {
          const base = A[ch] + (B[ch] - A[ch]) * t;
          data[o + ch] = base * k + 255 * sheen;
        }
        data[o + 3] = r > 0.996 ? Math.max(0, (1.004 - r) / 0.008) * 255 : 255;
      }
    }
    g.putImageData(img, 0, 0);
    if (textureCache.size > 40) textureCache.delete(textureCache.keys().next().value);
    textureCache.set(key, c);
    return c;
  }

  /* -------------------------------------------------------------------- dial */
  function drawDialBase(ctx, env, g) {
    const { dial, model } = env;
    const Rd = g.Rd;
    ctx.save();
    circle(ctx, 0, 0, Rd);
    ctx.clip();

    const base = ctx.createRadialGradient(-Rd * 0.25, -Rd * 0.35, Rd * 0.05, 0, 0, Rd * 1.05);
    base.addColorStop(0, mix(dial.a, '#ffffff', 0.06));
    base.addColorStop(0.6, dial.a);
    base.addColorStop(1, dial.b);
    ctx.fillStyle = base;
    ctx.fillRect(-Rd, -Rd, Rd * 2, Rd * 2);

    const pattern = model.texture;
    if (TEXTURES[pattern]) {
      const scale = ctx.getTransform().a || 1;
      const tex = dialTexture(pattern, dial, Rd * 2 * scale);
      ctx.drawImage(tex, -Rd, -Rd, Rd * 2, Rd * 2);
    } else if (pattern === 'tapisserie') {
      const cell = Rd / 15;
      const px = Math.max(8, Math.round(cell * (ctx.getTransform().a || 1)));
      const tile = document.createElement('canvas');
      tile.width = tile.height = px;
      const t = tile.getContext('2d');
      t.fillStyle = mix(dial.b, '#000000', 0.25);
      t.fillRect(0, 0, px, px);
      const gap = px * 0.14;
      const lg = t.createLinearGradient(gap, gap, px - gap, px - gap);
      lg.addColorStop(0, mix(dial.a, '#ffffff', 0.18));
      lg.addColorStop(0.5, dial.a);
      lg.addColorStop(1, mix(dial.b, '#000000', 0.1));
      t.fillStyle = lg;
      t.fillRect(gap, gap, px - gap * 2, px - gap * 2);
      t.fillStyle = 'rgba(255,255,255,0.12)';
      t.fillRect(gap * 1.8, gap * 1.8, px - gap * 3.6, px - gap * 3.6);
      const pat = ctx.createPattern(tile, 'repeat');
      const s = cell / px;
      pat.setTransform(new DOMMatrix().translate(-cell / 2, -cell / 2).scale(s, s));
      ctx.fillStyle = pat;
      ctx.fillRect(-Rd, -Rd, Rd * 2, Rd * 2);
      const v = ctx.createRadialGradient(-Rd * 0.3, -Rd * 0.4, 0, 0, 0, Rd);
      v.addColorStop(0, 'rgba(255,255,255,0.10)');
      v.addColorStop(1, 'rgba(0,0,0,0.18)');
      ctx.fillStyle = v;
      ctx.fillRect(-Rd, -Rd, Rd * 2, Rd * 2);
    } else if (pattern === 'guilloche') {
      const rr = Rd * 0.79;
      ctx.save();
      circle(ctx, 0, 0, rr);
      ctx.clip();
      ctx.lineWidth = Rd * 0.0022;
      ctx.strokeStyle = env.lightDial ? 'rgba(0,0,0,0.13)' : 'rgba(255,255,255,0.10)';
      const n = 150;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        circle(ctx, Math.cos(a) * rr * 0.5, Math.sin(a) * rr * 0.5, rr * 0.5);
        ctx.stroke();
      }
      ctx.strokeStyle = env.lightDial ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.05)';
      for (let i = 0; i < n; i++) {
        const a = (i / n + 0.5 / n) * TAU;
        circle(ctx, Math.cos(a) * rr * 0.5, Math.sin(a) * rr * 0.5, rr * 0.5);
        ctx.stroke();
      }
      ctx.restore();
      // chapter ring: smooth with fine circles
      ring(ctx, 0, 0, rr, Rd);
      ctx.fillStyle = rgba(dial.a, 0.85);
      ctx.fill('evenodd');
      ctx.strokeStyle = rgba(dial.ink, 0.25);
      ctx.lineWidth = Rd * 0.003;
      circle(ctx, 0, 0, rr); ctx.stroke();
    } else if (pattern === 'skeleton') {
      drawSkeletonMovement(ctx, env, g);
    }
    ctx.restore();
  }

  function perlage(ctx, x, y, w, h, size, color) {
    const step = size * 0.72;
    for (let yy = y; yy < y + h + step; yy += step) {
      for (let xx = x + ((Math.round((yy - y) / step) % 2) * step) / 2; xx < x + w + step; xx += step) {
        const c = ctx.createConicGradient(Math.random() * TAU, xx, yy);
        c.addColorStop(0, mix(color, '#ffffff', 0.18));
        c.addColorStop(0.25, mix(color, '#000000', 0.08));
        c.addColorStop(0.5, mix(color, '#ffffff', 0.12));
        c.addColorStop(0.75, mix(color, '#000000', 0.1));
        c.addColorStop(1, mix(color, '#ffffff', 0.18));
        circle(ctx, xx, yy, size / 2);
        ctx.fillStyle = c;
        ctx.fill();
      }
    }
  }

  function drawSkeletonMovement(ctx, env, g) {
    const { dial, mat } = env;
    const Rd = g.Rd;
    const plate = mix(dial.b, '#000000', 0.45);
    ctx.fillStyle = plate;
    ctx.fillRect(-Rd, -Rd, Rd * 2, Rd * 2);
    // deep openings
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    for (const [x, y, r] of [[-0.35, -0.2, 0.3], [0.38, -0.15, 0.26], [0, 0.05, 0.22], [-0.3, 0.42, 0.2], [0.33, 0.45, 0.2]]) {
      circle(ctx, x * Rd, y * Rd, r * Rd); ctx.fill();
    }
    const brass = '#c9a45c';
    const gear = (x, y, r, teeth, spokes, color) => {
      ctx.save();
      gearPath(ctx, r, teeth, r * 0.08, x, y, 0.1);
      ctx.fillStyle = metalConic(ctx, x, y, { hi: mix(color, '#fff', 0.45), mid: color, lo: mix(color, '#000', 0.45) });
      ctx.fill();
      // cut-outs between spokes
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      for (let i = 0; i < spokes; i++) {
        const a0 = (i / spokes) * TAU + 0.18, a1 = ((i + 1) / spokes) * TAU - 0.18;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.78, a0, a1);
        ctx.arc(x, y, r * 0.24, a1, a0, true);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      circle(ctx, x, y, r * 0.09);
      ctx.fillStyle = '#9b1b30';
      ctx.fill();
    };
    gear(-0.35 * Rd, -0.2 * Rd, 0.3 * Rd, 60, 5, brass);   // barrel
    gear(0.38 * Rd, -0.15 * Rd, 0.24 * Rd, 48, 4, brass);  // centre/third wheel
    gear(0, 0.05 * Rd, 0.19 * Rd, 40, 4, mix(brass, '#b0b4ba', 0.5));
    gear(-0.3 * Rd, 0.42 * Rd, 0.17 * Rd, 36, 4, brass);
    gear(0.33 * Rd, 0.45 * Rd, 0.17 * Rd, 36, 4, brass);
    // bridges with côtes and bevels
    const bridge = (pts, w) => {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * Rd, y * Rd) : ctx.moveTo(x * Rd, y * Rd)));
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = Rd * 0.03;
      ctx.shadowOffsetY = Rd * 0.015;
      ctx.lineWidth = w * Rd;
      ctx.strokeStyle = metalLinear(ctx, -Rd, -Rd, Rd, Rd, mat);
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = w * Rd * 0.7;
      ctx.strokeStyle = rgba(mat.hi, 0.18);
      ctx.stroke();
      ctx.restore();
      pts.forEach(([x, y]) => {
        circle(ctx, x * Rd, y * Rd, Rd * 0.03);
        ctx.fillStyle = env.blued; ctx.fill();
      });
    };
    bridge([[-0.78, -0.42], [-0.35, -0.2]], 0.05);
    bridge([[0.75, -0.42], [0.38, -0.15], [0, 0.05]], 0.045);
    bridge([[-0.72, 0.48], [-0.3, 0.42]], 0.04);
    bridge([[0.72, 0.48], [0.33, 0.45]], 0.04);
    // chapter ring
    ring(ctx, 0, 0, Rd * 0.8, Rd);
    const cr = ctx.createRadialGradient(0, 0, Rd * 0.8, 0, 0, Rd);
    cr.addColorStop(0, dial.a);
    cr.addColorStop(1, dial.b);
    ctx.fillStyle = cr;
    ctx.fill('evenodd');
    circle(ctx, 0, 0, Rd * 0.8);
    ctx.strokeStyle = rgba(mat.hi, 0.7);
    ctx.lineWidth = Rd * 0.012;
    ctx.stroke();
  }

  function drawMinuteTrack(ctx, env, g) {
    const { dial, model } = env;
    const Rd = g.Rd;
    ctx.save();
    ctx.strokeStyle = rgba(dial.ink, 0.75);
    ctx.fillStyle = rgba(dial.ink, 0.85);
    if (model.indices === 'roman' || model.indices === 'chapter') {
      // pearled minute ring
      const r = Rd * 0.94;
      for (let i = 0; i < 60; i++) {
        const p = polar(r, (i / 60) * TAU);
        circle(ctx, p.x, p.y, i % 5 === 0 ? Rd * 0.011 : Rd * 0.006);
        ctx.fill();
      }
      ctx.lineWidth = Rd * 0.003;
      circle(ctx, 0, 0, Rd * 0.965); ctx.stroke();
      circle(ctx, 0, 0, Rd * 0.915); ctx.stroke();
    } else {
      const r2 = Rd * 0.975;
      const railway = model.indices === 'baton' && !model.sport;
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * TAU;
        const major = i % 5 === 0;
        const len = major ? Rd * 0.05 : Rd * 0.03;
        ctx.lineWidth = major ? Rd * 0.008 : Rd * 0.0045;
        const p0 = polar(r2 - len, a), p1 = polar(r2, a);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      }
      if (railway) {
        ctx.lineWidth = Rd * 0.003;
        circle(ctx, 0, 0, r2); ctx.stroke();
        circle(ctx, 0, 0, r2 - Rd * 0.03); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function appliedBar(ctx, env, x0, y0, w, h, lume) {
    const { mat } = env;
    ctx.save();
    ctx.shadowColor = env.dark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = w * 0.6;
    ctx.shadowOffsetX = w * 0.15;
    ctx.shadowOffsetY = w * 0.3;
    ctx.beginPath();
    ctx.roundRect(x0, y0, w, h, w * 0.08);
    ctx.fillStyle = mat.mid;
    ctx.fill();
    ctx.restore();
    // two polished facets meeting on a ridge, the left one catching the key light
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x0, y0, w, h, w * 0.08);
    ctx.clip();
    const lg = ctx.createLinearGradient(x0, y0, x0 + w * 0.5, y0 + h);
    lg.addColorStop(0, mat.hi);
    lg.addColorStop(1, mix(mat.hi, mat.mid, 0.5));
    ctx.fillStyle = lg;
    ctx.fillRect(x0, y0, w / 2, h);
    const rg = ctx.createLinearGradient(x0 + w, y0, x0 + w * 0.5, y0 + h);
    rg.addColorStop(0, mat.lo);
    rg.addColorStop(1, mix(mat.lo, mat.mid, 0.4));
    ctx.fillStyle = rg;
    ctx.fillRect(x0 + w / 2, y0, w / 2, h);
    ctx.fillStyle = rgba('#ffffff', env.dark ? 0.35 : 0.7);
    ctx.fillRect(x0 + w / 2 - w * 0.03, y0, w * 0.06, h);
    ctx.fillStyle = rgba('#ffffff', 0.5);
    ctx.fillRect(x0, y0, w, Math.max(0.5, w * 0.08));
    ctx.restore();
    if (lume) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x0 + w * 0.25, y0 + w * 0.25, w * 0.5, h - w * 0.5, w * 0.1);
      ctx.fillStyle = env.lume;
      if (env.lumeGlow) { ctx.shadowColor = env.lume; ctx.shadowBlur = w * 1.2; }
      ctx.fill();
      ctx.restore();
    }
  }

  function drawIndices(ctx, env, g) {
    const { model, dial, mat } = env;
    const Rd = g.Rd;
    const margin = Rd * 0.06;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * TAU;
      const style = model.indices;
      if (style === 'baton' || style === 'faceted' || style === 'sport') {
        const faceted = style === 'faceted';
        const r1 = Rd * (model.subdials ? 0.83 : faceted ? 0.74 : 0.78), r2 = Rd * 0.91;
        const mid = polar((r1 + r2) / 2, a);
        if (blocked(g, mid, margin)) continue;
        if (model.dateAt === 3 && env.cfg.date && h === 3) continue;
        if (style === 'sport' && h % 3 === 0) {
          const p = polar(Rd * 0.8, a);
          ctx.save();
          ctx.fillStyle = dial.ink;
          ctx.font = `700 ${Rd * 0.13}px Futura,"Avenir Next",sans-serif`;
          ctx.fillText(String(h === 0 ? 12 : h), p.x, p.y + Rd * 0.008);
          ctx.restore();
          continue;
        }
        const w = Rd * (faceted ? (h === 0 ? 0.042 : 0.05) : h === 0 ? 0.03 : 0.034);
        ctx.save();
        ctx.rotate(a);
        if (h === 0) {
          appliedBar(ctx, env, -w * 1.35, -r2, w, r2 - r1, model.sport);
          appliedBar(ctx, env, w * 0.35, -r2, w, r2 - r1, model.sport);
        } else {
          appliedBar(ctx, env, -w / 2, -r2, w, r2 - r1, model.sport);
        }
        ctx.restore();
      } else if (style === 'dots' || style === 'bigdots') {
        const big = style === 'bigdots' ? 1.45 : 1;
        const r = Rd * (big > 1 ? 0.8 : 0.83);
        const p = polar(r, a);
        if (blocked(g, p, margin)) continue;
        if (env.cfg.date && h === 3) continue;
        ctx.save();
        ctx.rotate(a);
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = Rd * 0.02;
        ctx.shadowOffsetY = Rd * 0.01;
        ctx.fillStyle = metalConic(ctx, 0, -r, mat);
        const lume = () => {
          ctx.fillStyle = env.lume;
          if (env.lumeGlow) { ctx.shadowColor = env.lume; ctx.shadowBlur = Rd * 0.05; ctx.shadowOffsetY = 0; }
          else { ctx.shadowColor = 'transparent'; }
          ctx.fill();
        };
        if (h === 0) {
          const s = Rd * 0.085;
          ctx.beginPath();
          ctx.moveTo(0, -r + s * 0.75); ctx.lineTo(-s * 0.7, -r - s * 0.6); ctx.lineTo(s * 0.7, -r - s * 0.6); ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(0, -r + s * 0.5); ctx.lineTo(-s * 0.5, -r - s * 0.45); ctx.lineTo(s * 0.5, -r - s * 0.45); ctx.closePath();
          lume();
        } else if (h % 3 === 0) {
          const bw = big > 1 ? 1.5 : 1;
          ctx.beginPath(); ctx.roundRect(-Rd * 0.03 * bw, -r - Rd * 0.08, Rd * 0.06 * bw, Rd * 0.16, Rd * 0.008); ctx.fill();
          ctx.beginPath(); ctx.roundRect(-Rd * 0.019 * bw, -r - Rd * 0.068, Rd * 0.038 * bw, Rd * 0.136, Rd * 0.005); lume();
        } else {
          circle(ctx, 0, -r, Rd * 0.052 * big); ctx.fill();
          circle(ctx, 0, -r, Rd * 0.04 * big); lume();
        }
        ctx.restore();
      } else if (style === 'roman' || style === 'chapter') {
        const numerals = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
        const r = Rd * (style === 'roman' ? 0.855 : 0.885);
        const p = polar(r, a);
        if (blocked(g, p, margin * 0.5)) continue;
        ctx.save();
        ctx.rotate(a);
        ctx.fillStyle = dial.ink;
        ctx.font = `400 ${Rd * (style === 'roman' ? 0.1 : 0.085)}px ${FONTS.didot.css}`;
        ctx.fillText(numerals[h], 0, -r);
        ctx.restore();
      } else if (style === 'arabic') {
        const r = Rd * 0.78;
        const p = polar(r, a);
        if (h === 0) {
          // triangle with two dots
          ctx.save();
          ctx.fillStyle = dial.ink;
          const s = Rd * 0.07;
          ctx.beginPath();
          ctx.moveTo(0, -r + s * 0.9); ctx.lineTo(-s * 0.8, -r - s * 0.5); ctx.lineTo(s * 0.8, -r - s * 0.5); ctx.closePath();
          ctx.fill();
          circle(ctx, -s * 1.3, -r - s * 0.6, s * 0.18); ctx.fill();
          circle(ctx, s * 1.3, -r - s * 0.6, s * 0.18); ctx.fill();
          ctx.restore();
          continue;
        }
        if (blocked(g, p, margin)) continue;
        ctx.fillStyle = env.lumeGlow ? env.lume : dial.ink;
        ctx.save();
        if (env.lumeGlow) { ctx.shadowColor = env.lume; ctx.shadowBlur = Rd * 0.04; }
        ctx.font = `700 ${Rd * 0.16}px "DIN Alternate","Avenir Next",sans-serif`;
        ctx.fillText(String(h), p.x, p.y + Rd * 0.008);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function drawWordmark(ctx, env, g) {
    const { cfg, dial } = env;
    const Rd = g.Rd;
    const y = env.model.indices === 'arabic' ? -Rd * 0.42 : env.model.subdials ? -Rd * 0.42 : -Rd * 0.46;
    ctx.save();
    ctx.fillStyle = dial.ink;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    if (cfg.wordmark) {
      ctx.font = `400 ${Rd * 0.085}px ${env.font}`;
      spacedText(ctx, cfg.wordmark, 0, y, Rd * 0.018);
    }
    if (cfg.subline) {
      ctx.globalAlpha = 0.75;
      ctx.font = `italic 400 ${Rd * 0.05}px ${env.font}`;
      spacedText(ctx, cfg.subline, 0, y + Rd * 0.085, Rd * 0.004);
    }
    ctx.restore();
  }

  const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  function dateGeometry(env, g) {
    const { cfg, model } = env;
    if (!cfg.date || !model.dateAt || model.subdials) return null;
    const Rd = g.Rd;
    const day = !!model.dayDate;
    const w = Rd * (day ? 0.3 : 0.15), h = Rd * 0.11;
    const x = Rd * (model.indices === 'dots' || model.indices === 'bigdots' ? 0.66 : 0.64) - (day ? Rd * 0.07 : 0);
    return { x, w, h, day };
  }

  function drawDate(ctx, env, g) {
    const { dial, mat } = env;
    const d = dateGeometry(env, g);
    if (!d) return;
    const Rd = g.Rd;
    const { x, w, h } = d;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x - w / 2 - Rd * 0.012, -h / 2 - Rd * 0.012, w + Rd * 0.024, h + Rd * 0.024, Rd * 0.01);
    ctx.fillStyle = metalLinear(ctx, x - w, -h, x + w, h, mat);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x - w / 2, -h / 2, w, h, Rd * 0.006);
    const disc = env.lightDial || env.model.sport ? '#f9f8f4' : mix(dial.b, '#000000', 0.2);
    const ig = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    ig.addColorStop(0, mix(disc, '#000000', 0.22));
    ig.addColorStop(0.28, disc);
    ig.addColorStop(1, disc);
    ctx.fillStyle = ig;
    ctx.fill();
    const ink = luminance(disc) > 0.5 ? '#141416' : '#f4f2ec';
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${h * 0.72}px "Helvetica Neue","Avenir Next",sans-serif`;
    if (d.day) {
      const dow = env.date.getDay();
      ctx.fillStyle = dow === 0 ? '#c8202c' : ink;
      ctx.fillText(DAYS[dow], x - w * 0.18, h * 0.04);
      ctx.fillStyle = ink;
      ctx.fillRect(x + w * 0.12, -h * 0.5, Rd * 0.004, h);
      ctx.fillText(String(env.date.getDate()), x + w * 0.31, h * 0.04);
    } else {
      ctx.fillText(String(env.date.getDate()), x, h * 0.04);
    }
    ctx.restore();
  }

  // The magnifier sits on the crystal, so it is drawn on the glass layer, above the hands.
  function drawCyclops(ctx, env, g) {
    const d = dateGeometry(env, g);
    if (!d || !env.model.cyclops || d.day) return;
    const Rd = g.Rd;
    const lw = Rd * 0.2, lh = Rd * 0.16;
    const x = d.x;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x - lw / 2, -lh / 2, lw, lh, Rd * 0.035);
    ctx.save();
    ctx.clip();
    // magnified date: 2.5x
    ctx.fillStyle = env.lightDial || env.model.sport ? '#f9f8f4' : mix(env.dial.b, '#000000', 0.2);
    ctx.fillRect(x - lw / 2, -lh / 2, lw, lh);
    ctx.fillStyle = luminance(ctx.fillStyle) > 0.5 ? '#141416' : '#f4f2ec';
    ctx.font = `600 ${d.h * 0.72 * 2.1}px "Helvetica Neue","Avenir Next",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(env.date.getDate()), x, d.h * 0.1);
    const lens = ctx.createLinearGradient(x - lw / 2, -lh / 2, x + lw / 2, lh / 2);
    lens.addColorStop(0, 'rgba(255,255,255,0.35)');
    lens.addColorStop(0.35, 'rgba(255,255,255,0)');
    lens.addColorStop(0.8, 'rgba(120,140,200,0.10)');
    lens.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = lens;
    ctx.fillRect(x - lw / 2, -lh / 2, lw, lh);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Rd * 0.006;
    ctx.stroke();
    ctx.restore();
  }

  function drawPowerReserve(ctx, env, g) {
    const pr = g.pr;
    if (!pr) return;
    const { dial } = env;
    ctx.save();
    ctx.translate(pr.x, pr.y);
    ctx.strokeStyle = rgba(dial.ink, 0.8);
    ctx.fillStyle = rgba(dial.ink, 0.85);
    const a0 = -Math.PI * 0.32, a1 = Math.PI * 0.32;
    for (let i = 0; i <= 12; i++) {
      const a = a0 + ((a1 - a0) * i) / 12;
      const major = i % 6 === 0;
      ctx.lineWidth = pr.r * (major ? 0.035 : 0.018);
      const p0 = polar(pr.r * (major ? 0.78 : 0.86), a), p1 = polar(pr.r, a);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `500 ${pr.r * 0.16}px "Avenir Next","Helvetica Neue",sans-serif`;
    const lo = polar(pr.r * 1.18, a0), hi = polar(pr.r * 1.18, a1);
    ctx.fillText('0', lo.x, lo.y);
    ctx.fillText('72', hi.x, hi.y);
    ctx.font = `600 ${pr.r * 0.13}px "Avenir Next","Helvetica Neue",sans-serif`;
    spacedText(ctx, 'POWER RESERVE', 0, pr.r * 0.32, pr.r * 0.02);
    ctx.restore();
  }

  function drawSubdial(ctx, env, s) {
    const { dial } = env;
    ctx.save();
    ctx.translate(s.x, s.y);
    const sub = dial.sub;
    const ink = luminance(sub) > 0.5 ? '#151517' : '#f1efe9';
    circle(ctx, 0, 0, s.r);
    const sg = ctx.createRadialGradient(0, -s.r * 0.3, 0, 0, 0, s.r);
    sg.addColorStop(0, mix(sub, '#ffffff', 0.05));
    sg.addColorStop(1, mix(sub, '#000000', 0.12));
    ctx.fillStyle = sg;
    ctx.fill();
    // azurage
    ctx.strokeStyle = luminance(sub) > 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)';
    ctx.lineWidth = s.r * 0.012;
    for (let r = s.r * 0.12; r < s.r * 0.95; r += s.r * 0.045) { circle(ctx, 0, 0, r); ctx.stroke(); }
    // recess ring
    circle(ctx, 0, 0, s.r);
    ctx.strokeStyle = env.lightDial ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.18)';
    ctx.lineWidth = s.r * 0.03;
    ctx.stroke();
    // ticks + numbers
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    if (env.model.racing) {
      ring(ctx, 0, 0, s.r * 0.93, s.r);
      ctx.fillStyle = s.kind === 'min' ? '#e0262b' : s.kind === 'sec' ? '#f2f0ea' : '#1f3d8a';
      ctx.fill('evenodd');
    }
    const n = s.kind === '24h' ? 24 : s.kind === 'min' ? 30 : s.kind === 'hour' ? 12 : 60;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const major = s.kind === '24h' ? i % 6 === 0 : s.kind === 'min' ? i % 5 === 0 : s.kind === 'hour' ? i % 3 === 0 : i % 10 === 0;
      const p0 = polar(s.r * (major ? 0.78 : 0.85), a), p1 = polar(s.r * 0.94, a);
      ctx.lineWidth = s.r * (major ? 0.03 : 0.016);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    ctx.font = `600 ${s.r * 0.2}px "Avenir Next","Helvetica Neue",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labels = s.kind === '24h' ? [[24, 0], [6, 0.25], [12, 0.5], [18, 0.75]]
      : s.kind === 'min' ? [[30, 0], [10, 1 / 3], [20, 2 / 3]]
        : s.kind === 'hour' ? [[12, 0], [3, 0.25], [6, 0.5], [9, 0.75]] : [[60, 0], [20, 1 / 3], [40, 2 / 3]];
    labels.forEach(([t, f]) => { const p = polar(s.r * 0.58, f * TAU); ctx.fillText(String(t), p.x, p.y); });
    ctx.restore();
  }

  /* -------------------------------------------------------------- tourbillon */
  function drawApertureStatic(ctx, env, g) {
    const { dial, mat } = env;
    const ap = g.ap;
    const ra = ap.r;
    ctx.save();
    ctx.translate(ap.x, ap.y);

    // seconds scale printed around the aperture (skip under the bridge feet)
    ctx.strokeStyle = rgba(dial.ink, 0.7);
    const feet = env.cfg.tourbillonBridge ? [Math.PI * 0.68, Math.PI * 1.32] : [];
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TAU;
      if (feet.some((f) => Math.abs(((a - f + Math.PI * 3) % TAU) - Math.PI) < 0.22)) continue;
      const major = i % 5 === 0;
      ctx.lineWidth = ra * (major ? 0.022 : 0.011);
      const p0 = polar(ra * 1.11, a), p1 = polar(ra * (major ? 1.22 : 1.17), a);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }

    // recess: movement plate with perlage
    ctx.save();
    circle(ctx, 0, 0, ra);
    ctx.clip();
    const plate = env.lightDial ? '#9ca0a6' : '#3a3c40';
    ctx.fillStyle = plate;
    ctx.fillRect(-ra, -ra, ra * 2, ra * 2);
    perlage(ctx, -ra, -ra, ra * 2, ra * 2, ra * 0.34, plate);
    // fixed seconds wheel (internal teeth)
    const brass = '#c8a35a';
    ctx.beginPath();
    ctx.arc(0, 0, ra * 0.99, 0, TAU);
    gearPath(ctx, ra * 0.9, 72, -ra * 0.04, 0, 0, 0);
    ctx.fillStyle = metalConic(ctx, 0, 0, { hi: '#fbe7b5', mid: brass, lo: '#7d6128' });
    ctx.fill('evenodd');
    // depth shading
    const sh = ctx.createRadialGradient(0, 0, ra * 0.6, 0, 0, ra);
    sh.addColorStop(0, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = sh;
    ctx.fillRect(-ra, -ra, ra * 2, ra * 2);
    ctx.restore();

    // polished bevel
    ring(ctx, 0, 0, ra, ra * 1.07);
    ctx.fillStyle = metalConic(ctx, 0, 0, mat, 0.8);
    ctx.fill('evenodd');
    ctx.restore();
  }

  function buildBridge(env, g, scale) {
    if (!g.ap || !env.cfg.tourbillonBridge) return null;
    const ra = g.ap.r;
    const size = ra * 2.8;
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(size * scale);
    const ctx = c.getContext('2d');
    ctx.scale(scale, scale);
    ctx.translate(size / 2, size / 2);
    const { mat } = env;
    const feet = [Math.PI * 0.68, Math.PI * 1.32].map((a) => polar(ra * 1.22, a));
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = ra * 0.12;
    ctx.shadowOffsetY = ra * 0.08;
    ctx.beginPath();
    feet.forEach((f) => {
      const ang = Math.atan2(f.y, f.x);
      const nx = -Math.sin(ang), ny = Math.cos(ang);
      const w0 = ra * 0.075, w1 = ra * 0.13;
      ctx.moveTo(nx * w0, ny * w0);
      ctx.lineTo(f.x + nx * w1, f.y + ny * w1);
      ctx.arc(f.x, f.y, w1, ang + Math.PI / 2, ang - Math.PI / 2, true);
      ctx.lineTo(-nx * w0, -ny * w0);
      ctx.closePath();
    });
    ctx.moveTo(ra * 0.17, 0);
    ctx.arc(0, 0, ra * 0.17, 0, TAU);
    ctx.fillStyle = metalLinear(ctx, -ra, -ra, ra, ra, mat);
    ctx.fill('nonzero');
    ctx.restore();
    // bevel line
    ctx.strokeStyle = rgba(mat.hi, 0.7);
    ctx.lineWidth = ra * 0.012;
    circle(ctx, 0, 0, ra * 0.15); ctx.stroke();
    // chaton + jewel
    circle(ctx, 0, 0, ra * 0.1);
    ctx.fillStyle = metalConic(ctx, 0, 0, { hi: '#fff3cc', mid: '#d8ae57', lo: '#86601f' });
    ctx.fill();
    jewel(ctx, 0, 0, ra * 0.055);
    // blued screws on feet
    feet.forEach((f, i) => screw(ctx, f.x, f.y, ra * 0.07, env.blued, i));
    return { canvas: c, size };
  }

  function jewel(ctx, x, y, r) {
    const jg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.05, x, y, r);
    jg.addColorStop(0, '#ff9aa8');
    jg.addColorStop(0.4, '#c2183a');
    jg.addColorStop(1, '#5a0718');
    circle(ctx, x, y, r);
    ctx.fillStyle = jg;
    ctx.fill();
  }

  function screw(ctx, x, y, r, color, rot) {
    const sg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, 0, x, y, r);
    sg.addColorStop(0, mix(color, '#ffffff', 0.5));
    sg.addColorStop(1, mix(color, '#000000', 0.35));
    circle(ctx, x, y, r);
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0.6);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(-r * 0.8, -r * 0.12, r * 1.6, r * 0.24);
    ctx.restore();
  }

  function drawCage(ctx, env, g, t) {
    const ap = g.ap;
    const ra = ap.r;
    const steel = MATERIALS.steel;
    // 6 beats per second (21,600 vph): the cage advances in tiny steps, one turn per minute.
    const beats = Math.floor(t.ms / (1000 / 6));
    const theta = ((t.secSteps % 60) / 60) * TAU;
    const tSec = t.ms / 1000;
    const balance = 1.45 * Math.PI * Math.sin(TAU * 3 * tSec);
    const pallet = (beats % 2 ? 1 : -1) * 0.13;

    ctx.save();
    ctx.translate(ap.x, ap.y);
    circle(ctx, 0, 0, ra * 0.985);
    ctx.clip();
    ctx.rotate(theta);

    // lower frame ring
    ring(ctx, 0, 0, ra * 0.76, ra * 0.82);
    ctx.fillStyle = metalConic(ctx, 0, 0, steel, -theta);
    ctx.fill('evenodd');

    // escape wheel
    const ex = polar(ra * 0.56, Math.PI * 0.62);
    ctx.save();
    gearPath(ctx, ra * 0.18, 15, ra * 0.06, ex.x, ex.y, -(beats % 30) * (TAU / 30));
    ctx.fillStyle = metalConic(ctx, ex.x, ex.y, steel);
    ctx.fill();
    circle(ctx, ex.x, ex.y, ra * 0.1);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();
    jewel(ctx, ex.x, ex.y, ra * 0.035);
    ctx.restore();

    // pallet fork
    const pv = polar(ra * 0.34, Math.PI * 0.62);
    ctx.save();
    ctx.translate(pv.x, pv.y);
    ctx.rotate(Math.PI * 0.62 + pallet);
    ctx.fillStyle = metalLinear(ctx, -ra * 0.1, 0, ra * 0.1, 0, steel);
    ctx.beginPath();
    ctx.moveTo(-ra * 0.02, ra * 0.12);
    ctx.lineTo(ra * 0.02, ra * 0.12);
    ctx.lineTo(ra * 0.11, -ra * 0.1);
    ctx.lineTo(ra * 0.08, -ra * 0.13);
    ctx.lineTo(0, -ra * 0.03);
    ctx.lineTo(-ra * 0.08, -ra * 0.13);
    ctx.lineTo(-ra * 0.11, -ra * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c2183a';
    ctx.fillRect(-ra * 0.11, -ra * 0.16, ra * 0.03, ra * 0.05);
    ctx.fillRect(ra * 0.08, -ra * 0.16, ra * 0.03, ra * 0.05);
    ctx.restore();

    // balance wheel
    ctx.save();
    ctx.rotate(balance);
    const gold = { hi: '#fff0c4', mid: '#cfa65a', lo: '#7a5a20' };
    ring(ctx, 0, 0, ra * 0.47, ra * 0.54);
    ctx.fillStyle = metalConic(ctx, 0, 0, gold, -balance);
    ctx.fill('evenodd');
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate((i / 3) * TAU);
      ctx.fillStyle = metalLinear(ctx, -ra * 0.03, 0, ra * 0.03, 0, gold);
      ctx.fillRect(-ra * 0.022, -ra * 0.48, ra * 0.044, ra * 0.48);
      ctx.restore();
    }
    for (let i = 0; i < 8; i++) {
      const p = polar(ra * 0.555, (i / 8) * TAU + 0.2);
      circle(ctx, p.x, p.y, ra * 0.03);
      ctx.fillStyle = metalConic(ctx, p.x, p.y, gold);
      ctx.fill();
    }
    ctx.restore();

    // breathing blued hairspring: inner end turns with the balance, outer end is pinned
    ctx.save();
    ctx.beginPath();
    const turns = 7, r0 = ra * 0.07, r1 = ra * 0.36, N = 160;
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      const a = s * turns * TAU + balance * (1 - s) * 0.92;
      const r = r0 + (r1 - r0) * s;
      const x = Math.sin(a) * r, y = -Math.cos(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#4d6fd6';
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = Math.max(0.6, ra * 0.011);
    ctx.stroke();
    ctx.restore();

    // upper cage arms (lyre-shaped, skeletonised)
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate((i / 3) * TAU);
      ctx.beginPath();
      ctx.moveTo(-ra * 0.05, -ra * 0.1);
      ctx.quadraticCurveTo(-ra * 0.13, -ra * 0.5, -ra * 0.09, -ra * 0.82);
      ctx.lineTo(ra * 0.09, -ra * 0.82);
      ctx.quadraticCurveTo(ra * 0.13, -ra * 0.5, ra * 0.05, -ra * 0.1);
      ctx.closePath();
      ctx.moveTo(-ra * 0.03, -ra * 0.25);
      ctx.quadraticCurveTo(-ra * 0.075, -ra * 0.5, -ra * 0.045, -ra * 0.7);
      ctx.lineTo(ra * 0.045, -ra * 0.7);
      ctx.quadraticCurveTo(ra * 0.075, -ra * 0.5, ra * 0.03, -ra * 0.25);
      ctx.closePath();
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = ra * 0.05;
      ctx.shadowOffsetY = ra * 0.03;
      ctx.fillStyle = metalLinear(ctx, -ra * 0.1, 0, ra * 0.1, 0, steel);
      ctx.fill('evenodd');
      ctx.restore();
      const jp = polar(ra * 0.79, (i / 3) * TAU);
      jewel(ctx, jp.x, jp.y, ra * 0.035);
    }
    // seconds pointer on the cage
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-ra * 0.035, -ra * 0.8);
    ctx.lineTo(0, -ra * 0.97);
    ctx.lineTo(ra * 0.035, -ra * 0.8);
    ctx.closePath();
    ctx.fillStyle = env.blued;
    ctx.fill();
    ctx.restore();
    // hub
    circle(ctx, 0, 0, ra * 0.1);
    ctx.fillStyle = metalConic(ctx, 0, 0, steel, -theta);
    ctx.fill();
    jewel(ctx, 0, 0, ra * 0.045);
    ctx.restore();
  }

  /* ------------------------------------------------------------------- hands */
  function handFill(ctx, env, style, L) {
    if (style === 'blued') {
      const g = ctx.createLinearGradient(-L * 0.04, 0, L * 0.04, 0);
      g.addColorStop(0, '#5476d8');
      g.addColorStop(0.5, '#22408f');
      g.addColorStop(1, '#14275e');
      return g;
    }
    if (style === 'ink') return env.dial.ink;
    return metalLinear(ctx, -L * 0.05, 0, L * 0.05, 0, env.mat);
  }

  function drawHand(ctx, env, kind, L, W, angle, depth) {
    const { mat } = env;
    ctx.save();
    ctx.rotate(angle);
    ctx.shadowColor = env.dark ? 'rgba(0,0,0,0.7)' : 'rgba(30,20,10,0.35)';
    ctx.shadowBlur = W * (1 + depth);
    ctx.shadowOffsetX = W * 0.25 * depth;
    ctx.shadowOffsetY = W * 0.45 * depth;
    const lumeFill = () => {
      ctx.save();
      ctx.shadowColor = env.lumeGlow ? env.lume : 'transparent';
      ctx.shadowBlur = env.lumeGlow ? W * 2 : 0;
      ctx.shadowOffsetX = ctx.shadowOffsetY = 0;
      ctx.fillStyle = env.lume;
      ctx.fill();
      ctx.restore();
    };
    switch (kind) {
      case 'dauphine': {
        // faceted: two halves catch the light differently
        ctx.beginPath();
        ctx.moveTo(0, -L); ctx.lineTo(-W / 2, -L * 0.1); ctx.lineTo(0, L * 0.12); ctx.lineTo(W / 2, -L * 0.1); ctx.closePath();
        ctx.fillStyle = mat.mid;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.beginPath();
        ctx.moveTo(0, -L); ctx.lineTo(-W / 2, -L * 0.1); ctx.lineTo(0, L * 0.12); ctx.closePath();
        ctx.fillStyle = mat.hi; ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, -L); ctx.lineTo(W / 2, -L * 0.1); ctx.lineTo(0, L * 0.12); ctx.closePath();
        ctx.fillStyle = mix(mat.lo, mat.mid, 0.3); ctx.fill();
        break;
      }
      case 'faceted': {
        // razor-sharp, mirror-polished: two flat planes meeting on a central ridge
        const half = (side) => {
          ctx.beginPath();
          ctx.moveTo(0, L * 0.14);
          ctx.lineTo(side * W * 0.5, L * 0.1);
          ctx.lineTo(side * W * 0.5, -L * 0.86);
          ctx.lineTo(0, -L);
          ctx.closePath();
        };
        ctx.beginPath();
        ctx.moveTo(-W * 0.5, L * 0.1); ctx.lineTo(-W * 0.5, -L * 0.86); ctx.lineTo(0, -L);
        ctx.lineTo(W * 0.5, -L * 0.86); ctx.lineTo(W * 0.5, L * 0.1); ctx.lineTo(0, L * 0.14); ctx.closePath();
        ctx.fillStyle = mat.mid;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        half(-1);
        const l = ctx.createLinearGradient(0, -L, 0, L * 0.1);
        l.addColorStop(0, mat.hi); l.addColorStop(0.6, mix(mat.hi, mat.mid, 0.3)); l.addColorStop(1, mat.hi);
        ctx.fillStyle = l; ctx.fill();
        half(1);
        const r = ctx.createLinearGradient(0, -L, 0, L * 0.1);
        r.addColorStop(0, mat.lo); r.addColorStop(0.5, mix(mat.lo, mat.mid, 0.5)); r.addColorStop(1, mat.lo);
        ctx.fillStyle = r; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillRect(-W * 0.025, -L * 0.98, W * 0.05, L * 1.1);
        break;
      }
      case 'arrow': {
        // broad arrowhead hour hand with a big lume plate
        ctx.beginPath();
        ctx.moveTo(-W * 0.2, L * 0.15);
        ctx.lineTo(-W * 0.2, -L * 0.55);
        ctx.lineTo(-W * 0.62, -L * 0.6);
        ctx.lineTo(0, -L);
        ctx.lineTo(W * 0.62, -L * 0.6);
        ctx.lineTo(W * 0.2, -L * 0.55);
        ctx.lineTo(W * 0.2, L * 0.15);
        ctx.closePath();
        ctx.fillStyle = handFill(ctx, env, 'metal', L);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, -L * 0.9); ctx.lineTo(-W * 0.44, -L * 0.63); ctx.lineTo(W * 0.44, -L * 0.63); ctx.closePath();
        lumeFill();
        break;
      }
      case 'baton': {
        ctx.beginPath();
        ctx.roundRect(-W / 2, -L, W, L * 1.15, W * 0.15);
        ctx.fillStyle = handFill(ctx, env, 'metal', L);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(-W * 0.26, -L * 0.94, W * 0.52, L * 0.68, W * 0.1);
        lumeFill();
        break;
      }
      case 'sword':
      case 'pilot': {
        ctx.beginPath();
        ctx.moveTo(-W * 0.22, L * 0.12);
        ctx.lineTo(-W * 0.5, -L * 0.72);
        ctx.lineTo(0, -L);
        ctx.lineTo(W * 0.5, -L * 0.72);
        ctx.lineTo(W * 0.22, L * 0.12);
        ctx.closePath();
        ctx.fillStyle = kind === 'pilot' && env.lightDial ? handFill(ctx, env, 'blued', L) : handFill(ctx, env, 'metal', L);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-W * 0.14, -L * 0.18);
        ctx.lineTo(-W * 0.32, -L * 0.7);
        ctx.lineTo(0, -L * 0.91);
        ctx.lineTo(W * 0.32, -L * 0.7);
        ctx.lineTo(W * 0.14, -L * 0.18);
        ctx.closePath();
        lumeFill();
        break;
      }
      case 'breguet': {
        const blued = env.lightDial;
        ctx.fillStyle = handFill(ctx, env, blued ? 'blued' : 'metal', L);
        const pr = W * 0.95, py = -L * (depth > 0.5 ? 0.78 : 0.7);
        ctx.beginPath();
        ctx.moveTo(-W * 0.18, L * 0.18);
        ctx.lineTo(-W * 0.12, py + pr);
        ctx.lineTo(W * 0.12, py + pr);
        ctx.lineTo(W * 0.18, L * 0.18);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-W * 0.12, py - pr);
        ctx.lineTo(0, -L);
        ctx.lineTo(W * 0.12, py - pr);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, py, pr, 0, TAU);
        ctx.arc(0, py, pr * 0.62, 0, TAU, true);
        ctx.fill('evenodd');
        break;
      }
      case 'feuille': {
        ctx.beginPath();
        ctx.moveTo(0, L * 0.1);
        ctx.quadraticCurveTo(-W * 0.9, -L * 0.45, 0, -L);
        ctx.quadraticCurveTo(W * 0.9, -L * 0.45, 0, L * 0.1);
        ctx.closePath();
        ctx.fillStyle = handFill(ctx, env, 'metal', L);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.beginPath();
        ctx.moveTo(0, L * 0.1); ctx.quadraticCurveTo(-W * 0.9, -L * 0.45, 0, -L); ctx.closePath();
        ctx.fillStyle = rgba(mat.hi, 0.35);
        ctx.fill();
        break;
      }
      case 'needle':
      case 'lollipop': {
        ctx.fillStyle = env.accent;
        ctx.beginPath();
        ctx.roundRect(-W * 0.5, -L, W, L * 1.25, W * 0.5);
        ctx.fill();
        if (kind === 'lollipop') {
          circle(ctx, 0, -L * 0.72, W * 3.2);
          ctx.fill();
          circle(ctx, 0, -L * 0.72, W * 2.4);
          lumeFill();
        } else {
          circle(ctx, 0, L * 0.2, W * 2);
          ctx.fill();
        }
        break;
      }
      case 'gmt': {
        ctx.fillStyle = env.model.sport ? '#d23a2c' : env.accent;
        ctx.beginPath();
        ctx.roundRect(-W * 0.5, -L * 0.88, W, L * 0.9, W * 0.3);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, -L); ctx.lineTo(-W * 3.2, -L * 0.84); ctx.lineTo(W * 3.2, -L * 0.84); ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, -L * 0.97); ctx.lineTo(-W * 2.1, -L * 0.865); ctx.lineTo(W * 2.1, -L * 0.865); ctx.closePath();
        lumeFill();
        break;
      }
      case 'sub': {
        ctx.fillStyle = luminance(env.dial.sub) > 0.5 ? '#151517' : '#f1efe9';
        ctx.beginPath();
        ctx.roundRect(-W * 0.5, -L, W, L * 1.2, W * 0.5);
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  // Seconds motion: a Spring-Drive glide, a mechanical 6 or 8 beats per second, or a quartz tick
  // that overshoots very slightly before settling.
  const BEATS = { glide: 0, beat6: 6, beat8: 8, tick: 1 };
  function timeParts(now, motion) {
    const ms = now.getHours() * 3600000 + now.getMinutes() * 60000 + now.getSeconds() * 1000 + now.getMilliseconds();
    const secSteps = Math.floor((ms % 60000) / (1000 / 6)) / 6; // tourbillon cage: 6 beats/s
    const beats = BEATS[motion] ?? 6;
    const sub = now.getMilliseconds();
    let frac;
    if (beats === 0) frac = sub / 1000;
    else if (beats === 1) frac = sub < 60 ? Math.sin((sub / 60) * Math.PI) * 0.012 : 0;
    else frac = Math.floor(sub / (1000 / beats)) / beats;
    return { ms, secSteps, h: now.getHours(), m: now.getMinutes(), s: now.getSeconds() + frac };
  }

  function drawHands(ctx, env, g, t) {
    const { model, cfg } = env;
    const Rd = g.Rd;
    const hA = (((t.h % 12) + t.m / 60 + t.s / 3600) / 12) * TAU;
    const mA = ((t.m + t.s / 60) / 60) * TAU;
    const sA = (t.s / 60) * TAU;

    // sub-dial hands
    (g.subs || []).forEach((s) => {
      ctx.save();
      ctx.translate(s.x, s.y);
      const a = s.kind === '24h' ? ((t.h + t.m / 60) / 24) * TAU : s.kind === 'min' ? (((t.m % 30) + t.s / 60) / 30) * TAU
        : s.kind === 'hour' ? (((t.h % 12) + t.m / 60) / 12) * TAU : sA;
      drawHand(ctx, env, 'sub', s.r * 0.85, s.r * 0.07, a, 0.3);
      circle(ctx, 0, 0, s.r * 0.08);
      ctx.fillStyle = metalConic(ctx, 0, 0, env.mat);
      ctx.fill();
      ctx.restore();
    });
    if (g.smallSeconds) {
      const s = g.smallSeconds;
      ctx.save();
      ctx.translate(s.x, s.y);
      drawHand(ctx, env, 'sub', s.r * 0.85, s.r * 0.06, sA, 0.3);
      circle(ctx, 0, 0, s.r * 0.07);
      ctx.fillStyle = metalConic(ctx, 0, 0, env.mat);
      ctx.fill();
      ctx.restore();
    }

    if (g.pr) {
      const hoursSinceWind = (t.h + 24 - 7) % 24 + t.m / 60;
      const reserve = Math.max(0, 1 - hoursSinceWind / 72);
      const a = -Math.PI * 0.32 + reserve * Math.PI * 0.64;
      ctx.save();
      ctx.translate(g.pr.x, g.pr.y);
      drawHand(ctx, env, 'sub', g.pr.r * 0.82, g.pr.r * 0.05, a, 0.3);
      circle(ctx, 0, 0, g.pr.r * 0.08);
      ctx.fillStyle = metalConic(ctx, 0, 0, env.mat);
      ctx.fill();
      ctx.restore();
    }
    const kind = model.hands;
    const widths = { dauphine: [0.085, 0.07], baton: [0.06, 0.045], sword: [0.085, 0.065], pilot: [0.1, 0.075], breguet: [0.055, 0.045], feuille: [0.085, 0.065], faceted: [0.07, 0.055], arrow: [0.11, 0.07] }[kind];
    if (model.gmt) {
      const gA = ((t.h + t.m / 60) / 24) * TAU;
      drawHand(ctx, env, 'gmt', Rd * 0.9, Rd * 0.016, gA, 0.4);
    }
    drawHand(ctx, env, kind, Rd * 0.56, Rd * widths[0], hA, 0.5);
    drawHand(ctx, env, kind === 'arrow' ? 'sword' : kind, Rd * (model.indices === 'dots' ? 0.86 : 0.84), Rd * widths[1], mA, 0.75);
    const showCentral = model.subdials || cfg.centralSeconds;
    if (showCentral) drawHand(ctx, env, model.secondsHand, Rd * 0.9, Rd * 0.011, sA, 1);
    // cannon pinion cap
    circle(ctx, 0, 0, Rd * 0.035);
    ctx.fillStyle = showCentral ? env.accent : metalConic(ctx, 0, 0, env.mat);
    ctx.fill();
    circle(ctx, 0, 0, Rd * 0.012);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
  }

  /* ------------------------------------------------------------------- glass */
  function drawGlass(ctx, env, g) {
    const Rd = g.Rd;
    ctx.save();
    circle(ctx, 0, 0, Rd * 1.01);
    ctx.clip();
    // rehaut shadow
    const rh = ctx.createRadialGradient(0, 0, Rd * 0.9, 0, 0, Rd * 1.01);
    rh.addColorStop(0, 'rgba(0,0,0,0)');
    rh.addColorStop(1, env.dark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.12)');
    ctx.fillStyle = rh;
    ctx.fillRect(-Rd, -Rd, Rd * 2, Rd * 2);
    // sapphire highlight
    ctx.beginPath();
    ctx.ellipse(-Rd * 0.25, -Rd * 0.45, Rd * 0.85, Rd * 0.42, -0.5, 0, TAU);
    const hl = ctx.createLinearGradient(-Rd, -Rd, Rd * 0.1, Rd * 0.1);
    hl.addColorStop(0, `rgba(255,255,255,${env.dark ? 0.07 : 0.16})`);
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl;
    ctx.fill();
    // anti-reflective bloom
    const ar = ctx.createRadialGradient(Rd * 0.55, Rd * 0.6, 0, Rd * 0.55, Rd * 0.6, Rd * 0.7);
    ar.addColorStop(0, env.dark ? 'rgba(120,110,255,0.06)' : 'rgba(140,130,255,0.05)');
    ar.addColorStop(1, 'rgba(120,110,255,0)');
    ctx.fillStyle = ar;
    ctx.fillRect(-Rd, -Rd, Rd * 2, Rd * 2);
    ctx.restore();
  }

  /* ------------------------------------------------------------ composition */
  function drawStatic(ctx, R, env, g) {
    drawDisc(ctx, R, env, g);
    drawDialBase(ctx, env, g);
    drawMinuteTrack(ctx, env, g);
    drawIndices(ctx, env, g);
    if (g.subs) g.subs.forEach((s) => drawSubdial(ctx, env, s));
    if (g.smallSeconds) drawSubdial(ctx, env, Object.assign({ kind: 'sec' }, g.smallSeconds));
    drawWordmark(ctx, env, g);
    drawDate(ctx, env, g);
    drawPowerReserve(ctx, env, g);
    if (g.ap) drawApertureStatic(ctx, env, g);
  }

  function drawDynamic(ctx, env, g, now, bridge) {
    const t = timeParts(now, env.model.motion);
    if (g.ap) {
      drawCage(ctx, env, g, t);
      if (bridge) {
        ctx.drawImage(bridge.canvas, g.ap.x - bridge.size / 2, g.ap.y - bridge.size / 2, bridge.size, bridge.size);
      }
    }
    drawHands(ctx, env, g, t);
  }

  /* -------------------------------------------------------------- background */
  function drawBackground(ctx, w, h, cfg, dark, cx, cy, R) {
    if (cfg.background === 'none') { ctx.clearRect(0, 0, w, h); return; }
    const base = dark ? cfg.bgDark : cfg.bgLight;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const far = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
    if (cfg.background === 'studio') {
      const gr = ctx.createRadialGradient(cx, cy - R * 0.3, R * 0.2, cx, cy, far);
      gr.addColorStop(0, mix(base, '#ffffff', dark ? 0.07 : 0.35));
      gr.addColorStop(0.55, base);
      gr.addColorStop(1, mix(base, '#000000', dark ? 0.35 : 0.1));
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, w, h);
    } else if (cfg.background === 'spotlight') {
      const gr = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 3.2);
      gr.addColorStop(0, mix(base, '#ffffff', dark ? 0.1 : 0.4));
      gr.addColorStop(1, mix(base, '#000000', dark ? 0.6 : 0.25));
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, w, h);
    }
    // film grain avoids banding on large gradients
    ctx.save();
    ctx.globalAlpha = dark ? 0.035 : 0.025;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = noisePattern(ctx);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function layout(cfg, w, h) {
    const R = (cfg.size * Math.min(w, h)) / 2;
    const cx = cfg.position === 'left' ? w * 0.3 : cfg.position === 'right' ? w * 0.7 : w / 2;
    const cy = h * 0.5;
    return { R, cx, cy };
  }

  /** Render a complete, flat frame (background + watch) into a canvas. Used for snapshots. */
  function composeFrame(canvas, width, height, cfgIn, dark, now) {
    const cfg = normalizeConfig(cfgIn);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const { R, cx, cy } = layout(cfg, width, height);
    drawBackground(ctx, width, height, cfg, dark, cx, cy, R);
    renderWatch(ctx, cx, cy, R, cfg, dark, now);
  }

  /** Draw a watch (no background) centred at cx,cy with case radius R. */
  function renderWatch(ctx, cx, cy, R, cfgIn, dark, now) {
    const cfg = normalizeConfig(cfgIn);
    now = now || new Date();
    const env = makeEnv(cfg, dark, now);
    const g = geometry(env.model, R, cfg);
    const scale = ctx.getTransform().a || 1;
    ctx.save();
    ctx.translate(cx, cy);
    drawStatic(ctx, R, env, g);
    drawDynamic(ctx, env, g, now, buildBridge(env, g, scale * 2));
    drawCyclops(ctx, env, g);
    drawGlass(ctx, env, g);
    drawDiscEdge(ctx, R, env);
    ctx.restore();
  }

  /* ---------------------------------------------------------------- live scene */
  class Scene {
    constructor(host, opts) {
      this.host = host;
      this.opts = Object.assign({ forceDark: null, fixedTime: null, interactive: false }, opts || {});
      this.cfg = normalizeConfig({});
      this.running = false;
      this.paused = false;
      this.lastFrame = 0;
      this.dpr = Math.min(root.devicePixelRatio || 1, 3);
      host.classList.add('tb-scene');
      this.bg = this._canvas('tb-bg');
      this.live = this._canvas('tb-live');
      this.glass = this._canvas('tb-glass');
      this.media = root.matchMedia ? root.matchMedia('(prefers-color-scheme: dark)') : null;
      if (this.media) this.media.addEventListener('change', () => this.invalidate());
      this._ro = new ResizeObserver(() => this.invalidate());
      this._ro.observe(host);
      this._tick = this._tick.bind(this);
      this._dayKey = '';
    }
    _canvas(cls) {
      const c = document.createElement('canvas');
      c.className = cls;
      c.style.position = 'absolute';
      this.host.appendChild(c);
      return c;
    }
    isDark() {
      if (this.opts.forceDark !== null) return this.opts.forceDark;
      if (this.cfg.appearance === 'dark') return true;
      if (this.cfg.appearance === 'light') return false;
      return !!(this.media && this.media.matches);
    }
    setConfig(cfg) {
      this.cfg = normalizeConfig(cfg);
      this.invalidate();
    }
    setForceDark(v) {
      this.opts.forceDark = v;
      this.invalidate();
    }
    invalidate() {
      this._dirty = true;
      if (!this.running) this.start();
    }
    _rebuild() {
      this._dirty = false;
      const w = this.host.clientWidth, h = this.host.clientHeight;
      if (!w || !h) return;
      this.dpr = Math.min(root.devicePixelRatio || 1, 3);
      const dark = this.isDark();
      const now = this._now();
      this._dayKey = now.toDateString();
      const { R, cx, cy } = layout(this.cfg, w, h);
      this.env = makeEnv(this.cfg, dark, now);
      this.geo = geometry(this.env.model, R, this.cfg);
      this.center = { cx, cy, R };
      document.documentElement.style.background = dark ? this.cfg.bgDark : this.cfg.bgLight;

      // background + static watch
      const bg = this.bg;
      bg.style.left = '0px'; bg.style.top = '0px';
      bg.style.width = w + 'px'; bg.style.height = h + 'px';
      bg.width = Math.round(w * this.dpr); bg.height = Math.round(h * this.dpr);
      const b = bg.getContext('2d');
      b.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      drawBackground(b, w, h, this.cfg, dark, cx, cy, R);
      b.save();
      b.translate(cx, cy);
      drawStatic(b, R, this.env, this.geo);
      b.restore();

      // live + glass layers only cover the dial
      const box = this.geo.Rd * 1.05;
      for (const c of [this.live, this.glass]) {
        c.style.left = cx - box + 'px';
        c.style.top = cy - box + 'px';
        c.style.width = c.style.height = box * 2 + 'px';
        c.width = c.height = Math.round(box * 2 * this.dpr);
      }
      this.box = box;
      const gl = this.glass.getContext('2d');
      gl.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      gl.translate(box, box);
      drawCyclops(gl, this.env, this.geo);
      drawGlass(gl, this.env, this.geo);
      if (!RING_MODELS[this.env.model.bezel]) drawDiscEdge(gl, this.center.R, this.env);
      this.bridge = buildBridge(this.env, this.geo, this.dpr * 1.5);
      this._draw(now);
    }
    _now() {
      return this.opts.fixedTime ? new Date(this.opts.fixedTime) : new Date();
    }
    _draw(now) {
      if (!this.env) return;
      const ctx = this.live.getContext('2d');
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.box * 2, this.box * 2);
      ctx.translate(this.box, this.box);
      drawDynamic(ctx, this.env, this.geo, now, this.bridge);
    }
    _tick(ts) {
      if (!this.running) return;
      if (this.paused) { this.running = false; return; }
      const interval = 1000 / this.cfg.fps - 2;
      if (this._dirty) this._rebuild();
      if (ts - this.lastFrame >= interval) {
        this.lastFrame = ts;
        const now = this._now();
        if (now.toDateString() !== this._dayKey) this._rebuild();
        else this._draw(now);
      }
      if (this.opts.fixedTime) { this.running = false; return; }
      requestAnimationFrame(this._tick);
    }
    start() {
      if (this.running) return;
      this.running = true;
      requestAnimationFrame(this._tick);
    }
    pause() { this.paused = true; }
    resume() { this.paused = false; this.start(); }
  }

  root.TourbillonEngine = {
    MODELS, DIALS, MATERIALS, BEZELS, FONTS, DEFAULTS,
    normalizeConfig, composeFrame, renderWatch, Scene, mix,
  };
})(typeof window !== 'undefined' ? window : this);
