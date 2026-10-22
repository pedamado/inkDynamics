// ═══════════════════════════════════════════════════════════════════════════
// Automated Test Suite for InkDynamics v4.0 — the 'mix' ink model, its settings, per-ink swell, the fixes of the
// 4.0 analysis, InkRecorder, the settings parser, per-agent pens, and user presets (CRUD).
// Run: node test_v4.js   (a failed check throws and the run stops with exit code 1)
// ═══════════════════════════════════════════════════════════════════════════

import {
  VERSION,
  createInkDynamics,
  InkDynamicsEngine,
  ChineseBrushV2,
  PoscaSqueezerV3,
  RulingPenCurved,
  RulingPenFlat,
  FluidDynamics,
  OverprintBlender,
  OVERPRINT_DEFAULTS,
  CLASSIC_39,
  ZIG_PRESETS,
  InkRecorder,
  parseInkSettings,
  validateInkSettings,
  formatInkSettings,
  CORE_PRESETS,
  listPresets,
  presetToConfig,
  UserPresetStore,
  memoryAdapter,
  applyInstrumentParams,
} from './js/inkdynamics.js';

let checks = 0;
function ok(cond, msg) {
  checks++;
  if (!cond) throw new Error('✗ ' + msg);
}
const hexLum = (hex) => { const [r, g, b] = OverprintBlender.parseHex(hex); return (r + g + b) / 3; };

function mockCanvas(w = 800, h = 600) {
  const ctx = new InkRecorder().ctx;
  Object.assign(ctx, {
    getImageData(x, y, W, H) { return { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) }; },
    putImageData() {},
    clearRect() {},
    drawImage() {},
  });
  return { width: w, height: h, getBoundingClientRect: () => ({ width: w, height: h, left: 0, top: 0 }), getContext: () => ctx, toDataURL: () => 'data:,' };
}

console.log(`🧪 InkDynamics ${VERSION} — v4 verification\n`);

// ── 1. the 'mix' model: transparent ink, overprint mixing, all colours alike ──────────────────────────────────────
console.log('Test 1: mix model — density 0.97, black stays black, every colour mixes');
{
  const ob = new OverprintBlender({ width: 400, height: 300 });
  ok(ob.overprintModel === 'mix' && ob.inkDensity === 0.97, 'defaults: mix, density 0.97');
  ok(ob.getFirstPassColor('#000000') === '#080808', 'black on white paper = #080808, got ' + ob.getFirstPassColor('#000000'));
  ob.setPaperColor('#F4F1EA');
  ok(ob.getFirstPassColor('#000000') === '#070707', 'black on Munken = #070707');
  ok(ob.getCompositeOperation('#FFFFFF') === 'source-over' && ob.getCompositeOperation('#000000') === 'source-over', 'one composite for every colour');
  ok(ob.getFirstPassColor('#FFFFFF') !== '#FFFFFF' && ob.getFirstPassColor('#FFFFFF') !== '#ffffff', 'white is laid at 0.97 too (no light-ink bypass)');
  const bb = ob.getMultipliedColor('#000000', 7, 7, 7, 1);
  ok(hexLum(bb) < hexLum('#070707'), 'black over black is blacker still: ' + bb);
  const wb = ob.getMultipliedColor('#FFFFFF', 7, 7, 7, 1);
  ok(hexLum(wb) < 220 && hexLum(wb) > 60, 'white over black mixes to a grey: ' + wb);
  const yb = OverprintBlender.parseHex(ob.getMultipliedColor('#FFD600', 51, 179, 255, 1));
  ok(yb[1] > yb[0] && yb[1] > yb[2], 'yellow over sky blue mixes toward green: ' + yb);
  ob.setOverprintDarken(0);
  const noMix = ob.getMultipliedColor('#FFFFFF', 7, 7, 7, 1);
  ok(hexLum(noMix) > 240, 'blending intensity 0: only the 3 % see-through remains: ' + noMix);
  ob.setBlendMode('source-over');
  ok(ob.getFirstPassColor('#123456') === '#123456', 'overprint off = the colour itself');
}

// ── 2. the 3.9 classic model is kept ─────────────────────────────────────────────────────────────────────────────
console.log('Test 2: classic model (3.9) preserved');
{
  const ob = new OverprintBlender({ width: 400, height: 300, ...CLASSIC_39 });
  ok(ob.getFirstPassColor('#000000') === '#262625', 'classic black first pass = #262625 (3.9)');
  ok(ob.getCompositeOperation('#000000') === 'darken', "classic sub-steps composite with 'darken'");
  ok(ob.getCompositeOperation('#FFFFFF') === 'source-over' && ob.getFirstPassColor('#FFFFFF') === '#FFFFFF', 'classic light ink bypass');
}

