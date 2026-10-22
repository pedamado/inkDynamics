// ═══════════════════════════════════════════════════════════════════════════
// INK DYNAMICS — PresetCatalog.js (v4.0)
// The 13 core presets of the 4 instruments, as one read-only catalog. The core presets are permanent: their tables
// are deep-frozen here (nothing at run time — a slider, a user preset, a host app — can change them); people's own
// tunings live in user presets (UserPresetStore), each one "a core preset + the values changed".
// ═══════════════════════════════════════════════════════════════════════════

import { ZIG_PRESETS } from '../instruments/ChineseBrushV2.js';
import { POSCA_PRESETS } from '../instruments/PoscaSqueezerV3.js';
import { CURVED_RULING_PRESETS } from '../instruments/RulingPenCurved.js';
import { FLAT_RULING_PRESETS } from '../instruments/RulingPenFlat.js';

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}
[ZIG_PRESETS, POSCA_PRESETS, CURVED_RULING_PRESETS, FLAT_RULING_PRESETS].forEach(deepFreeze);

// the instruments, in the order a menu shows them
export const INK_INSTRUMENTS = deepFreeze([
  { id: 'chinese_brush', name: 'Zig Chinese Brush', presets: ZIG_PRESETS, defaultPreset: 'fine_low_var', swell: 0.075 },
  { id: 'posca_squeezer', name: 'Posca Mop Squeezer', presets: POSCA_PRESETS, defaultPreset: 'posca_squeezer_medium', swell: 0.10 },
  { id: 'ruling_pen_curved', name: 'Curved Ruling Pen', presets: CURVED_RULING_PRESETS, defaultPreset: 'curved_ruling_medium', swell: 0.05 },
  { id: 'ruling_pen_flat', name: 'Flat Ruling Pen', presets: FLAT_RULING_PRESETS, defaultPreset: 'flat_ruling_medium', swell: 0.05 },
]);

// every core preset: { id, tool, toolName, name, description, core: true }
export const CORE_PRESETS = deepFreeze(INK_INSTRUMENTS.flatMap((inst) => Object.values(inst.presets).map((p) => ({
  id: p.id,
  tool: inst.id,
  toolName: inst.name,
  name: p.name,
  description: p.description,
  baseRadius: p.baseRadius,
  core: true,
}))));

const BY_ID = new Map(CORE_PRESETS.map((p) => [p.id, p]));

export function corePreset(id) {
  return BY_ID.get(id) || null;
}

// the instrument a preset id belongs to, or null
export function toolOfPreset(id) {
  const p = BY_ID.get(id);
  return p ? p.tool : null;
}

export function isCorePreset(id) {
  return BY_ID.has(id);
}

/**
 * Core presets first, then the user's — one list for a menu (each entry: id, tool, name, core).
 * @param {Array} userPresets  from UserPresetStore.list()
 */
export function listPresets(userPresets = []) {
  const user = (userPresets || []).filter((u) => u && u.id && u.tool).map((u) => ({
    id: u.id, tool: u.tool, toolName: (INK_INSTRUMENTS.find((i) => i.id === u.tool) || {}).name || u.tool,
    name: u.name, description: u.notes || '', basePreset: u.basePreset, core: false,
  }));
  return CORE_PRESETS.concat(user);
}

/**
 * What to pass to ink.setConfig() for a preset: a core preset id, or a user preset object (its base preset, then its
 * own values on top).
 */
export function presetToConfig(preset) {
  if (!preset) return null;
  if (typeof preset === 'string') {
    const p = BY_ID.get(preset);
    return p ? { tool: p.tool, preset: p.id } : null;
  }
  const base = preset.basePreset && BY_ID.get(preset.basePreset);
  const tool = preset.tool || (base && base.tool);
  if (!tool) return null;
  return { tool, preset: base ? base.id : undefined, ...(preset.settings || {}) };
}
