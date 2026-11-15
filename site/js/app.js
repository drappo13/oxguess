import { oxHead, rosette, fairScene } from "./art.js";
import {
  STEPS, CATS, catLabel, catIcon, multiplier, rangeFor, toValue, toPos, score, tierFor, TIERS,
  fmt, withUnit, offBy, herd, herdVerdict,
} from "./game.js";

const EPOCH = "2026-11-15"; // day 1
const app = document.getElementById("app");
let ROUNDS = null;

// ---------- dates & storage ----------
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function todayKey() {
  const p = new URLSearchParams(location.search).get("day");
  return p && /^\d{4}-\d{2}-\d{2}$/.test(p) ? p : keyOf(new Date());
}
const parseKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);
const shift = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
const prettyDate = (k) => parseKey(k).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

const store = {
  get(k, fallback = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: play still works */ } },
};
const dayStateKey = (k) => `ox-day-${k}`;

function streak() {
  let k = todayKey(), n = 0;
  if (!store.get(dayStateKey(k))?.done) k = shift(k, -1);
  while (store.get(dayStateKey(k))?.done) { n++; k = shift(k, -1); }
  return n;
}

// ---------- today's round ----------
function roundFor(k) {
  const n = daysBetween(EPOCH, k);
  const days = ROUNDS.days;
  const day = days[((n % days.length) + days.length) % days.length];
  return { number: n + 1, questions: day.questions };
}

let today, state;
function load() {
  const k = todayKey();
  today = { key: k, ...roundFor(k) };
  state = store.get(dayStateKey(k), { answers: [], done: false });
}
const save = () => store.set(dayStateKey(today.key), state);
const maxTotal = () => today.questions.reduce((a, q) => a + 100 * multiplier(q), 0);
const total = () => state.answers.reduce((a, r, i) => a + r.s * multiplier(today.questions[i]), 0);

// ---------- shell ----------
function header() {
  const s = streak();
  return `<header class="top">
    <button class="brand" data-go="home" aria-label="OxGuess home">${oxHead({ size: 40 })}<span>OxGuess</span></button>
    <div class="top-right">
      ${s ? `<span class="pill" title="Days in a row">🔥 ${s}</span>` : ""}
      <button class="link" data-go="story">The story</button>
    </div>
  </header>`;
}
function render(html, cat) {
  if (cat) { app.style.setProperty("--cat", CATS[cat].color); app.dataset.cat = cat; } else { app.style.removeProperty("--cat"); delete app.dataset.cat; }
  app.innerHTML = header() + `<main class="screen">${html}</main>`;
  app.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => go(b.dataset.go)));
  window.scrollTo(0, 0);
}
function go(where) {
  if (where === "home") return home();
  if (where === "story") return story();
  if (where === "play") return state.done ? results() : state.answers.length ? (state.revealing ? reveal(state.answers.length - 1) : ask()) : ask();
  if (where === "results") return results();
}

// ---------- screens ----------
function home() {
  const qs = today.questions, done = state.done, started = state.answers.length > 0;
  render(`
    <section class="hero card">
      <div class="hero-ox">${oxHead({ size: 112, mood: done ? "happy" : "happy" })}</div>
      <p class="eyebrow">${prettyDate(today.key)} · Round ${today.number}</p>
      <h1>${done ? "You've had your guesses today" : "Five numbers. How close can you get?"}</h1>
      <p class="lede">${done
        ? `You scored <b>${total()}</b> out of ${maxTotal()}. New guesses at midnight.`
        : "Nobody knows these off by heart. Guess on the slider, score points for getting close, then see how the whole herd guessed."}</p>
      <ol class="todays">
        ${qs.map((q, i) => {
          const a = state.answers[i];
          return `<li style="--cat:${CATS[q.cat].color}"><span class="dot">${catIcon(q)}</span><span>${catLabel(q)}${multiplier(q) > 1 ? ` <em class="x2">×${multiplier(q)}</em>` : ""}</span><span class="res">${a ? `${tierFor(a.s).short} ${a.s * multiplier(q)}` : ""}</span></li>`;
        }).join("")}
      </ol>
      <button class="btn primary big" data-go="${done ? "results" : "play"}">${done ? "See today's results" : started ? "Carry on" : "Start guessing"}</button>
    </section>
    <section class="card soft story-teaser">
      <div>
        <h2>Why an ox?</h2>
        <p>In 1906, nearly 800 people at a country fair guessed the weight of an ox. The middle guess was out by less than 1%.</p>
      </div>
      <button class="btn" data-go="story">Read the story</button>
    </section>
    <p class="fine">Early preview. The herd's guesses are made up for now, so don't take them personally.</p>
  `);
}

