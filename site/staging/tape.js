// Prototype: a tape measure instead of a slider. A fixed needle, an endless-feeling tape underneath.
// Log tapes cover every scale a question could need (1 mm to a trillion km), so the ends say nothing about the
// answer; each player starts somewhere random. Linear tapes (years, ages, temperatures) have real-world ends.
import { points, offBy, withUnit, CATS, catLabel, PER_QUESTION } from "/js/game.js";
import { sfx, buzz } from "/js/fx.js";

// ---------- number formatting ----------
const s3 = (v) => v.toLocaleString("en-GB", { maximumSignificantDigits: 3 });
const big = (v, unit) => (v >= 1e12 ? `${s3(v / 1e12)} trillion${unit}` : v >= 1e9 ? `${s3(v / 1e9)} billion${unit}`
  : v >= 1e6 ? `${s3(v / 1e6)} million${unit}` : `${s3(v)}${unit}`);
const sig3 = (v) => Number(v.toPrecision(3));

// ---------- tapes ----------
// Log tapes: px per power of ten. ~1% per pixel; one relaxed swipe moves about one power of ten.
const DEC = 280;
const S = 1, MIN = 60, H = 3600, D = 86400, WK = 7 * D, MO = 30.44 * D, YR = 365.25 * D;

/** Ticks for a decimal log tape: 1 (major), 2 and 5 (labelled), the rest unlabelled. */
function decimalTicks(lo, hi) {
  const out = [];
  for (let k = Math.floor(Math.log10(lo)); k <= Math.ceil(Math.log10(hi)); k++) {
    for (const m of [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9]) {
      const v = Number((m * 10 ** k).toPrecision(6));
      if (v >= lo && v <= hi) out.push({ v, level: m === 1 ? 0 : m === 2 || m === 5 ? 1 : Number.isInteger(m) ? 2 : 3 });
    }
  }
  return out;
}

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
function timeTicks(lo, hi) {
  const t = (v, level, text) => ({ v, level, text });
  const out = [];
  for (const [u, name] of [[S, "s"], [MIN, "min"]]) {
    out.push(t(u, 0, `1 ${name}`), t(2 * u, 2), t(5 * u, 1, `5 ${name}`), t(10 * u, 0, `10 ${name}`), t(15 * u, 2), t(20 * u, 1, `20 ${name}`), t(30 * u, 1, `30 ${name}`), t(45 * u, 2));
    for (const m of [3, 4, 6, 7, 8, 9, 40, 50]) out.push(t(m * u, 3));
  }
  out.push(t(H, 0, "1 hour"), t(2 * H, 1, "2 hours"), t(3 * H, 2), t(4 * H, 2), t(6 * H, 1, "6 hours"), t(8 * H, 2), t(12 * H, 1, "12 hours"), t(18 * H, 2));
  out.push(t(D, 0, "1 day"), t(2 * D, 1, "2 days"), t(3 * D, 2), t(4 * D, 2), t(5 * D, 2), t(WK, 0, "1 week"), t(2 * WK, 1, "2 weeks"), t(3 * WK, 2));
  out.push(t(MO, 0, "1 month"), t(2 * MO, 1, "2 months"), t(3 * MO, 1, "3 months"), t(4 * MO, 2), t(6 * MO, 1, "6 months"), t(9 * MO, 2));
  for (const tk of decimalTicks(1, 1e10)) out.push({ v: tk.v * YR, level: tk.level, text: tk.level <= 1 ? big(tk.v, tk.v === 1 ? " year" : " years") : undefined });
  for (const tk of decimalTicks(0.01, 0.9)) out.push({ ...tk, text: tk.level <= 1 ? `${s3(tk.v)} s` : undefined });
  return out.filter((x) => x.v >= lo && x.v <= hi);
}

function fmtTime(v) {
  if (v < MIN) return `${s3(v)} s`;
  if (v < 10 * MIN) { const m = Math.floor(v / MIN), s = Math.round(v - m * MIN); return s ? `${m} min ${s} s` : `${m} min`; }
  if (v < H) return `${Math.round(v / MIN)} min`;
  if (v < 2 * D) { const h = Math.floor(v / H), m = Math.round((v - h * H) / MIN); return m ? `${h} h ${m} min` : plural(h, "hour"); }
  if (v < 60 * D) return `${s3(v / D)} days`;
  if (v < 2 * YR) return `${s3(v / MO)} months`;
  return big(v / YR, " years");
}

