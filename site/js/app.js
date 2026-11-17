import { oxHead, rosette, fairgoer, balance } from "./art.js";
import {
  STEPS, CATS, PER_QUESTION, catLabel, catIcon, rangeFor, toValue, toPos, score, points, tierFor, TIERS,
  withUnit, offBy, herd as makeHerd, herdVerdict, SEED_GUESSES,
  setSystem, getSystem, convertible, dispUnit, unitPair, toDisp, fromDisp, fmtDisp,
} from "./game.js";
import { loadHerds, recordGuess, recordPlay, recordPlayer } from "./herd-store.js";
import { sfx, buzz, wait, countUp, stampIn, pop, flash, bunting, sparkle, isMuted, setMuted, dropTicket } from "./fx.js";

const app = document.getElementById("app");
// The question bank (by id) and the schedule (date -> five ids). The first scheduled date is round 1.
let QUESTIONS = null, SCHEDULE = null, DATES = null, EPOCH = null;

// ---------- dates & storage ----------
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function todayKey() {
  const local = ["localhost", "127.0.0.1"].includes(location.hostname);
  const p = local ? new URLSearchParams(location.search).get("day") : null;
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
const playedOn = (k) => Boolean(store.get(dayStateKey(k))?.done);

// ---------- streaks ----------
function streak() {
  let k = todayKey(), n = 0;
  if (!playedOn(k)) k = shift(k, -1);
  while (playedOn(k)) { n++; k = shift(k, -1); }
  return n;
}
function bestStreak() {
  const days = [];
  try { for (let i = 0; i < localStorage.length; i++) { const m = localStorage.key(i).match(/^ox-day-(\d{4}-\d{2}-\d{2})$/); if (m && playedOn(m[1])) days.push(m[1]); } } catch { /* fine */ }
  days.sort();
  let best = 0, run = 0, prev = null;
  for (const d of days) { run = prev && shift(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return best;
}
/** Every finished day on this device, with its total, for the player record. */
function history() {
  const days = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const m = localStorage.key(i).match(/^ox-day-(\d{4}-\d{2}-\d{2})$/);
      const st = m && store.get(localStorage.key(i));
      if (!st?.done) continue;
      const qs = roundFor(m[1]).questions;
      const total = st.total ?? st.answers.reduce((a, ans, j) => a + (qs[j] ? points(qs[j], ans.g) : 0), 0);
      days.push({ day: m[1], total });
    }
  } catch { /* fine */ }
  return days.sort((a, b) => a.day.localeCompare(b.day));
}
function playerSummary() {
  const h = history();
  return {
    first: h[0]?.day ?? today.key, last: h.at(-1)?.day ?? today.key,
    rounds: h.length, points: h.reduce((a, d) => a + d.total, 0), best: Math.max(0, ...h.map((d) => d.total)),
    streak: streak(), bestStreak: bestStreak(),
  };
}

/** Monday to Sunday around a date. */
const weekOf = (k) => { const dow = (parseKey(k).getDay() + 6) % 7; return Array.from({ length: 7 }, (_, i) => shift(k, i - dow)); };

// ---------- today's round ----------
/** A date's five questions. Past the end of the schedule it starts again from the top. */
function roundFor(k) {
  const n = daysBetween(EPOCH, k);
  const ids = SCHEDULE[k] ?? SCHEDULE[DATES[((n % DATES.length) + DATES.length) % DATES.length]];
  return { number: n + 1, questions: ids.map((id) => QUESTIONS[id]) };
}
let today, state, herds = {}, herdsReady = Promise.resolve(), herdsAt = 0, sinceRead = [], screen = null;
function load() {
  const k = todayKey();
  today = { key: k, ...roundFor(k) };
  state = store.get(dayStateKey(k), { answers: [], done: false });
  // If today's questions have changed since this device played them (the schedule was edited), today starts
  // afresh, finished or not: old guesses can't be scored against new questions.
  const ids = today.questions.map((q) => q.id).join();
  if (state.answers.length && state.ids !== ids) {
    state = { answers: [], done: false };
    store.set(dayStateKey(k), state);
  }
  state.ids = ids;
  herds = {};
  fetchHerds();
}
/** Read today's herds. Guesses already sent are in the stored herd; guesses made while the read is out are
 *  added on top when it lands. A question whose read fails keeps what we had. */
function fetchHerds() {
  const day = today.key;
  sinceRead = []; herdsAt = Date.now();
  herdsReady = loadHerds(day, today.questions).then((fresh) => {
    if (day !== today.key) return;
    Object.assign(herds, fresh);
    for (const [q, bin] of sinceRead) if (fresh[q.id]) addLocal(q, bin);
  });
}
function addLocal(q, bin) {
  const h = (herds[q.id] ??= { n: 0, b: {} });
  h.n += 1; h.b[bin] = (h.b[bin] ?? 0) + 1;
}
/** After midnight a tab left open moves on to the new day, unless a round is half played. */
function newDay() {
  if (todayKey() === today.key || (state.answers.length && !state.done)) return false;
  load(); home(); return true;
}
// Coming back to an open tab: move on to a new day, or pick up the guesses the herd has made since.
document.addEventListener("visibilitychange", async () => {
  if (document.hidden || !today || newDay() || Date.now() - herdsAt < 60000) return;
  const count = () => today.questions.map((q) => herds[q.id]?.n ?? 0).join();
  const before = count();
  fetchHerds(); await herdsReady;
  if (screen === "results" && count() !== before) results();
});
const herd = (q) => makeHerd(q, herds[q.id], today.key);
/** Wait for today's herd, but never more than 1.5s: the game must not hang on the network. */
const settle = () => Promise.race([herdsReady, new Promise((r) => setTimeout(r, 1500))]);
const save = () => store.set(dayStateKey(today.key), state);
const MAX = () => today.questions.length * PER_QUESTION;
const ptsAt = (i) => points(today.questions[i], state.answers[i].g);
const total = () => state.answers.reduce((a, _, i) => a + ptsAt(i), 0);
const herdTotal = () => today.questions.reduce((a, q) => a + points(q, herd(q).median), 0);

// ---------- shell ----------
function header() {
  const s = streak();
  return `<header class="top">
    <button class="brand" data-go="home" aria-label="OxGuess home">${oxHead({ size: 40 })}<span>OxGuess</span></button>
    <div class="top-right">
      ${s ? `<span class="pill streak-pill" title="${s} day${s === 1 ? "" : "s"} in a row">🔥 ${s}</span>` : ""}
      <button class="icon-btn" id="mute" aria-label="${isMuted() ? "Turn sound on" : "Turn sound off"}">${isMuted() ? "🔇" : "🔊"}</button>
      <button class="link" data-go="story">The story</button>
    </div>
  </header>`;
}
function render(html, cat) {
  if (cat) { app.style.setProperty("--cat", CATS[cat].color); app.dataset.cat = cat; } else { app.style.removeProperty("--cat"); delete app.dataset.cat; }
  app.innerHTML = header() + `<main class="screen">${html}</main>`;
  app.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => go(b.dataset.go)));
  const m = document.getElementById("mute");
  m.onclick = () => { setMuted(!isMuted()); m.textContent = isMuted() ? "🔇" : "🔊"; m.ariaLabel = isMuted() ? "Turn sound on" : "Turn sound off"; if (!isMuted()) sfx.plink(); };
  window.scrollTo(0, 0);
}
async function go(where) {
  if (where === "home") return home();
  if (where === "story") return story(0);
  if (where === "play" && !state.done && !state.revealing) return ask();
  await settle();
  if (where === "play") return state.done ? results() : reveal(state.answers.length - 1);
  if (where === "results") return results();
}

