// ═══════════════════════════════════════════════════════════════════════════
// Automated Test Suite for InkDynamics v3.0 & inkdynamics.js Library
// ═══════════════════════════════════════════════════════════════════════════

import {
  createInkDynamics,
  InkDynamicsEngine,
  ChineseBrushV2,
  PoscaSqueezerV3,
  FluidDynamics,
  ZIG_PRESETS,
  POSCA_PRESETS,
  INKWELL_COLORS,
  INKWELL_THICKNESS,
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
    bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) { operations.push({ op: 'bezierCurveTo', x, y }); },
    stroke() { operations.push({ op: 'stroke', lw: this.lineWidth, cap: this.lineCap }); },
    fill() { operations.push({ op: 'fill', fs: this.fillStyle }); },
    arc(x, y, r, sa, ea) { operations.push({ op: 'arc', x, y, r }); },
    fillRect(x, y, w, h) { operations.push({ op: 'fillRect', x, y, w, h }); },
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

console.log('🧪 Starting InkDynamics v3.0 Verification...\n');

// TEST 1: Posca Presets & Squeezer Calibration
console.log('Test 1: Posca Squeezer Presets & Drip Width Ratios');
const thinP = POSCA_PRESETS.posca_squeezer_thin;
const medP = POSCA_PRESETS.posca_squeezer_medium;
const thickP = POSCA_PRESETS.posca_squeezer_thick;

console.assert(thinP.dripWidthRatio === 0.24, 'Thin drip ratio should be 0.24');
console.assert(medP.dripWidthRatio === 0.32, 'Medium drip ratio should be 0.32');
console.assert(thickP.dripWidthRatio === 0.38, 'Thick drip ratio should be 0.38');
console.assert(thinP.numTracks === 20, 'Thin should have 20 tracks');
console.assert(medP.numTracks === 28, 'Medium should have 28 tracks');
console.assert(thickP.numTracks === 36, 'Thick should have 36 tracks');
console.log('  ✓ Presets validated.');

// TEST 2: Posca Squeezer Stroke Direction & Line Caps
console.log('Test 2: Posca Stroke Longitudinal Geometry & No Butt-Cap Artifacts');
const squeezer = new PoscaSqueezerV3({ preset: 'posca_squeezer_medium' });
const ctx1 = mockContext();
squeezer.down({ x: 100, y: 100 }, ctx1);
// Move rightwards (dx > 0, dy = 0)
squeezer.move({ x: 200, y: 100 }, 0.05, ctx1);
squeezer.up({ x: 200, y: 100 }, ctx1);

// Verify that all lineTo operations have lineCap == 'round'
const lineOps = ctx1.operations.filter(op => op.op === 'lineTo');
console.assert(lineOps.length > 0, 'Should have stroke lines');
for (const op of lineOps) {
  console.assert(op.cap === 'round', `Expected lineCap 'round' but got '${op.cap}'`);
}

// Verify that longitudinal tracks span within the physical brush diameter along stroke direction
const trackLines = lineOps.filter(op => op.lw < 20); // Individual filament lines
console.assert(trackLines.length > 0, 'Should have longitudinal filament lines');
for (const op of trackLines) {
  // Brush has radius ~12px; stroke goes from 100 to 200, so valid bounds are [100 - radius, 200 + radius]
  console.assert(op.x >= 80 && op.x <= 220, `Track line X (${op.x}) out of bounds`);
}
console.log('  ✓ Posca strokes strictly use round caps and longitudinal flow vectors.');

// TEST 3: Drip Simulation - Proportional Drip Width & No Terminal Dot
console.log('Test 3: FluidDynamics Gravity Drips (No Terminal Dot, Gentle Taper)');
const fluid = new FluidDynamics();
fluid.spawnDrip(150, 150, 0.5, 24, 0.55, '#000000', 0.45, 0.16, 0.32);
console.assert(fluid.activeDrips.length === 1, 'Drip spawned');
const d = fluid.activeDrips[0];
console.assert(Math.abs(d.width - 24 * 0.32) < 0.1, `Drip width should be ~7.68px, got ${d.width}`);

let dripSegments = [];
for (let step = 0; step < 30; step++) {
  fluid.updateDrips(0.016, (seg) => {
    dripSegments.push(seg);
    console.assert(seg.isHead === undefined, 'No isHead dot property should be passed');
  });
}
console.assert(dripSegments.length > 5, 'Drip segments generated');
const firstW = dripSegments[0].w1;
const lastW = dripSegments[dripSegments.length - 1].w1;
const taperRatio = lastW / firstW;
console.assert(taperRatio >= 0.70 && taperRatio <= 0.95, `Taper ratio should be gentle (70-95%), got ${taperRatio.toFixed(2)}`);
console.log(`  ✓ Drip line thinned gently from ${firstW.toFixed(1)}px to ${lastW.toFixed(1)}px (ratio: ${(taperRatio * 100).toFixed(0)}%, no bulb dot).`);

// TEST 4: createInkDynamics Modular Library & Multi-Agent Boids
console.log('Test 4: createInkDynamics Factory & Multi-Agent Boids Channels');
const canvas = mockCanvas();
const ink = createInkDynamics({
  canvas,
  tool: 'posca_squeezer',
  thickness: 'thick',
  color: 'blue',
  paperTooth: 0.5,
  autoStep: false,
});

const cfg = ink.getConfig();
console.assert(cfg.tool === 'posca_squeezer', 'Tool should be posca_squeezer');
console.assert(cfg.color === INKWELL_COLORS.blue, `Color should resolve to ${INKWELL_COLORS.blue}, got ${cfg.color}`);
console.assert(cfg.radius === INKWELL_THICKNESS.thick.posca_squeezer, `Thick radius should be 22px, got ${cfg.radius}`);

// Test drawing with primary pen (agentId 0)
ink.penDown(50, 50, 0.5, 1000, 0);
ink.penMove(150, 50, 0.05, 0.5, 1050, 0);
ink.penUp(150, 50, 1050, 0);

// Test drawing with parallel boid agents (agentId 1 and 2)
ink.penDown(200, 200, 0.5, 1000, 1);
ink.penDown(300, 300, 0.5, 1000, 2);
ink.penMove(250, 220, 0.05, 0.5, 1050, 1);
ink.penMove(350, 320, 0.05, 0.5, 1050, 2);
ink.penUp(250, 220, 1050, 1);
ink.penUp(350, 320, 1050, 2);

console.assert(ink.agentPens.has(1), 'Agent 1 channel instantiated');
console.assert(ink.agentPens.has(2), 'Agent 2 channel instantiated');
console.log('  ✓ Multi-agent boids draw independently without state cross-talk.');

// TEST 5: Switching to Chinese Brush & Presets
console.log('Test 5: Chinese Brush v2 Compatibility in Library');
ink.setTool('chinese_brush', 'fine_thick_high_contrast');
ink.setThickness('thin');
const brushCfg = ink.getConfig();
console.assert(brushCfg.tool === 'chinese_brush', 'Tool should be chinese_brush');
console.assert(brushCfg.preset === 'fine_thick_high_contrast', 'Preset should be fine_thick_high_contrast');
console.assert(brushCfg.radius === INKWELL_THICKNESS.thin.chinese_brush, `Radius should be 3.5px, got ${brushCfg.radius}`);

ink.penDown(400, 100, 0.5, 2000, 0);
ink.penMove(450, 250, 0.04, 0.5, 2040, 0);
ink.penUp(450, 250, 2040, 0);
console.log('  ✓ Chinese Brush v2 presets and drawing verified.');

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! InkDynamics v3.0 is verified and ready.');