function linearTicks(lo, hi, steps) { // steps: [[every, level], ...] finest last
  const out = [];
  const fine = steps[steps.length - 1][0];
  for (let v = Math.ceil(lo / fine) * fine; v <= hi; v += fine) {
    const level = steps.find(([every]) => Math.abs(v % every) < 1e-9)?.[1] ?? 3;
    out.push({ v, level });
  }
  return out;
}

const TAPES = {
  length: { kind: "log", lo: 1e-3, hi: 1e15, start: [0.01, 1e7], hint: ["shorter", "longer"],
    fmt: (v) => (v < 0.01 ? `${s3(v * 1000)} mm` : v < 1 ? `${s3(v * 100)} cm` : v < 1000 ? `${s3(v)} m` : big(v / 1000, " km")) },
  mass: { kind: "log", lo: 1e-3, hi: 1e15, start: [0.1, 1e7], hint: ["lighter", "heavier"],
    fmt: (v) => (v < 1 ? `${s3(v * 1000)} g` : v < 1000 ? `${s3(v)} kg` : big(v / 1000, " t")) },
  count: { kind: "log", lo: 1, hi: 1e12, start: [5, 1e6], hint: ["fewer", "more"], whole: true,
    fmt: (v) => big(v < 1000 ? Math.round(v) : v, "") },
  speed: { kind: "log", lo: 0.1, hi: 1e9, start: [1, 1e5], hint: ["slower", "faster"], fmt: (v) => big(v, " km/h") },
  time: { kind: "log", lo: 0.01, hi: 1e10 * YR, start: [10, 100 * YR], hint: ["shorter", "longer"], fmt: fmtTime, ticks: timeTicks },
  year: { kind: "lin", lo: -3000, hi: 2026, px: 3, start: [-500, 2000], hint: ["earlier", "later"], whole: true,
    steps: [[100, 0], [50, 1], [10, 2], [5, 3]], fmt: (v) => (v < 0 ? `${-v} BC` : `${v}`), label: (v) => (v < 0 ? `${-v} BC` : `${v}`) },
  age: { kind: "lin", lo: 0, hi: 100, px: 34, start: [8, 92], hint: ["younger", "older"], whole: true,
    steps: [[10, 0], [5, 1], [1, 2]], fmt: (v) => plural(v, "year") + " old", label: (v) => `${v}` },
  temp: { kind: "lin", lo: -273, hi: 2000, px: 4, start: [-150, 400], hint: ["colder", "hotter"], whole: true,
    steps: [[100, 0], [50, 1], [10, 2], [5, 3]], fmt: (v) => `${v}°C`, label: (v) => `${v}°` },
};

/** Which tape a question uses, and how to get from its unit to the tape's base unit. */
function tapeFor(q) {
  if (q.scale === "year") return [TAPES.year, 1];
  if (q.unit === "years") return [TAPES.age, 1];
  if (q.unit === "°C") return [TAPES.temp, 1];
  const len = { km: 1000, m: 1, cm: 0.01 }, mass = { t: 1000, kg: 1 }, time = { s: 1, min: MIN };
  if (q.unit in len) return [TAPES.length, len[q.unit]];
  if (q.unit in mass) return [TAPES.mass, mass[q.unit]];
  if (q.unit in time) return [TAPES.time, time[q.unit]];
  if (q.unit === "km/h") return [TAPES.speed, 1];
  return [TAPES.count, 1];
}

/** Geometry and ticks for one tape, computed once. */
function build(tape) {
  const log = tape.kind === "log";
  const xOf = log ? (v) => (Math.log10(v) - Math.log10(tape.lo)) * DEC : (v) => (v - tape.lo) * tape.px;
  const vAt = log ? (x) => tape.lo * 10 ** (x / DEC) : (x) => tape.lo + x / tape.px;
  const raw = log ? (tape.ticks ?? decimalTicks)(tape.lo, tape.hi) : linearTicks(tape.lo, tape.hi, tape.steps);
  const ticks = raw.map((t) => ({ ...t, x: xOf(t.v), text: t.level <= 1 ? (t.text ?? (tape.label ?? tape.fmt)(t.v)) : null }))
    .sort((a, b) => a.x - b.x);
  const round = (v) => (tape.whole ? Math.round(log ? sig3(v) : v) : sig3(v));
  return { ...tape, xOf, vAt, ticks, total: xOf(tape.hi), round };
}