// A judge's ink stamp with a tick in it.
const stampTick = (cls = "") => `<span class="stamp ${cls}" aria-hidden="true"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="3"/><path d="M12.5 20.5 l5 5 l10 -11" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;

// The week as a strip of fair tickets, stamped for each day played.
function weekTickets(k, { stampToday = false } = {}) {
  const letters = ["M", "T", "W", "T", "F", "S", "S"];
  return `<div class="tickets" aria-label="Your week">${weekOf(k).map((d, i) => {
    const played = playedOn(d), isToday = d === k, future = d > k, missed = !played && !future && !isToday;
    const cls = `ticket ${played ? "played" : missed ? "missed" : future ? "future" : "today"}${isToday ? " is-today" : ""}`;
    const mark = played ? stampTick(isToday && stampToday ? "pending" : "") : missed ? `<i class="miss-mark" aria-hidden="true"></i>` : isToday ? `<svg class="play-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M10 8 L16 12 L10 16 Z"/></svg>` : "";
    return isToday && !played
      ? `<button class="${cls}" data-go="play" aria-label="Play today's round"><b>${letters[i]}</b>${mark}</button>`
      : `<span class="${cls}" title="${prettyDate(d)}${missed ? ", missed" : ""}"><b>${letters[i]}</b>${mark}</span>`;
  }).join("")}</div>`;
}
function streakLine() {
  const s = streak(), best = bestStreak(), playedToday = playedOn(today.key);
  if (!s) return "Play today to start a streak.";
  if (!playedToday) return `🔥 ${s}-day streak. Play today to keep it going.`;
  const sub = best > s ? `Your best is ${best} days` : s > 1 ? "Your best yet" : "";
  return `<span class="streak-main">🔥 <b>${s}-day streak</b></span>${sub ? `<span class="streak-sub">${sub}</span>` : ""}`;
}
function countdown(el) {
  const tick = () => {
    if (!document.body.contains(el)) return clearInterval(t);
    if (newDay()) return clearInterval(t);
    const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const s = Math.max(0, Math.floor((next - now) / 1000));
    el.textContent = `${Math.floor(s / 3600)}h ${pad(Math.floor((s % 3600) / 60))}m`;
  };
  const t = setInterval(tick, 30000); tick();
}

// ---------- home ----------
function home() {
  screen = "home";
  const qs = today.questions, done = state.done, started = state.answers.length > 0;
  render(`
    <section class="hero card">
      <div class="hero-ox">${oxHead({ size: 104 })}</div>
      <p class="dayline"><span>${prettyDate(today.key)}</span><span class="round-badge">Round ${today.number}</span></p>
      <h1>${done ? "All five judged" : started ? "Carry on guessing" : "Five numbers. How close can you get?"}</h1>
      ${done
        ? `<div class="home-score"><span class="label">You scored</span><span class="score-line"><span class="big-num">${total()}</span><small>/${MAX()}</small></span></div>`
        : ""}
      <ol class="todays stagger">
        ${qs.map((q, i) => {
          const answered = i < state.answers.length;
          const p = answered ? ptsAt(i) : null;
          return `<li style="--cat:${CATS[q.cat].color}; --i:${i}" class="${answered ? "is-done" : ""}">
            <span class="dot">${catIcon(q)}</span><span>${catLabel(q)}</span>
            <span class="res">${answered ? `<span class="pts">${p}</span>${rosette(tierFor(p).key, "", 34)}` : `<span class="ring"></span>`}</span>
          </li>`;
        }).join("")}
      </ol>
      <button class="btn primary big" data-go="${done ? "results" : "play"}">${done ? "See today's results" : started ? "Carry on" : "Start guessing"}</button>
      ${done ? `<p class="next-round">New guesses in <b id="cd"></b></p>` : ""}
    </section>
    <section class="card week-card">
      <div class="week-head"><h2>Your week at the fair</h2></div>
      ${weekTickets(today.key)}
      <p class="streak-line">${streakLine()}</p>
    </section>
    <section class="card soft story-teaser">
      <img loading="lazy" class="scene-img teaser-img" src="img/fair-1906.webp" width="1672" height="941" alt="A crowd at a 1906 country fair leaning on a pen around a prize ox with a first-prize rosette, beside a sign reading Guess the weight, 6d a go">
      <div>
        <h2>Why an ox?</h2>
        <p>In 1906, nearly 800 people at a country fair guessed the weight of an ox. The middle guess was out by less than 1%.</p>
      </div>
      <button class="btn" data-go="story">Read the story</button>
    </section>
  `);
  const cd = document.getElementById("cd"); if (cd) countdown(cd);
}

// The story as a short tap-through: one idea per page, each with its own little moment.
const STORY_PAGES = 5;
function storyScale(withAnswer) {
  // 787 tickets, drawn as 70 dots: a loose bell around the middle, two lonely guesses around 1,000 lb and one
  // past 1,500. Seeded so everyone sees the same crowd.
  const R = (() => { let t = 1906; return () => ((t = (t * 16807) % 2147483647) / 2147483647); })();
  const lo = 940, hi = 1560, W = 300, x = (lb) => 10 + ((lb - lo) / (hi - lo)) * W;
  const guesses = [992, 1004, 1532, 1038, 1056, 1062, 1071, 1083, 1088, 1094, 1408, 1414, 1421, 1436, 1452, 1478];
  while (guesses.length < 76) {
    const g = 1207 + Math.sqrt(-2 * Math.log(R() + 1e-9)) * Math.cos(2 * Math.PI * R()) * 78;
    if (g > 1030 && g < 1470) guesses.push(g);
  }
  const cols = {};
  const dots = guesses.map((g) => {
    const c = Math.round((g - lo) / 20);
    const h = (cols[c] = (cols[c] ?? 0) + 1);
    return { cx: x(lo + c * 20), cy: 120 - h * 7.4 };
  });
  const ticks = [1000, 1100, 1200, 1300, 1400, 1500].map((lb) => `<line x1="${x(lb)}" x2="${x(lb)}" y1="124" y2="130" stroke="var(--muted)" stroke-width="1.5"/><text x="${x(lb)}" y="143" text-anchor="middle" font-size="11" font-weight="700" fill="var(--muted)" font-family="Nunito, sans-serif">${lb.toLocaleString("en-GB")}</text>`).join("");
  return `<svg class="story-scale" viewBox="0 0 320 150" role="img" aria-label="787 guesses at the ox's weight, spread from around 1,000 lb to over 1,500 lb">
    <line x1="10" x2="310" y1="124" y2="124" stroke="var(--ink)" stroke-width="2" stroke-linecap="round"/>${ticks}
    ${dots.map((d, k) => `<circle class="story-dot" style="--k:${k}" cx="${d.cx}" cy="${d.cy}" r="3.5" fill="var(--c-far)"/>`).join("")}
    ${withAnswer ? `
      <g class="story-mark crowd"><line x1="${x(1207)}" x2="${x(1207)}" y1="30" y2="124" stroke="var(--ox-dark)" stroke-width="2.5" stroke-dasharray="3 4"/>
        <svg x="${x(1207) + 4}" y="22" width="24" height="24" viewBox="0 0 120 120">${oxHead({ size: 120 }).replace(/^<svg[^>]*>|<\/svg>$/g, "")}</svg></g>
      <g class="story-mark truth"><line x1="${x(1198)}" x2="${x(1198)}" y1="4" y2="126" stroke="var(--good)" stroke-width="3" stroke-linecap="round"/><path d="M${x(1198) - 1.5} 4 l-14 6 l14 6 z" fill="var(--good)"/></g>` : ""}
  </svg>`;
}

function story(page = 0) {
  screen = "story";
  const cta = state.done ? "See today's results" : "Join the herd";
  const pages = [
    `<img class="scene-img" src="img/fair-1906.webp" width="1672" height="941" alt="A crowd at a 1906 country fair leaning on a pen around a prize ox with a first-prize rosette, beside a sign reading Guess the weight, 6d a go">
     <p class="eyebrow">Plymouth, England, 1906</p>
     <h1 class="story-title">A prize ox. A country fair. Sixpence a guess.</h1>
     <p class="story-text">${new Date().getFullYear() - 1906} years ago, the crowd had to guess what the ox weighed.</p>`,
    `<div class="story-box">${balance()}<div class="story-count"><span id="story-n">0</span><small>tickets</small></div></div>
     <h1 class="story-title">787 people had a go.</h1>
     <p class="story-text">Farmers and butchers, and plenty who'd never weighed anything bigger than a sack of flour.</p>`,
    `${storyScale(false)}
     <h1 class="story-title">The guesses were all over the place.</h1>
     <p class="story-text">Some said around 1,000 lb. Some said over 1,500. Nobody was sure.</p>`,
    `${storyScale(true)}
     <div class="story-vs"><div><small>${oxHead({ size: 16 })} The crowd's guess</small><b>1,207 lb</b></div><div class="truth"><small><i class="ans-flag"></i>The ox's weight</small><b>1,198 lb</b></div></div>
     <h1 class="story-title">Together, the crowd knew.</h1>
     <p class="story-text">The middle guess was just 9 lb out, less than 1% off the ox's real weight.</p>`,
    `<div class="story-bunting" aria-hidden="true">${Array.from({ length: 11 }, (_, k) => `<i style="--k:${k}; --c:${["var(--c-big)", "var(--c-when)", "var(--c-far)", "var(--tent-a)", "var(--c-many)"][k % 5]}; --y:${(Math.sin((k / 10) * Math.PI) * 14).toFixed(1)}px"></i>`).join("")}</div>
     <div class="story-hero">${oxHead({ size: 96 })}${fairgoer({ size: 56 })}</div>
     <h1 class="story-title">OxGuess is that fair, every day.</h1>
     <p class="story-text">Five numbers nobody knows off by heart. You'll be out on some. The herd, all of us guessing together, usually gets surprisingly close.</p>
`,
  ];
  const last = page === STORY_PAGES - 1;
  render(`
    <section class="card story" id="story">
      <div class="story-page" data-page="${page}">${pages[page]}</div>
      <div class="story-dots" aria-label="Page ${page + 1} of ${STORY_PAGES}">${pages.map((_, k) => `<i class="${k === page ? "on" : ""}"></i>`).join("")}</div>
      <div class="story-nav">
        ${page > 0 ? `<button class="btn" id="story-back">Back</button>` : `<button class="link" data-go="${state.done ? "results" : "home"}">Skip</button>`}
        <button class="btn primary big" id="story-next" ${last ? `data-go="${state.done ? "results" : "play"}"` : ""}>${last ? cta : "Next"}</button>
      </div>
    </section>`);
  store.set("ox-seen-story", true);
  const nextBtn = document.getElementById("story-next");
  if (!last) nextBtn.onclick = () => { sfx.tick(); story(page + 1); };
  const back = document.getElementById("story-back"); if (back) back.onclick = () => story(page - 1);
  // Swipe left and right between pages.
  const el = document.getElementById("story"); let x0 = null;
  el.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
  el.addEventListener("pointerup", (e) => {
    if (x0 == null) return; const dx = e.clientX - x0; x0 = null;
    if (dx < -50 && !last) story(page + 1); else if (dx > 50 && page > 0) story(page - 1);
  });
  // Each page's moment.
  if (page === 1) {
    const box = document.querySelector(".story-box");
    countUp(document.getElementById("story-n"), 787, 1600, { sound: true, format: (v) => v.toLocaleString("en-GB") }).then(() => pop(document.querySelector(".story-count"), 1.15));
    for (let k = 0; k < 9; k++) setTimeout(() => {
      if (!document.body.contains(box)) return;
      const t = document.createElement("span"); t.className = "story-ticket"; t.style.left = `${12 + Math.random() * 70}%`; box.appendChild(t);
      t.animate([{ transform: "translateY(-60px) rotate(-20deg)", opacity: 0 }, { transform: "translateY(0) rotate(8deg)", opacity: 1, offset: 0.6 }, { transform: "translateY(26px) rotate(0) scale(.5)", opacity: 0 }], { duration: 700, easing: "ease-in" }).onfinish = () => t.remove();
    }, k * 170);
  }
  if (page === 3) setTimeout(() => { sfx.chime(); pop(document.querySelector(".story-vs .truth"), 1.1); }, 1300);
}

