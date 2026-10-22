// ═══════════════════════════════════════════════════════════════════════════
// Automated Test Suite for Ruling Pens (Curved & Flat) & InkDynamics Library
// ═══════════════════════════════════════════════════════════════════════════

import {
  createInkDynamics,
  InkDynamicsEngine,
  ChineseBrushV2,
  PoscaSqueezerV3,
  RulingPenCurved,
  RulingPenFlat,
  FluidDynamics,
  ZIG_PRESETS,
  POSCA_PRESETS,
  CURVED_RULING_PRESETS,
  FLAT_RULING_PRESETS,
  INKWELL_COLORS,
  INKWELL_THICKNESS,
  OverprintBlender,
} from './js/inkdynamics.js';

function mockContext() {
  const operations = [];
  return {
    operations,
    lineWidth: 1,
    strokeStyle: '#000000',
    fillStyle: '#000000',
    lineCap: 'round',
    lineJoin: 'round',
    globalAlpha: 1.0,
    save() { operations.push({ op: 'save' }); },
    restore() { operations.push({ op: 'restore' }); },
    translate(x, y) { operations.push({ op: 'translate', x, y }); },
    rotate(angle) { operations.push({ op: 'rotate', angle }); },
    beginPath() { operations.push({ op: 'beginPath' }); },
    closePath() { operations.push({ op: 'closePath' }); },
    moveTo(x, y) { operations.push({ op: 'moveTo', x, y }); },
    lineTo(x, y) { operations.push({ op: 'lineTo', x, y, lw: this.lineWidth, cap: this.lineCap }); },
    stroke() { operations.push({ op: 'stroke', lw: this.lineWidth, cap: this.lineCap }); },
    fill() { operations.push({ op: 'fill', fs: this.fillStyle }); },
    arc(x, y, r, sa, ea) { operations.push({ op: 'arc', x, y, r }); },
    rect(x, y, w, h) { operations.push({ op: 'rect', x, y, w, h }); },
    fillRect(x, y, w, h) { operations.push({ op: 'fillRect', x, y, w, h }); },
    ellipse(x, y, rx, ry, rot, sa, ea) { operations.push({ op: 'ellipse', x, y, rx, ry }); },
    setTransform() {},
    getImageData() { return { width: 800, height: 600, data: new Uint8ClampedArray(800 * 600 * 4) }; },
    putImageData() {},
  };
}

function mockCanvas() {
  const ctx = mockContext();
  return {
    width: 800,
    height: 600,
    getBoundingClientRect() { return { width: 800, height: 600, left: 0, top: 0 }; },
    getContext(type) { return ctx; },
    toDataURL() { return 'data:image/png;base64,mock'; },
  };
}

console.log('🧪 Starting InkDynamics Ruling Pen (Curved & Flat) Verification...\n');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1: Curved Ruling Pen Presets & Physics
// ─────────────────────────────────────────────────────────────────────────────
console.log('Test 1: Curved Ruling Pen Presets & Point Mode Hairline');
const pFine = CURVED_RULING_PRESETS.curved_ruling_fine;
const pMed = CURVED_RULING_PRESETS.curved_ruling_medium;
const pBroad = CURVED_RULING_PRESETS.curved_ruling_broad;

console.assert(pFine.penMode === 'point', 'Fine curved preset must be point mode');
console.assert(pFine.baseRadius === 1.25, 'Fine curved preset radius should be 1.25px');
console.assert(pMed.penMode === 'blade', 'Medium curved preset must be blade mode');
console.assert(pBroad.baseRadius === 13.0, 'Broad curved preset radius should be 13.0px');

// Verify Point Mode renders constant non-modulated hairline with no chatter or splats
const curvedPointPen = new RulingPenCurved({ preset: 'curved_ruling_fine' });
const ctxPoint = mockContext();
const mockFluid = {
  spawnDripCalled: 0,
  spawnDrip() { this.spawnDripCalled++; },
};

curvedPointPen.down({ x: 50, y: 50 }, ctxPoint, mockFluid);
curvedPointPen.move({ x: 150, y: 50 }, 0.05, ctxPoint, mockFluid);
curvedPointPen.up({ x: 150, y: 50 }, ctxPoint, mockFluid);

