// ═══════════════════════════════════════════════════════════════════════════
// INK DYNAMICS v3 — PoscaSqueezerV3.js
// Physical calibration for the Posca Round Soft Nib Mop Squeezer.
// Faithfully models:
// 1. Monoline stroke with very slight high-speed waisting/narrowing
// 2. Initial circular dome contact stamp with slight engorgement
// 3. Heavy ink pooling and downward gravity drips on dwell / slow drag
//    (round cap, gentle taper, proportional drip width ratio, no terminal dot)
// 4. Dense longitudinal core flow lines in the SAME direction as stroke
//    (heavier, darker toned, opaque saturated black stroke)
// 5. Authentic flank border tooth noise skipping on rough substrate
// ═══════════════════════════════════════════════════════════════════════════

import { OverprintBlender } from '../physics/OverprintBlender.js';

export const POSCA_PRESETS = {
  posca_squeezer_thin: {
    id: 'posca_squeezer_thin',
    name: '1. Posca Mop — Thin (Ø 12px)',
    description: 'Thin soft dome mop squeezer. Uniform monoline width with slight high-speed waisting, rich black core, and subtle flank border tooth starvation.',
    baseRadius: 6.0,
    numTracks: 20,
    dripWidthRatio: 0.24,   // ~2.9 px drip line
    slowEngorgeRatio: 1.15,
    fastWaistRatio: 0.88,
    flowRate: 1.35,
    viscosity: 0.52,        // Viscous acrylic emulsion
    absorptionRate: 0.18,   // Low paper absorption -> fast surface drip runs
    dripThreshold: 0.48,
    borderStarveSensitivity: 0.85,
    initialDomeFlare: 1.15,
  },
  posca_squeezer_medium: {
    id: 'posca_squeezer_medium',
    name: '2. Posca Mop — Medium (Ø 24px)',
    description: 'Classic medium 24mm mop squeezer. Rich, heavy, saturated black stroke with dense longitudinal flow, distinct flank border tooth noise at speed, and heavy gravity drips when dwelling.',
    baseRadius: 12.0,
    numTracks: 28,
    dripWidthRatio: 0.32,   // ~7.7 px drip line
    slowEngorgeRatio: 1.22,
    fastWaistRatio: 0.84,
    flowRate: 1.7,
    viscosity: 0.55,        // Rich viscous acrylic
    absorptionRate: 0.16,   // Very low absorption -> brisk dripping runs
    dripThreshold: 0.38,
    borderStarveSensitivity: 1.0,
    initialDomeFlare: 1.22,
  },
  posca_squeezer_thick: {
    id: 'posca_squeezer_thick',
    name: '3. Posca Mop — Thick / Jumbo (Ø 44px)',
    description: 'Heavy jumbo mop squeezer. Broad solid black stroke with dense overlapping longitudinal filaments, pronounced border tooth starvation, excessive ink pooling and dramatic gravity drips.',
    baseRadius: 22.0,
    numTracks: 36,
    dripWidthRatio: 0.38,   // ~16.7 px drip line
    slowEngorgeRatio: 1.28,
    fastWaistRatio: 0.80,
    flowRate: 2.2,
    viscosity: 0.58,        // Thickest acrylic paint
    absorptionRate: 0.14,   // Surface pooling -> immediate fast gravity runs
    dripThreshold: 0.30,
    borderStarveSensitivity: 1.15,
    initialDomeFlare: 1.28,
  },
};