// Five segments; the current question's segment opens into a pill naming its category.
function progress(i, revealed) {
  return `<div class="progress" aria-label="Question ${i + 1} of ${today.questions.length}">${today.questions.map((q, j) => {
    const state = j < i || (j === i && revealed) ? "done" : "";
    return j === i
      ? `<span class="current ${state}" style="--cat:${CATS[q.cat].color}">${catLabel(q)}</span>`
      : `<span class="${state}" style="--cat:${CATS[q.cat].color}"></span>`;
  }).join("")}</div>`;
}

// ---------- asking ----------
function ask() {
  screen = "ask";
  const i = state.answers.length, q = today.questions[i], r = rangeFor(q);
  let pos = Math.round(STEPS / 2), typed = null;
  render(`
    ${progress(i, false)}
    <section class="card ask enter">
      <h1 class="question">${q.q}</h1>
      <div class="readout">
        <input id="guess" inputmode="decimal" autocomplete="off" aria-label="Your guess">
        ${convertible(q)
          ? `<button class="unit-toggle" id="units" aria-label="Switch units">${unitPair(q).map((u, k) => `<span data-sys="${k ? "imperial" : "metric"}">${u}</span>`).join("")}</button>`
          : q.unit ? `<span class="unit">${q.unit}</span>` : ""}
      </div>
      <div class="tape">
        <input type="range" id="slider" min="0" max="${STEPS}" value="${pos}" aria-label="Guess slider">
        <div class="ticks" aria-hidden="true"></div>
        <div class="ends"><span id="end-min"></span><span id="end-max"></span></div>
      </div>
      <div class="nudge"><button class="btn round" id="down" aria-label="A bit lower">−</button><span class="hint">Drag, nudge or type</span><button class="btn round" id="up" aria-label="A bit higher">+</button></div>
      <button class="btn primary big" id="lock">Lock it in</button>
    </section>`, q.cat);

  const slider = document.getElementById("slider"), input = document.getElementById("guess");
  const current = () => (typed ?? toValue(q, r, pos));
  const fit = () => { input.style.width = `${Math.max(2, input.value.length + 0.6)}ch`; };
  const show = () => {
    input.value = fmtDisp(q, current()); slider.value = pos; fit();
    document.getElementById("end-min").textContent = withUnit(q, r.min);
    document.getElementById("end-max").textContent = withUnit(q, r.max);
    document.querySelectorAll("#units [data-sys]").forEach((el) => el.classList.toggle("on", el.dataset.sys === getSystem()));
  };
  show();
  const unitsBtn = document.getElementById("units");
  if (unitsBtn) unitsBtn.onclick = () => { setSystem(getSystem() === "metric" ? "imperial" : "metric"); store.set("ox-units", getSystem()); sfx.tick(); show(); };
  slider.oninput = () => { pos = +slider.value; typed = null; show(); sfx.tick(); buzz(3); };
  const nudge = (d) => {
    if (q.scale === "log") {
      // Step along until the shown number changes (several slider steps can round to the same figure).
      const shown = fmtDisp(q, current()); let t = toPos(q, r, current());
      do t += d; while (t > 0 && t < STEPS && fmtDisp(q, toValue(q, r, t)) === shown);
      pos = Math.max(0, Math.min(STEPS, t)); typed = null;
    } else {
      const step = q.scale === "year" || Number.isInteger(q.answer) || dispUnit(q) !== q.unit ? 1 : 0.1;
      const dv = Math.round((toDisp(q, current()) + d * step) * 10) / 10;
      typed = Math.max(r.min, Math.min(r.max, fromDisp(q, dv)));
      pos = toPos(q, r, typed);
    }
    show(); sfx.tick(); pop(input, 1.06);
  };
  // Tap to nudge once; hold to keep going, faster the longer you hold. Keyboard presses still click.
  const holdable = (btn, d) => {
    let timer = null;
    const stop = () => { clearTimeout(timer); timer = null; };
    const repeat = (ms) => { timer = setTimeout(() => { if (!btn.isConnected) return stop(); nudge(d); repeat(Math.max(30, Math.min(150, ms) * 0.9)); }, ms); };
    btn.onpointerdown = (e) => { if (e.button) return; btn.setPointerCapture(e.pointerId); nudge(d); stop(); repeat(380); };
    btn.onpointerup = btn.onpointercancel = btn.onlostpointercapture = stop;
    btn.oncontextmenu = (e) => e.preventDefault();
    btn.onclick = (e) => { if (e.detail === 0) nudge(d); };
  };
  holdable(document.getElementById("down"), -1);
  holdable(document.getElementById("up"), 1);
  input.oninput = () => {
    let raw = input.value.trim().replace(/,/g, "");
    const bc = /bc$/i.test(raw); raw = raw.replace(/\s*bc$/i, "").replace(/^ad\s*/i, "");
    let v = parseFloat(raw.replace(/[^\d.\-]/g, ""));
    if (!isNaN(v)) { if (bc) v = -v; typed = fromDisp(q, v); pos = toPos(q, r, Math.max(r.min, Math.min(r.max, typed))); slider.value = pos; }
    fit();
  };
  input.onfocus = () => input.select();
  input.onblur = () => { if (typed != null) { typed = Math.max(r.min, Math.min(r.max, typed)); show(); } };
  input.onkeydown = (e) => { if (e.key === "Enter") document.getElementById("lock").click(); };
  let locked = false;
  document.getElementById("lock").onclick = async () => {
    if (locked) return; locked = true;
    // Typed guesses are kept to the answer's precision: whole years, whole counts.
    const clamped = Math.max(r.min, Math.min(r.max, current()));
    const g = q.scale === "year" || Number.isInteger(q.answer) ? Math.round(clamped) : clamped;
    await settle();
    const ticketNo = SEED_GUESSES + (herds[q.id]?.n ?? 0) + 1;
    const bin = recordGuess(today.key, q, toPos(q, r, g), STEPS, g);
    addLocal(q, bin); sinceRead.push([q, bin]);
    state.answers.push({ g, s: score(q, g), bin, ticket: ticketNo });
    state.revealing = true;
    save();
    // Your guess becomes a numbered fair ticket and drops into the judges' box.
    document.querySelector(".ask").classList.add("submitting");
    await dropTicket(document.querySelector(".readout"), { number: ticketNo, value: withUnit(q, g) });
    // If they tapped away mid-drop, the reveal waits for them under "Carry on".
    if (screen === "ask") reveal(i, { animate: true });
  };
}

