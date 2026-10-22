// ═══════════════════════════════════════════════════════════════════════════
// INK DYNAMICS — InkSqueezer.js
// Posca round soft nib squeezer / mop marker simulation.
// High ink flow rate, slight elastic width variation, fast-speed longitudinal
// starvation striping, heavy ink engorgement, and dramatic gravity dripping runs.
// ═══════════════════════════════════════════════════════════════════════════

import { Instrument } from './Instrument.js';

export class InkSqueezer extends Instrument {
  constructor(options = {}) {
    super('Ink Squeezer (Posca Mop)', {
      type: 'squeezer',
      baseRadius: options.baseRadius || 22,
      viscosity: options.viscosity ?? 0.35, // Very fluid, highly runny
      flowRate: options.flowRate ?? 1.6, // Excessive flow
      slowEngorge: options.slowEngorge ?? 1.35, // Modest width variation (non-flexible nib)
      fastThinning: options.fastThinning ?? 0.85, // Squeezer stays relatively wide
      dripThreshold: options.dripThreshold ?? 0.45, // High drip propensity
      dryBrushThreshold: options.dryBrushThreshold ?? 320, // Low threshold for fast striping
      ...options,
    });

    this.accumulatedPool = 0;
    this.stripeOffsets = [-0.65, -0.35, 0, 0.35, 0.65]; // Longitudinal nib pores
  }

  down(point) {
    super.down(point);
    this.accumulatedPool = 0.2;
  }

  move(point, dt, ctx, fluidEngine) {
    const prev = this.lastPoint;
    const p = super.move(point, dt);
    if (!prev || !p) return;

    const safeDt = Math.max(0.001, dt);
    const speed = p.speed;
    const dist = p.dist;

    // Squeezer width: only slightly varies (soft non-flexible dome)
    const baseW = this.effectiveRadius * 2;
    const slowFactor = Math.max(0, 1 - Math.min(1, speed / 300));
    const width = baseW * (0.9 + slowFactor * 0.25);

    const ux = p.dx / Math.max(0.001, dist);
    const uy = p.dy / Math.max(0.001, dist);
    const perpX = -uy;
    const perpY = ux;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Fast movement dynamics: Capillary flow fails -> Striped line strokes!
    // As observed in Posca squeezer tests: fast motion leaves longitudinal track streaks
    const isFast = speed > this.dryBrushThreshold;
    const fastRatio = Math.min(1.0, Math.max(0, (speed - this.dryBrushThreshold) / 350));

    if (isFast && fastRatio > 0.15) {
      // 1. Draw partially starved base with lower opacity
      ctx.strokeStyle = this.color;
      ctx.lineWidth = width * (1 - fastRatio * 0.25);
      ctx.globalAlpha = Math.max(0.25, 0.95 - fastRatio * 0.55);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();

      // 2. Render prominent parallel longitudinal stripes where felt pores still deliver ink
      const numStripes = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < numStripes; i++) {
        // Individual pore offset along nib diameter
        const poreOffset = ((i / (numStripes - 1)) - 0.5) * (width * 0.82);
        // Stochastic skipping of individual stripe tracks
        if (Math.random() < fastRatio * 0.45) continue;

        const p0x = prev.x + perpX * poreOffset;
        const p0y = prev.y + perpY * poreOffset;
        const p1x = p.x + perpX * poreOffset;
        const p1y = p.y + perpY * poreOffset;

        ctx.strokeStyle = this.color;
        ctx.lineWidth = Math.max(1.2, (width / numStripes) * (0.8 + Math.random() * 0.5));
        ctx.globalAlpha = 0.75 + Math.random() * 0.25;
        ctx.beginPath();
        ctx.moveTo(p0x, p0y);
        ctx.lineTo(p1x, p1y);
        ctx.stroke();
      }
    } else {
      // Normal / Slow speed: rich, opaque, solid wet line
      ctx.strokeStyle = this.color;
      ctx.lineWidth = width;
      ctx.globalAlpha = this.opacity;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();

      // If very slow, draw heavy round ink bead at head
      if (slowFactor > 0.6) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, width * 0.52, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // 3. Ink Swell & Heavy Drip Generation:
    // When speed slows down or direction turns, ink swells; with enough ink, dripping occurs!
    const poolRate = fluidEngine
      ? fluidEngine.calculatePooling(speed, this.flowRate * 1.5, this.viscosity, safeDt)
      : 0;
    this.accumulatedPool += poolRate * safeDt;

    // Squeezers drip generously when hovering or dragging slowly
    if (this.accumulatedPool > this.dripThreshold && fluidEngine) {
      if (Math.random() < 0.35) {
        // Spawn 1 or 2 long drips from bottom rim of the swollen pool
        const numDrips = Math.random() < 0.4 ? 2 : 1;
        for (let k = 0; k < numDrips; k++) {
          const dripX = p.x + (Math.random() - 0.5) * (width * 0.5);
          const dripY = p.y + width * 0.45;
          fluidEngine.spawnDrip(
            dripX,
            dripY,
            this.accumulatedPool * (0.8 + Math.random() * 0.6),
            width * 0.32,
            this.viscosity,
            this.color,
            this.paperRoughness
          );
        }
        this.accumulatedPool *= 0.2; // Discharge pool
      }
    }

    this.lastPoint = p;
  }
}
