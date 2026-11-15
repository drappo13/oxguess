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
  if (q.scale === "lin") return { min: q.min, max: q.max };
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
  return { min: friendlyFloor(min), max: friendlyCeil(max) };
}
function friendlyFloor(v) { const p = Math.pow(10, Math.floor(Math.log10(v))); return Math.max(p / 10, Math.floor(v / p) * p); }
function friendlyCeil(v) { const p = Math.pow(10, Math.floor(Math.log10(v))); return Math.ceil(v / p) * p; }

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

// --- scoring (0–100 before the wildcard multiplier) ---
export function score(q, g) {
  const r = rangeFor(q);
  if (q.scale === "log") {
    if (g <= 0) return 0;
    const err = Math.abs(Math.log10(g / q.answer));
    if (err <= Math.log10(1.02)) return 100;
    return Math.max(0, Math.round(100 * (1 - err / 0.6)));
  }
  const frac = Math.abs(g - q.answer) / (r.max - r.min);
  if (q.scale === "year") {
    if (g === q.answer || frac <= 0.004) return 100;
    return Math.max(0, Math.round(100 * (1 - frac * 4)));
  }
  if (frac <= 0.01) return 100;
  return Math.max(0, Math.round(100 * (1 - frac * 4)));
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
const suffix = (u) => (u ? (u.startsWith("°") ? "" : " ") + u : "");
export const withUnit = (q, v, sys = system) => `${fmtDisp(q, v, sys)}${suffix(dispUnit(q, sys))}`;
/** The answer in the other system, for the small line under the big number. */
export const otherUnits = (q, v) => (convertible(q) ? withUnit(q, v, system === "metric" ? "imperial" : "metric") : null);
function withUnitDelta(q, d) {
  const u = UNITS[q.unit];
  if (!imperial(q)) return `${fmt(q, d)}${suffix(q.unit)}`;
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
// A herd is 100 bins of guesses across the slider. Real herds come from Firestore; until a question has
// HERD_MIN real guesses we show a clearly labelled sample herd instead.
export const HERD_MIN = 10;
const BINS = 100;
const binValue = (q, k) => toValue(q, rangeFor(q), Math.round(((k + 0.5) / BINS) * STEPS));

function sampleBins(q) {
  const R = rng(hash(q.id + "herd")), bins = new Array(BINS).fill(0);
  const pa = toPos(q, rangeFor(q), q.answer) / STEPS, bias = (R() - 0.5) * 0.24, spread = 0.12 + R() * 0.12;
  for (let i = 0; i < 640; i++) {
    const n = Math.sqrt(-2 * Math.log(R() + 1e-9)) * Math.cos(2 * Math.PI * R());
    bins[Math.min(BINS - 1, Math.floor(Math.max(0, Math.min(0.9999, pa + bias + n * spread)) * BINS))]++;
  }
  return bins;
}

/** real: the Firestore summary { n, b: { bin: count } } or undefined. */
export function herd(q, real) {
  const realN = real?.n ?? 0, sample = realN < HERD_MIN;
  const bins = sample ? sampleBins(q) : Array.from({ length: BINS }, (_, k) => real.b?.[k] ?? 0);
  const n = bins.reduce((a, b) => a + b, 0);
  let acc = 0, mid = 0;
  for (let k = 0; k < BINS; k++) { acc += bins[k]; if (acc >= n / 2) { mid = k; break; } }
  return { bins, n, median: binValue(q, mid), players: sample ? realN : n, sample };
}

export function herdVerdict(q, h, g) {
  const you = points(q, g), them = points(q, h.median), raw = score(q, g);
  const lower = h.bins.reduce((a, c, k) => a + (c && score(q, binValue(q, k)) < raw ? c : 0), 0);
  const beat = h.n ? Math.round((lower / h.n) * 100) : 0;
  // Did this guess pull the herd's middle towards the answer?
  const pulled = (h.median > q.answer && g < h.median) || (h.median < q.answer && g > h.median);
  return { you, them, beat, pulled };
}