function story() {
  render(`
    <section class="card story">
      ${fairScene()}
      <p class="eyebrow">Plymouth, 1906</p>
      <h1>The ox that started it</h1>
      <p>At the West of England Fat Stock and Poultry Exhibition, a prize ox stood in a pen and the crowd paid sixpence a ticket to guess its weight once it had been slaughtered and dressed.</p>
      <p>Farmers and butchers had a go. So did plenty of people who had never weighed anything bigger than a sack of flour. The guesses were all over the place.</p>
      <p>Afterwards someone gathered up the 787 tickets and lined them up. The middle guess was <b>1,207 lb</b>. The ox weighed <b>1,198 lb</b>.</p>
      <p class="big-line">Out by nine pounds. Together, the crowd knew.</p>
      <p>OxGuess is that fair, every day. Five numbers nobody knows off by heart. You'll be out on some of them. The herd, all of us guessing together, usually gets surprisingly close.</p>
      <p class="fine">Source: "Vox Populi", <i>Nature</i> 75, 450–451 (1907).</p>
      <button class="btn primary big" data-go="${state.done ? "results" : "play"}">${state.done ? "See today's results" : "Join the herd"}</button>
    </section>
  `);
  store.set("ox-seen-story", true);
}

function progress(i, revealed) {
  return `<div class="progress" aria-label="Question ${i + 1} of ${today.questions.length}">${today.questions.map((q, j) =>
    `<span class="${j < i || (j === i && revealed) ? "done" : j === i ? "now" : ""}" style="--cat:${CATS[q.cat].color}"></span>`).join("")}</div>`;
}

function ask() {
  const i = state.answers.length, q = today.questions[i], r = rangeFor(q);
  let pos = Math.round(STEPS / 2), typed = null;
  render(`
    ${progress(i, false)}
    <section class="card ask">
      <div class="chip-row"><span class="chip">${catIcon(q)} ${catLabel(q)}</span>${multiplier(q) > 1 ? `<span class="chip ghost">Double points</span>` : ""}</div>
      <h1 class="question">${q.q}</h1>
      <div class="readout">
        <input id="guess" inputmode="decimal" autocomplete="off" aria-label="Your guess">
        ${q.unit ? `<span class="unit">${q.unit}</span>` : ""}
      </div>
      <div class="tape">
        <input type="range" id="slider" min="0" max="${STEPS}" value="${pos}" aria-label="Guess slider">
        <div class="ticks" aria-hidden="true"></div>
        <div class="ends"><span>${withUnit(q, r.min)}</span><span>${withUnit(q, r.max)}</span></div>
      </div>
      <div class="nudge"><button class="btn round" id="down" aria-label="A bit lower">−</button><span class="hint">Drag, nudge or type</span><button class="btn round" id="up" aria-label="A bit higher">+</button></div>
      <button class="btn primary big" id="lock">Lock it in</button>
    </section>`, q.cat);

  const slider = document.getElementById("slider"), input = document.getElementById("guess");
  const current = () => (typed ?? toValue(q, r, pos));
  const show = () => { input.value = fmt(q, current()); slider.value = pos; };
  show();
  slider.oninput = () => { pos = +slider.value; typed = null; show(); };
  const nudge = (d) => {
    if (q.scale === "log") {
      const v = current(); let t = toPos(q, r, v);
      while (t > 0 && t < STEPS && toValue(q, r, t) === v) t += d;
      pos = t; typed = null;
    } else {
      const step = Number.isInteger(q.answer) ? 1 : 0.1;
      typed = Math.round(Math.max(r.min, Math.min(r.max, current() + d * step)) * 10) / 10;
      pos = toPos(q, r, typed);
    }
    show();
  };
  document.getElementById("down").onclick = () => nudge(-1);
  document.getElementById("up").onclick = () => nudge(1);
  input.oninput = () => {
    let raw = input.value.trim().replace(/,/g, "");
    const bc = /bc$/i.test(raw); raw = raw.replace(/\s*bc$/i, "");
    let v = parseFloat(raw.replace(/[^\d.\-]/g, ""));
    if (!isNaN(v)) { if (bc) v = -v; typed = v; pos = toPos(q, r, Math.max(r.min, Math.min(r.max, v))); slider.value = pos; }
  };
  input.onfocus = () => input.select();
  input.onblur = () => { if (typed != null) { typed = Math.max(r.min, Math.min(r.max, typed)); show(); } };
  input.onkeydown = (e) => { if (e.key === "Enter") document.getElementById("lock").click(); };
  document.getElementById("lock").onclick = () => {
    const g = Math.max(r.min, Math.min(r.max, current()));
    state.answers.push({ g, s: score(q, g) });
    state.revealing = true;
    save();
    reveal(i);
  };
}

