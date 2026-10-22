// ═══════════════════════════════════════════════════════════════════════════
// INK DYNAMICS v4 — Toolbar.js
// Interactive controls for the 4 instruments (Zig Chinese Brush v2, Posca Mop Squeezer v3, Curved & Flat Ruling Pens)
// and the ink's overprint & mixing (v4.0). Grouped calibration presets + My Presets (user presets kept for good:
// this browser or a server), real-time contextual physics sliders, localStorage persistence of the last state, the
// live integration snippet, and the specimen photo reference modal.
// ═══════════════════════════════════════════════════════════════════════════

import {
  ZIG_PRESETS,
  POSCA_PRESETS,
  CURVED_RULING_PRESETS,
  FLAT_RULING_PRESETS,
} from '../InkDynamicsEngine.js';
import { CORE_PRESETS, isCorePreset, presetToConfig } from '../presets/PresetCatalog.js';
import { UserPresetStore, localStorageAdapter, httpAdapter } from '../presets/UserPresetStore.js';
import { validateInkSettings, formatInkSettings } from '../core/SettingsParser.js';

// the ink swatches: Inkwell 20's Base palette, then the 3.9 inks
const INK_SWATCHES = [
  { hex: '#000000', name: 'Black' },
  { hex: '#FFFFFF', name: 'White' },
  { hex: '#D9D9D9', name: 'Light Grey' },
  { hex: '#808080', name: 'Grey' },
  { hex: '#33B3FF', name: 'Sky Blue' },
  { hex: '#E60000', name: 'Red' },
  { hex: '#FFD600', name: 'Yellow' },
  { hex: '#191817', name: 'Inkwell Carbon Black' },
  { hex: '#b8261a', name: 'Vermilion Red' },
  { hex: '#1d3a6e', name: 'Prussian Blue' },
  { hex: '#4a2c18', name: 'Walnut Sepia' },
];
// papers (Inkwell 20's presets among them)
const PAPER_SWATCHES = [
  { hex: '#FFFFFF', name: 'White' },
  { hex: '#F4F1EA', name: 'Munken Off-White' },
  { hex: '#FAEBD7', name: 'Antique White' },
  { hex: '#D2B48C', name: 'Kraft Tanned' },
  { hex: '#9E9E98', name: 'Grey Chipboard' },
  { hex: '#1A1A1A', name: 'Black' },
];
const pct = (v) => `${Math.round(v * 100)}%`;
// the five settings of the ink's mixing (+ the reach), as sliders
const OVERPRINT_SLIDERS = [
  { id: 'ink-density', key: 'inkDensity', label: 'Ink Density (transparency)', min: 0.65, max: 1, step: 0.01, fmt: pct, lo: 'Translucent (65%)', hi: '100% opaque', help: 'How opaque the ink is: at 97% the paper and the strokes beneath show through 3%.' },
  { id: 'overprint-darken', key: 'overprintDarken', label: 'Blending Intensity', min: 0, max: 1, step: 0.05, fmt: pct, lo: 'None', hi: 'Full overprint', help: 'How far a crossing goes toward the overprint (multiply) mix of the two inks.' },
  { id: 'overprint-attack', key: 'overprintAttack', label: 'Approach Mix Speed', min: 0, max: 1, step: 0.05, fmt: pct, lo: 'Slow', hi: 'Instant', help: 'How quickly the mix comes in when the nib meets ink beneath.' },
  { id: 'overprint-release', key: 'overprintRelease', label: 'Exit Restore Speed', min: 0, max: 1, step: 0.05, fmt: pct, lo: 'Slow (long trail)', hi: 'Instant', help: 'How quickly the stroke gets its own colour back after a crossing (the pigment carried on).' },
  { id: 'overprint-reach', key: 'overprintReach', label: 'Crossing Reach (× nib)', min: 0.2, max: 1.5, step: 0.05, fmt: (v) => `${v.toFixed(2)}×`, lo: 'Core only', hi: 'Beyond the edge', help: 'How much of the nib must be over ink beneath before it mixes.' },
  { id: 'overprint-swell', key: 'overprintSwell', label: 'Crossing Swell (this ink)', min: 0, max: 0.25, step: 0.005, fmt: (v) => `+${(v * 100).toFixed(1).replace(/\.0$/, '')}%`, lo: 'None', hi: '+25%', help: 'How much this ink swells where it crosses ink beneath (ruling pens 5%, Zig 7.5%, Posca 10%).' },
];

export class Toolbar {
  constructor(containerElement, engine) {
    this.container = containerElement;
    this.engine = engine;
    // 4.0: a new key, so the 4.0 ink defaults (density 0.97, mixing) apply; a 3.x state is read without its overprint
    this.storageKey = 'inkdynamics_v4_settings';
    this.legacyStorageKeys = ['inkdynamics_v3_settings', 'inkdynamics_zig_v2_settings'];
    this.snippetMode = 'call';
    // user presets (CRUD): this browser by default
    this.presetStore = new UserPresetStore({ adapter: localStorageAdapter('inkdynamics.userPresets.v1') });
    this.userPresets = [];
    this.selectedUserPreset = null;
    this._render();
    this._bindEvents();
    this._loadFromLocalStorage();
    this._updateSnippet();
    this._refreshUserPresets();
  }

