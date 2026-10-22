// ═══════════════════════════════════════════════════════════════════════════
// INK DYNAMICS — RulingPenFlat.js
// Calibrated Flat Ruling Pen & German Expressionist Chisel Blade.
// Faithfully models:
// 1. Monoline ribbon geometry along shaft with sharp rectangular chisel caps
// 2. Dual modes: Precision hairline point mode vs broad flat chisel blade
// 3. Marked edge asymmetry: one edge pristine, straight and razor sharp;
//    the opposing edge ragged, jagged with high-frequency soundwave teeth
//    (flaring outward up to 3x stroke width at velocity)
// 4. "Ellipses on train tracks": Outer blade corner rails with interior starvation
//    and transverse friction ladder skips whose spacing widens with speed
// 5. One-sided violent metal sheet "clapping" tension release with lateral spit explosions
// 6. Non-modulated shaft width with zero gravity drips
// ═══════════════════════════════════════════════════════════════════════════

import { Instrument } from './Instrument.js';
import { SplatterGenerator } from '../physics/SplatterGenerator.js';

export const FLAT_RULING_PRESETS = {
  flat_ruling_point: {
    id: 'flat_ruling_point',
    name: '1. Flat Ruling — Point Mode (Ø 2.0px)',
    description: 'Precision pointed nib edge mode. Constant ultra-fine hairline (0.8–1.5px), non-modulated, razor straight, black, zero drip, no edge chatter.',
    penMode: 'point',
    baseRadius: 1.0,
    slowEngorgeRatio: 1.0,
    fastThinRatio: 1.0,
    chatterIntensity: 0.0,
    edgeAsymmetry: 1.0,
    asymmetrySide: 'right',
    skipSensitivity: 0.0,
    snapIntensity: 0.0,
    bladeAngle: Math.PI / 4,
  },
  flat_ruling_medium: {
    id: 'flat_ruling_medium',
    name: '2. Flat Ruling — Medium Chisel (Ø 16px)',
    description: 'Classic flat ruling pen nib. Non-modulated ribbon shaft, sharp chisel caps, marked edge asymmetry (pristine straight left edge vs ragged jagged right edge), and one-sided spit explosions.',
    penMode: 'blade',
    baseRadius: 8.0,
    slowEngorgeRatio: 1.05,
    fastThinRatio: 0.85,
    chatterIntensity: 1.35,
    edgeAsymmetry: 0.92,
    asymmetrySide: 'right',
    skipSensitivity: 1.0,
    snapIntensity: 1.0,
    bladeAngle: Math.PI / 4,
  },
  flat_ruling_broad: {
    id: 'flat_ruling_broad',
    name: '3. Flat Ruling — Broad Chisel (Ø 28px)',
    description: 'Large German expressionist flat ruling blade. Broad chisel ribbon with extreme one-sided soundwave teeth flaring up to 3x width, dual corner train tracks with hollow interior, and violent lateral spit showers.',
    penMode: 'blade',
    baseRadius: 14.0,
    slowEngorgeRatio: 1.08,
    fastThinRatio: 0.78,
    chatterIntensity: 1.75,
    edgeAsymmetry: 0.95,
    asymmetrySide: 'right',
    skipSensitivity: 1.25,
    snapIntensity: 1.4,
    bladeAngle: Math.PI / 4,
  },
};

