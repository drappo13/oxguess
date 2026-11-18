// Game rules: slider ranges, scoring, number formatting and the (for now simulated) herd.

export const STEPS = 1000;
export const THIS_YEAR = 2026;
export const PER_QUESTION = 20; // whole points per question, 100 for the round

export const CATS = {
  when: { label: "When", icon: "📅", color: "var(--c-when)" },
  big:  { label: "How big", icon: "📏", color: "var(--c-big)" },
  far:  { label: "How far", icon: "🧭", color: "var(--c-far)" },
  many: { label: "How many", icon: "🔢", color: "var(--c-many)" },
  wild: { label: "Wildcard", icon: "🎲", color: "var(--c-wild)" },
};
const KIND_LABEL = { height: "How tall", weight: "How heavy", length: "How long", hot: "How hot", fast: "How fast", old: "How old", time: "How long" };
const KIND_ICON = { height: "📏", weight: "⚖️", length: "📐", hot: "🌡️", fast: "💨", old: "🎂", time: "⏱️" };
export const catLabel = (q) => (q.kind && KIND_LABEL[q.kind]) || CATS[q.cat].label;
export const catIcon = (q) => (q.kind && KIND_ICON[q.kind]) || CATS[q.cat].icon;


// --- seeded randomness so everyone gets the same range and the same herd ---
export function hash(str) {
  let h = 2166136261;
  for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- ranges ---
// The answer sits somewhere 20–80% along the slider so the middle never gives it away.
export function rangeFor(q) {
  // Hand-set ends win on any scale; linear questions always have them.
  if (q.scale === "lin" || (q.min != null && q.max != null)) return { min: q.min, max: q.max };
  const f = 0.2 + rng(hash(q.id))() * 0.6;
  if (q.scale === "year") {
    const age = THIS_YEAR - q.answer;
    const W = age < 150 ? 150 : age < 400 ? 300 : age < 1200 ? 1000 : 4000;
    let min = Math.round(q.answer - f * W), max = min + W;
    if (max > THIS_YEAR) { max = THIS_YEAR; min = max - W; }
    const step = W >= 1000 ? 50 : 10;
    return { min: Math.floor(min / step) * step, max: Math.min(THIS_YEAR, Math.ceil(max / step) * step) };
  }
  // log: two orders of magnitude, ends rounded to a friendly figure
  const span = 2;
  const min = q.answer / Math.pow(10, span * f), max = q.answer * Math.pow(10, span * (1 - f));
  // Tidy ends: 1, 2 or 5 followed by zeros (1–100, 2–500, 5,000–50,000), never below 1 for whole-number answers.
  let lo = tidyDown(min), hi = tidyUp(max);
  if (Number.isInteger(q.answer) && lo < 1) lo = 1;
  return { min: lo, max: hi };
}
const TIDY = [1, 2, 5, 10];

// --- the A/B test of slider ends ---
// From AB_START, a question with minB and maxB has a second slider. Each player gets A or B per question, from a
// hash of their player id and the question, so it never needs storing, stays the same on every visit, and every
// player sees a mix. Before AB_START, and on questions without slider B, everyone plays A. Each guess records its
// arm and slider ends (herd-store.js).
export const AB_START = "2026-11-19";
const rangeB = (q) => (q.minB != null && q.maxB != null ? { min: q.minB, max: q.maxB } : null);
export const armFor = (q, player, day) => (day >= AB_START && rangeB(q) && rng(hash(`${player}|${q.id}|ab`))() < 0.5 ? "B" : "A");
export const sliderFor = (q, arm) => (arm === "B" && rangeB(q)) || rangeFor(q);
function tidyDown(v) { const p = Math.pow(10, Math.floor(Math.log10(v))); const m = v / p; return Number(([...TIDY].reverse().find((t) => t <= m + 1e-9) * p).toPrecision(12)); }
function tidyUp(v) { const p = Math.pow(10, Math.floor(Math.log10(v))); const m = v / p; return Number((TIDY.find((t) => t >= m - 1e-9) * p).toPrecision(12)); }

// --- slider position <-> value ---
export function toValue(q, r, t) {
  const f = t / STEPS;
  if (q.scale === "log") return niceRound(r.min * Math.pow(r.max / r.min, f), Number.isInteger(q.answer));
  const v = r.min + (r.max - r.min) * f;
  return q.scale === "year" ? Math.round(v) : Math.round(v * stepDecimals(q)) / stepDecimals(q);
}
export function toPos(q, r, v) {
  const f = q.scale === "log" ? Math.log(v / r.min) / Math.log(r.max / r.min) : (v - r.min) / (r.max - r.min);
  return Math.round(Math.max(0, Math.min(1, f)) * STEPS);
}
const stepDecimals = (q) => (Number.isInteger(q.answer) ? 1 : 10);
// Three significant figures; whole numbers only when the answer is a whole number (bones, keys, years).
function niceRound(v, wholeAnswer) {
  const p = Math.pow(10, Math.floor(Math.log10(v)) - 2);
  const r = Math.round(v / p) * p;
  const out = wholeAnswer ? Math.max(1, Math.round(r)) : r;
  return Number(out.toPrecision(12));
}

// --- scoring (0–100) ---
// One rule: how many times out you are, judged against the answer and never against the slider, so a wide or
// hand-set slider can't make a question easier. Full marks within 2% everywhere.
// Amounts are forgiving: nothing once you're 3.4 times out, on a slightly bent curve that drops faster for near
// misses and eases off further out. Temperatures use the same curve, measured from an ordinary day (15°C) because
// 0°C isn't "none". Dates and human ages, which people know better, are strict and straight: nothing at 1.75 times
// out, measured as how long ago or the age, each plus 10 years so recent events and young ages stay fair.
const ratio = (a, b) => Math.max(a / b, b / a);
const AMOUNT = { none: 3.4, bend: 0.85 }, KNOWN = { none: 1.75, bend: 1 };
function timesOut(q, g) {
  if (q.scale === "year") { const a = THIS_YEAR - q.answer + 10, b = THIS_YEAR - g + 10; return [b > 0 ? ratio(a, b) : Infinity, KNOWN]; }
  if (q.unit === "years") return [ratio(q.answer + 10, Math.max(0, g) + 10), KNOWN];
  if (q.unit === "°C") return [1 + Math.abs(g - q.answer) / Math.max(5, Math.abs(q.answer - 15)), AMOUNT];
  return [g > 0 ? ratio(q.answer, g) : Infinity, AMOUNT];
}
export function score(q, g) {
  const [r, { none, bend }] = timesOut(q, g);
  if (r <= 1.02) return 100;
  return Math.max(0, Math.round(100 * (1 - Math.min(1, Math.log10(r) / Math.log10(none)) ** bend)));
}

/** Whole points out of 20 for a guess. */
export const points = (q, g) => Math.round((score(q, g) * PER_QUESTION) / 100);

// Prize tiers, county-fair style, by points out of 20.
export const TIERS = [
  { min: 20, key: "best", name: "Best in show", short: "🏆" },
  { min: 17, key: "first", name: "First prize", short: "🥇" },
  { min: 13, key: "second", name: "Second prize", short: "🥈" },
  { min: 8, key: "third", name: "Third prize", short: "🥉" },
  { min: 3, key: "hc", name: "Highly commended", short: "⚪" },
  { min: 0, key: "entry", name: "Thanks for entering", short: "▫️" },
];
export const tierFor = (pts) => TIERS.find((t) => pts >= t.min);

// --- formatting ---
export function fmt(q, v) {
  if (q.scale === "year") return v < 0 ? `${-v} BC` : v < 1000 ? `AD ${v}` : String(v);
  const opts = Number.isInteger(v) ? {} : { maximumFractionDigits: 3 };
  return v.toLocaleString("en-GB", opts);
}
// --- units: answers are stored metric; players can see and guess in imperial ---
const UNITS = {
  m: { to: "ft", f: 3.28084 },
  cm: { to: "in", f: 0.393701 },
  km: { to: "mi", f: 0.621371 },
  "km/h": { to: "mph", f: 0.621371 },
  kg: { to: "lb", f: 2.20462 },
  t: { to: "lb", f: 2204.62 },
  "°C": { to: "°F", conv: (c) => (c * 9) / 5 + 32, back: (f) => ((f - 32) * 5) / 9, delta: 9 / 5 },
};
let system = "metric";
export const setSystem = (s) => { system = s === "imperial" ? "imperial" : "metric"; };
export const getSystem = () => system;
export const convertible = (q) => Boolean(UNITS[q.unit]);
const imperial = (q, sys = system) => sys === "imperial" && convertible(q);
export const dispUnit = (q, sys = system) => (imperial(q, sys) ? UNITS[q.unit].to : q.unit);
export const unitPair = (q) => (convertible(q) ? [q.unit, UNITS[q.unit].to] : null);
export function toDisp(q, v, sys = system) {
  if (!imperial(q, sys)) return v;
  const u = UNITS[q.unit];
  return u.conv ? u.conv(v) : v * u.f;
}
export function fromDisp(q, d, sys = system) {
  if (!imperial(q, sys)) return d;
  const u = UNITS[q.unit];
  return u.back ? u.back(d) : d / u.f;
}
const sig3 = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Number(v.toPrecision(3)));
/** A metric value as the player sees it, number only. */
export function fmtDisp(q, v, sys = system) {
  if (!imperial(q, sys)) return fmt(q, v);
  return sig3(toDisp(q, v, sys)).toLocaleString("en-GB", { maximumFractionDigits: 2 });
}
const SINGULAR = { years: "year" };
const suffix = (u, v) => (u ? (u.startsWith("°") ? "" : " ") + (v === 1 && SINGULAR[u] ? SINGULAR[u] : u) : "");
export const withUnit = (q, v, sys = system) => `${fmtDisp(q, v, sys)}${suffix(dispUnit(q, sys), v)}`;
function withUnitDelta(q, d) {
  const u = UNITS[q.unit];
  if (!imperial(q)) return `${fmt(q, d)}${suffix(q.unit, d)}`;
  const v = d * (u.delta ?? u.f);
  return `${sig3(v).toLocaleString("en-GB", { maximumFractionDigits: 2 })}${suffix(u.to)}`;
}

