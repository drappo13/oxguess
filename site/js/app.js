import { oxHead, rosette, fairgoer, balance, herdChart, scoreChart, chalkboard } from "./art.js";
import {
  STEPS, CATS, PER_QUESTION, catLabel, catIcon, armFor, sliderFor, toValue, toPos, score, points, tierFor, TIERS,
  withUnit, offBy, herd as makeHerd, herdVerdict, SEED_GUESSES,
  setSystem, getSystem, convertible, dispUnit, unitPair, toDisp, fromDisp, fmtDisp,
} from "./game.js";
import { loadHerds, loadScores, recordGuess, recordPlay, recordPlayer, playerId, testing } from "./herd-store.js";
import { sfx, buzz, wait, countUp, stampIn, pop, flash, bunting, sparkle, isMuted, setMuted, dropTicket, flyTo, chalkUp } from "./fx.js";

const app = document.getElementById("app");
// The question bank (by id) and the schedule (date -> five ids). The first scheduled date is round 1.
let QUESTIONS = null, SCHEDULE = null, DATES = null, EPOCH = null;

// ---------- dates & storage ----------
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function todayKey() {
  const p = testing ? new URLSearchParams(location.search).get("day") : null;
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
/** Every Best in show (a question scored 20) on this device, ever. */
function bestInShows() {
  let n = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const m = localStorage.key(i).match(/^ox-day-(\d{4}-\d{2}-\d{2})$/), st = m && store.get(localStorage.key(i));
      if (!st?.answers) continue;
      const qs = roundFor(m[1]).questions;
      n += st.answers.filter((a, j) => qs[j] && points(qs[j], a.g) === PER_QUESTION).length;
    }
  } catch { /* fine */ }
  return n;
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
    // Whether they took the ox for their home screen, or said no thanks.
    ...(["home", "no"].includes(store.get("ox-keep")) ? { kept: store.get("ox-keep") } : {}),
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
 *  added on top when it lands. A question whose read fails keeps what we had, and the read is tried again (a slow or
 *  dropped connection must not leave a player looking at the starter guesses all day). When the real herd lands
 *  after the day screen is up, the day screen is drawn again with it. */
function fetchHerds(attempt = 0) {
  const day = today.key;
  if (!attempt) { sinceRead = []; herdsAt = Date.now(); }
  const before = herdTotalNow();
  herdsReady = loadHerds(day, today.questions).then((fresh) => {
    if (day !== today.key) return;
    Object.assign(herds, fresh);
    for (const [q, bin] of sinceRead) if (fresh[q.id]) addLocal(q, bin);
    sinceRead = sinceRead.filter(([q]) => !fresh[q.id]);
    const missing = today.questions.some((q) => !fresh[q.id]);
    if (missing && attempt < 3) setTimeout(() => { if (day === today.key) fetchHerds(attempt + 1); }, 2000 * (attempt + 1));
    if (screen === "home" && state.done && herdTotalNow() !== before) redrawDay();
  });
}
const herdTotalNow = () => (today ? today.questions.map((q) => herds[q.id]?.n ?? 0).join() : "");
/** Draw the day screen again with the latest herd, once any celebration on it has finished. */
function redrawDay() {
  if (celebrating) { redrawPending = true; return; }
  const y = window.scrollY, open = [...document.querySelectorAll(".qbq")].map((d) => d.open);
  home();
  document.querySelectorAll(".qbq").forEach((d, i) => { d.open = open[i] ?? false; });
  window.scrollTo(0, y);
}
let celebrating = false, redrawPending = false;
function addLocal(q, bin) {
  const h = (herds[q.id] ??= { n: 0, b: {} });
  h.n += 1; h.b[bin] = (h.b[bin] ?? 0) + 1;
}
/** After midnight a tab left open moves on to the new day, unless a round is half played. */
function newDay() {
  if (todayKey() === today.key || (state.answers.length && !state.done)) return false;
  if (document.hidden) document.title = "New round ready! OxGuess"; // a tab left open says so, until you look
  load(); home(); return true;
}
// Coming back to an open tab: move on to a new day, or pick up the guesses the herd has made since.
document.addEventListener("visibilitychange", async () => {
  if (!document.hidden) document.title = "OxGuess";
  if (document.hidden || !today || newDay() || Date.now() - herdsAt < 60000) return;
  fetchHerds();
});
const herd = (q) => makeHerd(q, herds[q.id], today.key);
/** The slider this player gets for question i (A or B in the slider test), kept with the guess once made.
 *  A guess saved without one was made before the test, on slider A. */
const armAt = (i) => (state.answers[i] ? state.answers[i].arm ?? "A" : armFor(today.questions[i], playerId(), today.key));
const sliderAt = (i) => sliderFor(today.questions[i], armAt(i));
/** Wait for today's herd, but never more than 1.5s: the game must not hang on the network. */
const settle = () => Promise.race([herdsReady, new Promise((r) => setTimeout(r, 1500))]);
const save = () => store.set(dayStateKey(today.key), state);
const MAX = () => today.questions.length * PER_QUESTION;
const ptsAt = (i) => points(today.questions[i], state.answers[i].g);
const total = () => state.answers.reduce((a, _, i) => a + ptsAt(i), 0);
/** How many good guesses (13+) in a row before question i: each one chimes a tone higher. */
const goodRun = (i) => { let n = 0; for (let j = i - 1; j >= 0 && ptsAt(j) >= 13; j--) n++; return n; };
const herdTotal = () => today.questions.reduce((a, q) => a + points(q, herd(q).median), 0);

