// Prototype: a tape measure instead of a slider. A fixed needle, a very long tape underneath.
// Tape ends are either limits everyone already knows (today, age 0, a count of 1) or so far out that no answer
// comes near them. Every guess starts at zero (or somewhere random, to compare). Values are kept in SI units
// (m, kg, s, km/h, °C, years); imperial only changes the labels.
import { points, offBy, CATS, catLabel, PER_QUESTION, setSystem } from "/js/game.js";
import { sfx, buzz } from "/js/fx.js";
import { loadActivity } from "/js/herd-store.js";

const el = (id) => document.getElementById(id);
const store = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* fine */ } },
};
let touched = false; // vibration needs a tap first
addEventListener("pointerdown", () => { touched = true; }, { once: true });
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- numbers ----------
const sig = (v, n = 3) => Number(v.toPrecision(n));
const WORDS = [[1e12, " trillion"], [1e9, " billion"], [1e6, " million"]];
function num(n, exact = false) {
  for (const [w, name] of WORDS) if (Math.abs(n) >= w) return `${num(n / w, exact)}${name}`;
  return n.toLocaleString("en-GB", { maximumSignificantDigits: exact ? 6 : 3 }).replace("-", "−");
}
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// ---------- ticks ----------
/** Display numbers in [lo, hi) as tape ticks: 1 (big), 2 and 5 (labelled), the rest small. */
function decimals(lo, hi) {
  const out = [];
  for (let k = Math.floor(Math.log10(lo)); k <= Math.ceil(Math.log10(hi)); k++) {
    for (const m of [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9]) {
      const n = Number((m * 10 ** k).toPrecision(6));
      if (n >= lo * (1 - 1e-9) && n < hi * (1 - 1e-9)) out.push({ n, level: m === 1 ? 0 : m === 2 || m === 5 ? 1 : Number.isInteger(m) ? 2 : 3 });
    }
  }
  return out;
}
/** Unit ladders: [up to this SI value, unit, SI per unit]. Ticks restart at 1 in each unit. */
const LADDERS = {
  length: { metric: [[0.01, "mm", 1e-3], [1, "cm", 0.01], [1000, "m", 1], [Infinity, "km", 1000]],
    imperial: [[0.3048, "in", 0.0254], [1609.344, "ft", 0.3048], [Infinity, "miles", 1609.344]] },
  mass: { metric: [[1, "g", 1e-3], [1000, "kg", 1], [Infinity, "t", 1000]],
    imperial: [[0.45359237, "oz", 0.028349523125], [907.18474, "lb", 0.45359237], [Infinity, "tons", 907.18474]] },
  speed: { metric: [[Infinity, "km/h", 1]], imperial: [[Infinity, "mph", 1.609344]] },
  count: { metric: [[Infinity, "", 1]] },
  ago: { metric: [[Infinity, "years ago", 1]] },
};
function ladder(name, { whole = false } = {}) {
  const rungs = (sys) => LADDERS[name][sys] ?? LADDERS[name].metric;
  const rung = (v, sys) => rungs(sys).find(([b]) => v < b) ?? rungs(sys).at(-1);
  return {
    kind: "log",
    ticks(lo, hi, sys) {
      const out = []; let from = lo;
      for (const [bound, , f] of rungs(sys)) {
        const to = Math.min(bound, hi * 1.0000001);
        if (to > from) for (const t of decimals(from / f, to / f)) out.push({ v: t.n * f, level: t.n === 1 ? -1 : t.level });
        from = Math.max(from, bound);
        if (from >= hi) break;
      }
      return out;
    },
    fmt(v, sys, exact) { const [, u, f] = rung(v, sys); return `${num(v / f, exact)}${u ? ` ${u}` : ""}`; },
    round(v, sys) { const [, , f] = rung(v, sys), n = v / f; return (whole && n < 1000 ? Math.max(1, Math.round(n)) : sig(n)) * f; },
  };
}