// ---------- the reveal ----------
/** A friendly name for where an answer came from: "Wikipedia", "Wikidata", or the site's own name. */
function sourceSite(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.endsWith("wikipedia.org")) return "Wikipedia";
    if (host.endsWith("wikidata.org")) return "Wikidata";
    return host;
  } catch { return "the source"; }
}
function histogram(q, h, g) {
  const r = rangeFor(q), B = 25, bins = new Array(B).fill(0);
  h.bins.forEach((c, k) => { bins[Math.floor((k * B) / h.bins.length)] += c; });
  const mx = Math.max(1, ...bins), W = 320, H = 110, bw = W / B, base = H - 8;
  const x = (v) => (toPos(q, r, v) / STEPS) * W;
  const bars = bins.map((c, i) => {
    const bh = (c / mx) * (H - 34);
    return `<rect class="bar" style="--i:${i}" x="${(i * bw + 1.5).toFixed(1)}" y="${(base - bh).toFixed(1)}" width="${(bw - 3).toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="var(--cat)" opacity=".28"/>`;
  }).join("");
  const ax = x(q.answer), gx = x(g), mx2 = x(h.median), top = 26;
  const icon = (cx, svg) => `<svg x="${(cx - 11).toFixed(1)}" y="${top - 23}" width="22" height="22" viewBox="0 0 120 120" overflow="visible">${svg.replace(/^<svg[^>]*>|<\/svg>$/g, "")}</svg>`;
  return `<svg viewBox="-12 0 ${W + 24} ${H + 4}" role="img" aria-label="How the herd guessed">
    ${bars}
    <line x1="0" x2="${W}" y1="${base}" y2="${base}" stroke="var(--line)" stroke-width="1.5"/>
    <line x1="${mx2}" x2="${mx2}" y1="${top}" y2="${base}" stroke="var(--ox-dark)" stroke-width="2" stroke-dasharray="3 3"/>
    ${icon(mx2, oxHead({ size: 120 }))}
    <line x1="${gx}" x2="${gx}" y1="${top}" y2="${base}" stroke="var(--ink)" stroke-width="2.5"/>
    ${icon(gx, fairgoer({ size: 120 }))}
    <line x1="${ax}" x2="${ax}" y1="${top - 18}" y2="${base}" stroke="var(--good)" stroke-width="3" stroke-linecap="round"/>
    <path d="M${ax + 1.5} ${top - 18} l11 4.5 l-11 4.5 z" fill="var(--good)"/>
  </svg>`;
}