// ---------- shell ----------
// The menu (top right) holds the story, the prizes and the sound switch.
function header() {
  const s = streak(), bis = bestInShows();
  return `<header class="top">
    <button class="brand" id="brand" aria-label="OxGuess home">${oxHead({ size: 40 })}<span>OxGuess</span></button>
    <div class="top-right">
      ${bis ? `<span class="pill bis-pill" id="bis-pill" title="${bis} Best in show${bis === 1 ? "" : "s"}, all time">${rosette("best", "", 20)}<b>${bis}</b></span>` : ""}
      ${s ? `<span class="pill streak-pill" title="${s} day${s === 1 ? "" : "s"} in a row">🔥 ${s}</span>` : ""}
      <div class="menu-wrap">
        <button class="icon-btn menu-btn" id="menu-btn" aria-label="Menu" aria-expanded="false" aria-controls="menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
        <div class="menu" id="menu" hidden>
          <button data-go="story"><span class="mi">${oxHead({ size: 30 })}</span>The story</button>
          <button id="prizes-open"><span class="mi">${rosette("first", "", 24)}</span>The prizes</button>
          <button id="mute" role="switch" aria-checked="${!isMuted()}"><span class="mi speaker" aria-hidden="true">${SPEAKER}</span>Sound<span class="switch" aria-hidden="true"><i></i></span></button>
        </div>
      </div>
    </div>
  </header>
  <dialog class="sheet" id="prizes" aria-labelledby="prizes-title">
    <h2 id="prizes-title">The prizes</h2>
    <p class="muted">Up to ${PER_QUESTION} points a question, ${PER_QUESTION * 5} a round. The closer you get, the better the rosette.</p>
    <ul class="tiers">${TIERS.map((t) => `<li>${rosette(t.key, t.min === PER_QUESTION ? PER_QUESTION : `${t.min}+`, 30)}<span>${t.name}</span></li>`).join("")}</ul>
    <button class="btn" id="prizes-close">Close</button>
  </dialog>`;
}
// A string of fair bunting: n flags in the category colours, sagging in the middle.
const flags = (n, sag) => Array.from({ length: n }, (_, k) => `<i style="--k:${k}; --c:${["var(--c-big)", "var(--c-when)", "var(--c-far)", "var(--tent-a)", "var(--c-many)"][k % 5]}; --y:${(Math.sin((k / (n - 1)) * Math.PI) * sag).toFixed(1)}px"></i>`).join("");
const SPEAKER = `<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path class="wave" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/><path class="cross" d="M16 9.5l5 5M21 9.5l-5 5"/></svg>`;
function menu(open) {
  const m = document.getElementById("menu"), b = document.getElementById("menu-btn");
  if (!m) return;
  m.hidden = !open; b.setAttribute("aria-expanded", String(open));
}
document.addEventListener("click", (e) => { if (!e.target.closest?.(".menu-wrap")) menu(false); });
// iOS Safari only shows :active (the button sinking, the slider knob squishing) once the page listens for touches.
document.addEventListener("touchstart", () => {}, { passive: true });
// The main buttons give a soft wooden tap as they go down.
document.addEventListener("pointerdown", (e) => { if (e.button === 0 && e.target.closest?.(".btn.primary:not(:disabled)")) { sfx.press(); buzz(6); } });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") menu(false); });
let lastMoo = 0, lastHeader = "";
// A new screen. The header is only drawn again when it has changed (a new streak, say), so it stays still while the
// screens beneath it move.
function render(html, cat) {
  if (cat) { app.style.setProperty("--cat", CATS[cat].color); app.dataset.cat = cat; } else { app.style.removeProperty("--cat"); delete app.dataset.cat; }
  const head = header(), main = app.querySelector("main.screen");
  window.scrollTo(0, 0);
  if (main && head === lastHeader) {
    main.outerHTML = `<main class="screen">${html}</main>`;
    app.querySelectorAll("main [data-go]").forEach((b) => (b.onclick = () => go(b.dataset.go)));
    return;
  }
  lastHeader = head;
  app.innerHTML = head + `<main class="screen">${html}</main>`;
  app.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => go(b.dataset.go)));
  document.getElementById("menu-btn").onclick = () => menu(document.getElementById("menu").hidden);
  // The ox in the header moos when tapped (and takes you home from anywhere else).
  document.getElementById("brand").onclick = () => {
    const ox = document.querySelector("#brand .ox"), now = Date.now();
    if (now - lastMoo > 1500) {
      lastMoo = now; sfx.moo(); buzz(10);
      if (!reducedMotion()) ox?.animate([{ transform: "rotate(0)" }, { transform: "rotate(-6deg)" }, { transform: "rotate(6deg)" }, { transform: "rotate(-3deg)" }, { transform: "rotate(0)" }], { duration: 500, easing: "ease-in-out" });
    }
    if (screen !== "home") setTimeout(() => go("home"), 180);
  };
  const m = document.getElementById("mute"), prizes = document.getElementById("prizes");
  m.onclick = () => { setMuted(!isMuted()); m.setAttribute("aria-checked", String(!isMuted())); if (!isMuted()) sfx.plink(); };
  document.getElementById("prizes-open").onclick = () => { menu(false); prizes.showModal(); };
  document.getElementById("prizes-close").onclick = () => prizes.close();
  prizes.onclick = (e) => { if (e.target === prizes) prizes.close(); }; // a tap outside the sheet closes it
}
async function go(where) {
  if (where === "home") return home();
  if (where === "story") return story(0);
  if (where === "play" && !state.done && !state.revealing) return ask();
  await settle();
  if (where === "play") return state.done ? home() : reveal(state.answers.length - 1);
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
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    el.querySelector("[data-h]").textContent = pad(h); el.querySelector("[data-m]").textContent = pad(m);
    el.setAttribute("aria-label", `New round in ${h} hour${h === 1 ? "" : "s"} and ${m} minute${m === 1 ? "" : "s"}`);
  };
  const t = setInterval(tick, 30000); tick();
}

