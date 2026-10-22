# Integrating inkDynamics 4.0 into Inkwell 20 — and into other host apps

**Inkwell 20.2.0** (17 October 2026) draws with **inkDynamics 4.0.0**. This guide describes how it does that, so the same
approach can be repeated, updated or reviewed. It also covers the simpler way in, for a page that lets the library own
its canvas.

> **This replaces the 3.9 draft.** That draft planned a single `createInkDynamics({ canvas })` instance drawing straight
> onto one canvas inside Inkwell 19. A host like Inkwell has a tiled surface, undo by cells, a 360° ring with a seam,
> and a shared drawing between windows, so it cannot hand its canvas to the library. Inkwell 20 therefore drives the
> **instruments** itself and records what they draw (§2). For a page that has a single canvas, the facade (§8) is
> still the quickest route.

---

## 1. Two ways in

| | **A — the facade** `createInkDynamics()` | **B — the instruments** (Inkwell 20's way) |
|---|---|---|
| Who owns the canvas | the library (`InkDynamicsEngine`: paper, history, undo) | the host (its own surface, tiles, undo, export) |
| Drawing | `penDown` / `penMove` / `penUp` (x, y, dt, agentId) | `pen.down` / `move` / `up` into an **`InkRecorder`**; the host paints the recorded ops where it needs them |
| The mix where strokes cross | the engine's own `OverprintBlender` | **one** `OverprintBlender` for the host's surface, shared by every pen |
| Agents (boids) | `agentId` 1–8: mirror the main pen, or `setAgentPen(id, cfg)` | one instrument per hand, each with its own `agentId` |
| Drips | `step(dt)` | one `FluidDynamics`; `updateDrips` → `blender.paintDripSegment(recorderCtx, seg)` |
| Shared drawing | `onMark` sends approximate marks (`b` / `s` / `d`) | the recorded ops **are** the mark: other windows replay the same pixels |
| Use it for | a standalone page, a quick prototype | a host app with its own surface model |

---

## 2. How Inkwell 20.2 does it — `inkwell-20/js/ink.js`

| File | Role |
|---|---|
| `vendor/inkdynamics@4.0.0/` | a byte-for-byte copy of this library's `js/` modules + `LICENSE` (hashes in `vendor/README.md`) |
| `js/ink.js` | **the adapter**: the blender, a pen per hand, the expert line, strokes → marks, the library-px scale, the ring's offset |
| `js/pens.js` | *my pens* — `UserPresetStore` with an account adapter (server) or the browser |
| `js/marks.js` | paints a mark `{ t: 'k' }`: `InkRecorder.replay`; checks a mark from another window once (`InkRecorder.valid`) |
| `js/surface.js` | tells the ink when it puts pixels back itself (`onPixels`: clear · full · cells) |
| `js/engine.js` | moves the hands (the person's 1€-filtered gaze, the boids, the AI studio's agent) and asks `ink` for their marks |
| `api/lib/pens.php` | the account's pens: `pens.mine` / `pens.save`, checked as `SettingsParser` checks them |

### 2.1 One blender for the surface

```js
const L = 40 / ppd;                       // library px per surface px (the library was calibrated at ~40 px per degree)
this.ob = new OverprintBlender({
  width: surface.width * L, height: surface.height * L,
  cellSize: 4 * L,                        // the grid's cells stay 4 surface px
  wrap: !!surface.wrap,                   // 20c: the 360° ring — a stroke crossing the seam meets the ink on the other side
  paperColor: TK.paper,                   // the mix's base where nothing is drawn yet
});
this.ob.setOverprint({
  overprintModel: 'mix', blendMode: 'multiply',
  inkDensity: cfg.inkDensity,             // 0.97
  overprintDarken: cfg.inkBlend,          // 0.45 — the blend intensity
  overprintAttack: cfg.inkAttack,         // 0.85 — how fast the mix comes in, approaching / crossing ink
  overprintRelease: cfg.inkRelease,       // 0.55 — how slowly the pen's own colour comes back after it
  overprintReach: OVERPRINT_DEFAULTS.overprintReach, paperColor: TK.paper,
});
```

It is built lazily, when the first stroke needs it, and again whenever the surface or its density changes (`rebind()`).
The engine's `surface` and `ppd` setters call `rebind()`. The rebuild reads the pixels back (§2.6).

### 2.2 Library px

The instruments' constants (bristle spacing, chatter wavelength, drip widths, the Posca's dome) were tuned at about
**40 px per degree** of visual angle, which is a laptop seen at arm's length. Inkwell's surfaces have other densities:
20c's ring, a phone, a 4K screen. The pens therefore draw in **library px**, which are surface px × `L` (`L = 40 / ppd`).
A mark is painted back at `s = 1 / L`. On the laptop the scale is ×1, so the marks are bit-identical to the lab's.