// The fairground strength tester: the puck flies up to your points and rings the bell at 20.
function striker() {
  const marks = [0, 5, 10, 15, 20].map((p) => {
    const y = 132 - (p / PER_QUESTION) * 104;
    return `<line x1="30" x2="${p % 10 === 0 ? 40 : 36}" y1="${y}" y2="${y}" stroke="var(--ink)" stroke-width="1.5"/><text x="44" y="${y + 3.5}" font-size="10" font-weight="700" fill="var(--muted)" font-family="Nunito, sans-serif">${p}</text>`;
  }).join("");
  return `<svg class="striker" viewBox="0 0 64 150" aria-hidden="true">
    <rect x="8" y="140" width="40" height="8" rx="2" fill="var(--wood)" stroke="var(--ink)" stroke-width="1.5"/>
    <rect x="18" y="24" width="12" height="118" rx="3" fill="var(--card-soft)" stroke="var(--ink)" stroke-width="1.5"/>
    <rect id="fill" x="20" y="132" width="8" height="0" rx="2" fill="var(--cat)"/>
    ${marks}
    <g id="bell"><path d="M12 22 C12 8 36 8 36 22 Z" fill="var(--c-when)" stroke="var(--ink)" stroke-width="1.6" stroke-linejoin="round"/><circle cx="24" cy="23" r="2.4" fill="var(--ink)"/></g>
    <g id="puck"><rect x="15" y="128" width="18" height="9" rx="3" fill="var(--c-big)" stroke="var(--ink)" stroke-width="1.5"/></g>
  </svg>`;
}