// ---------- the day ----------
// One screen for the day. Before playing: yesterday's results on a chalkboard, today's five and a start button, the
// week, then yesterday in full (folded). After: you against the herd (share, and on your first rounds the ox for your
// home screen), question by question (folded), back tomorrow (countdown and the week), your stats, then yesterday.
function home({ celebrate = false } = {}) {
  screen = "home";
  render(state.done
    ? `${verdict(celebrate)}<section class="card">${questionByQuestion(todayRows())}</section>${tomorrow(celebrate)}${yourStats()}${yesterdaySlot()}`
    : `${slateSlot()}${startCard()}${weekCard()}${yesterdaySlot()}`);
  const cd = document.getElementById("cd"); if (cd) countdown(cd);
  fillYesterday();
  if (state.done) { fillTally(); wireShare(); wireKeep(); }
  if (celebrate) celebrateRound(); else if (state.done) showKeep();
}

function startCard() {
  const started = state.answers.length > 0;
  return `<section class="hero card">
      <div class="hero-ox">${oxHead({ size: 104 })}</div>
      <p class="dayline"><span>${prettyDate(today.key)}</span><span class="round-badge">Round ${today.number}</span></p>
      <h1>${started ? "Carry on guessing" : "Five numbers. How close can you get?"}</h1>
      <ol class="todays stagger">
        ${today.questions.map((q, i) => {
          const answered = i < state.answers.length, p = answered ? ptsAt(i) : null;
          return `<li style="--cat:${CATS[q.cat].color}; --i:${i}" class="${answered ? "is-done" : ""}">
            <span class="dot">${catIcon(q)}</span><span>${catLabel(q)}</span>
            <span class="res">${answered ? `<span class="pts">${p}</span>${rosette(tierFor(p).key, "", 34)}` : `<span class="ring"></span>`}</span>
          </li>`;
        }).join("")}
      </ol>
      <button class="btn primary big" data-go="play">${started ? "Carry on" : "Start guessing"}</button>
    </section>`;
}
function weekCard() {
  return `<section class="card week-card">
      <h2>Your week at the fair</h2>
      ${weekTickets(today.key)}
      <p class="streak-line">${streakLine()}</p>
    </section>`;
}

// 1 and 3: you against the herd, then share.
function verdict(celebrate) {
  const you = total(), herdScore = herdTotal(), max = MAX(), beat = you > herdScore, level = you === herdScore;
  const headline = beat ? "You beat the herd!" : level ? "Dead level with the herd" : "The herd wins today";
  const sub = beat ? "Smarter than the crowd. Don't let it go to your head." : level ? "Great minds, and all that." : "It knows things. Tomorrow's another fair.";
  const moment = roundMoment(you, beat);
  return `<section class="card results">
      <p class="dayline"><span>${prettyDate(today.key)}</span><span class="round-badge">Round ${today.number}</span></p>
      <div class="ribbon-wrap"><div class="ribbon ${beat ? "win" : ""} ${celebrate ? "is-hidden" : ""}" id="ribbon">${headline}</div></div>
      <div class="versus">
        <div class="side you">${fairgoer({ size: 46 })}<span class="score-line"><span class="big-num" id="you-n">${celebrate ? 0 : you}</span><small>/${max}</small></span><span class="who">You</span>
</div>
        <span class="vs">vs</span>
        <div class="side">${oxHead({ size: 46, mood: beat ? "wow" : "happy" })}<span class="score-line"><span class="big-num" id="herd-n">${celebrate ? 0 : herdScore}</span><small>/${max}</small></span><span class="who">The herd</span></div>
      </div>
      ${moment.pb ? `<div class="pb-row"><span class="pb-badge" id="pb" ${celebrate ? "hidden" : ""}>${rosette("first", "", 22)}Personal best</span></div>` : ""}
      <p class="results-sub">${sub}</p>
      ${moment.note ? `<div class="moment-wrap"><span class="moment ${moment.note.kind}" id="note" ${celebrate ? "hidden" : ""}>${moment.note.icon}<span><b>${moment.note.title}</b><small>${moment.note.sub}</small></span></span></div>` : ""}
      <div class="my-rosettes" aria-label="Your prizes">${state.answers.map((a, i) => {
        const yp = ptsAt(i);
        return `<span class="my-rosette ${celebrate ? "pending" : ""}">${rosette(tierFor(yp).key, yp, 42)}<span>${catLabel(today.questions[i])}</span></span>`;
      }).join("")}</div>
      <button class="btn primary big" id="share">Share my rosettes</button>
      <p class="fine center" id="copied" hidden>Copied. Go on, show off.</p>
      <pre class="share-text" id="share-text" hidden>${shareText()}</pre>
      ${keepTicket()}
    </section>`;
}
/** At most one special moment a round: a personal best, else a first Best in show, else beating the herd first go. */
function roundMoment(you, beat) {
  const before = history().filter((d) => d.day !== today.key);
  if (before.length && you > Math.max(...before.map((d) => d.total))) return { pb: true };
  const firstBest = state.answers.some((_, i) => ptsAt(i) === PER_QUESTION) && !before.some(({ day }) => {
    const st = store.get(dayStateKey(day)), qs = roundFor(day).questions;
    return st.answers.some((a, j) => qs[j] && points(qs[j], a.g) === PER_QUESTION);
  });
  if (firstBest) return { note: { kind: "best", icon: rosette("best", "", 34), title: "Your first Best in show", sub: "The judges are impressed." } };
  if (!before.length && beat) return { note: { kind: "first", icon: oxHead({ size: 34, mood: "wow" }), title: "Beat the herd first go", sub: "Beginner's luck?" } };
  return {};
}
/** A day's finished-round totals, kept on this device: a past day's for good (they're final), today's for five minutes.
 *  Every view would otherwise read every one of the day's plays. */