// Time: seconds up to billions of years, labelled in the units people think in.
const S = 1, MIN = 60, H = 3600, D = 86400, WK = 7 * D, MO = 30.44 * D, YR = 365.25 * D;
function timeTicks(lo, hi) {
  const t = (v, level, text) => ({ v, level, text });
  const out = [];
  for (const k of decimals(0.01, 1)) out.push(t(k.n, k.level, k.level <= 1 ? `${k.n} s` : null));
  for (const [u, name] of [[S, "s"], [MIN, "min"]]) {
    out.push(t(u, -1, `1 ${name}`), t(2 * u, 2), t(5 * u, 1, `5 ${name}`), t(10 * u, 0, `10 ${name}`), t(15 * u, 2), t(20 * u, 1, `20 ${name}`), t(30 * u, 1, `30 ${name}`), t(45 * u, 2));
    for (const m of [3, 4, 6, 7, 8, 9, 40, 50]) out.push(t(m * u, 3));
  }
  out.push(t(H, -1, "1 hour"), t(2 * H, 1, "2 hours"), t(3 * H, 2), t(4 * H, 2), t(6 * H, 1, "6 hours"), t(8 * H, 2), t(12 * H, 1, "12 hours"), t(18 * H, 2));
  out.push(t(D, -1, "1 day"), t(2 * D, 1, "2 days"), t(3 * D, 2), t(4 * D, 2), t(5 * D, 2), t(WK, 0, "1 week"), t(2 * WK, 1, "2 weeks"), t(3 * WK, 2));
  out.push(t(MO, -1, "1 month"), t(2 * MO, 1, "2 months"), t(3 * MO, 1, "3 months"), t(4 * MO, 2), t(6 * MO, 1, "6 months"), t(9 * MO, 2));
  for (const k of decimals(1, 1.0000001e10)) out.push(t(k.n * YR, k.n === 1 ? -1 : k.level, k.level <= 1 ? `${num(k.n)} year${k.n === 1 ? "" : "s"}` : null));
  return out.filter((x) => x.v >= lo && x.v <= hi);
}
function roundTime(v) {
  if (v < 1) return Math.max(0.01, Math.round(v * 100) / 100);
  if (v < MIN) return sig(v);
  if (v < 10 * MIN) return Math.round(v);
  if (v < 2 * D) return Math.round(v / MIN) * MIN;
  if (v < 60 * D) return sig(v / D) * D;
  if (v < 2 * YR) return sig(v / MO) * MO;
  return sig(v / YR) * YR;
}
function fmtTime(v, exact) {
  if (v < MIN) return `${num(v, exact)} s`;
  if (v < 10 * MIN) { const m = Math.floor(v / MIN), s = Math.round(v - m * MIN); return s ? `${m} min ${s} s` : `${m} min`; }
  if (v < H) return `${Math.round(v / MIN)} min`;
  if (v < 2 * D) { let h = Math.floor(v / H), m = Math.round((v - h * H) / MIN); if (m === 60) { h++; m = 0; } return m ? `${h} h ${m} min` : plural(h, "hour"); }
  if (v < 60 * D) return `${num(v / D, exact)} days`;
  if (v < 2 * YR) return `${num(v / MO, exact)} months`;
  return `${num(v / YR, exact)} years`;
}

/** Evenly spaced ticks; steps from coarsest to finest: [[every, level], ...]. */
function linTicks(lo, hi, steps) {
  const fine = steps.at(-1)[0], out = [];
  for (let v = Math.ceil(lo / fine) * fine; v <= hi; v += fine) out.push({ v, level: steps.find(([e]) => v % e === 0)[1] });
  return out;
}

// Temperature: a two-way log tape, even near 0 and squeezed further out both ways, so no end is ever in reach.
const fahr = (sys) => sys === "imperial";
const tDisp = (v, sys) => (fahr(sys) ? (v * 9) / 5 + 32 : v);
const tBack = (n, sys) => (fahr(sys) ? ((n - 32) * 5) / 9 : n);

const yearLabel = (v) => (v < 0 ? `${-v} BC` : v === 0 ? "AD 1" : v < 1000 ? `AD ${v}` : `${v}`);

