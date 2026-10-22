// ═══════════════════════════════════════════════════════════════════════════
// INK DYNAMICS — ChineseBrush.js
// Zig Chinese Calligraphy / Sumi-e Brush simulation.
// Very soft, ultra-flexible tapered nib with immense expressive dynamic range:
// razor hairline tip, broad diagonal sweeping ellipse under drag/pressure,
// organic Feibai (Flying White) dry brush striations, and corner ink pooling.
// ═══════════════════════════════════════════════════════════════════════════

import { Instrument } from './Instrument.js';

export class ChineseBrush extends Instrument {
  constructor(options = {}) {
    super('Zig Chinese Brush', {
      type: 'chinese_brush',
      baseRadius: options.baseRadius || 20,
      viscosity: options.viscosity ?? 0.45, // Sumi ink is fluid and deeply rich
      flowRate: options.flowRate ?? 1.3,
      slowEngorge: options.slowEngorge ?? 2.4, // Massive swelling when pressed / paused
      fastThinning: options.fastThinning ?? 0.12, // Can thin down to razor hairline
      dryBrushThreshold: options.dryBrushThreshold ?? 260, // Feibai occurs at swift speeds
      ...options,
    });

    this.slantAngle = options.slantAngle ?? (Math.PI / 3); // Traditional 60-degree brush hold
    this.tipLag = { x: 0, y: 0 };
    this.currentFootprintAngle = this.slantAngle;
  }

  down(point) {
    super.down(point);
    this.tipLag = { x: point.x, y: point.y };
    this.currentFootprintAngle = this.slantAngle;
    this.accumulatedPool = 0.1;
  }

  move(point, dt, ctx, fluidEngine) {
    const prev = this.lastPoint;
    const p = super.move(point, dt);
    if (!prev || !p) return;

    const safeDt = Math.max(0.001, dt);
    const speed = p.speed;
    const dist = p.dist;
    const pressure = p.p;

    const ux = p.dx / Math.max(0.001, dist);
    const uy = p.dy / Math.max(0.001, dist);
    const strokeAngle = Math.atan2(uy, ux);

    // ══════════════════════════════════════════════════════════════════
    // 1. Dynamic Footprint Transition:
    // Hairline tip (fast / light) ⇄ Diagonal Sweeping Ellipse (slow / pressed)
    // ══════════════════════════════════════════════════════════════════
    const slowRatio = Math.max(0, 1 - Math.min(1, speed / 240));
    const fastRatio = Math.min(1.0, Math.max(0, (speed - 120) / 450));

    // Dynamic width ranges from 1.5px (tip) to 45px+ (fully flattened belly)
    const minWidth = 1.5 * this.sizeScale;
    const maxWidth = this.effectiveRadius * 2.3;
    const pressFactor = Math.pow(pressure, 0.85);

    // Major axis expansion
    const effectiveWidth = Math.max(
      minWidth,
      maxWidth * (0.15 + 0.85 * slowRatio) * (0.4 + 0.6 * pressFactor) * (1 - fastRatio * 0.7)
    );

    // Orientation of the collapsed hair bundle:
    // Blends between the artist's brush slant and the trailing drag direction
    const dragAngle = strokeAngle + Math.PI / 2;
    const targetAngle = this.slantAngle * 0.4 + dragAngle * 0.6;
    // Smooth angular interpolation
    this.currentFootprintAngle += (targetAngle - this.currentFootprintAngle) * 0.35;

    // ══════════════════════════════════════════════════════════════════
    // 2. Flying White (飞白 Feibai) Dry Brush Simulation:
    // Fast strokes starve capillary ink in the belly, leaving paper showing through
    // ══════════════════════════════════════════════════════════════════
    const isFeibai = speed > this.dryBrushThreshold;
    const feibaiRatio = isFeibai
      ? Math.min(1.0, (speed - this.dryBrushThreshold) / 380)
      : 0;

    ctx.save();

    if (isFeibai && feibaiRatio > 0.25) {
      // FEiBAI MODE: Broken, split striations with paper fiber texture
      const numFibers = Math.floor(10 + effectiveWidth * 0.8);
      const halfW = effectiveWidth / 2;

      for (let i = 0; i < numFibers; i++) {
        const t = (i / (numFibers - 1)) * 2 - 1; // -1 to 1 across stroke
        // Belly starvation: center fibers run dry first, outer edge fibers retain ink
        const centerDist = Math.abs(t);
        const centerStarveProb = (1 - centerDist) * feibaiRatio * 0.85;

        if (Math.random() < centerStarveProb) {
          // Skip drawing this fiber (flying white gap!)
          continue;
        }

        // Slight paper tooth jitter
        const toothJitter = (Math.random() - 0.5) * (this.paperRoughness * 4);
        const perpX = -Math.sin(this.currentFootprintAngle);
        const perpY = Math.cos(this.currentFootprintAngle);

        const x0 = prev.x + perpX * (t * halfW + toothJitter);
        const y0 = prev.y + perpY * (t * halfW + toothJitter);
        const x1 = p.x + perpX * (t * halfW + toothJitter);
        const y1 = p.y + perpY * (t * halfW + toothJitter);

        ctx.strokeStyle = this.color;
        ctx.lineWidth = Math.max(0.8, (effectiveWidth / numFibers) * (1.1 + Math.random() * 0.8));
        ctx.globalAlpha = Math.min(1.0, 0.45 + centerDist * 0.55);

        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    } else {
      // WET CALLIGRAPHIC MODE: Rich, velvety sumi stroke with diagonal ellipse footprint
      ctx.fillStyle = this.color;
      ctx.strokeStyle = this.color;
      ctx.globalAlpha = this.opacity;

      // Draw sweeping quad ribbon connecting the two footprints
      const cosA = Math.cos(this.currentFootprintAngle) * (effectiveWidth / 2);
      const sinA = Math.sin(this.currentFootprintAngle) * (effectiveWidth / 2);

      ctx.beginPath();
      ctx.moveTo(prev.x - cosA, prev.y - sinA);
      ctx.lineTo(prev.x + cosA, prev.y + sinA);
      ctx.lineTo(p.x + cosA, p.y + sinA);
      ctx.lineTo(p.x - cosA, p.y - sinA);
      ctx.closePath();
      ctx.fill();

      // Elliptical footprint stamp at current head
      ctx.beginPath();
      ctx.ellipse(
        p.x,
        p.y,
        effectiveWidth / 2,
        Math.max(1.0, effectiveWidth * 0.38),
        this.currentFootprintAngle,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    ctx.restore();

    // ══════════════════════════════════════════════════════════════════
    // 3. Ink Swell & Drip at Turnarounds / Pauses (Dun 顿)
    // ══════════════════════════════════════════════════════════════════
    if (slowRatio > 0.65 && fluidEngine) {
      this.accumulatedPool += slowRatio * safeDt * this.flowRate * 2.2;
      // When pooled heavily on slow stroke or dwell, spawn long sumi drip
      if (this.accumulatedPool > 1.4 && Math.random() < 0.18) {
        fluidEngine.spawnDrip(
          p.x + (Math.random() - 0.5) * (effectiveWidth * 0.4),
          p.y + effectiveWidth * 0.45,
          this.accumulatedPool * 0.9,
          effectiveWidth * 0.28,
          this.viscosity,
          this.color,
          this.paperRoughness
        );
        this.accumulatedPool = 0;
      }
    } else {
      this.accumulatedPool = Math.max(0, this.accumulatedPool - safeDt * 0.9);
    }

    this.lastPoint = p;
  }
}
