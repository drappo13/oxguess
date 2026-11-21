// Little moments of joy: fairground sounds (synthesised, no files), haptics, bunting confetti,
// ink stamps and count-ups. Everything is skippable: muted sounds, reduced motion, no vibration API.

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
let muted = false;
try { muted = localStorage.getItem("ox-muted") === "1"; } catch { /* fine */ }
export const isMuted = () => muted;
export function setMuted(m) { muted = m; try { localStorage.setItem("ox-muted", m ? "1" : "0"); } catch { /* fine */ } }

// ---------- sound ----------
let ctx = null;
function ac() {
  // Nothing before the first tap: browsers keep audio locked until then, and a queue of sounds would burst out at once.
  if (muted || navigator.userActivation?.hasBeenActive === false) return null;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch { return null; }
}
// One note. lp: a lowpass filter (Hz) to soften bright waves, for brass and tuba. glide: [[Hz, seconds], ...] pitch
// points after the start, for the moo.
function tone(freq, { at = 0, dur = 0.2, type = "sine", vol = 0.12, to = null, attack = 0.005, lp = null, glide = null, detune = 0 } = {}) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  for (const [f, s] of glide ?? []) o.frequency.exponentialRampToValueAtTime(f, t + s);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let out = o;
  if (lp) { const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp; f.Q.value = 0.7; out = o.connect(f); }
  out.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise({ at = 0, dur = 0.08, vol = 0.2, freq = 900 } = {}) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + at, len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = buf; f.type = "lowpass"; f.frequency.value = freq; g.gain.value = vol;
  src.connect(f).connect(g).connect(c.destination); src.start(t);
}

