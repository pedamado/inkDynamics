// ═══════════════════════════════════════════════════════════════════════════
// INK DYNAMICS — OverprintBlender.js (v4.0)
// How a new stroke meets the paper and the ink already on it: transparency, overprint mixing, capillary micro-swell.
//
// Two models (`overprintModel`):
//
// 'mix' (default since 4.0) — slightly transparent ink that mixes where strokes cross:
//   1. Every colour is laid down at `inkDensity` (default 0.97): what lies beneath — the paper (`paperColor`) or the
//      earlier strokes — shows through (1 − density). The see-through is worked into the colour and the ink is then
//      painted opaque ('source-over'), so the 20–36 overlapping sub-steps of one stroke never build up on themselves
//      (no bands, no darkening inside a stroke) and the result is the same on an opaque canvas or a transparent layer.
//   2. Where the stroke crosses earlier ink it mixes with it like an overprint (multiply, C × U / 255), as far as the
//      blending intensity `overprintDarken` says. The mix comes in quickly once the nib actually meets the ink beneath
//      (`overprintAttack`, `overprintReach`: how much of the nib must be over it) and goes slowly once it has left it
//      (`overprintRelease`): the pigment picked up is carried on along the stroke.
//   3. Every colour behaves the same way — white and very light colours too: black stays black (≈ 3 % of the paper),
//      and a crossing of two blacks is slightly blacker still.
//
// 'classic' (3.9) — the first pass lifted toward a warm white by `inkDensity`, sub-steps composited with 'darken',
//   multiply darkening at crossings, and light inks (luminance > 0.80) painted opaque with 'source-over'.
//   For the 3.9 look: { overprintModel: 'classic', inkDensity: 0.94, overprintDarken: 0.65 } (CLASSIC_39 below).
//
// 'mix' also records running drips in the grid (later strokes overprint them; a drip mixes with the strokes it runs
// over, never with its own).
//
// Both models keep the zero-readback 4 px arc-length-tagged spatial ink grid (an earlier stroke, or an earlier loop of
// the same continuous gaze / boid stroke, is "ink beneath"), and the capillary micro-swell at crossings: each
// instrument passes its own `overprintSwell` (ink that runs and dries fast swells least: ruling pens 5 %, the Zig
// brush 7.5 %, the Posca mop 10 %); this blender's own `overprintSwell` is only the fallback.
// ═══════════════════════════════════════════════════════════════════════════

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

// the 4.0 defaults (the 'mix' model)
export const OVERPRINT_DEFAULTS = Object.freeze({
  overprintModel: 'mix',
  blendMode: 'multiply',
  inkDensity: 0.97,
  overprintDarken: 0.45,
  overprintSwell: 0.08,
  overprintAttack: 0.85,
  overprintRelease: 0.55,
  overprintReach: 0.75,
  paperColor: '#FFFFFF',
});

// accepted ranges (values outside are clamped)
export const OVERPRINT_RANGES = Object.freeze({
  inkDensity: [0.65, 1.0],
  overprintDarken: [0.0, 1.0],
  overprintSwell: [0.0, 0.35],
  overprintAttack: [0.0, 1.0],
  overprintRelease: [0.0, 1.0],
  overprintReach: [0.2, 1.5],
});

// the 3.9 behaviour, in one object (setOverprint(CLASSIC_39))
export const CLASSIC_39 = Object.freeze({ overprintModel: 'classic', inkDensity: 0.94, overprintDarken: 0.65, overprintSwell: 0.08 });

export class OverprintBlender {
  constructor(widthOrOptions = {}, height = 1200, maybeOptions = {}) {
    const options = typeof widthOrOptions === 'number'
      ? { ...maybeOptions, width: widthOrOptions, height }
      : (widthOrOptions || {});
    const D = OVERPRINT_DEFAULTS;
    this._firstCache = new Map();
    this._rgbCache = new Map();

    // 'mix' (4.0) | 'classic' (3.9)
    this.overprintModel = options.overprintModel === 'classic' ? 'classic' : 'mix';

    // 'multiply' (overprint on: mixing / darkening + micro-swell) | 'source-over' (flat 100% opaque)
    this.blendMode = D.blendMode;

    // Ink density [0.65 .. 1.00]: 'mix' — the ink's opacity (0.97: 3 % of what lies beneath shows through);
    // 'classic' — the first-pass saturation (lift toward a warm white)
    this.inkDensity = D.inkDensity;
    // Blending intensity [0 .. 1]: 'mix' — how far a crossing goes toward the overprint (multiply) colour;
    // 'classic' — the multiply darkening boost
    this.overprintDarken = D.overprintDarken;
    // Fallback crossing micro-swell [0 .. 0.35] (each instrument passes its own)
    this.overprintSwell = D.overprintSwell;
    // 'mix': how quickly the mix comes in when the nib meets ink beneath [0 slow .. 1 instant] ...
    this.overprintAttack = D.overprintAttack;
    // ... how quickly the stroke's own colour comes back after it has left the crossing [0 slow .. 1 instant] ...
    this.overprintRelease = D.overprintRelease;
    // ... and how far around the nib's centre ink beneath is looked for (× nib radius)
    this.overprintReach = D.overprintReach;
    this.paper = [255, 255, 255];
    this.paperColor = D.paperColor;
    this.setOverprint(options);

    // Spatial occupancy grid (4px cell resolution for fast O(1) intersection lookup). 4.0: `cellSize` for hosts whose
    // instrument px are not screen px (Inkwell 20 keeps the cells 4 of its surface px), and `wrap` for a surface that is
    // a ring (the 360° canvas: x wraps at the grid's width — the 'mix' model's lookups and stamps)
    this.cellSize = Number(options.cellSize) > 0 ? Number(options.cellSize) : 4;
    this.wrap = !!options.wrap;
    this.gridW = Math.ceil((options.width || 1600) / this.cellSize);
    this.gridH = Math.ceil((options.height || 1200) / this.cellSize);
    const totalCells = this.gridW * this.gridH;

    this.cellStrokeId = new Int32Array(totalCells);
    this.cellArcLen = new Float32Array(totalCells);
    this.cellLayers = new Uint8Array(totalCells);
    this.cellR = new Uint8Array(totalCells);
    this.cellG = new Uint8Array(totalCells);
    this.cellB = new Uint8Array(totalCells);
    this.cellR.fill(255);
    this.cellG.fill(255);
    this.cellB.fill(255);
    this._allocUnder(totalCells);

    this.strokeCounter = 1;

    // Per-agent active stroke tracking
    this.activeStates = new Map();
  }

