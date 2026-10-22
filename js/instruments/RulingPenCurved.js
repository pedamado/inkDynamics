// ═══════════════════════════════════════════════════════════════════════════
// INK DYNAMICS — RulingPenCurved.js
// Calibrated Artistic Curved Ruling Pen & Artisanal Folded / Cola Pen.
// Faithfully models:
// 1. Lance-like / fusiform curved blade contact geometry
// 2. Dual modes: Precision constant hairline point mode vs dynamic curved blade
// 3. Bilateral rhythmic "compressed sound wave" edge chatter on both flanks
// 4. "Ellipses on train tracks": Dual outer rail tracks with transverse friction
//    skips that widen with velocity and reduce track count at high speeds
// 5. High-speed interior starvation (waves extending outside the stroke up to 3x width)
// 6. Violent metal sheet "clapping" tension release with bilateral fan-shaped spit bursts
// 7. Initial and terminal contact swell / engorgement (no gravity drips)
// ═══════════════════════════════════════════════════════════════════════════

import { Instrument } from './Instrument.js';
import { SplatterGenerator } from '../physics/SplatterGenerator.js';

export const CURVED_RULING_PRESETS = {
  curved_ruling_fine: {
    id: 'curved_ruling_fine',
    name: '1. Curved Ruling — Point Mode (Ø 2.5px)',
    description: 'Precision pointed tip mode. Ultra-fine, non-varying constant hairline stroke (black, low viscosity, zero drip, no edge chatter) for precise technical ruling.',
    penMode: 'point',
    baseRadius: 1.25,
    slowEngorgeRatio: 1.0,
    fastThinRatio: 1.0,
    chatterIntensity: 0.0,
    skipSensitivity: 0.0,
    snapIntensity: 0.0,
    bladeAngle: Math.PI / 4,
  },
  curved_ruling_medium: {
    id: 'curved_ruling_medium',
    name: '2. Curved Ruling — Medium Blade (Ø 14px)',
    description: 'Classic artisanal folded/cola pen. Curved lance blade with speed-dependent modulation, bilateral soundwave chatter, "ellipses on train tracks" skipping, and lateral sheet-clapping spit bursts.',
    penMode: 'blade',
    baseRadius: 7.0,
    slowEngorgeRatio: 1.38,
    fastThinRatio: 0.32,
    chatterIntensity: 1.25,
    skipSensitivity: 1.0,
    snapIntensity: 1.0,
    bladeAngle: Math.PI / 4,
  },
  curved_ruling_broad: {
    id: 'curved_ruling_broad',
    name: '3. Curved Ruling — Broad Expressive (Ø 26px)',
    description: 'Large expressive curved ruling blade. Dramatic width swell, explosive lateral spit droplets, deep soundwave chatter flaring up to 3x width, and hollow interior train tracks at velocity.',
    penMode: 'blade',
    baseRadius: 13.0,
    slowEngorgeRatio: 1.48,
    fastThinRatio: 0.22,
    chatterIntensity: 1.6,
    skipSensitivity: 1.2,
    snapIntensity: 1.45,
    bladeAngle: Math.PI / 4,
  },
};

export class RulingPenCurved extends Instrument {
  constructor(options = {}) {
    super('Curved Ruling / Folded Pen', {
      type: 'ruling_pen_curved',
      baseRadius: options.baseRadius || 7.0,
      viscosity: options.viscosity ?? 0.25, // Low viscosity drawing ink
      flowRate: options.flowRate ?? 1.2,
      slowEngorge: options.slowEngorgeRatio ?? 1.38,
      fastThinning: options.fastThinRatio ?? 0.32,
      ...options,
    });

    this.activePresetId = options.preset || 'curved_ruling_medium';
    this.penMode = options.penMode || 'blade'; // 'point' or 'blade'
    this.bladeAngle = options.bladeAngle ?? (Math.PI / 4); // 45 degree blade orientation
    this.bladeStiffness = options.bladeStiffness ?? 0.65; // Flexible sheet (cola can aluminum)
    this.chatterIntensity = options.chatterIntensity ?? 1.25;
    this.skipSensitivity = options.skipSensitivity ?? 1.0;
    this.snapIntensity = options.snapIntensity ?? 1.0;
    this.slowEngorgeRatio = options.slowEngorgeRatio ?? 1.38;
    this.fastThinRatio = options.fastThinRatio ?? 0.32;
    this.initialTouchFlare = options.initialTouchFlare ?? 1.32;

    // Additional User Customization Controls
    this.minWidthScale = options.minWidthScale ?? 0.25; // 0.10x to 1.0x
    this.maxWidthScale = options.maxWidthScale ?? 2.0;  // 1.0x to 3.5x
    this.minSpitCount = options.minSpitCount ?? 4;      // 2 to 15 droplets
    this.maxSpitCount = options.maxSpitCount ?? 18;     // 8 to 40 droplets
    this.maxDropletSize = options.maxDropletSize ?? 3.5; // 1.5px to 14.0px
    this.burstExplosionWidth = options.burstExplosionWidth ?? 2.2; // 1.0x to 4.0x

    // Simulation state
    this.phase = Math.random() * Math.PI * 2;
    this.bladeTension = 0; // Accumulated elastic energy (0 to 1)
    this.lastSkipDistance = 0;
    this.recentSnaps = 0;
    this.trackMode = 2; // 2 tracks, dropping to 1 at extreme speed

    // Volcano Burst State
    this.burstActive = false;
    this.burstDistance = 0;
    this.burstTotalDist = 45;
    this.burstPeakWidthMultiplier = 2.2;

    if (options.preset && CURVED_RULING_PRESETS[options.preset]) {
      this.applyPreset(options.preset);
    }
  }