// Each repeating sound has its own throttle, so the slider's ticks and a count-up never swallow each other.
const last = {};
const every = (key, ms) => { const n = performance.now(); if (n - (last[key] ?? 0) < ms) return false; last[key] = n; return true; };
const semis = (f, n) => f * 2 ** (n / 12);
export const sfx = {
  /** A soft wooden click while dragging the slider; at = how far along (0 to 1), the pitch rising with it. */
  tick(at = 0.5) { if (every("tick", 45)) tone(700 * 2 ** at, { dur: 0.03, type: "triangle", vol: 0.035 }); },
  /** A primary button going down: a soft wooden tap. */
  press() { noise({ dur: 0.02, vol: 0.07, freq: 1800 }); tone(220, { dur: 0.04, vol: 0.05, to: 180 }); },
  /** Locking in a guess: a ticket being torn and dropped in the box. */
  thunk() { noise({ dur: 0.07, vol: 0.25, freq: 600 }); tone(140, { dur: 0.12, type: "sine", vol: 0.14, to: 90 }); },
  /** The answer flag travelling along the scale. */
  slide(ms) { tone(320, { dur: ms / 1000, type: "triangle", vol: 0.03, to: 640 }); },
  /** The strength tester: one tick a point as the puck climbs, a semitone higher each time. */
  climb(k) { tone(semis(400, k), { dur: 0.03, type: "triangle", vol: 0.04 }); },
  /** The puck landing where it stopped. */
  land() { tone(160, { dur: 0.12, vol: 0.14, to: 110 }); noise({ dur: 0.04, vol: 0.12, freq: 500 }); },
  /** Ding-ding! The bell at the top of the strength tester, struck twice: bell partials (not organ harmonics) and the
   *  hammer's strike, the second ring a touch softer. */
  bell() {
    for (const [at, k] of [[0, 1], [0.3, 0.8]]) {
      noise({ at, dur: 0.015, vol: 0.08 * k, freq: 6000 });
      [[1318, 0.12, 1.6], [2637, 0.06, 1.0], [3637, 0.04, 0.7], [7117, 0.02, 0.3]].forEach(([f, vol, dur]) => tone(f, { at, dur, vol: vol * k }));
    }
  },
  /** It nearly rang: a single faint tink. */
  tink() { tone(1318, { dur: 0.3, vol: 0.03 }); },
  /** A two-note chime for a good guess; each good guess in a row (run = 0, 1, 2...) chimes a tone higher. */
  chime(run = 0) { const k = 2 * Math.min(run, 4); tone(semis(784, k), { dur: 0.25, vol: 0.1 }); tone(semis(1046, k), { at: 0.09, dur: 0.35, vol: 0.1 }); },
  /** Ding-ding: you beat the herd on this one. */
  ding() { tone(880, { dur: 0.25, vol: 0.12 }); tone(1100, { at: 0.08, dur: 0.25, vol: 0.12 }); },
  /** A small, kind note for a so-so guess. */
  plink() { tone(660, { dur: 0.18, vol: 0.07, type: "triangle" }); },
  /** A gentle wobble for a long way off. Never a buzzer. */
  wobble() { tone(392, { dur: 0.3, vol: 0.06, type: "triangle", to: 330 }); },
  /** The judge's stamp coming down. */
  stamp() { noise({ dur: 0.06, vol: 0.35, freq: 400 }); tone(90, { dur: 0.1, vol: 0.18, to: 60 }); },
  /** A line chalked up on the board. */
  chalk() { noise({ dur: 0.06, vol: 0.04, freq: 5000 }); },
  /** A rosette pinned on: a little "tk". */
  pin() { noise({ dur: 0.015, vol: 0.12, freq: 4000 }); tone(1568, { dur: 0.03, vol: 0.05 }); },
  /** Counting up, one blip per step; at = how far through (0 to 1). low: the herd's count, an octave down. */
  count(at = 0, { low = false } = {}) { if (every(low ? "count-low" : "count", 40)) tone((600 + 800 * at) / (low ? 2 : 1), { dur: 0.028, vol: 0.04, type: "triangle" }); },
  /** You won the day: the brass band's arpeggio up, C E G C, with a sweet top note underneath. */
  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, { at: i * 0.09, dur: i === 3 ? 0.6 : 0.16, type: "sawtooth", vol: 0.06, lp: 2200 }));
    tone(1047, { at: 0.27, dur: 0.7, vol: 0.05 });
  },
  /** The herd won the day: a good-humoured tuba, pah-PAH. */
  oompah() { tone(196, { dur: 0.16, type: "sawtooth", vol: 0.1, lp: 900 }); tone(131, { at: 0.2, dur: 0.38, type: "sawtooth", vol: 0.1, lp: 900 }); },
  /** Moo. Two slightly detuned reeds gliding up and down, through a closing mouth. */
  moo() {
    const c = ac(); if (!c) return;
    const t = c.currentTime, f = c.createBiquadFilter(), g = c.createGain();
    f.type = "lowpass"; f.Q.value = 3; f.frequency.setValueAtTime(600, t); f.frequency.linearRampToValueAtTime(1100, t + 0.3); f.frequency.linearRampToValueAtTime(500, t + 0.8);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.08); g.gain.setValueAtTime(0.12, t + 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    f.connect(g).connect(c.destination);
    // A slow vibrato, so it lows rather than buzzes.
    const lfo = c.createOscillator(), depth = c.createGain();
    lfo.frequency.value = 5.5; depth.gain.value = 3; lfo.connect(depth); lfo.start(t); lfo.stop(t + 0.9);
    for (const base of [105, 107]) {
      const o = c.createOscillator(); o.type = "sawtooth"; depth.connect(o.frequency);
      o.frequency.setValueAtTime(base * 0.9, t); o.frequency.linearRampToValueAtTime(base * 1.19, t + 0.3); o.frequency.linearRampToValueAtTime(base * 0.95, t + 0.8);
      o.connect(f); o.start(t); o.stop(t + 0.9);
    }
  },
};

// ---------- haptics ----------
export function buzz(pattern) { try { navigator.vibrate?.(pattern); } catch { /* fine */ } }

// ---------- motion helpers ----------
// Under reduced motion the beats still keep a little gap, so their sounds don't all land at once.
export const wait = (ms) => new Promise((r) => setTimeout(r, reduced() ? Math.min(ms, 120) : ms));

