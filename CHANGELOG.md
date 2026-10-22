# Changelog — InkDynamics

All notable changes to the **InkDynamics** library and calibration lab are documented in this file.
The project adheres to [Semantic Versioning](https://semver.org/).

---

## [4.0.0] — 2026-10-17
Requested by Pedro Amado for Inkwell 20 (2026-10-17): ink with a slight transparency that *mixes* where strokes cross
(an overprint / multiply effect), black that stays black, very light colours behaving like every other colour, a
crossing swell of 5–10 % that depends on the ink, every effect tunable, and people's own pens kept for good.
Development of this release: Anthropic Claude Opus 5.5 (October 2026), after Google Gemini 3.8 Flash in Antigravity
(1.0–3.9). Concept and design: Pedro Amado (FBAUP / i2ADS).

### Added
- **The `'mix'` ink model (`OverprintBlender`, new default — `overprintModel: 'mix'`):**
  - Every colour is laid at `inkDensity` (default **0.97**, for every instrument): what lies beneath — the paper
    (`paperColor`) or earlier strokes — shows through 3 %. The see-through is computed into the colour and the ink is
    painted opaque (`'source-over'`), so the sub-steps of one stroke never build up (no bands) and the result is the
    same on an opaque canvas or a transparent layer. Black on white paper: `#080808`; on Munken `#F4F1EA`: `#070707`.
  - At crossings the two inks **mix like an overprint**: the colour goes toward `C × U / 255` (multiply) as far as the
    **blending intensity** (`overprintDarken`, default 0.45; alias `blendIntensity`). Two blacks cross slightly
    blacker (`#000000`); white over black turns grey; yellow over sky blue turns green; red over yellow stays red.
  - **All colours behave the same way** (white and very light colours too — the 3.9 light-ink bypass is `'classic'`
    only).
  - The crossing envelope is distance-based: **`overprintAttack`** (approach mix speed, default 0.85 — the mix comes in
    within a fraction of the nib's radius once the nib meets the ink), **`overprintRelease`** (exit restore speed,
    default 0.55 — the pigment picked up is carried on over ~2–3 nib radii), **`overprintReach`** (how much of the nib
    must be over ink beneath, default 0.75 × the radius). Coverage is measured in pixels, not whole cells, and a
    stroke keeps knowing the ink under its own fresh ink while its nib still covers it.
  - Running drips mix with the strokes they run over (never with their own) and are recorded in the overprint grid.
  - `'classic'` (3.9: lift toward a warm white, `'darken'` sub-steps, light-ink cover) stays available:
    `setOverprint(CLASSIC_39)` (`{ overprintModel: 'classic', inkDensity: 0.94, overprintDarken: 0.65 }`).
- **Crossing micro-swell by ink** (`overprintSwell` per instrument): ruling pens 5 % (low-viscosity, fast-running,
  quick-drying ink), Zig Chinese brush 7.5 % (slow-running, low-viscosity sumi), Posca mop 10 % (high-viscosity
  acrylic). `setOverprintSwell()` sets the active instrument's; `setInstrumentSwell(id, v)` any one's;
  `getSwellFactor(intensity, swell)` takes the instrument's value.
- **New settings everywhere** (`createInkDynamics()` options, `setConfig()`, `getConfig()`, `exportSettings()` /
  `applySettings()`, the engine): `overprintModel`, `overprintAttack`, `overprintRelease`, `overprintReach`,
  `paperColor`, `blendIntensity`; setters `setOverprintModel()`, `setOverprintAttack()`, `setOverprintRelease()`,
  `setOverprintReach()`, `setPaperColor()`, `setBlendIntensity()`; `OVERPRINT_DEFAULTS`, `OVERPRINT_RANGES`,
  `CLASSIC_39`; `OverprintBlender.getSettings()`, `endStroke()`, `paintDripSegment()`,
  `rebuildFromImageData()` (hosts that put pixels back themselves — undo, opening a drawing, another person's layer);
  constructor options `cellSize` (cells in a host's own px) and `wrap` (a ring surface: the 360° canvas — lookups and
  stamps wrap at the grid's width).
- **User presets kept for good — `js/presets/UserPresetStore.js`:** create · read · update · delete · export ·
  import; a user preset is a core preset (`basePreset`) + the values changed (validated). Adapters:
  `localStorageAdapter()` (default, this browser), `memoryAdapter()`, `httpAdapter({ endpoint, token })`, or any
  `{ load(), save(list) }`. **`server/presets.php`** — a reference endpoint (flat-file JSON per collection, write
  token stored as a hash, same-origin / allow-listed CORS, atomic writes, the library's validation in PHP) with
  `presets.config.sample.php` and `server/README.md`.
- **The 13 core presets are permanent — `js/presets/PresetCatalog.js`:** deep-frozen; `CORE_PRESETS`,
  `INK_INSTRUMENTS`, `corePreset()`, `toolOfPreset()`, `isCorePreset()`, `listPresets()` (core + user),
  `presetToConfig()`; on the instance `applyPreset(preset)` and `presetSnapshot()`.
- **Settings parser — `js/core/SettingsParser.js`:** `parseInkSettings(text)` reads the lab's "1-Line Call", "Config
  JSON", `ink.setConfig({…})` or a bare `key: value` list **without running it** (no `eval` / `Function`; numbers,
  strings, `Math.PI` arithmetic, comments); `validateInkSettings()` keeps known keys in range and reports the rest;
  `formatInkSettings()`; `INK_SETTING_KEYS`, `INK_SETTING_ALIASES`. For host "expert" fields (Inkwell 20).
- **`js/core/InkRecorder.js`:** a write-only stand-in context that records what an instrument draws (and its bounding
  box), so a host draws the same ink onto tiles, a 360° seam or another window without simulating it again
  (4 instruments + drips: 0 differing pixels on replay); `InkRecorder.valid()` checks ops from elsewhere.
- **Agents with pens of their own:** `setAgentPen(agentId, { tool, preset, color, thickness | radius, … })` and
  `getAgentPen()`; agents without one still mirror the main pen (3.9 behaviour).
- **`applyInstrumentParams(inst, tool, cfg)`** (exported) and `engine.exportInstrumentSettings(id)`.
- **Engine `transparent` option:** `clear()` empties a transparent layer instead of painting paper.
- **Calibration lab:** the **Ink Overprint & Mixing (v4.0)** panel — Ink Model, Overprint on/off, Ink Density,
  Blending Intensity, Approach Mix Speed, Exit Restore Speed, Crossing Reach, Crossing Swell (this ink), paper colour
  swatches (Inkwell 20's papers) + picker, Inkwell 20's Base palette among the ink swatches; **★ My Presets** (Save as
  New, Update, Rename, Delete — two clicks, Export / Import `.json`, kept in this browser or on a server); the preset
  menu lists *My Presets* after the 13 core ones; the snippet now carries **every** value of the pen.
- **`specimen_ink_blending.html` (v4.0):** all the new controls, the paper, a "3.9 classic vs 4.0 mix" matrix, and a
  new section — Inkwell 20's Base palette crossed with itself (white included).
- **`test_v4.js`:** 73 checks (the mix model, classic kept, settings, envelope, swell by ink, the recorder, the parser —
  nothing executed —, every parameter applied, per-agent pens, presets CRUD + frozen core presets, the fixes below, a
  ring's seam).

### Fixed (from the 4.0 analysis of 3.9)
- `createInkDynamics()` options and `setConfig()` silently ignored most instrument parameters (Zig: `slowEngorgeRatio`,
  `fastThinRatio`, `depletionRate`, `refillRate`, `starveEaseIn/Out`, `numBristles`, `boneHeadFlare`; Posca:
  `fastWaistRatio`, `flowRate`, `viscosity`, `dripThreshold`, `borderStarveSensitivity`, `initialDomeFlare`; ruling
  pens: `penMode`) — so the lab's snippets did not reproduce a tuned pen. All are applied now (validated).
- `applySettings()` re-applied the active preset last and threw away the active instrument's tuned values on every
  reload of the lab.
- Engine undo / redo restored pixels but not the overprint grid: later strokes "crossed" ink that had been undone. Each
  history state now keeps the grid too; the history is also capped in bytes (`maxHistoryBytes`, 320 MB).
- The engine's overprint grid kept the blender's default 1600 × 1200: on larger canvases strokes never overprinted past
  it. It follows the canvas (and is rebuilt from the pixels on `resize()`).
- `pointerMove()` measured dt from the animation loop's clock, so the pen read as faster than it was (thinner, more
  starved strokes with real pointers). It has its own clock now.
- `RulingPenFlat` read an undefined `strokeDistance`: NaN arc lengths in the grid, and its strokes never overprinted
  their own earlier loops (`Instrument.strokeDistance` now aliases `strokeLength`).
- Posca drips were spawned with the already-lifted first-pass colour and lifted again when drawn (paler drips); they
  carry the ink itself and the stroke they come from now.
- `PoscaSqueezerV3` never aligned its tracks across the first move (`points.length <= 1` could not hold).
- `setOverprintDarken()` / `setOverprintSwell()` let NaN through (`Number(x) ?? d` never falls back) and broke every
  colour; non-numbers keep the current value now.
- `OverprintBlender` kept every stroke's state for ever, and an agent number could collide with a stroke number in its
  state map; states are per agent / per stroke, and an agent's new stroke forgets its previous one.
- Zig bristle ribbons (butt caps) met edge to edge, and their anti-aliased ends left faint light seams across the stroke
  every 2 px; each ribbon starts 0.6 px back over the previous sub-step.
- `index.html`: the Zig reference panel was never closed, so the two ruling-pen panels sat inside it and their tabs
  showed nothing.

### Changed
- Defaults: `inkDensity` 0.94 → **0.97**, `overprintDarken` 0.65 → **0.45** (in the mix model it is the blending
  intensity), the model `'mix'`. The lab keeps its last state under a new key (`inkdynamics_v4_settings`); a 3.x state is
  read without its overprint values, so the 4.0 defaults apply.
- `setOverprintSwell()` on the engine / instance sets the **active instrument's** swell (3.9: one global value). A 3.9
  settings object with one `overprintSwell` applies it to every instrument.
- Credits: concept and design by Pedro Amado (FBAUP / i2ADS); development by Google Gemini 3.8 Flash in Antigravity and
  Anthropic Claude Opus 5.5 (October 2026).
- `docs/INKWELL_INTEGRATION.md` rewritten for what **Inkwell 20.2.0** does with 4.0 (the 3.9 draft planned one facade
  instance on Inkwell 19's canvas): the two ways in (the facade · the instruments + `InkRecorder`), Inkwell's adapter
  (`js/ink.js`): one blender per surface, library px (× 40 / ppd), a pen per hand, strokes → recorded marks, Rigid at an
  even pace, the grid following undo / clear / open (`rebuildFromImageData`), the 360° ring; the expert line; user
  presets in an account or the browser; agents; the settings table; checks; the facade's quick start.
- Used by **Inkwell 20.2.0** (17 October 2026): a copy of `js/` in `inkwell-20/vendor/inkdynamics@4.0.0/`.

---

## [3.9.0] — 2026-10-16
### Added & Calibrated
- **Optical Multiply Overprint & Capillary Intersection Micro-Swell Engine (`OverprintBlender.js`):**
  - Implemented `OverprintBlender` (`js/physics/OverprintBlender.js`) shared across all 4 instruments (`ChineseBrushV2`, `PoscaSqueezerV3`, `RulingPenCurved`, `RulingPenFlat`) and all multi-agent boid channels (`agentId`).
  - **Sub-Step Normalization (Solving the Canvas2D Self-Multiplication Trap):** Lifts 1st-pass ink color in perceptual sRGB space according to `inkDensity` (default `0.94` / `94%`) and composites sub-steps using `'darken'` ($\min(C_{\text{1st}}, C_{\text{1st}}) = C_{\text{1st}}$). This guarantees that 20–36 overlapping bristles, tracks, or ellipses within a single stroke never self-multiply into internal dark bands while preserving darker intersections underneath.
  - **4px Arc-Length Tagged Spatial Ink Grid:** Tracks `(strokeId, arcLength, R, G, B, layers)` across the canvas in $O(1)$ time with zero GPU `getImageData` readbacks. Distinguishes immediate wet sub-steps from true intersections (either a different `strokeId` or an earlier loop of a continuous eye-gaze/boid stroke where $\Delta s > \max(26\text{px}, 4.2 \cdot r)$).
  - **Optical Multiply Darkening (`overprintDarken`):** Computes true RGB pigment multiplication $(C_s \cdot C_d)/255$ scaled by `overprintDarken` (default `0.65` / `+65%`), darkening 94% charcoal strokes to ~99.8% rich black and blending chromatic inks (e.g., Vermilion Red × Prussian Blue) at crossings.
  - **Capillary Intersection Micro-Swell (`overprintSwell`):** Dynamically expands stroke width/radius by $1 + \text{overprintSwell} \cdot \chi$ (default `0.08` / `+8%`, up to `+30%`) with smooth attack/release as the nib crosses pre-wetted paper fibers.
  - **White Ink Safeguard:** Automatically detects light/white ink (`luminance > 0.80`, e.g., `#ffffff` overpaint in Inkwell) and falls back to `'source-over'` so white strokes remain 100% opaque over dark ink.
- **Host Application & Library API (`createInkDynamics` / `InkDynamicsEngine`):**
  - Added configuration options: `blendMode` (`'multiply'` | `'source-over'`), `inkDensity` (`0.65`–`1.00`), `overprintDarken` (`0.00`–`1.00`), and `overprintSwell` (`0.00`–`0.30`).
  - Added runtime setters: `setBlendMode()`, `setInkDensity()`, `setOverprintDarken()`, `setOverprintSwell()`, and batch `setOverprint({...})`.
  - Included overprint settings in `getConfig()`, `setConfig()`, `exportSettings()`, and `applySettings()`, plus undo/clear snapshot synchronization.
- **Calibration Toolbar & Live Snippet Generator (`Toolbar.js`):**
  - Added the **Ink Overprint & Blending (v3.9)** panel with Pigment Color swatches + custom color picker, Overprint Blend Mode toggle (`Multiply Overprint + Swell (ON)` vs `Flat Opaque Source-Over (OFF)`), 1st-Pass Ink Density slider, Crossing Multiply Darken slider, and Crossing Micro-Swell slider.
  - Updated the live `1-Line Call` and `Config JSON` snippet box to dynamically include `blendMode`, `inkDensity`, `overprintDarken`, and `overprintSwell`.
- **New Overprint Specimen Lab & AI Coding Agent Integration Guide:**
  - Created `specimen_ink_blending.html` to test and verify crossed hatches, chromatic overprinting, continuous self-crossing figure-8 loops, and parameter sweeps across all 4 instruments (preserving `specimen_ruling_pens.html` untouched).
  - Authored `AI_AGENT_INTEGRATION_GUIDE.md` for AI coding agents (Antigravity Gemini, Claude Code, Codex) detailing v3.9 architecture and host integration.

---

## [3.8.0] — 2026-10-14
### Added & Calibrated
- **Pen-Down Organic Pill Ellipse Stamp:**
  - Replaced the circular pen-down blob with an irregular "pill-like" ellipse oriented at `bladeAngle` (e.g. 60°).
  - Major radius scales with nib radius, while minor radius remains narrow to mimic physical metal plate edge touchdown.
  - Implemented 24-point harmonic paper tooth micro-irregularity to prevent artificial computer geometry.
- **Inverted Friction Skips Sensitivity & Intuitive Endpoint Labels:**
  - Re-mapped `skipSensitivity` calculation (`* skipSensitivity` instead of dividing), ensuring lower values produce dense, compact lines and higher values produce wide friction skips.
  - Corrected UI endpoints to `Dense Line (0.2x)` and `Wide Skips (2.5x)` for both curved and flat ruling pens.
- **Volcano Pressure Release Dynamics & Fast U-Shaped Catenary Decay:**
  - Blade tension release triggers a momentary perpendicular stroke blowout governed by `burstExplosionWidth` (1.0x to 4.0x).
  - Post-burst recovery follows a fast U-shaped catenary curve: $W(u) = 1.0 + (\text{burstExplosionWidth} - 1.0) \cdot e^{-5.2 u} - 0.22 \cdot \sin(\pi u)(1 - u)$, easing through compact steps into wider skips, dipping slightly below waisting before recovering smoothly to nominal width.
- **Directional Provenance Spit Droplets:**
  - Spit burst droplets are now rendered as elongated teardrop ellipses oriented along the provenance ray vector back to their exact burst origin point on the stroke line ($\text{atan2}(y - y_0, x - x_0)$).
- **Comprehensive Ruling Pen Calibration Controls in UI:**
  - Added Min Waisting Scale slider (`minWidthScale`, 0.10x–1.0x).
  - Added Max Swell Scale slider (`maxWidthScale`, 1.0x–3.5x).
  - Added Burst Explosion Width slider (`burstExplosionWidth`, 1.0x–4.0x).
  - Added Min Spit Droplets slider (`minSpitCount`, 2–15) and Max Spit Droplets slider (`maxSpitCount`, 8–40).
  - Added Max Droplet Size slider (`maxDropletSize`, 1.5px–14.0px).
- **Snippet Generator & Public API:**
  - Extended `InkDynamicsInstance` with setters: `setMinWidthScale`, `setMaxWidthScale`, `setMinSpitCount`, `setMaxSpitCount`, `setMaxDropletSize`, `setBurstExplosionWidth`, `setSkipSensitivity`, `setSnapIntensity`.
  - Updated both `1-Line Call` and `Config JSON` generator modes in the toolbar to serialize and restore all new parameters.

---

## [3.7.0] — 2026-10-14
### Added
- **Interactive 3rd-Party Snippet Generator:**
  - Added a live code snippet field in the toolbar with toggle pills for `1-Line Call` (`createInkDynamics({...})`) and `Config JSON` (`ink.setConfig({...})`).
  - Automatically updates whenever any parameter slider, select, or preset is modified in the interface.
  - "Copy Snippet" button with animated feedback ("Copied!") and auto-text selection on click.
- **S.iX Research & Creative Direction Credits:**
  - Added permanent credits to **Pedro Amado** (FBAUP / i2ADS) as creative director, expressive line architect, and dynamic agents lead within the **SiX Research Project** team (*«Drawing for Social Re-connectivity»*, FCT 2023.11224.PEX).
  - Integrated a dedicated **About Modal** in `index.html` detailing project history, assistive drawing purpose, physical instrument mechanics, and community open-source vision.
  - Authored a standalone `about.html` page with full institutional, team, and funding credits.
- **Comprehensive Documentation Suite:**
  - Authored `PRD.md` (Product Requirements Document), `README.md` (GitHub repository documentation), `CHANGELOG.md`, `LICENSE` (MIT), and `.gitignore`.
  - Updated `docs/INKWELL_INTEGRATION.md` for seamless integration into Inkwell v19+ and multi-agent boid networks.
- **Full Node Test Suites:**
  - Automated test runner verifying both Posca v3 and Ruling Pens v3.6 passing 100%.

---

## [3.6.0] — 2026-10-14
### Added
- **Photographic Specimen Calibration for Ruling Pens:**
  - Calibrated against physical macro photographic scans of German Expressionist folded brass pens and curved cola pens on cold-press and smooth paper.
  - **Flat Ruling / Chisel Pen:**
    - High-density compact rectangular stripes perpendicular to stroke path generating a busy "soundwave" waveform edge.
    - Extreme edge asymmetry: one flank is pristine and razor-sharp, while the opposing flank exhibits aggressive comb teeth flaring outward up to 3x nominal stroke width.
    - One-sided directional spit explosions blasting outward from the ragged flank.
  - **Curved Ruling / Folded Pen:**
    - Bilateral rhythmic soundwave chatter ripples oscillating symmetrically on both flanks.
    - "Ellipses on train tracks" friction skips: twin outer rail drag marks with transverse elliptical cross-bars whose spacing widens as velocity increases.
    - Fan-shaped clapping spit droplet bursts ejecting laterally to both flanks when blade tension releases.
- **Solid Saturated Ink Rendering (Zero Gray Washes):**
  - Removed all semi-transparent gray washes, fuzzy fills, and semi-transparent alpha drops.
  - All marks, teeth, tracks, and droplets now render in 100% solid saturated ink pigment matching genuine Indian ink and gouache.

---

## [3.5.0] — 2026-10-13
### Added
- **Ruling Pen Instrument Family (Curved & Flat):**
  - Introduced two distinct physical ruling pen engines: `RulingPenCurved` and `RulingPenFlat`.
  - Point mode: razor-thin, constant hairline without width modulation or gravity drips.
  - Blade mode: highly expressive, angle- and speed-dependent broad strokes.
  - Added calibration presets: `curved_ruling_fine`, `curved_ruling_medium`, `curved_ruling_broad`, `flat_ruling_point`, `flat_ruling_medium`, `flat_ruling_broad`.
  - Expanded reference modal with photographic comparison tabs for all 4 physical tools.

---

## [3.0.0] — 2026-10-13
### Added
- **Standalone InkDynamics Library Architecture:**
  - Extracted core drawing mechanics into a standalone, zero-dependency library (`inkdynamics.js`).
  - Single-line factory initialization via `createInkDynamics(options)`.
  - Fully compatible with Inkwell v18/v19 token maps (`INKWELL_COLORS`, `INKWELL_THICKNESS`).
- **Posca Mop Squeezer (v3):**
  - Modeled pressurized porous sponge dome filled with dense opaque acrylic paint.
  - Perfectly regular circular dome contact stamps on touchdown.
  - Longitudinal flow vectors aligned strictly in the direction of the stroke segment, eliminating transverse butt-cap artifacts.
  - Border starvation stripes where outer dome flanks skip micro-tooth on paper while center remains 100% solid black.
- **Authentic Gravity Drips (No Terminal Dot Artifacts):**
  - Dwell-based puddle accumulation triggering fluid gravity descent.
  - Downward drip lines feature gentle organic tapering and terminate in a natural round cap without artificial spherical dots.
  - Drip width ratio slider parameterizing drip thickness proportionally to the dome diameter across thin, medium, and broad/jumbo nibs.
- **Multi-Agent / Boid Parallel Channels:**
  - Multi-agent stroke separation (`agentId` 0–7) preventing state cross-talk between user gaze and autonomous boid agents.

---

## [2.0.0] — 2026-10-12
### Added
- **Zig Chinese Calligraphy Brush (v2):**
  - Capillary multi-bristle hair bundle simulation with speed-dependent starvation.
  - Asymmetric "tibia bone-head" touchdown contact flare.
  - Speed waisting and deceleration engorgement.
  - Paper tooth friction and starvation recovery ease-in/ease-out.
  - Glassmorphic laboratory interface with physics telemetry HUD.

---

## [1.0.0] — 2026-05-18 to 2026-08-24
### Added
- **Initial SiX Expressive Line Prototypes:**
  - Initial prototypes developed by Pedro Amado within the SiX research project exploring dynamic line width, fluid hesitation pooling, and boid-driven drawing agents in early builds (`boids-05`, `single-inkwell-07`, `full-demo-08`, `gaze-draw-12`).
