// ═══════════════════════════════════════════════════════════════════════════
// INK DYNAMICS ENGINE v4 — InkDynamicsEngine.js
// Physical ink simulation engine supporting:
// 1. Calibrated Zig Chinese Brush (v2) with 4 bristle presets
// 2. Calibrated Posca Mop Squeezer (v3) with 3 monoline & drip presets
// 3. Curved & Flat Ruling Pens (v3.8) with 3 presets each
// 4. FluidDynamics engine for pooling, gravity drips and bleed
// 5. OverprintBlender (v4.0): slightly transparent ink that mixes where strokes cross ('mix'), or the 3.9 'classic'
// Pure vanilla ES module, zero external dependencies.
// Owns a canvas (the calibration lab, standalone pages). Hosts with their own surfaces (Inkwell 20: tiles, undo,
// shared layers) drive the instruments directly with a shared OverprintBlender — see docs/INKWELL_INTEGRATION.md.
// ═══════════════════════════════════════════════════════════════════════════

import { ChineseBrushV2, ZIG_PRESETS } from './instruments/ChineseBrushV2.js';
import { PoscaSqueezerV3, POSCA_PRESETS } from './instruments/PoscaSqueezerV3.js';
import { RulingPenCurved, CURVED_RULING_PRESETS } from './instruments/RulingPenCurved.js';
import { RulingPenFlat, FLAT_RULING_PRESETS } from './instruments/RulingPenFlat.js';
import { FluidDynamics } from './physics/FluidDynamics.js';
import { OverprintBlender, OVERPRINT_DEFAULTS } from './physics/OverprintBlender.js';

export {
  ChineseBrushV2,
  PoscaSqueezerV3,
  RulingPenCurved,
  RulingPenFlat,
  FluidDynamics,
  OverprintBlender,
  ZIG_PRESETS,
  POSCA_PRESETS,
  CURVED_RULING_PRESETS,
  FLAT_RULING_PRESETS,
};

export class InkDynamicsEngine {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d', { willReadFrequently: true });
    this.options = options;

    this.dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    this.width = canvasElement.width / this.dpr || 800;
    this.height = canvasElement.height / this.dpr || 600;

    // Substrate properties
    this.paperTooth = options.paperTooth ?? 0.45;
    this.color = options.color || '#000000';
    // 4.0: a transparent canvas (a layer over a paper the host paints): clear() empties it instead of painting paper
    this.transparent = !!options.transparent;

    // Shared Overprint & Capillary Intersection Micro-Swell Engine (v3.9; v4.0 'mix' model)
    this.overprintBlender = new OverprintBlender({
      overprintModel: options.overprintModel ?? OVERPRINT_DEFAULTS.overprintModel,
      blendMode: options.blendMode ?? OVERPRINT_DEFAULTS.blendMode,
      inkDensity: options.inkDensity ?? OVERPRINT_DEFAULTS.inkDensity,
      overprintDarken: options.overprintDarken ?? options.blendIntensity ?? OVERPRINT_DEFAULTS.overprintDarken,
      overprintSwell: options.overprintSwell ?? OVERPRINT_DEFAULTS.overprintSwell,
      overprintAttack: options.overprintAttack ?? OVERPRINT_DEFAULTS.overprintAttack,
      overprintRelease: options.overprintRelease ?? OVERPRINT_DEFAULTS.overprintRelease,
      overprintReach: options.overprintReach ?? OVERPRINT_DEFAULTS.overprintReach,
      paperColor: options.paperColor ?? OVERPRINT_DEFAULTS.paperColor,
    });

    // Fluid dynamics physics engine (gravity drips, pooling)
    this.fluidDynamics = new FluidDynamics({ gravity: 980 });

    // Available calibrated instruments (sharing the same OverprintBlender spatial grid)
    this.instruments = {
      chinese_brush: new ChineseBrushV2({
        preset: 'medium_high_dynamic',
        color: options.color || '#050505',
        paperTooth: this.paperTooth,
        overprintBlender: this.overprintBlender,
      }),
      posca_squeezer: new PoscaSqueezerV3({
        preset: 'posca_squeezer_medium',
        color: options.color || '#050505',
        paperTooth: this.paperTooth,
        overprintBlender: this.overprintBlender,
      }),
      ruling_pen_curved: new RulingPenCurved({
        preset: 'curved_ruling_medium',
        color: options.color || '#050505',
        paperTooth: this.paperTooth,
        overprintBlender: this.overprintBlender,
      }),
      ruling_pen_flat: new RulingPenFlat({
        preset: 'flat_ruling_medium',
        color: options.color || '#050505',
        paperTooth: this.paperTooth,
        overprintBlender: this.overprintBlender,
      }),
    };

