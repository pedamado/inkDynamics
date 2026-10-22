// ═══════════════════════════════════════════════════════════════════════════
// INK DYNAMICS — UserPresetStore.js (v4.0)
// People's own pens, kept for good: create · read · update · delete user presets, next to the permanent core presets.
// A user preset = a core preset (`basePreset`) + the values changed (`settings`, validated: only known keys, in
// range). Where they are kept is an adapter:
//   localStorageAdapter(key)        this browser (default; nothing to set up — the calibration lab uses it)
//   memoryAdapter()                 nowhere (tests, previews)
//   httpAdapter({ endpoint, token }) a server: the reference PHP endpoint in server/presets.php (flat-file JSON,
//                                   write token), or any endpoint with the same small protocol
//   your own                        any object with  load() → Promise<Array>  and  save(Array) → Promise
//                                   (Inkwell 20 keeps a signed-in person's pens in their account through its own API)
// ═══════════════════════════════════════════════════════════════════════════

import { INK_TOOLS, validateInkSettings } from '../core/SettingsParser.js';
import { corePreset, isCorePreset } from './PresetCatalog.js';

export const USER_PRESET_LIMIT = 200;
const NAME_MAX = 80;
const NOTES_MAX = 400;

const now = () => Date.now();
const newId = () => 'user-' + Math.random().toString(36).slice(2, 10) + now().toString(36).slice(-4);
const cleanText = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Checks and normalises one user preset (throws an Error with .code when it cannot be kept).
 */
export function normalizeUserPreset(p, { keepId = true } = {}) {
  if (!p || typeof p !== 'object') throw Object.assign(new Error('not a preset'), { code: 'invalid' });
  const name = cleanText(p.name, NAME_MAX);
  if (!name) throw Object.assign(new Error('a preset needs a name'), { code: 'name' });
  const base = p.basePreset && isCorePreset(p.basePreset) ? p.basePreset : null;
  const tool = INK_TOOLS.includes(p.tool) ? p.tool : base ? corePreset(base).tool : null;
  if (!tool) throw Object.assign(new Error('unknown instrument'), { code: 'tool' });
  if (base && corePreset(base).tool !== tool) throw Object.assign(new Error('the base preset is of another instrument'), { code: 'tool' });
  const { settings } = validateInkSettings(p.settings || {});
  delete settings.tool;
  delete settings.preset;
  const id = keepId && typeof p.id === 'string' && /^user-[a-z0-9]{4,32}$/.test(p.id) ? p.id : newId();
  return {
    id,
    name,
    tool,
    basePreset: base,
    settings,
    notes: cleanText(p.notes, NOTES_MAX),
    created: Number.isFinite(p.created) ? p.created : now(),
    updated: Number.isFinite(p.updated) ? p.updated : now(),
    v: 1,
  };
}

// ── adapters ────────────────────────────────────────────────────────────────

export function memoryAdapter(initial = []) {
  let data = JSON.parse(JSON.stringify(initial || []));
  return {
    kind: 'memory',
    async load() { return JSON.parse(JSON.stringify(data)); },
    async save(list) { data = JSON.parse(JSON.stringify(list)); },
  };
}

export function localStorageAdapter(key = 'inkdynamics.userPresets.v1') {
  return {
    kind: 'local',
    async load() {
      try {
        const raw = globalThis.localStorage && globalThis.localStorage.getItem(key);
        const v = raw ? JSON.parse(raw) : [];
        return Array.isArray(v) ? v : [];
      } catch (_) { return []; }
    },
    async save(list) {
      try { globalThis.localStorage.setItem(key, JSON.stringify(list)); }
      catch (e) { throw Object.assign(new Error('this browser did not keep the presets'), { code: 'storage' }); }
    },
  };
}

/**
 * A server that keeps the list (server/presets.php, or the same protocol):
 *   GET  endpoint?c=<collection>                     → { presets: [...] }
 *   POST endpoint?c=<collection>  { presets: [...] } → { presets: [...] }     (Authorization: Bearer <token>)
 */
