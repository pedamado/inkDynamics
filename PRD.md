# Product Requirements Document (PRD) — InkDynamics

**Physical Fluid Dynamics & Expressive Calligraphic Engine for the Web**  
*A research component of the SiX Project: «Drawing for Social Re-connectivity»*  
**Hosting Institutions:** Faculty of Fine Arts, University of Porto (FBAUP) & Research Institute in Art, Design and Society (i2ADS)  
**Principal Investigator:** Eliana Penedos-Santiago (ID+ · FBAUP)  
**Concept and design (expressive line & dynamic agents):** Pedro Amado (FBAUP / i2ADS)  
**Development:** Google Gemini 3.8 Flash in Antigravity (1.0–3.9) and Anthropic Claude Opus 5.5 (4.0, October 2026)  
**Funding:** FCT — Fundação para a Ciência e a Tecnologia [Project 2023.11224.PEX · DOI: 10.54499/2023.11224.PEX]  
**Version:** 4.0.0 (17 October 2026)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Challenge of Digital Line Sterility
Most digital drawing engines (e.g., standard HTML5 canvas `stroke()`, vector Bézier splines, or basic ribbon mesh renderers) generate lines that are mathematically uniform, sterile, and disconnected from the physical world. In physical drawing, mark-making is an ongoing negotiation between:
- The **viscosity, surface tension, and volume** of liquid ink;
- The **elasticity, deformability, and friction** of the instrument nib;
- The **fibrous texture, tooth, and absorption** of the paper substrate;
- The **velocity, acceleration, and dwell hesitation** of the human hand.