export class RulingPenFlat extends Instrument {
  constructor(options = {}) {
    super('Flat Ruling / Chisel Pen', {
      type: 'ruling_pen_flat',
      baseRadius: options.baseRadius || 8.0,
      viscosity: options.viscosity ?? 0.22, // Low viscosity fluid drawing ink
      flowRate: options.flowRate ?? 1.25,
      slowEngorge: options.slowEngorgeRatio ?? 1.05,
      fastThinning: options.fastThinRatio ?? 0.85,
      ...options,
    });

    this.activePresetId = options.preset || 'flat_ruling_medium';
    this.penMode = options.penMode || 'blade'; // 'point' or 'blade'
    this.bladeAngle = options.bladeAngle ?? (Math.PI / 4); // 45 degree chisel orientation
    this.bladeStiffness = options.bladeStiffness ?? 0.75; // Rigid German spring-steel plates
    this.chatterIntensity = options.chatterIntensity ?? 1.35;
    this.edgeAsymmetry = options.edgeAsymmetry ?? 0.92; // 0.0 symmetric -> 1.0 pure one-sided
    this.asymmetrySide = options.asymmetrySide || 'right'; // 'right' or 'left' ragged flank
    this.skipSensitivity = options.skipSensitivity ?? 1.0;
    this.snapIntensity = options.snapIntensity ?? 1.0;
    this.slowEngorgeRatio = options.slowEngorgeRatio ?? 1.05;
    this.fastThinRatio = options.fastThinRatio ?? 0.85;

    // Additional User Customization Controls
    this.minWidthScale = options.minWidthScale ?? 0.35; // 0.10x to 1.0x
    this.maxWidthScale = options.maxWidthScale ?? 2.0;  // 1.0x to 3.5x
    this.minSpitCount = options.minSpitCount ?? 4;      // 2 to 15 droplets
    this.maxSpitCount = options.maxSpitCount ?? 18;     // 8 to 40 droplets
    this.maxDropletSize = options.maxDropletSize ?? 3.5; // 1.5px to 14.0px
    this.burstExplosionWidth = options.burstExplosionWidth ?? 2.2; // 1.0x to 4.0x

    // Simulation state
    this.phase = Math.random() * Math.PI * 2;
    this.bladeTension = 0;
    this.lastSkipDistance = 0;
    this.recentSnaps = 0;
    this.trackMode = 2;

    // Volcano Burst State
    this.burstActive = false;
    this.burstDistance = 0;
    this.burstTotalDist = 45;
    this.burstPeakWidthMultiplier = 2.2;

    if (options.preset && FLAT_RULING_PRESETS[options.preset]) {
      this.applyPreset(options.preset);
    }
  }

  applyPreset(presetId) {
    const p = FLAT_RULING_PRESETS[presetId];
    if (!p) return;
    this.activePresetId = presetId;
    this.penMode = p.penMode;
    this.baseRadius = p.baseRadius;
    this.slowEngorgeRatio = p.slowEngorgeRatio;
    this.fastThinRatio = p.fastThinRatio;
    this.chatterIntensity = p.chatterIntensity;
    this.edgeAsymmetry = p.edgeAsymmetry;
    this.asymmetrySide = p.asymmetrySide;
    this.skipSensitivity = p.skipSensitivity;
    this.snapIntensity = p.snapIntensity;
    this.bladeAngle = p.bladeAngle;
  }

  setBladeAngle(angle) {
    this.bladeAngle = angle;
  }

  setEdgeAsymmetry(val) {
    this.edgeAsymmetry = Math.max(0.0, Math.min(1.0, val));
  }

