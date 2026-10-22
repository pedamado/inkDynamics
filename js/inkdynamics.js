// ═══════════════════════════════════════════════════════════════════════════
// INK DYNAMICS LIBRARY (v4.0) — inkdynamics.js
// Standalone physical ink drawing library — and the instruments a host app (Inkwell 20) drives itself.
// Supports:
// 1. Zig Chinese Calligraphy Brush (v2) with multi-bristle capillary dynamics
// 2. Posca Mop Squeezer (v3) with longitudinal dense acrylic flow and gravity drips
// 3. Curved & Flat Ruling Pens (v3.8) with blade chatter, train tracks and spit bursts
// 4. Ink that mixes (v4.0): slightly transparent (inkDensity 0.97), overprinting where strokes cross
// 5. Multi-agent / Boid parallel stroke channels — each agent with the main pen or a pen of its own (v4.0)
// 6. User presets kept for good (v4.0: UserPresetStore; the 13 core presets are permanent)
// 7. Pluggable into standalone HTML5 canvases, Inkwell 20 (docs/INKWELL_INTEGRATION.md), or custom drawing engines
// Concept and design: Pedro Amado (FBAUP / i2ADS). Development: Google Gemini 3.8 Flash in Antigravity and
// Anthropic Claude Opus 5.5 (October 2026). SiX — FCT 2023.11224.PEX.
// ═══════════════════════════════════════════════════════════════════════════

import {
  InkDynamicsEngine,
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
} from './InkDynamicsEngine.js';
import { OVERPRINT_DEFAULTS, OVERPRINT_RANGES, CLASSIC_39 } from './physics/OverprintBlender.js';
import { InkRecorder, INK_OPS } from './core/InkRecorder.js';
import {
  parseInkSettings, validateInkSettings, formatInkSettings, INK_SETTING_KEYS, INK_SETTING_ALIASES, INK_TOOLS,
  INK_THICKNESS_TOKENS,
} from './core/SettingsParser.js';
import { INK_INSTRUMENTS, CORE_PRESETS, corePreset, toolOfPreset, isCorePreset, listPresets, presetToConfig } from './presets/PresetCatalog.js';
import { UserPresetStore, localStorageAdapter, memoryAdapter, httpAdapter, normalizeUserPreset, USER_PRESET_LIMIT } from './presets/UserPresetStore.js';

export const VERSION = '4.0.0';

export {
  InkDynamicsEngine,
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
  // 4.0
  OVERPRINT_DEFAULTS,
  OVERPRINT_RANGES,
  CLASSIC_39,
  InkRecorder,
  INK_OPS,
  parseInkSettings,
  validateInkSettings,
  formatInkSettings,
  INK_SETTING_KEYS,
  INK_SETTING_ALIASES,
  INK_TOOLS,
  INK_THICKNESS_TOKENS,
  INK_INSTRUMENTS,
  CORE_PRESETS,
  corePreset,
  toolOfPreset,
  isCorePreset,
  listPresets,
  presetToConfig,
  UserPresetStore,
  localStorageAdapter,
  memoryAdapter,
  httpAdapter,
  normalizeUserPreset,
  USER_PRESET_LIMIT,
};

// ── Inkwell 18/19 Token Maps ────────────────────────────────────────────────
// (Inkwell 20 passes its palettes' hex colours directly: any '#rrggbb' or 'rgb()' colour is taken as it is.)
export const INKWELL_COLORS = {
  black: '#191817', // Inkwell dark token
  red: '#b8261a',   // Inkwell deep red
  blue: '#1d3a6e',  // Inkwell navy
  white: '#ffffff', // Inkwell white
};

export const INKWELL_THICKNESS = {
  hairline: { chinese_brush: 1.8,  posca_squeezer: 4.0,  ruling_pen_curved: 1.25, ruling_pen_flat: 1.0 },
  thin:     { chinese_brush: 3.5,  posca_squeezer: 6.0,  ruling_pen_curved: 3.5,  ruling_pen_flat: 4.0 },   // Posca Thin Ø 12px
  medium:   { chinese_brush: 8.0,  posca_squeezer: 12.0, ruling_pen_curved: 7.0,  ruling_pen_flat: 8.0 },   // Posca Medium Ø 24px
  thick:    { chinese_brush: 14.0, posca_squeezer: 22.0, ruling_pen_curved: 13.0, ruling_pen_flat: 14.0 },  // Posca Thick Ø 44px
  broad:    { chinese_brush: 22.0, posca_squeezer: 30.0, ruling_pen_curved: 18.0, ruling_pen_flat: 20.0 },
};