const TAPES = {
  length: { ...ladder("length"), lo: 1e-3, hi: 1e15, band: [0.01, 1e7], hint: ["shorter", "longer"] },
  mass: { ...ladder("mass"), lo: 1e-3, hi: 1e15, band: [0.1, 1e7], hint: ["lighter", "heavier"] },
  count: { ...ladder("count", { whole: true }), lo: 1, hi: 1e12, band: [5, 1e6], hint: ["fewer", "more"] },
  speed: { ...ladder("speed"), lo: 0.1, hi: 1e12, band: [1, 1e5], hint: ["slower", "faster"] },
  ago: { ...ladder("ago"), lo: 1, hi: 1e10, band: [10, 1e7], hint: ["more recent", "longer ago"], label: (v) => `${num(v)} yrs ago` },
  time: { kind: "log", lo: 0.01, hi: 1e10 * YR, band: [10, 100 * YR], hint: ["shorter", "longer"], ticks: timeTicks, fmt: (v, sys, exact) => fmtTime(v, exact), round: roundTime },
  temp: { kind: "symlog", C: 10, lo: -1e5, hi: 1e5, zero: "origin", band: [-100, 300], hint: ["colder", "hotter"],
    ticks(lo, hi, sys) {
      const out = [{ v: tBack(0, sys), level: -1 }];
      for (let n = 1; n < 10; n++) for (const s of [1, -1]) out.push({ v: tBack(s * n, sys), level: n === 5 ? 2 : 3 });
      for (const t of decimals(10, 1.0000001e5)) for (const s of [1, -1]) out.push({ v: tBack(s * t.n, sys), level: t.level });
      return out.filter((t) => t.v >= lo && t.v <= hi);
    },
    label: (v, sys) => `${num(tDisp(v, sys))}°`,
    fmt: (v, sys, exact) => `${num(tDisp(v, sys), exact)}°${fahr(sys) ? "F" : "C"}`,
    round(v, sys) { const n = tDisp(v, sys); return tBack(Math.abs(n) < 1000 ? Math.round(n) : sig(n), sys); } },
  year: { kind: "lin", lo: -10000, hi: 2026, px: 2, zero: "hi", band: [-500, 2000], hint: ["earlier", "later"],
    ticks: (lo, hi) => linTicks(lo, hi, [[1000, -1], [100, 0], [50, 1], [10, 2], [5, 3]]),
    label: yearLabel, fmt: yearLabel, round: Math.round },
  age: { kind: "lin", lo: 0, hi: 100, px: 34, band: [8, 92], hint: ["younger", "older"],
    ticks: (lo, hi) => linTicks(lo, hi, [[10, 0], [5, 1], [1, 2]]),
    label: (v) => `${v}`, fmt: (v) => `${plural(v, "year")} old`, round: Math.round },
};

/** A question's tape, and how to get from its unit to the tape's SI unit. */
function tapeFor(q) {
  if (q.scale === "year") return ["year", 1];
  if (q.unit === "years") return ["age", 1];
  if (q.unit === "years ago") return ["ago", 1];
  if (q.unit === "°C") return ["temp", 1];
  const f = { km: ["length", 1000], m: ["length", 1], cm: ["length", 0.01], t: ["mass", 1000], kg: ["mass", 1],
    s: ["time", 1], min: ["time", MIN], "km/h": ["speed", 1] }[q.unit];
  return f ?? ["count", 1];
}

// ---------- geometry ----------
// u: position along the tape in px at zoom 1. Log tapes give every power of ten the same room.
const DEC = 280;
function build(tape, sys) {
  let uOf, vAt;
  if (tape.kind === "log") { const a = Math.log10(tape.lo); uOf = (v) => (Math.log10(v) - a) * DEC; vAt = (u) => 10 ** (u / DEC + a); }
  else if (tape.kind === "symlog") {
    const s = (v) => Math.sign(v) * Math.log10(1 + Math.abs(v) / tape.C), inv = (x) => Math.sign(x) * tape.C * (10 ** Math.abs(x) - 1), a = s(tape.lo);
    uOf = (v) => (s(v) - a) * DEC; vAt = (u) => inv(u / DEC + a);
  } else { uOf = (v) => (v - tape.lo) * tape.px; vAt = (u) => tape.lo + u / tape.px; }
  const ticks = tape.ticks(tape.lo, tape.hi, sys)
    .map((t) => ({ ...t, u: uOf(t.v), text: t.level <= 1 ? (t.text ?? (tape.label ?? tape.fmt)(t.v, sys)) : null }))
    .sort((a, b) => a.u - b.u);
  const total = uOf(tape.hi);
  const zeroU = tape.zero === "hi" ? total : tape.zero === "origin" ? uOf(0) : 0;
  return { ...tape, sys, uOf, vAt, ticks, total, zeroU, rnd: (v) => tape.round(v, sys), show: (v, exact) => tape.fmt(v, sys, exact) };
}

