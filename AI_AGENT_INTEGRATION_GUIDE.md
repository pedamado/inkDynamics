# AI Coding Agent Integration Guide — InkDynamics v4.0

> **Target Audience:** Generative AI Coding Agents (**Google Antigravity / Gemini**, **Claude Code**, **OpenAI Codex**, **Cursor**, **Windsurf**) and human systems engineers integrating `InkDynamics` into host applications (such as **SiX Inkwell 20** or custom generative / eye-tracking drawing apps).
>
> Concept and design: Pedro Amado (FBAUP / i2ADS). Development: Google Gemini 3.8 Flash in Antigravity (1.0–3.9) and Anthropic Claude Opus 5.5 (4.0, October 2026).

---

## 1. What Changed in v4.0

**The ink mixes.** The default model (`overprintModel: 'mix'`) lays every colour slightly transparent and mixes inks where strokes cross, like an overprint:

1. **`inkDensity`** (default **0.97**, every instrument): 3 % of what lies beneath — the paper (`paperColor`) or earlier strokes — shows through. Black stays black (`#070707` on Munken paper); two blacks crossing are slightly blacker.
2. **`overprintDarken`** (alias **`blendIntensity`**, default 0.45): how far a crossing goes toward the multiply of the two inks (white over black → grey; yellow over sky blue → green).
3. **All colours behave the same** — white and very light colours too (the 3.9 light-ink bypass is `'classic'` only).
4. **`overprintAttack`** (approach mix speed, 0.85), **`overprintRelease`** (exit restore speed, 0.55), **`overprintReach`** (× nib radius, 0.75): the mix comes in fast as the nib meets the ink and is given back slowly after it.
5. **`overprintSwell` per instrument**: ruling pens 5 %, Zig brush 7.5 %, Posca mop 10 % (by the ink's viscosity and drying).
6. The **3.9 model** stays available: `overprintModel: 'classic'` (`setOverprint(CLASSIC_39)`).

Also new: **every instrument parameter** is applied by `createInkDynamics()` / `setConfig()` (3.9 ignored most); **agents with pens of their own** (`setAgentPen`); **user presets** (CRUD, `UserPresetStore`, permanent core presets); **`parseInkSettings()`** (reads pasted snippets without running them); **`InkRecorder`** (record what an instrument draws, replay it anywhere). See `CHANGELOG.md` for the fixes.

---

## 2. CRITICAL ARCHITECTURAL RULES FOR AI AGENTS

### ❌ Do not set `ctx.globalCompositeOperation = 'multiply'` (or a `globalAlpha`) in the host app
Every instrument stamps dozens of overlapping sub-paths per frame (36 bristles, 28 tracks, rails + ellipses). Under a naive Canvas2D `'multiply'` at 95 % alpha a single stroke multiplies against itself and turns opaque black on its first pass; `#ffffff` disappears under multiply; and blend modes never change the stroke's width. The library computes the transparency into the colour and paints it opaque — leave compositing to it.

### ❌ Do not hand a canvas you manage yourself to `createInkDynamics()`
The instance's engine **owns** its canvas: it sizes it to its CSS box × DPR, paints it with the paper colour on `clear()` (or empties it with `transparent: true`), and reads the whole canvas back after every stroke for its own undo. That is right for a drawing page of its own (the calibration lab), wrong for a host with tiles, its own undo, shared layers or a 360° ring.

### ✅ Hosts with their own surfaces drive the instruments directly (Inkwell 20)
```javascript
import { OverprintBlender, FluidDynamics, ChineseBrushV2, PoscaSqueezerV3, RulingPenCurved, RulingPenFlat,
         InkRecorder, applyInstrumentParams } from './vendor/inkdynamics/js/inkdynamics.js';

const ob = new OverprintBlender({ width, height, paperColor });   // ONE grid for the whole surface: every pen mixes with every other
const fluid = new FluidDynamics();                               // ONE drip simulation
const pen = new ChineseBrushV2({ preset: 'fine_low_var', overprintBlender: ob, agentId: 'person' });
pen.baseRadius = nibRadius;                                      // the host's own size (after applyPreset)
pen.color = '#E60000';                                           // the host's colour, as it is (any hex)

const rec = new InkRecorder();
pen.down({ x, y, time }, rec.begin(), fluid);                    // simulate ONCE, into the recorder
pen.move({ x, y, time }, dtSeconds, rec.ctx, fluid);
fluid.updateDrips(dt, (seg) => ob.paintDripSegment(rec.ctx, seg));
const { ops, box } = rec.take();                                 // what was drawn, and its bounding box
host.draw(box, (ctx) => InkRecorder.replay(ctx, ops));           // its tiles, its undo cells, the other windows
```
- One `OverprintBlender` per surface; one pen object per "hand" (the person, each boid, each AI or partner hand).
- When the host puts pixels back itself (undo, opening a drawing), rebuild the grid there: `ob.rebuildFromImageData(imageData, { x, y, scale })`. On clear: `ob.clear()`.
- Feed coordinates in a consistent unit: the instruments' speed thresholds were calibrated at ~40 px per degree of visual angle. If the host's surface has another density, scale coordinates into "library px" and scale the replay back.

---

## 3. The Simple Path: `createInkDynamics()`

```javascript
import { createInkDynamics } from './InkDynamics/js/inkdynamics.js';

const ink = createInkDynamics({
  canvas: document.getElementById('drawing-canvas'),
  tool: 'chinese_brush',              // 'chinese_brush' | 'posca_squeezer' | 'ruling_pen_curved' | 'ruling_pen_flat'
  preset: 'fine_low_var',             // see §7
  thickness: 'thin',                  // 'hairline' | 'thin' | 'medium' | 'thick' | 'broad' OR a radius in px
  color: '#191817',                   // any hex / rgb() — or a 3.x token ('black', 'red', 'blue', 'white')
  paperTooth: 0.45,
  // the ink's overprint & mixing (4.0 defaults)
  overprintModel: 'mix',
  blendMode: 'multiply',
  inkDensity: 0.97,
  overprintDarken: 0.45,              // = blendIntensity
  overprintAttack: 0.85,
  overprintRelease: 0.55,
  overprintReach: 0.75,
  paperColor: '#FFFFFF',
  // overprintSwell: each instrument's own unless given
  // …any instrument parameter: depletionRate, numBristles, viscosity, dripThreshold, bladeAngle, penMode, …
});
```

## 4. Runtime Control

```javascript
ink.setOverprintModel('mix');          // or 'classic'
ink.setBlendMode('multiply');          // 'source-over' / false: flat opaque
ink.setInkDensity(0.97);
ink.setBlendIntensity(0.45);           // = setOverprintDarken
ink.setOverprintAttack(0.85);
ink.setOverprintRelease(0.55);
ink.setOverprintReach(0.75);
ink.setOverprintSwell(0.075);          // the ACTIVE instrument's
ink.setPaperColor('#F4F1EA');
ink.setOverprint({ inkDensity: 0.97, overprintDarken: 0.45, overprintRelease: 0.4 });
ink.setConfig({ tool: 'posca_squeezer', preset: 'posca_squeezer_thin', viscosity: 0.6, dripThreshold: 0.45 });
const cfg = ink.getConfig();           // tool, preset, colour, every overprint value, rawSettings (exportSettings())
```

## 5. Agents (Boids)

```javascript
ink.penDown(x, y, 0.5, now, 0);                       // agent 0: the main pen (the person)
ink.penMove(boid.x, boid.y, dt, 0.5, now, 1);         // agents 1..8 mirror the main pen …
ink.setAgentPen(2, { preset: 'posca_squeezer_thin', color: '#E60000', thickness: 5 });   // … or have their own
ink.setAgentPen(2, null);                             // back to the main pen
```
All agents share the overprint grid: their strokes mix with each other's.

## 6. Presets & Expert Settings

```javascript
import { UserPresetStore, localStorageAdapter, httpAdapter, listPresets, parseInkSettings, validateInkSettings } from './InkDynamics/js/inkdynamics.js';

const store = new UserPresetStore({ adapter: localStorageAdapter() });   // or httpAdapter({ endpoint, token }), or { load(), save(list) }
const p = await store.create({ name: 'Wet Zig', ...ink.presetSnapshot() });
ink.applyPreset(p);                                   // or 'fine_low_var'
const menu = listPresets(await store.list());         // 13 core (permanent) + the user's

// an "expert" field: never eval() what a person pastes
const { settings, unreadable, error } = parseInkSettings(text);
const { settings: clean, warnings } = validateInkSettings(settings);
ink.setConfig(clean);
```

## 7. The 13 Core Presets (permanent)

| Tool (`tool`) | Preset (`preset`) | Base radius (px) | Character |
| :--- | :--- | :---: | :--- |
| `chinese_brush` | `fine_low_var` | 3.5 | Fine, low width variation; thins at speed but never vanishes |
| `chinese_brush` | `fine_thick_high_contrast` | 4.5 | Thin at speed, swelling into high-contrast knots when slow |
| `chinese_brush` | `medium_high_dynamic` | 10.0 | Bone-head starts, long starvation stripes, flicks or swollen ends |
| `chinese_brush` | `medium_uniform_starvation` | 9.0 | Uniform width, crisp longitudinal starvation tracks |
| `posca_squeezer` | `posca_squeezer_thin` | 6.0 | Ø 12 px monoline, subtle flank starvation |
| `posca_squeezer` | `posca_squeezer_medium` | 12.0 | Ø 24 px heavy saturated stroke, gravity drips on dwell |
| `posca_squeezer` | `posca_squeezer_thick` | 22.0 | Ø 44 px jumbo, heavy pooling and drips |
| `ruling_pen_curved` | `curved_ruling_fine` | 1.25 | Point mode: constant hairline, no chatter |
| `ruling_pen_curved` | `curved_ruling_medium` | 7.0 | Blade: chatter, train-track skips, spit bursts |
| `ruling_pen_curved` | `curved_ruling_broad` | 13.0 | Broad expressive blade, explosive spits |
| `ruling_pen_flat` | `flat_ruling_point` | 1.0 | Point mode hairline |
| `ruling_pen_flat` | `flat_ruling_medium` | 8.0 | Chisel ribbon, asymmetric edges |
| `ruling_pen_flat` | `flat_ruling_broad` | 14.0 | Broad chisel, one-sided spit showers |

## 8. Checklist for Agents Updating Host Apps (e.g. Inkwell)

1. Pass the host's colour as it is (`pen.color = hex` / `ink.setColor(hex)`); the library makes it transparent and mixes it.
2. Set the paper: `paperColor` — what shows through the ink.
3. Size: map the host's thickness to the nib radius **after** applying a preset (`applyPreset` resets `baseRadius`).
4. Never composite with `'multiply'` yourself; never re-simulate a stroke to draw it twice (record once, replay).
5. Keep the grid in step with the pixels: `ob.clear()` on clear, `ob.rebuildFromImageData()` after undo / open.
6. Read pasted settings with `parseInkSettings()`; never `eval`.
7. Credit: concept and design by Pedro Amado (FBAUP / i2ADS); development by Google Gemini 3.8 Flash in Antigravity and Anthropic Claude Opus 5.5 (October 2026).