// ── 3. settings: ranges, NaN, aliases ────────────────────────────────────────────────────────────────────────────
console.log('Test 3: overprint settings — clamps, NaN ignored, blendIntensity alias');
{
  const ob = new OverprintBlender();
  ob.setInkDensity('nonsense');
  ok(ob.inkDensity === 0.97, 'NaN density keeps the value');
  ob.setOverprintDarken(NaN);
  ok(ob.overprintDarken === OVERPRINT_DEFAULTS.overprintDarken, 'NaN darken keeps the value (3.9: became NaN)');
  ob.setOverprintSwell('x');
  ok(Number.isFinite(ob.overprintSwell), 'NaN swell keeps the value');
  ob.setOverprint({ blendIntensity: 0.3, overprintAttack: 2, overprintRelease: -1, overprintReach: 9, inkDensity: 0.2 });
  ok(ob.overprintDarken === 0.3 && ob.overprintAttack === 1 && ob.overprintRelease === 0 && ob.overprintReach === 1.5 && ob.inkDensity === 0.65, 'aliases + clamping');
}

// ── 4. approach fast, exit slow ──────────────────────────────────────────────────────────────────────────────────
console.log('Test 4: crossing envelope — fast approach, slow exit (overprintAttack / overprintRelease)');
function crossProfile(opts) {
  const ob = new OverprintBlender({ width: 400, height: 200, ...opts });
  // a vertical line of ink at x 200–204
  const s1 = ob.beginStroke('a', '#000000');
  for (let y = 0; y <= 200; y += 2) ob.queryAndStamp(202, y, 2, s1, y, '#000000', true);
  // a horizontal stroke crossing it, radius 6, sampled every 2 px
  const s2 = ob.beginStroke('b', '#FFFFFF');
  const out = [];
  for (let x = 100; x <= 320; x += 2) out.push([x, ob.queryAndStamp(x, 100, 6, s2, x - 100, '#FFFFFF', true).intensity]);
  return out;
}
{
  const prof = crossProfile({});
  const at = (x) => prof.find((p) => p[0] === x)[1];
  ok(at(180) === 0, 'no mix well before the crossing');
  ok(at(202) > 0.5, 'mixed over the line: ' + at(202).toFixed(2));
  const firstMix = prof.find((p) => p[1] > 0)[0];
  ok(firstMix >= 194, 'the mix starts only when the nib meets the ink (reach 0.75): x=' + firstMix);
  ok(at(224) > 0.05, 'still carrying pigment 20 px after the line: ' + at(224).toFixed(3));
  ok(at(300) < 0.01, 'back to its own colour long after: ' + at(300).toFixed(4));
  const slow = crossProfile({ overprintRelease: 0.1 }), fast = crossProfile({ overprintRelease: 0.95 });
  const atS = (x) => slow.find((p) => p[0] === x)[1], atF = (x) => fast.find((p) => p[0] === x)[1];
  ok(atS(240) > atF(240) * 5, 'a slower exit keeps the mix longer: ' + atS(240).toFixed(3) + ' vs ' + atF(240).toFixed(4));
  const slowIn = crossProfile({ overprintAttack: 0.0 });
  const atI = (x) => slowIn.find((p) => p[0] === x)[1];
  ok(atI(198) < at(198), 'a slower approach comes in later: ' + atI(198).toFixed(3) + ' < ' + at(198).toFixed(3));
}

