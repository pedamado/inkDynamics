// ═══════════════════════════════════════════════════════════════════════════
// INK DYNAMICS v2 — ChineseBrushV2.js
// Physical multi-bristle capillary depletion and refill model,
// calibrated from physical Zig Chinese Brush ink tests.
//
// Key Enhancements (v2.1):
// 1. Arc-length dense sub-stepping (smooth continuous curves, no chords)
// 2. Smooth, extended starvation transitions over long stroke lengths (50-180px)
// 3. Persistent resilient core bristles (contact NEVER completely vanishes)
// 4. Gradual capillary refill on deceleration (starvation lines remain visible
//    for a while before stroke coalesces back to solid black)
// 5. Asymmetric "tibia bone-head" contact stamp on touch-down
// 6. Zero-blur, razor-sharp saturated black sumi ink rendering
// ═══════════════════════════════════════════════════════════════════════════

import { OverprintBlender } from '../physics/OverprintBlender.js';

export const ZIG_PRESETS = {
  fine_low_var: {
    id: 'fine_low_var',
    name: '1. Fine (Low Width Variation)',
    description: 'Drawn thin at normal speed, minimal width variation; lines thin down at high speed but never vanish.',
    baseRadius: 3.5,
    numBristles: 20,
    slowEngorgeRatio: 1.35, // subtle engorge
    fastThinRatio: 0.35,   // maintains thin crisp core
    depletionRate: 0.75,
    refillRate: 0.9,
    starveEaseIn: 140,     // distance (px) to ease into starvation
    starveEaseOut: 80,     // distance (px) for starvation lines to linger before solid
    boneHeadFlare: 1.3,
    soakRate: 0.35,
    widthSwing: 0.25,
  },
  fine_thick_high_contrast: {
    id: 'fine_thick_high_contrast',
    name: '2. Fine-Thick (High Contrast Dun)',
    description: 'Very thin at normal/fast speed, but swells into large, high-contrast black ink puddles/knots when slow.',
    baseRadius: 4.5,
    numBristles: 28,
    slowEngorgeRatio: 4.5, // massive contrast
    fastThinRatio: 0.3,
    depletionRate: 0.7,
    refillRate: 1.1,
    starveEaseIn: 120,
    starveEaseOut: 70,
    boneHeadFlare: 2.2,
    soakRate: 1.2,
    widthSwing: 1.5,
  },
  medium_high_dynamic: {
    id: 'medium_high_dynamic',
    name: '3. Medium (High Dynamic & Starvation)',
    description: 'Thick bone-head starts, long extended starvation stripes at speed, sharp tapering flick or swollen ending.',
    baseRadius: 10.0,
    numBristles: 36,
    slowEngorgeRatio: 2.2,
    fastThinRatio: 0.45,
    depletionRate: 1.0, // balanced gradual starvation over length
    refillRate: 0.85,  // gradual refill on deceleration
    starveEaseIn: 110,
    starveEaseOut: 85,
    boneHeadFlare: 1.85,
    soakRate: 0.8,
    widthSwing: 0.9,
  },
  medium_uniform_starvation: {
    id: 'medium_uniform_starvation',
    name: '4. Medium (Uniform Width with Starvation)',
    description: 'Medium width with almost no width variation, but responds to speed with crisp longitudinal starvation tracks.',
    baseRadius: 9.0,
    numBristles: 32,
    slowEngorgeRatio: 1.15, // almost no width variation
    fastThinRatio: 0.85,   // width stays consistent
    depletionRate: 1.1,    // starvation stripes still happen readily
    refillRate: 0.85,
    starveEaseIn: 95,
    starveEaseOut: 90,
    boneHeadFlare: 1.3,
    soakRate: 0.5,
    widthSwing: 0.15,
  },
};