// ---------- the control ----------
const tapeEl = el("tape"), canvas = tapeEl.querySelector("canvas"), scroller = tapeEl.querySelector(".scroller"), spacer = tapeEl.querySelector(".spacer");
const ctx = canvas.getContext("2d");
let T = null, tapeName = null, q = null, factor = 1, Z = 1, guessU = null, revealed = false;
let herd = [], herdAt = 0, lastTickI = null, quiet = false, anim = 0;
let sys = store.get("ox-units", "metric") === "imperial" ? "imperial" : "metric";
let startMode = store.get("ox-tape-start", "zero");
setSystem(sys);

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const uc = () => scroller.scrollLeft / Z;
const value = () => T.rnd(T.vAt(Math.max(0, Math.min(T.total, uc()))));
const setU = (u) => { scroller.scrollLeft = u * Z; draw(); };

function size() {
  const u = uc(), dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr;
  spacer.style.width = `${T.total * Z + scroller.clientWidth}px`;
  setU(u);
}
function setZoom(z, u) { Z = z; spacer.style.width = `${T.total * Z + scroller.clientWidth}px`; setU(u); }

/** A little ox head, like the herd in the main game. */
function ox(x, y, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y);
  ctx.strokeStyle = css("--art-ink"); ctx.lineWidth = 1.6; ctx.lineCap = "round";
  ctx.fillStyle = css("--horn");
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 5, -4); ctx.quadraticCurveTo(s * 12, -6, s * 10, -12); ctx.lineTo(s * 8, -6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = css("--ox"); ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = css("--muzzle"); ctx.beginPath(); ctx.ellipse(0, 3.2, 4.2, 2.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = css("--art-ink"); ctx.beginPath(); ctx.arc(-2.6, -1.6, 1.1, 0, 7); ctx.arc(2.6, -1.6, 1.1, 0, 7); ctx.fill();
  ctx.restore();
}
/** The tape's case, at the zero end: the tape comes out of it. */
function tapeCase(x, top, side) {
  const w = 56, h = 72, x0 = side < 0 ? x - w - 24 : x + 24, y0 = top - 4;
  ctx.fillStyle = css("--c-when"); ctx.strokeStyle = css("--art-ink"); ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 14); ctx.fill(); ctx.stroke();
  ctx.fillStyle = css("--c-big"); ctx.beginPath(); ctx.arc(x0 + w / 2, y0 + h / 2, 16, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = css("--art-ink"); ctx.beginPath(); ctx.arc(x0 + w / 2, y0 + h / 2, 4, 0, 7); ctx.fill();
}

function draw() {
  if (!T) return;
  const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, Hc = canvas.clientHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, Hc);
  const c = uc(), sx = (u) => (u - c) * Z + W / 2;
  const top = revealed ? 104 : 12, band = 62, ink = css("--art-ink");
  const cat = css(`--c-${q?.cat ?? "when"}`);

  // The tape, running a little past its last tick so end labels sit on it.
  const caseSide = T.zeroU === 0 ? -1 : T.zeroU === T.total ? 1 : 0;
  const a = caseSide < 0 ? sx(0) - 26 : sx(0) - 44, b = caseSide > 0 ? sx(T.total) + 26 : sx(T.total) + 44;
  ctx.fillStyle = css("--ticket");
  ctx.beginPath(); ctx.roundRect(Math.max(-20, a), top, Math.min(W + 20, b) - Math.max(-20, a), band, 6); ctx.fill();
  if (caseSide) tapeCase(caseSide < 0 ? sx(0) : sx(T.total), top, caseSide);

  // From your guess to wherever the tape is now, once you've locked in.
  if (guessU != null) {
    ctx.fillStyle = cat; ctx.globalAlpha = 0.25;
    ctx.fillRect(Math.min(sx(guessU), W / 2), top, Math.abs(W / 2 - sx(guessU)), band);
    ctx.globalAlpha = 1;
  }

  // Ticks hang from the top edge. Zoomed out, the small ones go.
  const len = { "-1": 34, 0: 28, 1: 21, 2: 13, 3: 8 }, maxLevel = Z < 0.3 ? 1 : Z < 0.6 ? 2 : 3;
  const visible = T.ticks.filter((t) => t.level <= maxLevel && sx(t.u) > -60 && sx(t.u) < W + 60);
  ctx.strokeStyle = ink; ctx.lineCap = "round";
  for (const t of visible) {
    ctx.lineWidth = t.level <= 0 ? 2.2 : t.level === 1 ? 1.6 : 1;
    ctx.beginPath(); ctx.moveTo(sx(t.u), top); ctx.lineTo(sx(t.u), top + len[t.level]); ctx.stroke();
  }
  ctx.textAlign = "center"; ctx.fillStyle = ink;
  const placed = [];
  for (const level of [-1, 0, 1]) {
    ctx.font = `${level <= 0 ? 800 : 700} ${level <= 0 ? 14 : 12}px Nunito, system-ui, sans-serif`;
    for (const t of visible.filter((v) => v.level === level)) {
      const w = ctx.measureText(t.text).width;
      if (placed.some((p) => Math.abs(p.x - t.u) * Z < (p.w + w) / 2 + 12)) continue;
      placed.push({ x: t.u, w });
      ctx.fillText(t.text, sx(t.u), top + 52);
    }
  }

  // After the reveal: the herd lands on the tape, then you, the herd's guess and the answer.
  ctx.font = "800 12px Nunito, system-ui, sans-serif";
  if (revealed && herdAt) {
    const cols = {}, t = performance.now() - herdAt;
    let busy = false;
    herd.forEach((h, i) => {
      const x = sx(T.uOf(h)), col = Math.round(x / 19), k = (cols[col] = (cols[col] ?? -1) + 1);
      const p = Math.max(0, Math.min(1, (t - i * 45) / 260)); if (p < 1) busy = true;
      if (p > 0) ox(col * 19, top - 12 - k * 16 - (1 - p) * 26, p);
    });
    if (busy) requestAnimationFrame(draw);
    const mu = T.uOf(median(herd));
    ctx.strokeStyle = css("--ox-dark"); ctx.lineWidth = 2.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(sx(mu), top); ctx.lineTo(sx(mu), top + band + 4); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = css("--ox-dark"); ctx.fillText("herd", sx(mu), top + band + 34);
  }
  if (guessU != null) {
    ctx.fillStyle = ink; ctx.fillRect(sx(guessU) - 1.5, top - 4, 3, band + 8);
    ctx.fillText("you", sx(guessU), top + band + 18);
  }
  if (revealed) {
    const ax = sx(T.uOf(q.answer * factor)), good = css("--good");
    ctx.fillStyle = good; ctx.fillRect(ax - 2, 6, 4, top + band - 6);
    ctx.beginPath(); ctx.moveTo(ax + 2, 6); ctx.lineTo(ax + 15, 11); ctx.lineTo(ax + 2, 16); ctx.fill();
  }

  // A soft click (and a tiny buzz on Android) each time a labelled tick passes the needle.
  const i = T.ticks.findLastIndex((t) => t.level <= 1 && t.u <= c);
  if (lastTickI !== null && i !== lastTickI && !quiet) { sfx.tick(); if (!intro && touched) buzz(4); }
  lastTickI = i;

  if (!revealed) {
    const text = T.show(value());
    el("readout").textContent = text;
    tapeEl.setAttribute("aria-valuetext", text);
  }
}
const median = (xs) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