  // ── Configuration Setters ─────────────────────────────────────────────────

  setBlendMode(mode) {
    if (typeof mode === 'boolean') {
      this.blendMode = mode ? 'multiply' : 'source-over';
    } else if (mode === 'multiply' || mode === 'source-over' || mode === 'normal' || mode === 'off') {
      this.blendMode = (mode === 'normal' || mode === 'off') ? 'source-over' : mode;
    }
    this._firstCache.clear();
  }

  setOverprintModel(model) {
    if (model === 'mix' || model === 'classic') this.overprintModel = model;
    this._firstCache.clear();
  }

  // 4.0: a number that is not a number keeps the current value (3.9: NaN went through and broke every colour)
  setInkDensity(val) {
    this.inkDensity = clamp(finite(val, this.inkDensity), ...OVERPRINT_RANGES.inkDensity);
    this._firstCache.clear();
  }

  setOverprintDarken(val) {
    this.overprintDarken = clamp(finite(val, this.overprintDarken), ...OVERPRINT_RANGES.overprintDarken);
  }

  // the blending intensity — another name for overprintDarken
  setBlendIntensity(val) { this.setOverprintDarken(val); }

  setOverprintSwell(val) {
    this.overprintSwell = clamp(finite(val, this.overprintSwell), ...OVERPRINT_RANGES.overprintSwell);
  }

  setOverprintAttack(val) {
    this.overprintAttack = clamp(finite(val, this.overprintAttack), ...OVERPRINT_RANGES.overprintAttack);
  }

  setOverprintRelease(val) {
    this.overprintRelease = clamp(finite(val, this.overprintRelease), ...OVERPRINT_RANGES.overprintRelease);
  }

  setOverprintReach(val) {
    this.overprintReach = clamp(finite(val, this.overprintReach), ...OVERPRINT_RANGES.overprintReach);
  }

  // the colour of the paper under the ink ('mix': what shows through where there is no ink yet)
  setPaperColor(colorStr) {
    if (!colorStr || typeof colorStr !== 'string') return;
    this.paper = OverprintBlender.parseHex(colorStr);
    this.paperColor = OverprintBlender.rgbToHex(...this.paper);
    this._firstCache.clear();
  }

  setOverprint(opts = {}) {
    if (!opts || typeof opts !== 'object') return;
    if (opts.overprintModel !== undefined) this.setOverprintModel(opts.overprintModel);
    if (opts.blendMode !== undefined) this.setBlendMode(opts.blendMode);
    if (opts.inkDensity !== undefined) this.setInkDensity(opts.inkDensity);
    if (opts.overprintDarken !== undefined) this.setOverprintDarken(opts.overprintDarken);
    if (opts.blendIntensity !== undefined) this.setOverprintDarken(opts.blendIntensity);
    if (opts.overprintSwell !== undefined) this.setOverprintSwell(opts.overprintSwell);
    if (opts.overprintAttack !== undefined) this.setOverprintAttack(opts.overprintAttack);
    if (opts.overprintRelease !== undefined) this.setOverprintRelease(opts.overprintRelease);
    if (opts.overprintReach !== undefined) this.setOverprintReach(opts.overprintReach);
    if (opts.paperColor !== undefined) this.setPaperColor(opts.paperColor);
  }

  getSettings() {
    return {
      overprintModel: this.overprintModel,
      blendMode: this.blendMode,
      inkDensity: this.inkDensity,
      overprintDarken: this.overprintDarken,
      overprintSwell: this.overprintSwell,
      overprintAttack: this.overprintAttack,
      overprintRelease: this.overprintRelease,
      overprintReach: this.overprintReach,
      paperColor: this.paperColor,
    };
  }

  isOverprintEnabled() {
    return this.blendMode === 'multiply';
  }

  get isMix() {
    return this.overprintModel !== 'classic';
  }

  resize(width, height) {
    const newW = Math.max(100, Math.ceil(width / this.cellSize));
    const newH = Math.max(100, Math.ceil(height / this.cellSize));
    if (newW === this.gridW && newH === this.gridH) return;
    this.gridW = newW;
    this.gridH = newH;
    const total = this.gridW * this.gridH;
    this.cellStrokeId = new Int32Array(total);
    this.cellArcLen = new Float32Array(total);
    this.cellLayers = new Uint8Array(total);
    this.cellR = new Uint8Array(total);
    this.cellG = new Uint8Array(total);
    this.cellB = new Uint8Array(total);
    this.cellR.fill(255);
    this.cellG.fill(255);
    this.cellB.fill(255);
    this._allocUnder(total);
  }

  // 'mix': for the cells where a stroke was laid over another's ink — which stroke, and the colour that was beneath —
  // so the stroke still knows it is over that ink while its nib covers it (its own stamp would otherwise hide it)
  _allocUnder(total) {
    this.cellUnder = new Int32Array(total);
    this.cellUR = new Uint8Array(total);
    this.cellUG = new Uint8Array(total);
    this.cellUB = new Uint8Array(total);
  }

  clear() {
    this.cellStrokeId.fill(0);
    this.cellArcLen.fill(0);
    this.cellLayers.fill(0);
    this.cellR.fill(255);
    this.cellG.fill(255);
    this.cellB.fill(255);
    this.cellUnder.fill(0);
    this.activeStates.clear();
  }

  cloneSnapshot() {
    return {
      cellStrokeId: new Int32Array(this.cellStrokeId),
      cellArcLen: new Float32Array(this.cellArcLen),
      cellLayers: new Uint8Array(this.cellLayers),
      cellR: new Uint8Array(this.cellR),
      cellG: new Uint8Array(this.cellG),
      cellB: new Uint8Array(this.cellB),
      cellUnder: new Int32Array(this.cellUnder),
      cellUR: new Uint8Array(this.cellUR),
      cellUG: new Uint8Array(this.cellUG),
      cellUB: new Uint8Array(this.cellUB),
      strokeCounter: this.strokeCounter,
    };
  }

  restoreSnapshot(snap) {
    if (!snap) return;
    if (snap.cellStrokeId.length === this.cellStrokeId.length) {
      this.cellStrokeId.set(snap.cellStrokeId);
      this.cellArcLen.set(snap.cellArcLen);
      this.cellLayers.set(snap.cellLayers);
      this.cellR.set(snap.cellR);
      this.cellG.set(snap.cellG);
      this.cellB.set(snap.cellB);
      if (snap.cellUnder && snap.cellUnder.length === this.cellUnder.length) {
        this.cellUnder.set(snap.cellUnder);
        this.cellUR.set(snap.cellUR);
        this.cellUG.set(snap.cellUG);
        this.cellUB.set(snap.cellUB);
      } else {
        this.cellUnder.fill(0);
      }
      this.strokeCounter = Math.max(this.strokeCounter, snap.strokeCounter);
    }
  }