### 2.3 A pen per hand

Every hand that draws holds its own instrument, with its own `agentId`, so the blender keeps a separate stroke state
for it. The hands are the person, each boid, and the AI studio's agent.

```js
_spec(hand, primary)   // which pen: the person (and the first agent) → cfg.pen, or the expert line's tool/preset;
                       // the other agents → their own random pen (hand.pen) unless cfg.boidPens === 'same'
_build(hand, primary)  // new ChineseBrushV2 | PoscaSqueezerV3 | RulingPenCurved | RulingPenFlat
                       //   ({ preset, overprintBlender: this.ob, agentId })
                       // swell = INK_INSTRUMENTS[tool].swell  (ruling 0.05 · Zig 0.075 · Posca 0.10)
                       // applyInstrumentParams(pen, tool, myPen.settings)   — one of "my pens"
                       // applyInstrumentParams(pen, tool, expertLine)       — the expert line, over everything
                       // pen.baseRadius = THICKNESS[cfg.thickness].nom * 40 / 2   — the size is ALWAYS Inkwell's
                       // pen.color = the palette's colour; paperTooth 0.45; splats off → setSnapIntensity(0)
```

A generation counter (`gen`) is raised whenever a setting changes. Each hand rebuilds its pen at its **next** stroke,
so a stroke under way is never changed halfway.

### 2.4 Strokes → marks

```js
begin(hand, x, y, now, primary)   // pen.down({ x: (x + off) * L, y: y * L, pressure: 0.5, time }, rec.begin(), fluid)
move(hand, x, y, dtMs, now, rigid)
segment(hand, x0, y0, x1, y1, now) // the grid's straight runs, in 3-library-px steps
end(hand, now)                     // pen.up(…); ob.endStroke(agentId)
drips(dtMs)                        // fluid.updateDrips(dt, (seg) => ob.paintDripSegment(rec.ctx, seg))
_take()                            // const { ops, box } = rec.take();
                                   // → { t: 'k', ops, s: 1 / L, o: off, box: [x0, y0, x1, y1] in surface px }
```

