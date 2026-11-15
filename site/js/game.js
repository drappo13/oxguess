// Game rules: slider ranges, scoring, number formatting and the (for now simulated) herd.

export const STEPS = 1000;
export const THIS_YEAR = 2026;
export const WILD_MULTIPLIER = 2;

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
export const multiplier = (q) => (q.cat === "wild" ? WILD_MULTIPLIER : 1);

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

// Prize tiers, county-fair style.
export const TIERS = [
  { min: 100, key: "best", name: "Best in show", short: "🏆" },
  { min: 85, key: "first", name: "First prize", short: "🥇" },
  { min: 65, key: "second", name: "Second prize", short: "🥈" },
  { min: 40, key: "third", name: "Third prize", short: "🥉" },
  { min: 15, key: "hc", name: "Highly commended", short: "🟩" },
  { min: 0, key: "entry", name: "Thanks for entering", short: "⬜" },
];
export const tierFor = (s) => TIERS.find((t) => s >= t.min);

// --- formatting ---
export function fmt(q, v) {
  if (q.scale === "year") return v < 0 ? `${-v} BC` : v < 1000 ? `AD ${v}` : String(v);
  const opts = Number.isInteger(v) ? {} : { maximumFractionDigits: 3 };
  return v.toLocaleString("en-GB", opts);
}
export const withUnit = (q, v) => `${fmt(q, v)}${q.unit ? (q.unit.startsWith("°") ? "" : " ") + q.unit : ""}`;

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
  return d === 0 ? "Spot on" : `${withUnit(q, Math.abs(d))} too ${d > 0 ? "high" : "low"}`;
}

// --- the herd (simulated until there's a backend) ---
export function herd(q) {
  const r = rangeFor(q), R = rng(hash(q.id + "herd"));
  const pa = toPos(q, r, q.answer) / STEPS, bias = (R() - 0.5) * 0.14, spread = 0.09 + R() * 0.08;
  const guesses = [];
  for (let i = 0; i < 640; i++) {
    const n = Math.sqrt(-2 * Math.log(R() + 1e-9)) * Math.cos(2 * Math.PI * R());
    guesses.push(toValue(q, r, Math.round(Math.max(0, Math.min(1, pa + bias + n * spread)) * STEPS)));
  }
  const sorted = [...guesses].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return { guesses, median, players: guesses.length };
}

export function herdVerdict(q, h, g) {
  const you = score(q, g), them = score(q, h.median);
  const beat = Math.round((h.guesses.filter((x) => score(q, x) < you).length / h.guesses.length) * 100);
  // Did this guess pull the herd's middle towards the answer?
  const pulled = (h.median > q.answer && g < h.median) || (h.median < q.answer && g > h.median);
  return { you, them, beat, pulled };
}