  /**
   * 4.0: rebuilds the grid over a region from its pixels — for hosts that put pixels back themselves (undo, opening a
   * drawing, another person's layer): every cell whose centre pixel is ink becomes "ink beneath" for the strokes to
   * come (an old stroke), every other cell is emptied.
   * @param {ImageData} img      the region's pixels
   * @param {Object}    opts     x, y: where the region starts (in this grid's units, the instruments' px);
   *                             scale: image px per instrument px; mode: 'alpha' (transparent layers: ink = alpha above
   *                             threshold) or 'paper' (opaque canvases: ink = differs from paperColor)
   */
  rebuildFromImageData(img, { x = 0, y = 0, scale = 1, mode = 'alpha', threshold = 24 } = {}) {
    if (!img || !img.data) return;
    const cs = this.cellSize, w = img.width / scale, h = img.height / scale, P = this.paper;
    const gx0 = Math.max(0, Math.floor(x / cs)), gy0 = Math.max(0, Math.floor(y / cs));
    const gx1 = Math.min(this.gridW, Math.ceil((x + w) / cs)), gy1 = Math.min(this.gridH, Math.ceil((y + h) / cs));
    for (let gy = gy0; gy < gy1; gy++) {
      const py = Math.floor(((gy + 0.5) * cs - y) * scale);
      if (py < 0 || py >= img.height) continue;
      for (let gx = gx0; gx < gx1; gx++) {
        const px = Math.floor(((gx + 0.5) * cs - x) * scale);
        if (px < 0 || px >= img.width) continue;
        const o = (py * img.width + px) * 4, a = img.data[o + 3] / 255;
        const r = img.data[o] * a + P[0] * (1 - a), g = img.data[o + 1] * a + P[1] * (1 - a), b = img.data[o + 2] * a + P[2] * (1 - a);
        const ink = mode === 'paper'
          ? Math.abs(r - P[0]) + Math.abs(g - P[1]) + Math.abs(b - P[2]) > threshold
          : img.data[o + 3] > threshold;
        const idx = gy * this.gridW + gx;
        this.cellUnder[idx] = 0;
        if (ink) {
          this.cellLayers[idx] = Math.max(1, this.cellLayers[idx]);
          this.cellR[idx] = r; this.cellG[idx] = g; this.cellB[idx] = b;
          this.cellStrokeId[idx] = -1;
          this.cellArcLen[idx] = 0;
        } else {
          this.cellLayers[idx] = 0;
          this.cellR[idx] = 255; this.cellG[idx] = 255; this.cellB[idx] = 255;
          this.cellStrokeId[idx] = 0;
          this.cellArcLen[idx] = 0;
        }
      }
    }
  }

  // ── Color Parsing & Optical Multiply Math ─────────────────────────────────

