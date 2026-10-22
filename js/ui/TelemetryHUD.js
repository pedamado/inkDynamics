// ═══════════════════════════════════════════════════════════════════════════
// INK DYNAMICS v3 — TelemetryHUD.js
// Live telemetry for both the Zig Chinese Brush and the Posca Mop Squeezer:
// Velocity, dynamic stroke width, bristle counts or drip pool volume,
// and real-time physical state badges.
// ═══════════════════════════════════════════════════════════════════════════

export class TelemetryHUD {
  constructor(containerElement) {
    this.container = containerElement;
    this._render();
    this.titleEl = this.container.querySelector('#hud-title');
    this.speedEl = this.container.querySelector('#hud-speed');
    this.speedBar = this.container.querySelector('#hud-speed-bar');
    this.presetEl = this.container.querySelector('#hud-preset');
    this.widthEl = this.container.querySelector('#hud-width');
    this.subMetricLabel = this.container.querySelector('#hud-sub-label');
    this.subMetricVal = this.container.querySelector('#hud-sub-val');
    this.stateBadge = this.container.querySelector('#hud-state-badge');
  }

  _render() {
    this.container.innerHTML = `
      <div class="hud-card">
        <div class="hud-header">
          <span id="hud-title" class="hud-title">Physics Telemetry</span>
          <span id="hud-state-badge" class="badge">READY</span>
        </div>
        <div class="hud-metric">
          <span class="label">Preset:</span>
          <span id="hud-preset" class="val">Medium Dynamic</span>
        </div>
        <div class="hud-metric">
          <span class="label">Velocity:</span>
          <span id="hud-speed" class="val">0 px/s</span>
        </div>
        <div class="hud-progress">
          <div id="hud-speed-bar" class="progress-bar" style="width: 0%;"></div>
        </div>
        <div class="hud-metric">
          <span class="label">Stroke Width:</span>
          <span id="hud-width" class="val">20 px</span>
        </div>
        <div class="hud-metric">
          <span id="hud-sub-label" class="label">Contact / Filaments:</span>
          <span id="hud-sub-val" class="val">—</span>
        </div>
      </div>
    `;
  }

  update(data) {
    if (!data) return;

    if (this.titleEl) {
      if (data.instrument.includes('Posca')) {
        this.titleEl.textContent = 'Posca Squeezer HUD';
      } else if (data.instrument.includes('Curved')) {
        this.titleEl.textContent = 'Curved Ruling Pen HUD';
      } else if (data.instrument.includes('Flat')) {
        this.titleEl.textContent = 'Flat Ruling Pen HUD';
      } else {
        this.titleEl.textContent = 'Chinese Brush HUD';
      }
    }

    if (this.presetEl) {
      this.presetEl.textContent = data.preset.replace(/^\d+\.\s*/, '');
    }

    if (this.speedEl) {
      this.speedEl.textContent = `${data.speed} px/s`;
    }

    // Speed bar (0 - 800 px/s)
    if (this.speedBar) {
      const speedPct = Math.min(100, (data.speed / 600) * 100);
      this.speedBar.style.width = `${speedPct}%`;
    }

    if (this.widthEl) {
      this.widthEl.textContent = data.nominalWidth || `${Math.round(data.effectiveRadius * 2)} px`;
    }

    // Secondary metric adaptively displayed
    if (this.subMetricLabel && this.subMetricVal) {
      if (data.activeBristles !== undefined) {
        this.subMetricLabel.textContent = 'Inking Bristles:';
        this.subMetricVal.textContent = data.activeBristles;
      } else if (data.poolingVolume !== undefined) {
        this.subMetricLabel.textContent = 'Drip Pool Volume:';
        this.subMetricVal.textContent = `${data.poolingVolume} vol`;
      } else if (data.edgeAsymmetry !== undefined) {
        this.subMetricLabel.textContent = 'Edge Contrast:';
        this.subMetricVal.textContent = data.edgeAsymmetry;
      } else if (data.bladeTension !== undefined) {
        this.subMetricLabel.textContent = 'Blade Tension:';
        this.subMetricVal.textContent = `${data.bladeTension}%`;
      }
    }

    // Dynamic state badge
    if (this.stateBadge) {
      if (data.isDown) {
        if (data.penMode === 'point') {
          this.stateBadge.textContent = 'HAIRLINE POINT';
          this.stateBadge.className = 'badge badge-active';
        } else if (data.poolingVolume && parseFloat(data.poolingVolume) > 0.32) {
          this.stateBadge.textContent = 'DRIPPING / POOLING';
          this.stateBadge.className = 'badge badge-warning';
        } else if (data.trackMode === 1) {
          this.stateBadge.textContent = '1-TRACK SKIP';
          this.stateBadge.className = 'badge badge-fast';
        } else if (data.isStarving) {
          if (data.activeBristles !== undefined) {
            this.stateBadge.textContent = 'BRISTLE STRIPES';
          } else if (data.poolingVolume !== undefined) {
            this.stateBadge.textContent = 'BORDER STRIPES';
          } else {
            this.stateBadge.textContent = 'TRAIN TRACKS';
          }
          this.stateBadge.className = 'badge badge-warning';
        } else if (data.speed > 350) {
          this.stateBadge.textContent = 'FAST SWEEP';
          this.stateBadge.className = 'badge badge-fast';
        } else if (data.speed < 40) {
          this.stateBadge.textContent = 'SLOW / SWELLING';
          this.stateBadge.className = 'badge badge-wet';
        } else {
          this.stateBadge.textContent = 'SOLID BLACK';
          this.stateBadge.className = 'badge badge-active';
        }
      } else {
        this.stateBadge.textContent = 'READY';
        this.stateBadge.className = 'badge';
      }
    }
  }
}