### 1.2 The Assistive Context of the SiX Research Project
In the [SiX research project](https://six.fba.up.pt/), drawing is deployed as a medium for social re-connectivity, rehabilitation, and creative autonomy for individuals experiencing motor impairments, Amyotrophic Lateral Sclerosis (ALS / ELA), or locked-in syndrome. In these scenarios, drawing is driven by non-standard input modalities:
- **Eye-Gaze Dwell & Fixations** (via *Inkwell* and *InkGaze.js*);
- **Autonomous Boid / Agent Swarms** (agentic drawing partners);
- **Micro-gesture & Head Tracking**.

Because a gaze-driven or switch-driven artist cannot naturally modulate a pressure-sensitive stylus, the software engine itself must embody physical intelligence. Lines must not be dead ribbons; they must live, engorge, starve, chatter, spit, and drip in response to user velocity and hesitation.

### 1.3 Project Mission
`InkDynamics` was engineered to:
1. Provide a **modular, plug-and-play JavaScript library** that powers the expressive stroke pipeline in *Inkwell v19+* and future SiX interfaces;
2. Serve as an **open-source, zero-dependency expressive lines library** for creative coders, generative artists, digital calligraphers, and accessibility researchers worldwide;
3. Faithfully reproduce the behavior of four distinct physical instruments calibrated against real macro photographic specimens on paper.

---

## 2. Core Architecture & Design Requirements

| Requirement | Specification | Rationale |
|---|---|---|
| **Zero Runtime Dependencies** | Vanilla ES6+ JavaScript, 2D Canvas API | Maximum portability across web apps, WebXR, Node testing, and lightweight mobile devices. |
| **Solid Ink Fidelity** | 100% saturated marks; strictly zero semi-transparent gray washes or muddy alphas | Physical Indian ink and Posca acrylic markers deposit opaque pigment onto paper. |
| **Sub-Millisecond Kinematics** | Evaluates curvature, velocity, paper tooth, and bristle spread in < 0.2 ms per point | Essential for maintaining 60 FPS under rapid pointer streams or 60 Hz eye-tracker inputs. |
| **Multi-Agent Isolation** | Independent stroke state channels per agent ID (0–7) | Enables simultaneous drawing by user gaze alongside 1–7 autonomous boid agents without cross-talk. |
| **Backward & Host Compatibility** | Supports standard Inkwell v18/v19 token conventions (`INKWELL_COLORS`, `INKWELL_THICKNESS`) | Drop-in replacement for existing drawing layers in Inkwell. |
| **Interactive Snippet Export** | Generates 1-line factory call and JSON config live in the UI | Allows designers to tune pen dynamics in the lab and copy-paste exact code into third-party apps. |

---

## 3. Physical Instrument Specifications

### 3.1 Zig Chinese Calligraphy Brush (v2)
*Physical Model: Multi-bristle natural hair bundle with capillary reservoir.*

```
      ▲
     / \     [Asymmetric "Tibia Bone-Head" Landing]
    /   \
   |  |  |   [Capillary Multi-Bristle Spread]
   |  |  |   [Velocity Starvation: Parallel White Slits]
    \   /
     \ /     [Hesitation: Capillary Inflow & Bulbous Swell]
```

- **Dynamics:**
  - **Asymmetric "Tibia Bone-Head" Start:** Initial touchdown spreads fibers trapezoidally before narrowing into the stroke neck.
  - **Longitudinal Starvation Stripes:** Rapid velocities ($v > 600\text{ px/s}$) deplete surface ink faster than capillary flow can replenish, exposing dry bristle tracks.
  - **Velocity Waisting:** High speeds thin the stroke down to 30–50% of nominal radius; deceleration engorges to 1.5–2.5x.
  - **Starvation Ease-In / Out:** Smooth lingering recovery when transitioning between dry paper skips and solid capillary saturation.

### 3.2 Posca Mop Squeezer (v3)
*Physical Model: Pressurized fluid reservoir feeding a porous hemispherical foam dome.*

```
      ╭───╮
     (     )  [Regular Hemispherical Dome Contact Stamp]
      ╰─┬─╯
        │  [100% Saturated Solid Opaque Acrylic Core]
       ░│░ [Border Tooth Starvation along Dome Flanks]
        │
      ╭─┴─╮
     (     )  [Dwell Hesitation: Pool Formation]
        │
        │     [Gravity-Driven Downward Drip: Gentle Taper, Round Cap, NO Terminal Dot]
        ▼
```

- **Dynamics:**
  - **100% Solid Center Core:** Posca acrylic paint produces an opaque center line; starvation occurs solely at the curved boundary flanks over paper tooth.
  - **Regular Dome Contact:** Perfectly circular start stamps with subtle initial compression flare (1.05–1.20x).
  - **Monoline Stability:** Fast waisting is subtle ($0.80–0.95$), preserving the characteristic monoline street-art tagger feel.
  - **Viscous Gravity Dripping:** Hesitating beyond the dwell threshold ($t > 0.35\text{ s}$) pools paint that descends downward with acceleration and gentle fluid tapering, terminating in a clean round cap without artificial spherical dots.
  - **Drip Width Ratio:** Scaled to nib dome diameter (thin, medium, thick/jumbo).

### 3.3 Curved Ruling / Folded Cola Pen (v3.8)
*Physical Model: Fusiform lance-shaped dual metal plates clamping an ink meniscus.*

```
      /|
     / |      [Point Mode: Laser-Straight Hairline (Unmodulated)]
    /__|
     ||       [Blade Mode: Dragging on Curved Metal Flank]
    /  \      [Bilateral Soundwave Teeth Oscillating on Both Sides]
   | =  |     ["Ellipses on Train Tracks": Outer Rails + Transverse Friction Skips]
    \  /
   * ✹ *      [Volcano Blade Clapping: Momentary Swell -> Fast U-Catenary Decay + Provenance Droplets]
```

- **Dynamics:**
  - **Pen-Down Contact Pill Stamp:** Touchdown produces an irregular "pill-like" ellipse oriented at the pen's `bladeAngle` (e.g. 60°), where the major radius scales with `baseRadius` and the minor radius remains very narrow (physical metal contact edge). 24-point harmonic paper tooth micro-irregularity prevents artificial geometric contours.
  - **Dual Mode Contact:**
    - *Point Mode:* Razor-thin, constant hairline ($w \approx 1–1.5\text{ px}$) without width variation or drips.
    - *Blade Mode:* Dragging the curved metal side creates dramatic speed-modulated calligraphic ribbons.
  - **Bilateral Soundwave Chatter:** Micro-vibrations of the flexible metal sheet against paper tooth generate dense, high-frequency soundwave ripples on both flanks of the stroke.
  - **Inverted Friction Skips (`skipSensitivity`):** Lower values produce dense, compact cross-ladder lines (`Dense Line 0.2x`), while higher values produce wide skips and gaps (`Wide Skips 2.5x`).
  - **Volcano Pressure Release Dynamics:** When accumulated blade tension reaches threshold, stroke momentarily expands perpendicularly by `burstExplosionWidth` (1.0x to 4.0x), then eases out along a fast U-shaped catenary decay curve dipping slightly below nominal waisting before recovering smoothly.
  - **Directional Provenance Droplets:** Ballistic spit droplets are rendered as elongated ellipses oriented directly along the flight ray back to their burst origin on the stroke line ($\text{atan2}(y - y_0, x - x_0)$).
  - **Customization Controls:** `minWidthScale`, `maxWidthScale`, `burstExplosionWidth`, `minSpitCount`, `maxSpitCount`, `maxDropletSize`.

### 3.4 Flat Ruling / German Expressionist Chisel Pen (v3.8)
*Physical Model: Handcrafted flat folded brass sheet with broad chisel profile.*

```
     ╭────────╮  [Chisel Pill-Like Touchdown Stamp: Oriented at bladeAngle]
     │        │
     │  CORE  │  [Pristine, Laser-Straight Spine (Left Edge)]
     │        │
     │ ▓▓▓▓▓▓ │  [High-Frequency Soundwave Teeth (Right Edge, up to 3x Width)]
     │        │
     └────────┘  [One-Sided Volcano Clapping: Directional Spit Showers with Provenance Angle]
          ✹ ✹ ✹
```

- **Dynamics:**
  - **Angled Pill Touchdown Stamp:** Touchdown stamps an organic pill ellipse oriented at `bladeAngle` with narrow minor axis and 24-point paper tooth harmonic micro-jitter.
  - **Extreme Edge Asymmetry:** One flank remains laser-straight and sharp (uncompromised metal spine), while the opposite flank explodes into aggressive, high-frequency soundwave comb teeth.
  - **Speed Flaring up to 3x Width:** At high velocity, the comb teeth extend dramatically beyond the nominal stroke width into the paper substrate.
  - **Inverted Friction Skips:** Transverse rectangular chisel stripes perpendicular to stroke path, with `skipSensitivity` scaling from dense comb to wide skipping.
  - **One-Sided Volcano Spit Explosions:** Clapping spit droplets eject exclusively toward the ragged flank direction, shaped as elongated ellipses aligned along the provenance ray back to the release origin.
  - **Customization Controls:** `edgeAsymmetry`, `asymmetrySide`, `minWidthScale`, `maxWidthScale`, `burstExplosionWidth`, `minSpitCount`, `maxSpitCount`, `maxDropletSize`.

---

## 4. Substrate & Fluid Dynamics

### 4.1 Paper Tooth Interaction
Paper texture is parameterized as `paperTooth` ($0.0 \le \tau \le 1.0$):
- $\tau = 0.05$: Ultra-smooth Bristol board / hot-press paper (clean edges, minimal skipping, long fluid runs).
- $\tau = 0.45$: Standard cold-press drawing cartridge paper (balanced tooth friction and capillary draw).
- $\tau = 0.85$: Heavy handmade watercolor paper / rough paper (aggressive bristle splitting, chatter teeth, wide train-track skips).

### 4.2 Fluid Pooling & Gravity Mechanics
In `FluidDynamics.js`:
- Pools form when pointer speed $v < 15\text{ px/s}$.
- Accumulation rate $A = \dot{V} \cdot \Delta t \cdot \mu^{-1}$, where $\mu$ is viscosity.
- When $A > T_{\text{drip}}$, an active drip head descends downward along $\vec{g} = (0, 1)$.
- Drip width scales continuously as $w(y) = w_0 \cdot (1 - \kappa \cdot y / L)$, creating a gentle taper without bulbous swelling.

### 4.3 Ink That Mixes — Transparency, Overprint & Capillary Intersection Micro-Swell (v4.0)
Requirements set by Pedro Amado for Inkwell 20 (2026-10-17): a slight transparency (about 0.97) for **every** colour, so
the paper and the strokes beneath show through; the "darkening" at crossings is really a **mixing** of the two inks
(an overprint / multiply effect); black must stay black, a crossing of blacks slightly blacker; very light colours
behave like any other; the mix comes in quickly when the nib meets ink beneath and is given back slowly after the
crossing; a 5–10 % swell at crossings — least in low-viscosity, fast-running, quick-drying ink (ruling pens), medium in
slow-running, low-viscosity sumi (Zig brush), most in high-viscosity acrylic (Posca); density 0.97 for every instrument;
every effect tunable.

In `OverprintBlender.js`, model `'mix'` (default). For an ink colour $C$ crossing ink $U$ on paper $P$ at crossing
strength $k \in [0, 1]$:

$$B = P + (U - P)\,k,\qquad S = \rho\,C + (1-\rho)\,B,\qquad M = \frac{C \cdot B}{255},\qquad D = S + (M - S)\,(k\,I)$$

- $\rho$ = **`inkDensity`** (ink density / transparency, $0.65 \le \rho \le 1.00$, default $0.97$): 3 % of what lies
  beneath shows through. $D$ is painted opaque (`'source-over'`): the sub-steps of one stroke never build up.
- $I$ = **`overprintDarken`** (blending intensity, alias `blendIntensity`, $0 \le I \le 1$, default $0.45$).
- $k$ follows the **coverage** of the nib by ink beneath (cells within `overprintReach` $\times\,r$ of the nib's centre,
  measured in pixels, $\times 2$), along the stroke's length $s$:
  $k \leftarrow k + (c - k)\,(1 - e^{-\Delta s / L})$ with $L = L_a$ when entering and $L_r$ when leaving:
  $L_a = r\,(0.12 + 3\,(1-a)^2)$, $L_r = r\,(0.25 + 12\,(1-b)^2)$ — $a$ = **`overprintAttack`** (approach mix speed,
  default $0.85$), $b$ = **`overprintRelease`** (exit restore speed, default $0.55$). A nib landing in ink mixes at once.
- **4px Arc-Length Tagged Spatial Ink Grid** (unchanged in principle, no readbacks): `(strokeId, arcLength, R, G, B,
  layers)` + 4.0's *ink beneath a stroke's own fresh ink* (`cellUnder`, `cellUR/UG/UB`); an earlier stroke, or an earlier
  loop of the same continuous stroke ($\Delta s > \max(26\text{px}, 4.2\,r)$), is ink beneath. Drips mix and are
  recorded too.
- **Capillary Intersection Micro-Swell** by ink: $R_{\text{eff}} = R_0\,(1 + \sigma\,k)$, $\sigma$ = the instrument's
  **`overprintSwell`**: ruling pens $0.05$, Zig $0.075$, Posca $0.10$ (range $0$–$0.35$).
- Results (Zig, Munken paper): black `#070707`, black × black `#000000`, white × black ≈ grey, yellow × sky blue → green.
- The 3.9 model stays available: **`overprintModel: 'classic'`** (lift toward a warm white, `'darken'` sub-steps,
  multiply darkening, light-ink cover above luminance 0.80) — `CLASSIC_39`.

### 4.4 User Presets (v4.0)
- The **13 core presets are permanent** (deep-frozen, `PresetCatalog.js`).
- People keep their own pens: **create · read · update · delete · export · import** (`UserPresetStore`). A user preset =
  `{ id, name, tool, basePreset, settings, notes, created, updated }`; settings are validated (known keys, in range).
- Where they are kept is an adapter: this browser (`localStorageAdapter`, default), a server (`httpAdapter` +
  `server/presets.php`: flat-file JSON per collection, write token stored as a hash), or the host's own (Inkwell 20:
  the person's account, through Inkwell's API).