    // Determine initial active instrument & preset
    const initPreset = options.initialPreset || 'medium_high_dynamic';
    if (POSCA_PRESETS[initPreset]) {
      this.activeInstrumentId = 'posca_squeezer';
      this.activeInstrument = this.instruments.posca_squeezer;
      this.activeInstrument.applyPreset(initPreset);
    } else if (CURVED_RULING_PRESETS[initPreset]) {
      this.activeInstrumentId = 'ruling_pen_curved';
      this.activeInstrument = this.instruments.ruling_pen_curved;
      this.activeInstrument.applyPreset(initPreset);
    } else if (FLAT_RULING_PRESETS[initPreset]) {
      this.activeInstrumentId = 'ruling_pen_flat';
      this.activeInstrument = this.instruments.ruling_pen_flat;
      this.activeInstrument.applyPreset(initPreset);
    } else {
      this.activeInstrumentId = 'chinese_brush';
      this.activeInstrument = this.instruments.chinese_brush;
      if (ZIG_PRESETS[initPreset]) {
        this.activeInstrument.applyPreset(initPreset);
      }
    }

    // Undo / Redo history stack (4.0: each state also keeps the overprint grid, and the stack is capped in bytes too)
    this.history = [];
    this.historyIndex = -1;
    this.historyBytes = 0;
    this.maxHistory = options.maxHistory || 24;
    this.maxHistoryBytes = options.maxHistoryBytes || 320e6;

    // Animation & event tracking
    this.lastFrameTime = performance.now();
    // 4.0: the pointer's own clock (3.9 shared lastFrameTime with the animation loop, so pointerMove's dt was the time
    // since the last animation frame — too short — and the instruments read the pen as faster than it was)
    this._lastPointerTime = null;
    this.animId = null;
    this.isStrokeActive = false;

    // Telemetry callback
    this.onTelemetry = options.onTelemetry || null;
    this.onMarkListener = options.onMark || null; // For Inkwell integration

