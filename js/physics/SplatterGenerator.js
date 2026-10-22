// ═══════════════════════════════════════════════════════════════════════════
// INK DYNAMICS — SplatterGenerator.js
// Physical generation of ballistic ink splatters, directional droplets,
// satellite micro-specks, and high-speed whip bursts.
// ═══════════════════════════════════════════════════════════════════════════

export class SplatterGenerator {
  /**
   * Generates a directional splatter burst from blade snap or high-speed whip.
   * @param {Object} params
   * @returns {Array<Object>} Droplet specs {x, y, r, alpha, elongated, angle, length}
   */
  static generateBurst({
    x,
    y,
    dirX,
    dirY,
    intensity = 1.0,
    speed = 300,
    color,
    spreadAngle = 0.85,
    count = 12,
    solid = false,
    originX = null,
    originY = null,
    maxDropletSize = 3.5,
  }) {
    const droplets = [];
    const baseAngle = Math.atan2(dirY, dirX);
    const numDots = Math.max(2, Math.floor(count * intensity));
    const origX = originX !== null ? originX : x;
    const origY = originY !== null ? originY : y;
    const maxSize = Math.max(1.2, maxDropletSize);

    for (let i = 0; i < numDots; i++) {
      // Angle fanning outward with Gaussian-like clustering around trajectory
      const angleOffset = (Math.random() - 0.5 + (Math.random() - 0.5)) * 0.5 * spreadAngle;
      const angle = baseAngle + angleOffset;

      // Distance thrown is proportional to speed and ejection energy
      const power = Math.pow(Math.random(), 0.65);
      const throwDist = (8 + power * (speed * 0.18 + 40)) * intensity;

      const dropX = x + Math.cos(angle) * throwDist;
      const dropY = y + Math.sin(angle) * throwDist;

      // Calculate provenance angle: vector from burst origin to droplet
      const provenanceAngle = Math.atan2(dropY - origY, dropX - origX);

      // Size distribution: random size capped by maxDropletSize
      // Skewed towards fine pepper droplets with occasional heavier splatters
      const sizeRoll = Math.pow(Math.random(), 1.6);
      const rBase = 0.35 + sizeRoll * (maxSize - 0.35);

      // Droplet shape: elongated ellipse aligned towards origin showing flight provenance
      const rMajor = rBase * (1.3 + Math.random() * 1.5);
      const rMinor = Math.max(0.3, rBase * (0.4 + Math.random() * 0.3));

      droplets.push({
        x: dropX,
        y: dropY,
        r: rMinor,
        alpha: solid ? 1.0 : Math.min(1.0, 0.45 + (1 - throwDist / (speed * 0.25 + 50)) * 0.55),
        color,
        elongated: true,
        angle: provenanceAngle,
        length: rMajor,
      });
    }

    return droplets;
  }

  /**
   * Generates diffuse spray can particle mist for a stroke step.
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} nozzleRadius - Spray cone radius at paper distance
   * @param {number} density - Particle count based on speed / dwell
   * @param {string} color - Ink color
   * @param {number} oversprayFactor - Width of outer overspray mist
   * @returns {Array<Object>}
   */
  static generateSprayMist(x, y, nozzleRadius, density, color, oversprayFactor = 1.6) {
    const particles = [];
    const count = Math.max(1, Math.floor(density));
    const maxRadius = nozzleRadius * oversprayFactor;

    for (let i = 0; i < count; i++) {
      // Gaussian radial distribution: dense in core, feathering off at edges
      const u1 = Math.max(0.0001, Math.random());
      const u2 = Math.random();
      // Box-Muller transform for normal distribution
      const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      const rNorm = Math.abs(z0) * 0.42;
      const r = Math.min(maxRadius, rNorm * nozzleRadius);
      const theta = Math.random() * Math.PI * 2;

      const px = x + Math.cos(theta) * r;
      const py = y + Math.sin(theta) * r;

      // Particle size varies subtly: coarser near edge, finer in core
      const particleRadius = 0.5 + Math.random() * 1.1;
      const distRatio = r / maxRadius;
      const alpha = Math.max(0.08, (1 - Math.pow(distRatio, 1.8)) * 0.85);

      particles.push({
        x: px,
        y: py,
        r: particleRadius,
        alpha,
        color,
      });
    }

    return particles;
  }

  /**
   * Renders droplets onto a 2D canvas context.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array<Object>} droplets
   */
  static renderDroplets(ctx, droplets, forceSolid = false) {
    if (!droplets || !droplets.length) return;

    for (const d of droplets) {
      ctx.save();
      ctx.fillStyle = d.color || '#000000';
      ctx.globalAlpha = forceSolid ? 1.0 : (d.alpha ?? 1.0);

      if (d.elongated && d.length > 0) {
        // Draw directional teardrop/streak
        ctx.translate(d.x, d.y);
        ctx.rotate(d.angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, d.length, d.r, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Draw circular droplet
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }
}
