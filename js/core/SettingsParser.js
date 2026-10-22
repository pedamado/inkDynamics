// ═══════════════════════════════════════════════════════════════════════════
// INK DYNAMICS — SettingsParser.js (v4.0)
// Reads a pen's settings from the text a person pastes — the calibration lab's "1-Line Call"
// (createInkDynamics({ … })), its "Config JSON" (ink.setConfig({ … }) or a bare { … }), or just `key: value, …` —
// WITHOUT running it (no eval / Function): a small parser for object literals (unquoted or quoted keys, '…' "…"
// strings, numbers, true / false / null, nested objects and arrays, Math.PI arithmetic, comments). Host apps use it for
// an "expert" settings field (Inkwell 20); validateInkSettings() then keeps only known keys, in range.
// ═══════════════════════════════════════════════════════════════════════════

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const INK_TOOLS = Object.freeze(['chinese_brush', 'posca_squeezer', 'ruling_pen_curved', 'ruling_pen_flat']);
export const INK_THICKNESS_TOKENS = Object.freeze(['hairline', 'thin', 'medium', 'thick', 'broad']);

// every setting a pen understands: type, range or choices, and which instruments read it ('*' = all / the blender)
export const INK_SETTING_KEYS = Object.freeze({
  tool: { type: 'enum', values: INK_TOOLS, for: '*' },
  preset: { type: 'string', for: '*' },
  color: { type: 'color', for: '*' },
  thickness: { type: 'thickness', for: '*' },
  radius: { type: 'number', range: [0.5, 64], for: '*' },
  paperTooth: { type: 'number', range: [0, 1], for: '*' },
  overprintModel: { type: 'enum', values: ['mix', 'classic'], for: '*' },
  blendMode: { type: 'enum', values: ['multiply', 'source-over', 'normal', 'off'], for: '*' },
  inkDensity: { type: 'number', range: [0.65, 1.0], for: '*' },
  overprintDarken: { type: 'number', range: [0, 1], for: '*' },
  overprintSwell: { type: 'number', range: [0, 0.35], for: '*' },
  overprintAttack: { type: 'number', range: [0, 1], for: '*' },
  overprintRelease: { type: 'number', range: [0, 1], for: '*' },
  overprintReach: { type: 'number', range: [0.2, 1.5], for: '*' },
  paperColor: { type: 'color', for: '*' },
  // the Zig brush
  slowEngorgeRatio: { type: 'number', range: [1.0, 6.0], for: ['chinese_brush', 'posca_squeezer', 'ruling_pen_curved', 'ruling_pen_flat'] },
  fastThinRatio: { type: 'number', range: [0.05, 1.0], for: ['chinese_brush', 'ruling_pen_curved', 'ruling_pen_flat'] },
  depletionRate: { type: 'number', range: [0.1, 3.0], for: ['chinese_brush'] },
  refillRate: { type: 'number', range: [0.2, 4.0], for: ['chinese_brush'] },
  starveEaseIn: { type: 'number', range: [20, 400], for: ['chinese_brush'] },
  starveEaseOut: { type: 'number', range: [20, 400], for: ['chinese_brush'] },
  numBristles: { type: 'int', range: [12, 64], for: ['chinese_brush'] },
  boneHeadFlare: { type: 'number', range: [1.0, 3.0], for: ['chinese_brush'] },
  soakRate: { type: 'number', range: [0, 3.0], for: ['chinese_brush'] },
  // the Posca mop
  fastWaistRatio: { type: 'number', range: [0.5, 1.0], for: ['posca_squeezer'] },
  borderStarveSensitivity: { type: 'number', range: [0, 2.5], for: ['posca_squeezer'] },
  dripThreshold: { type: 'number', range: [0.1, 1.0], for: ['posca_squeezer'] },
  flowRate: { type: 'number', range: [0.5, 3.5], for: ['posca_squeezer'] },
  viscosity: { type: 'number', range: [0.1, 0.9], for: ['posca_squeezer'] },
  initialDomeFlare: { type: 'number', range: [1.0, 1.6], for: ['posca_squeezer'] },
  dripWidthRatio: { type: 'number', range: [0.1, 0.6], for: ['posca_squeezer'] },
  // the ruling pens
  penMode: { type: 'enum', values: ['blade', 'point'], for: ['ruling_pen_curved', 'ruling_pen_flat'] },
  bladeAngle: { type: 'number', range: [0, Math.PI], for: ['ruling_pen_curved', 'ruling_pen_flat'] },
  chatterIntensity: { type: 'number', range: [0, 3.0], for: ['ruling_pen_curved', 'ruling_pen_flat'] },
  skipSensitivity: { type: 'number', range: [0.1, 2.5], for: ['ruling_pen_curved', 'ruling_pen_flat'] },
  snapIntensity: { type: 'number', range: [0, 2.5], for: ['ruling_pen_curved', 'ruling_pen_flat'] },
  edgeAsymmetry: { type: 'number', range: [0, 1], for: ['ruling_pen_flat'] },
  asymmetrySide: { type: 'enum', values: ['left', 'right'], for: ['ruling_pen_flat'] },
  minWidthScale: { type: 'number', range: [0.05, 1.0], for: ['ruling_pen_curved', 'ruling_pen_flat'] },
  maxWidthScale: { type: 'number', range: [1.0, 4.0], for: ['ruling_pen_curved', 'ruling_pen_flat'] },
  minSpitCount: { type: 'int', range: [1, 40], for: ['ruling_pen_curved', 'ruling_pen_flat'] },
  maxSpitCount: { type: 'int', range: [1, 60], for: ['ruling_pen_curved', 'ruling_pen_flat'] },
  maxDropletSize: { type: 'number', range: [1.0, 16.0], for: ['ruling_pen_curved', 'ruling_pen_flat'] },
  burstExplosionWidth: { type: 'number', range: [1.0, 4.0], for: ['ruling_pen_curved', 'ruling_pen_flat'] },
});