function histogram(q, h, g) {
  const r = rangeFor(q), B = 26, bins = new Array(B).fill(0);
  h.guesses.forEach((x) => bins[Math.min(B - 1, Math.floor((toPos(q, r, x) / STEPS) * B))]++);
  const mx = Math.max(...bins), W = 320, H = 110, bw = W / B, base = H - 8;
  const x = (v) => (toPos(q, r, v) / STEPS) * W;
  const bars = bins.map((c, i) => {
    const bh = (c / mx) * (H - 34);
    return `<rect x="${(i * bw + 1.5).toFixed(1)}" y="${(base - bh).toFixed(1)}" width="${(bw - 3).toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="var(--cat)" opacity=".28"/>`;
  }).join("");
  const ax = x(q.answer), gx = x(g), mx2 = x(h.median);
  return `<svg viewBox="-8 0 ${W + 16} ${H + 4}" role="img" aria-label="How the herd guessed">
    ${bars}
    <line x1="0" x2="${W}" y1="${base}" y2="${base}" stroke="var(--line)" stroke-width="1.5"/>
    <line x1="${mx2}" x2="${mx2}" y1="22" y2="${base}" stroke="var(--muted)" stroke-width="2" stroke-dasharray="2 4"/>
    <line x1="${gx}" x2="${gx}" y1="16" y2="${base}" stroke="var(--ink)" stroke-width="2.5"/>
    <circle cx="${gx}" cy="12" r="6" fill="var(--ink)"/>
    <line x1="${ax}" x2="${ax}" y1="8" y2="${base}" stroke="var(--good)" stroke-width="3"/>
    <path d="M${ax} 2 l7 5 l-7 5 z" fill="var(--good)"/>
  </svg>`;
}

function reveal(i) {
  const q = today.questions[i], a = state.answers[i], h = herd(q), v = herdVerdict(q, h, a.g);
  const t = tierFor(a.s), m = multiplier(q), last = i === today.questions.length - 1;
  render(`
    ${progress(i, true)}
    <section class="card reveal">
      <div class="chip-row"><span class="chip">${catIcon(q)} ${catLabel(q)}</span>${m > 1 ? `<span class="chip ghost">Double points</span>` : ""}</div>
      <p class="muted q-small">${q.q}</p>
      <div class="prize">
        ${rosette(t.key, a.s * m)}
        <div><div class="tier">${t.name}</div><div class="muted">${a.s * m} point${a.s * m === 1 ? "" : "s"}${m > 1 ? ` (${a.s} × ${m})` : ""}</div></div>
      </div>
      <div class="nums">
        <div class="num answer"><span class="k">Answer</span><span class="v">${withUnit(q, q.answer)}</span>${q.alt ? `<span class="s">${q.alt}</span>` : ""}</div>
        <div class="num"><span class="k">You</span><span class="v">${withUnit(q, a.g)}</span><span class="s">${offBy(q, a.g)}</span></div>
      </div>
      <div class="herd">
        <div class="herd-head"><h2>How the herd guessed</h2><span class="muted">${h.players.toLocaleString("en-GB")} players</span></div>
        ${histogram(q, h, a.g)}
        <div class="legend"><span><i style="background:var(--good)"></i>Answer</span><span><i style="background:var(--ink)"></i>You</span><span><i class="dash"></i>Herd's middle guess: ${withUnit(q, h.median)}</span></div>
        <p class="herd-line">${v.beat >= 50 ? `You beat <b>${v.beat}%</b> of the herd.` : `<b>${100 - v.beat}%</b> of the herd got closer than you.`} ${v.pulled ? "Your guess pulled the herd's middle closer to the answer. 🐂" : ""}</p>
      </div>
      <div class="fact"><p>${q.fact}</p>${q.source ? `<a href="${q.source.url}" target="_blank" rel="noopener">Source: ${q.source.name}</a>` : ""}</div>
      <button class="btn primary big" id="next">${last ? "See how you did" : "Next question"}</button>
    </section>`, q.cat);
  document.getElementById("next").onclick = () => {
    state.revealing = false;
    if (last) { state.done = true; save(); results(); } else { save(); ask(); }
  };
}