    this._setupCanvas();
    this._saveHistoryState();
    this._startLoop();
  }

  // Active instrument alias (for backward compatibility)
  get brush() {
    return this.activeInstrument;
  }

  get blendMode() {
    return this.overprintBlender.blendMode;
  }

  get inkDensity() {
    return this.overprintBlender.inkDensity;
  }

  get overprintDarken() {
    return this.overprintBlender.overprintDarken;
  }

  // 4.0: the swell is the active instrument's (each ink its own)
  get overprintSwell() {
    const a = this.activeInstrument;
    return a && a.overprintSwell != null ? a.overprintSwell : this.overprintBlender.overprintSwell;
  }

  get overprintModel() {
    return this.overprintBlender.overprintModel;
  }

  get overprintAttack() {
    return this.overprintBlender.overprintAttack;
  }

  get overprintRelease() {
    return this.overprintBlender.overprintRelease;
  }

  get overprintReach() {
    return this.overprintBlender.overprintReach;
  }

  get paperColor() {
    return this.overprintBlender.paperColor;
  }

  get activePreset() {
    if (this.activeInstrumentId === 'chinese_brush') {
      return ZIG_PRESETS[this.activeInstrument.activePresetId] || ZIG_PRESETS.medium_high_dynamic;
    } else if (this.activeInstrumentId === 'posca_squeezer') {
      return POSCA_PRESETS[this.activeInstrument.activePresetId] || POSCA_PRESETS.posca_squeezer_medium;
    } else if (this.activeInstrumentId === 'ruling_pen_curved') {
      return CURVED_RULING_PRESETS[this.activeInstrument.activePresetId] || CURVED_RULING_PRESETS.curved_ruling_medium;
    } else if (this.activeInstrumentId === 'ruling_pen_flat') {
      return FLAT_RULING_PRESETS[this.activeInstrument.activePresetId] || FLAT_RULING_PRESETS.flat_ruling_medium;
    }
    return ZIG_PRESETS.medium_high_dynamic;
  }

  setInstrument(instrumentId) {
    if (this.instruments[instrumentId] && this.activeInstrumentId !== instrumentId) {
      this.activeInstrumentId = instrumentId;
      this.activeInstrument = this.instruments[instrumentId];
      this.activeInstrument.paperTooth = this.paperTooth;
      this._emitTelemetry();
    }
  }

  setPreset(presetId) {
    if (ZIG_PRESETS[presetId]) {
      this.setInstrument('chinese_brush');
      this.instruments.chinese_brush.applyPreset(presetId);
    } else if (POSCA_PRESETS[presetId]) {
      this.setInstrument('posca_squeezer');
      this.instruments.posca_squeezer.applyPreset(presetId);
    } else if (CURVED_RULING_PRESETS[presetId]) {
      this.setInstrument('ruling_pen_curved');
      this.instruments.ruling_pen_curved.applyPreset(presetId);
    } else if (FLAT_RULING_PRESETS[presetId]) {
      this.setInstrument('ruling_pen_flat');
      this.instruments.ruling_pen_flat.applyPreset(presetId);
    }
    this._emitTelemetry();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Universal Calibration & Overprint Setters (v3.9)
  // ═══════════════════════════════════════════════════════════════════════════

  setBlendMode(mode) {
    this.overprintBlender.setBlendMode(mode);
    this._emitTelemetry();
  }

  setInkDensity(density) {
    this.overprintBlender.setInkDensity(density);
    this._emitTelemetry();
  }

  setOverprintDarken(darken) {
    this.overprintBlender.setOverprintDarken(darken);
    this._emitTelemetry();
  }

  // 4.0: the active instrument's crossing swell (each ink its own: ruling pens 5 %, Zig 7.5 %, Posca 10 % by default)
  setOverprintSwell(swell) {
    const n = Number(swell);
    if (!Number.isFinite(n)) return;
    const v = Math.max(0, Math.min(0.35, n));
    if (this.activeInstrument) this.activeInstrument.overprintSwell = v;
    this._emitTelemetry();
  }

  // 4.0: one instrument's crossing swell, by id
  setInstrumentSwell(instrumentId, swell) {
    const inst = this.instruments[instrumentId], n = Number(swell);
    if (inst && Number.isFinite(n)) inst.overprintSwell = Math.max(0, Math.min(0.35, n));
  }

  setOverprintModel(model) {
    this.overprintBlender.setOverprintModel(model);
    this._emitTelemetry();
  }

  setOverprintAttack(v) {
    this.overprintBlender.setOverprintAttack(v);
    this._emitTelemetry();
  }

  setOverprintRelease(v) {
    this.overprintBlender.setOverprintRelease(v);
    this._emitTelemetry();
  }

  setOverprintReach(v) {
    this.overprintBlender.setOverprintReach(v);
    this._emitTelemetry();
  }

  setBlendIntensity(v) {
    this.setOverprintDarken(v);
  }

  // 4.0: the paper's colour ('mix': what shows through the ink; also what clear() paints, unless transparent)
  setPaperColor(color) {
    this.overprintBlender.setPaperColor(color);
    this._emitTelemetry();
  }

  setOverprint(opts = {}) {
    if (!opts || typeof opts !== 'object') return;
    const { overprintSwell, ...rest } = opts;
    this.overprintBlender.setOverprint(rest);
    if (overprintSwell !== undefined) this.setOverprintSwell(overprintSwell);
    this._emitTelemetry();
  }

  setNibRadius(radius) {
    this.activeInstrument.baseRadius = Math.max(1.0, radius);
    this._emitTelemetry();
  }

  setSizeScale(scale) {
    this.activeInstrument.sizeScale = Math.max(0.2, scale);
    this._emitTelemetry();
  }

  setColor(color) {
    this.color = color;
    this.activeInstrument.color = color;
    for (const inst of Object.values(this.instruments)) {
      inst.color = color;
    }
  }

  setPaperTooth(tooth) {
    this.paperTooth = tooth;
    for (const inst of Object.values(this.instruments)) {
      inst.paperTooth = tooth;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Chinese Brush Setters (v2)
  // ═══════════════════════════════════════════════════════════════════════════

  setSlowEngorgeRatio(ratio) {
    this.activeInstrument.slowEngorgeRatio = Math.max(1.0, ratio);
  }

  setFastThinRatio(ratio) {
    if (this.instruments.chinese_brush) {
      this.instruments.chinese_brush.fastThinRatio = Math.max(0.05, Math.min(1.0, ratio));
    }
  }

  setDepletionRate(rate) {
    if (this.instruments.chinese_brush) {
      this.instruments.chinese_brush.depletionRate = Math.max(0.1, rate);
    }
  }

  setRefillRate(rate) {
    if (this.instruments.chinese_brush) {
      this.instruments.chinese_brush.refillRate = Math.max(0.2, rate);
    }
  }

  setStarveEaseIn(easeIn) {
    if (this.instruments.chinese_brush) {
      this.instruments.chinese_brush.starveEaseIn = Math.max(20, easeIn);
    }
  }

  setStarveEaseOut(easeOut) {
    if (this.instruments.chinese_brush) {
      this.instruments.chinese_brush.starveEaseOut = Math.max(20, easeOut);
    }
  }

  setBristleCount(count) {
    if (this.instruments.chinese_brush) {
      this.instruments.chinese_brush.numBristles = Math.max(12, Math.min(64, Math.round(count)));
      this.instruments.chinese_brush._initBristles();
    }
  }

  setBoneHeadFlare(flare) {
    if (this.instruments.chinese_brush) {
      this.instruments.chinese_brush.boneHeadFlare = Math.max(1.0, flare);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Posca Squeezer Setters (v3)
  // ═══════════════════════════════════════════════════════════════════════════

  setFastWaistRatio(ratio) {
    if (this.instruments.posca_squeezer) {
      this.instruments.posca_squeezer.fastWaistRatio = Math.max(0.5, Math.min(1.0, ratio));
    }
  }

  setBorderStarveSensitivity(val) {
    if (this.instruments.posca_squeezer) {
      this.instruments.posca_squeezer.borderStarveSensitivity = Math.max(0.0, val);
    }
  }

  setDripThreshold(val) {
    if (this.instruments.posca_squeezer) {
      this.instruments.posca_squeezer.dripThreshold = Math.max(0.1, val);
    }
  }

  setFlowRate(rate) {
    if (this.instruments.posca_squeezer) {
      this.instruments.posca_squeezer.flowRate = Math.max(0.5, rate);
    }
  }

  setViscosity(visc) {
    if (this.instruments.posca_squeezer) {
      this.instruments.posca_squeezer.viscosity = Math.max(0.1, Math.min(0.9, visc));
    }
  }

  setInitialDomeFlare(flare) {
    if (this.instruments.posca_squeezer) {
      this.instruments.posca_squeezer.initialDomeFlare = Math.max(1.0, flare);
    }
  }

  setDripWidthRatio(ratio) {
    if (this.instruments.posca_squeezer) {
      this.instruments.posca_squeezer.setDripWidthRatio(ratio);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Ruling Pen Setters (Curved & Flat)
  // ═══════════════════════════════════════════════════════════════════════════

  setBladeAngle(angle) {
    if (this.instruments.ruling_pen_curved) this.instruments.ruling_pen_curved.setBladeAngle(angle);
    if (this.instruments.ruling_pen_flat) this.instruments.ruling_pen_flat.setBladeAngle(angle);
  }

  setChatterIntensity(val) {
    if (this.activeInstrument.setChatterIntensity) {
      this.activeInstrument.setChatterIntensity(val);
    }
  }

  setSnapIntensity(val) {
    if (this.activeInstrument.setSnapIntensity) {
      this.activeInstrument.setSnapIntensity(val);
    }
  }

  setSkipSensitivity(val) {
    if (this.activeInstrument.setSkipSensitivity) {
      this.activeInstrument.setSkipSensitivity(val);
    }
  }

  setEdgeAsymmetry(val) {
    if (this.instruments.ruling_pen_flat) {
      this.instruments.ruling_pen_flat.setEdgeAsymmetry(val);
    }
  }

  setAsymmetrySide(side) {
    if (this.instruments.ruling_pen_flat) {
      this.instruments.ruling_pen_flat.setAsymmetrySide(side);
    }
  }

  setPenMode(mode) {
    if (this.activeInstrument.setPenMode) {
      this.activeInstrument.setPenMode(mode);
    }
  }

  setMinWidthScale(val) {
    if (this.instruments.ruling_pen_curved) this.instruments.ruling_pen_curved.setMinWidthScale(val);
    if (this.instruments.ruling_pen_flat) this.instruments.ruling_pen_flat.setMinWidthScale(val);
  }

  setMaxWidthScale(val) {
    if (this.instruments.ruling_pen_curved) this.instruments.ruling_pen_curved.setMaxWidthScale(val);
    if (this.instruments.ruling_pen_flat) this.instruments.ruling_pen_flat.setMaxWidthScale(val);
  }

  setMinSpitCount(val) {
    if (this.instruments.ruling_pen_curved) this.instruments.ruling_pen_curved.setMinSpitCount(val);
    if (this.instruments.ruling_pen_flat) this.instruments.ruling_pen_flat.setMinSpitCount(val);
  }

  setMaxSpitCount(val) {
    if (this.instruments.ruling_pen_curved) this.instruments.ruling_pen_curved.setMaxSpitCount(val);
    if (this.instruments.ruling_pen_flat) this.instruments.ruling_pen_flat.setMaxSpitCount(val);
  }

  setMaxDropletSize(val) {
    if (this.instruments.ruling_pen_curved) this.instruments.ruling_pen_curved.setMaxDropletSize(val);
    if (this.instruments.ruling_pen_flat) this.instruments.ruling_pen_flat.setMaxDropletSize(val);
  }

  setBurstExplosionWidth(val) {
    if (this.instruments.ruling_pen_curved) this.instruments.ruling_pen_curved.setBurstExplosionWidth(val);
    if (this.instruments.ruling_pen_flat) this.instruments.ruling_pen_flat.setBurstExplosionWidth(val);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Canvas Lifecycle
  // ═══════════════════════════════════════════════════════════════════════════

  _setupCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || this.canvas.width;
    const h = rect.height || this.canvas.height;

    this.width = w;
    this.height = h;

    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // 4.0: the overprint grid covers the whole canvas (3.9 kept the blender's default 1600 × 1200: past it, on a large
    // screen, strokes never overprinted)
    this.overprintBlender.resize(w, h);
    this.clear(false);
  }

  resize() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.canvas.width;
    tempCanvas.height = this.canvas.height;
    tempCanvas.getContext('2d').drawImage(this.canvas, 0, 0);

    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this._paintPaper();
    this.ctx.drawImage(tempCanvas, 0, 0, this.width, this.height);

    // 4.0: the grid follows the new size and the redrawn ink (one read-back of the canvas, on resize only)
    this.overprintBlender.resize(this.width, this.height);
    this.overprintBlender.clear();
    try {
      const img = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      this.overprintBlender.rebuildFromImageData(img, { scale: this.dpr, mode: this.transparent ? 'alpha' : 'paper' });
    } catch (_) { /* a tainted or lost canvas: start without overprint memory */ }
  }

  _paintPaper() {
    this.ctx.save();
    if (this.transparent) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    } else {
      this.ctx.fillStyle = this.overprintBlender.paperColor || '#ffffff';
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
    this.ctx.restore();
  }

  clear(saveState = true) {
    this._paintPaper();

    this.fluidDynamics.activeDrips = [];
    if (this.overprintBlender) {
      this.overprintBlender.clear();
    }

    if (saveState) {
      this._saveHistoryState();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Pointer Event Input
  // ═══════════════════════════════════════════════════════════════════════════

  pointerDown(x, y, pressure = 0.5, event = null) {
    this.isStrokeActive = true;
    this._lastPointerTime = performance.now();
    const point = {
      x,
      y,
      pressure: pressure || (event && event.pressure > 0 ? event.pressure : 0.5),
      time: this._lastPointerTime,
    };

    this.activeInstrument.down(point, this.ctx, this.fluidDynamics);
    this._emitTelemetry();
  }

  pointerMove(x, y, pressure = 0.5, event = null) {
    if (!this.isStrokeActive) return;

    const now = performance.now();
    const elapsed = this._lastPointerTime == null ? 0.016 : (now - this._lastPointerTime) / 1000;
    const dt = (elapsed > 0.002 && elapsed < 0.1) ? elapsed : 0.016;
    this._lastPointerTime = now;

    const point = {
      x,
      y,
      pressure: pressure || (event && event.pressure > 0 ? event.pressure : 0.5),
      time: now,
    };

    this.activeInstrument.move(point, dt, this.ctx, this.fluidDynamics);
    this._emitTelemetry();
  }

  pointerUp(x, y) {
    if (!this.isStrokeActive) return;
    this.isStrokeActive = false;

    this.activeInstrument.up({ x, y, time: performance.now() }, this.ctx, this.fluidDynamics);
    this._lastPointerTime = null;
    this._saveHistoryState();
    this._emitTelemetry();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Physics Animation Loop (Gravity Drips & Realtime Telemetry)
  // ═══════════════════════════════════════════════════════════════════════════

  _startLoop() {
    if (typeof requestAnimationFrame === 'undefined') return;
    const loop = (now) => {
      const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
      this.lastFrameTime = now;

      // Update active gravity drips from squeezer pooling (4.0: drawn and recorded by the blender)
      if (this.fluidDynamics && this.fluidDynamics.activeDrips.length > 0) {
        this.ctx.save();
        this.fluidDynamics.updateDrips(dt, (seg) => {
          this.overprintBlender.paintDripSegment(this.ctx, seg);
        });
        this.ctx.restore();
        this._emitTelemetry();
      }

      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  destroy() {
    if (this.animId && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animId);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Undo / Redo
  // ═══════════════════════════════════════════════════════════════════════════

  _saveHistoryState() {
    if (this.historyIndex < this.history.length - 1) {
      for (const h of this.history.slice(this.historyIndex + 1)) this.historyBytes -= h.bytes;
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    // 4.0: the pixels and the overprint grid together (3.9: pixels only — after an undo, later strokes still
    // overprinted the ink that had been taken away)
    const img = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const grid = this.overprintBlender ? this.overprintBlender.cloneSnapshot() : null;
    const bytes = img.data.length + (grid ? grid.cellStrokeId.length * 14 : 0);
    this.history.push({ img, grid, bytes });
    this.historyBytes += bytes;
    if (this.history.length > this.maxHistory) {
      this.historyBytes -= this.history.shift().bytes;
    } else {
      this.historyIndex++;
    }
    // ... and never more than maxHistoryBytes (a large canvas at 2× DPR is ~20 MB a state)
    while (this.history.length > 2 && this.historyBytes > this.maxHistoryBytes) {
      this.historyBytes -= this.history.shift().bytes;
      this.historyIndex = Math.max(0, this.historyIndex - 1);
    }
  }

  _restoreHistoryState(h) {
    this.ctx.putImageData(h.img, 0, 0);
    if (this.overprintBlender) {
      if (h.grid) this.overprintBlender.restoreSnapshot(h.grid);
      else this.overprintBlender.clear();
      this.overprintBlender.activeStates.clear();
    }
    if (this.fluidDynamics) this.fluidDynamics.activeDrips = [];
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this._restoreHistoryState(this.history[this.historyIndex]);
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this._restoreHistoryState(this.history[this.historyIndex]);
    }
  }

  _emitTelemetry() {
    if (!this.onTelemetry) return;
    const t = this.activeInstrument.getTelemetry();
    if (this.overprintBlender) {
      t.overprintModel = this.overprintBlender.overprintModel;
      t.blendMode = this.overprintBlender.blendMode;
      t.inkDensity = `${Math.round(this.overprintBlender.inkDensity * 100)}%`;
      t.overprintDarken = `${Math.round(this.overprintBlender.overprintDarken * 100)}%`;
      t.overprintSwell = `+${(this.overprintSwell * 100).toFixed(1).replace(/\.0$/, '')}%`;
    }
    this.onTelemetry(t);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Settings Serialization & Persistence
  // ═══════════════════════════════════════════════════════════════════════════

  exportSettings() {
    return {
      version: '4.0',
      activeInstrumentId: this.activeInstrumentId,
      activePresetId: this.activeInstrument.activePresetId,
      paperTooth: this.paperTooth,
      overprintModel: this.overprintBlender.overprintModel,
      blendMode: this.overprintBlender.blendMode,
      inkDensity: this.overprintBlender.inkDensity,
      overprintDarken: this.overprintBlender.overprintDarken,
      overprintAttack: this.overprintBlender.overprintAttack,
      overprintRelease: this.overprintBlender.overprintRelease,
      overprintReach: this.overprintBlender.overprintReach,
      paperColor: this.overprintBlender.paperColor,
      // the active instrument's (each instrument block keeps its own)
      overprintSwell: this.overprintSwell,
      chinese_brush: {
        presetId: this.instruments.chinese_brush.activePresetId,
        overprintSwell: this.instruments.chinese_brush.overprintSwell,
        baseRadius: this.instruments.chinese_brush.baseRadius,
        slowEngorgeRatio: this.instruments.chinese_brush.slowEngorgeRatio,
        fastThinRatio: this.instruments.chinese_brush.fastThinRatio,
        depletionRate: this.instruments.chinese_brush.depletionRate,
        refillRate: this.instruments.chinese_brush.refillRate,
        starveEaseIn: this.instruments.chinese_brush.starveEaseIn,
        starveEaseOut: this.instruments.chinese_brush.starveEaseOut,
        numBristles: this.instruments.chinese_brush.numBristles,
        boneHeadFlare: this.instruments.chinese_brush.boneHeadFlare,
      },
      posca_squeezer: {
        presetId: this.instruments.posca_squeezer.activePresetId,
        overprintSwell: this.instruments.posca_squeezer.overprintSwell,
        baseRadius: this.instruments.posca_squeezer.baseRadius,
        slowEngorgeRatio: this.instruments.posca_squeezer.slowEngorgeRatio,
        fastWaistRatio: this.instruments.posca_squeezer.fastWaistRatio,
        flowRate: this.instruments.posca_squeezer.flowRate,
        viscosity: this.instruments.posca_squeezer.viscosity,
        dripThreshold: this.instruments.posca_squeezer.dripThreshold,
        borderStarveSensitivity: this.instruments.posca_squeezer.borderStarveSensitivity,
        initialDomeFlare: this.instruments.posca_squeezer.initialDomeFlare,
        dripWidthRatio: this.instruments.posca_squeezer.dripWidthRatio,
      },
      ruling_pen_curved: {
        presetId: this.instruments.ruling_pen_curved.activePresetId,
        overprintSwell: this.instruments.ruling_pen_curved.overprintSwell,
        penMode: this.instruments.ruling_pen_curved.penMode,
        baseRadius: this.instruments.ruling_pen_curved.baseRadius,
        slowEngorgeRatio: this.instruments.ruling_pen_curved.slowEngorgeRatio,
        fastThinRatio: this.instruments.ruling_pen_curved.fastThinRatio,
        chatterIntensity: this.instruments.ruling_pen_curved.chatterIntensity,
        skipSensitivity: this.instruments.ruling_pen_curved.skipSensitivity,
        snapIntensity: this.instruments.ruling_pen_curved.snapIntensity,
        bladeAngle: this.instruments.ruling_pen_curved.bladeAngle,
        minWidthScale: this.instruments.ruling_pen_curved.minWidthScale,
        maxWidthScale: this.instruments.ruling_pen_curved.maxWidthScale,
        minSpitCount: this.instruments.ruling_pen_curved.minSpitCount,
        maxSpitCount: this.instruments.ruling_pen_curved.maxSpitCount,
        maxDropletSize: this.instruments.ruling_pen_curved.maxDropletSize,
        burstExplosionWidth: this.instruments.ruling_pen_curved.burstExplosionWidth,
      },
      ruling_pen_flat: {
        presetId: this.instruments.ruling_pen_flat.activePresetId,
        overprintSwell: this.instruments.ruling_pen_flat.overprintSwell,
        penMode: this.instruments.ruling_pen_flat.penMode,
        baseRadius: this.instruments.ruling_pen_flat.baseRadius,
        slowEngorgeRatio: this.instruments.ruling_pen_flat.slowEngorgeRatio,
        fastThinRatio: this.instruments.ruling_pen_flat.fastThinRatio,
        chatterIntensity: this.instruments.ruling_pen_flat.chatterIntensity,
        edgeAsymmetry: this.instruments.ruling_pen_flat.edgeAsymmetry,
        asymmetrySide: this.instruments.ruling_pen_flat.asymmetrySide,
        skipSensitivity: this.instruments.ruling_pen_flat.skipSensitivity,
        snapIntensity: this.instruments.ruling_pen_flat.snapIntensity,
        bladeAngle: this.instruments.ruling_pen_flat.bladeAngle,
        minWidthScale: this.instruments.ruling_pen_flat.minWidthScale,
        maxWidthScale: this.instruments.ruling_pen_flat.maxWidthScale,
        minSpitCount: this.instruments.ruling_pen_flat.minSpitCount,
        maxSpitCount: this.instruments.ruling_pen_flat.maxSpitCount,
        maxDropletSize: this.instruments.ruling_pen_flat.maxDropletSize,
        burstExplosionWidth: this.instruments.ruling_pen_flat.burstExplosionWidth,
      },
    };
  }

  applySettings(s) {
    if (!s || typeof s !== 'object') return;

    if (typeof s.paperTooth === 'number') {
      this.setPaperTooth(s.paperTooth);
    }

    // Restore Overprint & Blending state (v3.9; 4.0: the mix model's settings)
    if (s.overprintModel !== undefined) {
      this.setOverprintModel(s.overprintModel);
    }
    if (s.blendMode !== undefined) {
      this.setBlendMode(s.blendMode);
    }
    if (typeof s.inkDensity === 'number') {
      this.setInkDensity(s.inkDensity);
    }
    if (typeof s.overprintDarken === 'number') {
      this.setOverprintDarken(s.overprintDarken);
    }
    if (typeof s.overprintAttack === 'number') this.setOverprintAttack(s.overprintAttack);
    if (typeof s.overprintRelease === 'number') this.setOverprintRelease(s.overprintRelease);
    if (typeof s.overprintReach === 'number') this.setOverprintReach(s.overprintReach);
    if (typeof s.paperColor === 'string') this.setPaperColor(s.paperColor);
    // a 3.9 object had one swell for all (4.0: each instrument block has its own, applied below)
    const perInstrumentSwell = ['chinese_brush', 'posca_squeezer', 'ruling_pen_curved', 'ruling_pen_flat']
      .some((k) => s[k] && typeof s[k].overprintSwell === 'number');
    if (typeof s.overprintSwell === 'number' && !perInstrumentSwell) {
      for (const id of Object.keys(this.instruments)) this.setInstrumentSwell(id, s.overprintSwell);
    }

    // Restore Chinese brush state
    if (s.chinese_brush && typeof s.chinese_brush === 'object') {
      const cb = this.instruments.chinese_brush;
      const cs = s.chinese_brush;
      if (cs.presetId && ZIG_PRESETS[cs.presetId]) cb.applyPreset(cs.presetId);
      if (typeof cs.overprintSwell === 'number') this.setInstrumentSwell('chinese_brush', cs.overprintSwell);
      if (typeof cs.baseRadius === 'number') cb.baseRadius = cs.baseRadius;
      if (typeof cs.slowEngorgeRatio === 'number') cb.slowEngorgeRatio = cs.slowEngorgeRatio;
      if (typeof cs.fastThinRatio === 'number') cb.fastThinRatio = cs.fastThinRatio;
      if (typeof cs.depletionRate === 'number') cb.depletionRate = cs.depletionRate;
      if (typeof cs.refillRate === 'number') cb.refillRate = cs.refillRate;
      if (typeof cs.starveEaseIn === 'number') cb.starveEaseIn = cs.starveEaseIn;
      if (typeof cs.starveEaseOut === 'number') cb.starveEaseOut = cs.starveEaseOut;
      if (typeof cs.numBristles === 'number') {
        cb.numBristles = cs.numBristles;
        cb._initBristles();
      }
      if (typeof cs.boneHeadFlare === 'number') cb.boneHeadFlare = cs.boneHeadFlare;
    } else if (s.presetId && ZIG_PRESETS[s.presetId]) {
      // Backward compatibility with v2 format
      this.instruments.chinese_brush.applyPreset(s.presetId);
      if (typeof s.baseRadius === 'number') this.instruments.chinese_brush.baseRadius = s.baseRadius;
    }

    // Restore Posca squeezer state
    if (s.posca_squeezer && typeof s.posca_squeezer === 'object') {
      const ps = this.instruments.posca_squeezer;
      const ss = s.posca_squeezer;
      if (ss.presetId && POSCA_PRESETS[ss.presetId]) ps.applyPreset(ss.presetId);
      if (typeof ss.overprintSwell === 'number') this.setInstrumentSwell('posca_squeezer', ss.overprintSwell);
      if (typeof ss.baseRadius === 'number') ps.baseRadius = ss.baseRadius;
      if (typeof ss.slowEngorgeRatio === 'number') ps.slowEngorgeRatio = ss.slowEngorgeRatio;
      if (typeof ss.fastWaistRatio === 'number') ps.fastWaistRatio = ss.fastWaistRatio;
      if (typeof ss.flowRate === 'number') ps.flowRate = ss.flowRate;
      if (typeof ss.viscosity === 'number') ps.viscosity = ss.viscosity;
      if (typeof ss.dripThreshold === 'number') ps.dripThreshold = ss.dripThreshold;
      if (typeof ss.borderStarveSensitivity === 'number') ps.borderStarveSensitivity = ss.borderStarveSensitivity;
      if (typeof ss.initialDomeFlare === 'number') ps.initialDomeFlare = ss.initialDomeFlare;
      if (typeof ss.dripWidthRatio === 'number') ps.setDripWidthRatio(ss.dripWidthRatio);
    }

    // Restore Curved ruling pen state
    if (s.ruling_pen_curved && typeof s.ruling_pen_curved === 'object') {
      const rc = this.instruments.ruling_pen_curved;
      const rcs = s.ruling_pen_curved;
      if (rcs.presetId && CURVED_RULING_PRESETS[rcs.presetId]) rc.applyPreset(rcs.presetId);
      if (typeof rcs.overprintSwell === 'number') this.setInstrumentSwell('ruling_pen_curved', rcs.overprintSwell);
      if (rcs.penMode) rc.setPenMode(rcs.penMode);
      if (typeof rcs.baseRadius === 'number') rc.baseRadius = rcs.baseRadius;
      if (typeof rcs.slowEngorgeRatio === 'number') rc.slowEngorgeRatio = rcs.slowEngorgeRatio;
      if (typeof rcs.fastThinRatio === 'number') rc.fastThinRatio = rcs.fastThinRatio;
      if (typeof rcs.chatterIntensity === 'number') rc.chatterIntensity = rcs.chatterIntensity;
      if (typeof rcs.skipSensitivity === 'number') rc.skipSensitivity = rcs.skipSensitivity;
      if (typeof rcs.snapIntensity === 'number') rc.snapIntensity = rcs.snapIntensity;
      if (typeof rcs.bladeAngle === 'number') rc.bladeAngle = rcs.bladeAngle;
      if (typeof rcs.minWidthScale === 'number') rc.setMinWidthScale(rcs.minWidthScale);
      if (typeof rcs.maxWidthScale === 'number') rc.setMaxWidthScale(rcs.maxWidthScale);
      if (typeof rcs.minSpitCount === 'number') rc.setMinSpitCount(rcs.minSpitCount);
      if (typeof rcs.maxSpitCount === 'number') rc.setMaxSpitCount(rcs.maxSpitCount);
      if (typeof rcs.maxDropletSize === 'number') rc.setMaxDropletSize(rcs.maxDropletSize);
      if (typeof rcs.burstExplosionWidth === 'number') rc.setBurstExplosionWidth(rcs.burstExplosionWidth);
    }

    // Restore Flat ruling pen state
    if (s.ruling_pen_flat && typeof s.ruling_pen_flat === 'object') {
      const rf = this.instruments.ruling_pen_flat;
      const rfs = s.ruling_pen_flat;
      if (rfs.presetId && FLAT_RULING_PRESETS[rfs.presetId]) rf.applyPreset(rfs.presetId);
      if (typeof rfs.overprintSwell === 'number') this.setInstrumentSwell('ruling_pen_flat', rfs.overprintSwell);
      if (rfs.penMode) rf.setPenMode(rfs.penMode);
      if (typeof rfs.baseRadius === 'number') rf.baseRadius = rfs.baseRadius;
      if (typeof rfs.slowEngorgeRatio === 'number') rf.slowEngorgeRatio = rfs.slowEngorgeRatio;
      if (typeof rfs.fastThinRatio === 'number') rf.fastThinRatio = rfs.fastThinRatio;
      if (typeof rfs.chatterIntensity === 'number') rf.chatterIntensity = rfs.chatterIntensity;
      if (typeof rfs.edgeAsymmetry === 'number') rf.edgeAsymmetry = rfs.edgeAsymmetry;
      if (rfs.asymmetrySide) rf.setAsymmetrySide(rfs.asymmetrySide);
      if (typeof rfs.skipSensitivity === 'number') rf.skipSensitivity = rfs.skipSensitivity;
      if (typeof rfs.snapIntensity === 'number') rf.snapIntensity = rfs.snapIntensity;
      if (typeof rfs.bladeAngle === 'number') rf.bladeAngle = rfs.bladeAngle;
      if (typeof rfs.minWidthScale === 'number') rf.setMinWidthScale(rfs.minWidthScale);
      if (typeof rfs.maxWidthScale === 'number') rf.setMaxWidthScale(rfs.maxWidthScale);
      if (typeof rfs.minSpitCount === 'number') rf.setMinSpitCount(rfs.minSpitCount);
      if (typeof rfs.maxSpitCount === 'number') rf.setMaxSpitCount(rfs.maxSpitCount);
      if (typeof rfs.maxDropletSize === 'number') rf.setMaxDropletSize(rfs.maxDropletSize);
      if (typeof rfs.burstExplosionWidth === 'number') rf.setBurstExplosionWidth(rfs.burstExplosionWidth);
    }

    // Set active instrument
    if (s.activeInstrumentId && this.instruments[s.activeInstrumentId]) {
      this.setInstrument(s.activeInstrumentId);
    }

    // Set active preset — 4.0: only when that instrument's own block did not already restore it (3.9 re-applied the
    // preset last, so the active instrument's tuned values were thrown away on every reload)
    if (s.activePresetId) {
      const owner = ZIG_PRESETS[s.activePresetId] ? 'chinese_brush'
        : POSCA_PRESETS[s.activePresetId] ? 'posca_squeezer'
        : CURVED_RULING_PRESETS[s.activePresetId] ? 'ruling_pen_curved'
        : FLAT_RULING_PRESETS[s.activePresetId] ? 'ruling_pen_flat'
        : null;
      if (owner && s[owner] && typeof s[owner] === 'object') this.setInstrument(owner);
      else if (owner) this.setPreset(s.activePresetId);
    }

    this._emitTelemetry();
  }

  /**
   * 4.0: the settings of one instrument (its preset + every tuned value), in the shape of an exportSettings() block —
   * what a user preset keeps.
   */
  exportInstrumentSettings(instrumentId = this.activeInstrumentId) {
    const all = this.exportSettings();
    return all[instrumentId] ? { ...all[instrumentId] } : null;
  }

  exportPNG() {
    return this.canvas.toDataURL('image/png');
  }
}