let raf = 0;
const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
scroller.addEventListener("scroll", schedule, { passive: true });
window.addEventListener("resize", () => T && size());
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", schedule);

// Mouse: drag with a little glide, and the vertical wheel scrolls the tape. Touch uses native momentum.
let drag = null, glide = 0;
const locked = () => tapeEl.classList.contains("locked");
scroller.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "mouse" || locked()) return;
  cancelAnimationFrame(glide);
  drag = { x: e.clientX, t: performance.now(), v: 0 };
  scroller.setPointerCapture(e.pointerId);
});
scroller.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const now = performance.now(), dx = e.clientX - drag.x, dt = Math.max(1, now - drag.t);
  scroller.scrollLeft -= dx;
  drag.v = 0.8 * (-dx / dt) + 0.2 * drag.v; drag.x = e.clientX; drag.t = now;
});
scroller.addEventListener("pointerup", () => {
  if (!drag) return;
  let v = drag.v, t = performance.now(); drag = null;
  const step = (now) => {
    const dt = now - t; t = now; scroller.scrollLeft += v * dt; v *= 0.94 ** (dt / 16);
    if (Math.abs(v) > 0.02) glide = requestAnimationFrame(step);
  };
  glide = requestAnimationFrame(step);
});
scroller.addEventListener("wheel", (e) => {
  if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || locked()) return;
  e.preventDefault(); scroller.scrollLeft += e.deltaY;
}, { passive: false });

