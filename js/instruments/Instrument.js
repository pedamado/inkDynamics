// ═══════════════════════════════════════════════════════════════════════════
// INK DYNAMICS — Instrument.js
// Base class for physical inking instruments and writing tools.
// ═══════════════════════════════════════════════════════════════════════════

import { OverprintBlender } from '../physics/OverprintBlender.js';

export class Instrument {
  constructor(name, options = {}) {
    this.name = name;
    this.type = options.type || 'brush';

    // Core dimensional & physical attributes
    this.sizePreset = options.sizePreset || 'medium'; // 'small', 'medium', 'large'
    this.baseRadius = options.baseRadius || 12; // Nominal radius in px
    this.sizeScale = options.sizeScale || 1.0; // User slider multiplier

    // Ink formulation properties
    this.color = options.color || '#101012';
    this.opacity = options.opacity ?? 1.0;
    this.viscosity = options.viscosity ?? 0.5; // 0.1 (watery) to 1.0 (heavy acrylic/sumi)
    this.flowRate = options.flowRate ?? 1.0; // Ink delivery rate

    // Overprint & Intersection Micro-Swell blender (v3.9)
    this.overprintBlender = options.overprintBlender || new OverprintBlender(options);
    this.agentId = options.agentId ?? 0;
    // 4.0: how much the line swells where it crosses ink beneath — the ink's own: low-viscosity, fast-running,
    // quick-drying drawing ink (the ruling pens) swells least
    this.overprintSwell = options.overprintSwell ?? 0.05;

    // Substrate & Interaction properties
    this.paperRoughness = options.paperRoughness ?? 0.35; // Friction tooth
    this.paperBleed = options.paperBleed ?? 0.2; // Capillary spread

    // Dynamic response coefficients
    this.slowEngorge = options.slowEngorge ?? 1.5; // Swell multiplier when slow/stopped
    this.fastThinning = options.fastThinning ?? 0.35; // Min width ratio when moving fast
    this.dripThreshold = options.dripThreshold ?? 0.8; // Drip sensitivity
    this.dryBrushThreshold = options.dryBrushThreshold ?? 450; // Speed (px/s) triggering striations

    // Active stroke state
    this.isDown = false;
    this.lastPoint = null;
    this.lastVelocity = { x: 0, y: 0 };
    this.speed = 0;
    this.smoothedSpeed = 0;
    this.accumulatedPool = 0;
    this.strokeLength = 0;
    this.dwellTime = 0;
    this.points = [];
  }

  get effectiveRadius() {
    return this.baseRadius * this.sizeScale;
  }

  // 4.0: the distance drawn so far in this stroke, under the name the instruments use (3.9: RulingPenFlat read an
  // undefined strokeDistance, so its arc lengths were NaN and a stroke never overprinted its own earlier loops)
  get strokeDistance() {
    return this.strokeLength;
  }

  setSizePreset(preset) {
    this.sizePreset = preset;
    const presets = {
      small: 0.5,
      medium: 1.0,
      large: 1.8,
    };
    this.sizeScale = presets[preset] ?? 1.0;
  }

  down(point) {
    this.isDown = true;
    this.lastPoint = { x: point.x, y: point.y, p: point.pressure ?? 0.5, t: point.time || performance.now() };
    this.lastVelocity = { x: 0, y: 0 };
    this.speed = 0;
    this.smoothedSpeed = 0;
    this.accumulatedPool = 0;
    this.strokeLength = 0;
    this.dwellTime = 0;
    this.points = [this.lastPoint];
  }

  move(point, dt) {
    if (!this.isDown || !this.lastPoint) return [];

    const dx = point.x - this.lastPoint.x;
    const dy = point.y - this.lastPoint.y;
    const dist = Math.hypot(dx, dy);

    const safeDt = Math.max(0.001, dt);
    const instSpeed = dist / safeDt; // px/s
    this.smoothedSpeed = this.smoothedSpeed * 0.7 + instSpeed * 0.3;
    this.speed = this.smoothedSpeed;

    this.strokeLength += dist;

    const currentPoint = {
      x: point.x,
      y: point.y,
      p: point.pressure ?? 0.5,
      t: point.time || performance.now(),
      dx,
      dy,
      dist,
      speed: this.speed,
      vx: dx / safeDt,
      vy: dy / safeDt,
    };

    this.points.push(currentPoint);
    this.lastVelocity = { x: currentPoint.vx, y: currentPoint.vy };

    return currentPoint;
  }

  up(point) {
    this.isDown = false;
    const endPoint = this.lastPoint;
    this.lastPoint = null;
    return endPoint;
  }

  step(dt) {
    // Override in subclasses for persistent simulation (e.g. running drips)
  }

  /**
   * Helper to compute dynamic stroke width based on velocity & pressure.
   */
  computeDynamicWidth(speed, pressure = 0.5) {
    const baseW = this.effectiveRadius * 2;
    // Slow speed swell (engorge)
    const slowRatio = Math.max(0, 1 - Math.min(1, speed / 250));
    const engorge = 1.0 + Math.pow(slowRatio, 2.0) * (this.slowEngorge - 1.0);

    // Fast speed thinning
    const fastRatio = Math.min(1, Math.max(0, (speed - 150) / 600));
    const thinning = 1.0 - fastRatio * (1.0 - this.fastThinning);

    // Pressure response (0.7 to 1.3 curve)
    const pFactor = 0.65 + pressure * 0.7;

    return Math.max(1.0, baseW * engorge * thinning * pFactor);
  }
}