export class ChineseBrushV2 {
  constructor(options = {}) {
    this.name = 'Zig Chinese Brush (Calibrated v2)';
    this.activePresetId = options.preset || 'medium_high_dynamic';

    // Core parameters (overridable by preset and user sliders)
    this.baseRadius = options.baseRadius ?? 10.0;
    this.sizeScale = options.sizeScale ?? 1.0;
    this.color = options.color || '#050505'; // Saturated jet black
    this.opacity = 1.0;
    this.agentId = options.agentId || 'default';
    this.overprintBlender = options.overprintBlender || new OverprintBlender(options);
    // 4.0: crossing micro-swell of this ink — slow-running, low-viscosity sumi: in between (5–10 %)
    this.overprintSwell = options.overprintSwell ?? 0.075;

    // Physical calibration parameters
    this.numBristles = options.numBristles ?? 36;
    this.slowEngorgeRatio = options.slowEngorgeRatio ?? 2.2;
    this.fastThinRatio = options.fastThinRatio ?? 0.45;
    this.depletionRate = options.depletionRate ?? 1.0;
    this.refillRate = options.refillRate ?? 0.85;
    this.starveEaseIn = options.starveEaseIn ?? 110;
    this.starveEaseOut = options.starveEaseOut ?? 85;
    this.boneHeadFlare = options.boneHeadFlare ?? 1.85;
    this.soakRate = options.soakRate ?? 0.8;
    this.paperTooth = options.paperTooth ?? 0.45;

    // Stroke state
    this.isDown = false;
    this.points = [];
    this.lastPoint = null;
    this.speed = 0;
    this.smoothedSpeed = 0;
    this.strokeDistance = 0;
    this.dwellDuration = 0;
    this.startPoint = null;
    this.boneHeadDrawn = false;

    // Virtual bristle array
    this.bristles = [];
    this._initBristles();
    this.applyPreset(this.activePresetId);
  }

  get effectiveRadius() {
    return this.baseRadius * this.sizeScale;
  }

  applyPreset(presetId) {
    const p = ZIG_PRESETS[presetId];
    if (!p) return;
    this.activePresetId = presetId;
    this.baseRadius = p.baseRadius;
    this.numBristles = p.numBristles;
    this.slowEngorgeRatio = p.slowEngorgeRatio;
    this.fastThinRatio = p.fastThinRatio;
    this.depletionRate = p.depletionRate;
    this.refillRate = p.refillRate;
    this.starveEaseIn = p.starveEaseIn ?? 110;
    this.starveEaseOut = p.starveEaseOut ?? 85;
    this.boneHeadFlare = p.boneHeadFlare;
    this.soakRate = p.soakRate;
    this._initBristles();
  }


  _initBristles() {
    this.bristles = [];
    const count = Math.max(16, Math.min(54, this.numBristles));
    for (let i = 0; i < count; i++) {
      // Normalized position across the brush width: -1.0 (left edge) to +1.0 (right edge)
      const u = (i / (count - 1)) * 2 - 1;

      // Central bristles carry significantly more capillary capacity than peripheral hairs
      const centerDist = Math.abs(u);
      const centerProximity = 1.0 - Math.pow(centerDist, 1.5);
      const baseReserve = 0.9 + centerProximity * 0.6 + (Math.random() - 0.5) * 0.15;

      // Designate persistent core bristles:
      // The central hairs and a couple of outer guide hairs NEVER completely lift off paper,
      // always drawing a scratch track even at top speed!
      const isCenterCore = centerDist < 0.18;
      const isOuterGuide = Math.abs(centerDist - 0.85) < 0.08;
      const isPersistent = isCenterCore || isOuterGuide;

      // Individual bristle fiber thickness (in pixels)
      const fiberWidth = 0.95 + Math.random() * 0.55;

      this.bristles.push({
        u,                      // position across stroke span [-1, 1]
        reserve: baseReserve,   // current ink volume [0.0 = dry, 1.0 = saturated]
        maxReserve: baseReserve,
        fiberWidth,
        feedMultiplier: 0.85 + Math.random() * 0.35,
        isPersistent,
        isStarved: false,
        lastX: 0,
        lastY: 0,
      });
    }
  }

  down(point, ctx) {
    this.isDown = true;
    this.startPoint = { ...point };
    this.lastPoint = { ...point, speed: 0, time: point.time || performance.now() };
    this.speed = 0;
    this.smoothedSpeed = 0;
    this.strokeDistance = 0;
    this.dwellDuration = 0;
    this.boneHeadDrawn = false;
    this.points = [this.lastPoint];

    const ob = this.overprintBlender;
    if (ob) {
      ob.beginStroke(this.agentId || 'default', this.color);
    }

    // Reset all bristles to full ink saturation
    const halfW = this.effectiveRadius;
    for (const b of this.bristles) {
      b.reserve = b.maxReserve;
      b.isStarved = false;
      b.lastX = point.x + b.u * halfW;
      b.lastY = point.y;
    }

    // Draw the initial landing contact: the characteristic Asymmetric Bone-Head (Tibia) Stamp
    if (ctx) {
      this._drawBoneHeadStart(ctx, point.x, point.y);
    }
  }