The engine paints each mark on the surface (its tiles, its undo cells, the copy at 20c's seam) and sends it to the
shared drawing. Painting a mark:

```js
c.save(); c.translate(-(m.o || 0), 0); c.scale(m.s, m.s); InkRecorder.replay(c, m.ops); c.restore();
```

A mark that arrives from another window is data. It is checked once (`InkRecorder.valid(ops)`: known op codes, argument
counts, finite numbers, short style strings, a size limit) before it is painted.

### 2.5 The line modes

*Dynamic* and *Fluid* give the pen the gaze's own speed (`dt` from the frame), and each pen answers it in its own way.
*Rigid* (and the grid's runs) moves the pen at an **even pace** instead: `dt = distance / 130` library px per second.
That speed sits inside every pen's neutral band, with no engorging, no starving and no skips, so the line keeps one
width and never stops to pool.

### 2.6 The grid follows the pixels

The blender remembers which ink lies where, so that a crossing can mix. When the surface puts pixels back by itself,
the ink must forget the strokes that went with them:

| `surface.onPixels(kind, parts)` | When | The ink |
|---|---|---|
| `'clear'` | Clear | `ob.clear()`; the running drips stop |
| `'full'` | a whole-surface undo / redo, opening a drawing, copying a surface | `ob.clear()`, then `rebuildFromImageData` for every tile |
| `'cells'` | undo / redo of some cells | `rebuildFromImageData` for those cells only |

`rebuildFromImageData(img, { x, y, scale, mode })` places the pixels in library px. `mode` is `'paper'` for an opaque
surface (ink = what differs from the paper) or `'alpha'` for a transparent ink layer (ink = alpha).

### 2.7 The ring (20c)

The ring's surface rebases its coordinates as the view turns (`engine._rebase(sh)`). The pens keep drawing in a
continuous frame: `ink.off -= sh`. Each mark carries its offset `o`, so it lands in the same place on the surface.

---

## 3. The expert line — settings pasted from the lab

Configuration → *Pen* → *Expert line* accepts what the lab's export gives: the **1-Line Call**, the **Config JSON**,
or bare `key: value` lines. It is **read, never run**:

```js
const p = parseInkSettings(text);          // no eval / Function: a small parser
const v = validateInkSettings(p.settings); // known keys only, each clamped to its range; warnings for the rest
// the host keeps its own: colour, thickness, radius and paper are dropped (Inkwell's palette, sizes and paper)
// a preset that does not belong to the line's tool is dropped with a warning
```

The line is kept with the settings (`cfg.penExpert`). It goes over the chosen pen, and may choose the instrument and
the preset itself. The panel says what it applied, what Inkwell kept for itself and what it could not read. A line that
cannot be read changes nothing.

---

## 4. My pens — user presets kept for good

The **13 core presets are the library's** (`CORE_PRESETS`, deep-frozen) and never change. A person's own pens are
**user presets**: `{ id, name, tool, basePreset, settings, notes, created, updated }`. They are managed by a
`UserPresetStore` (create · read · update · delete · export · import), which sits on top of an adapter:

```js
// js/pens.js
const store = signedIn
  ? new UserPresetStore({ adapter: accountAdapter(), limit: 60 })   // api: pens.mine (GET) / pens.save (POST, CSRF)
  : new UserPresetStore({ adapter: localStorageAdapter('inkwell20.pens'), limit: 60 });
await store.create({ name, ...ink.snapshot() });   // snapshot: { tool, basePreset, settings } — the pen as it is now
```

- **Signed in:** the pens are kept in the account and follow the person to any computer. The server
  (`api/lib/pens.php`) checks each one as `SettingsParser` does: known keys, ranges, a known tool and a preset of that
  tool, at most 60 pens, text limits. No setting is ever executed. The pens are part of the person's data (*download
  my data*) and are deleted with the account. The first time an account is used, the pens this browser kept move into it.
- **Signed out:** the pens are kept in the browser, for all four variants.
- **Without Inkwell:** the library ships its own small server, `server/presets.php` (a bearer token checked with
  `password_verify`, a CORS allow-list, size limits, atomic writes, the same validation), for `httpAdapter({ endpoint,
  token })`. The lab's *★ My Presets* panel uses it or the browser (`server/README.md`).

---

## 5. Agents

With several agents (boids), the first draws with the person's pen and the others with **random pens**
(`randomPreset()` from the 13). Each agent keeps its pen; Configuration → *Agents* shows each one's pen and lets it be
changed. With `cfg.boidPens = 'same'`, every agent draws with the person's pen. Every hand shares the one blender, so an
agent's stroke mixes with the person's, and with the other agents', where they cross.

With the facade, the same is `ink.setAgentPen(agentId, { tool, preset, color, thickness, … })`, or `setAgentPen(id, null)`
to go back to the main pen.

---

## 6. Inkwell's settings → the library

| Inkwell (`cfg.*`) | Default | Library |
|---|---|---|
| `pen` | `fine_low_var` | a core preset id (`CORE_PRESETS`) or a user pen's id → tool + `basePreset` + `settings` |
| `penExpert` | `''` | `parseInkSettings` → `validateInkSettings` → `applyInstrumentParams` (+ the blender's `overprint*` keys) |
| `boidPens` | `random` | the agents' pens: `random` or `same` |
| `thickness` | `medium` | `baseRadius = THICKNESS[t].nom × 40 / 2` (library px) |
| `color` | the palette's | `pen.color` (any `#rrggbb`) |
| `paper` | Munken `#F4F1EA` | `OverprintBlender.setPaperColor` |
| `inkDensity` | 0.97 | `inkDensity` |
| `inkBlend` | 0.45 | `overprintDarken` (`blendIntensity`) |
| `inkAttack` | 0.85 | `overprintAttack` |
| `inkRelease` | 0.55 | `overprintRelease` |
| (each instrument) | 0.05 / 0.075 / 0.10 | `overprintSwell` (`INK_INSTRUMENTS[].swell`) |
| `drips` | on | the Posca's `FluidDynamics` drips (off: dropped before they are drawn) |
| `splats` | on | the ruling pens' spit bursts (off: `setSnapIntensity(0)`) |

Removed from Inkwell in 20.2 (the pens do these now): `widthSwing`, `engorge`, `slowDegS`, `fastDegS`, `dripSpeed`,
`dripInt`, `splatThr`, `splatInt`.

---

## 7. Checks after integrating

- **Black on Munken paper:** a stroke is `#070707`, and the same black crossing itself is `#000000` (as measured on the
  real paper).
- **Light colours mix too:** white over black turns grey; yellow over blue turns green; light grey over sky blue is a
  little darker than either.
- **The envelope:** the mix comes in within a fraction of the nib's width as the pen meets ink, and fades over several
  widths after it.
- **The swell:** where strokes cross, the line is wider by about 5 % (ruling pens), 7.5 % (Zig) or 10 % (Posca).
- **Undo / redo / clear / open:** a stroke drawn over an undone one does **not** mix (the grid followed the pixels).
- **Shared drawing:** a second window's copy of a stroke has the same pixels.
- **The ring:** a stroke across the seam is continuous and mixes with ink on the other side.
- **The expert line:** the lab's 1-Line Call is applied; colour, thickness and paper are ignored, and unknown keys get
  a warning.

---

## 8. The facade — quick start for other apps

```js
import { createInkDynamics } from './inkDynamics/js/inkdynamics.js';

const ink = createInkDynamics({
  canvas,                                   // the library owns it (paper, history, undo, exportPNG)
  tool: 'chinese_brush', preset: 'fine_low_var',
  thickness: 'medium',                      // a token (hairline · thin · medium · thick · broad) or a radius in px
  color: '#191817',                         // any colour, or an Inkwell 18/19 token (black · red · blue · white)
  inkDensity: 0.97, overprintDarken: 0.45, overprintAttack: 0.85, overprintRelease: 0.55,
  // overprintSwell: leave it out to keep each instrument's own (5 % · 7.5 % · 10 %)
  autoStep: false,                          // the host's loop calls ink.step(dt) for the drips
});

ink.penDown(x, y, 0.5, now);                // agentId 0: the main pen
ink.penMove(x, y, dt, 0.5, now);
ink.penUp(x, y, now);
ink.setAgentPen(1, { preset: 'posca_squeezer_thick', color: '#E13C23' });   // a boid with a pen of its own
ink.penDown(bx, by, 0.5, now, 1);
ink.step(1 / 60);

ink.setConfig({ ...settingsFromTheLab });   // every parameter, validated (4.0); getConfig() reads them back
```

Thickness tokens (radius in px, per instrument — `INKWELL_THICKNESS`):

| Token | Zig Chinese brush | Posca mop squeezer | Curved ruling pen | Flat ruling pen |
|---|---|---|---|---|
| `hairline` | 1.8 | 4.0 | 1.25 | 1.0 |
| `thin` | 3.5 | 6.0 | 3.5 | 4.0 |
| `medium` | 8.0 | 12.0 | 7.0 | 8.0 |
| `thick` | 14.0 | 22.0 | 13.0 | 14.0 |
| `broad` | 22.0 | 30.0 | 18.0 | 20.0 |

(Inkwell 20 does not use these: its pens take their size from Inkwell's own three thicknesses, §2.3.)

---

## 9. Credits

**inkDynamics** — concept and design by **Pedro Amado** (FBAUP / i2ADS); development by **Google Gemini 3.8 Flash** in
Antigravity and **Anthropic Claude Opus 5.5** (October 2026). MIT licence.

Part of the **SiX research project — «Drawing for Social Re-connectivity»** (FBAUP · i2ADS · ID+). This work is financed
by national funds through the Portuguese funding agency, FCT — Fundação para a Ciência e a Tecnologia, within the
project «2023.11224.PEX» [DOI 10.54499/2023.11224.PEX]. Website: [https://six.fba.up.pt/](https://six.fba.up.pt/)
