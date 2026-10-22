// ═══════════════════════════════════════════════════════════════════════════
// INK DYNAMICS — FluidDynamics.js
// Fluid simulation: ink wetness, pooling (engorging), capillary paper bleed,
// and gravity-driven viscous drip runs with tapering droplets.
// ═══════════════════════════════════════════════════════════════════════════

export class FluidDynamics {
  constructor(options = {}) {
    this.gravity = options.gravity || 980; // px/s^2 downwards
    this.activeDrips = [];
    this.pools = [];
    this.dripCounter = 0;
  }

  /**
   * Calculates ink deposition and pooling volume based on velocity and dwell time.
   * @param {number} speed - Current velocity in px/s
   * @param {number} baseFlow - Ink flow rate coefficient (0.1 - 2.0)
   * @param {number} viscosity - Ink viscosity (0.1 = watery/runny, 1.0 = thick acrylic/sumi)
   * @param {number} dt - Time delta in seconds
   * @returns {number} Pooling factor (0.0 = fast/dry, >1.0 = wet swelling)
   */
  calculatePooling(speed, baseFlow, viscosity, dt) {
    // Slower motion allows ink to accumulate rapidly into paper fibers
    const speedRatio = Math.max(0, 1 - Math.min(1, speed / 350));
    // Watery ink pools faster than thick viscous ink
    const fluidity = Math.max(0.2, 1.2 - viscosity * 0.8);
    // Smooth nonlinear accumulation
    const poolRate = Math.pow(speedRatio, 2.2) * baseFlow * fluidity * 2.5;
    return poolRate;
  }

  /**
   * Spawns a gravity drip when pooled ink exceeds retention threshold.
   * @param {number} x - Origin X
   * @param {number} y - Origin Y
   * @param {number} poolVolume - Accumulated wet volume
   * @param {number} strokeWidth - Width of the originating stroke
   * @param {number} viscosity - Ink viscosity (0.1 - 1.0)
   * @param {string} color - Ink color
   * @param {number} paperRoughness - Paper tooth friction (0 - 1)
   * @param {number} absorptionRate - Substrate ink absorption (0.1 = acrylic low soak, 0.9 = sumi high soak)
   * @param {number} dripWidthRatio - Ratio of drip line thickness relative to stroke diameter (0.15 - 0.55)
   * @param {number} strokeId - 4.0: the stroke the drip runs from (so its ink mixes with other strokes, not its own)
   */
  spawnDrip(x, y, poolVolume, strokeWidth, viscosity = 0.55, color = '#050505', paperRoughness = 0.3, absorptionRate = 0.16, dripWidthRatio = 0.32, strokeId = null) {
    // Acrylic ink is more viscous than watery sumi, but has low paper absorption.
    // Lower absorption keeps the liquid pooled on top of the surface, allowing gravity to pull it down fast!
    const surfaceMobility = Math.max(0.3, 1.25 - absorptionRate * 0.85);
    const initialVelocity = (70 + Math.random() * 55) * surfaceMobility;
    const maxMass = poolVolume * (1.3 + Math.random() * 0.5);

    // Drip line width is directly proportional to strokeWidth / dome diameter:
    // Thin nib -> ~2.8px, Medium nib -> ~7.5px, Thick/Jumbo nib -> ~16.5px
    const dripWidth = Math.max(1.8, strokeWidth * dripWidthRatio);
    const maxDistance = (45 + poolVolume * 105 * surfaceMobility) * (1 - paperRoughness * 0.22);

    this.activeDrips.push({
      id: ++this.dripCounter,
      strokeId,
      x,
      y,
      originX: x,
      originY: y,
      currentX: x,
      currentY: y,
      vx: (Math.random() - 0.5) * 2.5,
      vy: initialVelocity,
      width: dripWidth,
      initialWidth: dripWidth,
      mass: maxMass,
      remainingMass: maxMass,
      maxDistance,
      distanceTraveled: 0,
      viscosity,
      absorptionRate,
      surfaceMobility,
      paperRoughness,
      color,
      age: 0,
      finished: false,
      segments: [{ x, y, w: dripWidth }],
    });
  }