// ── 5. swell at crossings, per ink ───────────────────────────────────────────────────────────────────────────────
console.log('Test 5: crossing micro-swell 5–10 %, per ink (ruling 5 %, Zig 7.5 %, Posca 10 %)');
{
  const ob = new OverprintBlender({ width: 600, height: 300 });
  const pens = {
    zig: new ChineseBrushV2({ preset: 'fine_low_var', overprintBlender: ob }),
    posca: new PoscaSqueezerV3({ preset: 'posca_squeezer_medium', overprintBlender: ob }),
    curved: new RulingPenCurved({ preset: 'curved_ruling_medium', overprintBlender: ob }),
    flat: new RulingPenFlat({ preset: 'flat_ruling_medium', overprintBlender: ob }),
  };
  ok(pens.zig.overprintSwell === 0.075 && pens.posca.overprintSwell === 0.10 && pens.curved.overprintSwell === 0.05 && pens.flat.overprintSwell === 0.05, 'default swells by ink');
  ok(Math.abs(ob.getSwellFactor(1, pens.posca.overprintSwell) - 1.10) < 1e-9 && Math.abs(ob.getSwellFactor(1, pens.flat.overprintSwell) - 1.05) < 1e-9, 'swell factor at a full crossing');
  // the Zig's bristles spread over the stroke's width: measure that spread over bare paper and over a crossing
  const zig = pens.zig, fluid = new FluidDynamics();
  const rec = new InkRecorder();
  const line = ob.beginStroke('line', '#000000');
  for (let y = 0; y <= 300; y += 2) ob.queryAndStamp(300, y, 4, line, y, '#000000', true);
  zig.color = '#E60000';
  zig.down({ x: 100, y: 150, time: 0 }, rec.begin(), fluid);
  rec.take();
  const spread = [];
  let t = 0;
  for (let x = 102.5; x <= 420; x += 2.5) {
    t += 1000 / 60;
    zig.move({ x, y: 150, time: t }, 1 / 60, rec.begin(), fluid);
    const { ops } = rec.take();
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < ops.length;) {
      const c = ops[i++];
      if (c === 6) { const y = ops[i + 1]; lo = Math.min(lo, y); hi = Math.max(hi, y); }
      i += { 0: 0, 1: 0, 2: 2, 3: 1, 4: 0, 5: 2, 6: 2, 7: 6, 8: 4, 9: 6, 10: 8, 11: 0, 12: 0, 13: 0, 14: 4, 15: 4 }[c] ?? 1;
    }
    spread.push([x, hi - lo]);
  }
  const avg = (a, b) => { const v = spread.filter((p) => p[0] >= a && p[0] <= b).map((p) => p[1]); return v.reduce((s, q) => s + q, 0) / v.length; };
  const bare = avg(200, 270), over = avg(300, 306);
  const gain = over / bare - 1;
  ok(gain > 0.03 && gain < 0.11, 'Zig swells ~7.5 % over the crossing: +' + (gain * 100).toFixed(1) + ' %');
}

// ── 6. InkRecorder ───────────────────────────────────────────────────────────────────────────────────────────────
console.log('Test 6: InkRecorder — record once, replay anywhere, box, validation');
{
  const ob = new OverprintBlender({ width: 400, height: 300 });
  const rec = new InkRecorder(), fluid = new FluidDynamics();
  const pen = new PoscaSqueezerV3({ preset: 'posca_squeezer_thin', overprintBlender: ob });
  pen.down({ x: 50, y: 50, time: 0 }, rec.begin(), fluid);
  for (let i = 1; i <= 40; i++) pen.move({ x: 50 + i * 4, y: 50 + i, time: i * 16 }, 1 / 60, rec.ctx, fluid);
  pen.up({ x: 210, y: 90, time: 700 }, rec.ctx, fluid);
  const { ops, box } = rec.take();
  ok(ops.length > 100 && box, 'ops recorded with a box');
  ok(box[0] <= 50 - 6 && box[2] >= 210 && box[1] <= 50 - 6 && box[3] >= 90, 'box covers the stroke: ' + box);
  ok(InkRecorder.valid(ops), 'own ops are valid');
  ok(!InkRecorder.valid([6, 'x', 1]) && !InkRecorder.valid([99]) && !InkRecorder.valid([20, 5]), 'bad ops are rejected');
  const a = new InkRecorder(), b = new InkRecorder();
  InkRecorder.replay(a.begin(), ops);
  InkRecorder.replay(b.begin(), a.take().ops);
  ok(JSON.stringify(b.take().ops) === JSON.stringify((() => { const c = new InkRecorder(); InkRecorder.replay(c.begin(), ops); return c.take().ops; })()), 'replay is stable');
}

