# InkDynamics

> **Physical Fluid Dynamics, Mechanical Friction & Expressive Calligraphic Marks for HTML5 Canvas**  
> Conceived and developed as the physical drawing engine of the **Inkwell** prototype within the **SiX Research Project: «Drawing for Social Re-connectivity»**  
> **Faculty of Fine Arts, University of Porto (FBAUP) · Research Institute in Art, Design and Society (i2ADS)**  
>
> **Principal Investigator:** Eliana Penedos-Santiago (ID+ / FBAUP)  
> **Concept, Design & Architecture:** Pedro Amado (FBAUP / i2ADS)  
> **Development:** Pedro Amado with AI assistance from Google Gemini (Gemini 3.8 Flash in Antigravity) & Anthropic Claude (Claude Opus 5.5)  
> **Version:** 4.0.0 · **License:** MIT  
> **Funded by FCT** — Fundação para a Ciência e a Tecnologia [Project 2023.11224.PEX · DOI: [10.54499/2023.11224.PEX](https://doi.org/10.54499/2023.11224.PEX)]

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)
[![ES6 Modules](https://img.shields.io/badge/ESM-compatible-orange.svg)](js/inkdynamics.js)
[![Performance: 60 FPS](https://img.shields.io/badge/performance-60%20FPS%20Canvas2D-purple.svg)](index.html)
[![Tests Passing](https://img.shields.io/badge/tests-84%20checks%20passing-success.svg)](test_v4.js)
[![SiX Research Project](https://img.shields.io/badge/SiX-six.fba.up.pt-indigo.svg)](https://six.fba.up.pt/)
[![DOI](https://img.shields.io/badge/DOI-10.54499%2F2023.11224.PEX-blue.svg)](https://doi.org/10.54499/2023.11224.PEX)

---

## 🌐 Live Interactive Demos & Lab Specimens

Experience the physics directly in your browser (no build steps required):

- 🧪 **[Physical Calibration Lab (`index.html`)](https://pedamado.github.io/inkdynamics/)** — Full interactive playground with real-time physics sliders, telemetry HUD, photographic calibration overlays, and live 1-line code snippet generator.
- 📐 **[Design Handoff & Specification (`design_handoff.html`)](https://pedamado.github.io/inkdynamics/design_handoff.html)** — Comprehensive publication-grade reference with macro photography, mathematical formulas, calibration tables, and interactive sandboxes.
- ✒️ **[Ruling Pen Specimen Lab (`specimen_ruling_pens.html`)](https://pedamado.github.io/inkdynamics/specimen_ruling_pens.html)** — Diagnostic suite for blade angle, bilateral chatter, train-track skips, and directional spit showers.
- 🎨 **[Ink Mixing & Overprint Lab (`specimen_ink_blending.html`)](https://pedamado.github.io/inkdynamics/specimen_ink_blending.html)** — Interactive laboratory for v4.0 translucent ink layering, chromatic multiply mixing, envelope attack/release, and capillary crossing swell.

*(Replace `pedamado` with your GitHub username or organization once deployed to GitHub Pages).*

---

## 🎨 Overview

**InkDynamics** is a lightweight, zero-dependency JavaScript library that simulates the microscopic fluid dynamics, mechanical friction, and organic accidents of real physical drawing instruments on paper.

Traditional digital drawing apps render sterile, uniform ribbons or plastic Bézier splines. **InkDynamics** models the authentic physics of:

1. **Capillary Starvation & Dry-Brush Splitting** in flexible animal-hair Chinese calligraphy brushes;
2. **Pressurized Fluid Flow, Velocity Waisting, & Gravity Drip Cascades** in Posca mop squeezer street markers;
3. **Bilateral Soundwave Edge Chatter, "Train-Track" Skipping, & Clapping Spit Bursts** in Curved Ruling / Folded Cola pens;
4. **Extreme Edge Asymmetry, Comb-Teeth Flaring (up to 3× width), & Directional Spit Showers** in German Expressionist Flat Ruling pens;
5. **Physical Ink Overprinting & Mixing (v4.0):** Inks lay with authentic slight translucency (97% density — allowing substrate and prior strokes to show through), organically multiply-mixing at stroke intersections with distance-based attack/release envelopes and capillary crossing micro-swell (5–10% calibrated per instrument).

```
       CHINESE BRUSH                 POSCA MOP SQUEEZER              CURVED RULING PEN               FLAT RULING PEN
    [Capillary Starvation]         [Opaque Core + Drips]         [Soundwave Edge Ripples]      [Asymmetric Comb Teeth]
            ▲                              ╭───╮                           /|                          ┌────────┐
           / \                            (     )                         / |                          │        │
          | | |                             │                            | = |                         │ ▓▓▓▓▓▓ │ (up to 3x)
          |   |                             │                             \ /                          └────────┘
           \ /                              ▼                            * ✹ *                            ✹ ✹ ✹
```

---

## 🚀 Dual Application Purpose

### 1. Assistive Art & Eye-Gaze Drawing (**Inkwell Prototype**)
Conceived and developed for **Inkwell** within the **SiX Research Project** (*«Drawing for Social Re-connectivity»*), where artists with severe motor impairments (such as Amyotrophic Lateral Sclerosis / ALS / ELA or Locked-In Syndrome) draw using eye gaze dwell, head tracking, or switch interfaces.

Because gaze-tracking users cannot modulate a pressure-sensitive stylus, **InkDynamics** embeds kinematic intelligence directly into the stroke:
- **Hesitation & Dwell:** When gaze lingers, ink pools naturally into an engorged reservoir or cascades downward as a gravity drip.
- **Velocity & Saccades:** Rapid eye sweeps starve the nib of fluid, producing dry-brush striated tracks (*fei bai* / flying white) or acoustic friction skips.
- **Organic Life:** The line breathes with physical mass, velocity, and fluid inertia rather than computer-drawn perfection.

### 2. Standalone Creative Lines & Generative Art Library
Packaged as an independent, modular ES6 library for creative coders, generative artists, web drawing applications, digital whiteboards, and educators who want expressive physical marks in any HTML5 canvas with a single line of code.

---

## 🖋️ The Four Calibrated Physical Instruments

| Instrument | Physical Mechanism | Calibrated Presets | Crossing Swell | Key Expressive Traits |
| :--- | :--- | :--- | :---: | :--- |
| **Zig Chinese Calligraphy Brush** (`chinese_brush`) | Multi-bristle capillary dispersion, elastic flex, Sumi ink depletion | `fine_low_var`<br>`fine_thick_high_contrast`<br>`medium_high_dynamic`<br>`medium_uniform_starvation` | **7.5%** | Asymmetric tibia "bone-head" touchdown contacts; longitudinal bristle splitting; speed-dependent starvation (*fei bai*); organic flick release. |
| **Posca Mop Squeezer** (`posca_squeezer`) | Heavy-body thixotropic acrylic flow, felt dome compression, gravity drips | `posca_squeezer_thin` (12mm)<br>`posca_squeezer_medium` (24mm)<br>`posca_squeezer_thick` (44mm) | **10.0%** | Saturated opaque core; spherical dome contacts; subtle velocity waisting (monoline tagger feel); continuous fluid drip cascades without artificial terminal dots. |
| **Curved Ruling / Folded Cola Pen** (`ruling_pen_curved`) | Dual-leaf metal blade friction, paper tooth catching, fluid reservoir snap | `curved_ruling_fine`<br>`curved_ruling_medium`<br>`curved_ruling_broad` | **5.0%** | Dual modes (hairline *Point Mode* vs expressive *Blade Mode*); angled elliptical touchdown; bilateral soundwave edge ripples; train-track skips; volcano-like pressure release with catenary decay; teardrop spit bursts pointing back to origin. |
| **Flat Ruling / Chisel Pen** (`ruling_pen_flat`) | Asymmetrical German Expressionist steel blade, directional paper shear | `flat_ruling_point`<br>`flat_ruling_medium`<br>`flat_ruling_broad` | **5.0%** | Extreme edge asymmetry (one razor-sharp border vs one violent comb-tooth border flaring up to 3× width); transverse chisel stripes; one-sided directional spit explosions. |

---

## 🔬 Version 4.0 Physical Ink Mechanics

### Authentic Translucency & Overprinting (`OverprintBlender`)
Real ink is never 100% digitally opaque. In v4.0:
- **`inkDensity` (default `0.97`):** Every mark allows ~3% of the underlying paper substrate (`paperColor`) or prior strokes to breathe through. On Munken paper (`#F4F1EA`), black reads as rich `#070707`; on white paper, `#080808`.
- **Sub-step Uniformity:** The blending math avoids internal stroke overlap banding—a continuous stroke remains perfectly even, while intersecting strokes overprint.
- **Chromatic Multiply Mixing:** Where strokes intersect, pigments blend optically toward `C × U / 255`. Black crosses slightly blacker (`#000000`), white over black turns translucent grey, yellow over cyan turns deep green, and red over yellow produces vibrant orange.

### Distance-Based Envelope & Capillary Micro-Swell
- **`overprintAttack` (default `0.85`):** Rapid onset—the mix engages within a fraction of the nib radius when encountering existing ink.
- **`overprintRelease` (default `0.55`):** Pigment carryover—the nib picks up wet ink from previous strokes and carries it forward over 2–3 nib radii before restoring baseline color.
- **Calibrated Crossing Swell:** Capillary action pulls extra fluid into existing wet channels. Ruling pen drawing ink swells **5%**, Chinese Sumi ink swells **7.5%**, and viscous Posca acrylic pools **10%**.

---

## 📦 Quickstart & Usage

### 1. Simple 1-Line Instantiation (ES Module)

```javascript
import { createInkDynamics } from './js/inkdynamics.js';

// Initialize engine on an existing canvas
const ink = createInkDynamics({
  canvas: document.getElementById('drawingCanvas'),
  tool: 'ruling_pen_curved',        // 'chinese_brush' | 'posca_squeezer' | 'ruling_pen_curved' | 'ruling_pen_flat'
  preset: 'curved_ruling_medium',   // Preset ID
  color: '#191817',                 // Hex color or token ('black', 'red', 'blue', 'white')
  thickness: 7.0,                   // Pixel radius or token ('hairline', 'thin', 'medium', 'thick')
  paperTooth: 0.45,                 // Paper friction texture [0.0 - 1.0]
  
  // v4.0 Physical Ink Overprint & Mixing
  overprintModel: 'mix',            // 'mix' (translucent blending) or 'classic'
  blendMode: 'multiply',            // Multiply overprint at crossings
  inkDensity: 0.97,                 // 97% ink density (3% substrate bleed-through)
  overprintDarken: 0.45,            // Crossing mix intensity [0.0 - 1.0]
  paperColor: '#FFFFFF',            // Substrate color
});

// Drive the pen with pointer, mouse, touch, or eye-gaze coordinates
canvas.addEventListener('pointerdown', (e) => ink.penDown(e.offsetX, e.offsetY, e.pressure || 0.5));
canvas.addEventListener('pointermove', (e) => ink.penMove(e.offsetX, e.offsetY, null, e.pressure || 0.5));
canvas.addEventListener('pointerup',   (e) => ink.penUp(e.offsetX, e.offsetY));
```

### 2. Standalone HTML Script Tag / CDN

```html
<canvas id="paintCanvas" width="1200" height="800"></canvas>

<script type="module">
  import { createInkDynamics } from 'https://cdn.jsdelivr.net/gh/pedamado/inkdynamics@4.0.0/js/inkdynamics.js';
  
  const canvas = document.getElementById('paintCanvas');
  const ink = createInkDynamics({ canvas, tool: 'posca_squeezer', preset: 'posca_squeezer_medium' });
  
  window.ink = ink; // Accessible in console
</script>
```

---

## 🤖 Multi-Agent (Boids) Autonomous Swarm Drawing

InkDynamics natively isolates kinematics across multiple parallel channels without memory corruption or cross-talk:

```javascript
// Gaze Channel (User: agentId = 0)
ink.penDown(gazeX, gazeY, 0.5, timestamp, 0);
ink.penMove(gazeX, gazeY, dt, 0.5, timestamp, 0);

// Autonomous Boid Swarm Agent 1 (agentId = 1)
ink.setAgentPen(1, { tool: 'posca_squeezer', color: '#E60000', thickness: 6 });
ink.penDown(boid1.x, boid1.y, 0.5, timestamp, 1);
ink.penMove(boid1.x, boid1.y, dt, 0.5, timestamp, 1);

// Autonomous Boid Swarm Agent 2 (agentId = 2)
ink.setAgentPen(2, { preset: 'curved_ruling_fine', color: '#0055AA' });
ink.penDown(boid2.x, boid2.y, 0.5, timestamp, 2);
ink.penMove(boid2.x, boid2.y, dt, 0.5, timestamp, 2);
```

Every agent maintains private velocity trackers, capillary reservoirs, and bristle states while drawing onto a **shared overprint grid**, allowing agent marks to organically mix and pool where their paths cross.

---

## 💾 User Presets & Sync Architecture

- **13 Permanent Core Presets:** Deep-frozen in `PresetCatalog.js` to guarantee scientific reproducibility.
- **`UserPresetStore`:** Create, update, rename, delete, export, and import custom tunings.
- **Storage Adapters:**
  - `localStorageAdapter()`: Default in-browser persistence.
  - `memoryAdapter()`: Ephemeral in-memory store for unit tests or headless rendering.
  - `httpAdapter({ endpoint, token })`: Syncs presets with the included lightweight PHP reference backend (`server/presets.php`).

```javascript
import { UserPresetStore, localStorageAdapter, listPresets } from './js/inkdynamics.js';

const store = new UserPresetStore({ adapter: localStorageAdapter() });
const myCustomPen = await store.create({ 
  name: 'Velvet Chinese Brush', 
  ...ink.presetSnapshot() 
});

ink.applyPreset(myCustomPen);
```

---

## 🛠️ Complete API Reference

### Factory Function
- `createInkDynamics(options)` → Returns configured `InkDynamicsInstance`.
  - `canvas`: `HTMLCanvasElement` (required or created).
  - `tool`: `'chinese_brush'` | `'posca_squeezer'` | `'ruling_pen_curved'` | `'ruling_pen_flat'`.
  - `preset`: ID string of core or user preset.
  - `thickness`: Number (px) or Token (`'hairline'`, `'thin'`, `'medium'`, `'thick'`, `'broad'`).
  - `color`: Hex color or Token (`'black'`, `'red'`, `'blue'`, `'white'`).
  - `paperTooth`: Number `0.0` (ultra-smooth) to `1.0` (rough cold-press).
  - `dripWidthRatio`: Drip width relative to dome (Posca, default `0.32`).
  - `autoStep`: Boolean. Runs internal `requestAnimationFrame` loop for gravity drips (default `true`).
  - `onMark`: Callback `(markEvent) => {}` for networking, serialization, or assistive recording.
  - `onTelemetry`: Callback `(metrics) => {}` for live performance/kinematic HUD.

### Kinematics
- `ink.penDown(x, y, pressure = 0.5, time = null, agentId = 0)`
- `ink.penMove(x, y, dt = null, pressure = 0.5, time = null, agentId = 0)`
- `ink.penUp(x, y, time = null, agentId = 0)`
- `ink.step(dt = 0.016)`: Manually advances fluid drips (when `autoStep: false`).

### Dynamic Setters & Overprint Controls
- `ink.setTool(toolName, presetId = null)`
- `ink.setPreset(presetId)`
- `ink.setThickness(pxOrToken)`
- `ink.setColor(hexOrToken)`
- `ink.setPaperTooth(0.0 - 1.0)`
- `ink.setBladeAngle(angleInRadians)`
- `ink.setChatterIntensity(0.0 - 1.0)`
- `ink.setEdgeAsymmetry(0.0 - 1.0)`
- `ink.setOverprintModel('mix' | 'classic')`
- `ink.setBlendMode('multiply' | 'source-over')`
- `ink.setInkDensity(0.65 - 1.00)`
- `ink.setOverprintDarken(0.00 - 1.00)` *(alias: `setBlendIntensity`)*
- `ink.setOverprintAttack(0.0 - 1.0)`
- `ink.setOverprintRelease(0.0 - 1.0)`
- `ink.setOverprintReach(0.2 - 1.5)`
- `ink.setOverprintSwell(0.00 - 0.35)`
- `ink.setPaperColor(hex)`
- `ink.setConfig(configObject)`: Atomic batch update of any engine or instrument parameter.
- `ink.getConfig()`: Returns current configuration state.
- `ink.setAgentPen(agentId, configOrNull)`: Assigns a private instrument to an autonomous agent.

### Advanced Diagnostics & Utilities
- `parseInkSettings(text)`: AST-based parser that safely extracts configuration objects from strings or lab snippets **without running `eval()`**.
- `InkRecorder`: Stand-in recording context that captures instrument operations (`rec.take()`) and replays them (`InkRecorder.replay(ctx, ops)`) onto external tiles, off-screen buffers, or WebXR 360° cylindrical canvases.
- `ink.clear(saveState = true)`
- `ink.undo()` / `ink.redo()`
- `ink.exportPNG()` → Returns data URL of the canvas.
- `ink.destroy()` → Terminates animation timers and releases GPU/canvas memory.

---

## 📂 Repository Organization

```
inkdynamics/
├── index.html                   # Interactive Physical Calibration Lab & Snippet Generator
├── design_handoff.html          # Publication-grade Interactive Spec & Reference
├── about.html                   # Project background, context & research team
├── specimen_ruling_pens.html    # Diagnostic Lab: Ruling Pen friction & acoustics
├── specimen_ink_blending.html   # Diagnostic Lab: v4.0 Ink mixing & overprint
│
├── js/                          # Core ES Module Library
│   ├── inkdynamics.js           # Public API entry point & factory
│   ├── InkDynamicsEngine.js     # Kinematic state machine & canvas compositor
│   │
│   ├── instruments/             # Physical instrument models
│   │   ├── Instrument.js        # Base physical instrument class
│   │   ├── ChineseBrushV2.js    # Capillary bristle starvation model
│   │   ├── PoscaSqueezerV3.js   # Dense acrylic flow & velocity waisting
│   │   ├── RulingPenCurved.js   # Bilateral chatter & train tracks
│   │   └── RulingPenFlat.js     # Edge asymmetry & comb teeth
│   │
│   ├── physics/                 # Shared physical dynamics
│   │   ├── FluidDynamics.js     # Viscous pooling & gravity drips
│   │   ├── OverprintBlender.js  # Translucent ink mixing & crossing micro-swell
│   │   └── SplatterGenerator.js # Ballistic teardrop spit bursts
│   │
│   ├── presets/                 # Preset persistence & catalog
│   │   ├── PresetCatalog.js     # 13 permanent deep-frozen core presets
│   │   └── UserPresetStore.js   # Storage adapters (localStorage, memory, HTTP)
│   │
│   ├── core/                    # Host integration tools
│   │   ├── InkRecorder.js       # Vector-like operation recording & replay
│   │   └── SettingsParser.js    # Zero-eval AST snippet parser
│   │
│   └── ui/                      # Calibration lab user interface components
│       ├── Toolbar.js           # Multi-slider instrument parameter controls
│       ├── TelemetryHUD.js      # Real-time physical metrics overlay
│       └── TextureGen.js        # Procedural paper tooth textures
│
├── docs/                        # Technical & Integration Documentation
│   ├── INKWELL_INTEGRATION.md   # Host architecture guide (tiles, undo, 360° ring)
│   ├── PHYSICS_OF_INK.md        # Mathematical formulations & fluid mechanics
│   └── ZIG_BRUSH_CALIBRATION.md # Experimental calibration against real Sumi brushes
│
├── server/                      # Lightweight Reference Presets Backend
│   ├── README.md                # Server setup & security notes
│   ├── presets.php              # Flat-file JSON REST API with write-token hashing
│   └── presets.config.sample.php # Template configuration file
│
├── test_v3.js                   # Unit tests: Posca squeezer, Chinese brush, drips
├── test_ruling_pens.js          # Unit tests: Curved & Flat ruling pens, acoustics
├── test_v4.js                   # Unit tests: v4.0 mixing, parser, recorder, agents
├── package.json                 # Project metadata & npm test scripts
├── LICENSE                      # MIT Open Source License
├── CHANGELOG.md                 # Semantic versioning history
├── PRD.md                       # Product Requirements Document
└── DESIGN_HANDOFF.md            # Comprehensive physical specification
```

---

## 🧪 Automated Testing

InkDynamics includes 3 comprehensive Node.js test suites with **84 automated assertions**:

```bash
npm test                  # Run all test suites
node test_v3.js           # Posca squeezer, gravity drips, and Chinese brush
node test_ruling_pens.js  # Curved & Flat ruling pens, acoustics, and spit bursts
node test_v4.js           # v4.0 ink mix model, recorder, parser, agents & presets
```

---

## 🏛️ Credits & Institutional Context

### Research Project
**[SiX — Drawing for Social Re-connectivity](https://six.fba.up.pt/)**  
*Project Reference:* 2023.11224.PEX · *DOI:* [10.54499/2023.11224.PEX](https://doi.org/10.54499/2023.11224.PEX)  
Hosted at the **Faculty of Fine Arts, University of Porto (FBAUP)** in collaboration with the **Research Institute in Art, Design and Society (i2ADS)**.

### Authorship & Contributions
- **Concept, Design & Architecture:** Pedro Amado (FBAUP / i2ADS)
- **Principal Investigator:** Eliana Penedos-Santiago (ID+ / FBAUP)
- **Development & Implementation:** Pedro Amado, assisted by AI coding models:
  - **Google Gemini 3.8 Flash** in Antigravity (v1.0 – v3.9)
  - **Anthropic Claude Opus 5.5** (v4.0, October 2026)
- **SiX Research Team:** Andreia Pinto de Sousa, Bruno Giesteira, Cláudia Lima, Pedro Amado, Sílvia Simões, Viviane Peçaibes
- **Collaborators & Consultants:** Filipe Gonçalves (APELA), Miguel Alves-Ferreira (CGPP-IBMC / i3S), Lara Portelinha, Manuel Silva, Vasco Praça
- **Institutional Partners:** APELA (Associação Portuguesa de Esclerose Lateral Amiotrófica) · ADITGAMES · i3S / IBMC · Fraunhofer AICOS

### Funding Acknowledgement
This work is financed by national funds through the Portuguese funding agency, **FCT — Fundação para a Ciência e a Tecnologia, I.P.**, under project grant `2023.11224.PEX` ([DOI: 10.54499/2023.11224.PEX](https://doi.org/10.54499/2023.11224.PEX)).

---

## 📖 Citation

If you use InkDynamics or its physical ink simulation models in academic research, generative art, or assistive technology projects, please cite:

```bibtex
@software{amado2026inkdynamics,
  author       = {Amado, Pedro and Penedos-Santiago, Eliana and {SiX Research Team}},
  title        = {InkDynamics: Physical Fluid Dynamics and Mechanical Friction for Expressive Web Lines},
  year         = {2026},
  publisher    = {GitHub},
  journal      = {GitHub repository},
  version      = {4.0.0},
  url          = {https://github.com/six-project/inkdynamics},
  doi          = {10.54499/2023.11224.PEX},
  institution  = {Faculty of Fine Arts, University of Porto (FBAUP) / i2ADS},
  note         = {Conceived and developed as part of the Inkwell prototype for the SiX Research Project}
}
```

---

## 📄 License

This project is open-source software licensed under the **MIT License**. See the [LICENSE](LICENSE) file for complete details.