function results() {
  const qs = today.questions;
  const herdTotal = qs.reduce((acc, q) => acc + score(q, herd(q).median) * multiplier(q), 0);
  const you = total(), max = maxTotal();
  const grid = state.answers.map((a) => tierFor(a.s).short).join("");
  const share = `OxGuess · Round ${today.number} 🐂\n${grid}\n${you}/${max}\noxguess.com`;
  const herdLine = you > herdTotal ? `You beat the herd today. Its middle guesses scored ${herdTotal}.`
    : you === herdTotal ? `Dead level with the herd at ${herdTotal}.`
    : `The herd's middle guesses scored ${herdTotal}. It knows things.`;
  render(`
    <section class="card results">
      <div class="hero-ox">${oxHead({ size: 96, mood: you >= herdTotal ? "happy" : "wow" })}</div>
      <p class="eyebrow">Round ${today.number} · ${prettyDate(today.key)}</p>
      <div class="total"><span class="big-num">${you}</span><span class="muted">out of ${max}</span></div>
      <p class="herd-line center">${herdLine}</p>
      <ul class="rows">
        ${state.answers.map((a, i) => {
          const q = qs[i], m = multiplier(q);
          return `<li style="--cat:${CATS[q.cat].color}">${rosette(tierFor(a.s).key, a.s * m, 34)}<div class="row-q"><b>${catLabel(q)}</b><span>${q.q}</span><span class="muted">You ${withUnit(q, a.g)} · Answer ${withUnit(q, q.answer)}</span></div></li>`;
        }).join("")}
      </ul>
      <div class="share-grid" aria-label="Your prizes">${grid}</div>
      <div class="btn-row">
        <button class="btn primary big" id="share">Copy my result</button>
      </div>
      <p class="fine center" id="copied" hidden>Copied. Go on, show off.</p>
      <pre class="share-text" id="share-text" hidden>${share}</pre>
      <p class="center muted">New guesses in <b id="countdown"></b></p>
    </section>
    <section class="card soft key">
      <h2>The prizes</h2>
      <ul class="tiers">${TIERS.map((t) => `<li>${rosette(t.key, t.min === 100 ? "100" : t.min ? `${t.min}+` : "0+", 30)}<span>${t.name}</span></li>`).join("")}</ul>
    </section>`);
  document.getElementById("share").onclick = () => {
    const fallback = () => { document.getElementById("share-text").hidden = false; };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(share).then(() => { document.getElementById("copied").hidden = false; }, fallback);
    else fallback();
  };
  const tick = () => {
    const el = document.getElementById("countdown"); if (!el) return clearInterval(timer);
    const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const s = Math.max(0, Math.floor((next - now) / 1000));
    el.textContent = `${Math.floor(s / 3600)}h ${pad(Math.floor((s % 3600) / 60))}m`;
  };
  const timer = setInterval(tick, 30000); tick();
}

// ---------- boot ----------
async function boot() {
  try {
    ROUNDS = await (await fetch("data/rounds.json", { cache: "no-cache" })).json();
  } catch {
    app.innerHTML = `<main class="screen"><section class="card"><h1>The ox is having a lie-down</h1><p>Today's questions didn't load. Check your connection and refresh.</p></section></main>`;
    return;
  }
  load();
  if (!store.get("ox-seen-story") && !state.answers.length) story(); else home();
}
boot();
