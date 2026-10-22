// ═══════════════════════════════════════════════════════════════════════════
// INK DYNAMICS — BristleBrush.js
// Multi-bristle physical simulation for Flat and Round brushes.
// Models 28-36 individual flexible hairs with viscoelastic drag,
// bristle splay under pressure/slow speed, capillary cohesion,
// and high-speed dry brush splitting (striations & paper skipping).
// ═══════════════════════════════════════════════════════════════════════════

import { Instrument } from './Instrument.js';

export class BristleBrush extends Instrument {
  constructor(options = {}) {
    super('Bristle Brush', {
      type: 'bristle',
      baseRadius: options.baseRadius || 18,
      viscosity: options.viscosity ?? 0.6,
      flowRate: options.flowRate ?? 1.2,
      slowEngorge: options.slowEngorge ?? 1.8, // Heavy splay and pooling when slow
      fastThinning: options.fastThinning ?? 0.45,
      dryBrushThreshold: options.dryBrushThreshold ?? 280, // Bristles split readily at speed
      ...options,
    });

    this.brushShape = options.brushShape || 'flat'; // 'flat' or 'round'
    this.numBristles = options.numBristles || 32;
    this.bristles = [];
    this._initBristles();
  }

  _initBristles() {
    this.bristles = [];
    for (let i = 0; i < this.numBristles; i++) {
      let ox, oy;
      if (this.brushShape === 'flat') {
        // Flat brush: bristles arranged along a line with slight thickness
        const t = (i / (this.numBristles - 1)) * 2 - 1; // -1 to 1
        ox = t;
        oy = (Math.random() - 0.5) * 0.25;
      } else {
        // Round brush: bristles clustered in concentric rings
        const r = Math.sqrt(Math.random());
        const theta = Math.random() * Math.PI * 2;
        ox = Math.cos(theta) * r;
        oy = Math.sin(theta) * r;
      }

      this.bristles.push({
        relX: ox,
        relY: oy,
        currentX: 0,
        currentY: 0,
        lastX: 0,
        lastY: 0,
        stiffness: 0.6 + Math.random() * 0.5,
        width: 1.0 + Math.random() * 1.4,
        inkReserve: 1.0,
      });
    }
  }

  setBrushShape(shape) {
    if (this.brushShape !== shape) {
      this.brushShape = shape;
      this._initBristles();
    }
  }

  down(point) {
    super.down(point);
    const radius = this.effectiveRadius;
    for (const b of this.bristles) {
      b.currentX = point.x + b.relX * radius;
      b.currentY = point.y + b.relY * radius;
      b.lastX = b.currentX;
      b.lastY = b.currentY;
      b.inkReserve = 1.0;
    }
  }

  move(point, dt, ctx, fluidEngine) {
    const prev = this.lastPoint;
    const p = super.move(point, dt);
    if (!prev || !p) return;

    const safeDt = Math.max(0.001, dt);
    const speed = p.speed;
    const dist = p.dist;
    const radius = this.effectiveRadius;

    const ux = p.dx / Math.max(0.001, dist);
    const uy = p.dy / Math.max(0.001, dist);
    const perpX = -uy;
    const perpY = ux;

    // Splay factor: pressure & slow movement splay bristles outward
    const slowFactor = Math.max(0, 1 - Math.min(1, speed / 300));
    const splay = 1.0 + slowFactor * 0.75;

    // High speed dry-brush threshold
    const isDryBrush = speed > this.dryBrushThreshold;
    const dryRatio = isDryBrush
      ? Math.min(1.0, (speed - this.dryBrushThreshold) / 400)
      : 0;

    // Capillary cohesion: when wet and slow, ink bridges adjacent bristles into a solid core
    const capillaryBridge = Math.max(0.1, 1.0 - dryRatio * 1.1);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Draw solid capillary fluid core if wet enough
    if (capillaryBridge > 0.35) {
      const coreWidth = radius * 1.8 * splay * capillaryBridge;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = coreWidth;
      ctx.globalAlpha = Math.min(1.0, this.opacity * capillaryBridge * 0.9);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    // 2. Simulate & draw individual bristle trajectories
    // Hairs experience viscoelastic trailing drag behind the brush handle
    const lagFactor = 0.08 * (1.2 - this.viscosity * 0.5);

    for (let i = 0; i < this.bristles.length; i++) {
      const b = this.bristles[i];

      // Calculate target anchor position for this bristle
      let targetX, targetY;
      if (this.brushShape === 'flat') {
        // Flat brush aligns perpendicular to stroke direction
        const span = b.relX * radius * splay;
        targetX = p.x + perpX * span - ux * (b.relY * radius * 0.5);
        targetY = p.y + perpY * span - uy * (b.relY * radius * 0.5);
      } else {
        // Round brush splay
        targetX = p.x + (b.relX * perpX + b.relY * ux) * radius * splay;
        targetY = p.y + (b.relX * perpY + b.relY * uy) * radius * splay;
      }

      // Elastic drag
      b.currentX += (targetX - b.currentX) * (1 - Math.exp(-safeDt / (0.015 + lagFactor)));
      b.currentY += (targetY - b.currentY) * (1 - Math.exp(-safeDt / (0.015 + lagFactor)));

      // Fast dry brush: individual bristles skip contact or run out of capillary ink
      const skips = isDryBrush && Math.random() < dryRatio * 0.55;
      if (!skips) {
        ctx.strokeStyle = this.color;
        ctx.lineWidth = b.width * (1.0 + (1 - dryRatio) * 0.8);
        ctx.globalAlpha = Math.min(1.0, 0.45 + (1 - dryRatio) * 0.55);

        ctx.beginPath();
        ctx.moveTo(b.lastX, b.lastY);
        ctx.lineTo(b.currentX, b.currentY);
        ctx.stroke();
      }

      b.lastX = b.currentX;
      b.lastY = b.currentY;
    }

    ctx.restore();

    // 3. Slow speed ink pooling
    if (slowFactor > 0.7 && fluidEngine) {
      this.accumulatedPool += slowFactor * safeDt * this.flowRate * 1.5;
      if (this.accumulatedPool > 1.2 && Math.random() < 0.15) {
        fluidEngine.spawnDrip(
          p.x + (Math.random() - 0.5) * radius,
          p.y + radius * 0.6,
          this.accumulatedPool * 0.8,
          radius * 0.28,
          this.viscosity,
          this.color,
          this.paperRoughness
        );
        this.accumulatedPool = 0;
      }
    } else {
      this.accumulatedPool = Math.max(0, this.accumulatedPool - safeDt * 0.8);
    }

    this.lastPoint = p;
  }
}
