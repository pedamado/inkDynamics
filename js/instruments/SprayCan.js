// ═══════════════════════════════════════════════════════════════════════════
// INK DYNAMICS — SprayCan.js
// Atomized aerosol spray paint simulation: diffuse circular spray pattern,
// velocity-dependent pigment accumulation, overspray particle mist,
// and gravity drips when spraying heavily in place.
// ═══════════════════════════════════════════════════════════════════════════

import { Instrument } from './Instrument.js';
import { SplatterGenerator } from '../physics/SplatterGenerator.js';

export class SprayCan extends Instrument {
  constructor(options = {}) {
    super('Spray Can', {
      type: 'spray',
      baseRadius: options.baseRadius || 28,
      viscosity: options.viscosity ?? 0.25, // Spray paint is low viscosity aerosol
      flowRate: options.flowRate ?? 1.3,
      slowEngorge: options.slowEngorge ?? 2.2, // Dense heavy puddle on hold
      fastThinning: options.fastThinning ?? 0.2, // Faint mist when swept fast
      dripThreshold: options.dripThreshold ?? 0.7,
      ...options,
    });

    this.oversprayRadius = options.oversprayRadius ?? 1.7; // Halo multiplier
    this.particleRate = options.particleRate ?? 45; // Particles per step
  }

  down(point) {
    super.down(point);
    this.accumulatedWetness = 0;
  }

  move(point, dt, ctx, fluidEngine) {
    const p = super.move(point, dt);
    if (!p) return;

    const safeDt = Math.max(0.001, dt);
    const speed = p.speed;
    const radius = this.effectiveRadius;

    // Fast movement creates sparse faint mist; slow movement creates deep opaque paint
    const speedFactor = Math.max(0.08, 1 - Math.min(1, speed / 550));
    const density = this.particleRate * (0.3 + speedFactor * 1.8) * this.flowRate;

    // 1. Draw core soft spray (radial gradient with organic noise)
    const coreAlpha = Math.min(0.65, (0.08 + speedFactor * 0.45) * this.opacity);

    ctx.save();
    const grad = ctx.createRadialGradient(p.x, p.y, radius * 0.1, p.x, p.y, radius);
    grad.addColorStop(0, this.color);
    grad.addColorStop(0.4, this.color);
    grad.addColorStop(0.75, `${this.color}88`);
    grad.addColorStop(1, `${this.color}00`);

    ctx.globalAlpha = coreAlpha;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Generate and render stochastic atomized spray droplets
    const droplets = SplatterGenerator.generateSprayMist(
      p.x,
      p.y,
      radius,
      density,
      this.color,
      this.oversprayRadius
    );
    SplatterGenerator.renderDroplets(ctx, droplets);

    // 3. Ink accumulation & Drip generation
    // When the user slows down or hovers the spray can, ink engorges and drips down!
    this.accumulatedWetness += speedFactor * safeDt * this.flowRate * 4.0;
    if (this.accumulatedWetness > this.dripThreshold && fluidEngine) {
      if (Math.random() < 0.22) {
        fluidEngine.spawnDrip(
          p.x + (Math.random() - 0.5) * radius * 0.6,
          p.y + radius * 0.4,
          this.accumulatedWetness * 1.2,
          radius * 0.35,
          this.viscosity,
          this.color,
          this.paperRoughness
        );
        this.accumulatedWetness = 0; // Discharge puddle
      }
    }

    this.lastPoint = p;
  }
}