// ---------- the control ----------
const el = (id) => document.getElementById(id);
const tapeEl = el("tape"), canvas = tapeEl.querySelector("canvas"), scroller = tapeEl.querySelector(".scroller"), spacer = tapeEl.querySelector(".spacer");
const ctx = canvas.getContext("2d");
let T = null, q = null, factor = 1, guessX = null, revealed = false, anim = null, lastTickI = null, quiet = false;

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const center = () => scroller.scrollLeft;
const value = () => T.round(T.vAt(Math.max(0, Math.min(T.total, center()))));

function size() {
  const x = center(), dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr;
  spacer.style.width = `${T.total + scroller.clientWidth}px`;
  scroller.scrollLeft = x;
  draw();
}

function draw() {
  const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, Hc = canvas.clientHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, Hc);
  const x0 = center(), left = x0 - W / 2, top = 10, band = 64;
  const sx = (x) => x - left;
  const ink = css("--art-ink"), cat = css(`--c-${q.cat}`), good = css("--good");

  // The tape itself, only where it exists.
  const a = Math.max(0, left), b = Math.min(T.total, left + W);
  ctx.fillStyle = css("--ticket");
  ctx.beginPath(); ctx.roundRect(sx(a), top, b - a, band, 6); ctx.fill();

  // The stretch between your guess and where the tape is now, once you've locked in.
  if (guessX != null) {
    ctx.fillStyle = cat; ctx.globalAlpha = 0.28;
    ctx.fillRect(sx(Math.min(guessX, x0)), top, Math.abs(x0 - guessX), band);
    ctx.globalAlpha = 1;
  }

  // Ticks hang from the top edge like a tape measure.
  const len = [30, 22, 14, 8];
  ctx.strokeStyle = ink; ctx.lineCap = "round";
  const visible = T.ticks.filter((t) => t.x >= left - 80 && t.x <= left + W + 80);
  for (const t of visible) {
    ctx.lineWidth = t.level === 0 ? 2.2 : t.level === 1 ? 1.6 : 1;
    ctx.beginPath(); ctx.moveTo(sx(t.x), top); ctx.lineTo(sx(t.x), top + len[t.level]); ctx.stroke();
  }
  // Labels: majors first, then the rest where there's room.
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = ink;
  const placed = [];
  for (const level of [0, 1]) {
    ctx.font = `${level === 0 ? 800 : 700} ${level === 0 ? 14 : 12}px Nunito, system-ui, sans-serif`;
    for (const t of visible.filter((v) => v.level === level)) {
      const w = ctx.measureText(t.text).width;
      if (placed.some((p) => Math.abs(p.x - t.x) < (p.w + w) / 2 + 14)) continue;
      placed.push({ x: t.x, w });
      ctx.fillText(t.text, sx(t.x), top + 52);
    }
  }

  // Your pin and the answer flag.
  if (guessX != null) {
    ctx.fillStyle = ink; ctx.fillRect(sx(guessX) - 1.5, top - 6, 3, band + 12);
    ctx.font = "800 12px Nunito, system-ui, sans-serif"; ctx.fillText("you", sx(guessX), top + band + 18);
  }
  if (revealed) {
    const ax = T.xOf(q.answer * factor);
    ctx.fillStyle = good; ctx.fillRect(sx(ax) - 2, top - 8, 4, band + 16);
    ctx.beginPath(); ctx.moveTo(sx(ax) + 2, top - 8); ctx.lineTo(sx(ax) + 16, top - 2); ctx.lineTo(sx(ax) + 2, top + 4); ctx.fill();
  }

  // A soft click and a tiny buzz each time a labelled tick passes the needle.
  const i = T.ticks.findLastIndex((t) => t.level <= 1 && t.x <= x0);
  if (lastTickI !== null && i !== lastTickI && !quiet) { sfx.tick(); buzz(4); }
  lastTickI = i;

  if (!revealed) el("readout").textContent = T.fmt(value());
}

let raf = 0;
const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
scroller.addEventListener("scroll", schedule, { passive: true });
window.addEventListener("resize", () => T && size());
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", schedule);