  static parseHex(colorStr) {
    if (!colorStr || typeof colorStr !== 'string') return [25, 24, 23];
    let hex = colorStr.trim();
    if (hex.startsWith('rgb')) {
      const m = hex.match(/\d+/g);
      if (m && m.length >= 3) return [Number(m[0]), Number(m[1]), Number(m[2])];
    }
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const num = parseInt(hex.slice(0, 6), 16);
    if (Number.isNaN(num)) return [25, 24, 23];
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  static rgbToHex(r, g, b) {
    const cr = Math.max(0, Math.min(255, Math.round(r)));
    const cg = Math.max(0, Math.min(255, Math.round(g)));
    const cb = Math.max(0, Math.min(255, Math.round(b)));
    return '#' + [cr, cg, cb].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  static luminance(r, g, b) {
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }

  _rgb(colorStr) {
    let v = this._rgbCache.get(colorStr);
    if (!v) {
      v = OverprintBlender.parseHex(colorStr);
      if (this._rgbCache.size > 256) this._rgbCache.clear();
      this._rgbCache.set(colorStr, v);
    }
    return v;
  }

  /**
   * 'mix': the colour a stroke of ink C lays down over U (the ink beneath), at crossing strength k (0..1).
   * What lies beneath goes from the paper to U as k rises; the ink is transparent over it (inkDensity); and the
   * overprint (multiply) is reached as far as k × overprintDarken.
   */
  _mixRGB(C, U, k) {
    const d = this.inkDensity, P = this.paper, I = clamp(this.overprintDarken, 0, 1) * clamp(k, 0, 1);
    const out = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      const B = P[i] + (U[i] - P[i]) * k;       // beneath: the paper, then the ink as the nib meets it
      const S = C[i] * d + B * (1 - d);         // the transparent ink over it
      const M = (C[i] * B) / 255;               // overprint: the two inks multiplied
      out[i] = S + (M - S) * I;
    }
    return out;
  }

  /**
   * Returns true if the active stroke color is light/white (e.g. #ffffff in Inkwell),
   * which must bypass 'multiply'/'darken' so white overpaint pens remain opaque. ('classic' only: in 'mix' every
   * colour behaves the same way)
   */
  isLightInk(colorStr) {
    const [r, g, b] = OverprintBlender.parseHex(colorStr);
    return OverprintBlender.luminance(r, g, b) > 0.80;
  }

  /**
   * Returns the Canvas2D globalCompositeOperation for base stroke drawing.
   * 'classic': 'darken' for dark/colored inks ensures that 100 overlapping sub-steps of the first-pass color stay at
   * exact first-pass density (min(C, C) = C) while preserving darker multiplied intersections underneath.
   * 'mix': always 'source-over' (the transparency is in the colour itself).
   */
  getCompositeOperation(colorStr) {
    if (this.isMix) return 'source-over';
    if (this.blendMode !== 'multiply' || this.isLightInk(colorStr)) {
      return 'source-over';
    }
    return 'darken';
  }

  /**
   * The colour of ink laid on bare paper.
   * 'mix': the ink at inkDensity over the paper (black on white paper at 0.97 → #080808).
   * 'classic': lifts pure #000000 or #191817 slightly in perceptual sRGB space so that a single pass looks like rich
   * 94% charcoal/ink, leaving optical headroom to darken to 100% jet black when crossed by another stroke.
   */
  getFirstPassColor(colorStr) {
    if (this.isMix) {
      if (this.blendMode !== 'multiply') return colorStr;
      let fp = this._firstCache.get(colorStr);
      if (!fp) {
        fp = OverprintBlender.rgbToHex(...this._mixRGB(this._rgb(colorStr), this.paper, 0));
        if (this._firstCache.size > 256) this._firstCache.clear();
        this._firstCache.set(colorStr, fp);
      }
      return fp;
    }
    if (this.blendMode !== 'multiply' || this.inkDensity >= 0.999 || this.isLightInk(colorStr)) {
      return colorStr;
    }
    const [r, g, b] = OverprintBlender.parseHex(colorStr);
    // Perceptual sRGB paper-bleed lift: maps (1 - inkDensity) so 0.94 -> ~15% sRGB lift (~#282725 for black)
    const transparency = 1.0 - this.inkDensity;
    const perceptualLift = Math.min(0.65, Math.pow(transparency, 0.72) * 1.15);

    // Warm archival paper white (252, 250, 246)
    const pr = r + (252 - r) * perceptualLift;
    const pg = g + (250 - g) * perceptualLift;
    const pb = b + (246 - b) * perceptualLift;
    return OverprintBlender.rgbToHex(pr, pg, pb);
  }

  /**
   * The colour where `colorStr` crosses existing ink `(ur, ug, ub)` at crossing strength `crossingStrength`.
   * 'mix': the transparent ink mixed (multiply) with the ink beneath; 'classic': multiply darkening.
   */
  getMultipliedColor(colorStr, ur = null, ug = null, ub = null, crossingStrength = 1.0) {
    if (this.isMix) {
      if (this.blendMode !== 'multiply') return colorStr;
      const C = this._rgb(colorStr);
      // no colour beneath given: the stroke crossing itself
      const U = ur !== null ? [ur, ug, ub] : this._mixRGB(C, this.paper, 0);
      return OverprintBlender.rgbToHex(...this._mixRGB(C, U, crossingStrength));
    }
    if (this.blendMode !== 'multiply' || this.overprintDarken <= 0.001 || this.isLightInk(colorStr)) {
      return this.getFirstPassColor(colorStr);
    }

    const firstHex = this.getFirstPassColor(colorStr);
    const [sr, sg, sb] = OverprintBlender.parseHex(firstHex);

    // If underlying RGB is not provided, assume self-crossing (sr, sg, sb)
    const dr = ur !== null ? ur : sr;
    const dg = ug !== null ? ug : sg;
    const db = ub !== null ? ub : sb;

    // True optical multiply: (Cs * Cd) / 255, pushed deeper by overprintDarken
    const multR = (sr * dr) / 255;
    const multG = (sg * dg) / 255;
    const multB = (sb * db) / 255;

    // Extra pigment concentration when two wet layers pool together
    const deepen = 1.0 - Math.min(0.85, this.overprintDarken * 0.65);
    const targetR = multR * deepen;
    const targetG = multG * deepen;
    const targetB = multB * deepen;

    const k = Math.min(1.0, crossingStrength * Math.min(1.0, this.overprintDarken * 1.25));
    const outR = sr + (targetR - sr) * k;
    const outG = sg + (targetG - sg) * k;
    const outB = sb + (targetB - sb) * k;

    return OverprintBlender.rgbToHex(outR, outG, outB);
  }

  // ── Spatial Grid Lookup & Recording ───────────────────────────────────────

  /**
   * 'mix': how much of the nib (within overprintReach × radius) lies over ink beneath — an earlier stroke or an
   * earlier loop of this one — and that ink's average colour. Coverage is boosted ×2 so half a nib over ink is a full
   * crossing (a thin line crossed by a broad nib still mixes, less).
   */
  _coverage(x, y, radius, strokeId, currentArcLen) {
    const cs = this.cellSize;
    const R = Math.max(cs * 0.5, radius * this.overprintReach);
    const R2 = R * R;
    // the cells whose area comes within R of the nib's centre (measured in px, not in whole cells: 4.0)
    const W = this.gridW;
    let gx0 = Math.floor((x - R) / cs), gx1 = Math.floor((x + R) / cs);
    if (!this.wrap) { gx0 = Math.max(0, gx0); gx1 = Math.min(W - 1, gx1); }
    const gy0 = Math.max(0, Math.floor((y - R) / cs)), gy1 = Math.min(this.gridH - 1, Math.floor((y + R) / cs));
    const minSelfArcDiff = Math.max(26, radius * 4.2);
    const arcOk = Number.isFinite(currentArcLen);
    let hits = 0, total = 0, sr = 0, sg = 0, sb = 0, maxLayers = 0;
    for (let gy = gy0; gy <= gy1; gy++) {
      const top = gy * cs;
      const ddy = y < top ? top - y : y > top + cs ? y - top - cs : 0;
      const row = gy * this.gridW;
      for (let gx = gx0; gx <= gx1; gx++) {
        const left = gx * cs;
        const ddx = x < left ? left - x : x > left + cs ? x - left - cs : 0;
        if (ddx * ddx + ddy * ddy >= R2) continue;
        total++;
        const idx = row + (this.wrap ? ((gx % W) + W) % W : gx);
        const layers = this.cellLayers[idx];
        if (!layers) continue;
        if (this.cellStrokeId[idx] !== strokeId || (arcOk && currentArcLen - this.cellArcLen[idx] > minSelfArcDiff)) {
          hits++;
          sr += this.cellR[idx]; sg += this.cellG[idx]; sb += this.cellB[idx];
          if (layers > maxLayers) maxLayers = layers;
        } else if (this.cellUnder[idx] === strokeId) {
          // this stroke's own fresh ink, laid over another's: the nib is still over that ink
          hits++;
          sr += this.cellUR[idx]; sg += this.cellUG[idx]; sb += this.cellUB[idx];
          if (layers > maxLayers) maxLayers = layers;
        }
      }
    }
    if (!hits || !total) return { ratio: 0, under: null, layers: 0 };
    return { ratio: Math.min(1, (hits / total) * 2), under: [sr / hits, sg / hits, sb / hits], layers: maxLayers };
  }

  // 'mix': the distance (instrument px) over which the mix comes in / goes away, from the speeds 0..1
  _attackLength(radius) {
    const a = 1 - this.overprintAttack;
    return Math.max(0.3, Math.max(1, radius) * (0.12 + 3.0 * a * a));
  }

  _releaseLength(radius) {
    const b = 1 - this.overprintRelease;
    return Math.max(0.5, Math.max(1, radius) * (0.25 + 12.0 * b * b));
  }

  _stateFor(strokeId) {
    let st = this.activeStates.get(strokeId);
    if (!st) {
      st = this._newState(strokeId);
      this.activeStates.set(strokeId, st);
    }
    return st;
  }

  _newState(strokeId) {
    return {
      strokeId,
      arcLength: 0,
      smoothedCrossing: 0,
      underR: this.paper[0],
      underG: this.paper[1],
      underB: this.paper[2],
      fresh: true,
      lastArc: NaN,
      lastRGB: null,
    };
  }

  // 'mix': moves the crossing envelope of a stroke on, over the distance travelled since its last sample
  _envelope(st, cov, arc, radius) {
    if (cov.under) {
      st.underR = cov.under[0];
      st.underG = cov.under[1];
      st.underB = cov.under[2];
    }
    const target = cov.ratio;
    if (st.fresh) {
      st.smoothedCrossing = target;   // the nib lands in the ink beneath: it mixes at once
      st.fresh = false;
    } else {
      let ds = Number.isFinite(arc) && Number.isFinite(st.lastArc) ? Math.abs(arc - st.lastArc) : 0;
      if (ds < 0.25) ds = 0.25;       // in place (a dwell, a puddle): the mix still moves on, slowly
      const L = target > st.smoothedCrossing ? this._attackLength(radius) : this._releaseLength(radius);
      st.smoothedCrossing += (target - st.smoothedCrossing) * (1 - Math.exp(-ds / L));
    }
    if (st.smoothedCrossing < 0.003) st.smoothedCrossing = 0;
    if (Number.isFinite(arc)) st.lastArc = arc;
    return st.smoothedCrossing;
  }

  /**
   * Samples the spatial grid around (x, y) within `radius` to check if pre-existing ink
   * is present from an earlier stroke OR an earlier loop of the same stroke.
   */
  sampleCrossing(x, y, radius, strokeId, currentArcLen) {
    if (this.blendMode !== 'multiply') {
      return { isCrossing: false, ratio: 0, underR: 255, underG: 255, underB: 255, layers: 0 };
    }
    if (this.isMix) {
      const cov = this._coverage(x, y, radius, strokeId, currentArcLen);
      if (!cov.under) return { isCrossing: false, ratio: 0, underR: this.paper[0], underG: this.paper[1], underB: this.paper[2], layers: 0 };
      return { isCrossing: true, ratio: cov.ratio, underR: Math.round(cov.under[0]), underG: Math.round(cov.under[1]), underB: Math.round(cov.under[2]), layers: cov.layers };
    }

    const rCells = Math.max(1, Math.min(8, Math.ceil(radius / this.cellSize)));
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);

    // Self-crossing minimum arc-length separation:
    // Must have traveled at least max(26px, 4.2 * radius) along the stroke before
    // crossing one's own trail counts as a loop intersection.
    const minSelfArcDiff = Math.max(26, radius * 4.2);

    let hitCount = 0;
    let totalSampled = 0;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let maxLayers = 0;

    for (let dy = -rCells; dy <= rCells; dy++) {
      const gy = cy + dy;
      if (gy < 0 || gy >= this.gridH) continue;
      const rowOffset = gy * this.gridW;

      for (let dx = -rCells; dx <= rCells; dx++) {
        if (dx * dx + dy * dy > rCells * rCells + 1) continue;
        const gx = cx + dx;
        if (gx < 0 || gx >= this.gridW) continue;

        totalSampled++;
        const idx = rowOffset + gx;
        const layers = this.cellLayers[idx];
        if (layers > 0) {
          const cellStroke = this.cellStrokeId[idx];
          const cellArc = this.cellArcLen[idx];
          const isDifferentStroke = cellStroke !== strokeId;
          const isSelfLoop = cellStroke === strokeId && (currentArcLen - cellArc) > minSelfArcDiff;

          if (isDifferentStroke || isSelfLoop) {
            hitCount++;
            sumR += this.cellR[idx];
            sumG += this.cellG[idx];
            sumB += this.cellB[idx];
            if (layers > maxLayers) maxLayers = layers;
          }
        }
      }
    }

    if (hitCount === 0 || totalSampled === 0) {
      return { isCrossing: false, ratio: 0, underR: 255, underG: 255, underB: 255, layers: 0 };
    }

    // Coverage ratio boosted so even crossing a thin hairline triggers a crisp response
    const rawRatio = hitCount / Math.max(1, Math.min(totalSampled, 6));
    const ratio = Math.min(1.0, rawRatio);

    return {
      isCrossing: true,
      ratio,
      underR: Math.round(sumR / hitCount),
      underG: Math.round(sumG / hitCount),
      underB: Math.round(sumB / hitCount),
      layers: maxLayers,
    };
  }