// ── 7. the settings parser (no eval) ─────────────────────────────────────────────────────────────────────────────
console.log('Test 7: parseInkSettings — the lab snippets, JSON, Math.PI, nothing executed');
{
  const call = "const ink = createInkDynamics({ canvas, tool: 'chinese_brush', preset: 'fine_low_var', color: '#191817', thickness: 3.5, paperTooth: 0.45, blendMode: 'multiply', inkDensity: 0.97, overprintDarken: 0.45, slowEngorgeRatio: 1.35 });";
  const p = parseInkSettings(call);
  ok(!p.error && p.settings.tool === 'chinese_brush' && p.settings.slowEngorgeRatio === 1.35 && p.unreadable.includes('canvas'), '1-line call read');
  const j = parseInkSettings('ink.setConfig({ "tool": "ruling_pen_flat", "bladeAngle": Math.PI / 4, "asymmetrySide": "left" });');
  ok(Math.abs(j.settings.bladeAngle - Math.PI / 4) < 1e-12 && j.settings.asymmetrySide === 'left', 'Config JSON with Math.PI / 4');
  ok(parseInkSettings("inkDensity: 0.9, overprintRelease: .3 // slower").settings.overprintRelease === 0.3, 'bare key: value list with a comment');
  globalThis.__pwned = false;
  const evil = parseInkSettings("{ color: (globalThis.__pwned = true), tool: 'x' }");
  ok(globalThis.__pwned === false && evil.error, 'code is never run: ' + evil.error);
  const v = validateInkSettings({ inkDensity: 3, numBristles: 21.6, nonsense: 1, color: 'url(x)', tool: 'spray', blendIntensity: 0.5 });
  ok(v.settings.inkDensity === 1 && v.settings.numBristles === 22 && v.settings.overprintDarken === 0.5 && !('color' in v.settings) && !('tool' in v.settings), 'validation clamps, rounds, aliases, rejects');
  ok(v.warnings.some((w) => w.includes('nonsense')), 'unknown keys are reported');
  const back = parseInkSettings(formatInkSettings({ tool: 'posca_squeezer', viscosity: 0.6 }));
  ok(back.settings.tool === 'posca_squeezer' && back.settings.viscosity === 0.6, 'formatInkSettings round-trips');
}

// ── 8. createInkDynamics / setConfig apply every parameter (3.9 ignored most) ─────────────────────────────────────
console.log('Test 8: createInkDynamics() and setConfig() apply every instrument parameter');
{
  const ink = createInkDynamics({ canvas: mockCanvas(), tool: 'chinese_brush', preset: 'fine_low_var', depletionRate: 2.0, numBristles: 40, starveEaseIn: 200, boneHeadFlare: 2.0, autoStep: false });
  const zig = ink.engine.instruments.chinese_brush;
  ok(zig.depletionRate === 2.0 && zig.numBristles === 40 && zig.bristles.length === 40 && zig.starveEaseIn === 200 && zig.boneHeadFlare === 2.0, 'Zig parameters applied at creation');
  ok(ink.engine.inkDensity === 0.97 && ink.engine.overprintModel === 'mix', '4.0 overprint defaults');
  ink.setConfig({ tool: 'posca_squeezer', preset: 'posca_squeezer_thick', viscosity: 0.7, dripThreshold: 0.5, initialDomeFlare: 1.4 });
  const ps = ink.engine.instruments.posca_squeezer;
  ok(ink.engine.activeInstrumentId === 'posca_squeezer' && ps.viscosity === 0.7 && ps.dripThreshold === 0.5 && ps.initialDomeFlare === 1.4, 'Posca parameters applied by setConfig');
  ok(ps.overprintSwell === 0.10, 'Posca keeps its own swell');
  ink.setConfig({ tool: 'ruling_pen_curved', penMode: 'point', overprintAttack: 0.5, blendIntensity: 0.2 });
  ok(ink.engine.activeInstrument.penMode === 'point' && ink.engine.overprintAttack === 0.5 && ink.engine.overprintDarken === 0.2, 'ruling pen mode + overprint keys + alias');
  const snap = ink.presetSnapshot();
  ok(snap.tool === 'ruling_pen_curved' && snap.settings.penMode === 'point' && snap.settings.overprintAttack === 0.5, 'presetSnapshot keeps the tuned values');
}