  _render() {
    // Generate grouped presets HTML
    let zigOptions = '';
    for (const [key, preset] of Object.entries(ZIG_PRESETS)) {
      const selected = this.engine.activeInstrumentId === 'chinese_brush' && key === this.engine.activeInstrument.activePresetId ? 'selected' : '';
      zigOptions += `<option value="${key}" ${selected}>${preset.name}</option>`;
    }

    let poscaOptions = '';
    for (const [key, preset] of Object.entries(POSCA_PRESETS)) {
      const selected = this.engine.activeInstrumentId === 'posca_squeezer' && key === this.engine.activeInstrument.activePresetId ? 'selected' : '';
      poscaOptions += `<option value="${key}" ${selected}>${preset.name}</option>`;
    }

    let curvedOptions = '';
    for (const [key, preset] of Object.entries(CURVED_RULING_PRESETS)) {
      const selected = this.engine.activeInstrumentId === 'ruling_pen_curved' && key === this.engine.activeInstrument.activePresetId ? 'selected' : '';
      curvedOptions += `<option value="${key}" ${selected}>${preset.name}</option>`;
    }

    let flatOptions = '';
    for (const [key, preset] of Object.entries(FLAT_RULING_PRESETS)) {
      const selected = this.engine.activeInstrumentId === 'ruling_pen_flat' && key === this.engine.activeInstrument.activePresetId ? 'selected' : '';
      flatOptions += `<option value="${key}" ${selected}>${preset.name}</option>`;
    }

    const curPreset = this.engine.activePreset;
    const instId = this.engine.activeInstrumentId;
    const badgeText = instId === 'posca_squeezer' ? 'POSCA MOP SQUEEZER v3'
      : instId === 'ruling_pen_curved' ? 'CURVED RULING / FOLDED PEN'
      : instId === 'ruling_pen_flat' ? 'FLAT RULING / CHISEL PEN'
      : 'ZIG CHINESE BRUSH v2';

    const cb = this.engine.instruments.chinese_brush;
    const ps = this.engine.instruments.posca_squeezer;
    const rc = this.engine.instruments.ruling_pen_curved;
    const rf = this.engine.instruments.ruling_pen_flat;

    this.container.innerHTML = `
      <div class="toolbar-panel">
        <!-- Brand / Header -->
        <div class="toolbar-brand">
          <div class="brand-row">
            <div id="brand-badge" class="brand-badge">${badgeText}</div>
            <button id="btn-about-badge" class="brand-info-link" title="About S.iX Research Project & InkDynamics">S.iX</button>
          </div>
          <span class="brand-sub">Physical Ink Dynamics v4.0 · S.iX Project</span>
        </div>

        <!-- Section: Calibration Presets -->
        <div class="tool-section">
          <label class="section-label">Tool & Calibration Mode</label>
          <select id="preset-select" class="select-input">
            <optgroup label="🖌️ Zig Chinese Brush (v2)">
              ${zigOptions}
            </optgroup>
            <optgroup label="🟡 Posca Mop Squeezer (v3)">
              ${poscaOptions}
            </optgroup>
            <optgroup label="📐 Curved Ruling / Folded Pen">
              ${curvedOptions}
            </optgroup>
            <optgroup label="📏 Flat Ruling / Chisel Pen">
              ${flatOptions}
            </optgroup>
            <optgroup label="★ My Presets" id="preset-user-group"></optgroup>
          </select>
          <p id="preset-desc" class="preset-description">${curPreset.description}</p>
        </div>

        <!-- Section: Universal Nib Radius & Substrate -->
        <div class="tool-section">
          <div class="section-header-inline">
            <label class="section-label">Nib Radius</label>
            <span id="radius-val" class="param-val">${this.engine.activeInstrument.baseRadius.toFixed(1)} px</span>
          </div>
          <input type="range" id="radius-slider" min="2.0" max="32.0" step="0.5" value="${this.engine.activeInstrument.baseRadius}" class="range-slider" />
          <div class="range-endpoints"><span>Hairline (2px)</span><span>Broad (32px)</span></div>

          <div class="slider-row" style="margin-top: 8px;">
            <div class="slider-label">
              <span>Paper Tooth Micro-Texture</span>
              <span id="tooth-val" class="param-val">${this.engine.paperTooth.toFixed(2)}</span>
            </div>
            <input type="range" id="tooth-slider" min="0.0" max="1.0" step="0.05" value="${this.engine.paperTooth}" class="range-slider" />
            <div class="range-endpoints"><span>Smooth Vellum</span><span>Coarse Rough Tooth</span></div>
          </div>
        </div>

        <!-- Section: Ink Overprint & Mixing (v4.0) -->
        <div class="tool-section" style="border-left: 2px solid #38bdf8; padding-left: 10px;">
          <div class="section-header-inline">
            <label class="section-label" style="color: #7dd3fc;">Ink Overprint &amp; Mixing (v4.0)</label>
            <span id="overprint-status-pill" class="param-val" style="font-size: 10px; padding: 1px 6px; border-radius: 999px; background: rgba(56,189,248,0.15); color: #38bdf8;">${this.engine.blendMode === 'multiply' ? 'ON' : 'OFF'}</span>
          </div>

          <!-- Ink Color Swatches (host app colours: Inkwell 20 Base palette + the 3.9 inks) -->
          <div class="slider-row">
            <div class="slider-label">
              <span>Ink Pigment Color</span>
              <span id="ink-color-val" class="param-val">${this.engine.color}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 5px; margin-top: 2px; flex-wrap: wrap;">
              ${INK_SWATCHES.map((c) => `<button type="button" class="ink-color-swatch" data-color="${c.hex}" title="${c.name} (${c.hex})" style="width: 20px; height: 20px; border-radius: 50%; background: ${c.hex}; border: 2px solid ${this.engine.color.toLowerCase() === c.hex.toLowerCase() ? '#38bdf8' : '#475569'}; cursor: pointer;"></button>`).join('')}
              <input type="color" id="ink-color-picker" value="${/^#[0-9a-f]{6}$/i.test(this.engine.color) ? this.engine.color : '#191817'}" title="Custom Ink Color" style="width: 26px; height: 24px; padding: 0; border: 1px solid #475569; border-radius: 4px; background: transparent; cursor: pointer; margin-left: auto;" />
            </div>
          </div>

          <!-- Paper Colour (what shows through the ink) -->
          <div class="slider-row">
            <div class="slider-label">
              <span>Paper Colour (seen through the ink)</span>
              <span id="paper-color-val" class="param-val">${this.engine.paperColor}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 5px; margin-top: 2px; flex-wrap: wrap;">
              ${PAPER_SWATCHES.map((c) => `<button type="button" class="paper-color-swatch" data-color="${c.hex}" title="${c.name} (${c.hex})" style="width: 20px; height: 20px; border-radius: 4px; background: ${c.hex}; border: 2px solid ${this.engine.paperColor.toLowerCase() === c.hex.toLowerCase() ? '#38bdf8' : '#475569'}; cursor: pointer;"></button>`).join('')}
              <input type="color" id="paper-color-picker" value="${this.engine.paperColor}" title="Custom Paper Colour" style="width: 26px; height: 24px; padding: 0; border: 1px solid #475569; border-radius: 4px; background: transparent; cursor: pointer; margin-left: auto;" />
            </div>
          </div>

          <!-- Overprint Model & Blend Mode -->
          <div class="slider-row">
            <div class="slider-label"><span>Ink Model</span></div>
            <select id="overprint-model-select" class="select-input" style="padding: 6px 10px; font-size: 12px;">
              <option value="mix" ${this.engine.overprintModel === 'mix' ? 'selected' : ''}>Mix — transparent ink that mixes (4.0)</option>
              <option value="classic" ${this.engine.overprintModel === 'classic' ? 'selected' : ''}>Classic — darken &amp; light-ink cover (3.9)</option>
            </select>
          </div>
          <div class="slider-row">
            <div class="slider-label"><span>Overprint</span></div>
            <select id="blend-mode-select" class="select-input" style="padding: 6px 10px; font-size: 12px;">
              <option value="multiply" ${this.engine.blendMode === 'multiply' ? 'selected' : ''}>On — mixing / darkening + swell</option>
              <option value="source-over" ${this.engine.blendMode === 'source-over' ? 'selected' : ''}>Off — flat opaque colour</option>
            </select>
          </div>

          ${OVERPRINT_SLIDERS.map((d) => `
          <div class="slider-row overprint-row" id="${d.id}-row">
            <div class="slider-label">
              <span title="${d.help}">${d.label}</span>
              <span id="${d.id}-val" class="param-val">${d.fmt(this._overprintValue(d.key))}</span>
            </div>
            <input type="range" id="${d.id}-slider" min="${d.min}" max="${d.max}" step="${d.step}" value="${this._overprintValue(d.key)}" class="range-slider" />
            <div class="range-endpoints"><span>${d.lo}</span><span>${d.hi}</span></div>
          </div>`).join('')}
        </div>

        <!-- ═══════════════════════════════════════════════════════════════ -->
        <!-- GROUP 1: ZIG CHINESE BRUSH CONTROLS -->
        <!-- ═══════════════════════════════════════════════════════════════ -->
        <div id="chinese-brush-group" class="instrument-controls-group ${instId !== 'chinese_brush' ? 'hidden' : ''}">
          <!-- Width Dynamics -->
          <div class="tool-section">
            <label class="section-label">Width Dynamics</label>

            <div class="slider-row">
              <div class="slider-label">
                <span>Slow Engorge (Swell)</span>
                <span id="engorge-val" class="param-val">${cb.slowEngorgeRatio.toFixed(2)}x</span>
              </div>
              <input type="range" id="engorge-slider" min="1.0" max="5.0" step="0.1" value="${cb.slowEngorgeRatio}" class="range-slider" />
              <div class="range-endpoints"><span>Uniform (1.0x)</span><span>High Contrast (5.0x)</span></div>
            </div>

            <div class="slider-row">
              <div class="slider-label">
                <span>Fast Speed Floor</span>
                <span id="thin-val" class="param-val">${Math.round(cb.fastThinRatio * 100)}%</span>
              </div>
              <input type="range" id="thin-slider" min="0.05" max="0.95" step="0.05" value="${cb.fastThinRatio}" class="range-slider" />
              <div class="range-endpoints"><span>Disappears (5%)</span><span>Maintains Width (95%)</span></div>
            </div>
          </div>

          <!-- Bristle Starvation & Refill -->
          <div class="tool-section">
            <label class="section-label">Bristle Starvation & Refill</label>

            <div class="slider-row">
              <div class="slider-label">
                <span>Starvation Sensitivity</span>
                <span id="depletion-val" class="param-val">${cb.depletionRate.toFixed(2)}</span>
              </div>
              <input type="range" id="depletion-slider" min="0.2" max="2.5" step="0.05" value="${cb.depletionRate}" class="range-slider" />
              <div class="range-endpoints"><span>Solid Line</span><span>Heavy Stripes</span></div>
            </div>

            <div class="slider-row">
              <div class="slider-label">
                <span>Ease-In (Onset Length)</span>
                <span id="ease-in-val" class="param-val">${Math.round(cb.starveEaseIn)} px</span>
              </div>
              <input type="range" id="ease-in-slider" min="30" max="300" step="5" value="${cb.starveEaseIn}" class="range-slider" />
              <div class="range-endpoints"><span>Instant (30px)</span><span>Gradual (300px)</span></div>
            </div>

            <div class="slider-row">
              <div class="slider-label">
                <span>Capillary Refill Speed</span>
                <span id="refill-val" class="param-val">${cb.refillRate.toFixed(2)}</span>
              </div>
              <input type="range" id="refill-slider" min="0.4" max="3.0" step="0.1" value="${cb.refillRate}" class="range-slider" />
              <div class="range-endpoints"><span>Slow Refill</span><span>Instant Solid Cap</span></div>
            </div>

            <div class="slider-row">
              <div class="slider-label">
                <span>Ease-Out (Refill Lingering)</span>
                <span id="ease-out-val" class="param-val">${Math.round(cb.starveEaseOut)} px</span>
              </div>
              <input type="range" id="ease-out-slider" min="20" max="250" step="5" value="${cb.starveEaseOut}" class="range-slider" />
              <div class="range-endpoints"><span>Quick Solid (20px)</span><span>Long Lingering (250px)</span></div>
            </div>

            <div class="slider-row">
              <div class="slider-label">
                <span>Simulated Bristles</span>
                <span id="bristles-val" class="param-val">${cb.numBristles}</span>
              </div>
              <input type="range" id="bristles-slider" min="16" max="54" step="2" value="${cb.numBristles}" class="range-slider" />
              <div class="range-endpoints"><span>Coarse (16)</span><span>Fine Hair (54)</span></div>
            </div>
          </div>

          <!-- Touch-Down Contact Stamp -->
          <div class="tool-section">
            <label class="section-label">Contact Landing</label>
            <div class="slider-row">
              <div class="slider-label">
                <span>Bone-Head Start Flare</span>
                <span id="flare-val" class="param-val">${cb.boneHeadFlare.toFixed(2)}x</span>
              </div>
              <input type="range" id="flare-slider" min="1.0" max="2.8" step="0.05" value="${cb.boneHeadFlare}" class="range-slider" />
              <div class="range-endpoints"><span>Round Tip (1.0x)</span><span>Tibia Flange (2.8x)</span></div>
            </div>
          </div>
        </div>

        <!-- ═══════════════════════════════════════════════════════════════ -->
        <!-- GROUP 2: POSCA MOP SQUEEZER CONTROLS -->
        <!-- ═══════════════════════════════════════════════════════════════ -->
        <div id="posca-squeezer-group" class="instrument-controls-group ${instId !== 'posca_squeezer' ? 'hidden' : ''}">
          <!-- Squeezer Stroke Dynamics -->
          <div class="tool-section">
            <label class="section-label">Squeezer Dome Dynamics</label>

            <div class="slider-row">
              <div class="slider-label">
                <span>Fast Waist Thinning</span>
                <span id="waist-val" class="param-val">${Math.round(ps.fastWaistRatio * 100)}%</span>
              </div>
              <input type="range" id="waist-slider" min="0.65" max="0.98" step="0.01" value="${ps.fastWaistRatio}" class="range-slider" />
              <div class="range-endpoints"><span>Pronounced (65%)</span><span>Monoline (98%)</span></div>
            </div>

            <div class="slider-row">
              <div class="slider-label">
                <span>Border Starvation Sensitivity</span>
                <span id="border-starve-val" class="param-val">${ps.borderStarveSensitivity.toFixed(2)}</span>
              </div>
              <input type="range" id="border-starve-slider" min="0.0" max="2.2" step="0.05" value="${ps.borderStarveSensitivity}" class="range-slider" />
              <div class="range-endpoints"><span>Solid Edges</span><span>Striated Tooth Slits</span></div>
            </div>

            <div class="slider-row">
              <div class="slider-label">
                <span>Dome Touchdown Flare</span>
                <span id="dome-flare-val" class="param-val">${ps.initialDomeFlare.toFixed(2)}x</span>
              </div>
              <input type="range" id="dome-flare-slider" min="1.0" max="1.5" step="0.02" value="${ps.initialDomeFlare}" class="range-slider" />
              <div class="range-endpoints"><span>Flush (1.0x)</span><span>Compressed Bulb (1.5x)</span></div>
            </div>
          </div>

          <!-- Fluid & Gravity Dripping -->
          <div class="tool-section">
            <label class="section-label">Acrylic Fluidity & Dripping</label>

            <div class="slider-row">
              <div class="slider-label">
                <span>Drip Sensitivity (Dwell Pool)</span>
                <span id="drip-thresh-val" class="param-val">${ps.dripThreshold.toFixed(2)}</span>
              </div>
              <input type="range" id="drip-thresh-slider" min="0.15" max="0.80" step="0.02" value="${ps.dripThreshold}" class="range-slider" />
              <div class="range-endpoints"><span>Fast Running Drips</span><span>Resistant Puddle</span></div>
            </div>

            <div class="slider-row">
              <div class="slider-label">
                <span>Squeezer Flow Rate</span>
                <span id="flow-val" class="param-val">${ps.flowRate.toFixed(2)}</span>
              </div>
              <input type="range" id="flow-slider" min="0.8" max="3.0" step="0.1" value="${ps.flowRate}" class="range-slider" />
              <div class="range-endpoints"><span>Dry Felt</span><span>Flooded Mop</span></div>
            </div>

            <div class="slider-row">
              <div class="slider-label">
                <span>Drip Width Ratio</span>
                <span id="drip-width-ratio-val" class="param-val">${Math.round(ps.dripWidthRatio * 100)}% (${(ps.effectiveRadius * 2 * ps.dripWidthRatio).toFixed(1)} px)</span>
              </div>
              <input type="range" id="drip-width-ratio-slider" min="0.10" max="0.55" step="0.02" value="${ps.dripWidthRatio}" class="range-slider" />
              <div class="range-endpoints"><span>Slender (10%)</span><span>Heavy Drip (55%)</span></div>
            </div>

            <div class="slider-row">
              <div class="slider-label">
                <span>Acrylic Paint Viscosity</span>
                <span id="viscosity-val" class="param-val">${ps.viscosity.toFixed(2)}</span>
              </div>
              <input type="range" id="viscosity-slider" min="0.20" max="0.80" step="0.02" value="${ps.viscosity}" class="range-slider" />
              <div class="range-endpoints"><span>Fluid Ink</span><span>Heavy Body Paint</span></div>
            </div>
          </div>
        </div>

        <!-- ═══════════════════════════════════════════════════════════════ -->
        <!-- GROUP 3: CURVED RULING / FOLDED PEN CONTROLS -->
        <!-- ═══════════════════════════════════════════════════════════════ -->
        <div id="ruling-pen-curved-group" class="instrument-controls-group ${instId !== 'ruling_pen_curved' ? 'hidden' : ''}">
          <div class="tool-section">
            <label class="section-label">Curved Blade & Point Dynamics</label>

            <!-- Mode Toggle -->
            <div class="slider-row">
              <div class="slider-label">
                <span>Pen Contact Mode</span>
              </div>
              <select id="curved-mode-select" class="select-input" style="padding: 6px 10px; font-size: 12px;">
                <option value="blade" ${rc.penMode === 'blade' ? 'selected' : ''}>Curved Blade (Modulated)</option>
                <option value="point" ${rc.penMode === 'point' ? 'selected' : ''}>Point Mode (Hairline)</option>
              </select>
            </div>

            <!-- Blade Angle -->
            <div class="slider-row">
              <div class="slider-label">
                <span>Blade Angle</span>
                <span id="curved-angle-val" class="param-val">${Math.round(rc.bladeAngle * 180 / Math.PI)}°</span>
              </div>
              <input type="range" id="curved-angle-slider" min="0" max="180" step="5" value="${Math.round(rc.bladeAngle * 180 / Math.PI)}" class="range-slider" />
              <div class="range-endpoints"><span>0° (Parallel)</span><span>180°</span></div>
            </div>

            <!-- Soundwave Edge Chatter -->
            <div class="slider-row">
              <div class="slider-label">
                <span>Soundwave Edge Ripple</span>
                <span id="curved-chatter-val" class="param-val">${rc.chatterIntensity.toFixed(2)}x</span>
              </div>
              <input type="range" id="curved-chatter-slider" min="0.0" max="2.8" step="0.05" value="${rc.chatterIntensity}" class="range-slider" />
              <div class="range-endpoints"><span>Clean Edge (0x)</span><span>High Chatter (2.8x)</span></div>
            </div>

            <!-- Friction Skips (Train Tracks) -->
            <div class="slider-row">
              <div class="slider-label">
                <span>Friction Skips (Train Tracks)</span>
                <span id="curved-skip-val" class="param-val">${rc.skipSensitivity.toFixed(2)}</span>
              </div>
              <input type="range" id="curved-skip-slider" min="0.2" max="2.5" step="0.05" value="${rc.skipSensitivity}" class="range-slider" />
              <div class="range-endpoints"><span>Dense Line (0.2x)</span><span>Wide Skips (2.5x)</span></div>
            </div>

            <!-- Width Range Modulation -->
            <div class="slider-row">
              <div class="slider-label">
                <span>Min Waisting Scale</span>
                <span id="curved-min-width-val" class="param-val">${rc.minWidthScale.toFixed(2)}x</span>
              </div>
              <input type="range" id="curved-min-width-slider" min="0.10" max="1.0" step="0.05" value="${rc.minWidthScale}" class="range-slider" />
              <div class="range-endpoints"><span>Pinched (0.1x)</span><span>Full Width (1.0x)</span></div>
            </div>

            <div class="slider-row">
              <div class="slider-label">
                <span>Max Swell Scale</span>
                <span id="curved-max-width-val" class="param-val">${rc.maxWidthScale.toFixed(2)}x</span>
              </div>
              <input type="range" id="curved-max-width-slider" min="1.0" max="3.5" step="0.1" value="${rc.maxWidthScale}" class="range-slider" />
              <div class="range-endpoints"><span>Nominal (1.0x)</span><span>Wide Swell (3.5x)</span></div>
            </div>

            <!-- Blade Clapping Spit Bursts -->
            <div class="slider-row">
              <div class="slider-label">
                <span>Blade Clapping Spit Bursts</span>
                <span id="curved-snap-val" class="param-val">${rc.snapIntensity.toFixed(2)}</span>
              </div>
              <input type="range" id="curved-snap-slider" min="0.0" max="2.5" step="0.05" value="${rc.snapIntensity}" class="range-slider" />
              <div class="range-endpoints"><span>No Splats (0x)</span><span>Explosive Fan (2.5x)</span></div>
            </div>

            <!-- Burst Explosion Width Multiplier -->
            <div class="slider-row">
              <div class="slider-label">
                <span>Burst Explosion Width</span>
                <span id="curved-burst-width-val" class="param-val">${rc.burstExplosionWidth.toFixed(2)}x</span>
              </div>
              <input type="range" id="curved-burst-width-slider" min="1.0" max="4.0" step="0.1" value="${rc.burstExplosionWidth}" class="range-slider" />
              <div class="range-endpoints"><span>No Widening (1.0x)</span><span>Volcano Blowout (4.0x)</span></div>
            </div>

            <!-- Spit Burst Droplet Counts -->
            <div class="slider-row">
              <div class="slider-label">
                <span>Min Spit Droplets</span>
                <span id="curved-min-spit-val" class="param-val">${rc.minSpitCount}</span>
              </div>
              <input type="range" id="curved-min-spit-slider" min="2" max="15" step="1" value="${rc.minSpitCount}" class="range-slider" />
              <div class="range-endpoints"><span>Few (2)</span><span>Cluster (15)</span></div>
            </div>

            <div class="slider-row">
              <div class="slider-label">
                <span>Max Spit Droplets</span>
                <span id="curved-max-spit-val" class="param-val">${rc.maxSpitCount}</span>
              </div>
              <input type="range" id="curved-max-spit-slider" min="8" max="40" step="1" value="${rc.maxSpitCount}" class="range-slider" />
              <div class="range-endpoints"><span>Moderate (8)</span><span>Heavy Spray (40)</span></div>
            </div>

            <!-- Max Spit Droplet Size -->
            <div class="slider-row">
              <div class="slider-label">
                <span>Max Droplet Size</span>
                <span id="curved-droplet-size-val" class="param-val">${rc.maxDropletSize.toFixed(1)} px</span>
              </div>
              <input type="range" id="curved-droplet-size-slider" min="1.5" max="14.0" step="0.5" value="${rc.maxDropletSize}" class="range-slider" />
              <div class="range-endpoints"><span>Fine Mist (1.5px)</span><span>Heavy Splats (14px)</span></div>
            </div>
          </div>
        </div>

        <!-- ═══════════════════════════════════════════════════════════════ -->
        <!-- GROUP 4: FLAT RULING / CHISEL PEN CONTROLS -->
        <!-- ═══════════════════════════════════════════════════════════════ -->
        <div id="ruling-pen-flat-group" class="instrument-controls-group ${instId !== 'ruling_pen_flat' ? 'hidden' : ''}">
          <div class="tool-section">
            <label class="section-label">Flat Chisel & Asymmetry Dynamics</label>

            <!-- Mode Toggle -->
            <div class="slider-row">
              <div class="slider-label">
                <span>Chisel Contact Mode</span>
              </div>
              <select id="flat-mode-select" class="select-input" style="padding: 6px 10px; font-size: 12px;">
                <option value="blade" ${rf.penMode === 'blade' ? 'selected' : ''}>Flat Chisel Ribbon</option>
                <option value="point" ${rf.penMode === 'point' ? 'selected' : ''}>Point Mode (Hairline)</option>
              </select>
            </div>

            <!-- Blade Angle -->
            <div class="slider-row">
              <div class="slider-label">
                <span>Chisel Blade Angle</span>
                <span id="flat-angle-val" class="param-val">${Math.round(rf.bladeAngle * 180 / Math.PI)}°</span>
              </div>
              <input type="range" id="flat-angle-slider" min="0" max="180" step="5" value="${Math.round(rf.bladeAngle * 180 / Math.PI)}" class="range-slider" />
              <div class="range-endpoints"><span>0°</span><span>180°</span></div>
            </div>

            <!-- Edge Asymmetry -->
            <div class="slider-row">
              <div class="slider-label">
                <span>Edge Asymmetry Contrast</span>
                <span id="flat-asymm-val" class="param-val">${Math.round(rf.edgeAsymmetry * 100)}%</span>
              </div>
              <input type="range" id="flat-asymm-slider" min="0.0" max="1.0" step="0.02" value="${rf.edgeAsymmetry}" class="range-slider" />
              <div class="range-endpoints"><span>Symmetric (0%)</span><span>Pristine vs Jagged (100%)</span></div>
            </div>

            <!-- Asymmetry Side -->
            <div class="slider-row">
              <div class="slider-label">
                <span>Ragged Edge Side</span>
              </div>
              <select id="flat-side-select" class="select-input" style="padding: 6px 10px; font-size: 12px;">
                <option value="right" ${rf.asymmetrySide === 'right' ? 'selected' : ''}>Right Edge Ragged</option>
                <option value="left" ${rf.asymmetrySide === 'left' ? 'selected' : ''}>Left Edge Ragged</option>
              </select>
            </div>

            <!-- Edge Tooth Teeth -->
            <div class="slider-row">
              <div class="slider-label">
                <span>Soundwave Teeth (Up to 3x)</span>
                <span id="flat-chatter-val" class="param-val">${rf.chatterIntensity.toFixed(2)}x</span>
              </div>
              <input type="range" id="flat-chatter-slider" min="0.0" max="3.0" step="0.05" value="${rf.chatterIntensity}" class="range-slider" />
              <div class="range-endpoints"><span>Smooth (0x)</span><span>Aggressive Comb (3.0x)</span></div>
            </div>

            <!-- Friction Skips (Train Tracks) -->
            <div class="slider-row">
              <div class="slider-label">
                <span>Friction Skips (Train Tracks)</span>
                <span id="flat-skip-val" class="param-val">${rf.skipSensitivity.toFixed(2)}</span>
              </div>
              <input type="range" id="flat-skip-slider" min="0.2" max="2.5" step="0.05" value="${rf.skipSensitivity}" class="range-slider" />
              <div class="range-endpoints"><span>Dense Line (0.2x)</span><span>Wide Skips (2.5x)</span></div>
            </div>

            <!-- Width Range Modulation -->
            <div class="slider-row">
              <div class="slider-label">
                <span>Min Waisting Scale</span>
                <span id="flat-min-width-val" class="param-val">${rf.minWidthScale.toFixed(2)}x</span>
              </div>
              <input type="range" id="flat-min-width-slider" min="0.10" max="1.0" step="0.05" value="${rf.minWidthScale}" class="range-slider" />
              <div class="range-endpoints"><span>Pinched (0.1x)</span><span>Full Width (1.0x)</span></div>
            </div>

            <div class="slider-row">
              <div class="slider-label">
                <span>Max Swell Scale</span>
                <span id="flat-max-width-val" class="param-val">${rf.maxWidthScale.toFixed(2)}x</span>
              </div>
              <input type="range" id="flat-max-width-slider" min="1.0" max="3.5" step="0.1" value="${rf.maxWidthScale}" class="range-slider" />
              <div class="range-endpoints"><span>Nominal (1.0x)</span><span>Wide Swell (3.5x)</span></div>
            </div>

            <!-- One-Sided Spit Explosions -->
            <div class="slider-row">
              <div class="slider-label">
                <span>One-Sided Spit Explosions</span>
                <span id="flat-snap-val" class="param-val">${rf.snapIntensity.toFixed(2)}</span>
              </div>
              <input type="range" id="flat-snap-slider" min="0.0" max="2.5" step="0.05" value="${rf.snapIntensity}" class="range-slider" />
              <div class="range-endpoints"><span>No Splats (0x)</span><span>One-Sided Shower (2.5x)</span></div>
            </div>

            <!-- Burst Explosion Width Multiplier -->
            <div class="slider-row">
              <div class="slider-label">
                <span>Burst Explosion Width</span>
                <span id="flat-burst-width-val" class="param-val">${rf.burstExplosionWidth.toFixed(2)}x</span>
              </div>
              <input type="range" id="flat-burst-width-slider" min="1.0" max="4.0" step="0.1" value="${rf.burstExplosionWidth}" class="range-slider" />
              <div class="range-endpoints"><span>No Widening (1.0x)</span><span>Volcano Blowout (4.0x)</span></div>
            </div>

            <!-- Spit Burst Droplet Counts -->
            <div class="slider-row">
              <div class="slider-label">
                <span>Min Spit Droplets</span>
                <span id="flat-min-spit-val" class="param-val">${rf.minSpitCount}</span>
              </div>
              <input type="range" id="flat-min-spit-slider" min="2" max="15" step="1" value="${rf.minSpitCount}" class="range-slider" />
              <div class="range-endpoints"><span>Few (2)</span><span>Cluster (15)</span></div>
            </div>

            <div class="slider-row">
              <div class="slider-label">
                <span>Max Spit Droplets</span>
                <span id="flat-max-spit-val" class="param-val">${rf.maxSpitCount}</span>
              </div>
              <input type="range" id="flat-max-spit-slider" min="8" max="40" step="1" value="${rf.maxSpitCount}" class="range-slider" />
              <div class="range-endpoints"><span>Moderate (8)</span><span>Heavy Spray (40)</span></div>
            </div>

            <!-- Max Spit Droplet Size -->
            <div class="slider-row">
              <div class="slider-label">
                <span>Max Droplet Size</span>
                <span id="flat-droplet-size-val" class="param-val">${rf.maxDropletSize.toFixed(1)} px</span>
              </div>
              <input type="range" id="flat-droplet-size-slider" min="1.5" max="14.0" step="0.5" value="${rf.maxDropletSize}" class="range-slider" />
              <div class="range-endpoints"><span>Fine Mist (1.5px)</span><span>Heavy Splats (14px)</span></div>
            </div>
          </div>
        </div>

        <!-- Section: My Presets (user presets, v4.0) -->
        <div class="tool-section" id="user-presets-section" style="border-left: 2px solid #fbbf24; padding-left: 10px;">
          <div class="section-header-inline">
            <label class="section-label" style="color: #fcd34d;">★ My Presets</label>
            <span id="user-presets-count" class="param-val">0</span>
          </div>
          <select id="user-preset-select" class="select-input"><option value="">— none saved yet —</option></select>
          <input type="text" id="user-preset-name" class="select-input" maxlength="80" placeholder="A name for this pen" style="margin-top: 6px;" />
          <div class="btn-grid" style="margin-top: 6px;">
            <button id="btn-preset-save" class="btn btn-action" title="Keep the current pen as a new preset">Save as New</button>
            <button id="btn-preset-update" class="btn btn-action" title="Overwrite the selected preset with the current pen">Update</button>
          </div>
          <div class="btn-grid" style="margin-top: 6px;">
            <button id="btn-preset-rename" class="btn btn-action" title="Give the selected preset the name above">Rename</button>
            <button id="btn-preset-delete" class="btn btn-action btn-danger" title="Delete the selected preset (click twice)">Delete</button>
          </div>
          <div class="btn-grid" style="margin-top: 6px;">
            <button id="btn-preset-export" class="btn btn-action" title="Save all my presets as a .json file">Export</button>
            <button id="btn-preset-import" class="btn btn-action" title="Add the presets of a .json file">Import</button>
          </div>
          <input type="file" id="user-preset-file" accept="application/json,.json" hidden />
          <div class="slider-row" style="margin-top: 8px;">
            <div class="slider-label"><span>Kept in</span></div>
            <select id="user-preset-storage" class="select-input" style="padding: 6px 10px; font-size: 12px;">
              <option value="local">This browser</option>
              <option value="server">A server (server/presets.php)</option>
            </select>
          </div>
          <div id="user-preset-server" class="hidden" style="margin-top: 6px;">
            <input type="text" id="user-preset-endpoint" class="select-input" value="server/presets.php" placeholder="Endpoint URL" />
            <input type="password" id="user-preset-token" class="select-input" placeholder="Write token (kept for this tab only)" autocomplete="off" style="margin-top: 6px;" />
            <button id="btn-preset-connect" class="btn btn-action" style="margin-top: 6px; width: 100%;">Connect</button>
          </div>
          <p id="user-preset-msg" class="preset-description" aria-live="polite">Core presets are permanent; your own tunings are kept here.</p>
        </div>

        <!-- Section: 3rd-Party Integration Snippet -->
        <div class="tool-section snippet-section">
          <div class="section-header-inline">
            <div class="snippet-modes">
              <button id="snippet-mode-call" class="snippet-mode-btn active" title="1-Line constructor call for host apps">1-Line Call</button>
              <button id="snippet-mode-config" class="snippet-mode-btn" title="Full JSON options object">Config JSON</button>
            </div>
            <button id="btn-copy-snippet" class="btn btn-copy" title="Copy snippet to clipboard">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              <span id="copy-btn-label">Copy Snippet</span>
            </button>
          </div>
          <div class="snippet-box">
            <textarea id="snippet-input" readonly spellcheck="false" class="snippet-textarea" rows="2" title="Click to select all"></textarea>
          </div>
          <div class="snippet-hint">Paste into your 3rd party app (e.g. Inkwell) to instantiate or configure this exact tuned pen.</div>
        </div>

        <!-- Section: Actions -->
        <div class="tool-section actions-section">
          <div class="btn-grid">
            <button id="btn-undo" class="btn btn-action" title="Undo (Cmd+Z)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>
              Undo
            </button>
            <button id="btn-redo" class="btn btn-action" title="Redo (Cmd+Shift+Z)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3L21 13"/></svg>
              Redo
            </button>
          </div>
          <button id="btn-reset-preset" class="btn btn-action" title="Reset all sliders to active preset defaults">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            Reset Preset Defaults
          </button>
          <button id="btn-clear" class="btn btn-action btn-danger">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            Clear Canvas
          </button>
          <button id="btn-export" class="btn btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export Drawing
          </button>
          <button id="btn-view-refs" class="btn btn-link">
            Compare Reference Photos
          </button>
          <a href="design_handoff.html" target="_blank" class="btn btn-link" style="color: #67e8f9; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 4px;">
            📐 Design Handoff &amp; Spec ↗
          </a>
          <a href="specimen_ink_blending.html" target="_blank" class="btn btn-link" style="color: #38bdf8; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 4px;">
            🩸 Ink Overprint &amp; Blending Lab ↗
          </a>
          <a href="specimen_ruling_pens.html" target="_blank" class="btn btn-link" style="color: #cbd5e1; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 4px;">
            🔬 Ruling Pens Specimen Lab ↗
          </a>
          <button id="btn-about-modal" class="btn btn-link" style="color: #a5b4fc;">
            ℹ️ About S.iX & InkDynamics
          </button>
        </div>

        <!-- S.iX Credits Footer -->
        <div class="toolbar-credits-footer">
          <div class="credits-project">
            <span class="credits-dot">●</span> <strong>SiX Research Project</strong>
          </div>
          <div class="credits-authors">
            Concept &amp; design: <strong>Pedro Amado</strong> (FBAUP / i2ADS)
          </div>
          <div class="credits-authors">
            Development: Google Gemini 3.8 Flash (Antigravity) &amp; Anthropic Claude Opus 5.5 · October 2026
          </div>
          <div class="credits-funding">
            FCT 2023.11224.PEX · <a href="https://six.fba.up.pt/" target="_blank" rel="noopener">six.fba.up.pt</a> · <a href="about.html">About</a> · <a href="design_handoff.html">Spec</a>
          </div>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    // Preset dropdown
    const presetSelect = this.container.querySelector('#preset-select');
    const presetDesc = this.container.querySelector('#preset-desc');
    presetSelect.addEventListener('change', (e) => {
      const id = e.target.value;
      if (id.startsWith('user-')) {
        const p = this.userPresets.find((u) => u.id === id);
        if (p) this._applyUserPreset(p);
        return;
      }
      this.selectedUserPreset = null;
      this.engine.setPreset(id);
      const cur = this.engine.activePreset;
      if (cur && presetDesc) {
        presetDesc.textContent = cur.description;
      }
      this._syncSliders();
      this._saveToLocalStorage();
    });

    this._bindUserPresets();

    // Universal Nib Radius slider
    const radiusSlider = this.container.querySelector('#radius-slider');
    const radiusVal = this.container.querySelector('#radius-val');
    radiusSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.engine.setNibRadius(val);
      radiusVal.textContent = `${val.toFixed(1)} px`;
      const ps = this.engine.instruments.posca_squeezer;
      const dripRatioVal = this.container.querySelector('#drip-width-ratio-val');
      if (ps && dripRatioVal) {
        dripRatioVal.textContent = `${Math.round(ps.dripWidthRatio * 100)}% (${(ps.effectiveRadius * 2 * ps.dripWidthRatio).toFixed(1)} px)`;
      }
      this._saveToLocalStorage();
    });

    // Universal Paper Tooth slider
    const toothSlider = this.container.querySelector('#tooth-slider');
    const toothVal = this.container.querySelector('#tooth-val');
    toothSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.engine.setPaperTooth(val);
      toothVal.textContent = val.toFixed(2);
      this._saveToLocalStorage();
    });

    // ═══════════════════════════════════════════════════════════════════
    // Ink Overprint & Mixing Controls (v4.0)
    // ═══════════════════════════════════════════════════════════════════
    const colorSwatches = this.container.querySelectorAll('.ink-color-swatch');
    const colorPicker = this.container.querySelector('#ink-color-picker');
    const colorVal = this.container.querySelector('#ink-color-val');

    const applyColorSelection = (hex) => {
      this.engine.setColor(hex);
      if (colorVal) colorVal.textContent = hex;
      if (colorPicker && /^#[0-9a-f]{6}$/i.test(hex)) colorPicker.value = hex;
      colorSwatches.forEach((btn) => {
        btn.style.borderColor = btn.dataset.color.toLowerCase() === hex.toLowerCase() ? '#38bdf8' : '#475569';
      });
      this._updateSnippet();
      this._saveToLocalStorage();
    };

    colorSwatches.forEach((btn) => {
      btn.addEventListener('click', () => {
        applyColorSelection(btn.dataset.color);
      });
    });

    if (colorPicker) {
      colorPicker.addEventListener('input', (e) => {
        applyColorSelection(e.target.value);
      });
    }

    // the paper: the canvas is repainted in it (the drawing is cleared) and the ink's see-through uses it
    const paperSwatches = this.container.querySelectorAll('.paper-color-swatch');
    const paperPicker = this.container.querySelector('#paper-color-picker');
    const applyPaper = (hex) => {
      this.engine.setPaperColor(hex);
      const v = this.container.querySelector('#paper-color-val');
      if (v) v.textContent = this.engine.paperColor;
      if (paperPicker) paperPicker.value = this.engine.paperColor;
      paperSwatches.forEach((btn) => {
        btn.style.borderColor = btn.dataset.color.toLowerCase() === this.engine.paperColor.toLowerCase() ? '#38bdf8' : '#475569';
      });
      const viewport = document.getElementById('canvas-viewport');
      if (viewport) viewport.style.backgroundColor = this.engine.paperColor;
      this.engine.clear();
      this._updateSnippet();
      this._saveToLocalStorage();
    };
    paperSwatches.forEach((btn) => btn.addEventListener('click', () => applyPaper(btn.dataset.color)));
    if (paperPicker) paperPicker.addEventListener('change', (e) => applyPaper(e.target.value));

    const modelSelect = this.container.querySelector('#overprint-model-select');
    if (modelSelect) {
      modelSelect.addEventListener('change', (e) => {
        this.engine.setOverprintModel(e.target.value);
        this._syncSliders();
        this._saveToLocalStorage();
      });
    }

    const blendModeSelect = this.container.querySelector('#blend-mode-select');
    const overprintStatusPill = this.container.querySelector('#overprint-status-pill');
    if (blendModeSelect) {
      blendModeSelect.addEventListener('change', (e) => {
        const mode = e.target.value;
        this.engine.setBlendMode(mode);
        if (overprintStatusPill) {
          overprintStatusPill.textContent = mode === 'multiply' ? 'ON' : 'OFF';
          overprintStatusPill.style.color = mode === 'multiply' ? '#38bdf8' : '#94a3b8';
        }
        this._syncSliders();
        this._saveToLocalStorage();
      });
    }

    const setters = {
      inkDensity: (v) => this.engine.setInkDensity(v),
      overprintDarken: (v) => this.engine.setOverprintDarken(v),
      overprintAttack: (v) => this.engine.setOverprintAttack(v),
      overprintRelease: (v) => this.engine.setOverprintRelease(v),
      overprintReach: (v) => this.engine.setOverprintReach(v),
      overprintSwell: (v) => this.engine.setOverprintSwell(v),
    };
    for (const d of OVERPRINT_SLIDERS) {
      const slider = this.container.querySelector(`#${d.id}-slider`);
      const val = this.container.querySelector(`#${d.id}-val`);
      if (!slider) continue;
      slider.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        setters[d.key](v);
        if (val) val.textContent = d.fmt(this._overprintValue(d.key));
        this._saveToLocalStorage();
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // Chinese Brush Controls
    // ═══════════════════════════════════════════════════════════════════
    const engorgeSlider = this.container.querySelector('#engorge-slider');
    const engorgeVal = this.container.querySelector('#engorge-val');
    if (engorgeSlider) {
      engorgeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setSlowEngorgeRatio(val);
        engorgeVal.textContent = `${val.toFixed(2)}x`;
        this._saveToLocalStorage();
      });
    }

    const thinSlider = this.container.querySelector('#thin-slider');
    const thinVal = this.container.querySelector('#thin-val');
    if (thinSlider) {
      thinSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setFastThinRatio(val);
        thinVal.textContent = `${Math.round(val * 100)}%`;
        this._saveToLocalStorage();
      });
    }

    const depletionSlider = this.container.querySelector('#depletion-slider');
    const depletionVal = this.container.querySelector('#depletion-val');
    if (depletionSlider) {
      depletionSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setDepletionRate(val);
        depletionVal.textContent = val.toFixed(2);
        this._saveToLocalStorage();
      });
    }

    const easeInSlider = this.container.querySelector('#ease-in-slider');
    const easeInVal = this.container.querySelector('#ease-in-val');
    if (easeInSlider) {
      easeInSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setStarveEaseIn(val);
        easeInVal.textContent = `${Math.round(val)} px`;
        this._saveToLocalStorage();
      });
    }

    const refillSlider = this.container.querySelector('#refill-slider');
    const refillVal = this.container.querySelector('#refill-val');
    if (refillSlider) {
      refillSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setRefillRate(val);
        refillVal.textContent = val.toFixed(2);
        this._saveToLocalStorage();
      });
    }

    const easeOutSlider = this.container.querySelector('#ease-out-slider');
    const easeOutVal = this.container.querySelector('#ease-out-val');
    if (easeOutSlider) {
      easeOutSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setStarveEaseOut(val);
        easeOutVal.textContent = `${Math.round(val)} px`;
        this._saveToLocalStorage();
      });
    }

    const bristlesSlider = this.container.querySelector('#bristles-slider');
    const bristlesVal = this.container.querySelector('#bristles-val');
    if (bristlesSlider) {
      bristlesSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.engine.setBristleCount(val);
        bristlesVal.textContent = val;
        this._saveToLocalStorage();
      });
    }

    const flareSlider = this.container.querySelector('#flare-slider');
    const flareVal = this.container.querySelector('#flare-val');
    if (flareSlider) {
      flareSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setBoneHeadFlare(val);
        flareVal.textContent = `${val.toFixed(2)}x`;
        this._saveToLocalStorage();
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // Posca Mop Squeezer Controls
    // ═══════════════════════════════════════════════════════════════════
    const waistSlider = this.container.querySelector('#waist-slider');
    const waistVal = this.container.querySelector('#waist-val');
    if (waistSlider) {
      waistSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setFastWaistRatio(val);
        waistVal.textContent = `${Math.round(val * 100)}%`;
        this._saveToLocalStorage();
      });
    }

    const borderStarveSlider = this.container.querySelector('#border-starve-slider');
    const borderStarveVal = this.container.querySelector('#border-starve-val');
    if (borderStarveSlider) {
      borderStarveSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setBorderStarveSensitivity(val);
        borderStarveVal.textContent = val.toFixed(2);
        this._saveToLocalStorage();
      });
    }

    const domeFlareSlider = this.container.querySelector('#dome-flare-slider');
    const domeFlareVal = this.container.querySelector('#dome-flare-val');
    if (domeFlareSlider) {
      domeFlareSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setInitialDomeFlare(val);
        domeFlareVal.textContent = `${val.toFixed(2)}x`;
        this._saveToLocalStorage();
      });
    }

    const dripThreshSlider = this.container.querySelector('#drip-thresh-slider');
    const dripThreshVal = this.container.querySelector('#drip-thresh-val');
    if (dripThreshSlider) {
      dripThreshSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setDripThreshold(val);
        dripThreshVal.textContent = val.toFixed(2);
        this._saveToLocalStorage();
      });
    }

    const flowSlider = this.container.querySelector('#flow-slider');
    const flowVal = this.container.querySelector('#flow-val');
    if (flowSlider) {
      flowSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setFlowRate(val);
        flowVal.textContent = val.toFixed(2);
        this._saveToLocalStorage();
      });
    }

    const viscositySlider = this.container.querySelector('#viscosity-slider');
    const viscosityVal = this.container.querySelector('#viscosity-val');
    if (viscositySlider) {
      viscositySlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setViscosity(val);
        viscosityVal.textContent = val.toFixed(2);
        this._saveToLocalStorage();
      });
    }

    const dripRatioSlider = this.container.querySelector('#drip-width-ratio-slider');
    const dripRatioVal = this.container.querySelector('#drip-width-ratio-val');
    if (dripRatioSlider) {
      dripRatioSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setDripWidthRatio(val);
        const ps = this.engine.instruments.posca_squeezer;
        const strokeW = ps ? ps.effectiveRadius * 2 : 24;
        dripRatioVal.textContent = `${Math.round(val * 100)}% (${(strokeW * val).toFixed(1)} px)`;
        this._saveToLocalStorage();
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // Curved Ruling Pen Controls
    // ═══════════════════════════════════════════════════════════════════
    const curvedModeSelect = this.container.querySelector('#curved-mode-select');
    if (curvedModeSelect) {
      curvedModeSelect.addEventListener('change', (e) => {
        this.engine.setPenMode(e.target.value);
        this._saveToLocalStorage();
      });
    }

    const curvedAngleSlider = this.container.querySelector('#curved-angle-slider');
    const curvedAngleVal = this.container.querySelector('#curved-angle-val');
    if (curvedAngleSlider) {
      curvedAngleSlider.addEventListener('input', (e) => {
        const deg = parseFloat(e.target.value);
        const rad = (deg * Math.PI) / 180;
        this.engine.setBladeAngle(rad);
        curvedAngleVal.textContent = `${Math.round(deg)}°`;
        this._saveToLocalStorage();
      });
    }

    const curvedChatterSlider = this.container.querySelector('#curved-chatter-slider');
    const curvedChatterVal = this.container.querySelector('#curved-chatter-val');
    if (curvedChatterSlider) {
      curvedChatterSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setChatterIntensity(val);
        curvedChatterVal.textContent = `${val.toFixed(2)}x`;
        this._saveToLocalStorage();
      });
    }

    const curvedSkipSlider = this.container.querySelector('#curved-skip-slider');
    const curvedSkipVal = this.container.querySelector('#curved-skip-val');
    if (curvedSkipSlider) {
      curvedSkipSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setSkipSensitivity(val);
        curvedSkipVal.textContent = val.toFixed(2);
        this._saveToLocalStorage();
      });
    }

    const curvedSnapSlider = this.container.querySelector('#curved-snap-slider');
    const curvedSnapVal = this.container.querySelector('#curved-snap-val');
    if (curvedSnapSlider) {
      curvedSnapSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setSnapIntensity(val);
        curvedSnapVal.textContent = val.toFixed(2);
        this._saveToLocalStorage();
      });
    }

    const curvedMinWidthSlider = this.container.querySelector('#curved-min-width-slider');
    const curvedMinWidthVal = this.container.querySelector('#curved-min-width-val');
    if (curvedMinWidthSlider) {
      curvedMinWidthSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setMinWidthScale(val);
        curvedMinWidthVal.textContent = `${val.toFixed(2)}x`;
        this._saveToLocalStorage();
      });
    }

    const curvedMaxWidthSlider = this.container.querySelector('#curved-max-width-slider');
    const curvedMaxWidthVal = this.container.querySelector('#curved-max-width-val');
    if (curvedMaxWidthSlider) {
      curvedMaxWidthSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setMaxWidthScale(val);
        curvedMaxWidthVal.textContent = `${val.toFixed(2)}x`;
        this._saveToLocalStorage();
      });
    }

    const curvedBurstWidthSlider = this.container.querySelector('#curved-burst-width-slider');
    const curvedBurstWidthVal = this.container.querySelector('#curved-burst-width-val');
    if (curvedBurstWidthSlider) {
      curvedBurstWidthSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setBurstExplosionWidth(val);
        curvedBurstWidthVal.textContent = `${val.toFixed(2)}x`;
        this._saveToLocalStorage();
      });
    }

    const curvedMinSpitSlider = this.container.querySelector('#curved-min-spit-slider');
    const curvedMinSpitVal = this.container.querySelector('#curved-min-spit-val');
    if (curvedMinSpitSlider) {
      curvedMinSpitSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.engine.setMinSpitCount(val);
        curvedMinSpitVal.textContent = val;
        this._saveToLocalStorage();
      });
    }

    const curvedMaxSpitSlider = this.container.querySelector('#curved-max-spit-slider');
    const curvedMaxSpitVal = this.container.querySelector('#curved-max-spit-val');
    if (curvedMaxSpitSlider) {
      curvedMaxSpitSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.engine.setMaxSpitCount(val);
        curvedMaxSpitVal.textContent = val;
        this._saveToLocalStorage();
      });
    }

    const curvedDropletSizeSlider = this.container.querySelector('#curved-droplet-size-slider');
    const curvedDropletSizeVal = this.container.querySelector('#curved-droplet-size-val');
    if (curvedDropletSizeSlider) {
      curvedDropletSizeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setMaxDropletSize(val);
        curvedDropletSizeVal.textContent = `${val.toFixed(1)} px`;
        this._saveToLocalStorage();
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // Flat Ruling Pen Controls
    // ═══════════════════════════════════════════════════════════════════
    const flatModeSelect = this.container.querySelector('#flat-mode-select');
    if (flatModeSelect) {
      flatModeSelect.addEventListener('change', (e) => {
        this.engine.setPenMode(e.target.value);
        this._saveToLocalStorage();
      });
    }

    const flatAngleSlider = this.container.querySelector('#flat-angle-slider');
    const flatAngleVal = this.container.querySelector('#flat-angle-val');
    if (flatAngleSlider) {
      flatAngleSlider.addEventListener('input', (e) => {
        const deg = parseFloat(e.target.value);
        const rad = (deg * Math.PI) / 180;
        this.engine.setBladeAngle(rad);
        flatAngleVal.textContent = `${Math.round(deg)}°`;
        this._saveToLocalStorage();
      });
    }

    const flatAsymmSlider = this.container.querySelector('#flat-asymm-slider');
    const flatAsymmVal = this.container.querySelector('#flat-asymm-val');
    if (flatAsymmSlider) {
      flatAsymmSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setEdgeAsymmetry(val);
        flatAsymmVal.textContent = `${Math.round(val * 100)}%`;
        this._saveToLocalStorage();
      });
    }

    const flatSideSelect = this.container.querySelector('#flat-side-select');
    if (flatSideSelect) {
      flatSideSelect.addEventListener('change', (e) => {
        this.engine.setAsymmetrySide(e.target.value);
        this._saveToLocalStorage();
      });
    }

    const flatChatterSlider = this.container.querySelector('#flat-chatter-slider');
    const flatChatterVal = this.container.querySelector('#flat-chatter-val');
    if (flatChatterSlider) {
      flatChatterSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setChatterIntensity(val);
        flatChatterVal.textContent = `${val.toFixed(2)}x`;
        this._saveToLocalStorage();
      });
    }

    const flatSkipSlider = this.container.querySelector('#flat-skip-slider');
    const flatSkipVal = this.container.querySelector('#flat-skip-val');
    if (flatSkipSlider) {
      flatSkipSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setSkipSensitivity(val);
        flatSkipVal.textContent = val.toFixed(2);
        this._saveToLocalStorage();
      });
    }

    const flatSnapSlider = this.container.querySelector('#flat-snap-slider');
    const flatSnapVal = this.container.querySelector('#flat-snap-val');
    if (flatSnapSlider) {
      flatSnapSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setSnapIntensity(val);
        flatSnapVal.textContent = val.toFixed(2);
        this._saveToLocalStorage();
      });
    }

    const flatMinWidthSlider = this.container.querySelector('#flat-min-width-slider');
    const flatMinWidthVal = this.container.querySelector('#flat-min-width-val');
    if (flatMinWidthSlider) {
      flatMinWidthSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setMinWidthScale(val);
        flatMinWidthVal.textContent = `${val.toFixed(2)}x`;
        this._saveToLocalStorage();
      });
    }

    const flatMaxWidthSlider = this.container.querySelector('#flat-max-width-slider');
    const flatMaxWidthVal = this.container.querySelector('#flat-max-width-val');
    if (flatMaxWidthSlider) {
      flatMaxWidthSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setMaxWidthScale(val);
        flatMaxWidthVal.textContent = `${val.toFixed(2)}x`;
        this._saveToLocalStorage();
      });
    }

    const flatBurstWidthSlider = this.container.querySelector('#flat-burst-width-slider');
    const flatBurstWidthVal = this.container.querySelector('#flat-burst-width-val');
    if (flatBurstWidthSlider) {
      flatBurstWidthSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setBurstExplosionWidth(val);
        flatBurstWidthVal.textContent = `${val.toFixed(2)}x`;
        this._saveToLocalStorage();
      });
    }

    const flatMinSpitSlider = this.container.querySelector('#flat-min-spit-slider');
    const flatMinSpitVal = this.container.querySelector('#flat-min-spit-val');
    if (flatMinSpitSlider) {
      flatMinSpitSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.engine.setMinSpitCount(val);
        flatMinSpitVal.textContent = val;
        this._saveToLocalStorage();
      });
    }

    const flatMaxSpitSlider = this.container.querySelector('#flat-max-spit-slider');
    const flatMaxSpitVal = this.container.querySelector('#flat-max-spit-val');
    if (flatMaxSpitSlider) {
      flatMaxSpitSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.engine.setMaxSpitCount(val);
        flatMaxSpitVal.textContent = val;
        this._saveToLocalStorage();
      });
    }

    const flatDropletSizeSlider = this.container.querySelector('#flat-droplet-size-slider');
    const flatDropletSizeVal = this.container.querySelector('#flat-droplet-size-val');
    if (flatDropletSizeSlider) {
      flatDropletSizeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engine.setMaxDropletSize(val);
        flatDropletSizeVal.textContent = `${val.toFixed(1)} px`;
        this._saveToLocalStorage();
      });
    }

    // Reset Preset Defaults action
    const resetPresetBtn = this.container.querySelector('#btn-reset-preset');
    if (resetPresetBtn) {
      resetPresetBtn.addEventListener('click', () => {
        this.engine.setPreset(this.engine.activeInstrument.activePresetId);
        this._syncSliders();
        this._saveToLocalStorage();
      });
    }

    // Actions
    this.container.querySelector('#btn-undo').addEventListener('click', () => this.engine.undo());
    this.container.querySelector('#btn-redo').addEventListener('click', () => this.engine.redo());
    this.container.querySelector('#btn-clear').addEventListener('click', () => this.engine.clear());

    this.container.querySelector('#btn-export').addEventListener('click', () => {
      const dataUrl = this.engine.exportPNG();
      const a = document.createElement('a');
      a.href = dataUrl;
      const instId = this.engine.activeInstrumentId;
      const toolSlug = instId === 'posca_squeezer' ? 'posca-mop-v3'
        : instId === 'ruling_pen_curved' ? 'ruling-pen-curved'
        : instId === 'ruling_pen_flat' ? 'ruling-pen-flat'
        : 'zig-brush-v2';
      a.download = `${toolSlug}-${Date.now()}.png`;
      a.click();
    });

    this.container.querySelector('#btn-view-refs').addEventListener('click', () => {
      const modal = document.getElementById('reference-modal');
      if (modal) modal.showModal();
    });

    const btnAboutBadge = this.container.querySelector('#btn-about-badge');
    if (btnAboutBadge) {
      btnAboutBadge.addEventListener('click', () => {
        const modal = document.getElementById('about-modal');
        if (modal) modal.showModal();
      });
    }

    const btnAboutModal = this.container.querySelector('#btn-about-modal');
    if (btnAboutModal) {
      btnAboutModal.addEventListener('click', () => {
        const modal = document.getElementById('about-modal');
        if (modal) modal.showModal();
      });
    }

    // ── 3rd-Party Integration Snippet Controls ────────────────────────────────
    const btnCall = this.container.querySelector('#snippet-mode-call');
    const btnConfig = this.container.querySelector('#snippet-mode-config');
    const btnCopy = this.container.querySelector('#btn-copy-snippet');
    const copyLabel = this.container.querySelector('#copy-btn-label');
    const snippetInput = this.container.querySelector('#snippet-input');

    if (btnCall && btnConfig) {
      btnCall.addEventListener('click', () => {
        this.snippetMode = 'call';
        btnCall.classList.add('active');
        btnConfig.classList.remove('active');
        this._updateSnippet();
      });

      btnConfig.addEventListener('click', () => {
        this.snippetMode = 'config';
        btnConfig.classList.add('active');
        btnCall.classList.remove('active');
        this._updateSnippet();
      });
    }

    if (btnCopy && snippetInput) {
      btnCopy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(snippetInput.value);
          if (copyLabel) copyLabel.textContent = 'Copied!';
          btnCopy.classList.add('copied');
          setTimeout(() => {
            if (copyLabel) copyLabel.textContent = 'Copy Snippet';
            btnCopy.classList.remove('copied');
          }, 1500);
        } catch (_) {
          snippetInput.select();
        }
      });
    }

    if (snippetInput) {
      snippetInput.addEventListener('click', () => {
        snippetInput.select();
      });
    }

    // Auto-update snippet whenever any slider or control in toolbar changes
    this.container.addEventListener('input', () => {
      this._updateSnippet();
    });
    this.container.addEventListener('change', () => {
      this._updateSnippet();
    });
  }

  _overprintValue(key) {
    const v = this.engine[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  }

  _syncSliders() {
    const instId = this.engine.activeInstrumentId;
    const activeInst = this.engine.activeInstrument;

    // 1. Update Brand Badge & Tool Groups Visibility
    const badge = this.container.querySelector('#brand-badge');
    if (badge) {
      badge.textContent = instId === 'posca_squeezer' ? 'POSCA MOP SQUEEZER v3'
        : instId === 'ruling_pen_curved' ? 'CURVED RULING / FOLDED PEN'
        : instId === 'ruling_pen_flat' ? 'FLAT RULING / CHISEL PEN'
        : 'ZIG CHINESE BRUSH v2';
    }

    const cbGroup = this.container.querySelector('#chinese-brush-group');
    const psGroup = this.container.querySelector('#posca-squeezer-group');
    const rcGroup = this.container.querySelector('#ruling-pen-curved-group');
    const rfGroup = this.container.querySelector('#ruling-pen-flat-group');

    if (cbGroup) cbGroup.classList.toggle('hidden', instId !== 'chinese_brush');
    if (psGroup) psGroup.classList.toggle('hidden', instId !== 'posca_squeezer');
    if (rcGroup) rcGroup.classList.toggle('hidden', instId !== 'ruling_pen_curved');
    if (rfGroup) rfGroup.classList.toggle('hidden', instId !== 'ruling_pen_flat');

    // 2. Preset Select & Description
    const pSelect = this.container.querySelector('#preset-select');
    if (pSelect && pSelect.value !== activeInst.activePresetId) {
      pSelect.value = activeInst.activePresetId;
    }
    const pDesc = this.container.querySelector('#preset-desc');
    if (pDesc && this.engine.activePreset) {
      pDesc.textContent = this.engine.activePreset.description;
    }

    // 3. Universal Sliders & Overprint Controls (v3.9)
    const rSlider = this.container.querySelector('#radius-slider');
    const rVal = this.container.querySelector('#radius-val');
    if (rSlider) {
      rSlider.value = activeInst.baseRadius;
      rVal.textContent = `${activeInst.baseRadius.toFixed(1)} px`;
    }

    const toothSlider = this.container.querySelector('#tooth-slider');
    const toothVal = this.container.querySelector('#tooth-val');
    if (toothSlider) {
      toothSlider.value = this.engine.paperTooth;
      toothVal.textContent = this.engine.paperTooth.toFixed(2);
    }

    const colorVal = this.container.querySelector('#ink-color-val');
    const colorPicker = this.container.querySelector('#ink-color-picker');
    if (colorVal) colorVal.textContent = this.engine.color;
    if (colorPicker) {
      colorPicker.value = (this.engine.color === '#050505' || this.engine.color === '#000000') ? '#191817' : this.engine.color;
    }

    const blendModeSelect = this.container.querySelector('#blend-mode-select');
    const overprintStatusPill = this.container.querySelector('#overprint-status-pill');
    const isMultiply = this.engine.blendMode === 'multiply';
    if (blendModeSelect) {
      blendModeSelect.value = this.engine.blendMode;
    }
    const modelSelect = this.container.querySelector('#overprint-model-select');
    if (modelSelect) modelSelect.value = this.engine.overprintModel;
    if (overprintStatusPill) {
      overprintStatusPill.textContent = isMultiply ? 'ON' : 'OFF';
      overprintStatusPill.style.color = isMultiply ? '#38bdf8' : '#94a3b8';
    }
    const paperVal = this.container.querySelector('#paper-color-val');
    if (paperVal) paperVal.textContent = this.engine.paperColor;
    const paperPicker = this.container.querySelector('#paper-color-picker');
    if (paperPicker) paperPicker.value = this.engine.paperColor;
    const viewport = document.getElementById('canvas-viewport');
    if (viewport) viewport.style.backgroundColor = this.engine.paperColor;

    // the mix model's own settings (approach, exit, reach) mean nothing in 'classic'
    const mixOnly = new Set(['overprintAttack', 'overprintRelease', 'overprintReach']);
    for (const d of OVERPRINT_SLIDERS) {
      const row = this.container.querySelector(`#${d.id}-row`);
      const slider = this.container.querySelector(`#${d.id}-slider`);
      const val = this.container.querySelector(`#${d.id}-val`);
      const v = this._overprintValue(d.key);
      if (slider) slider.value = v;
      if (val) val.textContent = d.fmt(v);
      if (row) row.style.opacity = isMultiply && (this.engine.overprintModel === 'mix' || !mixOnly.has(d.key)) ? '1.0' : '0.45';
    }

    // 4. Chinese Brush Sliders
    const cb = this.engine.instruments.chinese_brush;
    const eSlider = this.container.querySelector('#engorge-slider');
    const eVal = this.container.querySelector('#engorge-val');
    if (eSlider) {
      eSlider.value = cb.slowEngorgeRatio;
      eVal.textContent = `${cb.slowEngorgeRatio.toFixed(2)}x`;
    }

    const tSlider = this.container.querySelector('#thin-slider');
    const tVal = this.container.querySelector('#thin-val');
    if (tSlider) {
      tSlider.value = cb.fastThinRatio;
      tVal.textContent = `${Math.round(cb.fastThinRatio * 100)}%`;
    }

    const dSlider = this.container.querySelector('#depletion-slider');
    const dVal = this.container.querySelector('#depletion-val');
    if (dSlider) {
      dSlider.value = cb.depletionRate;
      dVal.textContent = cb.depletionRate.toFixed(2);
    }

    const easeInSlider = this.container.querySelector('#ease-in-slider');
    const easeInVal = this.container.querySelector('#ease-in-val');
    if (easeInSlider) {
      easeInSlider.value = cb.starveEaseIn;
      easeInVal.textContent = `${Math.round(cb.starveEaseIn)} px`;
    }

    const refSlider = this.container.querySelector('#refill-slider');
    const refVal = this.container.querySelector('#refill-val');
    if (refSlider) {
      refSlider.value = cb.refillRate;
      refVal.textContent = cb.refillRate.toFixed(2);
    }

    const easeOutSlider = this.container.querySelector('#ease-out-slider');
    const easeOutVal = this.container.querySelector('#ease-out-val');
    if (easeOutSlider) {
      easeOutSlider.value = cb.starveEaseOut;
      easeOutVal.textContent = `${Math.round(cb.starveEaseOut)} px`;
    }

    const brSlider = this.container.querySelector('#bristles-slider');
    const brVal = this.container.querySelector('#bristles-val');
    if (brSlider) {
      brSlider.value = cb.numBristles;
      brVal.textContent = cb.numBristles;
    }

    const flSlider = this.container.querySelector('#flare-slider');
    const flVal = this.container.querySelector('#flare-val');
    if (flSlider) {
      flSlider.value = cb.boneHeadFlare;
      flVal.textContent = `${cb.boneHeadFlare.toFixed(2)}x`;
    }

    // 5. Posca Squeezer Sliders
    const ps = this.engine.instruments.posca_squeezer;
    const waistSlider = this.container.querySelector('#waist-slider');
    const waistVal = this.container.querySelector('#waist-val');
    if (waistSlider) {
      waistSlider.value = ps.fastWaistRatio;
      waistVal.textContent = `${Math.round(ps.fastWaistRatio * 100)}%`;
    }

    const borderStarveSlider = this.container.querySelector('#border-starve-slider');
    const borderStarveVal = this.container.querySelector('#border-starve-val');
    if (borderStarveSlider) {
      borderStarveSlider.value = ps.borderStarveSensitivity;
      borderStarveVal.textContent = ps.borderStarveSensitivity.toFixed(2);
    }

    const domeFlareSlider = this.container.querySelector('#dome-flare-slider');
    const domeFlareVal = this.container.querySelector('#dome-flare-val');
    if (domeFlareSlider) {
      domeFlareSlider.value = ps.initialDomeFlare;
      domeFlareVal.textContent = `${ps.initialDomeFlare.toFixed(2)}x`;
    }

    const dripThreshSlider = this.container.querySelector('#drip-thresh-slider');
    const dripThreshVal = this.container.querySelector('#drip-thresh-val');
    if (dripThreshSlider) {
      dripThreshSlider.value = ps.dripThreshold;
      dripThreshVal.textContent = ps.dripThreshold.toFixed(2);
    }

    const flowSlider = this.container.querySelector('#flow-slider');
    const flowVal = this.container.querySelector('#flow-val');
    if (flowSlider) {
      flowSlider.value = ps.flowRate;
      flowVal.textContent = ps.flowRate.toFixed(2);
    }

    const viscositySlider = this.container.querySelector('#viscosity-slider');
    const viscosityVal = this.container.querySelector('#viscosity-val');
    if (viscositySlider) {
      viscositySlider.value = ps.viscosity;
      viscosityVal.textContent = ps.viscosity.toFixed(2);
    }

    const dripRatioSlider = this.container.querySelector('#drip-width-ratio-slider');
    const dripRatioVal = this.container.querySelector('#drip-width-ratio-val');
    if (dripRatioSlider) {
      dripRatioSlider.value = ps.dripWidthRatio;
      dripRatioVal.textContent = `${Math.round(ps.dripWidthRatio * 100)}% (${(ps.effectiveRadius * 2 * ps.dripWidthRatio).toFixed(1)} px)`;
    }

    // 6. Curved Ruling Pen Sliders
    const rc = this.engine.instruments.ruling_pen_curved;
    if (rc) {
      const cMode = this.container.querySelector('#curved-mode-select');
      if (cMode) cMode.value = rc.penMode;

      const cAngle = this.container.querySelector('#curved-angle-slider');
      const cAngleVal = this.container.querySelector('#curved-angle-val');
      if (cAngle) {
        cAngle.value = Math.round(rc.bladeAngle * 180 / Math.PI);
        cAngleVal.textContent = `${Math.round(rc.bladeAngle * 180 / Math.PI)}°`;
      }

      const cChatter = this.container.querySelector('#curved-chatter-slider');
      const cChatterVal = this.container.querySelector('#curved-chatter-val');
      if (cChatter) {
        cChatter.value = rc.chatterIntensity;
        cChatterVal.textContent = `${rc.chatterIntensity.toFixed(2)}x`;
      }

      const cSkip = this.container.querySelector('#curved-skip-slider');
      const cSkipVal = this.container.querySelector('#curved-skip-val');
      if (cSkip) {
        cSkip.value = rc.skipSensitivity;
        cSkipVal.textContent = rc.skipSensitivity.toFixed(2);
      }

      const cSnap = this.container.querySelector('#curved-snap-slider');
      const cSnapVal = this.container.querySelector('#curved-snap-val');
      if (cSnap) {
        cSnap.value = rc.snapIntensity;
        cSnapVal.textContent = rc.snapIntensity.toFixed(2);
      }

      const cMinWidth = this.container.querySelector('#curved-min-width-slider');
      const cMinWidthVal = this.container.querySelector('#curved-min-width-val');
      if (cMinWidth) {
        cMinWidth.value = rc.minWidthScale;
        cMinWidthVal.textContent = `${rc.minWidthScale.toFixed(2)}x`;
      }

      const cMaxWidth = this.container.querySelector('#curved-max-width-slider');
      const cMaxWidthVal = this.container.querySelector('#curved-max-width-val');
      if (cMaxWidth) {
        cMaxWidth.value = rc.maxWidthScale;
        cMaxWidthVal.textContent = `${rc.maxWidthScale.toFixed(2)}x`;
      }

      const cBurst = this.container.querySelector('#curved-burst-width-slider');
      const cBurstVal = this.container.querySelector('#curved-burst-width-val');
      if (cBurst) {
        cBurst.value = rc.burstExplosionWidth;
        cBurstVal.textContent = `${rc.burstExplosionWidth.toFixed(2)}x`;
      }

      const cMinSpit = this.container.querySelector('#curved-min-spit-slider');
      const cMinSpitVal = this.container.querySelector('#curved-min-spit-val');
      if (cMinSpit) {
        cMinSpit.value = rc.minSpitCount;
        cMinSpitVal.textContent = rc.minSpitCount;
      }

      const cMaxSpit = this.container.querySelector('#curved-max-spit-slider');
      const cMaxSpitVal = this.container.querySelector('#curved-max-spit-val');
      if (cMaxSpit) {
        cMaxSpit.value = rc.maxSpitCount;
        cMaxSpitVal.textContent = rc.maxSpitCount;
      }

      const cDropSize = this.container.querySelector('#curved-droplet-size-slider');
      const cDropSizeVal = this.container.querySelector('#curved-droplet-size-val');
      if (cDropSize) {
        cDropSize.value = rc.maxDropletSize;
        cDropSizeVal.textContent = `${rc.maxDropletSize.toFixed(1)} px`;
      }
    }

    // 7. Flat Ruling Pen Sliders
    const rf = this.engine.instruments.ruling_pen_flat;
    if (rf) {
      const fMode = this.container.querySelector('#flat-mode-select');
      if (fMode) fMode.value = rf.penMode;

      const fAngle = this.container.querySelector('#flat-angle-slider');
      const fAngleVal = this.container.querySelector('#flat-angle-val');
      if (fAngle) {
        fAngle.value = Math.round(rf.bladeAngle * 180 / Math.PI);
        fAngleVal.textContent = `${Math.round(rf.bladeAngle * 180 / Math.PI)}°`;
      }

      const fAsymm = this.container.querySelector('#flat-asymm-slider');
      const fAsymmVal = this.container.querySelector('#flat-asymm-val');
      if (fAsymm) {
        fAsymm.value = rf.edgeAsymmetry;
        fAsymmVal.textContent = `${Math.round(rf.edgeAsymmetry * 100)}%`;
      }

      const fSide = this.container.querySelector('#flat-side-select');
      if (fSide) fSide.value = rf.asymmetrySide;

      const fChatter = this.container.querySelector('#flat-chatter-slider');
      const fChatterVal = this.container.querySelector('#flat-chatter-val');
      if (fChatter) {
        fChatter.value = rf.chatterIntensity;
        fChatterVal.textContent = `${rf.chatterIntensity.toFixed(2)}x`;
      }

      const fSkip = this.container.querySelector('#flat-skip-slider');
      const fSkipVal = this.container.querySelector('#flat-skip-val');
      if (fSkip) {
        fSkip.value = rf.skipSensitivity;
        fSkipVal.textContent = rf.skipSensitivity.toFixed(2);
      }

      const fSnap = this.container.querySelector('#flat-snap-slider');
      const fSnapVal = this.container.querySelector('#flat-snap-val');
      if (fSnap) {
        fSnap.value = rf.snapIntensity;
        fSnapVal.textContent = rf.snapIntensity.toFixed(2);
      }

      const fMinWidth = this.container.querySelector('#flat-min-width-slider');
      const fMinWidthVal = this.container.querySelector('#flat-min-width-val');
      if (fMinWidth) {
        fMinWidth.value = rf.minWidthScale;
        fMinWidthVal.textContent = `${rf.minWidthScale.toFixed(2)}x`;
      }

      const fMaxWidth = this.container.querySelector('#flat-max-width-slider');
      const fMaxWidthVal = this.container.querySelector('#flat-max-width-val');
      if (fMaxWidth) {
        fMaxWidth.value = rf.maxWidthScale;
        fMaxWidthVal.textContent = `${rf.maxWidthScale.toFixed(2)}x`;
      }

      const fBurst = this.container.querySelector('#flat-burst-width-slider');
      const fBurstVal = this.container.querySelector('#flat-burst-width-val');
      if (fBurst) {
        fBurst.value = rf.burstExplosionWidth;
        fBurstVal.textContent = `${rf.burstExplosionWidth.toFixed(2)}x`;
      }

      const fMinSpit = this.container.querySelector('#flat-min-spit-slider');
      const fMinSpitVal = this.container.querySelector('#flat-min-spit-val');
      if (fMinSpit) {
        fMinSpit.value = rf.minSpitCount;
        fMinSpitVal.textContent = rf.minSpitCount;
      }

      const fMaxSpit = this.container.querySelector('#flat-max-spit-slider');
      const fMaxSpitVal = this.container.querySelector('#flat-max-spit-val');
      if (fMaxSpit) {
        fMaxSpit.value = rf.maxSpitCount;
        fMaxSpitVal.textContent = rf.maxSpitCount;
      }

      const fDropSize = this.container.querySelector('#flat-droplet-size-slider');
      const fDropSizeVal = this.container.querySelector('#flat-droplet-size-val');
      if (fDropSize) {
        fDropSize.value = rf.maxDropletSize;
        fDropSizeVal.textContent = `${rf.maxDropletSize.toFixed(1)} px`;
      }
    }

    // 8. Update Copyable Snippet
    this._updateSnippet();
  }

  // ── My Presets (v4.0) ─────────────────────────────────────────────────────

  _say(text) {
    const m = this.container.querySelector('#user-preset-msg');
    if (m) m.textContent = text;
  }

  // the current pen as a user preset: its instrument, the core preset it came from, every value (and the ink's mixing)
  _snapshot() {
    const id = this.engine.activeInstrumentId;
    const { presetId, baseRadius, ...rest } = this.engine.exportInstrumentSettings(id) || {};
    const settings = { ...rest, radius: baseRadius, paperTooth: this.engine.paperTooth };
    for (const k of ['overprintModel', 'blendMode', 'inkDensity', 'overprintDarken', 'overprintAttack', 'overprintRelease', 'overprintReach']) settings[k] = this.engine[k];
    return { tool: id, basePreset: isCorePreset(presetId) ? presetId : null, settings: validateInkSettings(settings).settings };
  }

  _applyUserPreset(p) {
    const cfg = presetToConfig(p);
    if (!cfg) return;
    if (cfg.preset) this.engine.setPreset(cfg.preset);
    else this.engine.setInstrument(cfg.tool);
    const inst = this.engine.activeInstrument;
    const { settings } = validateInkSettings(cfg);
    // the instrument's own values, through its setters where it has them
    for (const [k, v] of Object.entries(settings)) {
      if (k === 'numBristles') { inst.numBristles = v; if (inst._initBristles) inst._initBristles(); continue; }
      const setter = 'set' + k[0].toUpperCase() + k.slice(1);
      if (['tool', 'preset', 'radius', 'paperTooth', 'overprintSwell', 'overprintModel', 'blendMode', 'inkDensity', 'overprintDarken', 'overprintAttack', 'overprintRelease', 'overprintReach', 'paperColor', 'color', 'thickness'].includes(k)) continue;
      if (typeof inst[setter] === 'function') inst[setter](v);
      else if (k in inst) inst[k] = v;
    }
    if (settings.radius !== undefined) this.engine.setNibRadius(settings.radius);
    if (settings.paperTooth !== undefined) this.engine.setPaperTooth(settings.paperTooth);
    const op = {};
    for (const k of ['overprintModel', 'blendMode', 'inkDensity', 'overprintDarken', 'overprintAttack', 'overprintRelease', 'overprintReach']) if (settings[k] !== undefined) op[k] = settings[k];
    this.engine.setOverprint(op);
    if (settings.overprintSwell !== undefined) this.engine.setOverprintSwell(settings.overprintSwell);
    this.selectedUserPreset = p.id;
    const us = this.container.querySelector('#user-preset-select');
    if (us) us.value = p.id;
    const nm = this.container.querySelector('#user-preset-name');
    if (nm) nm.value = p.name;
    const pd = this.container.querySelector('#preset-desc');
    if (pd) pd.textContent = (p.notes ? p.notes + ' — ' : '') + 'My preset, from ' + (p.basePreset ? (CORE_PRESETS.find((c) => c.id === p.basePreset) || {}).name : p.tool) + '.';
    this._syncSliders();
    const ps = this.container.querySelector('#preset-select');
    if (ps) ps.value = p.id;
    this._saveToLocalStorage();
    this._say('Applied “' + p.name + '”.');
  }

  async _refreshUserPresets() {
    try {
      this.userPresets = await this.presetStore.list();
    } catch (e) {
      this.userPresets = [];
      this._say('Could not read the presets: ' + (e.message || e));
    }
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const opts = this.userPresets.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} · ${esc((CORE_PRESETS.find((c) => c.id === p.basePreset) || { toolName: p.tool }).toolName)}</option>`).join('');
    const us = this.container.querySelector('#user-preset-select');
    if (us) {
      us.innerHTML = this.userPresets.length ? '<option value="">— choose one of my presets —</option>' + opts : '<option value="">— none saved yet —</option>';
      if (this.selectedUserPreset && this.userPresets.some((p) => p.id === this.selectedUserPreset)) us.value = this.selectedUserPreset;
    }
    const grp = this.container.querySelector('#preset-user-group');
    if (grp) grp.innerHTML = opts;
    const n = this.container.querySelector('#user-presets-count');
    if (n) n.textContent = String(this.userPresets.length);
  }

  _bindUserPresets() {
    const q = (sel) => this.container.querySelector(sel);
    const nameIn = q('#user-preset-name');
    const sel = q('#user-preset-select');
    const run = async (fn, okText) => {
      try {
        const r = await fn();
        await this._refreshUserPresets();
        if (okText) this._say(typeof okText === 'function' ? okText(r) : okText);
      } catch (e) {
        this._say(e && e.message ? e.message : String(e));
      }
    };
    if (sel) sel.addEventListener('change', () => {
      const p = this.userPresets.find((u) => u.id === sel.value);
      if (p) this._applyUserPreset(p);
    });
    q('#btn-preset-save').addEventListener('click', () => run(async () => {
      const base = CORE_PRESETS.find((c) => c.id === this.engine.activeInstrument.activePresetId);
      const name = (nameIn && nameIn.value.trim()) || ((base ? base.name.replace(/^\d+\.\s*/, '') : 'My pen') + ' — mine');
      const p = await this.presetStore.create({ name, ...this._snapshot() });
      this.selectedUserPreset = p.id;
      if (nameIn) nameIn.value = p.name;
      return p;
    }, (p) => 'Saved “' + p.name + '”.'));
    q('#btn-preset-update').addEventListener('click', () => run(async () => {
      if (!this.selectedUserPreset) throw new Error('Choose one of my presets first.');
      return this.presetStore.update(this.selectedUserPreset, this._snapshot());
    }, (p) => 'Updated “' + p.name + '” with the current pen.'));
    q('#btn-preset-rename').addEventListener('click', () => run(async () => {
      if (!this.selectedUserPreset) throw new Error('Choose one of my presets first.');
      const name = nameIn ? nameIn.value.trim() : '';
      if (!name) throw new Error('Type the new name above.');
      return this.presetStore.update(this.selectedUserPreset, { name });
    }, (p) => 'Renamed to “' + p.name + '”.'));
    let armed = 0;
    q('#btn-preset-delete').addEventListener('click', (e) => {
      if (!this.selectedUserPreset) { this._say('Choose one of my presets first.'); return; }
      const btn = e.currentTarget;
      if (Date.now() - armed > 3000) {
        armed = Date.now();
        btn.textContent = 'Delete? Click again';
        setTimeout(() => { btn.textContent = 'Delete'; }, 3000);
        return;
      }
      armed = 0;
      btn.textContent = 'Delete';
      const id = this.selectedUserPreset;
      run(async () => { await this.presetStore.remove(id); this.selectedUserPreset = null; if (nameIn) nameIn.value = ''; }, 'Deleted.');
    });
    q('#btn-preset-export').addEventListener('click', () => run(async () => {
      const blob = new Blob([await this.presetStore.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'inkdynamics-presets.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'Exported.'));
    const file = q('#user-preset-file');
    q('#btn-preset-import').addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      file.value = '';
      if (!f) return;
      run(async () => this.presetStore.importJSON(await f.text()), (n) => 'Imported ' + n + ' preset' + (n === 1 ? '' : 's') + '.');
    });
    // where the presets are kept
    const storage = q('#user-preset-storage');
    const server = q('#user-preset-server');
    storage.addEventListener('change', () => {
      server.classList.toggle('hidden', storage.value !== 'server');
      if (storage.value === 'local') {
        this.presetStore = new UserPresetStore({ adapter: localStorageAdapter('inkdynamics.userPresets.v1') });
        run(async () => {}, 'Presets kept in this browser.');
      }
    });
    try { const t = sessionStorage.getItem('inkdynamics.presets.token'); if (t) q('#user-preset-token').value = t; } catch (_) { /* private mode */ }
    q('#btn-preset-connect').addEventListener('click', () => run(async () => {
      const endpoint = q('#user-preset-endpoint').value.trim();
      const token = q('#user-preset-token').value;
      try { sessionStorage.setItem('inkdynamics.presets.token', token); } catch (_) { /* private mode */ }
      this.presetStore = new UserPresetStore({ adapter: httpAdapter({ endpoint, token: token || null }) });
      return this.presetStore.refresh();
    }, (l) => 'Connected: ' + l.length + ' preset' + (l.length === 1 ? '' : 's') + ' on the server.'));
  }

  _updateSnippet() {
    const snippetInput = this.container.querySelector('#snippet-input');
    if (!snippetInput) return;

    const instId = this.engine.activeInstrumentId;
    const activeInst = this.engine.activeInstrument;
    if (!activeInst) return;

    // 4.0: every value of the pen — what createInkDynamics() and setConfig() now apply in full
    const r2 = (v) => (typeof v === 'number' ? Number(v.toFixed(3)) : v);
    const { presetId, baseRadius, ...params } = this.engine.exportInstrumentSettings(instId) || {};
    const config = {
      tool: instId,
      preset: presetId || activeInst.activePresetId || 'default',
      color: this.engine.color || '#191817',
      thickness: r2(baseRadius ?? activeInst.baseRadius),
      paperTooth: r2(this.engine.paperTooth),
      overprintModel: this.engine.overprintModel,
      blendMode: this.engine.blendMode || 'multiply',
      inkDensity: r2(this.engine.inkDensity),
      overprintDarken: r2(this.engine.overprintDarken),
      overprintAttack: r2(this.engine.overprintAttack),
      overprintRelease: r2(this.engine.overprintRelease),
      overprintReach: r2(this.engine.overprintReach),
      paperColor: this.engine.paperColor,
    };
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) config[k] = r2(v);

    if (this.snippetMode === 'config') {
      snippetInput.value = 'ink.setConfig(' + JSON.stringify(config, null, 2) + ');';
    } else {
      snippetInput.value = formatInkSettings(config, { call: true });
    }
  }

  _saveToLocalStorage() {
    try {
      const data = this.engine.exportSettings();
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (err) {
      console.warn('[InkDynamics] Failed to persist settings to localStorage:', err);
    }
  }

  _loadFromLocalStorage() {
    try {
      let raw = localStorage.getItem(this.storageKey);
      let legacy = false;
      if (!raw) {
        // Fallback to the 3.x / v2 keys (their instrument values; the ink's overprint starts at the 4.0 defaults)
        for (const k of this.legacyStorageKeys) {
          raw = localStorage.getItem(k);
          if (raw) { legacy = true; break; }
        }
      }
      if (!raw) return false;

      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        if (legacy) for (const k of ['blendMode', 'inkDensity', 'overprintDarken', 'overprintSwell']) delete data[k];
        this.engine.applySettings(data);
        this._syncSliders();
        return true;
      }
    } catch (err) {
      console.warn('[InkDynamics] Failed to load settings from localStorage:', err);
    }
    return false;
  }
}