/** Count a number up inside an element, with a blip per step. */
export function countUp(el, to, ms = 700, { from = 0, sound = true, format = (v) => String(v) } = {}) {
  return new Promise((resolve) => {
    if (!el) return resolve();
    if (reduced() || ms <= 0 || to === from) { el.textContent = format(to); return resolve(); }
    const t0 = performance.now(); let last = null;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms), e = 1 - (1 - p) ** 3;
      const v = Math.round(from + (to - from) * e);
      if (v !== last) { el.textContent = format(v); last = v; if (sound) sfx.count(p, sound === "low" ? { low: true } : {}); }
      if (p < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}

/** Thump an element down like an ink stamp. */
export function stampIn(el, { sound = true } = {}) {
  if (!el) return;
  el.hidden = false;
  if (sound) sfx.stamp();
  if (reduced()) return;
  el.animate(
    [{ transform: "scale(2.2) rotate(-18deg)", opacity: 0 }, { transform: "scale(.92) rotate(-8deg)", opacity: 1, offset: 0.7 }, { transform: "scale(1) rotate(-8deg)", opacity: 1 }],
    { duration: 380, easing: "cubic-bezier(.2,.9,.3,1.2)", fill: "both" },
  );
}

/** A springy pop for numbers and badges. */
export function pop(el, scale = 1.25) {
  if (!el || reduced()) return;
  el.animate([{ transform: "scale(1)" }, { transform: `scale(${scale})` }, { transform: "scale(1)" }], { duration: 360, easing: "cubic-bezier(.3,1.6,.5,1)" });
}

/** A brief warm flash over the screen for a bullseye. */
export function flash(color = "var(--c-when)") {
  if (reduced()) return;
  const d = document.createElement("div");
  d.className = "fx-flash"; d.style.background = color;
  document.body.appendChild(d);
  d.animate([{ opacity: 0 }, { opacity: 0.22 }, { opacity: 0 }], { duration: 520, easing: "ease-out" }).onfinish = () => d.remove();
}

// ---------- bunting confetti ----------
const FLAG_COLOURS = ["var(--c-big)", "var(--c-when)", "var(--c-far)", "var(--c-many)", "var(--tent-a)", "var(--c-wild)"];
/** Little bunting flags and paper scraps fanning up from a point, then fluttering down. */
export function bunting({ x = window.innerWidth / 2, y = window.innerHeight * 0.6, count = 46, power = 1 } = {}) {
  if (reduced()) return;
  const layer = document.createElement("div");
  layer.className = "fx-layer";
  document.body.appendChild(layer);
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    const flag = i % 3 !== 0;
    el.className = flag ? "fx-flag" : "fx-scrap";
    el.style.setProperty("--c", FLAG_COLOURS[i % FLAG_COLOURS.length]);
    el.style.left = `${x}px`; el.style.top = `${y}px`;
    layer.appendChild(el);
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = (220 + Math.random() * 260) * power;
    const dx = Math.cos(a) * v, dy = Math.sin(a) * v, drift = (Math.random() - 0.5) * 120, r = (Math.random() - 0.5) * 900;
    el.animate(
      [
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${r / 2}deg)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${dx + drift}px, ${dy + 560}px) rotate(${r}deg)`, opacity: 0 },
      ],
      { duration: 1900 + Math.random() * 700, delay: Math.random() * 90, easing: "cubic-bezier(.2,.7,.4,1)", fill: "forwards" },
    );
  }
  setTimeout(() => layer.remove(), 2900);
}

/** A small sparkle of gold scraps for a near miss. */
export function sparkle(el) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  bunting({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: 14, power: 0.45 });
}

// ---------- the morning chalkboard ----------
const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
/** Chalk the board up (art.chalkboard): each line written in left to right, the numbers counting, then, for a top-20
 *  finish, the rosette swings onto the corner with a sparkle. */
export function chalkUp(root) {
  if (!root || reduced()) return;
  [...root.querySelectorAll(".slate-title, .slate-score, .slate-head b, .slate-head span")].forEach((c, k) => {
    c.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 -10% 0 0)" }], { duration: 320, delay: 100 + k * 110, easing: "ease-out", fill: "backwards" });
    setTimeout(() => sfx.chalk(), 100 + k * 110);
  });
  root.querySelectorAll("[data-count]").forEach((b, k) => setTimeout(() => countUp(b, Number(b.dataset.count), 650,
    { from: Number(b.dataset.from), sound: "low", format: "ord" in b.dataset ? ordinal : String }), 200 + k * 110));
  const ros = root.querySelector(".slate-rosette");
  if (ros) setTimeout(() => {
    ros.animate([{ transform: "rotate(-50deg) scale(.3)", opacity: 0 }, { transform: "rotate(14deg) scale(1.1)", opacity: 1, offset: 0.6 }, { transform: "rotate(-4deg)" }, { transform: "rotate(8deg)" }],
      { duration: 700, easing: "cubic-bezier(.3,1.4,.5,1)", fill: "backwards" });
    sfx.pin(); buzz(12);
    setTimeout(() => { sfx.chime(); sparkle(ros); }, 300);
  }, 900);
}

// ---------- a prize flying to its counter ----------
/** A copy of a prize (html) arcs from where it was won up to its counter, shrinking as it lands. */
export function flyTo(fromEl, toEl, html, ms = 650) {
  return new Promise((done) => {
    if (reduced() || !fromEl || !toEl) return done();
    const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    const f = document.createElement("div");
    f.className = "fx-fly"; f.innerHTML = html;
    document.body.appendChild(f);
    const w = f.offsetWidth, h = f.offsetHeight;
    f.style.left = `${a.left + a.width / 2 - w / 2}px`; f.style.top = `${a.top + a.height / 2 - h / 2}px`;
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    f.animate([
      { transform: "translate(0, 0) scale(1) rotate(0)", opacity: 1 },
      { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 50}px) scale(1.2) rotate(-18deg)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(.4) rotate(12deg)`, opacity: 0.9 },
    ], { duration: ms, easing: "cubic-bezier(.45,.05,.4,1)", fill: "forwards" }).onfinish = () => { f.remove(); done(); };
    setTimeout(() => { f.remove(); done(); }, ms + 400); // a background tab pauses animations: never wait for ever
  });
}