// other names that mean the same setting
export const INK_SETTING_ALIASES = Object.freeze({ blendIntensity: 'overprintDarken', nibRadius: 'radius' });

// keys that belong to the host page, not to a pen: understood, never applied
const HOST_KEYS = new Set(['canvas', 'width', 'height', 'autoStep', 'onMark', 'onTelemetry', 'agentId', 'rawSettings', 'transparent', 'initialPreset']);

// ── the parser ──────────────────────────────────────────────────────────────

class Reader {
  constructor(text) { this.s = text; this.i = 0; }
  fail(msg) { const e = new Error(msg + ' (at ' + this.i + ')'); e.parse = true; throw e; }
  ws() {
    const s = this.s;
    for (;;) {
      while (this.i < s.length && /\s/.test(s[this.i])) this.i++;
      if (s.startsWith('//', this.i)) { const n = s.indexOf('\n', this.i); this.i = n < 0 ? s.length : n + 1; continue; }
      if (s.startsWith('/*', this.i)) { const n = s.indexOf('*/', this.i + 2); this.i = n < 0 ? s.length : n + 2; continue; }
      break;
    }
  }
  peek() { this.ws(); return this.s[this.i]; }
  eat(ch) { if (this.peek() === ch) { this.i++; return true; } return false; }
  expect(ch) { if (!this.eat(ch)) this.fail('expected "' + ch + '"'); }
  string() {
    const q = this.s[this.i++];
    let out = '';
    while (this.i < this.s.length) {
      const c = this.s[this.i++];
      if (c === q) return out;
      if (c === '\\') {
        const n = this.s[this.i++];
        out += n === 'n' ? '\n' : n === 't' ? '\t' : n;
      } else {
        if (q === '`' && c === '$' && this.s[this.i] === '{') this.fail('template expressions are not read');
        out += c;
      }
    }
    return this.fail('unterminated string');
  }
  ident() {
    const m = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/.exec(this.s.slice(this.i));
    if (!m) this.fail('unexpected "' + (this.s[this.i] || 'end') + '"');
    this.i += m[0].length;
    return m[0];
  }
  number() {
    const m = /^(?:0x[0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/.exec(this.s.slice(this.i));
    if (!m) this.fail('bad number');
    this.i += m[0].length;
    return Number(m[0]);
  }
  // numbers with + − × ÷, parentheses and Math.PI / Math.E (bladeAngle: Math.PI / 4)
  expr() { let v = this.term(); for (;;) { const c = this.peek(); if (c === '+' || c === '-') { this.i++; const r = this.term(); v = c === '+' ? v + r : v - r; } else return v; } }
  term() { let v = this.unary(); for (;;) { const c = this.peek(); if (c === '*' || c === '/') { this.i++; const r = this.unary(); v = c === '*' ? v * r : v / r; } else return v; } }
  unary() {
    const c = this.peek();
    if (c === '-') { this.i++; return -this.unary(); }
    if (c === '+') { this.i++; return this.unary(); }
    if (c === '(') { this.i++; const v = this.expr(); this.expect(')'); return v; }
    if (/[0-9.]/.test(c)) return this.number();
    const id = this.ident();
    if (id === 'Math.PI') return Math.PI;
    if (id === 'Math.E') return Math.E;
    return this.fail('not a number: ' + id);
  }
  value(path, out) {
    const c = this.peek();
    if (c === '{') return this.object(path, out);
    if (c === '[') {
      this.i++;
      const arr = [];
      while (this.peek() !== ']') { arr.push(this.value(path + '[]', out)); if (!this.eat(',')) break; }
      this.expect(']');
      return arr;
    }
    if (c === '"' || c === "'" || c === '`') return this.string();
    if (c === '-' || c === '+' || c === '(' || /[0-9.]/.test(c)) return this.expr();
    if (c === undefined) this.fail('unexpected end');
    const save = this.i;
    const id = this.ident();
    if (id === 'true') return true;
    if (id === 'false') return false;
    if (id === 'null') return null;
    if (id === 'undefined') return undefined;
    if (id === 'Math.PI' || id === 'Math.E') { this.i = save; return this.expr(); }
    // a name the page knows (canvas, a function…): not a value we can read
    out.unreadable.push(path);
    return undefined;
  }
  object(path, out) {
    this.expect('{');
    const obj = {};
    while (this.peek() !== '}') {
      if (this.peek() === undefined) this.fail('unterminated object');
      let key;
      const c = this.peek();
      if (c === '"' || c === "'") key = this.string();
      else if (/[0-9]/.test(c)) key = String(this.number());
      else key = this.ident();
      // shorthand `{ canvas, tool: … }`
      if (this.peek() === ',' || this.peek() === '}') { out.unreadable.push(path ? path + '.' + key : key); this.eat(','); continue; }
      this.expect(':');
      obj[key] = this.value(path ? path + '.' + key : key, out);
      if (!this.eat(',')) break;
    }
    this.expect('}');
    return obj;
  }
}

// the first balanced { … } in the text (strings and comments respected), or null
function firstObject(text) {
  let depth = 0, start = -1, q = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && text[i + 1] === '/') { const n = text.indexOf('\n', i); i = n < 0 ? text.length : n; continue; }
    if (c === '/' && text[i + 1] === '*') { const n = text.indexOf('*/', i + 2); i = n < 0 ? text.length : n + 1; continue; }
    if (c === '{') { if (depth++ === 0) start = i; }
    else if (c === '}' && depth > 0 && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

/**
 * Parses a pasted settings text.
 * @returns {{ settings: Object, unreadable: string[], error: string|null }}
 *   settings: the keys and values read (not yet validated); unreadable: keys whose value is a page name (canvas…);
 *   error: why nothing could be read (settings is then {}).
 */
export function parseInkSettings(text) {
  const out = { settings: {}, unreadable: [], error: null };
  const src = String(text == null ? '' : text).trim();
  if (!src) return out;
  let body = firstObject(src);
  if (!body) body = '{' + src.replace(/;\s*$/, '') + '\n}';   // just `key: value, …` (a trailing // comment ends at the newline)
  try {
    const r = new Reader(body);
    const obj = r.object('', out);
    out.settings = obj && typeof obj === 'object' ? obj : {};
  } catch (e) {
    out.settings = {};
    out.error = e && e.parse ? e.message : 'unreadable';
  }
  return out;
}

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const RGB = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*[\d.]+\s*)?\)$/;

/**
 * Keeps the known settings, in range. Unknown keys and wrong types are reported, never applied.
 * @param {Object} settings  as parsed (or any object)
 * @param {Object} opts      colorTokens: names accepted as colours (e.g. INKWELL_COLORS); presets: ids accepted
 * @returns {{ settings: Object, warnings: string[] }}
 */
export function validateInkSettings(settings, { colorTokens = null, presets = null } = {}) {
  const clean = {}, warnings = [];
  if (!settings || typeof settings !== 'object') return { settings: clean, warnings };
  for (const [rawKey, v] of Object.entries(settings)) {
    const key = INK_SETTING_ALIASES[rawKey] || rawKey;
    if (HOST_KEYS.has(key)) continue;
    const spec = INK_SETTING_KEYS[key];
    if (!spec) { warnings.push('unknown setting: ' + rawKey); continue; }
    if (v === undefined || v === null) continue;
    switch (spec.type) {
      case 'number':
      case 'int': {
        const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
        if (!Number.isFinite(n)) { warnings.push(rawKey + ': not a number'); break; }
        let c = clamp(n, spec.range[0], spec.range[1]);
        if (spec.type === 'int') c = Math.round(c);
        if (c !== n) warnings.push(rawKey + ': ' + n + ' → ' + c);
        clean[key] = c;
        break;
      }
      case 'enum':
        if (typeof v === 'boolean' && key === 'blendMode') clean[key] = v ? 'multiply' : 'source-over';
        else if (spec.values.includes(v)) clean[key] = v;
        else warnings.push(rawKey + ': not one of ' + spec.values.join(', '));
        break;
      case 'string':
        if (typeof v !== 'string' || !/^[\w-]{1,64}$/.test(v)) { warnings.push(rawKey + ': not a name'); break; }
        if (presets && !presets.includes(v)) { warnings.push(rawKey + ': unknown preset ' + v); break; }
        clean[key] = v;
        break;
      case 'color':
        if (typeof v === 'string' && (HEX.test(v.trim()) || RGB.test(v.trim()))) clean[key] = v.trim();
        else if (typeof v === 'string' && colorTokens && colorTokens[v.toLowerCase()]) clean[key] = v.toLowerCase();
        else warnings.push(rawKey + ': not a colour');
        break;
      case 'thickness':
        if (typeof v === 'number' && Number.isFinite(v)) clean[key] = clamp(v, 0.5, 64);
        else if (typeof v === 'string' && INK_THICKNESS_TOKENS.includes(v.toLowerCase())) clean[key] = v.toLowerCase();
        else warnings.push(rawKey + ': not a thickness');
        break;
      default:
        break;
    }
  }
  if (clean.minSpitCount != null && clean.maxSpitCount != null && clean.maxSpitCount < clean.minSpitCount) {
    clean.maxSpitCount = clean.minSpitCount;
    warnings.push('maxSpitCount raised to minSpitCount');
  }
  return { settings: clean, warnings };
}

/**
 * Turns settings into the lab's "1-Line Call" text (what parseInkSettings reads back).
 */
export function formatInkSettings(settings, { call = true } = {}) {
  const parts = [];
  for (const [k, v] of Object.entries(settings || {})) {
    if (v === undefined) continue;
    const val = typeof v === 'string' ? "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
      : typeof v === 'number' ? String(Number(v.toFixed(4)))
      : JSON.stringify(v);
    parts.push(k + ': ' + val);
  }
  return call ? 'const ink = createInkDynamics({ canvas, ' + parts.join(', ') + ' });' : '{ ' + parts.join(', ') + ' }';
}