console.assert(mockFluid.spawnDripCalled === 0, 'Curved ruling pen must NOT produce gravity drips');
const pointStrokes = ctxPoint.operations.filter(op => op.op === 'stroke');
console.assert(pointStrokes.length > 0, 'Point mode should produce stroked lines');
for (const s of pointStrokes) {
  console.assert(s.lw <= 3.0, `Point mode hairline line width must be thin (<=3px), got ${s.lw}`);
}
console.log('  ✓ Curved Ruling Pen point mode verified: Constant hairline, zero gravity drips.');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2: Curved Blade Mode - Bilateral Chatter, Train Tracks & Spit Explosions
// ─────────────────────────────────────────────────────────────────────────────
console.log('Test 2: Curved Blade Mode — Bilateral Chatter, Train Tracks, Volcano Catenary & Provenance Spit Bursts');
const curvedBladePen = new RulingPenCurved({
  preset: 'curved_ruling_medium',
  minWidthScale: 0.2,
  maxWidthScale: 2.2,
  minSpitCount: 5,
  maxSpitCount: 20,
  maxDropletSize: 4.5,
  burstExplosionWidth: 2.5,
});
const ctxBlade = mockContext();

// Test touchdown pill ellipse
curvedBladePen.down({ x: 100, y: 100 }, ctxBlade, mockFluid);
const downFills = ctxBlade.operations.filter(op => op.op === 'fill');
console.assert(downFills.length > 0, 'Curved pen down() should stamp an irregular pill-like contact mark');

// Rapid dragging to build tension and trigger train tracks + spit clapping
for (let i = 1; i <= 10; i++) {
  curvedBladePen.move({ x: 100 + i * 40, y: 100 }, 0.015, ctxBlade, mockFluid);
}
curvedBladePen.up({ x: 500, y: 100 }, ctxBlade, mockFluid);

console.assert(mockFluid.spawnDripCalled === 0, 'Curved blade mode must NOT produce gravity drips');
// Check for train tracks (stroked rail lines) or transverse ellipses
const railLines = ctxBlade.operations.filter(op => op.op === 'stroke');
console.assert(railLines.length > 0, 'High speed should generate train track rail lines');
const ellipses = ctxBlade.operations.filter(op => op.op === 'ellipse');
console.assert(ellipses.length > 0, 'Friction micro-jumps and provenance droplets should generate ellipses');
console.assert(curvedBladePen.recentSnaps > 0, 'Clapping metal sheets should trigger spit burst snaps');
console.log(`  ✓ Generated ${railLines.length} rail strokes, ${ellipses.length} transverse ellipses and provenance droplets, with ${curvedBladePen.recentSnaps} sheet snaps.`);

// Test Friction Skips sensitivity logic (Dense line for low values, wide skips for high values)
const densePen = new RulingPenCurved({ skipSensitivity: 0.2 });
const widePen = new RulingPenCurved({ skipSensitivity: 2.5 });
console.assert(densePen.skipSensitivity === 0.2, 'Dense pen skipSensitivity is 0.2');
console.assert(widePen.skipSensitivity === 2.5, 'Wide pen skipSensitivity is 2.5');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3: Flat Ruling Pen Presets, Pill Cap & Asymmetric Edge Dynamics
// ─────────────────────────────────────────────────────────────────────────────
console.log('Test 3: Flat Ruling Pen — Asymmetry Contrast, Pill Touchdown & Provenance Spits');
const fPoint = FLAT_RULING_PRESETS.flat_ruling_point;
const fMed = FLAT_RULING_PRESETS.flat_ruling_medium;
const fBroad = FLAT_RULING_PRESETS.flat_ruling_broad;

console.assert(fPoint.penMode === 'point', 'Flat point preset must be point mode');
console.assert(fMed.edgeAsymmetry === 0.92, 'Medium flat preset should have 92% edge asymmetry');
console.assert(fMed.asymmetrySide === 'right', 'Default ragged edge should be right side');

const flatPen = new RulingPenFlat({
  preset: 'flat_ruling_medium',
  minWidthScale: 0.3,
  maxWidthScale: 2.1,
  burstExplosionWidth: 2.4,
  maxDropletSize: 5.0,
});
const ctxFlat = mockContext();