// ── 9. agents with pens of their own ─────────────────────────────────────────────────────────────────────────────
console.log('Test 9: agents (boids) with pens of their own');
{
  const ink = createInkDynamics({ canvas: mockCanvas(), tool: 'chinese_brush', preset: 'fine_low_var', color: '#000000', autoStep: false });
  const a1 = ink.setAgentPen(1, { tool: 'posca_squeezer', preset: 'posca_squeezer_thin', color: '#E60000', thickness: 5 });
  ok(a1 instanceof PoscaSqueezerV3 && a1.color === '#E60000' && a1.baseRadius === 5, 'agent 1: a Posca, red, radius 5');
  ink.setColor('#33B3FF');
  ink.setTool('ruling_pen_flat');
  ok(ink.getAgentPen(1) === a1 && a1.color === '#E60000', "the main pen's changes leave agent 1's own pen alone");
  const a2 = ink.getAgentPen(2);
  ok(a2 instanceof RulingPenFlat && a2.color === '#33B3FF', 'agent 2 (no pen of its own) mirrors the main pen');
  ink.penDown(10, 10, 0.5, 0, 1); ink.penMove(40, 12, 1 / 60, 0.5, 16, 1); ink.penUp(40, 12, 32, 1);
  ink.setAgentPen(1, null);
  ok(ink.getAgentPen(1) instanceof RulingPenFlat, 'back to the main pen');
}

// ── 10. user presets (CRUD) and the permanent core presets ───────────────────────────────────────────────────────
console.log('Test 10: user presets — create, read, update, delete, export / import; core presets permanent');
{
  const store = new UserPresetStore({ adapter: memoryAdapter(), limit: 5 });
  const p = await store.create({ name: '  My  wet Zig ', tool: 'chinese_brush', basePreset: 'fine_low_var', settings: { depletionRate: 9, inkDensity: 0.95, nonsense: 1 } });
  ok(p.id.startsWith('user-') && p.name === 'My wet Zig' && p.settings.depletionRate === 3 && p.settings.inkDensity === 0.95 && !('nonsense' in p.settings), 'created, cleaned, clamped');
  ok((await store.list()).length === 1 && (await store.get(p.id)).name === 'My wet Zig', 'read');
  const u = await store.update(p.id, { name: 'Wet Zig', settings: { depletionRate: 1.2 } });
  ok(u.name === 'Wet Zig' && u.settings.depletionRate === 1.2 && u.created === p.created && u.updated >= p.updated, 'updated');
  let threw = null;
  try { await store.create({ name: 'x', tool: 'spray_can' }); } catch (e) { threw = e.code; }
  ok(threw === 'tool', 'unknown instrument refused');
  try { await store.create({ name: '', tool: 'posca_squeezer' }); } catch (e) { threw = e.code; }
  ok(threw === 'name', 'a name is needed');
  const json = await store.exportJSON();
  const other = new UserPresetStore({ adapter: memoryAdapter() });
  ok((await other.importJSON(json)) === 1 && (await other.list())[0].name === 'Wet Zig', 'export → import');
  ok((await store.remove(p.id)) === true && (await store.list()).length === 0, 'deleted');
  for (let i = 0; i < 5; i++) await store.create({ name: 'n' + i, tool: 'ruling_pen_flat' });
  try { await store.create({ name: 'six', tool: 'ruling_pen_flat' }); } catch (e) { threw = e.code; }
  ok(threw === 'limit', 'limit kept');
  ok(CORE_PRESETS.length === 13 && listPresets(await store.list()).length === 18, '13 core + user presets in one list');
  ok(presetToConfig('fine_low_var').tool === 'chinese_brush' && presetToConfig(u).depletionRate === 1.2, 'presetToConfig');
  let frozen = false;
  try { ZIG_PRESETS.fine_low_var.baseRadius = 99; } catch (_) { frozen = true; }
  ok(frozen && ZIG_PRESETS.fine_low_var.baseRadius === 3.5, 'core presets cannot be changed');
}

