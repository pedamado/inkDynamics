// ═══════════════════════════════════════════════════════════════════════════
// INK DYNAMICS — StickSlipFriction.js
// Physical model of mechanical stick-slip friction, blade spring deflection,
// rhythmic edge chatter (wave pattern), micro-dashed skips, and blade snap splats.
// ═══════════════════════════════════════════════════════════════════════════

export class StickSlipFriction {
  constructor(options = {}) {
    this.stiffness = options.stiffness ?? 0.7; // 0.1 (flexible cola pen) to 1.0 (rigid ruling pen)
    this.paperTooth = options.paperTooth ?? 0.5; // 0 (smooth vellum) to 1.0 (rough cold-press)
    this.bladeMass = options.bladeMass ?? 0.05;

    // Simulation state
    this.state = 'SLIP'; // 'STICK' or 'SLIP'
    this.bladeOffset = { x: 0, y: 0 }; // Blade tip deflection relative to pen handle
    this.bladeVelocity = { x: 0, y: 0 };
    this.phase = 0; // Wave phase for continuous edge texture
    this.timeInStick = 0;
    this.skipTimer = 0; // Duration of airborne / skipped contact
    this.tension = 0; // Accumulated elastic energy (0 - 1)
  }

  /**
   * Resets friction state at start of new stroke.
   */
  reset() {
    this.state = 'SLIP';
    this.bladeOffset = { x: 0, y: 0 };
    this.bladeVelocity = { x: 0, y: 0 };
    this.phase = Math.random() * Math.PI * 2;
    this.timeInStick = 0;
    this.skipTimer = 0;
    this.tension = 0;
  }

  /**
   * Updates stick-slip dynamics for a time step.
   * @param {Object} p0 - Previous point {x, y}
   * @param {Object} p1 - Current point {x, y}
   * @param {number} speed - Velocity magnitude (px/s)
   * @param {number} dt - Time delta (seconds)
   * @param {Object} config - Tool-specific friction overrides
   * @returns {Object} Friction result: { effectivePoint, skip, waveOffset, snapSplat }
   */
  update(p0, p1, speed, dt, config = {}) {
    const stiffness = config.stiffness ?? this.stiffness;
    const paperTooth = config.paperTooth ?? this.paperTooth;
    const chatterIntensity = config.chatterIntensity ?? 1.0;

    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.001 || dt <= 0) {
      return {
        effectivePoint: { x: p1.x, y: p1.y },
        skip: false,
        waveOffset: 0,
        tension: 0,
        snapSplat: null,
      };
    }

    const ux = dx / dist;
    const uy = dy / dist;
    const perpX = -uy;
    const perpY = ux;

    // 1. Stick-Slip State Transition
    // Higher paper tooth & lower stiffness = more prone to sticking
    // Higher speed increases inertial slip force
    const staticFrictionForce = (350 + paperTooth * 600) * (1.1 - stiffness * 0.4);
    const kSpring = 1200 * stiffness + 400; // Blade spring constant

    let snapSplat = null;
    let isSkipping = false;

    if (this.state === 'STICK') {
      // Blade tip is physically stuck on paper grain; pen handle moves forward
      this.bladeOffset.x -= dx;
      this.bladeOffset.y -= dy;
      this.timeInStick += dt;

      const deflection = Math.hypot(this.bladeOffset.x, this.bladeOffset.y);
      const springForce = kSpring * deflection;
      this.tension = Math.min(1.0, deflection / 12);

      // Breakaway condition: spring force overcomes static friction
      if (springForce > staticFrictionForce || deflection > 14) {
        this.state = 'SLIP';
        // Violent acceleration forward: blade releases elastic energy
        const snapSpeed = (springForce / Math.max(0.01, this.bladeMass)) * 0.012;
        this.bladeVelocity.x = -ux * snapSpeed;
        this.bladeVelocity.y = -uy * snapSpeed;

        // Blade Snap Spatter check:
        // When blades release built-up tension, they snap violently and fling ink droplets!
        if (this.tension > 0.45 && speed > 180 * (1 - paperTooth * 0.3)) {
          snapSplat = {
            x: p1.x,
            y: p1.y,
            intensity: this.tension * (0.8 + Math.random() * 0.6),
            directionX: ux + (Math.random() - 0.5) * 0.5,
            directionY: uy + (Math.random() - 0.5) * 0.5,
            speed: speed + snapSpeed * 0.5,
            burstCount: Math.floor(3 + this.tension * 8),
          };
        }

        // High-speed slip can cause the blade to jump completely airborne (micro-dashed skip)
        if (speed > 450 && paperTooth > 0.35 && Math.random() < 0.28) {
          this.skipTimer = (0.008 + Math.random() * 0.018) * (paperTooth + 0.3);
        }
      }
    } else {
      // SLIP phase: blade snaps back with high-frequency damped harmonic motion
      const damping = 28 * Math.sqrt(stiffness);
      const ax = -kSpring * this.bladeOffset.x - damping * this.bladeVelocity.x;
      const ay = -kSpring * this.bladeOffset.y - damping * this.bladeVelocity.y;

      this.bladeVelocity.x += ax * dt;
      this.bladeVelocity.y += ay * dt;
      this.bladeOffset.x += this.bladeVelocity.x * dt;
      this.bladeOffset.y += this.bladeVelocity.y * dt;

      this.tension = Math.max(0, this.tension - dt * 6);

      // Re-sticking condition: when relative velocity drops or paper tooth catches blade
      const relSpeed = Math.hypot(this.bladeVelocity.x, this.bladeVelocity.y);
      if (relSpeed < 60 && Math.random() < paperTooth * 0.65) {
        this.state = 'STICK';
        this.timeInStick = 0;
      }
    }

    // 2. Micro-dashed skip handler
    if (this.skipTimer > 0) {
      this.skipTimer -= dt;
      isSkipping = true;
    }

    // 3. Rhythmic Edge Texture (Micro-wave pattern along stroke boundary)
    // The natural resonance frequency of the blade creates a rhythmic ripple
    const baseFreq = 0.35 * (1 + stiffness * 0.5);
    this.phase += dist * baseFreq;
    const waveAmp = (1.2 + paperTooth * 2.8) * chatterIntensity * (0.6 + Math.min(1.5, speed / 300));
    // Superposition of fundamental harmonic and sub-harmonic for organic tooth
    const waveOffset = (Math.sin(this.phase) * 0.7 + Math.sin(this.phase * 2.3) * 0.3) * waveAmp;

    // Calculate effective contact point with blade deflection
    const effectivePoint = {
      x: p1.x + this.bladeOffset.x * 0.45,
      y: p1.y + this.bladeOffset.y * 0.45,
    };

    return {
      effectivePoint,
      skip: isSkipping,
      waveOffset,
      perp: { x: perpX, y: perpY },
      tension: this.tension,
      snapSplat,
    };
  }
}