function reveal(i, { animate = false } = {}) {
  screen = "reveal";
  const q = today.questions[i], a = state.answers[i], h = herd(q), r = rangeFor(q), v = herdVerdict(q, h, a.g);
  const p = points(q, a.g), them = points(q, h.median), t = tierFor(p), last = i === today.questions.length - 1;
  const gpos = toPos(q, r, a.g) / STEPS, apos = toPos(q, r, q.answer) / STEPS, hpos = toPos(q, r, h.median) / STEPS;
  // One line for the duel on this question: the herd's guess and who got closer.
  const duel = p > them ? `<b class="win">You beat the herd.</b>` : p === them ? `<b>Level with the herd.</b>` : `<b>The herd got closer.</b>`;
  const hide = animate ? "is-hidden" : "";
  render(`
    ${progress(i, true)}
    <section class="card reveal">
      <p class="muted q-small">${q.q}</p>
      <div class="rail-wrap" aria-hidden="true">
        <div class="rail"></div>
        <div class="span-bar ${hide}" id="span" style="left:${Math.min(gpos, apos) * 100}%; width:${Math.abs(apos - gpos) * 100}%"></div>
        <div class="herd-pin ${hide}" id="herd-pin" style="left:${hpos * 100}%"><i></i><span>${oxHead({ size: 22 })}</span></div>
        <div class="you-pin" style="left:${gpos * 100}%"><i></i><span>${fairgoer({ size: 22 })}</span></div>
        <div class="flag ${hide}" id="flag" style="left:${apos * 100}%"><span id="flag-num">${withUnit(q, q.answer)}</span><i></i></div>
      </div>
      <p class="off-line ${hide}" id="off">${offBy(q, a.g)}</p>
      <div class="judging">
        ${striker()}
        <div class="verdict">
          <div class="plus-row"><div class="plus"><span>+</span><span id="pts">${p}</span><small> / ${PER_QUESTION} points</small></div><span class="mini-rosette ${hide}" id="rosette" title="${t.name}">${rosette(t.key, p, 34)}</span></div>
          <p class="duel ${hide}" id="duel">${oxHead({ size: 26 })}<span>The herd said <b>${withUnit(q, h.median)}</b> (${them} pts). ${duel}</span></p>
        </div>
      </div>
    </section>
    <button class="btn primary big ${hide}" id="next">${last ? "See how you did" : "Next question"}</button>
    <section class="card later ${animate ? "" : "shown"}">
        <div class="fact"><p>${q.fact}</p>${q.source ? `<a class="source-chip" href="${q.source.url}" target="_blank" rel="noopener">Source: ${sourceSite(q.source.url)}</a>` : ""}</div>
        <div class="herd">
          <div class="herd-head"><h2>How the herd guessed</h2><span class="muted">${h.players.toLocaleString("en-GB")} guesses</span></div>
          ${histogram(q, h, a.g)}
          <div class="legend"><span><i style="background:var(--good)"></i>Answer ${withUnit(q, q.answer)}</span><span>${fairgoer({ size: 14 })} You ${withUnit(q, a.g)} · ${p} pts</span><span>${oxHead({ size: 14 })} Herd ${withUnit(q, h.median)} · ${them} pts</span></div>
          <p class="herd-beat">You beat <b>${v.beat}%</b> of the herd.</p>
        </div>
    </section>`, q.cat);

  const puck = document.getElementById("puck"), fill = document.getElementById("fill");
  const rise = -(p / PER_QUESTION) * 104;
  const setStriker = () => { puck.setAttribute("transform", `translate(0 ${rise})`); fill.setAttribute("y", 132 + rise); fill.setAttribute("height", -rise + 4); };
  document.getElementById("next").onclick = () => {
    state.revealing = false;
    if (last) {
      state.done = true; state.total = total(); save();
      recordPlay(today.key, today.number, today.questions.map((_, j) => ptsAt(j)));
      recordPlayer(playerSummary());
      results({ celebrate: true });
    } else { save(); ask(); }
  };
  if (!animate) { setStriker(); return; }

  (async () => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const $ = (id) => document.getElementById(id);
    const show = (id, scale = 1.08) => { const el = $(id); if (!el) return null; el.classList.remove("is-hidden"); pop(el, scale); return el; };
    $("pts").textContent = "0";

    // 1. Your guess sits on the line for a beat.
    await wait(350);

    // 2. The answer flag slides out from your guess to the real answer, the gap filling in behind it.
    const flag = $("flag"), num = $("flag-num"), span = $("span");
    if (!flag) return; // already moved on
    flag.classList.remove("is-hidden"); span.classList.remove("is-hidden");
    if (!reduce) {
      const travel = Math.round(450 + Math.abs(apos - gpos) * 1100);
      sfx.slide(travel);
      flag.animate([{ left: `${gpos * 100}%` }, { left: `${apos * 100}%` }], { duration: travel, easing: "cubic-bezier(.33,1,.68,1)" });
      span.animate([{ width: "0%", left: `${gpos * 100}%` }, { width: `${Math.abs(apos - gpos) * 100}%`, left: `${Math.min(gpos, apos) * 100}%` }], { duration: travel, easing: "cubic-bezier(.33,1,.68,1)" });
      const t0 = performance.now(), from = toPos(q, r, a.g), to = toPos(q, r, q.answer);
      await new Promise((done) => {
        const step = (now) => {
          const k = Math.min(1, (now - t0) / travel), e = 1 - (1 - k) ** 3;
          num.textContent = withUnit(q, k < 1 ? toValue(q, r, Math.round(from + (to - from) * e)) : q.answer);
          if (k < 1) requestAnimationFrame(step); else done();
        };
        requestAnimationFrame(step);
      });
    }
    pop(num, 1.2);
    show("off");
    await wait(300);

    // 3. The herd's ox walks from the answer to where the herd guessed, a soft tick on each step.
    const herdPin = show("herd-pin", 1.15);
    if (!herdPin) return;
    if (!reduce) {
      const walk = Math.round(350 + Math.abs(hpos - apos) * 900), steps = Math.max(2, Math.round(walk / 170));
      herdPin.animate([{ left: `${apos * 100}%` }, { left: `${hpos * 100}%` }], { duration: walk, easing: "cubic-bezier(.4,0,.3,1)" });
      herdPin.querySelector("span").animate([{ transform: "translateY(0)" }, { transform: "translateY(3px)" }, { transform: "translateY(0)" }], { duration: walk / steps, iterations: steps });
      for (let k = 0; k < steps; k++) { sfx.tick(); await wait(walk / steps); }
    }
    await wait(200);

    // 4. The strength tester: up goes the puck, the points count with it.
    const climb = 250 + p * 28;
    if (!puck.isConnected) return;
    if (!reduce && p > 0) {
      sfx.whoosh(climb);
      puck.animate([{ transform: "translateY(0)" }, { transform: `translateY(${rise}px)` }], { duration: climb, easing: "cubic-bezier(.2,.8,.3,1)", fill: "forwards" });
      fill.animate([{ y: 132, height: 4 }, { y: 132 + rise, height: -rise + 4 }], { duration: climb, easing: "cubic-bezier(.2,.8,.3,1)", fill: "forwards" });
    }
    await countUp($("pts"), p, climb, { sound: false });
    setStriker();
    const plus = document.querySelector(".plus");
    if (!plus) return;
    if (p === PER_QUESTION) {
      sfx.bell(); buzz([30, 40, 30, 40, 80]); flash();
      $("bell")?.animate([{ transform: "rotate(0)" }, { transform: "rotate(-14deg)" }, { transform: "rotate(12deg)" }, { transform: "rotate(-8deg)" }, { transform: "rotate(0)" }], { duration: 700 });
      const rect = document.querySelector(".striker").getBoundingClientRect();
      bunting({ x: rect.left + rect.width / 2, y: rect.top + 20 });
    } else if (p >= 17) { sfx.chime(); buzz([20, 30, 20]); sparkle(plus); }
    else if (p >= 8) { sfx.plink(); buzz(15); }
    else { sfx.wobble(); buzz(8); }
    pop(plus, 1.18);
    await wait(350);

    // 5. What the herd said, and who got closer.
    if (!show("duel", 1.06)) return;
    if (p > them) sfx.chime();
    await wait(450);

    // 6. The judges pin a rosette on it.
    const ros = $("rosette");
    if (!ros) return;
    ros.classList.remove("is-hidden");
    sfx.stamp(); buzz(12);
    ros.animate([{ transform: "scale(.3) rotate(-30deg)", opacity: 0 }, { transform: "scale(1.2) rotate(8deg)", opacity: 1 }, { transform: "none" }], { duration: 420, easing: "cubic-bezier(.3,1.5,.5,1)" });
    await wait(450);

    // 7. Then Next, with the fact and the herd underneath for anyone who scrolls.
    const later = document.querySelector(".later");
    if (!later) return;
    later.classList.add("shown");
    $("next")?.classList.remove("is-hidden");
  })();
}