export class PoscaSqueezerV3 {
  constructor(options = {}) {
    this.name = 'Posca Mop Squeezer (Calibrated v3)';
    this.activePresetId = options.preset || 'posca_squeezer_medium';

    // Core sizing
    this.baseRadius = options.baseRadius ?? 12.0;
    this.sizeScale = options.sizeScale ?? 1.0;
    this.color = options.color || '#000000'; // Rich saturated acrylic pitch black
    this.opacity = 1.0;
    this.agentId = options.agentId || 'default';
    this.overprintBlender = options.overprintBlender || new OverprintBlender(options);
    // 4.0: crossing micro-swell of this ink — high-viscosity acrylic pools most (5–10 %: 10 %)
    this.overprintSwell = options.overprintSwell ?? 0.10;

    // Longitudinal filament tracking & calibration
    this.numTracks = options.numTracks ?? 28;
    this.dripWidthRatio = options.dripWidthRatio ?? 0.32;
    this.slowEngorgeRatio = options.slowEngorgeRatio ?? 1.22;
    this.fastWaistRatio = options.fastWaistRatio ?? 0.84;
    this.flowRate = options.flowRate ?? 1.7;
    this.viscosity = options.viscosity ?? 0.55;
    this.absorptionRate = options.absorptionRate ?? 0.16;
    this.dripThreshold = options.dripThreshold ?? 0.38;
    this.borderStarveSensitivity = options.borderStarveSensitivity ?? 1.0;
    this.initialDomeFlare = options.initialDomeFlare ?? 1.22;
    this.paperTooth = options.paperTooth ?? 0.45;

    // Stroke state
    this.isDown = false;
    this.points = [];
    this.lastPoint = null;
    this.speed = 0;
    this.smoothedSpeed = 0;
    this.strokeDistance = 0;
    this.dwellDuration = 0;
    this.accumulatedPool = 0;
    this.startPoint = null;

    // Micro-filament tracks running in the direction of the stroke
    this.tracks = [];
    this._initTracks();
    this.applyPreset(this.activePresetId);
  }

  get effectiveRadius() {
    return this.baseRadius * this.sizeScale;
  }

  applyPreset(presetId) {
    const p = POSCA_PRESETS[presetId];
    if (!p) return;
    this.activePresetId = presetId;
    this.baseRadius = p.baseRadius;
    this.numTracks = p.numTracks ?? 28;
    this.dripWidthRatio = p.dripWidthRatio ?? 0.32;
    this.slowEngorgeRatio = p.slowEngorgeRatio;
    this.fastWaistRatio = p.fastWaistRatio;
    this.flowRate = p.flowRate;
    this.viscosity = p.viscosity;
    this.absorptionRate = p.absorptionRate ?? 0.16;
    this.dripThreshold = p.dripThreshold;
    this.borderStarveSensitivity = p.borderStarveSensitivity;
    this.initialDomeFlare = p.initialDomeFlare;
    this._initTracks();
  }

  setDripWidthRatio(val) {
    this.dripWidthRatio = Math.max(0.10, Math.min(0.60, val));
  }

  _initTracks() {
    this.tracks = [];
    const count = this.numTracks || 28;
    for (let i = 0; i < count; i++) {
      // u spans from -1.0 (left edge) to +1.0 (right edge)
      const u = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
      const centerDist = Math.abs(u);
      // Center 68% forms dense opaque core; outer 32% forms flank borders with tooth noise
      const isCore = centerDist <= 0.68;
      // Core tracks are heavier/thicker to produce a heavier, darker toned stroke
      const trackWidthFactor = isCore ? (1.35 + (1.0 - centerDist) * 0.55) : (0.85 + Math.random() * 0.4);

      this.tracks.push({
        u,
        isCore,
        trackWidthFactor,
        lastX: 0,
        lastY: 0,
        contactState: true,
      });
    }
  }

  down(point, ctx, fluidEngine = null) {
    this.isDown = true;
    this.startPoint = { ...point };
    this.lastPoint = { ...point, speed: 0, time: point.time || performance.now() };
    this.speed = 0;
    this.smoothedSpeed = 0;
    this.strokeDistance = 0;
    this.dwellDuration = 0;
    this.accumulatedPool = 0.22;
    this.points = [this.lastPoint];

    const ob = this.overprintBlender;
    if (ob) {
      ob.beginStroke(this.agentId || 'default', this.color);
    }

    // Reset tracks to initial touchdown point
    const halfW = this.effectiveRadius;
    for (const trk of this.tracks) {
      trk.lastX = point.x + trk.u * halfW;
      trk.lastY = point.y;
      trk.contactState = true;
    }

    // Draw the initial touchdown circular dome stamp
    if (ctx) {
      this._drawDomeContactStart(ctx, point.x, point.y);
    }
  }