  /**
   * Draws the characteristic asymmetric "tibia bone-head" contact stamp.
   */
  _drawBoneHeadStart(ctx, x, y) {
    const ob = this.overprintBlender;
    const strokeId = ob ? ob.getActiveStrokeId(this.agentId || 'default') : 1;
    let r = this.effectiveRadius * this.boneHeadFlare;

    ctx.save();
    if (ob) {
      ob.applyCompositeStyle(ctx, this.color, 1.0);
      if (ob.isOverprintEnabled()) {
        const ov = ob.queryAndStamp(x, y, r, strokeId, 0, this.color, true);
        if (ov.crossed) {
          const multColor = ob.getMultipliedColor(this.color, ov.underR, ov.underG, ov.underB, ov.intensity);
          ctx.fillStyle = multColor;
          ctx.strokeStyle = multColor;
          r *= ob.getSwellFactor(ov.intensity, this.overprintSwell);
        } else {
          const fp = ob.getFirstPassColor(this.color);
          ctx.fillStyle = fp;
          ctx.strokeStyle = fp;
        }
      }
    } else {
      ctx.fillStyle = this.color;
      ctx.strokeStyle = this.color;
      ctx.globalAlpha = 1.0;
    }

    // Angle of landing contact: ~25° to 35° slant relative to vertical
    const angle = -0.45; // ~ -26 degrees
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Asymmetric bone-head polygon:
    ctx.beginPath();
    const w = r * 1.35;
    const h = r * 0.85;

    ctx.moveTo(-w * 0.95, -h * 0.6);
    ctx.bezierCurveTo(-w * 0.4, -h * 0.95, w * 0.2, -h * 0.9, w * 0.95, -h * 0.55);
    ctx.bezierCurveTo(w * 1.15, -h * 0.1, w * 1.05, h * 0.45, w * 0.6, h * 0.8);
    ctx.bezierCurveTo(w * 0.2, h * 0.95, -w * 0.3, h * 0.9, -w * 0.65, h * 0.7);
    ctx.bezierCurveTo(-w * 1.1, h * 0.3, -w * 1.15, -h * 0.2, -w * 0.95, -h * 0.6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
    this.boneHeadDrawn = true;
  }

  move(point, dt, ctx) {
    if (!this.isDown || !this.lastPoint) return;

    const prev = this.lastPoint;
    const safeDt = Math.max(0.001, Math.min(0.08, dt));
    const dx = point.x - prev.x;
    const dy = point.y - prev.y;
    const dist = Math.hypot(dx, dy);

    // Handle dwell / hovering in place (puddle soak)
    if (dist < 0.4) {
      this.dwellDuration += safeDt;
      if (this.dwellDuration > 0.06 && ctx) {
        this._soakPuddle(ctx, point.x, point.y, safeDt);
      }
      return;
    }

    this.dwellDuration = 0;
    this.strokeDistance += dist;
    const arcBase = this.strokeDistance - dist;

    // Smooth speed calculation to eliminate sensor jitter
    const instSpeed = dist / safeDt;
    this.smoothedSpeed = this.smoothedSpeed * 0.75 + instSpeed * 0.25;
    this.speed = this.smoothedSpeed;

    const p = {
      x: point.x,
      y: point.y,
      dx,
      dy,
      dist,
      speed: this.speed,
      time: point.time || performance.now(),
    };
    this.points.push(p);

    // Normalized direction vector and orthogonal normal
    const ux = dx / dist;
    const uy = dy / dist;
    const normX = -uy;
    const normY = ux;

    const baseW = this.effectiveRadius * 2;
    const count = this.bristles.length;

    // If this is the first move event after touchdown, align bristle initial anchors perpendicularly to the stroke direction
    if (this.points.length <= 2) {
      for (let i = 0; i < count; i++) {
        const b = this.bristles[i];
        const spanPos = b.u * (baseW / 2);
        b.lastX = prev.x + normX * spanPos;
        b.lastY = prev.y + normY * spanPos;
      }
    }

    if (!ctx) {
      this.lastPoint = p;
      return;
    }

    // ══════════════════════════════════════════════════════════════════
    // Dense Arc-Length Sub-stepping / Interpolation:
    // Breaks segments into dense ~2.0px micro-steps for fluid continuity
    // ══════════════════════════════════════════════════════════════════
    const stepSize = 2.0; // px per sub-step
    const subSteps = Math.max(1, Math.ceil(dist / stepSize));
    const subDist = dist / subSteps;

    const ob = this.overprintBlender;
    const strokeId = ob ? ob.getActiveStrokeId(this.agentId || 'default') : 1;
    const firstPassColor = ob ? ob.getFirstPassColor(this.color) : this.color;
    const overprintActive = ob ? ob.isOverprintEnabled() : false;

    ctx.save();
    if (ob) {
      ob.applyCompositeStyle(ctx, this.color, 1.0);
    } else {
      ctx.fillStyle = this.color;
      ctx.strokeStyle = this.color;
      ctx.globalAlpha = 1.0;
    }
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';

    // Depletion and refill thresholds
    const speedThreshold = 180;
    const isExhausting = this.speed > speedThreshold;
    const speedOverhead = Math.max(0, (this.speed - speedThreshold) / 260);

    const easeInLen = Math.max(20, this.starveEaseIn || 110);
    const easeOutLen = Math.max(20, this.starveEaseOut || 85);

    for (let s = 1; s <= subSteps; s++) {
      const t = s / subSteps;
      const subX = prev.x + dx * t;
      const subY = prev.y + dy * t;
      const curArc = arcBase + dist * t;

      // 1. Dynamic Width Calculation for this sub-step
      let targetWidth;
      if (this.speed < 90) {
        const slowFactor = Math.pow(1 - this.speed / 90, 1.8);
        targetWidth = baseW * (1.0 + slowFactor * (this.slowEngorgeRatio - 1.0));
      } else {
        const fastRatio = Math.min(1.0, (this.speed - 90) / 480);
        targetWidth = baseW * (1.0 - fastRatio * (1.0 - this.fastThinRatio));
      }

      // Overprint intersection check & capillary micro-swell
      let stepColor = firstPassColor;
      let stepSwell = 1.0;
      if (overprintActive) {
        const ov = ob.queryAndStamp(subX, subY, Math.max(1.5, targetWidth * 0.5), strokeId, curArc, this.color, true);
        if (ov.crossed) {
          stepColor = ob.getMultipliedColor(this.color, ov.underR, ov.underG, ov.underB, ov.intensity);
          stepSwell = ob.getSwellFactor(ov.intensity, this.overprintSwell);
          targetWidth *= stepSwell;
        }
      }

      ctx.strokeStyle = stepColor;
      ctx.fillStyle = stepColor;

      const halfW = Math.max(0.9, targetWidth / 2);

      // 2. Capillary Depletion & Refill over Arc-Length:
      // Ease-In dictates how many pixels of stroke length at speed before starvation stripes emerge.
      // Ease-Out dictates how many pixels starved bristles linger when decelerating before full solid refill.
      for (let i = 0; i < count; i++) {
        const b = this.bristles[i];

        if (isExhausting) {
          // Central bristles hold ink longer than outer edges
          const bristleResilience = 0.8 + (1.0 - Math.abs(b.u)) * 0.8;
          // Depletion loss scaled by user-controlled starveEaseIn
          const lossRate = (this.depletionRate * (0.35 + speedOverhead * 0.95) * subDist) / (bristleResilience * (easeInLen * 0.7));
          b.reserve = Math.max(0.0, b.reserve - lossRate);
        } else {
          // Capillary refill scaled by user-controlled starveEaseOut
          const slowRecoveryFactor = Math.max(0.05, Math.pow(Math.max(0, 1.0 - this.speed / speedThreshold), 1.35));
          const refillGain = (this.refillRate * slowRecoveryFactor * subDist * b.feedMultiplier) / (easeOutLen * 0.6);
          b.reserve = Math.min(b.maxReserve, b.reserve + refillGain);
        }

        b.isStarved = b.reserve < 0.08;

        // 3. Render Bristle Micro-Ribbon:
        const toothJitter = (Math.random() - 0.5) * (this.paperTooth * 0.65);
        const spanPos = b.u * halfW + toothJitter;
        const currX = subX + normX * spanPos;
        const currY = subY + normY * spanPos;

        if (!b.isStarved) {
          // Active bristle: draws solid, saturated black stroke
          // (4.0: starting 0.6 px back over the previous sub-step, so the anti-aliased ends of butt-capped ribbons
          // overlap instead of meeting edge to edge — 3.9 left faint light seams across the stroke every 2 px)
          const bristleWidth = Math.max(1.15, (targetWidth / count) * 1.65);
          ctx.lineWidth = bristleWidth;
          ctx.beginPath();
          ctx.moveTo(b.lastX - ux * 0.6, b.lastY - uy * 0.6);
          ctx.lineTo(currX, currY);
          ctx.stroke();
        } else if (b.isPersistent || (Math.random() < 0.18 * this.paperTooth)) {
          // Starved persistent bristle: never leaves paper!
          // Draws fine dry-brush scratch track so the stroke NEVER completely vanishes while dragging
          ctx.lineWidth = Math.max(0.8, b.fiberWidth * 0.9 * stepSwell);
          ctx.beginPath();
          ctx.moveTo(b.lastX, b.lastY);
          ctx.lineTo(currX, currY);
          ctx.stroke();
        }
        // Non-persistent starved bristles draw nothing -> creates crisp white longitudinal tracks!

        b.lastX = currX;
        b.lastY = currY;
      }
    }

    ctx.restore();
    this.lastPoint = p;
  }

  /**
   * Simulates ink soaking into paper when stationary or dwelling.
   */
  _soakPuddle(ctx, x, y, dt) {
    const ob = this.overprintBlender;
    const strokeId = ob ? ob.getActiveStrokeId(this.agentId || 'default') : 1;
    let soakRadius = this.effectiveRadius * (1.0 + Math.min(2.5, this.dwellDuration * this.soakRate * 1.4));
    ctx.save();
    if (ob) {
      ob.applyCompositeStyle(ctx, this.color, 1.0);
      if (ob.isOverprintEnabled()) {
        const ov = ob.queryAndStamp(x, y, soakRadius, strokeId, this.strokeDistance, this.color, true);
        if (ov.crossed) {
          ctx.fillStyle = ob.getMultipliedColor(this.color, ov.underR, ov.underG, ov.underB, ov.intensity);
          soakRadius *= ob.getSwellFactor(ov.intensity, this.overprintSwell);
        } else {
          ctx.fillStyle = ob.getFirstPassColor(this.color);
        }
      }
    } else {
      ctx.fillStyle = this.color;
      ctx.globalAlpha = 1.0;
    }

    ctx.beginPath();
    const segments = 12;
    for (let i = 0; i < segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const perturb = 1.0 + (Math.random() - 0.5) * 0.12 * this.paperTooth;
      const px = x + Math.cos(theta) * (soakRadius * perturb);
      const py = y + Math.sin(theta) * (soakRadius * perturb);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  up(point, ctx) {
    if (!this.isDown || !this.lastPoint) return;
    this.isDown = false;

    const last = this.lastPoint;
    const finalSpeed = this.speed;

    if (!ctx) {
      this.lastPoint = null;
      return;
    }

    const ob = this.overprintBlender;
    const strokeId = ob ? ob.getActiveStrokeId(this.agentId || 'default') : 1;
    const firstPassColor = ob ? ob.getFirstPassColor(this.color) : this.color;

    ctx.save();
    if (ob) {
      ob.applyCompositeStyle(ctx, this.color, 1.0);
    } else {
      ctx.fillStyle = this.color;
      ctx.strokeStyle = this.color;
      ctx.globalAlpha = 1.0;
    }

    let swellMod = 1.0;
    if (ob && ob.isOverprintEnabled()) {
      const ov = ob.queryAndStamp(last.x, last.y, Math.max(1.5, this.effectiveRadius), strokeId, this.strokeDistance, this.color, true);
      if (ov.crossed) {
        const multColor = ob.getMultipliedColor(this.color, ov.underR, ov.underG, ov.underB, ov.intensity);
        ctx.fillStyle = multColor;
        ctx.strokeStyle = multColor;
        swellMod = ob.getSwellFactor(ov.intensity, this.overprintSwell);
      } else {
        ctx.fillStyle = firstPassColor;
        ctx.strokeStyle = firstPassColor;
      }
    }

    if (finalSpeed > 180) {
      // ══════════════════════════════════════════════════════════════════
      // Case A: Finished at Speed (Flick / Lift)
      // Line tapers down to a sharp point or fine trailing dry bristles
      // ══════════════════════════════════════════════════════════════════
      const dx = last.dx || 0;
      const dy = last.dy || 0;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;

      // Project flick tail forward smoothly
      const flickLen = Math.min(32, 10 + (finalSpeed / 22));
      const tipX = last.x + ux * flickLen;
      const tipY = last.y + uy * flickLen;

      ctx.lineWidth = 1.2 * swellMod;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
    } else {
      // ══════════════════════════════════════════════════════════════════
      // Case B: Finished Slow / Decelerating
      // Ink refills into a fully black, engorged cap ending!
      // ══════════════════════════════════════════════════════════════════
      const capRadius = this.effectiveRadius * 1.25 * swellMod;
      ctx.beginPath();
      ctx.arc(last.x, last.y, capRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    this.lastPoint = null;
  }

  getTelemetry() {
    let activeBristles = 0;
    for (const b of this.bristles) {
      if (!b.isStarved) activeBristles++;
    }

    return {
      instrument: this.name,
      preset: ZIG_PRESETS[this.activePresetId]?.name || this.activePresetId,
      speed: Math.round(this.speed),
      effectiveRadius: Math.round(this.effectiveRadius * 10) / 10,
      activeBristles: `${activeBristles}/${this.bristles.length}`,
      isStarving: activeBristles < this.bristles.length * 0.75,
      isDown: this.isDown,
    };
  }
}