// ---------- your ticket into the judges' box ----------
// In 1906 every guess was a numbered sixpenny ticket. Each locked-in guess becomes one and drops in the box.
const BOX_SVG = `<svg viewBox="0 0 120 92" aria-hidden="true">
  <path d="M10 30 L110 30 L104 88 L16 88 Z" fill="var(--wood)" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M4 22 L116 22 L110 34 L10 34 Z" fill="color-mix(in srgb, var(--wood) 80%, #000)" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/>
  <rect x="38" y="25" width="44" height="5" rx="2.5" fill="var(--ink)"/>
  <rect x="34" y="48" width="52" height="22" rx="3" fill="var(--ticket)" stroke="var(--ink)" stroke-width="1.5"/>
  <text x="60" y="63" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif" font-weight="700" font-size="10" fill="var(--ink)">GUESSES</text>
</svg>`;

export function dropTicket(fromEl, { number, value }) {
  return new Promise((resolve) => {
    if (reduced() || !fromEl) return resolve();
    const from = fromEl.getBoundingClientRect();
    const ticket = document.createElement("div");
    ticket.className = "fx-ticket";
    ticket.innerHTML = `<span class="stub">No.<br>${number}</span><span class="main"><small>MY GUESS</small><b>${value}</b></span>`;
    document.body.appendChild(ticket);
    const tw = ticket.offsetWidth, th = ticket.offsetHeight;
    const sx = from.left + from.width / 2 - tw / 2, sy = from.top + from.height / 2 - th / 2;
    ticket.style.left = `${sx}px`; ticket.style.top = `${sy}px`;

    const box = document.createElement("div");
    box.className = "fx-box"; box.innerHTML = BOX_SVG;
    document.body.appendChild(box);
    const bx = window.innerWidth / 2 - 60, by = Math.min(window.innerHeight - 120, from.bottom + 150);
    box.style.left = `${bx}px`; box.style.top = `${by}px`;
    box.animate([{ transform: "translateY(30px) scale(.8)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 220, easing: "cubic-bezier(.3,1.4,.5,1)", fill: "both" });

    const slotX = bx + 60 - (sx + tw / 2), slotY = by + 26 - (sy + th / 2);
    sfx.tick();
    const fly = ticket.animate([
      { transform: "translate(0,0) rotate(0) scale(1)", opacity: 1 },
      { transform: "translate(0,-18px) rotate(-7deg) scale(1.06)", opacity: 1, offset: 0.22 },
      { transform: `translate(${slotX * 0.6}px, ${slotY * 0.55 - 30}px) rotate(4deg) scale(.8)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${slotX}px, ${slotY}px) rotate(0) scale(.42, .3)`, opacity: 0.9, offset: 0.92 },
      { transform: `translate(${slotX}px, ${slotY + 10}px) rotate(0) scale(.4, .05)`, opacity: 0 },
    ], { duration: 640, easing: "cubic-bezier(.45,.05,.4,1)", fill: "forwards" });
    fly.onfinish = () => {
      sfx.thunk(); buzz(14);
      ticket.remove();
      const bump = box.animate([{ transform: "none" }, { transform: "translateY(3px) scaleY(.94)" }, { transform: "translateY(-2px)" }, { transform: "none", opacity: 1 }, { opacity: 0 }],
        { duration: 520, easing: "ease-out", fill: "forwards" });
      setTimeout(resolve, 200);
      bump.onfinish = () => box.remove();
    };
  });
}