  /**
   * Fast point-level check for individual bristles/tracks/ellipses at (px, py).
   */
  samplePointColor(px, py, baseRadius, colorStr, strokeId, currentArcLen) {
    if (this.blendMode !== 'multiply' || (!this.isMix && this.isLightInk(colorStr))) {
      return this.isMix ? this.getFirstPassColor(colorStr) : colorStr;
    }

    const gx = Math.floor(px / this.cellSize);
    const gy = Math.floor(py / this.cellSize);
    if (gx < 0 || gx >= this.gridW || gy < 0 || gy >= this.gridH) {
      return this.getFirstPassColor(colorStr);
    }

    const minSelfArcDiff = Math.max(26, baseRadius * 4.2);

    // Check 3x3 neighborhood (so edge anti-aliasing and thin hairlines catch cleanly)
    let hit = false;
    let ur = 255;
    let ug = 255;
    let ub = 255;

    for (let dy = -1; dy <= 1 && !hit; dy++) {
      const ny = gy + dy;
      if (ny < 0 || ny >= this.gridH) continue;
      const row = ny * this.gridW;
      for (let dx = -1; dx <= 1; dx++) {
        const nx = gx + dx;
        if (nx < 0 || nx >= this.gridW) continue;
        const idx = row + nx;
        if (this.cellLayers[idx] > 0) {
          const cs = this.cellStrokeId[idx];
          if (cs !== strokeId || (currentArcLen - this.cellArcLen[idx]) > minSelfArcDiff) {
            hit = true;
            ur = this.cellR[idx];
            ug = this.cellG[idx];
            ub = this.cellB[idx];
            break;
          }
        }
      }
    }

    if (!hit) {
      return this.getFirstPassColor(colorStr);
    }

    return this.getMultipliedColor(colorStr, ur, ug, ub, 1.0);
  }

