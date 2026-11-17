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
  if (muted) return null;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch { return null; }
}
function tone(freq, { at = 0, dur = 0.2, type = "sine", vol = 0.12, to = null, attack = 0.005 } = {}) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
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

let lastTick = 0;
export const sfx = {
  /** A soft wooden click while dragging the slider (throttled). */
  tick() { const n = performance.now(); if (n - lastTick < 45) return; lastTick = n; tone(1200, { dur: 0.03, type: "triangle", vol: 0.035 }); },
  /** Locking in a guess: a ticket being torn and dropped in the box. */
  thunk() { noise({ dur: 0.07, vol: 0.25, freq: 600 }); tone(140, { dur: 0.12, type: "sine", vol: 0.14, to: 90 }); },
  /** The answer flag travelling along the scale. */
  slide(ms) { tone(320, { dur: ms / 1000, type: "triangle", vol: 0.03, to: 640 }); },
  /** The strength-tester puck shooting up. */
  whoosh(ms) { tone(180, { dur: ms / 1000, type: "sawtooth", vol: 0.02, to: 900 }); },
  /** Ding! The bell at the top of the strength tester. */
  bell() { [1318, 2637, 3951].forEach((f, i) => tone(f, { dur: 1.4 - i * 0.3, vol: 0.12 / (i + 1), type: "sine" })); },
  /** A pleasant two-note chime for a good guess. */
  chime() { tone(784, { dur: 0.25, vol: 0.1 }); tone(1046, { at: 0.09, dur: 0.35, vol: 0.1 }); },
  /** A small, kind note for a so-so guess. */
  plink() { tone(660, { dur: 0.18, vol: 0.07, type: "triangle" }); },
  /** A gentle wobble for a long way off. Never a buzzer. */
  wobble() { tone(392, { dur: 0.3, vol: 0.06, type: "triangle", to: 330 }); },
  /** The judge's stamp coming down. */
  stamp() { noise({ dur: 0.06, vol: 0.35, freq: 400 }); tone(90, { dur: 0.1, vol: 0.18, to: 60 }); },
  /** Counting up, one blip per step (throttled). */
  count() { const n = performance.now(); if (n - lastTick < 40) return; lastTick = n; tone(880 + Math.random() * 120, { dur: 0.04, vol: 0.03, type: "square" }); },
  /** The end-of-round fanfare: a little brass-band flourish. */
  fanfare() { [523, 659, 784, 1046].forEach((f, i) => tone(f, { at: i * 0.11, dur: i === 3 ? 0.6 : 0.16, type: "sawtooth", vol: 0.045 })); tone(1046, { at: 0.33, dur: 0.7, vol: 0.06 }); },
};

// ---------- haptics ----------
export function buzz(pattern) { try { navigator.vibrate?.(pattern); } catch { /* fine */ } }

// ---------- motion helpers ----------
export const wait = (ms) => new Promise((r) => setTimeout(r, reduced() ? 0 : ms));

/** Count a number up inside an element, with a blip per step. */
export function countUp(el, to, ms = 700, { from = 0, sound = true, format = (v) => String(v) } = {}) {
  return new Promise((resolve) => {
    if (!el) return resolve();
    if (reduced() || ms <= 0 || to === from) { el.textContent = format(to); return resolve(); }
    const t0 = performance.now(); let last = null;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms), e = 1 - (1 - p) ** 3;
      const v = Math.round(from + (to - from) * e);
      if (v !== last) { el.textContent = format(v); last = v; if (sound) sfx.count(); }
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