/** Move until the number on show changes, so every tap of +/- is exactly one notch. */
function nudge(dir) {
  if (locked() || revealed) return;
  const before = T.show(value());
  for (let i = 0; i < 600 && T.show(value()) === before; i++) {
    const u = uc() + (dir * 0.5) / Z;
    if (u < 0 || u > T.total) break;
    scroller.scrollLeft = u * Z;
  }
  draw();
}
function holdable(btn, dir) {
  let timer = null;
  const stop = () => { clearTimeout(timer); timer = null; };
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault(); nudge(dir);
    let ms = 380;
    const rep = () => { nudge(dir); ms = Math.max(30, Math.min(150, ms) * 0.9); timer = setTimeout(rep, ms); };
    timer = setTimeout(rep, ms);
  });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) btn.addEventListener(ev, stop);
  btn.addEventListener("click", (e) => { if (e.detail === 0) nudge(dir); });
}
holdable(el("minus"), -1); holdable(el("plus"), 1);
tapeEl.addEventListener("keydown", (e) => {
  const step = { ArrowLeft: -1, ArrowRight: 1, PageDown: -40, PageUp: 40 }[e.key];
  if (!step) return;
  e.preventDefault();
  if (Math.abs(step) === 1) nudge(step); else scroller.scrollLeft += step * 7;
});

// ---------- animation helpers ----------
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const wait = (ms) => new Promise((r) => setTimeout(r, reduced() ? 0 : ms));
function animate(ms, fn) {
  cancelAnimationFrame(anim);
  return new Promise((done) => {
    const t0 = performance.now();
    const step = (now) => {
      const k = ms > 0 ? Math.min(1, (now - t0) / ms) : 1;
      fn(k);
      if (k < 1) anim = requestAnimationFrame(step); else done();
    };
    anim = requestAnimationFrame(step);
  });
}

// ---------- lock in and reveal ----------
el("lock").addEventListener("click", async () => {
  if (locked() || revealed) return;
  const g = value(), guess = g / factor, p = points(q, guess), ans = q.answer * factor, au = T.uOf(ans);
  guessU = T.uOf(g); revealed = true;
  tapeEl.classList.add("locked", "revealed"); el("lock").hidden = true; el("nudge").hidden = true;
  size(); setU(guessU);
  el("readout").textContent = T.show(ans, true);
  el("sub").textContent = `the answer · you said ${T.show(g)}`;
  sfx.thunk();
  const ms = reduced() ? 0 : Math.min(2000, 500 + Math.abs(au - guessU) * 0.8);
  if (ms) sfx.slide(ms);
  quiet = true;
  await animate(ms, (k) => setU(guessU + (au - guessU) * ease(k)));
  quiet = false;
  el("pts").textContent = `+${p} / ${PER_QUESTION} points`;
  el("off").textContent = offBy(q, guess);
  if (herd.length) {
    const closer = herd.filter((h) => Math.abs(T.uOf(h) - au) > Math.abs(guessU - au)).length;
    el("herd-line").textContent = `The herd (${herd.length} real guesses) said ${T.show(T.rnd(median(herd)))}. You were closer than ${closer} of them.`;
  } else el("herd-line").textContent = "No real guesses for this question yet.";
  el("result").hidden = false;
  (p >= 16 ? sfx.chime : p >= 8 ? sfx.plink : sfx.wobble)();

  // Zoom out until you, the herd and the answer all fit, then the herd lands.
  const us = [guessU, au, ...herd.map(T.uOf)], lo = Math.min(...us), hi = Math.max(...us);
  const z1 = Math.min(1, (0.78 * canvas.clientWidth) / Math.max(1, hi - lo)), c0 = uc(), c1 = (lo + hi) / 2, z0 = Z;
  await animate(reduced() ? 0 : 900, (k) => { const e = ease(k); setZoom(z0 * (z1 / z0) ** e, c0 + (c1 - c0) * e); });
  herdAt = performance.now(); draw();
  tapeEl.classList.remove("locked");
});