- Host apps can accept a pasted snippet in an "expert" field: `parseInkSettings()` reads it **without running it**.

---

## 5. Token Compatibility Matrix

| Token Name | Zig Chinese Brush | Posca Mop Squeezer | Curved Ruling Pen | Flat Ruling Pen |
|---|---|---|---|---|
| `hairline` | 1.8 px | 4.0 px | 1.25 px | 1.0 px |
| `thin` | 3.5 px | 6.0 px (Ø 12 px) | 3.5 px | 4.0 px |
| `medium` | 8.0 px | 12.0 px (Ø 24 px) | 7.0 px | 8.0 px |
| `thick` | 14.0 px | 22.0 px (Ø 44 px) | 13.0 px | 14.0 px |
| `broad` | 22.0 px | 30.0 px | 18.0 px | 20.0 px |

Standard palette tokens:
- `black`: `#191817` (Deep Sumi / Inkwell dark tone)
- `red`: `#b8261a` (Vermilion calligraphic red)
- `blue`: `#1d3a6e` (Cobalt / Navy ink)
- `white`: `#ffffff` (Opaque white correction ink)

---

## 6. Integration API Contract

### 6.1 Instantiation Interface
```javascript
import { createInkDynamics } from './InkDynamics/js/inkdynamics.js';

const ink = createInkDynamics({
  canvas: HTMLCanvasElement,        // Target drawing canvas
  tool: 'ruling_pen_curved',        // 'chinese_brush' | 'posca_squeezer' | 'ruling_pen_curved' | 'ruling_pen_flat'
  preset: 'curved_ruling_medium',   // Preset identifier
  thickness: 'medium',              // Token or numeric radius in px
  color: '#191817',                 // Hex color or token
  paperTooth: 0.45,                 // Substrate tooth [0.0 - 1.0]
  overprintModel: 'mix',            // v4.0: 'mix' | 'classic' (3.9)
  blendMode: 'multiply',            // 'multiply' (overprint on) | 'source-over' (flat)
  inkDensity: 0.97,                 // v4.0: ink density / transparency [0.65 - 1.00]
  overprintDarken: 0.45,            // v4.0: blending intensity at crossings [0.00 - 1.00] (alias blendIntensity)
  overprintAttack: 0.85,            // v4.0: approach mix speed [0 - 1]
  overprintRelease: 0.55,           // v4.0: exit restore speed [0 - 1]
  overprintReach: 0.75,             // v4.0: crossing reach × nib radius [0.2 - 1.5]
  paperColor: '#FFFFFF',            // v4.0: the paper under the ink
  // overprintSwell: per instrument unless given (ruling 0.05, Zig 0.075, Posca 0.10)
  autoStep: true,                   // Automatically runs requestAnimationFrame fluid loop
  onMark: (markEvent) => { ... },  // Telemetry stream for distributed / networked drawing
});
```