async function scoresFor(day) {
  const key = `ox-scores-${day}`, kept = store.get(key);
  if (kept && (day < today.key || Date.now() - kept.at < 5 * 60 * 1000)) return kept.scores;
  const scores = await loadScores(day);
  if (scores.length) {
    store.set(key, { at: Date.now(), scores });
    try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (/^ox-scores-/.test(k) && k < `ox-scores-${shift(today.key, -1)}`) localStorage.removeItem(k); } } catch { /* fine */ }
  }
  return scores;
}
/** In the top half: your placing. Otherwise nobody needs telling they came 93rd. */
const topHalf = (place, n) => n > 1 && place <= Math.ceil(n / 2);
function shareText() {
  const grid = state.answers.map((_, i) => tierFor(ptsAt(i)).short).join(""), s = streak(), d = total() - herdTotal();
  const herdLine = d > 0 ? `Beat the herd by ${d} 🐂` : d < 0 ? `Herd: ${herdTotal()} 🐂` : "Level with the herd 🐂";
  // A blank line after the title and before the link, so it reads cleanly in a chat.
  return `OxGuess Round ${today.number} 🐂\n\n${grid} ${total()}/${MAX()}\n${herdLine}${s > 1 ? `\n🔥 ${s}-day streak` : ""}\n\noxguess.com`;
}
function wireShare() {
  const share = shareText();
  document.getElementById("share").onclick = () => {
    const fallback = () => { document.getElementById("share-text").hidden = false; };
    if (navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent)) { navigator.share({ text: share }).catch(() => {}); return; }
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(share).then(() => { document.getElementById("copied").hidden = false; sfx.plink(); }, fallback);
    else fallback();
  };
}

