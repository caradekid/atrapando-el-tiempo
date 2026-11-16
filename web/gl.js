/*
 * Atrapando el tiempo × CARADEKID — GPU dial surfaces.
 *
 * Renders a dial's surface (texture, relief and lighting) in a fragment shader:
 * procedural height fields lit with a moving key light, anisotropic highlights for
 * brushed sunray finishes, glints in the snow and a softbox reflected in lacquer.
 * The view direction follows a "tilt", so highlights slide as the cursor moves.
 *
 * One offscreen WebGL context is shared by every caller; results are returned as
 * a canvas to drawImage() from. If WebGL is unavailable, `available` is false and
 * the 2D engine keeps its CPU textures.
 */
(function (root) {
  'use strict';

  const KINDS = { snow: 1, birch: 2, sunray: 3, cocktail: 4, waves: 5, gloss: 6, matte: 7, opaline: 8, tapisserie: 9 };

  const VERT = `
    attribute vec2 aPos;
    varying vec2 vUV;
    void main() {
      vUV = vec2(aPos.x, -aPos.y);   // y grows downwards, like the canvas
      gl_Position = vec4(aPos, 0.0, 1.0);
    }`;

  const FRAG = `
    precision highp float;
    varying vec2 vUV;
    uniform int uKind;
    uniform vec3 uA;
    uniform vec3 uB;
    uniform vec2 uLight;      // unit vector towards the light, screen space (y down)
    uniform float uWarm;
    uniform float uPower;
    uniform float uLightDial;
    uniform float uPx;
    uniform vec2 uTilt;       // -1…1, the viewer's offset from straight on

    const float PI = 3.14159265;
    const float TAU = 6.2831853;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }
    float fbm(vec2 p, int oct) {
      float s = 0.0, a = 0.5;
      for (int i = 0; i < 6; i++) {
        if (i >= oct) break;
        s += a * vnoise(p);
        p *= 2.03;
        a *= 0.5;
      }
      return s;
    }

    // ---- height fields (uv in -1…1)
    float hSnow(vec2 uv) {
      float ca = cos(0.55), sa = sin(0.55);
      vec2 p = vec2(uv.x * ca - uv.y * sa, uv.x * sa + uv.y * ca) * vec2(30.0, 58.0);
      float w = fbm(p * 0.3, 2) * 2.4;
      float n = fbm(p + vec2(w, w * 0.6), 5);
      float r = 1.0 - abs(n * 2.0 - 1.0);
      return r * r;
    }
    float hBirch(vec2 uv) {
      vec2 p = uv * 95.0;
      float warp = (fbm(vec2(p.y * 0.035, p.x * 0.012), 3) - 0.5) * 6.0;
      float n = fbm(vec2(p.x + warp, p.y * 0.025), 4);
      float r = 1.0 - abs(n * 2.0 - 1.0);
      return r * r;
    }
    float hWaves(vec2 uv) {
      return 0.5 + 0.5 * sin((uv.y * 13.0 + 0.85 * sin(uv.x * 3.1 + uv.y * 1.4)) * PI);
    }
    float hCocktail(vec2 uv) {
      float r = length(uv);
      float th = atan(uv.x, -uv.y);
      float seg = (th / TAU) * 420.0;
      float id = floor(seg), f = fract(seg);
      float len = 0.35 + hash(vec2(id, 7.0)) * 0.65;
      float fade = clamp((r - 0.08) / 0.3, 0.0, 1.0);
      return r < len ? sin(f * PI) * fade * 0.5 : 0.0;
    }
    float hTapisserie(vec2 uv) {
      vec2 q = fract(uv * 15.0 + 0.5) - 0.5;
      float m = max(abs(q.x), abs(q.y));
      // raised squares with a bevel, separated by deep grooves
      return m > 0.43 ? 0.0 : clamp((0.43 - m) * 2.6, 0.0, 0.42);
    }
    float hMicro(vec2 uv, float scale) {
      return fbm(uv * scale, 2);
    }
    float heightAt(vec2 uv) {
      if (uKind == 1) return hSnow(uv);
      if (uKind == 2) return hBirch(uv);
      if (uKind == 4) return hCocktail(uv);
      if (uKind == 5) return hWaves(uv);
      if (uKind == 9) return hTapisserie(uv);
      if (uKind == 8) return hMicro(uv, 160.0) * 0.4;
      if (uKind == 7) return hMicro(uv, 90.0) * 0.25;
      return 0.0;
    }
    float bumpScale() {
      if (uKind == 1) return 0.0018;
      if (uKind == 2) return 0.002;
      if (uKind == 4) return 0.0016;
      if (uKind == 5) return 0.006;
      if (uKind == 9) return 0.02;
      return 0.002;
    }

    void main() {
      vec2 uv = vUV;
      float r = length(uv);
      if (r > 1.006) { gl_FragColor = vec4(0.0); return; }
      float th = atan(uv.x, -uv.y);

      // surface normal from the height field
      float e = 1.6 / uPx;
      float h0 = heightAt(uv);
      float hx = heightAt(uv + vec2(e, 0.0));
      float hy = heightAt(uv + vec2(0.0, e));
      float k = bumpScale();
      vec3 N = normalize(vec3(-(hx - h0) / e * k, -(hy - h0) / e * k, 1.0));
      // a very slight dome, so broad reflections travel across the dial
      N = normalize(N + vec3(uv * 0.06, 0.0));

      vec3 L = normalize(vec3(uLight * 0.85, 0.62));
      vec3 V = normalize(vec3(-uTilt * 0.9, 1.0));
      vec3 H = normalize(L + V);
      vec3 warmTint = mix(vec3(1.0), vec3(1.0, 0.79, 0.56), uWarm * 0.7);

      vec3 base = mix(uA, uB, min(1.0, pow(r, 1.4)));
      // diffuse relative to a flat dial, so flat areas keep their colour
      float flatL = L.z;
      float shade = 1.0 + (dot(N, L) - flatL) * 0.95;
      shade *= 1.0 + dot(uv, uLight) * 0.05;
      shade *= 0.9 + 0.1 * uPower;
      vec3 col = base * shade;

      float spec = 0.0;
      if (uKind == 3 || uKind == 4) {
        // radially brushed metal: anisotropic (Kajiya-Kay) highlight across the brushing
        vec3 T = vec3(normalize(uv + 1e-5), 0.0);
        float th2 = dot(T, H);
        float s = sqrt(max(0.0, 1.0 - th2 * th2));
        float lines = vnoise(vec2(th / TAU * 1400.0, r * 3.0)) - 0.5;
        float strength = uLightDial > 0.5 ? 0.28 : 0.55;
        spec = pow(s, uKind == 4 ? 40.0 : 70.0) * strength * (1.0 + lines * 0.6) * smoothstep(0.0, 0.25, r);
        col *= 1.0 + lines * 0.06;
        if (uKind == 4) col *= 0.92 + h0 * 0.25;
      } else if (uKind == 6) {
        // lacquer: a mirror that reflects a soft rectangular studio light
        vec3 Nd = normalize(vec3(uv * 0.18, 1.0));
        vec3 Vg = normalize(vec3(-uTilt * 0.15, 1.0));
        vec3 R = reflect(-Vg, Nd);
        // where the window lands, in dial units: towards the light, sliding as the view tilts
        vec2 d = (R.xy - uLight * 0.2) / 0.36;
        vec2 ax = vec2(-uLight.y, uLight.x);
        float along = dot(d, ax), across = dot(d, uLight);
        float box = exp(-(along * along) / 0.06 - (across * across) / 0.004);
        spec = box * (uLightDial > 0.5 ? 0.04 : 0.09) + pow(max(dot(Nd, H), 0.0), 30.0) * 0.06;
      } else {
        float shin = uKind == 1 ? 18.0 : uKind == 9 ? 60.0 : uKind == 5 ? 45.0 : 12.0;
        float ks = uKind == 1 ? 0.12 : uKind == 9 ? 0.35 : uKind == 5 ? 0.45 : uKind == 2 ? 0.18 : 0.05;
        spec = pow(max(dot(N, H), 0.0), shin) * ks;
      }
      if (uKind == 1) {
        // glints: tiny facets in the snow that flash when they face the light, and twinkle with tilt
        vec2 cell = floor(uv * uPx * 0.45);
        float g = hash(cell);
        if (g > 0.993) {
          vec3 n2 = normalize(vec3(hash(cell + 3.1) - 0.5, hash(cell + 7.7) - 0.5, 1.4));
          spec += pow(max(dot(n2, H), 0.0), 220.0) * 1.4;
        }
      }
      if (uKind == 9) {
        col *= 0.55 + h0 * 1.15;                    // grooves between the squares fall into shadow
        col += warmTint * max(dot(N, L) - flatL, 0.0) * 0.32 * uPower;  // bevels catching the light
      }

      col += warmTint * spec * uPower;
      float alpha = clamp((1.004 - r) / 0.008, 0.0, 1.0);
      gl_FragColor = vec4(col * alpha, alpha);
    }`;

  let gl = null, prog = null, canvas = null, loc = {};

  function init() {
    try {
      canvas = document.createElement('canvas');
      gl = canvas.getContext('webgl', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false });
      if (!gl) return false;
      const sh = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const aPos = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      for (const n of ['uKind', 'uA', 'uB', 'uLight', 'uWarm', 'uPower', 'uLightDial', 'uPx', 'uTilt']) loc[n] = gl.getUniformLocation(prog, n);
      return true;
    } catch (e) {
      if (root.console) console.warn('Dial GPU renderer unavailable, using CPU textures:', e && e.message);
      gl = null;
      return false;
    }
  }

  const rgb = (hex) => {
    const n = parseInt(String(hex).replace('#', ''), 16) || 0;
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };

  /**
   * Render a dial surface. Returns the shared canvas (valid until the next call).
   * light: { x, y } unit vector towards the light, warmth 0…1, power 0…1. tilt: { x, y }.
   */
  function render(kind, dial, sizePx, light, tilt) {
    if (!gl || !KINDS[kind]) return null;
    const px = Math.max(64, Math.min(4096, Math.round(sizePx)));
    if (canvas.width !== px) { canvas.width = canvas.height = px; }
    gl.viewport(0, 0, px, px);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const a = rgb(dial.a), b = rgb(dial.b);
    const lum = 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
    gl.uniform1i(loc.uKind, KINDS[kind]);
    gl.uniform3f(loc.uA, a[0], a[1], a[2]);
    gl.uniform3f(loc.uB, b[0], b[1], b[2]);
    gl.uniform2f(loc.uLight, light.x, light.y);
    gl.uniform1f(loc.uWarm, light.warmth || 0);
    gl.uniform1f(loc.uPower, light.power == null ? 1 : light.power);
    gl.uniform1f(loc.uLightDial, lum > 0.5 ? 1 : 0);
    gl.uniform1f(loc.uPx, px);
    gl.uniform2f(loc.uTilt, (tilt && tilt.x) || 0, (tilt && tilt.y) || 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return canvas;
  }

  // ?cpu=1 forces the CPU textures, for comparison and debugging
  const forceCPU = typeof location !== 'undefined' && /[?&]cpu=1/.test(location.search);
  const available = !forceCPU && init();
  root.TourbillonGL = { available, render, kinds: Object.keys(KINDS) };
})(typeof window !== 'undefined' ? window : this);