const PEN_CLASSES = {
  chinese_brush: ChineseBrushV2,
  posca_squeezer: PoscaSqueezerV3,
  ruling_pen_curved: RulingPenCurved,
  ruling_pen_flat: RulingPenFlat,
};
const CORE_IDS = CORE_PRESETS.map((p) => p.id);

/**
 * 4.0: applies an instrument's own parameters (Zig: depletionRate, numBristles…; Posca: viscosity, dripThreshold…;
 * ruling pens: bladeAngle, penMode…) to one instrument — validated, through its own setters where it has them.
 * (3.9: createInkDynamics() and setConfig() read only some of them, so most of the lab's snippet was ignored.)
 */
export function applyInstrumentParams(inst, toolId, cfg) {
  if (!inst || !cfg) return;
  const { settings } = validateInkSettings(cfg, { colorTokens: INKWELL_COLORS });
  for (const [k, v] of Object.entries(settings)) {
    const spec = INK_SETTING_KEYS[k];
    if (!spec || spec.for === '*' || !spec.for.includes(toolId)) continue;
    const setter = 'set' + k[0].toUpperCase() + k.slice(1);
    if (k === 'numBristles') {
      inst.numBristles = v;
      if (typeof inst._initBristles === 'function') inst._initBristles();
    } else if (typeof inst[setter] === 'function') {
      inst[setter](v);
    } else if (k in inst) {
      inst[k] = v;
    }
  }
  if (typeof settings.overprintSwell === 'number') inst.overprintSwell = settings.overprintSwell;
}

/**
 * InkDynamics Library Controller
 * High-level wrapper designed for clean 1-line integration into host web apps.
 */
export class InkDynamicsInstance {
  constructor(options = {}) {
    this.options = {
      tool: 'chinese_brush',
      preset: null,
      thickness: 'medium',
      color: '#191817',
      paperTooth: 0.45,
      ...OVERPRINT_DEFAULTS,
      dripWidthRatio: 0.32,
      autoStep: true,
      onMark: null,
      onTelemetry: null,
      ...options,
    };
    if (options.blendIntensity !== undefined && options.overprintDarken === undefined) this.options.overprintDarken = options.blendIntensity;

    // Canvas & Engine Initialization
    if (this.options.canvas) {
      this.canvas = this.options.canvas;
    } else if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.options.width || 800;
      this.canvas.height = this.options.height || 600;
    } else {
      this.canvas = null;
    }

    this.engine = new InkDynamicsEngine(this.canvas, {
      initialTool: this.options.tool,
      paperTooth: this.options.paperTooth,
      color: this._resolveColor(this.options.color),
      overprintModel: this.options.overprintModel,
      blendMode: this.options.blendMode,
      inkDensity: this.options.inkDensity,
      overprintDarken: this.options.overprintDarken,
      overprintSwell: this.options.overprintSwell,
      overprintAttack: this.options.overprintAttack,
      overprintRelease: this.options.overprintRelease,
      overprintReach: this.options.overprintReach,
      paperColor: this.options.paperColor,
      transparent: this.options.transparent,
      onTelemetry: this.options.onTelemetry,
    });

    // Multi-agent (Boid) stroke channels
    // Allows 1 to 8 boids to draw simultaneously without stroke cross-talk
    this.agentPens = new Map();
    this.agentOwn = new Set();     // 4.0: agents with a pen of their own (setAgentPen)
    this.lastAgentTimes = new Map();

    // Tool, preset, thickness, colour, overprint and every instrument parameter given (4.0: all of them)
    const { overprintSwell, ...rest } = this.options;
    this.setConfig({ ...rest, tool: this.options.tool || 'chinese_brush', preset: this.options.preset || undefined });
    // the swell, unless given, stays each instrument's own (ruling 5 %, Zig 7.5 %, Posca 10 %)
    if (options.overprintSwell !== undefined) this.setOverprintSwell(overprintSwell);
    // as 3.9: a drip width given at creation is the Posca's, whichever instrument starts
    if (options.dripWidthRatio !== undefined) this.engine.setDripWidthRatio(options.dripWidthRatio);

