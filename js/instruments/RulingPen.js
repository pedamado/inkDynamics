// ═══════════════════════════════════════════════════════════════════════════
// INK DYNAMICS — RulingPen.js
// Traditional Artistic Ruling Pen & Artisanal Folded Pen (Cola Pen).
// Features dual contact modes (hairline point vs wide curved blade),
// mechanical stick-slip friction, rhythmic micro-wave edge ripple,
// high-speed micro-dashed skips, and explosive blade-snap ink bursts.
// ═══════════════════════════════════════════════════════════════════════════

import { Instrument } from './Instrument.js';
import { StickSlipFriction } from '../physics/StickSlipFriction.js';
import { SplatterGenerator } from '../physics/SplatterGenerator.js';

export class RulingPen extends Instrument {
  constructor(options = {}) {
    super('Folded / Ruling Pen', {
      type: 'ruling_pen',
      baseRadius: options.baseRadius || 16,
      viscosity: options.viscosity ?? 0.55,
      flowRate: options.flowRate ?? 1.15,
      slowEngorge: options.slowEngorge ?? 1.35,
      fastThinning: options.fastThinning ?? 0.35,
      ...options,
    });

    // Sub-mode: 'point' (hairline G-nib), 'cola_curved' (hand-folded curved blade), 'flat' (broad ruling pen)
    this.penMode = options.penMode || 'cola_curved';
    this.bladeAngle = options.bladeAngle ?? (Math.PI / 4); // 45 degree blade orientation
    this.friction = new StickSlipFriction({
      stiffness: options.bladeStiffness ?? 0.65, // Flexible metal sheet (cola can aluminum)
      paperTooth: options.paperTooth ?? 0.5,
      bladeMass: 0.04,
    });

    this.chatterIntensity = options.chatterIntensity ?? 1.2;
  }

  setPenMode(mode) {
    this.penMode = mode;
  }

  setBladeAngle(angle) {
    this.bladeAngle = angle;
  }

  setBladeStiffness(stiffness) {
    this.friction.stiffness = stiffness;
  }

  down(point) {
    super.down(point);
    this.friction.reset();
  }

  move(point, dt, ctx, fluidEngine) {
    const prev = this.lastPoint;
    const p = super.move(point, dt);
    if (!prev || !p) return;

    const safeDt = Math.max(0.001, dt);
    const speed = p.speed;
    const dist = p.dist;

    // ══════════════════════════════════════════════════════════════════
    // 1. Friction & Stick-Slip Calculation
    // ══════════════════════════════════════════════════════════════════
    const fResult = this.friction.update(prev, p, speed, safeDt, {
      paperTooth: this.paperRoughness,
      chatterIntensity: this.chatterIntensity,
    });

    // Check for high-speed micro-dashed skipping (blade bounces over paper tooth)
    if (fResult.skip && speed > 380) {
      // Blade is momentarily airborne: skip ink deposition
      this.lastPoint = p;
      return;
    }

    // ══════════════════════════════════════════════════════════════════
    // 2. Geometry Calculation: Point Mode vs. Sideways Blade Mode
    // ══════════════════════════════════════════════════════════════════
    let strokeWidth = 1.0;
    const maxBladeWidth = this.effectiveRadius * 2.2;

    if (this.penMode === 'point') {
      // POINT MODE: Constant ultra-thin precision hairline (like G-nib / draughtsman pen)
      strokeWidth = 1.2 * this.sizeScale;
    } else if (this.penMode === 'flat') {
      // FLAT RULING PEN: Broad band when perpendicular to blade, hairline parallel
      const ux = p.dx / Math.max(0.001, dist);
      const uy = p.dy / Math.max(0.001, dist);
      const strokeTheta = Math.atan2(uy, ux);
      const angleDiff = Math.abs(Math.sin(strokeTheta - this.bladeAngle));
      strokeWidth = Math.max(1.2 * this.sizeScale, maxBladeWidth * angleDiff);
    } else {
      // ARTISANAL FOLDED PEN / COLA PEN:
      // Curved eccentric blade contour produces continuous thickness modulation
      const ux = p.dx / Math.max(0.001, dist);
      const uy = p.dy / Math.max(0.001, dist);
      const strokeTheta = Math.atan2(uy, ux);
      const angleFactor = Math.abs(Math.cos(strokeTheta - this.bladeAngle));

      // Speed effects: slow engorges, fast thins and pulls striations
      const slowRatio = Math.max(0, 1 - Math.min(1, speed / 260));
      const fastRatio = Math.min(1.0, Math.max(0, (speed - 160) / 450));

      const curvatureWidth = maxBladeWidth * (0.35 + 0.65 * angleFactor);
      strokeWidth = Math.max(
        1.5 * this.sizeScale,
        curvatureWidth * (0.8 + slowRatio * 0.45) * (1.0 - fastRatio * 0.5)
      );
    }

    // ══════════════════════════════════════════════════════════════════
    // 3. Render Stroke with Rhythmic Edge Wave Texture (Chatter)
    // ══════════════════════════════════════════════════════════════════
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.color;
    ctx.globalAlpha = this.opacity;

    if (this.penMode === 'point') {
      // Precision point line
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else {
      // Blade mode: draw contour with stick-slip wave ripple along edges
      const ux = p.dx / Math.max(0.001, dist);
      const uy = p.dy / Math.max(0.001, dist);
      const perpX = -uy;
      const perpY = ux;

      const halfW = strokeWidth / 2;
      const wave = fResult.waveOffset; // Micro-wave chatter offset

      // Boundary points perturbed by blade vibration
      const left0 = { x: prev.x - perpX * (halfW + wave), y: prev.y - perpY * (halfW + wave) };
      const right0 = { x: prev.x + perpX * (halfW - wave), y: prev.y + perpY * (halfW - wave) };
      const right1 = { x: p.x + perpX * (halfW - wave), y: p.y + perpY * (halfW - wave) };
      const left1 = { x: p.x - perpX * (halfW + wave), y: p.y - perpY * (halfW + wave) };

      ctx.beginPath();
      ctx.moveTo(left0.x, left0.y);
      ctx.lineTo(right0.x, right0.y);
      ctx.lineTo(right1.x, right1.y);
      ctx.lineTo(left1.x, left1.y);
      ctx.closePath();
      ctx.fill();

      // High speed: continuous stripping / interior track lines
      if (speed > 280 && strokeWidth > 8) {
        ctx.strokeStyle = '#ffffff';
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = Math.min(0.65, (speed - 280) / 400);
        ctx.lineWidth = 1.0 + Math.random() * 1.5;
        const innerOffset = (Math.random() - 0.5) * (strokeWidth * 0.45);
        ctx.beginPath();
        ctx.moveTo(prev.x + perpX * innerOffset, prev.y + perpY * innerOffset);
        ctx.lineTo(p.x + perpX * innerOffset, p.y + perpY * innerOffset);
        ctx.stroke();
      }
    }

    ctx.restore();

    // ══════════════════════════════════════════════════════════════════
    // 4. Blade Snap Spatter Release:
    // When blades release built-up tension, they snap violently, releasing bursts/splats!
    // ══════════════════════════════════════════════════════════════════
    if (fResult.snapSplat) {
      const snap = fResult.snapSplat;
      const droplets = SplatterGenerator.generateBurst({
        x: snap.x,
        y: snap.y,
        dirX: snap.directionX,
        dirY: snap.directionY,
        intensity: snap.intensity,
        speed: snap.speed,
        color: this.color,
        count: snap.burstCount,
      });
      SplatterGenerator.renderDroplets(ctx, droplets);
    }

    this.lastPoint = p;
  }
}