### 6.2 Stroke Lifecycle
```javascript
// Begin mark
ink.penDown(x, y, pressure, timestamp, agentId);

// Continue stroke
ink.penMove(x, y, dt, pressure, timestamp, agentId);

// Lift instrument
ink.penUp(x, y, timestamp, agentId);
```

### 6.3 Dynamic Parameter Overrides
```javascript
ink.setTool('posca_squeezer', 'posca_squeezer_thick');
ink.setColor('#b8261a');
ink.setThickness(14);
ink.setDripWidthRatio(0.35);
ink.setBladeAngle(Math.PI / 4);
ink.setChatterIntensity(1.5);
ink.setEdgeAsymmetry(0.92);

// v4.0 ink overprint & mixing runtime setters
ink.setOverprintModel('mix');       // 'mix' | 'classic'
ink.setBlendMode('multiply');       // 'multiply' | 'source-over' | boolean
ink.setInkDensity(0.97);            // 97% density: 3% see-through
ink.setBlendIntensity(0.45);        // = setOverprintDarken: how far crossings mix
ink.setOverprintAttack(0.85);       // the mix comes in fast …
ink.setOverprintRelease(0.55);      // … and goes slowly
ink.setOverprintReach(0.75);        // × nib radius
ink.setOverprintSwell(0.075);       // the active instrument's crossing swell
ink.setPaperColor('#F4F1EA');
ink.setOverprint({ overprintModel: 'mix', inkDensity: 0.97, overprintDarken: 0.45 });

// v4.0 agents, presets, snippets
ink.setAgentPen(1, { tool: 'posca_squeezer', color: '#E60000', thickness: 5 });
ink.applyPreset('fine_low_var');    // or a user preset object
const { settings, error } = parseInkSettings(pastedText);   // never executed
```