// ---------- questions ----------
// Staging only: a deep-time question to try the "years ago" tape. The Holocene began about 11,700 years ago.
const DEMO = [{ id: "demo-ago", cat: "when", kind: null, q: "How long ago did the last ice age end?", answer: 11700, unit: "years ago", scale: "log",
  source: { name: "Wikipedia: Holocene", url: "https://en.wikipedia.org/wiki/Holocene" } }];
const IDS = ["d06-wild", "d02-far", "d11-many", "d16-when", "d07-wild", "d03-big", "d05-far", "d05-many", "demo-ago",
  "d12-wild", "d13-wild", "d04-wild", "d07-big", "d21-wild", "d10-big", "d15-wild", "d17-wild"];
let bank = [], qi = 0, herds = {}, intro = false;

function loadTape(name, keepValue = false) {
  const v = keepValue && T ? T.vAt(uc()) : null;
  tapeName = name; T = build(TAPES[name], sys); Z = 1; lastTickI = null;
  el("hint").innerHTML = `<span>← ${T.hint[0]}</span><span>${T.hint[1]} →</span>`;
  size();
  if (v != null) setU(T.uOf(v));
}
function startAt() {
  if (startMode === "zero") return T.zeroU;
  const [lo, hi] = T.band.map(T.uOf);
  return lo + Math.random() * (hi - lo);
}

function start(i) {
  cancelAnimationFrame(anim); quiet = false; intro = false;
  qi = (i + bank.length) % bank.length; q = bank[qi];
  const [name, f] = tapeFor(q); factor = f;
  guessU = null; revealed = false; herdAt = 0;
  herd = (herds[q.id] ?? []).map((v) => v * factor);
  tapeEl.classList.remove("locked", "revealed");
  el("intro").hidden = true; el("qcard").hidden = false; el("lock").hidden = false; el("result").hidden = true; el("nudge").hidden = false;
  el("app").style.setProperty("--cat", CATS[q.cat].color);
  el("cat").textContent = catLabel(q); el("q").textContent = q.q; el("sub").textContent = "";
  el("which").textContent = `Question ${qi + 1} of ${bank.length} · ${q.id} · ${name} tape${herds[q.id] ? ` · ${herds[q.id].length} real guesses` : ""}`;
  loadTape(name);
  quiet = true; setU(startAt()); quiet = false;
}

