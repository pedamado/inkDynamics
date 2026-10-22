// ═══════════════════════════════════════════════════════════════════════════
// INK DYNAMICS — InkRecorder.js (v4.0)
// A stand-in for a Canvas2D context that RECORDS what an instrument draws (and its bounding box), so a host can draw
// the same ink onto several places without simulating it again: the tiles of a large surface, the copy at the seam of
// a 360° ring, another person's window in a shared drawing, an undo step that must know the area touched. The
// instruments only ever WRITE to their context (no read-backs), with this small set of calls — all recorded here:
//   save restore translate rotate beginPath moveTo lineTo bezierCurveTo quadraticCurveTo arc ellipse rect closePath
//   fill stroke fillRect · fillStyle strokeStyle lineWidth lineCap lineJoin globalAlpha globalCompositeOperation
// Replaying the ops onto a context draws exactly the same pixels (4 instruments + drips: 0 differing pixels).
//   const rec = new InkRecorder();
//   pen.move(point, dt, rec.ctx, fluid);              // simulate once
//   const { ops, box } = rec.take();                   // ops: a flat array (numbers + strings), box: [x0, y0, x1, y1]
//   InkRecorder.replay(tileCtx, ops);                  // anywhere, any number of times
// A style set again to the value it already has is not recorded twice (the instruments set colours on every sub-step);
// the first value of each style always is (the replay target's own state is not known).
// ═══════════════════════════════════════════════════════════════════════════