// ---------- results ----------
// One question on one line: you above it, the herd below it, the answer as a green tick. Points sit on the left
// with who scored them; each guess sits centred on its own marker, hugging the edge near either end of the line.
function compare(q, g, herdGuess, yp, hp) {
  const r = rangeFor(q), at = (v) => toPos(q, r, v) / STEPS;
  const side = (x) => (x < 0.15 ? "start" : x > 0.85 ? "end" : "mid");
  const pin = (who, icon, v) => {
    const x = at(v), lab = `<span class="duo-lab">${icon}<b>${withUnit(q, v)}</b></span>`, post = `<span class="post">${who === "you" ? '<i class="stem"></i><i class="dot"></i>' : '<i class="dot"></i><i class="stem"></i>'}</span>`;
    return `<div class="duo-pin ${who} ${side(x)}" style="left:${x * 100}%">${who === "you" ? lab + post : post + lab}</div>`;
  };
  return `<div class="answer-pill"><i class="ans-flag"></i>Answer <b>${withUnit(q, q.answer)}</b></div>
    <div class="duo" aria-label="Answer ${withUnit(q, q.answer)}; you ${withUnit(q, g)}, ${yp} points; the herd ${withUnit(q, herdGuess)}, ${hp} points">
      <div class="duo-side"><span class="you">You<b>${yp}<small> pts</small></b></span><span class="herd">Herd<b>${hp}<small> pts</small></b></span></div>
      <div class="duo-track">
        <div class="duo-line"></div><i class="duo-ans" style="left:${at(q.answer) * 100}%"></i>
        ${pin("you", fairgoer({ size: 20 }), g)}
        ${pin("herd", oxHead({ size: 20 }), herdGuess)}
      </div>
    </div>`;
}