---

## 7. Deliverables & Repository Structure

- `index.html`: Interactive Physical Calibration Lab with floating glassmorphic toolbar, HUD, reference modal, and about modal.
- `specimen_ruling_pens.html`: Visual verification specimen sheet for v3.8 Ruling Pens.
- `specimen_ink_blending.html`: Interactive specimen verification sheet for the v4.0 ink mixing (and the 3.9 classic) & intersection micro-swell.
- `design_handoff.html`: Interactive academic & developer design handoff monograph.
- `about.html`: Standalone academic and creative credits page.
- `js/inkdynamics.js`: Modular, zero-dependency library entry point.
- `js/InkDynamicsEngine.js`: Core simulation coordinator.
- `js/instruments/`: Modular instrument classes (`ChineseBrushV2`, `PoscaSqueezerV3`, `RulingPenCurved`, `RulingPenFlat`).
- `js/physics/FluidDynamics.js`: Viscous accumulation, pooling, and gravity drips.
- `js/physics/OverprintBlender.js`: The ink's transparency and overprint mixing ('mix', v4.0; 'classic', v3.9), 4px arc-length spatial ink grid, capillary intersection micro-swell.
- `js/core/SettingsParser.js` (v4.0): reads pasted settings without running them; validation of every key.
- `js/core/InkRecorder.js` (v4.0): record what an instrument draws, replay it anywhere.
- `js/presets/PresetCatalog.js`, `js/presets/UserPresetStore.js` (v4.0): permanent core presets; user presets (CRUD) with storage adapters.
- `server/presets.php` (+ `presets.config.sample.php`, `README.md`) (v4.0): reference endpoint for user presets on a server.
- `test_v3.js`, `test_ruling_pens.js`, `test_v4.js` (`npm test`).
- `docs/`: Comprehensive developer guides (`INKWELL_INTEGRATION.md`, `PHYSICS_OF_INK.md`, `ZIG_BRUSH_CALIBRATION.md`).
- `AI_AGENT_INTEGRATION_GUIDE.md`: Specialized integration guide for AI coding agents (Antigravity Gemini, Claude Code, Codex).
- `PRD.md`, `DESIGN_HANDOFF.md`, `README.md`, `CHANGELOG.md`, `LICENSE`, `.gitignore`.

