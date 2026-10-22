# InkDynamics: Comprehensive Design Handoff & Physical Expression Reference

**Research Project:** SiX — Drawing for Social Re-connectivity  
**Grant Reference:** FCT 2023.11224.PEX  
**DOI:** [10.54499/2023.11224.PEX](https://doi.org/10.54499/2023.11224.PEX)  
**Website:** [https://six.fba.up.pt/](https://six.fba.up.pt/)  
**Concept and design (expressive line architecture & creative direction):** Pedro Amado (FBAUP / i2ADS)  
**Development:** Google Gemini 3.8 Flash in Antigravity (1.0–3.9) and Anthropic Claude Opus 5.5 (4.0, October 2026)  
**Principal Investigator:** Eliana Penedos-Santiago (ID+ / FBAUP)  
**Project Team:** Andreia Pinto de Sousa, Bruno Giesteira, Cláudia Lima, Pedro Amado, Sílvia Simões, Viviane Peçaibes  
**Partners:** APELA, ADITGAMES, i3S / IBMC, Fraunhofer AICOS  
**Software Version:** InkDynamics v4.0.0 (17 October 2026)  
**Target Environments:** S.iX EyeWriter Clone / Inkwell 20, Standalone HTML5 Canvas, Multi-Agent Boid Swarms, WebXR Drawing Labs  

---

## 1. Executive Summary & Aesthetic Rationale

### 1.1 The Problem of the "Sterile Digital Line" in Eye-Gaze Drawing
In assistive drawing systems for Locked-In Syndrome (LIS), Amyotrophic Lateral Sclerosis (ALS), and severe motor impairments, eye tracking interfaces have traditionally rendered lines as sterile geometric vectors: uniform poly-lines, monotonic Bezier curves, or plastic anti-aliased tubes. 

While technically stable, these marks lack *kinematic soul*, *viscous resistance*, and *organic unpredictability*. For an artist or user expressing emotion through gaze, a line without friction, starvation, clotting, and splattering ceases to feel like drawing—it feels like plotting coordinates on a spreadsheet.

### 1.2 The S.iX Expressive Line Philosophy
The **SiX Research Project** (*«Drawing for Social Re-connectivity»*) re-imagines the digital drawing surface as a living physical substrate. The **InkDynamics** engine models the delicate, chaotic dialogue between:
1. **The physical instrument nib** (elastic animal hair tufts, soft foam felt domes, and flexing dual metal leaves);
2. **The ink chemistry** (low-viscosity fluid Indian ink vs heavy-body thixotropic acrylic paint);
3. **The paper substrate texture** (cold-press cartridge roughness, microscopic tooth friction, and capillary absorption);
4. **The user's velocity, dwell time, and pressure** (accelerations, hesitation pooling, and violent spring releases).

### 1.3 Scope of this Document
This design handoff establishes the definitive technical and aesthetic reference for:
- Software engineers integrating `InkDynamics` into host applications (such as Inkwell v19+, WebXR VR workspaces, and generative canvas tools);
- Interaction designers and digital artists tuning custom expressive voices;
- Academic researchers citing and building upon the physical mathematical models of ink simulation in drawing.

---

## 2. Architecture & Public Integration API

`InkDynamics` is distributed as a zero-dependency, modular ES6 library (`js/inkdynamics.js`) exposing a unified high-level controller class `InkDynamicsInstance` and a convenient 1-line factory function `createInkDynamics`.

### 2.1 1-Line Constructor & Quick Start

```javascript
import { createInkDynamics } from './js/inkdynamics.js';

// Initialize on an existing HTML5 canvas element
const ink = createInkDynamics({
  canvas: document.getElementById('drawing-canvas'),
  tool: 'ruling_pen_curved',        // 'chinese_brush' | 'posca_squeezer' | 'ruling_pen_curved' | 'ruling_pen_flat'
  preset: 'curved_ruling_medium',    // Specific calibration preset
  color: '#191817',                  // Saturated pigment hex or token
  thickness: 'medium',               // 'hairline' | 'thin' | 'medium' | 'thick' | 'broad' | number in px
  paperTooth: 0.45,                  // Substrate texture (0.0 smooth to 1.0 coarse)
  autoStep: true                     // Automatically drive gravity drip animation loop
});
```

### 2.2 Kinematic Drawing API

Host applications deliver input via three kinematic methods:

```javascript
// 1. Pen Down (Touchdown contact stamp)
ink.penDown(x, y, pressure = 0.5, timestamp = performance.now(), agentId = 0);

// 2. Pen Move (Continuous stroke drag)
// dt = delta time in seconds; calculated automatically if null
ink.penMove(x, y, dt = null, pressure = 0.5, timestamp = performance.now(), agentId = 0);

// 3. Pen Up (Stroke termination, flick tapering or lift puddle)
ink.penUp(x, y, timestamp = performance.now(), agentId = 0);
```

### 2.3 Fluid Simulation Tick (`step`)

When handling instruments capable of gravity-driven cascades (such as the Posca Mop Squeezer), the fluid engine simulates puddle pooling and drip acceleration:

```javascript
// In a host-driven 60fps requestAnimationFrame or WebXR render loop:
function animate(currentTime) {
  const dt = 0.016; // 16ms frame delta
  ink.step(dt);     // Advances fluid drips, surface tension, and run-down lines
  requestAnimationFrame(animate);
}
```

### 2.4 Multi-Agent (Boid Swarm) Parallel Channels

To allow autonomous boid swarms, collaborative drawing partners (such as Inkwell 18.4's dual-seat carer mode), or simultaneous gesture fingers to draw without state cross-talk, every kinematic method accepts an optional `agentId`:

```javascript
// Agent 0 (Primary User / Eye-Gaze)
ink.penDown(userX, userY, 0.5, now, 0);

// Agent 1..8 (Autonomous Generative Boids)
ink.penDown(boid1.x, boid1.y, 0.4, now, 1);
ink.penDown(boid2.x, boid2.y, 0.6, now, 2);
```

Each `agentId` automatically receives an isolated clone of the active instrument instance with its own kinetic history, tension accumulators, and bristle states, sharing the underlying canvas context and the overprint grid (agents' strokes mix with each other's).

**v4.0 — a pen of its own.** `ink.setAgentPen(agentId, { tool, preset, color, thickness | radius, … })` gives an agent its own instrument, preset, colour and size (Inkwell 20's boids draw with random pens); `ink.setAgentPen(agentId, null)` returns it to the main pen.

### 2.5 Hosts With Their Own Surfaces (v4.0)

A host that owns its canvas — tiles, its own undo, shared layers between windows, a 360° ring (Inkwell 20) — does not hand that canvas to `createInkDynamics()` (which sizes it, paints it white, and reads it back for its own undo). It drives the instruments itself, the same way the instance does internally:

```javascript
import { OverprintBlender, FluidDynamics, ChineseBrushV2, InkRecorder } from './js/inkdynamics.js';

const ob = new OverprintBlender({ width, height, paperColor: '#F4F1EA' });   // ONE grid for the whole surface
const fluid = new FluidDynamics();
const pen = new ChineseBrushV2({ preset: 'fine_low_var', overprintBlender: ob, agentId: 'person' });
const rec = new InkRecorder();

pen.down({ x, y, time }, rec.begin(), fluid);           // simulate once, into the recorder
const { ops, box } = rec.take();                        // what was drawn, and where
surface.draw(box, (ctx) => InkRecorder.replay(ctx, ops));   // the host's own tiles / undo / partners
// after the host puts pixels back (undo, open): ob.rebuildFromImageData(imageData, { x, y, scale })
```

### 2.6 User Presets & Expert Settings (v4.0)

- `UserPresetStore` — create · read · update · delete · export · import, with adapters: `localStorageAdapter()` (this browser), `httpAdapter({ endpoint, token })` (`server/presets.php`), or the host's own (`{ load(), save(list) }`). The 13 core presets are permanent (frozen).
- `parseInkSettings(text)` reads a pasted "1-Line Call", "Config JSON" or `key: value` list without running it; `validateInkSettings()` keeps known keys in range.

---

## 3. Instrument Catalog, Aesthetic Decisions & Physics Calibration

---

### 3.1 Zig Chinese Calligraphy Brush (`chinese_brush`, v2)

#### Physical Anatomy & Materiality
- **Nib:** Conical multi-bristle brush composed of 16 to 54 individual simulated animal hairs (fine wolf/goat tuft).
- **Ink:** High-fluidity, deep-black Sumi / carbon ink with low viscosity and high capillary dispersion.
- **Substrate Interaction:** Xuan paper / cold-press cartridge with pronounced tooth friction.

```
       ╭─────╮
      (       )   [Tibia Bone-Head Touchdown Flare: Asymmetric Initial Blob]
       \  │  /
        │ │ │     [Capillary Multi-Bristle Dispersion: Up to 54 Hairs]
        │ │ │
        ░ │ ░     [Fei Bai / Flying White: High-Speed Tooth Starvation]
        │ │ │
        ╰─┴─╯     [Lingering Refill Ease-Out & Sharp Flick Terminal]
```

#### Aesthetic Rationale & Intended Expressions
- **The "Bone-Head" Touchdown (*Zang Feng*):** Classical Chinese calligraphy dictates that a stroke must not begin with a weak tip, but rather with a concealed, firm arrival that stamps a distinct asymmetric bone-like bulb (*tibia flare*).
- **The "Flying White" Phenomenon (*Fei Bai*):** When dragging the brush rapidly across the paper, capillary ink delivery cannot keep pace with surface displacement. The tuft splits into striated micro-filaments, leaving dry white striations of exposed paper tooth before slowly recovering as ink refills from the reservoir.
- **Organic Flick Terminals:** Lifting the brush at speed draws the filaments back into a fine tapered point.

#### Visual Calibration Specimen Matching
- **Reference Specimen:** `reference-images/Zig Chinese Calligraphy Brush/Zig-Chinese-Calligraphy-Brush-Stroke-Examples.jpg`
- **Simulated Specimen:** Evaluated in `InkDynamics/test_v3.js` Test Suite 5.
- **Physical Matching:**

| Physical Photographic Feature | InkDynamics Simulation Parameter | Calibrated Value Range | Visual Outcome |
| :--- | :--- | :--- | :--- |
| Asymmetric Bone-Head Contact | `cb.boneHeadFlare` | `1.40x` – `2.20x` (Default: `1.85x`) | Oval flared touchdown with harmonic tooth perturbation. |
| Flying White Dry Striations | `cb.depletionRate` | `0.40` – `2.20` (Default: `1.00`) | Rapid speed exposes raw canvas tooth across parallel filaments. |
| Starvation Onset Length | `cb.starveEaseIn` | `30px` – `300px` (Default: `110px`) | Gradual transition from saturated ink into dry bristle tracks. |
| Capillary Refill Speed | `cb.refillRate` | `0.40` – `3.00` (Default: `0.85`) | Speed of ink replenishment as brush decelerates. |
| Refill Lingering Tail | `cb.starveEaseOut` | `20px` – `250px` (Default: `85px`) | Distance needed to regain full solid saturation. |
| Bristle Hair Density | `cb.numBristles` | `16` – `54` (Default: `36`) | Granularity of microscopic filament tracks. |

#### Calibration Presets
1. `fine_sumi`: Precision 4.5px brush, 24 bristles, subtle starvation, quick refill.
2. `medium_high_dynamic`: The benchmark expressive brush (8.0px, 36 bristles, pronounced bone-head, dynamic Fei Bai).
3. `broad_bone_head`: Heavy calligraphic brush (14.0px, 48 bristles, 2.2x bone-head flare).
4. `dry_hairline`: Dry, coarse sketch brush (2.5px, 18 bristles, instant heavy starvation).

---

### 3.2 Posca Mop Squeezer (`posca_squeezer`, v3)

#### Physical Anatomy & Materiality
- **Nib:** Broad, compressible hemispherical synthetic foam/felt dome (Ø 12mm to 44mm).
- **Ink:** Opaque, highly saturated, water-based acrylic paint with thixotropic body.
- **Substrate Interaction:** Non-porous to medium-tooth paper; paint sits as a thick wet relief on top of the surface.

```
       ╭───────╮
      (         )  [Regular Hemispherical Dome Contact Stamp]
       │ █ █ █ │
       ░ │ █ │ ░  [Longitudinal Border Tooth Starvation along Flanks (Solid Core)]
       │ █ █ █ │
      ╭──┴─────┴──╮
     (             ) [Dwell Hesitation: Viscous Paint Pool Formation]
           │
           │       [Gravity-Driven Downward Drip: Fluid Taper, Round Cap, NO Terminal Dot]
           ▼
```

#### Aesthetic Rationale & Intended Expressions
- **The Urban Street Art "Tagger" Mark:** The Posca squeezer is an iconic tool of contemporary street calligraphy. Its signature aesthetic is an unwavering, 100% solid saturated center core that maintains monoline stability regardless of speed, flanked by subtle micro-tooth chatter where the soft curved dome grazes paper texture.
- **Longitudinal Striations (Not Transverse Ribbons):** Under high velocity, starvation occurs exclusively along the outer flanks parallel to stroke movement. The center remains deeply saturated.
- **Gravity Drip Cascades:** Hesitating in place (*dwell time* $t > 0.35\text{ s}$) squeezes an excess reservoir onto the paper. Gravity pulls this puddle downward in a vertical stream that thins gently (approx. 78% taper ratio) and ends in a natural round cap—avoiding artificial computer "pin-head" dots.

#### Visual Calibration Specimen Matching
- **Reference Specimens:** `_Reference/posca_calibrations/fig1_single_stroke_waist.jpg`, `fig2_border_starvation_stripes.jpg`, `fig3_caps_endings_pooling.jpg`.
- **Physical Matching:**

| Physical Photographic Feature | InkDynamics Simulation Parameter | Calibrated Value Range | Visual Outcome |
| :--- | :--- | :--- | :--- |
| Monoline Waisting Ratio | `ps.fastWaistRatio` | `75%` – `95%` (Default: `88%`) | Subtle narrowing at high velocity; never disappears. |
| Border Starvation Stripes | `ps.borderStarveSensitivity` | `0.20` – `2.00` (Default: `0.85`) | Micro-slits along curved flanks parallel to stroke direction. |
| Dome Touchdown Flare | `ps.initialDomeFlare` | `1.05x` – `1.35x` (Default: `1.15x`) | Regular circular contact stamp with gentle foam compression. |
| Dwell Puddle Threshold | `ps.dripThreshold` | `0.20s` – `0.65s` (Default: `0.35s`) | Required pause duration before gravitational pooling initiates. |
| Fluid Acrylic Viscosity | `ps.viscosity` | `0.20` – `0.70` (Default: `0.42`) | Resistance to flowing; governs downward drip velocity. |
| Drip Width Ratio | `ps.dripWidthRatio` | `15%` – `45%` (Default: `32%`) | Proportion of drip trunk thickness relative to nib dome diameter. |

#### Calibration Presets
1. `posca_squeezer_thin`: Ø 12mm equivalent (6.0px radius, 28% drip ratio, crisp line).
2. `posca_squeezer_medium`: Ø 24mm benchmark (12.0px radius, 32% drip ratio, rich border tooth, fluid drips).
3. `posca_squeezer_thick`: Ø 44mm jumbo street mop (22.0px radius, 40% heavy drip cascades, massive paint pooling).

---

### 3.3 Curved Ruling / Folded Cola Pen (`ruling_pen_curved`, v3.8)

#### Physical Anatomy & Materiality
- **Nib:** Fusiform lance-shaped dual metal plates (or artisanal folded soda can aluminum sheet) tightly clamped together with an adjustable thumbscrew.
- **Ink:** High-fluidity, deep-black Indian drawing ink held solely by surface tension between the metal leaves.
- **Substrate Interaction:** Smooth Bristol board or hard-backed cold-press cartridge. The metal blade skips and chatters against paper micro-roughness.

```
          /|
         / |      [Point Mode: Laser-Straight Hairline (Constant Unmodulated Width)]
        /__|
         ||       [Blade Mode: Dragging on Curved Metal Flank]
        /  \      [Bilateral Soundwave Teeth: Symmetric High-Frequency Oscillations]
       | =  |     ["Ellipses on Train Tracks": Twin Outer Rails + Transverse Friction Skips]
        \  /
       * ✹ *      [Volcano Clapping Release: Momentary Blowout -> Fast U-Catenary Decay]
      ✹     ✹     [Ballistic Directional Spit Droplets Angled Towards Stroke Origin Point]
```

#### Aesthetic Rationale & Intended Expressions
- **Point Mode vs Curved Blade Mode:**
  - When drawn upright on its point, the folded pen produces a razor-sharp, uniform technical hairline ($w \approx 1.25\text{ px}$) without any width modulation or drip.
  - When leaned onto its curved side, the broad metal flank contacts the surface, producing expressive, speed-modulated ribbons.
- **Angled Pill Touchdown Mark:** Touchdown is physical metal plate contact. Instead of a round drop, the pen stamps an irregular "pill-like" elongated ellipse oriented at `bladeAngle` (e.g. 60°), with a narrow minor axis and 24-point paper tooth harmonic perturbation.
- **Bilateral Soundwave Chatter:** Rhythmic dragging causes the two metal sheets to vibrate symmetrically against the paper, producing high-frequency ripples resembling a compressed audio waveform on both flanks.
- **Ellipses on Train Tracks (`skipSensitivity`):** The two outer edges of the folded sheet drag two continuous rail lines. Micro-jumps across paper friction leave transverse elliptical skips whose spacing widens as velocity increases. Lower values (`0.2x`) produce a dense, compact ladder line; higher values (`2.5x`) produce wide skips and prominent track gaps.
- **Volcano Pressure Release Dynamics:** When accumulated blade tension reaches threshold, the sheets clap together and violently release ink. The stroke momentarily swells perpendicularly up to `burstExplosionWidth` (1.0x to 4.0x), followed by ultra-compact steps that ease out along a fast U-shaped catenary decay curve:
  $$W(u) = 1.0 + (\text{burstExplosionWidth} - 1.0) \cdot e^{-5.2 u} - 0.22 \cdot \sin(\pi u)(1 - u)$$
  dipping slightly below nominal waisting before smoothly recovering to baseline.
- **Directional Provenance Spit Droplets:** Clapping ejects ballistic droplets shaped as elongated ellipses whose major axis radiates directly back along the flight vector ($\text{atan2}(y - y_0, x - x_0)$) toward their stroke origin point.

#### Visual Calibration Specimen Matching
- **Reference Specimen:** `_Reference/ruling_pen_calibrations/fig1_curved_ruling_pen.jpg`, `reference-images/Rulling Pen/rulling-pen-medium-round-nib.jpg`.
- **Physical Matching:**

| Physical Photographic Feature | InkDynamics Simulation Parameter | Calibrated Value Range | Visual Outcome |
| :--- | :--- | :--- | :--- |
| Contact Mode Toggle | `rc.penMode` | `'blade'` or `'point'` | Hairline monoline vs modulated expressive blade. |
| Blade Orientation Angle | `rc.bladeAngle` | `0` – $\pi$ (Default: $\pi / 4$, 45°) | Angles the pill touchdown stamp and modulation axis. |
| Soundwave Edge Ripple | `rc.chatterIntensity` | `0.0` – `2.80x` (Default: `1.25x`) | High-frequency harmonic wave teeth on both flanks. |
| Friction Skips (Train Tracks) | `rc.skipSensitivity` | `0.20x` (Dense) – `2.50x` (Wide) | Inverted scaling: dense ladder steps vs wide skips. |
| Volcano Burst Width | `rc.burstExplosionWidth` | `1.0x` – `4.0x` (Default: `2.20x`) | Momentary perpendicular blowout factor during clapping. |
| Min / Max Width Scaling | `rc.minWidthScale`, `maxWidthScale` | Min: `0.10`–`1.0x` / Max: `1.0`–`3.5x` | Bounds stroke waisting and high-speed swell. |
| Spit Droplet Count | `rc.minSpitCount`, `maxSpitCount` | Min: `2`–`15` / Max: `8`–`40` | Cluster density of ejected splatter dots. |
| Max Droplet Size | `rc.maxDropletSize` | `1.5px` – `14.0px` (Default: `3.5px`) | Maximum radius of elongated provenance teardrops. |

#### Calibration Presets
1. `curved_ruling_fine`: Point mode (1.25px radius, zero chatter, unmodulated technical hairline).
2. `curved_ruling_medium`: Benchmark artisanal cola pen (7.0px radius, 45° angle, balanced train tracks and spit bursts).
3. `curved_ruling_broad`: Broad curved folded pen (13.0px radius, aggressive 2.6x volcano explosions and wide friction skips).

---

### 3.4 Flat Ruling / German Expressionist Chisel Pen (`ruling_pen_flat`, v3.8)

#### Physical Anatomy & Materiality
- **Nib:** Broad, flat-edged folded brass or spring-steel ruling pen (inspired by historic German Expressionist calligraphy tools designed by Rudolf Koch and Karlgeorg Hoefer).
- **Ink:** High-density, carbon-black fluid ink or diluted gouache.
- **Substrate Interaction:** Dragged sideways with heavy unilateral pressure against hard, smooth surfaces.

```
       ╭────────╮  [Chisel Pill-Like Touchdown Stamp: Oriented at bladeAngle]
       │        │
       │  CORE  │  [Pristine, Laser-Straight Spine (Left Edge)]
       │        │
       │ ▓▓▓▓▓▓ │  [High-Frequency Soundwave Comb Teeth (Right Edge, up to 3x Width)]
       │        │
       └────────┘  [One-Sided Volcano Clapping: Directional Spit Showers with Provenance Angle]
            ✹ ✹ ✹
```

#### Aesthetic Rationale & Intended Expressions
- **The Expressionist Contrast (Pristine vs Ragged):** The signature aesthetic of the flat ruling pen is radical edge asymmetry. One flank rides smoothly along the rigid steel edge, producing a razor-sharp, pristine contour. Meanwhile, the opposing unconstrained sheet vibrates furiously against the paper, throwing out aggressive comb teeth that can expand up to **300%** of the nominal stroke width.
- **One-Sided Directional Spit Showers:** When sheet tension snaps, ink splatters are propelled exclusively outward from the ragged flank, creating a dynamic directional spray pointing in the stroke direction.
- **Transverse Chisel Stripes:** Interior fill is composed of dense, high-frequency rectangular stripes oriented strictly perpendicular to stroke movement, capturing the authentic flat metal stamp texture.

#### Visual Calibration Specimen Matching
- **Reference Specimens:** `_Reference/ruling_pen_calibrations/fig2_flat_ruling_pen.jpg`, `fig3_flat_ruling_curved_strokes.jpg`, `reference-images/Rulling Pen/rulling-pen-medium-flat-nib-large.jpg`.
- **Physical Matching:**

| Physical Photographic Feature | InkDynamics Simulation Parameter | Calibrated Value Range | Visual Outcome |
| :--- | :--- | :--- | :--- |
| Edge Asymmetry Contrast | `rf.edgeAsymmetry` | `0.0` (Symmetric) – `1.0` (100% Asymmetric) | Controls sharpness contrast between opposing flanks. |
| Ragged Flank Selection | `rf.asymmetrySide` | `'right'` or `'left'` | Governs which edge receives comb teeth and splatters. |
| Comb Teeth Amplitude | `rf.chatterIntensity` | `0.0` – `3.00x` (Default: `1.35x`) | Multiplier for perpendicular tooth flare (up to 3x width). |
| Transverse Stripe Density | `rf.skipSensitivity` | `0.20x` (Dense Comb) – `2.50x` (Wide Skips) | Spacing between perpendicular rectangular stamps. |
| One-Sided Clapping Bursts | `rf.snapIntensity` | `0.0` – `2.50x` (Default: `1.00x`) | Frequency and volume of lateral spit explosions. |
| Burst Explosion Width | `rf.burstExplosionWidth` | `1.0x` – `4.0x` (Default: `2.20x`) | Momentary perpendicular swell multiplier during snapping. |
| Max Spit Droplet Size | `rf.maxDropletSize` | `1.5px` – `14.0px` (Default: `3.5px`) | Maximum size of directional provenance ellipses. |

#### Calibration Presets
1. `flat_ruling_point`: Point mode hairline (1.0px radius, 0% asymmetry, pristine hairline).
2. `flat_ruling_medium`: Benchmark chisel ribbon (8.0px radius, 92% asymmetry, right ragged comb).
3. `flat_ruling_broad`: Monumental Expressionist chisel (14.0px radius, 96% asymmetry, 3x comb teeth, explosive one-sided spit showers).

---

## 4. Parameter Cross-Reference Table

| Parameter Key | Affected Tool(s) | Type | Default | Range | Description / Physical Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `tool` | All | `string` | `'chinese_brush'` | 4 tools | Active drawing instrument engine. |
| `preset` | All | `string` | Tool default | 13 presets | Curated physical calibration setting. |
| `color` | All | `string` | `'#191817'` | Hex / token | Saturated pigment color (Inkwell token compatible). |
| `thickness` | All | `number/string` | `'medium'` | 1.0 – 32.0 px | Nominal base nib radius (Ø = $2 \times r$). |
| `paperTooth` | All | `number` | `0.45` | 0.0 – 1.0 | Microscopic paper roughness / tooth friction. |
| `slowEngorgeRatio` | Chinese, Posca | `number` | `1.85` / `1.05` | 1.0 – 5.0x | Swelling multiplier during slow/dwell movements. |
| `fastThinRatio` | Chinese Brush | `number` | `0.45` | 0.05 – 0.95 | Lower floor of line width at maximum speed. |
| `depletionRate` | Chinese Brush | `number` | `1.00` | 0.20 – 2.50 | Starvation onset speed for Flying White striations. |
| `refillRate` | Chinese Brush | `number` | `0.85` | 0.40 – 3.00 | Capillary replenishment rate as speed decreases. |
| `starveEaseIn` | Chinese Brush | `number` | `110` | 30 – 300 px | Travel distance from full saturation to dry track. |
| `starveEaseOut` | Chinese Brush | `number` | `85` | 20 – 250 px | Travel distance needed to regain solid ink core. |
| `numBristles` | Chinese Brush | `number` | `36` | 16 – 54 | Discrete hair filaments simulated in tuft. |
| `boneHeadFlare` | Chinese Brush | `number` | `1.85` | 1.0 – 2.8x | Touchdown flare factor forming tibia head. |
| `fastWaistRatio` | Posca Squeezer | `number` | `0.88` | 0.65 – 0.98 | Minimum waist ratio at high velocity (monoline). |
| `borderStarveSensitivity` | Posca Squeezer | `number` | `0.85` | 0.0 – 2.20 | Tooth starvation along curved outer felt dome edges. |
| `initialDomeFlare` | Posca Squeezer | `number` | `1.15` | 1.0 – 1.50x | Circular foam dome compression on contact. |
| `dripThreshold` | Posca Squeezer | `number` | `0.35` | 0.15 – 0.80 s | Dwell hesitation time required to spawn a drip. |
| `dripWidthRatio` | Posca Squeezer | `number` | `0.32` | 0.10 – 0.55 | Ratio of drip line width relative to dome diameter. |
| `viscosity` | Posca Squeezer | `number` | `0.42` | 0.20 – 0.80 | Fluid resistance; dictates drip cascade speed. |
| `penMode` | Ruling Pens | `string` | `'blade'` | `'blade'/'point'` | Hairline point mode vs expressive blade mode. |
| `bladeAngle` | Ruling Pens | `number` | $\pi/4$ (45°) | 0 to $\pi$ rad | Physical orientation of the metal blade edge. |
| `chatterIntensity` | Ruling Pens | `number` | `1.25` / `1.35` | 0.0 – 3.0x | Soundwave ripple / comb teeth amplitude factor. |
| `skipSensitivity` | Ruling Pens | `number` | `1.00` | 0.20 – 2.50x | Train track friction skips: 0.2x dense to 2.5x wide. |
| `snapIntensity` | Ruling Pens | `number` | `1.00` | 0.0 – 2.50x | Spring clapping tension release spit multiplier. |
| `edgeAsymmetry` | Flat Ruling | `number` | `0.92` | 0.0 – 1.0 | Asymmetry contrast between pristine and ragged edges. |
| `asymmetrySide` | Flat Ruling | `string` | `'right'` | `'right'/'left'` | Side of the stroke exhibiting aggressive comb teeth. |
| `minWidthScale` | Ruling Pens | `number` | `0.25` / `0.35` | 0.10 – 1.0x | Minimum waisting floor scale during speed drags. |
| `maxWidthScale` | Ruling Pens | `number` | `2.00` | 1.0 – 3.5x | Maximum swell expansion ceiling factor. |
| `burstExplosionWidth` | Ruling Pens | `number` | `2.20` | 1.0 – 4.0x | Momentary perpendicular blowout at sheet clap. |
| `minSpitCount` | Ruling Pens | `number` | `4` | 2 – 15 | Minimum droplet count in a clapping spit burst. |
| `maxSpitCount` | Ruling Pens | `number` | `18` | 8 – 40 | Maximum droplet count in a clapping spit burst. |
| `maxDropletSize` | Ruling Pens | `number` | `3.5` | 1.5 – 14.0 px | Maximum radius of elongated provenance teardrops. |
| `overprintModel` | All (v4.0) | `string` | `'mix'` | `'mix'/'classic'` | The ink model: transparent ink that mixes (4.0) or the 3.9 darken model. |
| `blendMode` | All | `string` | `'multiply'` | `'multiply'/'source-over'` | Overprint on (mixing / darkening + capillary micro-swell) or flat opaque colour. |
| `inkDensity` | All | `number` | `0.97` (3.9: `0.94`) | 0.65 – 1.00 | Ink density / transparency: 3 % of the paper and the strokes beneath show through. |
| `overprintDarken` (`blendIntensity`) | All | `number` | `0.45` (3.9: `0.65`) | 0.00 – 1.00 | Blending intensity: how far a crossing goes toward the overprint (multiply) mix. |
| `overprintAttack` | All (v4.0) | `number` | `0.85` | 0.00 – 1.00 | Approach mix speed: how quickly the mix comes in once the nib meets ink beneath. |
| `overprintRelease` | All (v4.0) | `number` | `0.55` | 0.00 – 1.00 | Exit restore speed: how quickly the stroke's own colour returns after a crossing. |
| `overprintReach` | All (v4.0) | `number` | `0.75` | 0.20 – 1.50 × r | How much of the nib must be over ink beneath before it mixes. |
| `overprintSwell` | Per instrument (v4.0) | `number` | ruling `0.05` · Zig `0.075` · Posca `0.10` | 0.00 – 0.35 | Capillary width swell at crossings, by the ink's viscosity and drying. |
| `paperColor` | All (v4.0) | `string` | `'#FFFFFF'` | hex | The paper under the ink (what shows through). |

---

## 5. Mathematical Formulations

### 5.1 Volcano Pressure Release & Catenary Decay
When blade tension accumulates beyond threshold ($T \ge T_{\text{snap}}$), the stored elastic energy snaps the sheets shut, triggering an explosive perpendicular widening followed by a fast U-shaped catenary relaxation curve:

$$W(u) = 1.0 + (\text{burstExplosionWidth} - 1.0) \cdot e^{-5.2 u} - 0.22 \cdot \sin(\pi u)(1 - u)$$

where:
- $u \in [0, 1]$ represents normalized distance along the post-burst relaxation segment ($u = d_{\text{traveled}} / d_{\text{total}}$);
- $e^{-5.2 u}$ provides an immediate, sharp exponential decay from the peak blowout;
- $-\,0.22 \cdot \sin(\pi u)(1 - u)$ introduces a slight physical undershoot (ink starvation dip) before settling back smoothly to nominal stroke waisting ($W(1.0) = 1.0$).

### 5.2 Droplet Provenance Vector
Ballistic spit droplets ejected during sheet clapping radiate outward from origin $(x_0, y_0)$ to landed position $(x_d, y_d)$. The droplet's elongated ellipse major axis is aligned precisely along the provenance flight ray:

$$\theta_{\text{provenance}} = \text{atan2}(y_d - y_0,\, x_d - x_0)$$

This aligns the teardrop tail back to its exact point of release on the stroke spine, providing authentic ballistic evidence of sheet clapping.

### 5.3 Harmonic Paper Tooth Jitter
The pen-down pill-like contact stamp is synthesized via 24 perimeter control points perturbed by dual-frequency sinusoidal jitter:

$$J(\theta) = 1.0 + 0.045 \cdot \sin(6\theta + i) + 0.035 \cdot \cos(11\theta)$$

$$x(\theta) = r_{\text{major}} \cdot \text{sgn}(\cos\theta) \cdot |\cos\theta|^{0.90} \cdot J(\theta)$$

$$y(\theta) = r_{\text{minor}} \cdot \sin\theta \cdot J(\theta)$$

This ensures touchdown marks exhibit organic micro-roughness indistinguishable from genuine cold-press paper contact.

### 5.4 Ink That Mixes — Transparency, Overprint & Capillary Intersection Micro-Swell (v4.0, model `'mix'`)
For ink colour $C$, ink beneath $U$, paper $P$ and crossing strength $k \in [0, 1]$:

$$B = P + (U - P)\,k \qquad S = \rho\,C + (1-\rho)\,B \qquad M = \frac{C \cdot B}{255} \qquad D = S + (M - S)\,k\,I$$

where $\rho$ is `inkDensity` (0.97: 3 % of what lies beneath shows through), $I$ is `overprintDarken` (the blending
intensity) and $D$ is painted opaque (`'source-over'`), so the sub-steps of a stroke never build up. Every colour follows
the same rule (white and very light colours too). Black on Munken paper `#F4F1EA`: $D = 0.03\,P$ = `#070707`; two blacks
crossing: `#000000`.

The crossing strength follows the nib's **coverage** $c$ by ink beneath (the cells within `overprintReach` $\times\,r$ of
the nib's centre, measured in pixels, $\times 2$) along the stroke's length:

$$k \leftarrow k + (c - k)\left(1 - e^{-\Delta s / L}\right), \qquad L_{\text{in}} = r\,(0.12 + 3\,(1-a)^2), \quad L_{\text{out}} = r\,(0.25 + 12\,(1-b)^2)$$

with $a$ = `overprintAttack` (approach mix speed) and $b$ = `overprintRelease` (exit restore speed): the mix comes in fast
as the nib meets the ink and is given back slowly after it — the pigment picked up is carried on. A nib that lands in
ink mixes at once. The grid remembers, cell by cell, the ink beneath a stroke's own fresh ink, so the stroke still
"feels" the crossing while its nib covers it.

**Capillary micro-swell by ink:** $R_{\text{eff}}(s) = R_0\,(1 + \sigma\,k(s))$ with $\sigma$ the instrument's
`overprintSwell` — ruling pens $0.05$ (low-viscosity, fast-running, quick-drying ink), Zig brush $0.075$ (slow-running,
low-viscosity sumi), Posca mop $0.10$ (high-viscosity acrylic, pools most). Measured on the Zig: +7.5 % across a crossing.

### 5.5 The 3.9 Model (`'classic'`, kept)
First-pass ink pigment $C_0$ is lifted in perceptual sRGB space toward warm paper white $C_{\text{paper}} = (252, 250, 246)$
according to `inkDensity`:

$$C_{\text{1st}} = C_0 + (C_{\text{paper}} - C_0) \cdot \min\!\big(0.65,\, 1.15(1 - \rho_{\text{ink}})^{0.72}\big)$$

Sub-steps are composited with `'darken'` ($\min(C_{\text{1st}}, C_{\text{1st}}) = C_{\text{1st}}$); at crossings

$$C_{\text{cross}} = \text{lerp}\!\left(C_{\text{1st}},\, \frac{C_{\text{1st}} \cdot C_{\text{under}}}{255} \cdot (1 - 0.65\, d_{\text{darken}}),\, \min(1,\, 1.25\, d_{\text{darken}} \cdot \chi)\right)$$

and light ink (luminance > 0.80) is painted opaque with `'source-over'`. For the 3.9 look:
`setOverprint(CLASSIC_39)`.

---

## 6. Academic Citation & Research Reference

When referencing `InkDynamics` in scientific publications, journal papers, or research reports on assistive drawing, oculomotor interaction, and physical line simulation, please cite:

```bibtex
@software{amado2026inkdynamics,
  author       = {Amado, Pedro and Penedos-Santiago, Eliana and the SiX Research Project Team},
  title        = {{InkDynamics: Physical Fluid Dynamics, Friction, and Expressive Calligraphic Lines for Assistive Drawing}},
  month        = oct,
  year         = 2026,
  publisher    = {FBAUP / i2ADS},
  version      = {4.0.0},
  doi          = {10.54499/2023.11224.PEX},
  url          = {https://six.fba.up.pt/}
}
```

---
*SiX Research Project — Drawing for Social Re-connectivity (FCT 2023.11224.PEX) · Faculty of Fine Arts, University of Porto (FBAUP) & Research Institute in Art, Design and Society (i2ADS).*