    // Host-driven vs Auto animation loop
    if (!this.options.autoStep && this.engine.animId) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.engine.animId);
        this.engine.animId = null;
      }
    }
  }

  // ── Color & Thickness Resolvers ───────────────────────────────────────────

  _resolveColor(color) {
    if (!color) return '#191817';
    if (typeof color === 'string' && INKWELL_COLORS[color.toLowerCase()]) {
      return INKWELL_COLORS[color.toLowerCase()];
    }
    return color;
  }

  _resolveRadius(thickness, toolId = null) {
    const curTool = toolId || this.engine.activeInstrumentId;
    if (typeof thickness === 'number') return thickness;

    const key = String(thickness).toLowerCase();
    const map = INKWELL_THICKNESS[key] || INKWELL_THICKNESS.medium;
    return map[curTool] ?? 8.0;
  }

  // ── Multi-Agent (Boid) Pen Channel Management ─────────────────────────────

  _makePen(tool, agentId) {
    const Pen = PEN_CLASSES[tool] || ChineseBrushV2;
    const src = this.engine.instruments[tool] || this.engine.activeInstrument;
    const pen = new Pen({
      preset: src.activePresetId,
      baseRadius: src.baseRadius,
      dripWidthRatio: src.dripWidthRatio,
      bladeAngle: src.bladeAngle,
      color: this.engine.color,
      paperTooth: this.engine.paperTooth,
      agentId,
      overprintBlender: this.engine.overprintBlender,
    });
    if (src.overprintSwell != null) pen.overprintSwell = src.overprintSwell;
    return pen;
  }

  _getAgentPen(agentId) {
    if (agentId === 0 || agentId == null) {
      return this.engine.activeInstrument;
    }

    // 4.0: an agent with a pen of its own keeps its instrument, preset, colour and size
    if (this.agentOwn.has(agentId)) return this.agentPens.get(agentId);

    if (!this.agentPens.has(agentId)) {
      // Clone instrument instance for this agent channel, sharing the OverprintBlender spatial grid
      this.agentPens.set(agentId, this._makePen(this.engine.activeInstrumentId, agentId));
    }

    const pen = this.agentPens.get(agentId);
    // Sync shared properties
    pen.color = this.engine.color;
    pen.paperTooth = this.engine.paperTooth;
    pen.baseRadius = this.engine.activeInstrument.baseRadius;
    pen.overprintSwell = this.engine.activeInstrument.overprintSwell;
    pen.overprintBlender = this.engine.overprintBlender;
    return pen;
  }

  /**
   * 4.0: gives an agent (1–8, a boid) a pen of its own — { tool, preset, color, thickness | radius, …parameters } —
   * or, with null, back to drawing with the main pen. Returns the agent's instrument.
   */
  setAgentPen(agentId, cfg) {
    if (agentId === 0 || agentId == null) return null;
    if (!cfg) {
      this.agentOwn.delete(agentId);
      this.agentPens.delete(agentId);
      return null;
    }
    const tool = cfg.tool && PEN_CLASSES[cfg.tool] ? cfg.tool
      : (cfg.preset && toolOfPreset(cfg.preset)) || this.engine.activeInstrumentId;
    const old = this.agentOwn.has(agentId) ? this.agentPens.get(agentId) : null;
    const pen = old && PEN_CLASSES[tool] === old.constructor && !old.isDown ? old : this._makePen(tool, agentId);
    const preset = cfg.preset && toolOfPreset(cfg.preset) === tool ? cfg.preset
      : (INK_INSTRUMENTS.find((i) => i.id === tool) || {}).defaultPreset;
    if (preset) pen.applyPreset(preset);
    pen.overprintSwell = (INK_INSTRUMENTS.find((i) => i.id === tool) || {}).swell ?? pen.overprintSwell;
    applyInstrumentParams(pen, tool, cfg);
    if (cfg.radius !== undefined || cfg.thickness !== undefined) {
      const r = cfg.radius !== undefined ? Number(cfg.radius) : this._resolveRadius(cfg.thickness, tool);
      if (Number.isFinite(r)) pen.baseRadius = Math.max(0.5, r);
    }
    pen.color = this._resolveColor(cfg.color || this.engine.color);
    pen.paperTooth = cfg.paperTooth ?? this.engine.paperTooth;
    pen.overprintBlender = this.engine.overprintBlender;
    this.agentPens.set(agentId, pen);
    this.agentOwn.add(agentId);
    return pen;
  }

  getAgentPen(agentId) {
    return this._getAgentPen(agentId);
  }

  _mirroredAgents() {
    return [...this.agentPens.entries()].filter(([id]) => !this.agentOwn.has(id)).map(([, pen]) => pen);
  }

  _dropMirroredAgents() {
    for (const id of [...this.agentPens.keys()]) if (!this.agentOwn.has(id)) this.agentPens.delete(id);
  }

  // ── Kinematic Pen Drawing API ─────────────────────────────────────────────

  penDown(x, y, pressure = 0.5, time = null, agentId = 0) {
    const pen = this._getAgentPen(agentId);
    const now = time ?? (typeof performance !== 'undefined' ? performance.now() : Date.now());
    this.lastAgentTimes.set(agentId, now);

    pen.down({ x, y, pressure, time: now }, this.engine.ctx, this.engine.fluidDynamics);

    if (this.options.onMark) {
      this.options.onMark({
        t: 'b',
        x,
        y,
        r: pen.effectiveRadius || pen.baseRadius,
        c: pen.color,
        agentId,
      });
    }

    if (agentId === 0) {
      this.engine.isStrokeActive = true;
      this.engine._emitTelemetry();
    }
  }

  penMove(x, y, dt = null, pressure = 0.5, time = null, agentId = 0) {
    const pen = this._getAgentPen(agentId);
    if (!pen.isDown) return;

    const now = time ?? (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const lastTime = this.lastAgentTimes.get(agentId) || (now - 16);
    const calcDt = dt != null ? dt : Math.max(0.001, (now - lastTime) / 1000);
    this.lastAgentTimes.set(agentId, now);

    const prevX = pen.lastPoint ? pen.lastPoint.x : x;
    const prevY = pen.lastPoint ? pen.lastPoint.y : y;

    pen.move({ x, y, pressure, time: now }, calcDt, this.engine.ctx, this.engine.fluidDynamics);

    if (this.options.onMark) {
      this.options.onMark({
        t: 's',
        x0: prevX,
        y0: prevY,
        x1: x,
        y1: y,
        w: (pen.effectiveRadius || pen.baseRadius) * 2,
        c: pen.color,
        agentId,
      });
    }

    if (agentId === 0) {
      this.engine._emitTelemetry();
    }
  }

  penUp(x, y, time = null, agentId = 0) {
    const pen = this._getAgentPen(agentId);
    if (!pen.isDown) return;

    const now = time ?? (typeof performance !== 'undefined' ? performance.now() : Date.now());
    pen.up({ x, y, time: now }, this.engine.ctx, this.engine.fluidDynamics);
    this.lastAgentTimes.delete(agentId);

    if (agentId === 0) {
      this.engine.isStrokeActive = false;
      this.engine._saveHistoryState();
      this.engine._emitTelemetry();
    }
  }

  /**
   * Advances the fluid simulation (pooling & gravity drips).
   * Host engines running their own fixed tick (e.g. Inkwell's 60Hz loop)
   * can call step(dt) directly every frame.
   */
  step(dt = 0.016) {
    if (!this.engine.fluidDynamics || this.engine.fluidDynamics.activeDrips.length === 0) return;

    this.engine.ctx.save();
    this.engine.fluidDynamics.updateDrips(dt, (seg) => {
      // 4.0: drawn (and, in 'mix', mixed and recorded) by the blender
      const c = this.engine.overprintBlender.paintDripSegment(this.engine.ctx, seg);

      if (this.options.onMark) {
        this.options.onMark({
          t: 'd',
          x0: seg.x0,
          y0: seg.y0,
          x1: seg.x1,
          y1: seg.y1,
          w0: seg.w0,
          w1: seg.w1,
          c: c || seg.color,
        });
      }
    });
    this.engine.ctx.restore();
    this.engine._emitTelemetry();
  }

  // ── Configuration & Parameter API ─────────────────────────────────────────

  setTool(toolName, presetId = null) {
    this.engine.setInstrument(toolName);
    this._dropMirroredAgents(); // Reset agent pen cache to switch instruments (agents with their own pens keep them)

    if (presetId) {
      this.setPreset(presetId);
    } else {
      // Pick sensible preset based on active thickness
      if (toolName === 'posca_squeezer') {
        const pId = this.options.thickness === 'thin' ? 'posca_squeezer_thin'
          : this.options.thickness === 'thick' ? 'posca_squeezer_thick'
          : 'posca_squeezer_medium';
        this.engine.setPreset(pId);
      } else if (toolName === 'ruling_pen_curved') {
        const pId = this.options.thickness === 'hairline' ? 'curved_ruling_fine'
          : (this.options.thickness === 'thick' || this.options.thickness === 'broad') ? 'curved_ruling_broad'
          : 'curved_ruling_medium';
        this.engine.setPreset(pId);
      } else if (toolName === 'ruling_pen_flat') {
        const pId = this.options.thickness === 'hairline' ? 'flat_ruling_point'
          : (this.options.thickness === 'thick' || this.options.thickness === 'broad') ? 'flat_ruling_broad'
          : 'flat_ruling_medium';
        this.engine.setPreset(pId);
      } else {
        this.engine.setPreset('medium_high_dynamic');
      }
    }
  }

  setPreset(presetId) {
    this.engine.setPreset(presetId);
    this._dropMirroredAgents();
  }

  setThickness(thicknessOrPx) {
    this.options.thickness = thicknessOrPx;
    const r = this._resolveRadius(thicknessOrPx);
    this.engine.setNibRadius(r);
    for (const pen of this._mirroredAgents()) {
      pen.baseRadius = r;
    }
  }

  setColor(colorHexOrToken) {
    const hex = this._resolveColor(colorHexOrToken);
    this.engine.setColor(hex);
    for (const pen of this._mirroredAgents()) {
      pen.color = hex;
    }
  }

  setPaperTooth(value) {
    this.engine.setPaperTooth(value);
    for (const pen of this.agentPens.values()) {
      pen.paperTooth = value;
    }
  }

  setBlendMode(mode) {
    this.engine.setBlendMode(mode);
    this.options.blendMode = this.engine.blendMode;
  }

  setInkDensity(density) {
    this.engine.setInkDensity(density);
    this.options.inkDensity = this.engine.inkDensity;
  }

  setOverprintDarken(darken) {
    this.engine.setOverprintDarken(darken);
    this.options.overprintDarken = this.engine.overprintDarken;
  }

  // the blending intensity (another name for overprintDarken)
  setBlendIntensity(v) {
    this.setOverprintDarken(v);
  }

  // 4.0: the active instrument's crossing swell (and of the agents drawing with it)
  setOverprintSwell(swell) {
    this.engine.setOverprintSwell(swell);
    this.options.overprintSwell = this.engine.overprintSwell;
    for (const pen of this._mirroredAgents()) pen.overprintSwell = this.engine.overprintSwell;
  }

  setOverprintModel(model) {
    this.engine.setOverprintModel(model);
    this.options.overprintModel = this.engine.overprintModel;
  }

  setOverprintAttack(v) {
    this.engine.setOverprintAttack(v);
    this.options.overprintAttack = this.engine.overprintAttack;
  }

  setOverprintRelease(v) {
    this.engine.setOverprintRelease(v);
    this.options.overprintRelease = this.engine.overprintRelease;
  }

  setOverprintReach(v) {
    this.engine.setOverprintReach(v);
    this.options.overprintReach = this.engine.overprintReach;
  }

  setPaperColor(color) {
    this.engine.setPaperColor(color);
    this.options.paperColor = this.engine.paperColor;
  }

  setOverprint(opts = {}) {
    if (!opts || typeof opts !== 'object') return;
    const { overprintSwell, ...rest } = opts;
    this.engine.setOverprint(rest);
    if (overprintSwell !== undefined) this.setOverprintSwell(overprintSwell);
    for (const k of ['overprintModel', 'blendMode', 'inkDensity', 'overprintDarken', 'overprintAttack', 'overprintRelease', 'overprintReach', 'paperColor']) {
      this.options[k] = this.engine[k];
    }
  }

  setDripWidthRatio(value) {
    this.engine.setDripWidthRatio(value);
    for (const pen of this._mirroredAgents()) {
      if (pen.setDripWidthRatio) pen.setDripWidthRatio(value);
    }
  }

  setBladeAngle(angle) {
    this.engine.setBladeAngle(angle);
    for (const pen of this._mirroredAgents()) {
      if (pen.setBladeAngle) pen.setBladeAngle(angle);
    }
  }

  setChatterIntensity(value) {
    this.engine.setChatterIntensity(value);
    for (const pen of this._mirroredAgents()) {
      if (pen.setChatterIntensity) pen.setChatterIntensity(value);
    }
  }

  setEdgeAsymmetry(value) {
    this.engine.setEdgeAsymmetry(value);
    for (const pen of this._mirroredAgents()) {
      if (pen.setEdgeAsymmetry) pen.setEdgeAsymmetry(value);
    }
  }

  setAsymmetrySide(side) {
    this.engine.setAsymmetrySide(side);
    for (const pen of this._mirroredAgents()) {
      if (pen.setAsymmetrySide) pen.setAsymmetrySide(side);
    }
  }

  setSkipSensitivity(value) {
    this.engine.setSkipSensitivity(value);
    for (const pen of this._mirroredAgents()) {
      if (pen.setSkipSensitivity) pen.setSkipSensitivity(value);
    }
  }

  setSnapIntensity(value) {
    this.engine.setSnapIntensity(value);
    for (const pen of this._mirroredAgents()) {
      if (pen.setSnapIntensity) pen.setSnapIntensity(value);
    }
  }

  setMinWidthScale(value) {
    this.engine.setMinWidthScale(value);
    for (const pen of this._mirroredAgents()) {
      if (pen.setMinWidthScale) pen.setMinWidthScale(value);
    }
  }

  setMaxWidthScale(value) {
    this.engine.setMaxWidthScale(value);
    for (const pen of this._mirroredAgents()) {
      if (pen.setMaxWidthScale) pen.setMaxWidthScale(value);
    }
  }

  setMinSpitCount(value) {
    this.engine.setMinSpitCount(value);
    for (const pen of this._mirroredAgents()) {
      if (pen.setMinSpitCount) pen.setMinSpitCount(value);
    }
  }

  setMaxSpitCount(value) {
    this.engine.setMaxSpitCount(value);
    for (const pen of this._mirroredAgents()) {
      if (pen.setMaxSpitCount) pen.setMaxSpitCount(value);
    }
  }

  setMaxDropletSize(value) {
    this.engine.setMaxDropletSize(value);
    for (const pen of this._mirroredAgents()) {
      if (pen.setMaxDropletSize) pen.setMaxDropletSize(value);
    }
  }

  setBurstExplosionWidth(value) {
    this.engine.setBurstExplosionWidth(value);
    for (const pen of this._mirroredAgents()) {
      if (pen.setBurstExplosionWidth) pen.setBurstExplosionWidth(value);
    }
  }

  getConfig() {
    const act = this.engine.activeInstrument;
    return {
      tool: this.engine.activeInstrumentId,
      preset: act ? act.activePresetId : this.options.preset,
      thickness: this.options.thickness,
      radius: act ? act.baseRadius : 8.0,
      color: this.engine.color,
      paperTooth: this.engine.paperTooth,
      overprintModel: this.engine.overprintModel,
      blendMode: this.engine.blendMode,
      inkDensity: this.engine.inkDensity,
      overprintDarken: this.engine.overprintDarken,
      overprintSwell: this.engine.overprintSwell,
      overprintAttack: this.engine.overprintAttack,
      overprintRelease: this.engine.overprintRelease,
      overprintReach: this.engine.overprintReach,
      paperColor: this.engine.paperColor,
      dripWidthRatio: this.engine.instruments.posca_squeezer ? this.engine.instruments.posca_squeezer.dripWidthRatio : 0.32,
      bladeAngle: act?.bladeAngle ?? (Math.PI / 4),
      chatterIntensity: act?.chatterIntensity ?? 1.25,
      skipSensitivity: act?.skipSensitivity ?? 1.0,
      snapIntensity: act?.snapIntensity ?? 1.0,
      edgeAsymmetry: act?.edgeAsymmetry ?? 0.92,
      asymmetrySide: act?.asymmetrySide ?? 'right',
      minWidthScale: act?.minWidthScale ?? 0.25,
      maxWidthScale: act?.maxWidthScale ?? 2.0,
      minSpitCount: act?.minSpitCount ?? 4,
      maxSpitCount: act?.maxSpitCount ?? 18,
      maxDropletSize: act?.maxDropletSize ?? 3.5,
      burstExplosionWidth: act?.burstExplosionWidth ?? 2.2,
      rawSettings: this.engine.exportSettings(),
    };
  }

  /**
   * Applies settings (any subset): tool / preset first, then size, colour, the overprint, and every instrument
   * parameter given (4.0: all of them, validated; unknown keys are ignored). `rawSettings` (exportSettings()) last.
   */
  setConfig(cfg = {}) {
    if (!cfg || typeof cfg !== 'object') return;
    const raw = cfg.rawSettings;
    const { settings: c } = validateInkSettings(cfg, { colorTokens: INKWELL_COLORS, presets: CORE_IDS });
    if (c.tool) this.setTool(c.tool, c.preset && toolOfPreset(c.preset) === c.tool ? c.preset : null);
    else if (c.preset) this.setPreset(c.preset);

    if (c.thickness !== undefined) this.setThickness(c.thickness);
    if (c.radius !== undefined) this.engine.setNibRadius(c.radius);
    if (c.color) this.setColor(c.color);
    if (c.paperTooth !== undefined) this.setPaperTooth(c.paperTooth);
    const overprint = {};
    for (const k of ['overprintModel', 'blendMode', 'inkDensity', 'overprintDarken', 'overprintAttack', 'overprintRelease', 'overprintReach', 'paperColor']) {
      if (c[k] !== undefined) overprint[k] = c[k];
    }
    if (Object.keys(overprint).length) this.setOverprint(overprint);
    if (c.overprintSwell !== undefined) this.setOverprintSwell(c.overprintSwell);
    applyInstrumentParams(this.engine.activeInstrument, this.engine.activeInstrumentId, c);
    for (const pen of this._mirroredAgents()) applyInstrumentParams(pen, this.engine.activeInstrumentId, c);
    if (raw && typeof raw === 'object') this.engine.applySettings(raw);
  }

  /**
   * 4.0: applies a preset — a core preset id, or a user preset (from UserPresetStore) — to the main pen.
   */
  applyPreset(preset) {
    const cfg = presetToConfig(preset);
    if (cfg) this.setConfig(cfg);
    return !!cfg;
  }

  /**
   * 4.0: what a user preset of the main pen keeps — its tool, the core preset it started from, and its values.
   */
  presetSnapshot() {
    const id = this.engine.activeInstrumentId;
    const block = this.engine.exportInstrumentSettings(id) || {};
    const { presetId, ...settings } = block;
    for (const k of ['inkDensity', 'overprintDarken', 'overprintAttack', 'overprintRelease', 'overprintReach', 'overprintModel', 'blendMode']) {
      settings[k] = this.engine[k];
    }
    settings.radius = block.baseRadius;
    delete settings.baseRadius;
    return { tool: id, basePreset: isCorePreset(presetId) ? presetId : null, settings };
  }

  // ── Surface & History Operations ──────────────────────────────────────────

  clear(saveState = true) {
    this.engine.clear(saveState);
    this._dropMirroredAgents();
    this.lastAgentTimes.clear();
  }

  undo() {
    this.engine.undo();
  }

  redo() {
    this.engine.redo();
  }

  exportPNG() {
    return this.engine.exportPNG();
  }

  destroy() {
    this.engine.destroy();
    this.agentPens.clear();
    this.agentOwn.clear();
    this.lastAgentTimes.clear();
  }
}

/**
 * Convenient 1-line factory function to create an InkDynamics engine.
 * @param {Object} options
 * @returns {InkDynamicsInstance}
 */
export function createInkDynamics(options = {}) {
  return new InkDynamicsInstance(options);
}

// ── Attach to global window if loaded via standard script tag ───────────────
if (typeof window !== 'undefined') {
  window.InkDynamics = {
    VERSION,
    createInkDynamics,
    InkDynamicsInstance,
    InkDynamicsEngine,
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
    INKWELL_COLORS,
    INKWELL_THICKNESS,
    OVERPRINT_DEFAULTS,
    CLASSIC_39,
    InkRecorder,
    parseInkSettings,
    validateInkSettings,
    formatInkSettings,
    CORE_PRESETS,
    listPresets,
    presetToConfig,
    UserPresetStore,
    localStorageAdapter,
    memoryAdapter,
    httpAdapter,
  };
}