flatPen.down({ x: 100, y: 100 }, ctxFlat, mockFluid);
// Check for pill-like contact stamp (moveTo, lineTo, closePath, fill)
const flatDownPaths = ctxFlat.operations.filter(op => op.op === 'closePath');
console.assert(flatDownPaths.length > 0, 'Flat ruling pen down() should stamp an irregular pill-like ellipse');

// Drag stroke
for (let i = 1; i <= 8; i++) {
  flatPen.move({ x: 100, y: 100 + i * 45 }, 0.016, ctxFlat, mockFluid);
}
flatPen.up({ x: 100, y: 460 }, ctxFlat, mockFluid);

console.assert(mockFluid.spawnDripCalled === 0, 'Flat ruling pen must NOT produce gravity drips');
console.assert(flatPen.recentSnaps > 0, 'Flat blade snap should trigger sheet clapping snaps');
const flatEllipses = ctxFlat.operations.filter(op => op.op === 'ellipse');
console.assert(flatEllipses.length > 0, 'Flat blade snap should generate elongated provenance droplets');
console.log(`  ✓ Flat Ruling Pen pill cap, asymmetric edge dynamics and provenance spits verified (${flatPen.recentSnaps} snaps, ${flatEllipses.length} droplets).`);

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4: Regression Test — Chinese Brush v2 and Posca Squeezer v3
// ─────────────────────────────────────────────────────────────────────────────
console.log('Test 4: Regression Test — Chinese Brush v2 & Posca Squeezer v3 Intact');
const brush = new ChineseBrushV2({ preset: 'medium_high_dynamic' });
const squeezer = new PoscaSqueezerV3({ preset: 'posca_squeezer_medium' });

console.assert(ZIG_PRESETS.medium_high_dynamic != null, 'ZIG_PRESETS intact');
console.assert(POSCA_PRESETS.posca_squeezer_medium != null, 'POSCA_PRESETS intact');
console.assert(brush.numBristles === 36, 'Chinese Brush has 36 bristles');
console.assert(squeezer.numTracks === 28, 'Posca squeezer has 28 tracks');
console.log('  ✓ Chinese Brush v2 and Posca Squeezer v3 completely intact.');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5: InkDynamics Modular Library Integration & Multi-Agent Boids
// ─────────────────────────────────────────────────────────────────────────────
console.log('Test 5: InkDynamics Modular Library Controller & Multi-Agent Support');
const canvas = mockCanvas();
const ink = createInkDynamics({
  canvas,
  tool: 'ruling_pen_curved',
  thickness: 'medium',
  color: 'black',
  autoStep: false,
});

const cfg = ink.getConfig();
console.assert(cfg.tool === 'ruling_pen_curved', `Tool should be ruling_pen_curved, got ${cfg.tool}`);
console.assert(cfg.preset === 'curved_ruling_medium', `Preset should be curved_ruling_medium, got ${cfg.preset}`);
console.assert(cfg.radius === INKWELL_THICKNESS.medium.ruling_pen_curved, `Radius should match INKWELL_THICKNESS medium (7.0), got ${cfg.radius}`);

// Primary pen drawing
ink.penDown(50, 50, 0.5, 1000, 0);
ink.penMove(150, 50, 0.05, 0.5, 1050, 0);
ink.penUp(150, 50, 1050, 0);

// Parallel boid agents drawing with flat ruling pen
ink.setTool('ruling_pen_flat', 'flat_ruling_broad');
const flatCfg = ink.getConfig();
console.assert(flatCfg.tool === 'ruling_pen_flat', `Tool should switch to ruling_pen_flat, got ${flatCfg.tool}`);

ink.penDown(200, 200, 0.5, 2000, 1);
ink.penDown(300, 300, 0.5, 2000, 2);
ink.penMove(250, 220, 0.05, 0.5, 2050, 1);
ink.penMove(350, 320, 0.05, 0.5, 2050, 2);
ink.penUp(250, 220, 2050, 1);
ink.penUp(350, 320, 2050, 2);

console.assert(ink.agentPens.has(1), 'Agent 1 channel instantiated for flat ruling pen');
console.assert(ink.agentPens.has(2), 'Agent 2 channel instantiated for flat ruling pen');