// ── 11. fixes from the 4.0 analysis ──────────────────────────────────────────────────────────────────────────────
console.log('Test 11: fixes — flat pen arcs, drips, grid size, undo restores the grid');
{
  const ob = new OverprintBlender({ width: 400, height: 300 });
  const flat = new RulingPenFlat({ preset: 'flat_ruling_point', overprintBlender: ob });
  const rec = new InkRecorder(), fluid = new FluidDynamics();
  flat.down({ x: 20, y: 20, time: 0 }, rec.begin(), fluid);
  for (let i = 1; i < 30; i++) flat.move({ x: 20 + i * 5, y: 20, time: i * 16 }, 1 / 60, rec.ctx, fluid);
  ok(Number.isFinite(flat.strokeDistance) && flat.strokeDistance > 100, 'RulingPenFlat.strokeDistance is finite (3.9: undefined)');
  ok(!Array.from(ob.cellArcLen).some(Number.isNaN), 'no NaN arc lengths in the grid');

  const posca = new PoscaSqueezerV3({ preset: 'posca_squeezer_thick', overprintBlender: ob });
  posca.color = '#E60000';
  posca.down({ x: 200, y: 100, time: 0 }, rec.begin(), fluid);
  for (let i = 1; i < 60; i++) posca.move({ x: 200, y: 100, time: i * 16 }, 1 / 60, rec.ctx, fluid);
  ok(fluid.activeDrips.length > 0 && fluid.activeDrips[0].color === '#E60000' && fluid.activeDrips[0].strokeId != null, 'drips carry the ink itself and their stroke (3.9: an already-lifted colour)');
  const before = ob.cellLayers.reduce((n, v) => n + (v > 0), 0);
  for (let k = 0; k < 30; k++) fluid.updateDrips(1 / 60, (seg) => ob.paintDripSegment(rec.ctx, seg));
  ok(ob.cellLayers.reduce((n, v) => n + (v > 0), 0) > before, 'drips are recorded in the grid');

  const engine = new InkDynamicsEngine(mockCanvas(2400, 1400), {});
  ok(engine.overprintBlender.gridW === 600 && engine.overprintBlender.gridH === 350, 'grid sized to the canvas (3.9: 1600 × 1200)');
  engine.pointerDown(100, 100, 0.5);
  for (let i = 1; i < 20; i++) engine.pointerMove(100 + i * 6, 100, 0.5);
  engine.pointerUp(220, 100);
  ok(engine.overprintBlender.cellLayers.some((v) => v > 0), 'stroke recorded');
  engine.undo();
  ok(!engine.overprintBlender.cellLayers.some((v) => v > 0), 'undo restores the overprint grid too (3.9: ghost crossings)');
  engine.redo();
  ok(engine.overprintBlender.cellLayers.some((v) => v > 0), 'redo brings it back');
  engine.destroy();
}

// ── 12. settings round trip through the engine ───────────────────────────────────────────────────────────────────
console.log('Test 12: exportSettings / applySettings keep the tuned active pen (3.9 reset it to its preset)');
{
  const a = new InkDynamicsEngine(mockCanvas(), {});
  a.setPreset('fine_low_var');
  a.setDepletionRate(2.2);
  a.setOverprintRelease(0.2);
  a.setOverprintSwell(0.09);
  const saved = a.exportSettings();
  const b = new InkDynamicsEngine(mockCanvas(), {});
  b.applySettings(saved);
  ok(b.activeInstrument.activePresetId === 'fine_low_var' && b.activeInstrument.depletionRate === 2.2, 'tuned depletion survives');
  ok(b.overprintRelease === 0.2 && b.instruments.chinese_brush.overprintSwell === 0.09, 'overprint + per-ink swell survive');
  const legacy = { version: '3.9', activeInstrumentId: 'chinese_brush', overprintSwell: 0.12 };
  b.applySettings(legacy);
  ok(b.instruments.posca_squeezer.overprintSwell === 0.12, 'a 3.9 settings object (one swell) applies to every ink');
  a.destroy(); b.destroy();
}

// ── 13. a ring surface (wrap) and host cell sizes ──────────────────────────────────────────────────────────────
console.log('Test 13: wrap (a 360° ring) and cellSize (host px)');
{
  const ob = new OverprintBlender({ width: 400, height: 100, wrap: true, cellSize: 8 });
  ok(ob.cellSize === 8 && ob.gridW === 50 && ob.gridH === 13, 'cellSize honoured (400 × 100 px in 8 px cells)');
  const ring = new OverprintBlender({ width: 800, height: 200, wrap: true });
  const a = ring.beginStroke('a', '#000000');
  for (let y = 0; y <= 200; y += 2) ring.queryAndStamp(2, y, 2, a, y, '#000000', true);   // a line at the seam (x = 2)
  const b = ring.beginStroke('b', '#FFFFFF');
  let k = 0;
  for (let x = 780; x <= 812; x += 2) k = Math.max(k, ring.queryAndStamp(x, 100, 6, b, x - 780, '#FFFFFF', true).intensity);   // crosses x = 800 ≡ 0
  ok(k > 0.3, 'a stroke crossing the seam meets the ink on the other side: ' + k.toFixed(2));
}

console.log(`\n🎉 ${checks} checks passed — InkDynamics ${VERSION}.`);