export function httpAdapter({ endpoint, token = null, collection = 'default', fetchImpl = null, headers = {} } = {}) {
  if (!endpoint) throw new Error('httpAdapter needs an endpoint');
  const f = fetchImpl || globalThis.fetch.bind(globalThis);
  const url = endpoint + (endpoint.includes('?') ? '&' : '?') + 'c=' + encodeURIComponent(collection);
  const h = (json) => ({ ...(json ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers });
  const read = async (res) => {
    let body = null;
    try { body = await res.json(); } catch (_) { /* not JSON */ }
    if (!res.ok) throw Object.assign(new Error((body && body.error) || 'the server said no (' + res.status + ')'), { code: (body && body.error) || 'http_' + res.status });
    return body && Array.isArray(body.presets) ? body.presets : [];
  };
  return {
    kind: 'http',
    async load() { return read(await f(url, { method: 'GET', headers: h(false), credentials: 'same-origin', cache: 'no-store' })); },
    async save(list) { return read(await f(url, { method: 'POST', headers: h(true), credentials: 'same-origin', body: JSON.stringify({ presets: list }) })); },
  };
}

// ── the store ───────────────────────────────────────────────────────────────

export class UserPresetStore {
  constructor({ adapter = localStorageAdapter(), limit = USER_PRESET_LIMIT } = {}) {
    this.adapter = adapter;
    this.limit = limit;
    this._list = null;
    this._listeners = new Set();
  }

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit() {
    for (const fn of this._listeners) {
      try { fn(this._list.slice()); } catch (_) { /* a listener's own problem */ }
    }
  }

  async _load() {
    if (this._list) return this._list;
    const raw = await this.adapter.load();
    const out = [];
    for (const p of raw || []) {
      try { out.push(normalizeUserPreset(p)); } catch (_) { /* a damaged entry is skipped, not fatal */ }
    }
    this._list = out;
    return out;
  }

  async _save(list) {
    const kept = await this.adapter.save(list);
    // a server may answer with its own copy (normalised there too)
    this._list = Array.isArray(kept) && kept.length === list.length ? kept.map((p) => normalizeUserPreset(p)) : list;
    this._emit();
    return this._list;
  }

  // reads again from where the presets are kept (another tab or device may have changed them)
  async refresh() {
    this._list = null;
    const l = await this._load();
    this._emit();
    return l.slice();
  }

  async list() {
    return (await this._load()).slice();
  }

  async get(id) {
    return (await this._load()).find((p) => p.id === id) || null;
  }

  /** @param {{ name, tool?, basePreset?, settings?, notes? }} preset */
  async create(preset) {
    const list = await this._load();
    if (list.length >= this.limit) throw Object.assign(new Error('too many presets (' + this.limit + ')'), { code: 'limit' });
    const p = normalizeUserPreset({ ...preset, id: null, created: now(), updated: now() }, { keepId: false });
    await this._save(list.concat([p]));
    return p;
  }

  /** @param {string} id  @param {{ name?, settings?, notes?, basePreset?, tool? }} patch */
  async update(id, patch = {}) {
    const list = await this._load();
    const i = list.findIndex((p) => p.id === id);
    if (i < 0) throw Object.assign(new Error('no such preset'), { code: 'missing' });
    const merged = normalizeUserPreset({ ...list[i], ...patch, id, created: list[i].created, updated: now() });
    const next = list.slice();
    next[i] = merged;
    await this._save(next);
    return merged;
  }

  async remove(id) {
    const list = await this._load();
    const next = list.filter((p) => p.id !== id);
    if (next.length === list.length) return false;
    await this._save(next);
    return true;
  }

  async exportJSON() {
    return JSON.stringify({ format: 'inkdynamics-presets', version: 1, presets: await this.list() }, null, 2);
  }

  /** Adds (or, with replace, swaps in) the presets of an exported file. Returns how many were taken. */
  async importJSON(text, { replace = false } = {}) {
    let data;
    try { data = typeof text === 'string' ? JSON.parse(text) : text; } catch (_) { throw Object.assign(new Error('not a presets file'), { code: 'invalid' }); }
    const incoming = Array.isArray(data) ? data : data && Array.isArray(data.presets) ? data.presets : null;
    if (!incoming) throw Object.assign(new Error('not a presets file'), { code: 'invalid' });
    const list = replace ? [] : await this._load();
    const ids = new Set(list.map((p) => p.id));
    const out = list.slice();
    let n = 0;
    for (const p of incoming) {
      if (out.length >= this.limit) break;
      try {
        const q = normalizeUserPreset(p, { keepId: !ids.has(p && p.id) });
        ids.add(q.id);
        out.push(q);
        n++;
      } catch (_) { /* skipped */ }
    }
    await this._save(out);
    return n;
  }
}