// ---------- the ox on your home screen ----------
// On your first two rounds, an "admit one" ticket offers to put OxGuess on your home screen. Taking it, or "Not for me",
// and it never shows again. On iPhone a home-screen app keeps its own storage, apart from Safari's, so it would open as a
// brand-new player: taking the ticket puts this device's progress in the page's address, which is what the home screen
// saves, and the home-screen app takes it in the first time it opens (importCarried, at boot).
const standalone = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
let installPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; });
// On hold (21 Nov): switched off until we come back to it.
const SHOW_HOME_SCREEN = false;
function keepTicket() {
  if (!SHOW_HOME_SCREEN || store.get("ox-keep") || history().length > 2 || standalone()) return "";
  return `<div class="keep" id="keep" hidden>
      <div class="keep-ticket">
        <span class="keep-admit">Admit one · every day</span>
        <h3>Keep the ox on your home screen</h3>
        <p>One tap to tomorrow's five. Your streak comes too.</p>
        <div class="keep-stubs"><button class="stub-btn" id="keep-home">Add to Home Screen</button></div>
        <p class="keep-how" id="keep-how" hidden></p>
      </div>
      <button class="link" id="keep-no">Not for me</button>
    </div>`;
}
function wireKeep() {
  const keep = document.getElementById("keep");
  if (!keep) return;
  const done = (choice) => { store.set("ox-keep", choice); recordPlayer(playerSummary()); };
  document.getElementById("keep-home").onclick = () => {
    done("home"); carryOver(); sfx.pin(); buzz(10);
    if (installPrompt) { installPrompt.prompt(); installPrompt = null; return; }
    const how = document.getElementById("keep-how");
    how.textContent = /iPhone|iPad/i.test(navigator.userAgent) ? "Tap the Share button, then Add to Home Screen." : "Open your browser's menu, then Add to Home Screen (or Install).";
    how.hidden = false; pop(how, 1.05);
  };
  document.getElementById("keep-no").onclick = () => {
    done("no");
    if (reducedMotion()) { keep.remove(); return; }
    keep.animate([{ opacity: 1, maxHeight: `${keep.offsetHeight}px` }, { opacity: 0, maxHeight: "0px" }], { duration: 260, easing: "ease-in" }).onfinish = () => keep.remove();
  };
}
function showKeep() {
  const keep = document.getElementById("keep");
  if (!keep || !keep.hidden) return;
  keep.hidden = false;
  if (!reducedMotion()) keep.querySelector(".keep-ticket").animate([{ transform: "translateY(-14px)", clipPath: "inset(0 0 100% 0)" }, { transform: "none", clipPath: "inset(0 0 0 0)" }], { duration: 360, easing: "cubic-bezier(.2,.9,.3,1.1)" });
}
/** This device's progress (every ox- setting but the throwaway caches), packed into the address as ?carry=. */
function carryOver() {
  const kept = {};
  try {
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^ox-/.test(k) && !/^ox-(scores-|review)/.test(k)) kept[k] = localStorage.getItem(k); }
    const packed = btoa(unescape(encodeURIComponent(JSON.stringify(kept)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    window.history.replaceState(null, "", `/?carry=${packed}`); // window.: history() here is your past rounds
  } catch { /* fine: the home screen just starts afresh */ }
}
/** The first time the home-screen app opens, take in the progress it was saved with, without overwriting anything. */
function importCarried() {
  const packed = new URLSearchParams(location.search).get("carry");
  if (!packed) return;
  try {
    const kept = JSON.parse(decodeURIComponent(escape(atob(packed.replace(/-/g, "+").replace(/_/g, "/")))));
    for (const [k, v] of Object.entries(kept)) if (/^ox-/.test(k) && localStorage.getItem(k) == null) localStorage.setItem(k, v);
  } catch { /* a mangled address: start afresh */ }
  window.history.replaceState(null, "", "/");
}

// 2: question by question. Folded, who won each one (you, the herd, or both for a draw); opened, the lines.
// rows: [{ q, g (your guess, or null if you didn't play), h (the herd), moved (an optional note) }].
function questionByQuestion(rows, title = "Question by question") {
  const scored = rows.map((x) => ({ ...x, yp: x.g == null ? null : points(x.q, x.g), hp: points(x.q, x.h.median) }));
  const winner = (x) => (x.yp == null ? "herd" : x.yp > x.hp ? "you" : x.yp < x.hp ? "herd" : "draw");
  const icon = { you: fairgoer({ size: 26 }), herd: oxHead({ size: 26 }), draw: `${fairgoer({ size: 22 })}${oxHead({ size: 22 })}` };
  return `<details class="qbq">
      <summary>
        <span class="qbq-head"><h2>${title}</h2><span class="chev" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg></span></span>
        <span class="winners">${scored.map((x) => {
          const w = winner(x);
          return `<span class="winner ${w}" style="--cat:${CATS[x.q.cat].color}" title="${w === "draw" ? "A draw" : w === "you" ? "You won this one" : "The herd won this one"}"><span class="w-icons">${icon[w]}</span><span>${catLabel(x.q)}</span></span>`;
        }).join("")}</span>
      </summary>
      <ul class="rows">
        ${scored.map((x) => `<li style="--cat:${CATS[x.q.cat].color}">
            <div class="row-top">${x.yp == null ? `<span></span>` : rosette(tierFor(x.yp).key, x.yp, 30)}<div class="row-q"><b>${catLabel(x.q)}</b><span>${x.q.q}</span></div></div>
            ${compare(x.q, x.h.range, x.g, x.h.median, x.yp, x.hp, winner(x))}
            ${x.moved ?? ""}
          </li>`).join("")}
      </ul>
    </details>`;
}
const todayRows = () => state.answers.map((a, i) => ({ q: today.questions[i], g: a.g, h: herd(today.questions[i]) }));

// 4: back tomorrow. Why to come back, a countdown on ticket stock, and the week.
function tomorrow(celebrate) {
  return `<section class="card week-card">
      <h2>Back tomorrow</h2>
      <p class="back-why">The herd is still moving. Come back tomorrow to see where it finished!</p>
      <div class="countdown" id="cd" role="timer">
        <span class="cd-eyebrow">Next round in</span>
        <span class="cd-cards"><span class="cd-unit"><b data-h>00</b><small>hours</small></span><span class="cd-colon" aria-hidden="true"></span><span class="cd-unit"><b data-m>00</b><small>minutes</small></span></span>
      </div>
      ${weekTickets(today.key, { stampToday: celebrate })}
    </section>`;
}

// Your stats: each number printed on a fair prop. The streak on a ticket, the best streak on a rosette, and days
// won against the herd as a head-to-head.
function yourStats() {
  const s = streak(), best = Math.max(s, bestStreak());
  return `<section class="card stats-card">
      <h2>Your stats</h2>
      <div class="props">
        <div class="prop"><span class="prop-ticket"><b>${s}</b></span><span class="prop-l">Day streak</span></div>
        <div class="prop">${rosette("first", best, 58)}<span class="prop-l">Best streak</span></div>
      </div>
      <div class="h2h" id="tally" aria-live="polite">
        <div class="h2h-side you">${fairgoer({ size: 44 })}<b data-you>–</b><span>You</span></div>
        <div class="h2h-mid"><span class="h2h-l">Days won</span><span class="h2h-bar"><i class="you" data-you-bar></i><i class="herd" data-herd-bar></i></span><span class="h2h-d" data-draws></span></div>
        <div class="h2h-side them">${oxHead({ size: 44 })}<b data-herd>–</b><span>The herd</span></div>
      </div>
    </section>`;
}
/** Days won against the herd, from every finished round on this device. Past days use the herd's final score,
 *  looked up once and kept with that day; today uses the herd as it stands. */
async function fillTally() {
  let you = 0, them = 0, draws = 0;
  for (const { day } of history()) {
    const st = store.get(dayStateKey(day)), qs = roundFor(day).questions;
    const mine = st.answers.reduce((t, a, j) => t + (qs[j] ? points(qs[j], a.g) : 0), 0);
    let theirs;
    if (day === today.key) theirs = herdTotal();
    else {
      if (st.herdFinal == null) {
        const real = await loadHerds(day, qs);
        if (Object.keys(real).length < qs.length) continue; // offline: leave this day out rather than guess
        st.herdFinal = qs.reduce((t, q) => t + points(q, makeHerd(q, real[q.id], day).median), 0);
        store.set(dayStateKey(day), st);
      }
      theirs = st.herdFinal;
    }
    if (mine > theirs) you++; else if (mine < theirs) them++; else draws++;
  }
  const el = document.getElementById("tally");
  if (!el) return;
  el.querySelector("[data-you]").textContent = you;
  el.querySelector("[data-herd]").textContent = them;
  el.querySelector("[data-you-bar]").style.flexGrow = you || (them ? 0 : 1);
  el.querySelector("[data-herd-bar]").style.flexGrow = them || (you ? 0 : 1);
  el.querySelector("[data-draws]").textContent = draws ? `and ${draws} drawn` : "";
  el.classList.toggle("lead-you", you > them);
  el.classList.toggle("lead-herd", them > you);
}

// 5: yesterday. Your guesses are on this device; the herd's final guesses are yesterday's five herd summaries, and
// everyone's scores are yesterday's finished rounds. Read once per page load. Before you play today, yesterday's result
// also goes up on a chalkboard above the start card.
let yesterdayCache = null;
function yesterdaySlot() {
  return shift(today.key, -1) >= EPOCH ? `<section class="card yesterday" id="yesterday" hidden></section>` : "";
}
function slateSlot() {
  return shift(today.key, -1) >= EPOCH ? `<section class="slate" id="slate" hidden aria-live="polite"></section>` : "";
}
const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
async function fillYesterday() {
  const el = document.getElementById("yesterday"), y = shift(today.key, -1);
  if (!el) return;
  const r = roundFor(y);
  if (yesterdayCache?.day !== y) {
    const [real, scores] = await Promise.all([loadHerds(y, r.questions), scoresFor(y)]);
    yesterdayCache = { day: y, real, scores };
  }
  if (!el.isConnected) return;
  const st = store.get(dayStateKey(y)), ids = r.questions.map((q) => q.id).join();
  const mine = st?.done && (!st.ids || st.ids === ids) ? st.answers : null;
  const rows = r.questions.map((q, i) => {
    const h = makeHerd(q, yesterdayCache.real[q.id], y), a = mine?.[i];
    const moved = a?.hm != null && withUnit(q, a.hm) !== withUnit(q, h.median) ? `<p class="y-moved">The herd was on ${withUnit(q, a.hm)} when you played.</p>` : "";
    return { q, g: a ? a.g : null, h, moved };
  });
  const herdScore = rows.reduce((t, x) => t + points(x.q, x.h.median), 0);
  const you = mine ? rows.reduce((t, x) => t + points(x.q, x.g), 0) : null;
  const others = yesterdayCache.scores, all = you == null ? others : [...others, you], n = all.length;
  const place = (v) => 1 + all.filter((t) => t > v).length, joint = (v) => all.filter((t) => t === v).length > 1 ? "joint " : "";
  el.innerHTML = `
    <div class="y-head"><h2>Yesterday</h2><p class="dayline"><span>${prettyDate(y)}</span><span class="round-badge">Round ${r.number}</span></p></div>
    ${n ? scoreChart(others, herdScore, you) : ""}
    <ol class="standings">${[
      { who: "herd", name: "The herd", icon: oxHead({ size: 38 }), score: herdScore },
      { who: "you", name: "You", icon: fairgoer({ size: 38 }), score: you },
    ].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).map((x) => `<li class="${x.who}">
        <span class="st-icon">${x.icon}</span>
        <span class="st-name">${x.name}${n && x.score != null ? `<small>${joint(x.score)}${ordinal(place(x.score))} of ${n} players</small>` : x.score == null ? `<small>You missed this one</small>` : ""}</span>
        <span class="st-score">${x.score == null ? "" : `<b>${x.score}</b><small>/${MAX()}</small>`}</span>
      </li>`).join("")}</ol>
    ${questionByQuestion(rows)}`;
  el.hidden = false;
  fillSlate({ you, herdScore, n, place: you == null ? null : place(you), tied: you != null && !!joint(you) });
}
/** The morning chalkboard: yesterday's final placing, chalked up line by line. */
function fillSlate({ you, herdScore, n, place, tied }) {
  const el = document.getElementById("slate");
  if (!el || state.answers.length) return;
  el.innerHTML = chalkboard({ you, herd: herdScore, n, place, tied });
  el.hidden = false;
  // "Full results": down to yesterday's card, opened.
  el.querySelector("[data-more]").onclick = () => {
    const y = document.querySelector("#yesterday details");
    if (y) { y.open = true; y.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" }); }
  };
  chalkUp(el);
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
  const cta = state.done ? "Back to today" : "Join the herd";
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
    `<div class="story-bunting" aria-hidden="true">${flags(11, 14)}</div>
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
        ${page > 0 ? `<button class="btn" id="story-back">Back</button>` : `<button class="link" data-go="home">Skip</button>`}
        <button class="btn primary big" id="story-next" ${last ? `data-go="${state.done ? "home" : "play"}"` : ""}>${last ? cta : "Next"}</button>
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

// Five segments; the current question's segment opens into a pill naming its category. The segment just finished fills
// in from the left as the next question arrives.
function progress(i, revealed) {
  return `<div class="progress" aria-label="Question ${i + 1} of ${today.questions.length}">${today.questions.map((q, j) => {
    const state = j < i || (j === i && revealed) ? `done${j === i - 1 && !revealed ? " just-done" : ""}` : "";
    return j === i
      ? `<span class="current ${state}" style="--cat:${CATS[q.cat].color}">${catLabel(q)}</span>`
      : `<span class="${state}" style="--cat:${CATS[q.cat].color}"></span>`;
  }).join("")}</div>`;
}

// ---------- moving between screens ----------
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
/** The card slides off to the left (or fades, under reduced motion) before the next screen comes in. */
async function leave() {
  const parts = [...app.querySelectorAll(".screen > :not(.progress)")];
  // Scrolled down (to the herd's chart, say), the new screen starts at the top anyway: just fade.
  const out = reducedMotion() || window.scrollY > 40 ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(-12px)" }];
  // Never wait on the animation itself for long: a background tab pauses animations, and the game must not hang.
  const anims = parts.map((el) => el.animate(out, { duration: 150, easing: "cubic-bezier(.55,0,1,.45)", fill: "forwards" }).finished.catch(() => {}));
  await Promise.race([Promise.all(anims), new Promise((r) => setTimeout(r, 300))]);
}
/** ...and the new card comes in from the right. */
function arrive(el) {
  if (!el) return;
  const from = reducedMotion() ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: "translateX(16px)" }, { opacity: 1, transform: "none" }];
  el.animate(from, { duration: reducedMotion() ? 150 : 240, easing: "cubic-bezier(.22,.61,.36,1)" });
}

// ---------- asking ----------
function ask() {
  screen = "ask";
  const i = state.answers.length, q = today.questions[i], arm = armAt(i), r = sliderFor(q, arm);
  let pos = Math.round(STEPS / 2), typed = null;
  render(`
    ${progress(i, false)}
    <section class="card ask">
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

  arrive(document.querySelector(".ask"));
  const pill = document.querySelector(".progress .current");
  if (i > 0 && pill && !reducedMotion()) { pill.animate([{ transform: "scale(1.12)" }, { transform: "none" }], { duration: 240, easing: "cubic-bezier(.22,.61,.36,1)" }); sfx.tick(0.8); }
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
  slider.oninput = () => { pos = +slider.value; typed = null; show(); sfx.tick(pos / STEPS); };
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
    show(); sfx.tick(pos / STEPS); pop(input, 1.06);
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
    const bin = recordGuess(today.key, q, g, arm, r);
    addLocal(q, bin); sinceRead.push([q, bin]);
    // hm: the herd's guess as this player saw it, for tomorrow's "the herd was on X when you played".
    state.answers.push({ g, s: score(q, g), bin, ticket: ticketNo, arm, hm: herd(q).median });
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
  const q = today.questions[i], a = state.answers[i], h = herd(q), r = sliderAt(i), v = herdVerdict(q, h, a.g);
  const p = points(q, a.g), them = points(q, h.median), t = tierFor(p), last = i === today.questions.length - 1;
  const gpos = toPos(q, r, a.g) / STEPS, apos = toPos(q, r, q.answer) / STEPS, hpos = toPos(q, r, h.median) / STEPS;
  // The herd can land beyond this player's slider (the other slider in the test reaches further): it waits at the end.
  const beyond = h.median < r.min ? "beyond left" : h.median > r.max ? "beyond right" : "";
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
        <div class="herd-pin ${beyond} ${hide}" id="herd-pin" style="left:${hpos * 100}%"><i></i><span>${oxHead({ size: 22 })}</span></div>
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
          ${herdChart(q, h, { guess: a.g, range: r })}
          <div class="legend"><span><i style="background:var(--good)"></i>Answer ${withUnit(q, q.answer)}</span><span>${fairgoer({ size: 14 })} You ${withUnit(q, a.g)} (${p} pts)</span><span>${oxHead({ size: 14 })} Herd ${withUnit(q, h.median)} (${them} pts)</span></div>
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
      home({ celebrate: true });
    } else { save(); leave().then(ask); }
  };
  if (!animate) { setStriker(); return; }

  if (!reducedMotion()) document.querySelector(".reveal .rail-wrap").animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "cubic-bezier(.2,.9,.3,1)" });
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
      for (let k = 0; k < steps; k++) { sfx.tick(0.2); await wait(walk / steps); }
    }
    await wait(200);

    // 4. The strength tester: up goes the puck, a tick a point, each a semitone higher, and the points count with it.
    const climb = 250 + p * 28;
    if (!puck.isConnected) return;
    if (!reduce && p > 0) {
      puck.animate([{ transform: "translateY(0)" }, { transform: `translateY(${rise}px)` }], { duration: climb, easing: "cubic-bezier(.2,.8,.3,1)", fill: "forwards" });
      fill.animate([{ y: 132, height: 4 }, { y: 132 + rise, height: -rise + 4 }], { duration: climb, easing: "cubic-bezier(.2,.8,.3,1)", fill: "forwards" });
      for (let k = 1; k <= p; k++) setTimeout(() => { if (puck.isConnected) sfx.climb(k); }, climb * (1 - (1 - k / p) ** 0.6) - 20);
    }
    await countUp($("pts"), p, climb, { sound: false });
    setStriker();
    const plus = document.querySelector(".plus");
    if (!plus) return;
    const run = goodRun(i);
    if (p === PER_QUESTION) {
      sfx.bell(); buzz([40, 30, 80]); flash();
      $("bell")?.animate([{ transform: "rotate(0)" }, { transform: "rotate(-14deg)" }, { transform: "rotate(12deg)" }, { transform: "rotate(-8deg)" }, { transform: "rotate(0)" }], { duration: 700 });
      const rect = document.querySelector(".striker").getBoundingClientRect();
      bunting({ x: rect.left + rect.width / 2, y: rect.top + 20 });
    } else if (p === PER_QUESTION - 1) {
      // A whisker off: the bell trembles but doesn't ring.
      sfx.land(); sfx.tink(); buzz([20, 30, 20]);
      $("bell")?.animate([{ transform: "rotate(0)" }, { transform: "rotate(-4deg)" }, { transform: "rotate(4deg)" }, { transform: "rotate(-3deg)" }, { transform: "rotate(0)" }], { duration: 300 });
      $("off").textContent = `${offBy(q, a.g)} · A whisker off the bell!`;
    } else if (p >= 13) { sfx.land(); sfx.chime(run); buzz([20, 30, 20]); if (p >= 17) sparkle(plus); }
    else if (p >= 8) { sfx.land(); sfx.plink(); buzz(15); }
    else { sfx.wobble(); buzz(8); }
    pop(plus, 1.18);
    await wait(350);

    // 5. What the herd said, and who got closer: ding-ding if it was you.
    if (!show("duel", 1.06)) return;
    if (p > them) { sfx.ding(); buzz(15); }
    await wait(450);

    // 6. The judges pin a rosette on it.
    const ros = $("rosette");
    if (!ros) return;
    ros.classList.remove("is-hidden");
    { sfx.pin(); buzz(10); }
    ros.animate([{ transform: "scale(.3) rotate(-30deg)", opacity: 0 }, { transform: "scale(1.2) rotate(8deg)", opacity: 1 }, { transform: "none" }], { duration: 420, easing: "cubic-bezier(.3,1.5,.5,1)" });
    await wait(450);

    // 7. Then Next, with the fact and the herd underneath for anyone who scrolls.
    const later = document.querySelector(".later");
    if (!later) return;
    later.classList.add("shown");
    $("next")?.classList.remove("is-hidden");
  })();
}