// Mouse: drag with a little glide, and the vertical wheel scrolls the tape. Touch uses native momentum.
let drag = null;
scroller.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "mouse" || tapeEl.classList.contains("locked")) return;
  cancelAnimationFrame(glideRaf);
  drag = { x: e.clientX, t: performance.now(), v: 0 };
  scroller.setPointerCapture(e.pointerId);
});
scroller.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const now = performance.now(), dx = e.clientX - drag.x, dt = Math.max(1, now - drag.t);
  scroller.scrollLeft -= dx;
  drag.v = 0.8 * (-dx / dt) + 0.2 * drag.v; drag.x = e.clientX; drag.t = now;
});
let glideRaf = 0;
scroller.addEventListener("pointerup", () => {
  if (!drag) return;
  let v = drag.v, t = performance.now(); drag = null;
  const step = (now) => {
    const dt = now - t; t = now; scroller.scrollLeft += v * dt; v *= 0.94 ** (dt / 16);
    if (Math.abs(v) > 0.02) glideRaf = requestAnimationFrame(step);
  };
  glideRaf = requestAnimationFrame(step);
});
scroller.addEventListener("wheel", (e) => {
  if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || tapeEl.classList.contains("locked")) return;
  e.preventDefault(); scroller.scrollLeft += e.deltaY;
}, { passive: false });

/** Move until the number on show changes: every tap of +/- is exactly one notch. */
function nudge(dir) {
  if (tapeEl.classList.contains("locked")) return;
  const before = T.fmt(value());
  for (let i = 0; i < 400 && T.fmt(value()) === before; i++) {
    const x = center() + dir * 0.5;
    if (x < 0 || x > T.total) break;
    scroller.scrollLeft = x;
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

// ---------- lock in and reveal ----------
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
function travel(from, to, ms, done) {
  const t0 = performance.now(); quiet = true;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    scroller.scrollLeft = from + (to - from) * ease(k);
    if (k < 1) anim = requestAnimationFrame(step); else { quiet = false; done(); }
  };
  anim = requestAnimationFrame(step);
}

el("lock").addEventListener("click", () => {
  if (tapeEl.classList.contains("locked")) return;
  const g = value(), guess = g / factor, p = points(q, guess);
  guessX = T.xOf(g);
  scroller.scrollLeft = guessX;
  tapeEl.classList.add("locked", "revealed"); el("lock").hidden = true;
  sfx.thunk();
  const ax = T.xOf(q.answer * factor), dist = Math.abs(ax - guessX);
  const ms = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : Math.min(2200, 500 + dist * 0.9);
  if (ms) sfx.slide(ms);
  revealed = true;
  el("readout").innerHTML = `${withUnit(q, q.answer)}<small>you said ${T.fmt(g)}</small>`;
  travel(guessX, ax, ms, () => {
    tapeEl.classList.remove("locked");
    el("pts").textContent = `+${p} / ${PER_QUESTION} points`;
    el("off").textContent = offBy(q, guess);
    el("result").hidden = false;
    (p >= 16 ? sfx.chime : p >= 8 ? sfx.plink : sfx.wobble)();
  });
});

// ---------- questions ----------
const IDS = ["d02-far", "d03-big", "d11-many", "d06-wild", "d16-when", "d07-wild", "d13-wild", "d04-wild", "d07-big", "d21-wild", "d10-big", "d15-wild"];
let bank = [], qi = 0;

function start(i) {
  cancelAnimationFrame(anim); quiet = false;
  qi = (i + bank.length) % bank.length; q = bank[qi];
  const [tape, f] = tapeFor(q); T = build(tape); factor = f;
  guessX = null; revealed = false; lastTickI = null;
  tapeEl.classList.remove("locked", "revealed"); el("lock").hidden = false; el("result").hidden = true;
  document.getElementById("app").style.setProperty("--cat", CATS[q.cat].color);
  el("cat").textContent = catLabel(q); el("q").textContent = q.q;
  el("hint").innerHTML = `<span>← ${T.hint[0]}</span><span>${T.hint[1]} →</span>`;
  el("which").textContent = `Question ${qi + 1} of ${bank.length} · ${q.id} · ${tape === TAPES.year || tape.kind === "lin" ? "linear" : "log"} tape`;
  size();
  // Start somewhere random in a broad, everyday band: nothing to do with the answer.
  const [lo, hi] = T.start.map(T.xOf);
  quiet = true; scroller.scrollLeft = lo + Math.random() * (hi - lo); draw(); quiet = false;
}

el("again").addEventListener("click", () => start(qi));
el("next").addEventListener("click", () => start(qi + 1));

const { questions } = await (await fetch("/data/questions.json", { cache: "no-cache" })).json();
const byId = Object.fromEntries(questions.map((x) => [x.id, x]));
bank = IDS.map((id) => byId[id]).filter(Boolean);
start(0);