// op codes and how many arguments follow each
export const INK_OPS = Object.freeze({
  save: 0, restore: 1, translate: 2, rotate: 3, beginPath: 4, moveTo: 5, lineTo: 6, bezierCurveTo: 7,
  quadraticCurveTo: 8, arc: 9, ellipse: 10, closePath: 11, fill: 12, stroke: 13, rect: 14, fillRect: 15,
  fillStyle: 20, strokeStyle: 21, lineWidth: 22, lineCap: 23, lineJoin: 24, globalAlpha: 25, globalCompositeOperation: 26,
});
const ARGC = { 0: 0, 1: 0, 2: 2, 3: 1, 4: 0, 5: 2, 6: 2, 7: 6, 8: 4, 9: 6, 10: 8, 11: 0, 12: 0, 13: 0, 14: 4, 15: 4, 20: 1, 21: 1, 22: 1, 23: 1, 24: 1, 25: 1, 26: 1 };
const STYLE = ['fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'lineJoin', 'globalAlpha', 'globalCompositeOperation'];
const R = (v) => Math.round(v * 100) / 100;   // 1/100 px is far below what a pixel shows

export class InkRecorder {
  constructor() {
    this.ops = [];
    this._reset();
    const rec = this;
    // the context the instruments draw on
    const ctx = {
      save() { rec._push(0); rec._stack.push({ m: rec._m.slice(), st: { ...rec._st } }); },
      restore() { rec._push(1); const t = rec._stack.pop(); if (t) { rec._m = t.m; rec._st = t.st; } },
      translate(x, y) { rec._push(2, R(x), R(y)); const m = rec._m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; },
      rotate(a) {
        rec._push(3, Math.round(a * 1e5) / 1e5);
        const m = rec._m, c = Math.cos(a), s = Math.sin(a);
        const a0 = m[0], b0 = m[1], c0 = m[2], d0 = m[3];
        m[0] = a0 * c + c0 * s; m[1] = b0 * c + d0 * s; m[2] = c0 * c - a0 * s; m[3] = d0 * c - b0 * s;
      },
      beginPath() { rec._push(4); rec._path = [Infinity, Infinity, -Infinity, -Infinity]; },
      moveTo(x, y) { rec._push(5, R(x), R(y)); rec._pt(x, y, 0); },
      lineTo(x, y) { rec._push(6, R(x), R(y)); rec._pt(x, y, 0); },
      bezierCurveTo(a, b, c, d, x, y) { rec._push(7, R(a), R(b), R(c), R(d), R(x), R(y)); rec._pt(a, b, 0); rec._pt(c, d, 0); rec._pt(x, y, 0); },
      quadraticCurveTo(a, b, x, y) { rec._push(8, R(a), R(b), R(x), R(y)); rec._pt(a, b, 0); rec._pt(x, y, 0); },
      arc(x, y, r, a0, a1, ccw = false) { rec._push(9, R(x), R(y), R(r), Math.round(a0 * 1e5) / 1e5, Math.round(a1 * 1e5) / 1e5, ccw ? 1 : 0); rec._pt(x, y, Math.abs(r)); },
      ellipse(x, y, rx, ry, rot, a0, a1, ccw = false) {
        rec._push(10, R(x), R(y), R(rx), R(ry), Math.round(rot * 1e5) / 1e5, Math.round(a0 * 1e5) / 1e5, Math.round(a1 * 1e5) / 1e5, ccw ? 1 : 0);
        rec._pt(x, y, Math.max(Math.abs(rx), Math.abs(ry)));
      },
      rect(x, y, w, h) { rec._push(14, R(x), R(y), R(w), R(h)); rec._pt(x, y, 0); rec._pt(x + w, y + h, 0); rec._pt(x + w, y, 0); rec._pt(x, y + h, 0); },
      closePath() { rec._push(11); },
      fill() { rec._push(12); rec._merge(1); },
      stroke() { rec._push(13); rec._merge((rec._st.lineWidth ?? 1) / 2 + 1); },
      fillRect(x, y, w, h) {
        rec._push(15, R(x), R(y), R(w), R(h));
        const keep = rec._path; rec._path = [Infinity, Infinity, -Infinity, -Infinity];
        rec._pt(x, y, 0); rec._pt(x + w, y + h, 0); rec._pt(x + w, y, 0); rec._pt(x, y + h, 0); rec._merge(1); rec._path = keep;
      },
      // a no-op for code that resets the transform of a context it owns (the instruments do not)
      setTransform() {},
    };
    for (const name of STYLE) {
      Object.defineProperty(ctx, name, {
        get() { return rec._st[name]; },
        set(v) {
          if (rec._st[name] === v) return;
          rec._st[name] = v;
          rec._push(INK_OPS[name], name === 'lineWidth' || name === 'globalAlpha' ? Math.round(v * 1000) / 1000 : v);
        },
      });
    }
    this.ctx = ctx;
  }

  _reset() {
    this._m = [1, 0, 0, 1, 0, 0];
    this._stack = [];
    // the replay target's state is not known: the first value set of each style is always recorded
    this._st = { fillStyle: undefined, strokeStyle: undefined, lineWidth: undefined, lineCap: undefined, lineJoin: undefined, globalAlpha: undefined, globalCompositeOperation: undefined };
    this._path = [Infinity, Infinity, -Infinity, -Infinity];
    this.box = [Infinity, Infinity, -Infinity, -Infinity];
  }

  // starts a recording; `state`: styles the replay target is known to have already (they need not be recorded)
  begin(state = null) {
    this.ops = [];
    this._reset();
    if (state) Object.assign(this._st, state);
    return this.ctx;
  }

  _push(code, ...args) {
    this.ops.push(code);
    for (const a of args) this.ops.push(a);
  }

  // a point of the current path, through the current transform, grown by r (× the transform's scale)
  _pt(x, y, r) {
    const m = this._m;
    const X = m[0] * x + m[2] * y + m[4], Y = m[1] * x + m[3] * y + m[5];
    const k = r ? r * Math.max(Math.hypot(m[0], m[1]), Math.hypot(m[2], m[3])) : 0;
    const p = this._path;
    if (X - k < p[0]) p[0] = X - k;
    if (Y - k < p[1]) p[1] = Y - k;
    if (X + k > p[2]) p[2] = X + k;
    if (Y + k > p[3]) p[3] = Y + k;
  }

  _merge(pad) {
    const p = this._path, b = this.box;
    if (p[0] > p[2]) return;
    const s = Math.max(Math.hypot(this._m[0], this._m[1]), Math.hypot(this._m[2], this._m[3]));
    const k = pad * s;
    if (p[0] - k < b[0]) b[0] = p[0] - k;
    if (p[1] - k < b[1]) b[1] = p[1] - k;
    if (p[2] + k > b[2]) b[2] = p[2] + k;
    if (p[3] + k > b[3]) b[3] = p[3] + k;
  }

  get empty() { return this.ops.length === 0; }

  // what was recorded since begin() (ops, and the box of everything filled or stroked; null when nothing was drawn)
  take() {
    const ops = this.ops, b = this.box;
    const box = b[0] <= b[2] ? [Math.floor(b[0]), Math.floor(b[1]), Math.ceil(b[2]), Math.ceil(b[3])] : null;
    this.ops = [];
    this.box = [Infinity, Infinity, -Infinity, -Infinity];
    this._path = [Infinity, Infinity, -Infinity, -Infinity];
    return { ops, box };
  }

  /**
   * Draws recorded ops onto a context (any transform the context already has applies to them).
   * Save/restore pairs are balanced at the end, so a cut-off recording never leaks state into the host.
   */
  static replay(ctx, ops) {
    if (!ctx || !ops || !ops.length) return;
    let depth = 0;
    for (let i = 0; i < ops.length;) {
      const code = ops[i++], n = ARGC[code];
      if (n === undefined) break;   // not ink ops
      const a = ops;
      switch (code) {
        case 0: ctx.save(); depth++; break;
        case 1: if (depth > 0) { ctx.restore(); depth--; } break;
        case 2: ctx.translate(a[i], a[i + 1]); break;
        case 3: ctx.rotate(a[i]); break;
        case 4: ctx.beginPath(); break;
        case 5: ctx.moveTo(a[i], a[i + 1]); break;
        case 6: ctx.lineTo(a[i], a[i + 1]); break;
        case 7: ctx.bezierCurveTo(a[i], a[i + 1], a[i + 2], a[i + 3], a[i + 4], a[i + 5]); break;
        case 8: ctx.quadraticCurveTo(a[i], a[i + 1], a[i + 2], a[i + 3]); break;
        case 9: ctx.arc(a[i], a[i + 1], Math.max(0, a[i + 2]), a[i + 3], a[i + 4], !!a[i + 5]); break;
        case 10: ctx.ellipse(a[i], a[i + 1], Math.max(0, a[i + 2]), Math.max(0, a[i + 3]), a[i + 4], a[i + 5], a[i + 6], !!a[i + 7]); break;
        case 11: ctx.closePath(); break;
        case 12: ctx.fill(); break;
        case 13: ctx.stroke(); break;
        case 14: ctx.rect(a[i], a[i + 1], a[i + 2], a[i + 3]); break;
        case 15: ctx.fillRect(a[i], a[i + 1], a[i + 2], a[i + 3]); break;
        case 20: ctx.fillStyle = a[i]; break;
        case 21: ctx.strokeStyle = a[i]; break;
        case 22: ctx.lineWidth = a[i]; break;
        case 23: ctx.lineCap = a[i]; break;
        case 24: ctx.lineJoin = a[i]; break;
        case 25: ctx.globalAlpha = a[i]; break;
        case 26: ctx.globalCompositeOperation = a[i]; break;
        default: break;
      }
      i += n;
    }
    while (depth-- > 0) ctx.restore();
  }

  // checks that ops are well-formed ink ops (for ops that come from elsewhere, e.g. another window)
  static valid(ops, maxLen = 2e6) {
    if (!Array.isArray(ops) || ops.length > maxLen) return false;
    for (let i = 0; i < ops.length;) {
      const code = ops[i++], n = ARGC[code];
      if (n === undefined || i + n > ops.length) return false;
      for (let j = 0; j < n; j++) {
        const v = ops[i + j];
        if (code >= 20 && code !== 22 && code !== 25) {
          if (typeof v !== 'string' || v.length > 64) return false;
        } else if (typeof v !== 'number' || !Number.isFinite(v)) return false;
      }
      i += n;
    }
    return true;
  }
}