// ---------- question by question lines ----------
// One question on one line: you above it, the herd below it, the answer as a green tick. The line spans the herd's
// whole range (both sliders in the slider test), so the herd is always on it. Points sit on the left
// with who scored them; each guess sits centred on its own marker, hugging the edge near either end of the line.
function compare(q, r, g, herdGuess, yp, hp, winner) {
  const at = (v) => toPos(q, r, v) / STEPS;
  const side = (x) => (x < 0.15 ? "start" : x > 0.85 ? "end" : "mid");
  const pin = (who, icon, v) => {
    const x = at(v), lab = `<span class="duo-lab">${icon}<b>${withUnit(q, v)}</b></span>`, post = `<span class="post">${who === "you" ? '<i class="stem"></i><i class="dot"></i>' : '<i class="dot"></i><i class="stem"></i>'}</span>`;
    return `<div class="duo-pin ${who} ${side(x)}" style="left:${x * 100}%">${who === "you" ? lab + post : post + lab}</div>`;
  };
  return `<div class="answer-pill"><i class="ans-flag"></i>Answer <b>${withUnit(q, q.answer)}</b></div>
    <div class="duo" aria-label="Answer ${withUnit(q, q.answer)}; ${g == null ? "you didn't play" : `you ${withUnit(q, g)}, ${yp} points`}; the herd ${withUnit(q, herdGuess)}, ${hp} points">
      <div class="duo-side"><span class="you ${winner === "you" ? "won" : ""}">You<b>${g == null ? "–" : `${yp}<small> pts</small>`}</b></span><span class="herd ${winner === "herd" && g != null ? "won" : ""}">Herd<b>${hp}<small> pts</small></b></span></div>
      <div class="duo-track">
        <div class="duo-line"></div><i class="duo-ans" style="left:${at(q.answer) * 100}%"></i>
        ${g == null ? "" : pin("you", fairgoer({ size: 20 }), g)}
        ${pin("herd", oxHead({ size: 20 }), herdGuess)}
      </div>
    </div>`;
}