  /**
   * Records ink deposited along segment (x0, y0) -> (x1, y1) with given `radius`.
   * 'mix': the cells keep the colour actually drawn (`drawn`, rgb array or hex; else this stroke's last mixed colour,
   * else the ink on bare paper) — already mixed, so nothing compounds twice.
   */
  recordSegment(x0, y0, x1, y1, radius, colorStr, strokeId, arcLength, drawn = null) {
    if (this.isMix) {
      let rgb = drawn ? (typeof drawn === 'string' ? this._rgb(drawn) : drawn) : null;
      if (!rgb) {
        const st = this.activeStates.get(strokeId);
        rgb = st && st.lastRGB ? st.lastRGB : (this.blendMode === 'multiply' ? this._mixRGB(this._rgb(colorStr), this.paper, 0) : this._rgb(colorStr));
      }
      this._stamp(x0, y0, x1, y1, radius, strokeId, finite(arcLength, 0), rgb);
      return;
    }

    if (this.isLightInk(colorStr)) return;

    const firstHex = this.getFirstPassColor(colorStr);
    const [r, g, b] = OverprintBlender.parseHex(firstHex);

    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / (this.cellSize * 0.75)));
    const rCells = Math.max(1, Math.ceil(radius / this.cellSize));
    const minSelfArcDiff = Math.max(26, radius * 4.2);

    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps;
      const px = x0 + dx * t;
      const py = y0 + dy * t;
      const segArc = arcLength - dist * (1 - t);

      const cx = Math.floor(px / this.cellSize);
      const cy = Math.floor(py / this.cellSize);

      for (let oy = -rCells; oy <= rCells; oy++) {
        const gy = cy + oy;
        if (gy < 0 || gy >= this.gridH) continue;
        const rowOffset = gy * this.gridW;

        for (let ox = -rCells; ox <= rCells; ox++) {
          if (ox * ox + oy * oy > rCells * rCells + 0.5) continue;
          const gx = cx + ox;
          if (gx < 0 || gx >= this.gridW) continue;

          const idx = rowOffset + gx;
          const prevLayers = this.cellLayers[idx];
          const prevStroke = this.cellStrokeId[idx];
          const prevArc = this.cellArcLen[idx];

          if (prevLayers === 0) {
            this.cellLayers[idx] = 1;
            this.cellR[idx] = r;
            this.cellG[idx] = g;
            this.cellB[idx] = b;
            this.cellStrokeId[idx] = strokeId;
            this.cellArcLen[idx] = segArc;
          } else if (prevStroke !== strokeId || (segArc - prevArc) > minSelfArcDiff) {
            // Overprint compounding in the grid!
            const multHex = this.getMultipliedColor(
              colorStr,
              this.cellR[idx],
              this.cellG[idx],
              this.cellB[idx],
              1.0
            );
            const [mr, mg, mb] = OverprintBlender.parseHex(multHex);
            this.cellLayers[idx] = Math.min(255, prevLayers + 1);
            this.cellR[idx] = mr;
            this.cellG[idx] = mg;
            this.cellB[idx] = mb;
            this.cellStrokeId[idx] = strokeId;
            this.cellArcLen[idx] = segArc;
          } else {
            // Same stroke local update: keep arcLength fresh
            this.cellArcLen[idx] = segArc;
          }
        }
      }
    }
  }

  // 'mix': stamps the cells a segment of ink covers with the colour drawn there (the cells it really overlaps, in px —
  // and always the cell under the line itself)
  _stamp(x0, y0, x1, y1, radius, strokeId, arcLength, rgb) {
    const cs = this.cellSize;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / (cs * 0.75)));
    const rr = Math.max(0, radius);
    const r2 = rr * rr;
    const minSelfArcDiff = Math.max(26, radius * 4.2);
    const r = rgb[0], g = rgb[1], b = rgb[2];
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const px = x0 + dx * t;
      const py = y0 + dy * t;
      const segArc = arcLength - dist * (1 - t);
      const W = this.gridW;
      let gx0 = Math.floor((px - rr) / cs), gx1 = Math.floor((px + rr) / cs);
      if (!this.wrap) { gx0 = Math.max(0, gx0); gx1 = Math.min(W - 1, gx1); }
      const gy0 = Math.max(0, Math.floor((py - rr) / cs)), gy1 = Math.min(this.gridH - 1, Math.floor((py + rr) / cs));
      for (let gy = gy0; gy <= gy1; gy++) {
        const top = gy * cs;
        const ddy = py < top ? top - py : py > top + cs ? py - top - cs : 0;
        const row = gy * this.gridW;
        for (let gx = gx0; gx <= gx1; gx++) {
          const left = gx * cs;
          const ddx = px < left ? left - px : px > left + cs ? px - left - cs : 0;
          if (ddx * ddx + ddy * ddy >= r2 && (ddx || ddy)) continue;
          const idx = row + (this.wrap ? ((gx % W) + W) % W : gx);
          const prevLayers = this.cellLayers[idx];
          if (prevLayers === 0) {
            this.cellLayers[idx] = 1;
            this.cellUnder[idx] = 0;
          } else if (this.cellStrokeId[idx] !== strokeId || segArc - this.cellArcLen[idx] > minSelfArcDiff) {
            this.cellLayers[idx] = Math.min(255, prevLayers + 1);
            this.cellUnder[idx] = strokeId;
            this.cellUR[idx] = this.cellR[idx];
            this.cellUG[idx] = this.cellG[idx];
            this.cellUB[idx] = this.cellB[idx];
          }
          // the cell shows what was drawn last: this stroke's colour, mixed or not
          this.cellR[idx] = r;
          this.cellG[idx] = g;
          this.cellB[idx] = b;
          this.cellStrokeId[idx] = strokeId;
          this.cellArcLen[idx] = segArc;
        }
      }
    }
  }

  // ── High-Level Instrument Lifecycle Helpers ───────────────────────────────

  applyCompositeStyle(ctx, colorStr, opacity = 1.0) {
    if (!ctx) return;
    ctx.globalCompositeOperation = this.getCompositeOperation(colorStr);
    ctx.globalAlpha = opacity;
    const fp = this.getFirstPassColor(colorStr);
    ctx.fillStyle = fp;
    ctx.strokeStyle = fp;
  }

  /**
   * 4.0: draws one piece of a running drip (a FluidDynamics.updateDrips segment). In 'mix' the drip's ink mixes with
   * the other strokes it runs over (never with the stroke it runs from); in both models it is recorded in the grid,
   * so later strokes overprint it (3.9 drew drips past the grid). Returns the colour drawn.
   */
  paintDripSegment(ctx, seg) {
    if (!ctx || !seg) return null;
    const w = Math.max(0.5, seg.w1 || 1);
    const parent = seg.strokeId ?? -2;
    // the drip's cells belong to its stroke but never count as an earlier loop of it
    const arc = 1e9;
    let color;
    if (this.isMix && this.blendMode === 'multiply') {
      if (!this._dripStates) this._dripStates = new Map();
      const key = seg.dripId ?? 0;
      let st = this._dripStates.get(key);
      if (!st) {
        st = this._newState(parent);
        this._dripStates.set(key, st);
        if (this._dripStates.size > 64) this._dripStates.delete(this._dripStates.keys().next().value);
      }
      const cov = this._coverage((seg.x0 + seg.x1) / 2, (seg.y0 + seg.y1) / 2, w / 2, parent, NaN);
      const k = this._envelope(st, cov, seg.distance, w / 2);
      const D = this._mixRGB(this._rgb(seg.color), [st.underR, st.underG, st.underB], k);
      color = OverprintBlender.rgbToHex(...D);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      this._stamp(seg.x0, seg.y0, seg.x1, seg.y1, w / 2, parent, arc, D);
    } else {
      // 'classic' (as 3.9: the drip is not recorded) or overprint off
      this.applyCompositeStyle(ctx, seg.color, 1.0);
      color = this.getFirstPassColor(seg.color);
      if (this.isMix) this._stamp(seg.x0, seg.y0, seg.x1, seg.y1, w / 2, parent, arc, this._rgb(seg.color));
    }
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(seg.x0, seg.y0);
    ctx.lineTo(seg.x1, seg.y1);
    ctx.stroke();
    return color;
  }

  // agents and strokes are kept apart in activeStates (4.0: an agent number could be taken for a stroke number)
  _akey(agentId) {
    return 'agent:' + (agentId ?? 'default');
  }

  getActiveStrokeId(agentId = 'default') {
    const st = this.activeStates.get(this._akey(agentId));
    return st ? st.strokeId : this.strokeCounter;
  }

  /**
   * The width factor at a crossing of strength `intensity`: 1 + swell × intensity. `swell` is the instrument's own
   * (4.0); without it, this blender's overprintSwell.
   */
  getSwellFactor(intensity = 1.0, swell = null) {
    if (this.blendMode !== 'multiply') return 1.0;
    const s = swell == null ? this.overprintSwell : clamp(finite(swell, this.overprintSwell), ...OVERPRINT_RANGES.overprintSwell);
    return 1.0 + s * Math.max(0.0, Math.min(1.5, intensity));
  }

  /**
   * Queries the spatial grid at (x, y) within `radius` for pre-existing ink
   * (either from an earlier stroke OR an earlier loop of the same stroke),
   * optionally stamps the new ink into the grid, and returns crossing metrics.
   * 'mix': also returns `color`, the colour to draw here (the same getMultipliedColor gives for these metrics).
   */
  queryAndStamp(x, y, radius, strokeId, currentArcLen = 0, colorStr = '#191817', stamp = true) {
    if (this.isMix) {
      if (this.blendMode !== 'multiply') {
        if (stamp) this._stamp(x, y, x, y, radius, strokeId, finite(currentArcLen, 0), this._rgb(colorStr));
        return { crossed: false, intensity: 0, underR: this.paper[0], underG: this.paper[1], underB: this.paper[2], layers: 0, color: colorStr };
      }
      const st = this._stateFor(strokeId);
      const cov = this._coverage(x, y, radius, strokeId, currentArcLen);
      const k = this._envelope(st, cov, currentArcLen, radius);
      const D = this._mixRGB(this._rgb(colorStr), [st.underR, st.underG, st.underB], k);
      st.lastRGB = D;
      if (stamp) this._stamp(x, y, x, y, radius, strokeId, finite(currentArcLen, 0), D);
      return {
        crossed: k > 0,
        intensity: k,
        underR: st.underR,
        underG: st.underG,
        underB: st.underB,
        layers: cov.layers,
        color: OverprintBlender.rgbToHex(...D),
      };
    }

    if (this.blendMode !== 'multiply' || this.isLightInk(colorStr)) {
      if (stamp) {
        this.recordSegment(x, y, x, y, radius, colorStr, strokeId, currentArcLen);
      }
      return {
        crossed: false,
        intensity: 0,
        underR: 255,
        underG: 255,
        underB: 255,
        layers: 0,
      };
    }

    const sample = this.sampleCrossing(x, y, radius, strokeId, currentArcLen);

    // Smooth crossing envelope per strokeId so entering/exiting intersections has organic capillary swell
    let st = this.activeStates.get(strokeId);
    if (!st) {
      st = {
        strokeId,
        arcLength: currentArcLen,
        smoothedCrossing: sample.isCrossing ? sample.ratio : 0,
        underR: sample.underR,
        underG: sample.underG,
        underB: sample.underB,
      };
      this.activeStates.set(strokeId, st);
    }

    const rawCross = sample.isCrossing ? sample.ratio : 0;
    if (sample.isCrossing) {
      st.underR = sample.underR;
      st.underG = sample.underG;
      st.underB = sample.underB;
      st.smoothedCrossing = st.smoothedCrossing * 0.25 + rawCross * 0.75;
    } else {
      st.smoothedCrossing = st.smoothedCrossing * 0.62;
      if (st.smoothedCrossing < 0.04) st.smoothedCrossing = 0;
    }

    if (stamp) {
      this.recordSegment(x, y, x, y, radius, colorStr, strokeId, currentArcLen);
    }

    const intensity = Math.max(rawCross, st.smoothedCrossing);
    return {
      crossed: intensity > 0.04,
      intensity,
      underR: st.underR,
      underG: st.underG,
      underB: st.underB,
      layers: sample.layers,
    };
  }

  // 4.0: a new stroke of an agent forgets that agent's previous one (3.9 kept every stroke's state for ever)
  _forgetAgent(agentId) {
    const prev = this.activeStates.get(this._akey(agentId));
    if (prev) this.activeStates.delete(prev.strokeId);
  }

  // 4.0: the end of a stroke (optional — a new stroke of the same agent also clears the old one)
  endStroke(agentId = 'default') {
    const key = this._akey(agentId), st = this.activeStates.get(key);
    if (!st) return;
    this.activeStates.delete(st.strokeId);
    this.activeStates.delete(key);
  }

  beginStroke(arg1, arg2, arg3, arg4 = 0, swell = null) {
    const strokeId = ++this.strokeCounter;

    // Signature A: beginStroke(agentId, colorStr) -> returns strokeId number
    if (typeof arg1 !== 'object' || arg1 === null || !('x' in arg1)) {
      const agentId = arg1 ?? 'default';
      this._forgetAgent(agentId);
      const state = this._newState(strokeId);
      if (!this.isMix) {
        state.underR = 255;
        state.underG = 255;
        state.underB = 255;
      }
      this.activeStates.set(this._akey(agentId), state);
      this.activeStates.set(strokeId, state);
      return strokeId;
    }

    // Signature B: beginStroke(point, radius, colorStr, agentId) -> returns state object
    const point = arg1;
    const radius = arg2 ?? 6;
    const colorStr = arg3 ?? '#191817';
    const agentId = arg4 ?? 'default';
    this._forgetAgent(agentId);

    if (this.isMix) {
      const state = this._newState(strokeId);
      this.activeStates.set(this._akey(agentId), state);
      this.activeStates.set(strokeId, state);
      let k = 0;
      if (this.blendMode === 'multiply') k = this._envelope(state, this._coverage(point.x, point.y, radius, strokeId, 0), 0, radius);
      state.fresh = false;
      const D = this.blendMode === 'multiply' ? this._mixRGB(this._rgb(colorStr), [state.underR, state.underG, state.underB], k) : this._rgb(colorStr);
      state.lastRGB = D;
      return {
        strokeId,
        crossingFactor: k,
        swellMultiplier: this.getSwellFactor(k, swell),
        firstPassColor: this.getFirstPassColor(colorStr),
        activeColor: OverprintBlender.rgbToHex(...D),
        compositeOp: 'source-over',
      };
    }

    const sample = this.sampleCrossing(point.x, point.y, radius, strokeId, 0);
    const crossingFactor = sample.isCrossing ? sample.ratio : 0;

    const state = {
      strokeId,
      arcLength: 0,
      smoothedCrossing: crossingFactor,
      underR: sample.underR,
      underG: sample.underG,
      underB: sample.underB,
    };
    this.activeStates.set(this._akey(agentId), state);
    this.activeStates.set(strokeId, state);

    const swellMultiplier = this.blendMode === 'multiply'
      ? 1.0 + (swell == null ? this.overprintSwell : swell) * crossingFactor
      : 1.0;

    const activeColor = sample.isCrossing
      ? this.getMultipliedColor(colorStr, sample.underR, sample.underG, sample.underB, crossingFactor)
      : this.getFirstPassColor(colorStr);

    return {
      strokeId,
      crossingFactor,
      swellMultiplier,
      firstPassColor: this.getFirstPassColor(colorStr),
      activeColor,
      compositeOp: this.getCompositeOperation(colorStr),
    };
  }

  stepMove(x0, y0, x1, y1, radius, colorStr, agentId = 0, swell = null) {
    let state = this.activeStates.get(this._akey(agentId));
    if (!state) {
      this.beginStroke({ x: x0, y: y0 }, radius, colorStr, agentId, swell);
      state = this.activeStates.get(this._akey(agentId));
    }

    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const startArc = state.arcLength;
    state.arcLength += dist;

    // Scan along the segment every ~4px so fast strokes never jump over thin lines
    const scanSteps = Math.max(1, Math.ceil(dist / this.cellSize));

    if (this.isMix) {
      const on = this.blendMode === 'multiply';
      let best = { ratio: 0, under: null, layers: 0 };
      let hitX = x1;
      let hitY = y1;
      if (on) {
        for (let i = 1; i <= scanSteps; i++) {
          const t = i / scanSteps;
          const sx = x0 + dx * t;
          const sy = y0 + dy * t;
          const cov = this._coverage(sx, sy, radius, state.strokeId, startArc + dist * t);
          if (cov.under && cov.ratio >= best.ratio) {
            best = cov;
            hitX = sx;
            hitY = sy;
          }
        }
      }
      const k = on ? this._envelope(state, best, state.arcLength, radius) : 0;
      const D = on ? this._mixRGB(this._rgb(colorStr), [state.underR, state.underG, state.underB], k) : this._rgb(colorStr);
      state.lastRGB = D;
      const hex = OverprintBlender.rgbToHex(...D);
      return {
        strokeId: state.strokeId,
        arcLength: state.arcLength,
        crossingFactor: k,
        swellMultiplier: this.getSwellFactor(k, swell),
        firstPassColor: this.getFirstPassColor(colorStr),
        overprintColor: hex,
        hitX,
        hitY,
        compositeOp: 'source-over',
      };
    }

    let rawCross = 0;
    let hitX = x1;
    let hitY = y1;

    for (let i = 1; i <= scanSteps; i++) {
      const t = i / scanSteps;
      const sx = x0 + dx * t;
      const sy = y0 + dy * t;
      const sample = this.sampleCrossing(sx, sy, radius, state.strokeId, startArc + dist * t);
      if (sample.isCrossing && sample.ratio >= rawCross) {
        rawCross = sample.ratio;
        state.underR = sample.underR;
        state.underG = sample.underG;
        state.underB = sample.underB;
        hitX = sx;
        hitY = sy;
      }
    }

    // Fast attack when entering an intersection (0.72), smooth capillary ease-out when leaving (0.35)
    if (rawCross > state.smoothedCrossing) {
      state.smoothedCrossing = state.smoothedCrossing * 0.28 + rawCross * 0.72;
    } else {
      state.smoothedCrossing = state.smoothedCrossing * 0.65 + rawCross * 0.35;
      if (state.smoothedCrossing < 0.02) state.smoothedCrossing = 0;
    }

    const crossingFactor = state.smoothedCrossing;
    const swellMultiplier = this.blendMode === 'multiply'
      ? 1.0 + (swell == null ? this.overprintSwell : swell) * crossingFactor
      : 1.0;

    const firstPassColor = this.getFirstPassColor(colorStr);
    const overprintColor = crossingFactor > 0.02
      ? this.getMultipliedColor(colorStr, state.underR, state.underG, state.underB, crossingFactor)
      : firstPassColor;

    return {
      strokeId: state.strokeId,
      arcLength: state.arcLength,
      crossingFactor,
      swellMultiplier,
      firstPassColor,
      overprintColor,
      hitX,
      hitY,
      compositeOp: this.getCompositeOperation(colorStr),
    };
  }
}