function results({ celebrate = false } = {}) {
  screen = "results";
  const qs = today.questions, you = total(), herdScore = herdTotal(), max = MAX();
  const grid = state.answers.map((_, i) => tierFor(ptsAt(i)).short).join("");
  const s = streak();
  const beat = you > herdScore, level = you === herdScore;
  // A blank line after the title and before the link, so it reads cleanly in a chat.
  const share = `OxGuess · Round ${today.number} 🐂\n\n${grid} ${you}/${max}${s > 1 ? `\n🔥 ${s}-day streak` : ""}\n\noxguess.com`;
  const headline = beat ? "You beat the herd!" : level ? "Dead level with the herd" : "The herd wins today";
  const sub = beat ? "Smarter than the crowd. Don't let it go to your head." : level ? "Great minds, and all that." : "It knows things. Tomorrow's another fair.";
  render(`
    <section class="card results">
      <div class="ribbon-wrap"><div class="ribbon ${beat ? "win" : ""} ${celebrate ? "is-hidden" : ""}" id="ribbon">${headline}</div></div>
      <div class="versus">
        <div class="side you">${fairgoer({ size: 46 })}<span class="score-line"><span class="big-num" id="you-n">${celebrate ? 0 : you}</span><small>/${max}</small></span><span class="who">You</span></div>
        <span class="vs">vs</span>
        <div class="side">${oxHead({ size: 46 })}<span class="score-line"><span class="big-num" id="herd-n">${celebrate ? 0 : herdScore}</span><small>/${max}</small></span><span class="who">The herd</span></div>
      </div>
      <p class="results-sub">${sub}</p>
      <div class="complete" id="complete">
        ${stampTick(`big ${celebrate ? "pending" : ""}`)}
        <div><p class="complete-title">Round ${today.number} complete</p><p class="streak-line">${streakLine()}</p></div>
      </div>
      ${weekTickets(today.key, { stampToday: celebrate })}
      <div class="my-rosettes" aria-label="Your prizes">${state.answers.map((a, i) => {
        const q = qs[i], yp = ptsAt(i);
        return `<div class="my-rosette ${celebrate ? "pending" : ""}">${rosette(tierFor(yp).key, yp, 42)}<span>${catLabel(q)}</span></div>`;
      }).join("")}</div>
      <button class="btn primary big" id="share">Share my rosettes</button>
      <p class="fine center" id="copied" hidden>Copied. Go on, show off.</p>
      <pre class="share-text" id="share-text" hidden>${share}</pre>
      <p class="center muted">New guesses in <b id="cd"></b></p>
    </section>
    <section class="card">
      <h2>Question by question</h2>
      <ul class="rows">
        ${state.answers.map((a, i) => {
          const q = qs[i], hm = herd(q).median, yp = ptsAt(i), hp = points(q, hm);
          return `<li style="--cat:${CATS[q.cat].color}">
            <div class="row-top">${rosette(tierFor(yp).key, yp, 30)}<div class="row-q"><b>${catLabel(q)}</b><span>${q.q}</span></div></div>
            ${compare(q, a.g, hm, yp, hp)}
          </li>`;
        }).join("")}
      </ul>
    </section>
    <section class="card soft key">
      <h2>The prizes</h2>
      <ul class="tiers">${TIERS.map((t) => `<li>${rosette(t.key, t.min === PER_QUESTION ? PER_QUESTION : `${t.min}+`, 30)}<span>${t.name}</span></li>`).join("")}</ul>
    </section>`);
  countdown(document.getElementById("cd"));
  document.getElementById("share").onclick = () => {
    const fallback = () => { document.getElementById("share-text").hidden = false; };
    if (navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent)) { navigator.share({ text: share }).catch(() => {}); return; }
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(share).then(() => { document.getElementById("copied").hidden = false; sfx.plink(); }, fallback);
    else fallback();
  };
  if (!celebrate) return;

  (async () => {
    await wait(250);
    await countUp(document.getElementById("you-n"), you, 900);
    pop(document.getElementById("you-n"), 1.15);
    await wait(250);
    await countUp(document.getElementById("herd-n"), herdScore, 700);
    await wait(200);
    const ribbon = document.getElementById("ribbon");
    ribbon.classList.remove("is-hidden");
    ribbon.animate([{ transform: "scaleX(.2)", opacity: 0 }, { transform: "scaleX(1.05)", opacity: 1 }, { transform: "scaleX(1)" }], { duration: 450, easing: "cubic-bezier(.3,1.4,.5,1)" });
    if (beat || you >= 80) { sfx.fanfare(); buzz([40, 60, 40, 60, 120]); bunting({ y: window.innerHeight * 0.45, count: 70, power: 1.2 }); }
    else { sfx.chime(); }
    await wait(350);
    for (const t of document.querySelectorAll(".my-rosette")) {
      t.classList.remove("pending");
      t.animate([{ transform: "scale(.3) rotate(-25deg)", opacity: 0 }, { transform: "scale(1.12) rotate(4deg)", opacity: 1 }, { transform: "none" }], { duration: 380, easing: "cubic-bezier(.3,1.5,.5,1)" });
      sfx.tick(); await wait(120);
    }
    await wait(300);
    stampIn(document.querySelector(".complete .stamp"));
    await wait(350);
    const t = document.querySelector(".ticket.is-today .stamp");
    if (t) { stampIn(t); buzz(20); }
  })();
}

// ---------- boot ----------
async function boot() {
  try {
    const json = async (f) => (await fetch(f, { cache: "no-cache" })).json();
    const [bank, schedule] = await Promise.all([json("data/questions.json"), json("data/schedule.json")]);
    QUESTIONS = Object.fromEntries(bank.questions.map((q) => [q.id, q]));
    SCHEDULE = schedule.days; DATES = Object.keys(SCHEDULE).sort(); EPOCH = DATES[0];
  } catch {
    app.innerHTML = `<main class="screen"><section class="card"><h1>The ox is having a lie-down</h1><p>Today's questions didn't load. Check your connection and refresh.</p></section></main>`;
    return;
  }
  const savedUnits = store.get("ox-units");
  setSystem(savedUnits ?? (/^en-(US|LR|MM)$/i.test(navigator.language) ? "imperial" : "metric"));
  load();
  if (!store.get("ox-seen-story") && !state.answers.length) story(0); else home();
}
boot();