  setAsymmetrySide(side) {
    if (side === 'left' || side === 'right') {
      this.asymmetrySide = side;
    }
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

    const ob = this.overprintBlender;
    const strokeId = ob ? ob.beginStroke(this.agentId || 'default', this.color) : 1;

    if (!ctx) return;

    ctx.save();
    const firstPassColor = ob ? ob.getFirstPassColor(this.color) : this.color;
    if (ob) {
      ob.applyCompositeStyle(ctx, this.color, this.opacity);
    } else {
      ctx.fillStyle = this.color;
      ctx.strokeStyle = this.color;
      ctx.globalAlpha = this.opacity;
    }

    let swellMod = 1.0;
    if (ob && ob.isOverprintEnabled()) {
      const ov = ob.queryAndStamp(point.x, point.y, Math.max(1.2, this.effectiveRadius), strokeId, 0, this.color, true);
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

    if (this.penMode === 'point') {
      // Hairline touchdown dot
      const ptRadius = Math.max(0.7, this.effectiveRadius * swellMod);
      ctx.beginPath();
      ctx.arc(point.x, point.y, ptRadius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Irregular pill-like ellipse synchronized with pen nib angle
      const rMajor = Math.max(2.4, this.effectiveRadius * (this.initialTouchFlare || 1.35) * swellMod);
      const rMinor = Math.max(0.65, Math.min(2.4, 0.75 + this.effectiveRadius * 0.08) * swellMod);
      this._drawPillEllipse(ctx, point.x, point.y, this.bladeAngle, rMajor, rMinor);
    }
    ctx.restore();
  }

  move(point, dt, ctx, fluidEngine = null) {
    const prev = this.lastPoint;
    const p = super.move(point, dt);
    if (!prev || !p || !ctx) return;

    const dist = p.dist;
    if (dist < 0.2) return;

    const safeDt = Math.max(0.001, dt);
    const speed = p.speed;

    const ob = this.overprintBlender;
    const strokeId = ob ? ob.getActiveStrokeId(this.agentId || 'default') : 1;
    const firstPassColor = ob ? ob.getFirstPassColor(this.color) : this.color;
    const overprintActive = ob ? ob.isOverprintEnabled() : false;

    ctx.save();
    if (ob) {
      ob.applyCompositeStyle(ctx, this.color, this.opacity);
    } else {
      ctx.fillStyle = this.color;
      ctx.strokeStyle = this.color;
      ctx.globalAlpha = this.opacity;
    }

    // ══════════════════════════════════════════════════════════════════
    // MODE 1: POINT MODE (Precision Hairline, Constant Non-Modulated Width)
    // ══════════════════════════════════════════════════════════════════
    if (this.penMode === 'point') {
      let hairline = Math.max(0.8, this.effectiveRadius * 2);
      if (overprintActive) {
        const midX = (prev.x + p.x) * 0.5;
        const midY = (prev.y + p.y) * 0.5;
        const ov = ob.queryAndStamp(midX, midY, hairline * 0.65, strokeId, this.strokeDistance, this.color, true);
        if (ov.crossed) {
          const multColor = ob.getMultipliedColor(this.color, ov.underR, ov.underG, ov.underB, ov.intensity);
          ctx.strokeStyle = multColor;
          hairline *= ob.getSwellFactor(ov.intensity, this.overprintSwell);
        } else {
          ctx.strokeStyle = firstPassColor;
        }
      }
      ctx.lineWidth = hairline;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.restore();
      this.lastPoint = p;
      return;
    }

    // ══════════════════════════════════════════════════════════════════
    // MODE 2: FLAT CHISEL BLADE MODE (Perpendicular Rectangle Waveform Dynamics)
    // ══════════════════════════════════════════════════════════════════
    const ux = p.dx / dist;
    const uy = p.dy / dist;
    const perpX = -uy;
    const perpY = ux;
    const strokeTheta = Math.atan2(uy, ux);

    // 1. Chisel Ribbon Geometry (Constant width along shaft, very little variation)
    const angleDiff = Math.abs(Math.sin(strokeTheta - this.bladeAngle));
    const ribbonFactor = Math.max(0.35, angleDiff);

    // Base nominal stroke width with User Min/Max Width constraints
    const pFactor = 0.97 + (p.p || 0.5) * 0.06;
    const baseFullW = this.effectiveRadius * 2;
    const minAllowedW = Math.max(1.0, baseFullW * this.minWidthScale);
    const maxAllowedW = baseFullW * this.maxWidthScale;
    let nominalWidth = Math.max(
      minAllowedW,
      Math.min(maxAllowedW, baseFullW * ribbonFactor * pFactor)
    );

    // 2. Volcano Burst Pressure Release Dynamics (U-shaped Catenary Decay)
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

    const baseHalfW = nominalWidth / 2;

    // 3. Waveform Edge Asymmetry
    const isRightRagged = this.asymmetrySide === 'right';
    const pristineFactor = (1.0 - this.edgeAsymmetry) * 0.04; // Razor-straight edge
    const raggedFactor = 1.0 + this.edgeAsymmetry * 1.2;

    // 4. Spacing & Perpendicular Rectangle Stripes
    // Low skipSensitivity = compact ladder / solid line; High skipSensitivity = wide skips / train tracks
    const isFast = speed > 200;
    const stepDist = isFast
      ? Math.max(0.9, 0.9 + Math.min(9.0, (speed - 200) * 0.022 * this.skipSensitivity))
      : 0.8;
    const actualStepDist = stepDist * burstSpacingMod;
    const stripeThick = isFast ? Math.max(1.1, 1.5 - (speed - 200) * 0.0008) : 1.4;
    const halfThick = stripeThick / 2;

    const numSteps = Math.max(1, Math.ceil(dist / actualStepDist));
    const actualStep = dist / numSteps;
    const arcBase = this.strokeDistance - dist;

    // Train tracks trigger on medium/large nibs at speed > 220 px/s
    const isTrainTracks = speed > 220 && nominalWidth >= 7.5;
    this.trackMode = isTrainTracks ? (speed > 520 && Math.random() < 0.35 ? 1 : 2) : 2;

    let maxCrossIntensity = 0;
    let crossUnderR = 12, crossUnderG = 12, crossUnderB = 12;

    for (let i = 1; i <= numSteps; i++) {
      const t = i / numSteps;
      const curX = prev.x + (p.x - prev.x) * t;
      const curY = prev.y + (p.y - prev.y) * t;
      const curArc = arcBase + dist * t;

      let stepSwell = 1.0;
      let stepColor = firstPassColor;
      if (overprintActive) {
        const ov = ob.queryAndStamp(curX, curY, Math.max(1.2, baseHalfW), strokeId, curArc, this.color, true);
        if (ov.crossed) {
          stepColor = ob.getMultipliedColor(this.color, ov.underR, ov.underG, ov.underB, ov.intensity);
          stepSwell = ob.getSwellFactor(ov.intensity, this.overprintSwell);
          if (ov.intensity > maxCrossIntensity) {
            maxCrossIntensity = ov.intensity;
            crossUnderR = ov.underR;
            crossUnderG = ov.underG;
            crossUnderB = ov.underB;
          }
        }
      }

      const halfW = baseHalfW * stepSwell;

      // High-frequency soundwave vibration phase
      this.phase += (actualStep / 3.8) * (Math.PI * 2);
      const combWave = Math.sin(this.phase) * 0.65 + Math.sin(this.phase * 2.85) * 0.35;
      const maxTooth = Math.max(1.0, halfW * 0.32);
      const toothAmp = Math.min(maxTooth, (0.8 + this.paperTooth * 1.2) * this.chatterIntensity * (0.8 + Math.min(1.2, speed / 260)));

      const leftWave = isRightRagged ? (combWave * toothAmp * pristineFactor) : (Math.max(0, combWave) * toothAmp * raggedFactor);
      const rightWave = isRightRagged ? (Math.max(0, combWave) * toothAmp * raggedFactor) : (combWave * toothAmp * pristineFactor);

      const curLeftW = Math.max(0.6, halfW + leftWave);
      const curRightW = Math.max(0.6, halfW + rightWave);

      const lx = curX - perpX * curLeftW;
      const ly = curY - perpY * curLeftW;
      const rx = curX + perpX * curRightW;
      const ry = curY + perpY * curRightW;

      // When train tracks active at very high speed, some interior rungs skip
      let drawStripe = true;
      if (isTrainTracks && speed > 300) {
        const skipProb = Math.min(0.72, (speed - 300) / 300);
        if (Math.random() < skipProb) {
          drawStripe = false;
        }
      }

      if (drawStripe) {
        ctx.fillStyle = stepColor;
        const stepHalfThick = halfThick * (1.0 + (stepSwell - 1.0) * 0.5);
        // Rectangle corners strictly perpendicular to stroke direction
        const c1x = lx - ux * stepHalfThick;
        const c1y = ly - uy * stepHalfThick;
        const c2x = rx - ux * stepHalfThick;
        const c2y = ry - uy * stepHalfThick;
        const c3x = rx + ux * stepHalfThick;
        const c3y = ry + uy * stepHalfThick;
        const c4x = lx + ux * stepHalfThick;
        const c4y = ly + uy * stepHalfThick;

        ctx.beginPath();
        ctx.moveTo(c1x, c1y);
        ctx.lineTo(c2x, c2y);
        ctx.lineTo(c3x, c3y);
        ctx.lineTo(c4x, c4y);
        ctx.closePath();
        ctx.fill();
      }
    }

    // If Train Tracks are active, draw the continuous outer corner rail tracks
    if (isTrainTracks) {
      const railSwell = maxCrossIntensity > 0 && ob ? ob.getSwellFactor(maxCrossIntensity, this.overprintSwell) : 1.0;
      const railHalfW = baseHalfW * railSwell;
      const railWidth = Math.max(1.2, 1.5 * this.sizeScale * railSwell);
      ctx.strokeStyle = maxCrossIntensity > 0 && ob
        ? ob.getMultipliedColor(this.color, crossUnderR, crossUnderG, crossUnderB, maxCrossIntensity)
        : firstPassColor;
      ctx.lineWidth = railWidth;
      ctx.lineCap = 'butt';

      // Left rail
      ctx.beginPath();
      ctx.moveTo(prev.x - perpX * railHalfW, prev.y - perpY * railHalfW);
      ctx.lineTo(p.x - perpX * railHalfW, p.y - perpY * railHalfW);
      ctx.stroke();

      // Right rail (if not skipped by 1-track mode)
      if (this.trackMode === 2) {
        ctx.beginPath();
        ctx.moveTo(prev.x + perpX * railHalfW, prev.y + perpY * railHalfW);
        ctx.lineTo(p.x + perpX * railHalfW, p.y + perpY * railHalfW);
        ctx.stroke();
      }
    }

    // 5. One-Sided Clapping Tension Release (Lateral Spit Explosions - 100% Solid Ink)
    this.bladeTension += (dist / (75 * (1.0 + this.bladeStiffness)));
    const snapThreshold = 0.82 + 0.35 * this.bladeStiffness;

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

      const raggedSign = isRightRagged ? 1 : -1;
      const raggedDirX = perpX * raggedSign + (Math.random() - 0.5) * 0.3;
      const raggedDirY = perpY * raggedSign + (Math.random() - 0.5) * 0.3;

      const raggedDrops = SplatterGenerator.generateBurst({
        x: p.x + (perpX * raggedSign * baseHalfW * 0.8),
        y: p.y + (perpY * raggedSign * baseHalfW * 0.8),
        originX: p.x,
        originY: p.y,
        dirX: raggedDirX,
        dirY: raggedDirY,
        intensity: intensity * 1.1,
        speed: speed * 0.9,
        color: firstPassColor,
        spreadAngle: 0.85,
        count: Math.ceil(count * 0.85),
        solid: true,
        maxDropletSize: this.maxDropletSize,
      });

      let pristineDrops = [];
      if (Math.random() < 0.2) {
        pristineDrops = SplatterGenerator.generateBurst({
          x: p.x - (perpX * raggedSign * baseHalfW * 0.5),
          y: p.y - (perpY * raggedSign * baseHalfW * 0.5),
          originX: p.x,
          originY: p.y,
          dirX: -raggedDirX,
          dirY: -raggedDirY,
          intensity: intensity * 0.5,
          speed: speed * 0.5,
          color: firstPassColor,
          spreadAngle: 0.5,
          count: 1 + Math.floor(Math.random() * 2),
          solid: true,
          maxDropletSize: this.maxDropletSize * 0.6,
        });
      }

      SplatterGenerator.renderDroplets(ctx, raggedDrops.concat(pristineDrops), true);
    }

    ctx.restore();
    this.lastPoint = p;
  }

  up(point, ctx, fluidEngine = null) {
    const last = super.up(point);
    if (!last || !ctx) return;

    const ob = this.overprintBlender;
    const strokeId = ob ? ob.getActiveStrokeId(this.agentId || 'default') : 1;
    const firstPassColor = ob ? ob.getFirstPassColor(this.color) : this.color;

    ctx.save();
    if (ob) {
      ob.applyCompositeStyle(ctx, this.color, this.opacity);
    } else {
      ctx.fillStyle = this.color;
      ctx.strokeStyle = this.color;
      ctx.globalAlpha = this.opacity;
    }

    let swellMod = 1.0;
    if (ob && ob.isOverprintEnabled()) {
      const ov = ob.queryAndStamp(last.x, last.y, Math.max(1.2, this.effectiveRadius), strokeId, this.strokeDistance, this.color, true);
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

    if (this.penMode === 'point') {
      ctx.beginPath();
      ctx.arc(last.x, last.y, Math.max(0.7, this.effectiveRadius * swellMod), 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Decelerated stop: engorged pill-like terminal stamp at blade angle
      const rMajor = Math.max(2.2, this.effectiveRadius * 1.15 * swellMod);
      const rMinor = Math.max(0.65, Math.min(2.2, 0.75 + this.effectiveRadius * 0.08) * swellMod);
      this._drawPillEllipse(ctx, last.x, last.y, this.bladeAngle, rMajor, rMinor);
    }

    ctx.restore();
    this.lastPoint = null;
  }

  getTelemetry() {
    return {
      instrument: this.name,
      preset: FLAT_RULING_PRESETS[this.activePresetId]?.name || this.activePresetId,
      penMode: this.penMode,
      speed: Math.round(this.speed),
      effectiveRadius: Math.round(this.effectiveRadius * 10) / 10,
      nominalWidth: this.penMode === 'point' ? '1.2 px (Hairline)' : `${Math.round(this.effectiveRadius * 2)} px`,
      edgeAsymmetry: `${Math.round(this.edgeAsymmetry * 100)}% (${this.asymmetrySide})`,
      bladeTension: Math.round(this.bladeTension * 100),
      trackMode: this.trackMode,
      isStarving: this.speed > 220,
      isDown: this.isDown,
    };
  }
}