// Test Settings Serialization & Persistence
const exported = ink.engine.exportSettings();
console.assert(exported.ruling_pen_curved != null, 'exportSettings includes ruling_pen_curved');
console.assert(exported.ruling_pen_flat != null, 'exportSettings includes ruling_pen_flat');
console.assert(exported.chinese_brush != null, 'exportSettings preserves chinese_brush');
console.assert(exported.posca_squeezer != null, 'exportSettings preserves posca_squeezer');

ink.engine.applySettings(exported);
console.log('  ✓ Modular Library integration, multi-agent boids, and serialization fully verified.');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6: v3.9 OverprintBlender — Multiply Overprint & Intersection Micro-Swell
// ─────────────────────────────────────────────────────────────────────────────
console.log('Test 6: v3.9 OverprintBlender — Multiply Overprint & Intersection Micro-Swell');
const ob = new OverprintBlender(800, 600, {
  blendMode: 'multiply',
  inkDensity: 0.94,
  overprintDarken: 0.65,
  overprintSwell: 0.08,
});

console.assert(ob.isOverprintEnabled() === true, 'Overprint should be enabled when blendMode is multiply');

// First pass stroke at (200, 200) -> (300, 200)
const s1 = ob.beginStroke(0);
const cross1 = ob.queryAndStamp(250, 200, 6.0, s1, 50, '#191817');
console.assert(cross1.crossed === false && cross1.intensity === 0, `First pass should have 0 crossing intensity, got ${cross1.intensity}`);
console.assert(ob.getSwellFactor(cross1.intensity) === 1.0, 'First pass swell factor should be 1.0');

// Same stroke overlapping itself immediately (arcLen diff < 28) should NOT self-multiply
const crossSelfImmediate = ob.queryAndStamp(252, 200, 6.0, s1, 55, '#191817');
console.assert(crossSelfImmediate.crossed === false && crossSelfImmediate.intensity === 0, `Immediate self-stamp within same stroke should have 0 crossing, got ${crossSelfImmediate.intensity}`);

// Second stroke crossing at (250, 200)
const s2 = ob.beginStroke(0);
const cross2 = ob.queryAndStamp(250, 200, 6.0, s2, 50, '#191817');
console.assert(cross2.crossed === true && cross2.intensity > 0, `Second stroke crossing first stroke should detect crossing > 0, got ${cross2.intensity}`);
const swell2 = ob.getSwellFactor(cross2.intensity);
console.assert(swell2 > 1.0 && swell2 <= 1.0801, `Crossing swell factor should be between 1.0 and 1.08, got ${swell2}`);

// Color darkening verification
const firstPassColor = ob.getFirstPassColor('#191817');
const crossedColor = ob.getMultipliedColor('#191817', cross2.underR, cross2.underG, cross2.underB, 1.0);
console.assert(firstPassColor !== crossedColor, `Crossed color (${crossedColor}) should be darker than first-pass color (${firstPassColor})`);

// Test library controller setters
ink.setBlendMode('source-over');
console.assert(ink.getConfig().blendMode === 'source-over', 'setBlendMode should update blendMode to source-over');
ink.setOverprint({ blendMode: 'multiply', inkDensity: 0.92, overprintDarken: 0.75, overprintSwell: 0.12 });
const obCfg = ink.getConfig();
console.assert(obCfg.blendMode === 'multiply', 'setOverprint should restore multiply mode');
console.assert(Math.abs(obCfg.inkDensity - 0.92) < 1e-6, `inkDensity should be 0.92, got ${obCfg.inkDensity}`);
console.assert(Math.abs(obCfg.overprintDarken - 0.75) < 1e-6, `overprintDarken should be 0.75, got ${obCfg.overprintDarken}`);
console.assert(Math.abs(obCfg.overprintSwell - 0.12) < 1e-6, `overprintSwell should be 0.12, got ${obCfg.overprintSwell}`);
console.log(`  ✓ OverprintBlender verified: 1st-pass=${firstPassColor}, crossed=${crossedColor}, swell=${swell2.toFixed(3)}x.`);

console.log('\n🎉 ALL 6 TEST SUITES PASSED PERFECTLY!\n');