  /**
   * Steps all active running drips forward in time.
   * @param {number} dt - Delta time in seconds
   * @param {Function} onDripSegment - Callback to render incremental drip segment
   */
  updateDrips(dt, onDripSegment) {
    if (!this.activeDrips.length) return;

    for (let i = this.activeDrips.length - 1; i >= 0; i--) {
      const d = this.activeDrips[i];
      if (d.finished) {
        this.activeDrips.splice(i, 1);
        continue;
      }

      d.age += dt;

      // Surface drag: low absorption acrylic ink has low drag, sliding fast down paper
      const drag = (0.75 * d.viscosity * d.absorptionRate + 0.45 * d.paperRoughness) * 1.5;
      d.vy += (this.gravity * d.surfaceMobility * 0.40 - d.vy * drag) * dt;

      // Subtle meandering along paper tooth
      const wander = (Math.random() - 0.5) * 5 * d.surfaceMobility;
      d.vx = d.vx * 0.85 + wander * dt;

      const prevX = d.currentX;
      const prevY = d.currentY;

      d.currentX += d.vx * dt;
      d.currentY += d.vy * dt;

      const segLen = Math.hypot(d.currentX - prevX, d.currentY - prevY);
      d.distanceTraveled += segLen;

      // Mass deposition: proportional to distance traveled over total capacity
      const massUsed = (d.mass / Math.max(10, d.maxDistance)) * segLen;
      d.remainingMass = Math.max(0, d.remainingMass - massUsed);

      const progress = Math.min(1, d.distanceTraveled / d.maxDistance);
      // Gentle, subtle tapering (only thins down to ~75-80% at tail, no drastic pinching)
      const taper = Math.max(0.72, 1.0 - progress * 0.22);
      const currentWidth = Math.max(1.2, d.initialWidth * taper);

      d.segments.push({ x: d.currentX, y: d.currentY, w: currentWidth });

      if (onDripSegment) {
        onDripSegment({
          x0: prevX,
          y0: prevY,
          x1: d.currentX,
          y1: d.currentY,
          w0: d.segments[d.segments.length - 2].w,
          w1: currentWidth,
          color: d.color,
          strokeId: d.strokeId,
          dripId: d.id,
          distance: d.distanceTraveled,
        });
      }

      // Termination conditions: run out of momentum, mass, or distance
      if (d.vy < 2.0 || d.remainingMass <= 0 || progress >= 1.0) {
        d.finished = true;
      }
    }
  }

  /**
   * Simulates capillary feathering / paper fiber bleed.
   * Returns an array of tiny micro-bleed filaments extending outwards.
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} radius - Base wet radius
   * @param {number} paperBleed - Paper absorbency (0.0 = hard sized, 1.0 = Xuan / watercolor)
   * @param {number} viscosity - Ink viscosity
   * @returns {Array<{x0: number, y0: number, x1: number, y1: number, w: number, a: number}>}
   */
  calculateBleedFilaments(x, y, radius, paperBleed, viscosity) {
    if (paperBleed <= 0.02 || radius < 2) return [];

    const filaments = [];
    const count = Math.floor(6 + Math.random() * 10 * paperBleed);
    const fluidity = Math.max(0.2, 1 - viscosity * 0.7);
    const maxBleedDist = radius * 0.45 * paperBleed * fluidity;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = (0.3 + Math.random() * 0.7) * maxBleedDist;
      const x0 = x + Math.cos(angle) * (radius * 0.92);
      const y0 = y + Math.sin(angle) * (radius * 0.92);
      const x1 = x0 + Math.cos(angle) * dist;
      const y1 = y0 + Math.sin(angle) * dist;
      filaments.push({
        x0,
        y0,
        x1,
        y1,
        w: 0.6 + Math.random() * 0.8,
        a: 0.15 + Math.random() * 0.25 * paperBleed,
      });
    }

    return filaments;
  }

  clear() {
    this.activeDrips = [];
    this.pools = [];
  }
}