// ---------- the intro: Mabel's tape measure ----------
const woman = (size = 84) => `<svg width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="Mabel">
  <g stroke="var(--art-ink)" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
    <circle cx="60" cy="18" r="13" fill="var(--hair)"/>
    <ellipse cx="27" cy="72" rx="8" ry="11" fill="var(--skin)"/><ellipse cx="93" cy="72" rx="8" ry="11" fill="var(--skin)"/>
    <path d="M29 58 C29 38 91 38 91 58 L91 74 C91 98 77 112 60 112 C43 112 29 98 29 74 Z" fill="var(--skin)"/>
    <path d="M24 64 C18 24 102 24 96 64 C88 50 74 44 60 47 C46 44 32 50 24 64 Z" fill="var(--hair)"/>
    <circle cx="46" cy="72" r="10" fill="none" stroke-width="3"/><circle cx="74" cy="72" r="10" fill="none" stroke-width="3"/>
    <path d="M56 71 h8" fill="none" stroke-width="3"/>
  </g>
  <circle cx="46" cy="72" r="3.6" fill="var(--art-ink)"/><circle cx="74" cy="72" r="3.6" fill="var(--art-ink)"/>
  <ellipse cx="36" cy="88" rx="5" ry="3" fill="var(--cheek)" opacity=".6"/><ellipse cx="84" cy="88" rx="5" ry="3" fill="var(--cheek)" opacity=".6"/>
  <path d="M51 97 q9 6 18 0" stroke="var(--art-ink)" stroke-width="3.2" fill="none" stroke-linecap="round"/>
</svg>`;
el("who").innerHTML = woman();
const say = (text) => { el("say").textContent = text; };

function showIntro() {
  cancelAnimationFrame(anim); intro = true; q = null;
  el("intro").hidden = false; el("qcard").hidden = true; el("lock").hidden = true; el("result").hidden = true; el("nudge").hidden = true;
  guessU = null; revealed = false; herdAt = 0; tapeEl.classList.remove("revealed"); tapeEl.classList.add("locked");
  el("app").style.setProperty("--cat", CATS.when.color); el("sub").textContent = ""; el("which").textContent = "";
  loadTape("length"); setU(0);
  say("Morning! Fancy a look at my tape measure? It's a long one.");
  el("intro-go").textContent = "Go on then"; el("intro-go").hidden = false;
  el("intro-go").onclick = unroll;
}

async function unroll() {
  el("intro-go").hidden = true;
  say("Here we go…");
  await wait(500);
  const lines = [[1, "A metre…"], [1000, "a kilometre…"], [1e6, "a thousand kilometres…"], [1e9, "a million…"], [1e12, "a billion…"], [1e15, "and on, and on…"]];
  await animate(reduced() ? 0 : 6000, (k) => {
    setU(T.total * k ** 2.2);
    const v = T.vAt(uc()), line = lines.findLast(([at]) => v >= at);
    if (line) say(line[1]);
  });
  say("A trillion kilometres. I'm told it goes further, but my arms are tired.");
  await wait(1800);
  sfx.whoosh(800);
  quiet = true; await animate(reduced() ? 0 : 900, (k) => setU(T.total * (1 - ease(k)))); quiet = false;
  sfx.stamp();
  say("Back to zero. Every guess starts there: scroll out as far as you think the answer goes.");
  el("intro-go").textContent = "Let's play"; el("intro-go").hidden = false;
  el("intro-go").onclick = () => start(0);
}

// ---------- prototype controls ----------
const label = () => {
  el("start-mode").textContent = `Start: ${startMode === "zero" ? "zero" : "random"}`;
  el("units").textContent = `Units: ${sys}`;
};
el("again").addEventListener("click", () => start(qi));
el("next").addEventListener("click", () => start(qi + 1));
el("replay").addEventListener("click", showIntro);
el("start-mode").addEventListener("click", () => {
  startMode = startMode === "zero" ? "random" : "zero"; store.set("ox-tape-start", startMode); label();
  if (!intro) start(qi);
});
el("units").addEventListener("click", () => {
  sys = sys === "metric" ? "imperial" : "metric"; store.set("ox-units", sys); setSystem(sys); label();
  if (T && !revealed) { loadTape(tapeName, true); } else if (!intro) start(qi);
});
label();

const { questions } = await (await fetch("/data/questions.json", { cache: "no-cache" })).json();
const byId = Object.fromEntries([...questions, ...DEMO].map((x) => [x.id, x]));
bank = IDS.map((id) => byId[id]).filter(Boolean);
showIntro();

// Real guesses from the live game, for the herd on the tape. Values are in each question's own unit.
loadActivity("2026-11-01").then(({ guesses }) => {
  for (const g of guesses) if (g.day <= "2026-12-31") (herds[g.qid] ??= []).push(g.value);
  if (q && !revealed) herd = (herds[q.id] ?? []).map((v) => v * factor);
}).catch((e) => console.warn("No herd for staging", e));