export function offBy(q, g) {
  const a = q.answer;
  if (q.scale === "year") { const d = g - a; return d === 0 ? "Spot on" : `${Math.abs(d)} year${Math.abs(d) === 1 ? "" : "s"} ${d > 0 ? "too late" : "too early"}`; }
  if (q.scale === "log") {
    const r = g / a;
    if (Math.abs(r - 1) < 0.005) return "Spot on";
    if (r >= 1) return r < 2 ? `${Math.round((r - 1) * 100)}% too high` : `${r.toFixed(1)}× too high`;
    return r > 0.5 ? `${Math.round((1 - r) * 100)}% too low` : `${(1 / r).toFixed(1)}× too low`;
  }
  const d = Math.round((g - a) * 10) / 10;
  return d === 0 ? "Spot on" : `${withUnitDelta(q, Math.abs(d))} too ${d > 0 ? "high" : "low"}`;
}

// --- the herd ---
// A herd is 100 bins of guesses across a range: a starter crowd plus every real guess from Firestore. Before the
// A/B test the range is slider A. From AB_START it covers both sliders, so the same number lands in the same bin
// whichever slider it was guessed on. Earlier days keep slider A, so their stored herds and seeds never change.
//
// Every question starts with SEED_GUESSES made-up fairgoers who stay in for good, so the herd never jumps
// when real players arrive. They're made in two steps, like a real crowd: first pick where this crowd's
// hunch lands (sometimes close, sometimes well off), then scatter each guess around that hunch, with the
// odd wild one. With only a handful of guesses the middle wobbles, so some days the herd is uncannily
// close and some days it's miles out. Seeded by date and question, so everyone sees the same crowd.
export const SEED_GUESSES = 15;
const BINS = 100;
export function herdRange(q, day) {
  const a = rangeFor(q), b = day >= AB_START && rangeB(q);
  return b ? { min: Math.min(a.min, b.min), max: Math.max(a.max, b.max) } : a;
}
const binAt = (pos) => Math.min(BINS - 1, Math.max(0, Math.floor((pos / STEPS) * BINS)));
/** The herd bin a guessed value goes in on this day. */
export const herdBin = (q, day, v) => binAt(toPos(q, herdRange(q, day), v));
export const binValue = (q, range, k) => toValue(q, range, Math.round(((k + 0.5) / BINS) * STEPS));