/** The first look at a finished round: the scores count up, the ribbon drops, the rosettes go on (Best in shows flying up
 *  to the header's counter), and today's ticket is stamped. Then, on early rounds, the ox for your home screen. */
function celebrateRound() {
  const you = total(), herdScore = herdTotal(), beat = you > herdScore;
  // Today's Best in shows join the all-time count at the end, one at a time.
  const bisPill = document.getElementById("bis-pill"), bisNow = bestInShows(), bisToday = state.answers.filter((_, i) => ptsAt(i) === PER_QUESTION).length;
  if (bisPill && bisToday) bisPill.querySelector("b").textContent = bisNow - bisToday; // a first one lands on a 0
  celebrating = true;
  (async () => {
    await wait(250);
    await countUp(document.getElementById("you-n"), you, 900);
    pop(document.getElementById("you-n"), 1.15);
    await wait(250);
    await countUp(document.getElementById("herd-n"), herdScore, 700, { sound: "low" });
    await wait(200);
    const ribbon = document.getElementById("ribbon");
    if (!ribbon) return;
    ribbon.classList.remove("is-hidden");
    ribbon.animate([{ transform: "scaleX(.2)", opacity: 0 }, { transform: "scaleX(1.05)", opacity: 1 }, { transform: "scaleX(1)" }], { duration: 450, easing: "cubic-bezier(.3,1.4,.5,1)" });
    // The brass band when you win; a good-humoured tuba when the herd does.
    if (beat) { sfx.fanfare(); buzz([40, 30, 80]); bunting({ y: window.innerHeight * 0.45, count: 70, power: 1.2 }); }
    else if (you === herdScore || you >= 80) sfx.chime();
    else sfx.oompah();
    await wait(350);
    const rosEls = [...document.querySelectorAll(".my-rosette")];
    for (const t of rosEls) {
      t.classList.remove("pending");
      t.animate([{ transform: "scale(.3) rotate(-25deg)", opacity: 0 }, { transform: "scale(1.12) rotate(4deg)", opacity: 1 }, { transform: "none" }], { duration: 380, easing: "cubic-bezier(.3,1.5,.5,1)" });
      sfx.pin(); await wait(120);
    }
    // Each Best in show wiggles, then flies up to the all-time counter in the header, which ticks up as it lands.
    if (bisPill && bisToday) {
      await wait(250);
      let n = bisNow - bisToday;
      const landings = [];
      for (const [i, el] of rosEls.entries()) {
        if (ptsAt(i) !== PER_QUESTION) continue;
        el.animate([{ transform: "none" }, { transform: "scale(1.18) rotate(-12deg)" }, { transform: "scale(1.18) rotate(10deg)" }, { transform: "scale(1.1) rotate(-6deg)" }, { transform: "none" }], { duration: 380, easing: "ease-in-out" });
        await wait(300);
        landings.push(flyTo(el.querySelector(".rosette"), bisPill, rosette("best", "", 40)).then(() => {
          n++; bisPill.querySelector("b").textContent = n; pop(bisPill, 1.35); sfx.chime(n - (bisNow - bisToday) - 1); buzz(15);
        }));
        await wait(260);
      }
      await Promise.all(landings);
    }
    const pb = document.getElementById("pb"), note = document.getElementById("note");
    if (pb) {
      await wait(250);
      pb.hidden = false; sfx.pin(); sfx.chime(2); buzz(20);
      if (!reducedMotion()) { pb.animate([{ transform: "scale(.3)", opacity: 0 }, { transform: "scale(1.15)", opacity: 1 }, { transform: "none" }], { duration: 420, easing: "cubic-bezier(.3,1.5,.5,1)" }); sparkle(pb); }
    }
    if (note) { await wait(200); note.hidden = false; pop(note, 1.04); sfx.chime(); }
    await wait(300);
    const t = document.querySelector(".ticket.is-today .stamp");
    if (t) { stampIn(t); buzz(20); }
    await wait(900);
    showKeep();
  })().finally(() => {
    celebrating = false;
    if (redrawPending) { redrawPending = false; if (screen === "home") redrawDay(); }
  });
}

// ---------- boot ----------
async function boot() {
  importCarried();
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
  if (!store.get("ox-seen-story") && !state.answers.length) story(0);
  // A finished day shows the herd, so it waits for today's herd like the reveal does (never more than 1.5s; if it is
  // later than that, the day screen is drawn again when it lands).
  else if (state.done) settle().then(() => home());
  else home();
}
boot();