  applyPreset(presetId) {
    const p = CURVED_RULING_PRESETS[presetId];
    if (!p) return;
    this.activePresetId = presetId;
    this.penMode = p.penMode;
    this.baseRadius = p.baseRadius;
    this.slowEngorgeRatio = p.slowEngorgeRatio;
    this.fastThinRatio = p.fastThinRatio;
    this.chatterIntensity = p.chatterIntensity;
    this.skipSensitivity = p.skipSensitivity;
    this.snapIntensity = p.snapIntensity;
    this.bladeAngle = p.bladeAngle;
  }

  setBladeAngle(angle) {
    this.bladeAngle = angle;
  }

  setChatterIntensity(val) {
    this.chatterIntensity = Math.max(0, val);
  }

  setSnapIntensity(val) {
    this.snapIntensity = Math.max(0, val);
  }

  setSkipSensitivity(val) {
    this.skipSensitivity = Math.max(0.1, val);
  }

  setPenMode(mode) {
    this.penMode = mode;
  }

  setMinWidthScale(val) {
    this.minWidthScale = Math.max(0.05, Math.min(1.0, val));
  }

  setMaxWidthScale(val) {
    this.maxWidthScale = Math.max(1.0, Math.min(4.0, val));
  }

  setMinSpitCount(val) {
    this.minSpitCount = Math.max(1, Math.round(val));
  }

  setMaxSpitCount(val) {
    this.maxSpitCount = Math.max(this.minSpitCount, Math.round(val));
  }

  setMaxDropletSize(val) {
    this.maxDropletSize = Math.max(1.0, val);
  }

  setBurstExplosionWidth(val) {
    this.burstExplosionWidth = Math.max(1.0, val);
  }