  /**
   * Draws the characteristic soft circular dome touchdown contact puddle.
   * Nib is a very regular round circle, with slight perimeter roughness on toothy paper.
   */
  _drawDomeContactStart(ctx, x, y) {
    const ob = this.overprintBlender;
    const strokeId = ob ? ob.getActiveStrokeId(this.agentId || 'default') : 1;
    let r = this.effectiveRadius * this.initialDomeFlare;

    ctx.save();
    if (ob) {
      ob.applyCompositeStyle(ctx, this.color, 1.0);
      if (ob.isOverprintEnabled()) {
        const ov = ob.queryAndStamp(x, y, r, strokeId, 0, this.color, true);
        if (ov.crossed) {
          ctx.fillStyle = ob.getMultipliedColor(this.color, ov.underR, ov.underG, ov.underB, ov.intensity);
          r *= ob.getSwellFactor(ov.intensity, this.overprintSwell);
        } else {
          ctx.fillStyle = ob.getFirstPassColor(this.color);
        }
      }
    } else {
      ctx.fillStyle = this.color;
      ctx.globalAlpha = 1.0;
    }

    if (r > 16 || this.paperTooth > 0.4) {
      // Subtle perimeter micro-roughness when very big or on toothy paper
      ctx.beginPath();
      const segments = 28;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const toothJitter = (Math.random() - 0.5) * (this.paperTooth * 0.9);
        const px = x + Math.cos(theta) * (r + toothJitter);
        const py = y + Math.sin(theta) * (r + toothJitter);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      // Clean regular round circular dome
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  move(point, dt, ctx, fluidEngine = null) {
    if (!this.isDown || !this.lastPoint) return;

    const prev = this.lastPoint;
    const safeDt = Math.max(0.001, Math.min(0.08, dt));
    const dx = point.x - prev.x;
    const dy = point.y - prev.y;
    const dist = Math.hypot(dx, dy);

    const ob = this.overprintBlender;
    const strokeId = ob ? ob.getActiveStrokeId(this.agentId || 'default') : 1;
    const firstPassColor = ob ? ob.getFirstPassColor(this.color) : this.color;
    const overprintActive = ob ? ob.isOverprintEnabled() : false;

    // ══════════════════════════════════════════════════════════════════
    // Handle Dwell / Hovering in Place -> Heavy Dripping
    // ══════════════════════════════════════════════════════════════════
    if (dist < 0.4) {
      this.dwellDuration += safeDt;
      // Dwell pooling rate
      const dwellPoolFactor = 1.4 * this.flowRate * (1.25 - this.viscosity * 0.6);
      this.accumulatedPool += dwellPoolFactor * safeDt;

      // Expand wet circular puddle
      if (ctx) {
        this._soakPuddle(ctx, point.x, point.y, safeDt);
      }

      // Trigger gravity drip if puddle exceeds retention threshold
      if (this.accumulatedPool > this.dripThreshold && fluidEngine) {
        const halfW = this.effectiveRadius;
        const dripX = point.x + (Math.random() - 0.5) * (halfW * 0.5);
        const dripY = point.y + halfW * 0.6;
        fluidEngine.spawnDrip(
          dripX,
          dripY,
          this.accumulatedPool * (1.1 + Math.random() * 0.4),
          this.effectiveRadius * 2,
          this.viscosity,
          this.color,
          this.paperTooth,
          this.absorptionRate,
          this.dripWidthRatio,
          strokeId
        );
        this.accumulatedPool = 0.1; // discharge pool
      }
      return;
    }

    this.dwellDuration = 0;
    this.strokeDistance += dist;
    const arcBase = this.strokeDistance - dist;

    // Smooth speed calculation
    const instSpeed = dist / safeDt;
    this.smoothedSpeed = this.smoothedSpeed * 0.72 + instSpeed * 0.28;
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

    // Normalized direction and orthogonal normal
    const ux = dx / dist;
    const uy = dy / dist;
    const normX = -uy;
    const normY = ux;

    const baseW = this.effectiveRadius * 2;

    // Align initial tracks perpendicularly to the stroke direction on first move step
    // (4.0: `<= 2` — the touchdown point and this one; 3.9's `<= 1` never held, as in ChineseBrushV2)
    if (this.points.length <= 2) {
      for (const trk of this.tracks) {
        const span = trk.u * (baseW / 2);
        trk.lastX = prev.x + normX * span;
        trk.lastY = prev.y + normY * span;
      }
    }

    if (!ctx) {
      this.lastPoint = p;
      return;
    }

    // ══════════════════════════════════════════════════════════════════
    // Dense Arc-Length Sub-stepping (~2.0px) for Smooth Continuity
    // ══════════════════════════════════════════════════════════════════
    const stepSize = 2.0;
    const subSteps = Math.max(1, Math.ceil(dist / stepSize));

    ctx.save();
    if (ob) {
      ob.applyCompositeStyle(ctx, this.color, 1.0);
    } else {
      ctx.fillStyle = this.color;
      ctx.strokeStyle = this.color;
      ctx.globalAlpha = 1.0;
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let s = 1; s <= subSteps; s++) {
      const t = s / subSteps;
      const subX = prev.x + dx * t;
      const subY = prev.y + dy * t;
      const stepStartX = prev.x + dx * ((s - 1) / subSteps);
      const stepStartY = prev.y + dy * ((s - 1) / subSteps);
      const curArc = arcBase + dist * t;

      // 1. Stroke Width: Slight Engorge when slow, Slight Waist Thinning when fast
      let targetWidth;
      if (this.speed < 80) {
        const slowFactor = Math.pow(1 - this.speed / 80, 1.6);
        targetWidth = baseW * (1.0 + slowFactor * (this.slowEngorgeRatio - 1.0));
      } else {
        const fastRatio = Math.min(1.0, (this.speed - 80) / 450);
        targetWidth = baseW * (1.0 - fastRatio * (1.0 - this.fastWaistRatio));
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

      const halfW = Math.max(1.0, targetWidth / 2);

      // 2. Continuous Solid Underlying Opaque Core Ribbon:
      // Always drawn with lineCap = 'round' and lineJoin = 'round', so the stroke is heavy,
      // darker toned, 100% solid in the center, with ZERO transverse or perpendicular artifacts!
      const coreWidth = targetWidth * 0.76;
      ctx.lineWidth = coreWidth;
      ctx.beginPath();
      ctx.moveTo(stepStartX, stepStartY);
      ctx.lineTo(subX, subY);
      ctx.stroke();

      // 3. Dense Longitudinal Flow Lines & Border Tooth Texture:
      // ALL lines run in the SAME direction as the stroke segment (longitudinal)!
      const isFast = this.speed > 160;
      const speedOverhead = isFast ? Math.min(1.0, (this.speed - 160) / 320) : 0;
      const borderSkipProbability = speedOverhead * this.borderStarveSensitivity * (0.30 + this.paperTooth * 0.70);
      const toothJitter = this.paperTooth * 0.85;

      for (const trk of this.tracks) {
        const jitter = (Math.random() - 0.5) * toothJitter;
        const span = trk.u * halfW + jitter;
        const currX = subX + normX * span;
        const currY = subY + normY * span;

        if (trk.isCore) {
          // Core longitudinal dense flow lines:
          // Heavy, rich, darker toned lines running strictly in the stroke direction
          const coreLineWidth = Math.max(1.3, (targetWidth / this.tracks.length) * trk.trackWidthFactor * 1.5);
          ctx.lineWidth = coreLineWidth;
          ctx.beginPath();
          ctx.moveTo(trk.lastX, trk.lastY);
          ctx.lineTo(currX, currY);
          ctx.stroke();
          trk.contactState = true;
        } else {
          // Border flank lines:
          // Check if dome flank maintains contact on paper fiber tooth at speed
          const skips = isFast && Math.random() < borderSkipProbability;
          if (!skips) {
            const borderLineWidth = Math.max(1.1, (targetWidth / this.tracks.length) * trk.trackWidthFactor * 1.2);
            ctx.lineWidth = borderLineWidth;
            ctx.beginPath();
            ctx.moveTo(trk.lastX, trk.lastY);
            ctx.lineTo(currX, currY);
            ctx.stroke();
          }
          trk.contactState = !skips;
        }

        trk.lastX = currX;
        trk.lastY = currY;
      }

      // 4. Slow movement pooling & running drip generation:
      if (this.speed < 60 && fluidEngine) {
        const poolIncrement = fluidEngine.calculatePooling(this.speed, this.flowRate, this.viscosity, safeDt / subSteps);
        this.accumulatedPool += poolIncrement * (safeDt / subSteps);

        if (this.accumulatedPool > this.dripThreshold && Math.random() < 0.25) {
          const dripX = subX + (Math.random() - 0.5) * (halfW * 0.4);
          const dripY = subY + halfW * 0.5;
          fluidEngine.spawnDrip(
            dripX,
            dripY,
            this.accumulatedPool * (1.0 + Math.random() * 0.5),
            targetWidth,
            this.viscosity,
            this.color,
            this.paperTooth,
            this.absorptionRate,
            this.dripWidthRatio,
            strokeId
          );
          this.accumulatedPool = 0.12;
        }
      }
    }

    ctx.restore();
    this.lastPoint = p;
  }

  /**
   * Expands puddle when stationary.
   */
  _soakPuddle(ctx, x, y, dt) {
    const ob = this.overprintBlender;
    const strokeId = ob ? ob.getActiveStrokeId(this.agentId || 'default') : 1;
    let soakRadius = this.effectiveRadius * (1.0 + Math.min(0.65, this.dwellDuration * 0.6));
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
    ctx.arc(x, y, soakRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  up(point, ctx, fluidEngine = null) {
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
      ctx.globalAlpha = 1.0;
    }

    // Squeezer end cap: regular round circular dome cap, with slight edge roughness when stopping from fast motion or on broad nibs
    let capRadius = this.effectiveRadius * (finalSpeed < 80 ? 1.08 : 0.98);
    if (ob && ob.isOverprintEnabled()) {
      const ov = ob.queryAndStamp(last.x, last.y, capRadius, strokeId, this.strokeDistance, this.color, true);
      if (ov.crossed) {
        ctx.fillStyle = ob.getMultipliedColor(this.color, ov.underR, ov.underG, ov.underB, ov.intensity);
        capRadius *= ob.getSwellFactor(ov.intensity, this.overprintSwell);
      } else {
        ctx.fillStyle = firstPassColor;
      }
    }

    if (finalSpeed > 180 || capRadius > 16 || this.paperTooth > 0.45) {
      ctx.beginPath();
      const segments = 24;
      const roughnessScale = Math.min(1.8, (finalSpeed / 220) * this.paperTooth * 1.2);
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const jitter = (Math.random() - 0.5) * roughnessScale;
        const px = last.x + Math.cos(theta) * (capRadius + jitter);
        const py = last.y + Math.sin(theta) * (capRadius + jitter);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(last.x, last.y, capRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // If finished at dwell/crawl with pool excess, spawn final drip
    if (this.accumulatedPool > this.dripThreshold * 1.1 && fluidEngine) {
      fluidEngine.spawnDrip(
        last.x,
        last.y + capRadius * 0.6,
        this.accumulatedPool,
        this.effectiveRadius * 2,
        this.viscosity,
        this.color,
        this.paperTooth,
        this.absorptionRate,
        this.dripWidthRatio,
        strokeId
      );
      this.accumulatedPool = 0;
    }

    ctx.restore();
    this.lastPoint = null;
  }

  getTelemetry() {
    return {
      instrument: this.name,
      preset: POSCA_PRESETS[this.activePresetId]?.name || this.activePresetId,
      speed: Math.round(this.speed),
      effectiveRadius: Math.round(this.effectiveRadius * 10) / 10,
      nominalWidth: `${Math.round(this.effectiveRadius * 2)} px`,
      dripWidthRatio: this.dripWidthRatio,
      dripWidth: `${(this.effectiveRadius * 2 * this.dripWidthRatio).toFixed(1)} px`,
      poolingVolume: this.accumulatedPool.toFixed(2),
      isStarving: this.speed > 160,
      isDown: this.isDown,
    };
  }
}