// Seeds are made along slider A as they always were, then placed in the day's herd range.
function seedBins(q, day) {
  const R = rng(hash(`${day}|${q.id}|crowd`)), bins = new Array(BINS).fill(0), a = rangeFor(q), range = herdRange(q, day);
  const place = range.min === a.min && range.max === a.max ? (p) => binAt(p * STEPS) : (p) => binAt(toPos(q, range, toValue(q, a, Math.round(Math.max(0, Math.min(1, p)) * STEPS))));
  const normal = () => Math.sqrt(-2 * Math.log(R() + 1e-9)) * Math.cos(2 * Math.PI * R());
  const answerPos = toPos(q, a, q.answer) / STEPS;
  const hunch = answerPos + normal() * 0.07;          // step 1: where this crowd's gut lands
  const spread = 0.07 + R() * 0.1;                     // how much they disagree
  for (let i = 0; i < SEED_GUESSES; i++) {
    const p = R() < 0.12 ? R() : hunch + normal() * spread;   // step 2: each guess, plus the odd wild one
    bins[place(p)]++;
  }
  return bins;
}

/** real: the Firestore summary { n, b: { bin: count } } or undefined. */
export function herd(q, real, day) {
  const bins = seedBins(q, day), range = herdRange(q, day);
  for (const [k, c] of Object.entries(real?.b ?? {})) if (bins[k] != null) bins[k] += c;
  const n = bins.reduce((a, b) => a + b, 0);
  let acc = 0, mid = 0;
  for (let k = 0; k < BINS; k++) { acc += bins[k]; if (acc >= n / 2) { mid = k; break; } }
  return { bins, n, range, median: binValue(q, range, mid), players: n };
}

export function herdVerdict(q, h, g) {
  const you = points(q, g), them = points(q, h.median), raw = score(q, g);
  const lower = h.bins.reduce((a, c, k) => a + (c && score(q, binValue(q, h.range, k)) < raw ? c : 0), 0);
  const beat = h.n ? Math.round((lower / h.n) * 100) : 0;
  // Did this guess pull the herd's middle towards the answer?
  const pulled = (h.median > q.answer && g < h.median) || (h.median < q.answer && g > h.median);
  return { you, them, beat, pulled };
}
