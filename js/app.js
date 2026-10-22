// ═══════════════════════════════════════════════════════════════════════════
// INK DYNAMICS v2 — app.js
// Main application entry point for the Zig Chinese Brush calibration lab.
// ═══════════════════════════════════════════════════════════════════════════

import { InkDynamicsEngine } from './InkDynamicsEngine.js';
import { Toolbar } from './ui/Toolbar.js';
import { TelemetryHUD } from './ui/TelemetryHUD.js';

function initApp() {
  const canvas = document.getElementById('drawing-canvas');
  const toolbarContainer = document.getElementById('toolbar-container');
  const hudContainer = document.getElementById('hud-container');

  if (!canvas || !toolbarContainer || !hudContainer) {
    console.error('[InkDynamics] DOM elements missing');
    return;
  }

  // Initialize Telemetry HUD
  const hud = new TelemetryHUD(hudContainer);

  // Initialize Core Simulation Engine
  const engine = new InkDynamicsEngine(canvas, {
    initialPreset: 'medium_high_dynamic',
    color: '#050505',
    onTelemetry: (metrics) => {
      hud.update(metrics);
    },
  });

  // Initialize UI Toolbar
  const toolbar = new Toolbar(toolbarContainer, engine);

  // Check URL query parameters (e.g. ?tool=ruling_pen_curved&preset=curved_ruling_medium)
  try {
    const params = new URLSearchParams(window.location.search);
    const toolParam = params.get('tool');
    const presetParam = params.get('preset');
    if (toolParam && engine.instruments[toolParam]) {
      engine.setInstrument(toolParam);
      if (presetParam) {
        engine.setPreset(presetParam);
      }
      toolbar._syncSliders();
    }
  } catch (_) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // Pointer Event Listeners (Mouse, Stylus / Apple Pencil, Multi-touch)
  // ═══════════════════════════════════════════════════════════════════════════

  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure > 0 ? e.pressure : 0.5,
    };
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const pt = getCanvasCoords(e);
    engine.pointerDown(pt.x, pt.y, pt.pressure, e);
  });

  canvas.addEventListener('pointermove', (e) => {
    e.preventDefault();
    const pt = getCanvasCoords(e);
    engine.pointerMove(pt.x, pt.y, pt.pressure, e);
  });

  canvas.addEventListener('pointerup', (e) => {
    e.preventDefault();
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (_) {}
    const pt = getCanvasCoords(e);
    engine.pointerUp(pt.x, pt.y);
  });

  canvas.addEventListener('pointercancel', (e) => {
    e.preventDefault();
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (_) {}
    const pt = getCanvasCoords(e);
    engine.pointerUp(pt.x, pt.y);
  });

  // Prevent browser touch gestures (pinch-zoom, bounce)
  canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  // ═══════════════════════════════════════════════════════════════════════════
  // Keyboard Shortcuts (Undo, Redo, Clear)
  // ═══════════════════════════════════════════════════════════════════════════

  window.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? e.metaKey : e.ctrlKey;

    if (modifier && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        engine.redo();
      } else {
        engine.undo();
      }
    } else if (modifier && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      engine.redo();
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Window Resizing
  // ═══════════════════════════════════════════════════════════════════════════

  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      engine.resize();
    }, 150);
  });

  // Dialog Close and Tab Buttons
  const refModal = document.getElementById('reference-modal');
  const refCloseBtn = document.getElementById('ref-modal-close-btn');
  if (refCloseBtn && refModal) {
    refCloseBtn.addEventListener('click', () => refModal.close());
  }

  const aboutModal = document.getElementById('about-modal');
  const aboutCloseBtn = document.getElementById('about-modal-close-btn');
  if (aboutCloseBtn && aboutModal) {
    aboutCloseBtn.addEventListener('click', () => aboutModal.close());
  }

  // Close modals on clicking backdrop
  [refModal, aboutModal].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        const rect = modal.getBoundingClientRect();
        if (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        ) {
          modal.close();
        }
      });
    }
  });

  const tabs = [
    { btn: document.getElementById('tab-btn-ruling-curved'), panel: document.getElementById('ref-panel-ruling-curved') },
    { btn: document.getElementById('tab-btn-ruling-flat'), panel: document.getElementById('ref-panel-ruling-flat') },
    { btn: document.getElementById('tab-btn-posca'), panel: document.getElementById('ref-panel-posca') },
    { btn: document.getElementById('tab-btn-zig'), panel: document.getElementById('ref-panel-zig') },
  ];

  tabs.forEach(({ btn, panel }) => {
    if (!btn || !panel) return;
    btn.addEventListener('click', () => {
      tabs.forEach(t => {
        if (t.btn) t.btn.classList.remove('active');
        if (t.panel) t.panel.classList.add('hidden');
      });
      btn.classList.add('active');
      panel.classList.remove('hidden');
    });
  });

  window.inkEngine = engine;

  window.drawCalibrationSpecimens = function () {
    engine.clear();
    const w = engine.width;
    const h = engine.height;

    // Stroke 1: Flat Ruling Medium — Slow & Compact (125 px/s: solid core, monoline width, rectangular waveform teeth)
    engine.setPreset('flat_ruling_medium');
    let x = w * 0.32;
    let yStart = 80;
    let yEnd = h - 90;
    let steps = 300;
    engine.pointerDown(x, yStart, 0.6);
    for (let i = 1; i <= steps; i++) {
      let curY = yStart + (yEnd - yStart) * (i / steps);
      engine.pointerMove(x, curY, 0.6);
    }
    engine.pointerUp(x, yEnd);

    // Stroke 2: Flat Ruling Medium — Accelerating to Fast (260 px/s: ladder rungs, edge teeth, spit burst)
    x = w * 0.44;
    steps = 140;
    engine.pointerDown(x, yStart, 0.65);
    for (let i = 1; i <= steps; i++) {
      let curY = yStart + (yEnd - yStart) * (i / steps);
      engine.pointerMove(x, curY, 0.65);
    }
    engine.pointerUp(x, yEnd);

    // Stroke 3: Flat Ruling Broad — High-Speed Train Tracks (480 px/s: dual outer rails, transverse rungs, skips)
    engine.setPreset('flat_ruling_broad');
    x = w * 0.58;
    steps = 75;
    engine.pointerDown(x, yStart, 0.7);
    for (let i = 1; i <= steps; i++) {
      let curY = yStart + (yEnd - yStart) * (i / steps);
      engine.pointerMove(x, curY, 0.7);
    }
    engine.pointerUp(x, yEnd);

    // Stroke 4: Curved Ruling Medium — Moderate Velocity (210 px/s: dense assorted round-capped lines & overlapping ellipses)
    engine.setPreset('curved_ruling_medium');
    x = w * 0.72;
    steps = 175;
    engine.pointerDown(x, yStart, 0.6);
    for (let i = 1; i <= steps; i++) {
      let curY = yStart + (yEnd - yStart) * (i / steps);
      engine.pointerMove(x, curY, 0.6);
    }
    engine.pointerUp(x, yEnd);

    // Stroke 5: Curved Ruling Broad — Fast Waveform Sweeps & Bilateral Spit Explosions (520 px/s)
    engine.setPreset('curved_ruling_broad');
    x = w * 0.86;
    steps = 70;
    engine.pointerDown(x, yStart, 0.75);
    for (let i = 1; i <= steps; i++) {
      let curY = yStart + (yEnd - yStart) * (i / steps);
      engine.pointerMove(x, curY, 0.75);
    }
    engine.pointerUp(x, yEnd);
  };

  if (window.location.search && window.location.search.includes('demo=1')) {
    setTimeout(() => {
      window.drawCalibrationSpecimens();
    }, 200);
  }

  console.log('[InkDynamics v3] Lab initialized: Zig Chinese Brush, Posca Mop Squeezer, Curved Ruling Pen, Flat Ruling Pen.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