  _drawPillEllipse(ctx, cx, cy, angle, rMajor, rMinor) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    const numPoints = 24;
    ctx.beginPath();
    for (let i = 0; i < numPoints; i++) {
      const theta = (i / numPoints) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // Pill/capsule shape with subtle micro-irregularity from paper tooth
      const baseDistX = rMajor * Math.sign(cosT) * Math.pow(Math.abs(cosT), 0.90);
      const baseDistY = rMinor * sinT;

      const jitter = 1.0 + (Math.sin(theta * 6 + i) * 0.045 + Math.cos(theta * 11) * 0.035);
      const px = baseDistX * jitter;
      const py = baseDistY * jitter;

      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  down(point, ctx, fluidEngine = null) {
    super.down(point);
    this.phase = Math.random() * Math.PI * 2;
    this.bladeTension = 0;
    this.lastSkipDistance = 0;
    this.recentSnaps = 0;
    this.trackMode = 2;
    this.burstActive = false;
    this.burstDistance = 0;

    if (!ctx) return;

    const ob = this.overprintBlender
      ? this.overprintBlender.beginStroke(point, this.effectiveRadius, this.color, this.agentId, this.overprintSwell)
      : null;
    const swell = ob ? ob.swellMultiplier : 1.0;

    ctx.save();
    if (ob) ctx.globalCompositeOperation = ob.compositeOp;
    ctx.fillStyle = ob ? ob.activeColor : this.color;
    ctx.strokeStyle = ob ? ob.activeColor : this.color;
    ctx.globalAlpha = this.opacity;

    if (this.penMode === 'point') {
      // Precision point touchdown dot
      const ptRadius = Math.max(0.7, this.effectiveRadius * swell);
      ctx.beginPath();
      ctx.arc(point.x, point.y, ptRadius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Irregular pill-like ellipse synchronized with pen nib angle
      const rMajor = Math.max(2.4, this.effectiveRadius * (this.initialTouchFlare || 1.35) * swell);
      const rMinor = Math.max(0.65, Math.min(2.4, 0.75 + this.effectiveRadius * 0.08) * swell);
      this._drawPillEllipse(ctx, point.x, point.y, this.bladeAngle, rMajor, rMinor);
    }
    ctx.restore();

    if (this.overprintBlender && ob) {
      this.overprintBlender.recordSegment(point.x, point.y, point.x, point.y, this.effectiveRadius, this.color, ob.strokeId, 0);
    }
  }

  move(point, dt, ctx, fluidEngine = null) {
    const prev = this.lastPoint;
    const p = super.move(point, dt);
    if (!prev || !p || !ctx) return;

    const dist = p.dist;
    if (dist < 0.2) return;

    const safeDt = Math.max(0.001, dt);
    const speed = p.speed;

    const ob = this.overprintBlender
      ? this.overprintBlender.stepMove(prev.x, prev.y, p.x, p.y, this.effectiveRadius, this.color, this.agentId, this.overprintSwell)
      : null;
    const swell = ob ? ob.swellMultiplier : 1.0;

    ctx.save();
    if (ob) ctx.globalCompositeOperation = ob.compositeOp;
    ctx.fillStyle = ob ? ob.overprintColor : this.color;
    ctx.strokeStyle = ob ? ob.overprintColor : this.color;
    ctx.globalAlpha = this.opacity;

    // ══════════════════════════════════════════════════════════════════
    // MODE 1: POINT MODE (Precision Hairline, Constant Width, Zero Ripple)
    // ══════════════════════════════════════════════════════════════════
    if (this.penMode === 'point') {
      const hairline = Math.max(0.8, this.effectiveRadius * 2 * swell);
      ctx.lineWidth = hairline;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.restore();
      if (this.overprintBlender && ob) {
        this.overprintBlender.recordSegment(prev.x, prev.y, p.x, p.y, hairline / 2, this.color, ob.strokeId, ob.arcLength);
      }
      this.lastPoint = p;
      return;
    }

    // ══════════════════════════════════════════════════════════════════
    // MODE 2: CURVED BLADE MODE (Artisanal Folded / Cola Pen)
    // ══════════════════════════════════════════════════════════════════
    const ux = p.dx / dist;
    const uy = p.dy / dist;
    const perpX = -uy;
    const perpY = ux;
    const strokeTheta = Math.atan2(uy, ux);

    // 1. Fusiform Curved Lance Geometry (Orientation modulation)
    const angleDiff = Math.abs(Math.cos(strokeTheta - this.bladeAngle));
    const bladeFormFactor = 0.35 + 0.65 * angleDiff;

    // 2. Speed modulation (Slow swell vs high speed waisting)
    const slowRatio = Math.max(0, 1 - Math.min(1, speed / 240));
    const engorge = 1.0 + Math.pow(slowRatio, 1.8) * (this.slowEngorgeRatio - 1.0);

    const fastRatio = Math.min(1.0, Math.max(0, (speed - 160) / 520));
    const thinning = 1.0 - fastRatio * (1.0 - this.fastThinRatio);

    const pFactor = 0.85 + (p.p || 0.5) * 0.3;

    // Base nominal stroke width with User Min/Max Width constraints
    const baseFullW = this.effectiveRadius * 2;
    const minAllowedW = Math.max(1.0, baseFullW * this.minWidthScale);
    const maxAllowedW = baseFullW * this.maxWidthScale;
    let nominalWidth = Math.max(
      minAllowedW,
      Math.min(maxAllowedW, baseFullW * bladeFormFactor * engorge * thinning * pFactor)
    ) * swell;

    // 3. Volcano Burst Pressure Release Dynamics (U-shaped Catenary Decay)
    let burstSpacingMod = 1.0;
    if (this.burstActive) {
      this.burstDistance += dist;
      const u = Math.min(1.0, this.burstDistance / this.burstTotalDist);

      // Fast U-shaped catenary decay curve:
      // Spreads out perpendicularly at burst, rapidly decays, dips slightly below nominal waisting, then recovers
      const catenaryDecay = 1.0 + (this.burstPeakWidthMultiplier - 1.0) * Math.exp(-5.2 * u) - 0.22 * Math.sin(Math.PI * u) * (1.0 - u);
      nominalWidth *= catenaryDecay;

      // Spacing dynamics: very compact at explosion (u=0), progressively wider skips during starvation dip, returns to 1.0
      burstSpacingMod = 0.5 + 0.5 * u + 0.6 * Math.sin(Math.PI * u);

      if (u >= 1.0) {
        this.burstActive = false;
      }
    }

    const halfW = nominalWidth / 2;

    // 4. Bilateral Soundwave Edge Chatter (Rhythmic Compressed Wave Texture)
    this.phase += (dist / 4.2) * (Math.PI * 2);
    const combWave = Math.sin(this.phase) * 0.70 + Math.sin(this.phase * 2.4) * 0.30;
    const speedChatterBoost = 0.8 + Math.min(1.2, speed / 260);
    const maxWave = Math.max(1.0, halfW * 0.35);
    const waveAmp = Math.min(maxWave, (0.8 + this.paperTooth * 1.2) * this.chatterIntensity * speedChatterBoost);
    const waveOffset = combWave * waveAmp;

    // Bilaterally symmetric edge ripple with rounded crests
    const effectiveLeftW = Math.max(0.8, halfW + waveOffset);
    const effectiveRightW = Math.max(0.8, halfW + waveOffset);

    // 5. Highly Dense & Compact Assorted Lines (with Round Caps) and Ellipses
    // Spacing: multiplies by skipSensitivity so low value = dense ladder, high value = wide skips
    const isFast = speed > 200;
    const stepDist = isFast
      ? Math.max(0.9, 0.9 + Math.min(9.0, (speed - 200) * 0.022 * this.skipSensitivity))
      : 0.8;
    const actualStepDist = stepDist * burstSpacingMod;
    const numSteps = Math.max(1, Math.ceil(dist / actualStepDist));
    const isTrainTracks = speed > 220 && nominalWidth >= 7.0;
    this.trackMode = isTrainTracks ? (speed > 520 && Math.random() < 0.35 ? 1 : 2) : 2;

    // Batch A: Compact overlapping ellipses (100% solid ink, zero gray)
    ctx.beginPath();
    for (let i = 1; i <= numSteps; i++) {
      const t = i / numSteps;
      const curX = prev.x + (p.x - prev.x) * t;
      const curY = prev.y + (p.y - prev.y) * t;

      const rx = effectiveLeftW * (0.82 + Math.random() * 0.36);
      const ry = Math.max(1.2, 1.8 + Math.random() * 2.4);
      const rot = strokeTheta + Math.PI / 2 + (Math.random() - 0.5) * 0.25;

      ctx.ellipse(curX, curY, rx, ry, rot, 0, Math.PI * 2);
    }
    ctx.fill();

    // Batch B: Assorted lines with round caps (creating round bubbling lobes on flanks)
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.4, 2.2 * this.sizeScale);
    ctx.beginPath();
    for (let i = 1; i <= numSteps; i++) {
      const t = i / numSteps;
      const curX = prev.x + (p.x - prev.x) * t;
      const curY = prev.y + (p.y - prev.y) * t;

      const lx = curX - perpX * (effectiveLeftW * (0.90 + Math.random() * 0.20));
      const ly = curY - perpY * (effectiveLeftW * (0.90 + Math.random() * 0.20));
      const rx = curX + perpX * (effectiveRightW * (0.90 + Math.random() * 0.20));
      const ry = curY + perpY * (effectiveRightW * (0.90 + Math.random() * 0.20));

      ctx.moveTo(lx, ly);
      ctx.lineTo(rx, ry);
    }
    ctx.stroke();

    // If Train Tracks are active at high velocity, draw outer curved rails
    if (isTrainTracks) {
      const railWidth = Math.max(1.2, 1.4 * this.sizeScale);
      ctx.lineWidth = railWidth;
      ctx.lineCap = 'round';

      // Left rail
      ctx.beginPath();
      ctx.moveTo(prev.x - perpX * halfW, prev.y - perpY * halfW);
      ctx.lineTo(p.x - perpX * halfW, p.y - perpY * halfW);
      ctx.stroke();

      // Right rail (if not skipped by 1-track mode)
      if (this.trackMode === 2) {
        ctx.beginPath();
        ctx.moveTo(prev.x + perpX * halfW, prev.y + perpY * halfW);
        ctx.lineTo(p.x + perpX * halfW, p.y + perpY * halfW);
        ctx.stroke();
      }
    }

    // 6. Metal Sheet Tension & "Clapping" Spit Burst Generation with Provenance Droplets
    this.bladeTension += (dist / (80 * (1.0 + this.bladeStiffness)));
    const snapThreshold = 0.85 + 0.35 * this.bladeStiffness;

    if (this.bladeTension >= snapThreshold && speed > 200 && this.snapIntensity > 0) {
      this.bladeTension = 0;
      this.recentSnaps++;

      // Trigger volcano shockwave
      this.burstActive = true;
      this.burstDistance = 0;
      this.burstTotalDist = Math.max(30, 25 + (speed / 280) * 35);
      this.burstPeakWidthMultiplier = this.burstExplosionWidth;

      const rawCount = this.minSpitCount + Math.random() * (this.maxSpitCount - this.minSpitCount);
      const count = Math.max(2, Math.round(rawCount * this.snapIntensity));
      const intensity = (0.75 + Math.min(1.4, speed / 320)) * this.snapIntensity;

      const leftDirX = perpX + (Math.random() - 0.5) * 0.35;
      const leftDirY = perpY + (Math.random() - 0.5) * 0.35;
      const rightDirX = -perpX + (Math.random() - 0.5) * 0.35;
      const rightDirY = -perpY + (Math.random() - 0.5) * 0.35;

      const dropColor = ob ? ob.firstPassColor : this.color;
      const dropsLeft = SplatterGenerator.generateBurst({
        x: p.x,
        y: p.y,
        originX: p.x,
        originY: p.y,
        dirX: leftDirX,
        dirY: leftDirY,
        intensity: intensity * 0.9,
        speed: speed * 0.85,
        color: dropColor,
        spreadAngle: 0.95,
        count: Math.ceil(count / 2),
        solid: true,
        maxDropletSize: this.maxDropletSize,
      });

      const dropsRight = SplatterGenerator.generateBurst({
        x: p.x,
        y: p.y,
        originX: p.x,
        originY: p.y,
        dirX: rightDirX,
        dirY: rightDirY,
        intensity: intensity * 0.9,
        speed: speed * 0.85,
        color: dropColor,
        spreadAngle: 0.95,
        count: Math.ceil(count / 2),
        solid: true,
        maxDropletSize: this.maxDropletSize,
      });

      SplatterGenerator.renderDroplets(ctx, dropsLeft.concat(dropsRight), true);
    }

    ctx.restore();

    if (this.overprintBlender && ob) {
      this.overprintBlender.recordSegment(prev.x, prev.y, p.x, p.y, halfW, this.color, ob.strokeId, ob.arcLength);
    }

    this.lastPoint = p;
  }

  up(point, ctx, fluidEngine = null) {
    const last = super.up(point);
    if (!last || !ctx) return;

    const firstColor = this.overprintBlender ? this.overprintBlender.getFirstPassColor(this.color) : this.color;
    const compOp = this.overprintBlender ? this.overprintBlender.getCompositeOperation(this.color) : 'source-over';

    ctx.save();
    ctx.globalCompositeOperation = compOp;
    ctx.fillStyle = firstColor;
    ctx.strokeStyle = firstColor;
    ctx.globalAlpha = this.opacity;

    if (this.penMode === 'point') {
      // Precision point termination dot
      ctx.beginPath();
      ctx.arc(last.x, last.y, Math.max(0.7, this.effectiveRadius), 0, Math.PI * 2);
      ctx.fill();
    } else {
      const finalSpeed = last.speed || this.speed || 0;
      if (finalSpeed > 220) {
        // High-speed flick: tapered terminal tail
        const dx = last.dx || 1;
        const dy = last.dy || 0;
        const dist = Math.hypot(dx, dy) || 1;
        const ux = dx / dist;
        const uy = dy / dist;
        const tailLen = Math.min(28, 8 + finalSpeed / 25);

        ctx.lineWidth = 1.0;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(last.x + ux * tailLen, last.y + uy * tailLen);
        ctx.stroke();
      } else {
        // Decelerated stop: engorged pill-like terminal stamp at blade angle
        const rMajor = Math.max(2.2, this.effectiveRadius * 1.15);
        const rMinor = Math.max(0.65, Math.min(2.2, 0.75 + this.effectiveRadius * 0.08));
        this._drawPillEllipse(ctx, last.x, last.y, this.bladeAngle, rMajor, rMinor);
      }
    }

    ctx.restore();
    this.lastPoint = null;
  }

  getTelemetry() {
    return {
      instrument: this.name,
      preset: CURVED_RULING_PRESETS[this.activePresetId]?.name || this.activePresetId,
      penMode: this.penMode,
      speed: Math.round(this.speed),
      effectiveRadius: Math.round(this.effectiveRadius * 10) / 10,
      nominalWidth: this.penMode === 'point' ? '1.5 px (Hairline)' : `${Math.round(this.effectiveRadius * 2)} px`,
      bladeTension: Math.round(this.bladeTension * 100),
      trackMode: this.trackMode,
      isStarving: this.speed > 240,
      isDown: this.isDown,
    };
  }
}
