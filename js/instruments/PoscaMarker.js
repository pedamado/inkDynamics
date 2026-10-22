// ═══════════════════════════════════════════════════════════════════════════
// INK DYNAMICS — PoscaMarker.js
// Acrylic and alcohol-based marker simulation with medium-hard Round
// and Chisel / Square nib profiles, directional ribbon geometry,
// multi-pass transparency glazing, and high-speed dry streaks.
// ═══════════════════════════════════════════════════════════════════════════

import { Instrument } from './Instrument.js';

export class PoscaMarker extends Instrument {
  constructor(options = {}) {
    super('Posca Marker', {
      type: 'marker',
      baseRadius: options.baseRadius || 14,
      viscosity: options.viscosity ?? 0.65, // Acrylic is moderately viscous
      flowRate: options.flowRate ?? 1.1,
      slowEngorge: options.slowEngorge ?? 1.15, // Medium-hard nib swells subtly
      fastThinning: options.fastThinning ?? 0.75, // Stiff nib maintains width
      dripThreshold: options.dripThreshold ?? 1.8, // Markers rarely drip unless held long
      dryBrushThreshold: options.dryBrushThreshold ?? 480,
      ...options,
    });

    this.nibShape = options.nibShape || 'round'; // 'round' or 'chisel' (square)
    this.inkFormula = options.inkFormula || 'acrylic'; // 'acrylic' (opaque) or 'alcohol' (glaze)
    this.chiselAngle = options.chiselAngle ?? (Math.PI / 4); // 45 degrees default
    this.chiselRatio = options.chiselRatio ?? 3.5; // Aspect ratio of chisel edge (width / thickness)
  }

  setNibShape(shape) {
    this.nibShape = shape;
  }

  setInkFormula(formula) {
    this.inkFormula = formula;
  }

  move(point, dt, ctx, fluidEngine) {
    const prev = this.lastPoint;
    const p = super.move(point, dt);
    if (!prev || !p) return;

    const speed = p.speed;
    const dist = p.dist;
    const baseW = this.effectiveRadius * 2;

    ctx.save();

    // Ink formulation transparency
    if (this.inkFormula === 'alcohol') {
      // Alcohol ink deposits semi-transparent layer that multiplies on overlapping
      ctx.globalAlpha = 0.55 * this.opacity;
    } else {
      // Acrylic ink is dense and opaque with high coverage
      ctx.globalAlpha = 0.94 * this.opacity;
    }

    // High speed dry-out check
    const isFast = speed > this.dryBrushThreshold;
    const fastRatio = isFast
      ? Math.min(1.0, (speed - this.dryBrushThreshold) / 350)
      : 0;

    if (this.nibShape === 'chisel') {
      // ══════════════════════════════════════════════════════════════════
      // Chisel / Square Nib: Calligraphic Ribbon Geometry
      // ══════════════════════════════════════════════════════════════════
      const w = baseW;
      const h = baseW / this.chiselRatio;
      const angle = this.chiselAngle;

      // The flat chisel blade oriented at angle
      const nx = Math.cos(angle) * (w / 2);
      const ny = Math.sin(angle) * (w / 2);

      // Four corners of the quad ribbon from prev to current
      const p1 = { x: prev.x - nx, y: prev.y - ny };
      const p2 = { x: prev.x + nx, y: prev.y + ny };
      const p3 = { x: p.x + nx, y: p.y + ny };
      const p4 = { x: p.x - nx, y: p.y - ny };

      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.closePath();
      ctx.fill();

      // Flat rectangular caps at points
      ctx.beginPath();
      ctx.moveTo(p.x - nx, p.y - ny);
      ctx.lineTo(p.x + nx, p.y + ny);
      ctx.lineWidth = h;
      ctx.strokeStyle = this.color;
      ctx.stroke();

      // Fast dry-out streaks along chisel edges
      if (isFast && fastRatio > 0.2) {
        ctx.strokeStyle = '#ffffff';
        ctx.globalCompositeOperation = 'destination-out'; // Cut micro-scratches into wet stroke
        ctx.globalAlpha = fastRatio * 0.65;
        const numStreaks = Math.floor(2 + fastRatio * 4);
        for (let i = 0; i < numStreaks; i++) {
          const t = Math.random();
          const sx0 = p1.x + (p2.x - p1.x) * t;
          const sy0 = p1.y + (p2.y - p1.y) * t;
          const sx1 = p4.x + (p3.x - p4.x) * t;
          const sy1 = p4.y + (p3.y - p4.y) * t;
          ctx.lineWidth = 0.8 + Math.random() * 1.5;
          ctx.beginPath();
          ctx.moveTo(sx0, sy0);
          ctx.lineTo(sx1, sy1);
          ctx.stroke();
        }
      }
    } else {
      // ══════════════════════════════════════════════════════════════════
      // Round Bullet Nib (Posca PC-3M / PC-5M)
      // ══════════════════════════════════════════════════════════════════
      const slowRatio = Math.max(0, 1 - Math.min(1, speed / 280));
      const width = baseW * (1.0 + slowRatio * 0.15 - fastRatio * 0.1);

      ctx.strokeStyle = this.color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();

      // Fast speed creates tooth roughness and slight center starvation
      if (isFast && fastRatio > 0.25) {
        ctx.strokeStyle = '#ffffff';
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = fastRatio * 0.55;
        ctx.lineWidth = width * 0.35;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    }

    ctx.restore();
    this.lastPoint = p;
  }
}
