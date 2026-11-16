// oxguess.com/stats: who's playing. Unlinked and not indexed, but public, so it never shows today's answers.
// Reads every guess and finished round since launch (fine at this size; add a date window when it grows).
import { oxHead } from "./art.js";
import { catLabel, points, withUnit, herd, CATS, STEPS, PER_QUESTION } from "./game.js";
import { loadActivity, playerId } from "./herd-store.js";

const el = document.getElementById("stats");
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shift = (k, n) => { const [y, m, d] = k.split("-").map(Number); return keyOf(new Date(y, m - 1, d + n)); };
const short = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); };
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const avg = (xs) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : "–");
const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };
const today = keyOf(new Date()), me = playerId();
let hideMe = false; // counting everyone by default, you included: you're a player too
try { hideMe = localStorage.getItem("ox-stats-hide-me") === "1"; } catch { /* fine */ }

const tile = (label, value, sub = "") => `<div class="tile"><span class="label">${label}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;

/** Players per day as stacked bars: returning on the bottom, new on top. Fourteen slots, newest on the right. */
function bars(days) {
  const W = 320, H = 120, bw = W / 14, top = Math.max(1, ...days.map((d) => d.started)), off = 14 - days.length;
  return `<svg class="stat-bars" viewBox="0 -14 ${W} ${H + 30}" role="img" aria-label="Players per day">
    ${days.map((d, i) => {
      const x = (off + i) * bw + 3, w = bw - 6, hr = (d.returning / top) * H, hn = (d.fresh / top) * H;
      return `<rect x="${x}" y="${H - hr}" width="${w}" height="${hr}" rx="2" fill="var(--c-many)"/>
        <rect x="${x}" y="${H - hr - hn}" width="${w}" height="${hn}" rx="2" fill="var(--c-far)"/>
        ${d.started ? `<text x="${x + w / 2}" y="${H - hr - hn - 4}" text-anchor="middle">${d.started}</text>` : ""}
        <text x="${x + w / 2}" y="${H + 14}" text-anchor="middle" class="day">${d.day.slice(8)}</text>`;
    }).join("")}
  </svg>`;
}

function render(data, bank, schedule) {
  // Up to today only: the rules test writes to 2099 dates. Optionally without this device.
  const keep = (r) => r.day <= today && !(hideMe && r.player === me);
  const guesses = data.guesses.filter(keep), plays = data.plays.filter(keep);
  const myDays = new Set(data.guesses.filter((g) => g.player === me && g.day <= today).map((g) => g.day)).size;
  const dates = Object.keys(schedule).sort(), epoch = dates[0];
  const roundFor = (k) => {
    const n = Math.round((Date.parse(k) - Date.parse(epoch)) / 86400000);
    return { number: n + 1, questions: (schedule[k] ?? schedule[dates[((n % dates.length) + dates.length) % dates.length]]).map((id) => bank[id]) };
  };

  // Each player's days, to tell new from returning.
  const daysOf = {};
  for (const g of guesses) (daysOf[g.player] ??= new Set()).add(g.day);
  const firstDay = Object.fromEntries(Object.entries(daysOf).map(([p, s]) => [p, [...s].sort()[0]]));
  const players = Object.keys(daysOf), back = players.filter((p) => daysOf[p].size > 1).length;
  const lastAt = Math.max(0, ...guesses.map((g) => g.at?.toMillis?.() ?? 0));

  const day = (k) => {
    const started = new Set(guesses.filter((g) => g.day === k).map((g) => g.player));
    const done = plays.filter((p) => p.day === k);
    const fresh = [...started].filter((p) => firstDay[p] === k).length;
    return { day: k, started: started.size, finished: done.length, fresh, returning: started.size - fresh, avg: avg(done.map((p) => p.total)), best: done.length ? Math.max(...done.map((p) => p.total)) : "–" };
  };
  const span = []; for (let k = today; k >= epoch && span.length < 14; k = shift(k, -1)) span.push(day(k));
  const t = span[0];

  // Question by question for recent days. Today's answers and herd stay hidden.
  const questionDays = span.slice(0, 7).map((d) => {
    const r = roundFor(d.day), past = d.day < today;
    const rows = r.questions.map((q) => {
      const gs = guesses.filter((g) => g.day === d.day && g.qid === q.id);
      const pts = gs.map((g) => points(q, g.value));
      const b = {}; for (const g of gs) { const k = Math.min(99, Math.floor((g.pos / STEPS) * 100)); b[k] = (b[k] ?? 0) + 1; }
      const h = herd(q, { n: gs.length, b }, d.day);
      return `<tr style="--cat:${CATS[q.cat].color}">
        <td><span class="cat-dot"></span>${catLabel(q)}</td><td class="q">${q.q}</td>
        <td class="n">${gs.length}</td><td class="n">${avg(pts)}</td>
        <td class="n">${past ? withUnit(q, q.answer) : "tomorrow"}</td>
        <td class="n">${past ? `${withUnit(q, h.median)} <small>(${points(q, h.median)})</small>` : "–"}</td>
      </tr>`;
    }).join("");
    return `<details ${d.day === today ? "open" : ""}><summary><b>Round ${r.number}</b> · ${short(d.day)} · ${d.started} played</summary>
      <div class="table-wrap"><table class="stat-table">
        <thead><tr><th></th><th>Question</th><th class="n">Guesses</th><th class="n">Avg pts</th><th class="n">Answer</th><th class="n">Herd (pts)</th></tr></thead>
        <tbody>${rows}</tbody></table></div></details>`;
  }).join("");

  el.innerHTML = `
    <header class="top"><a class="brand" href="/">${oxHead({ size: 40 })}<span>OxGuess stats</span></a></header>
    <main class="screen">
      <section class="card">
        <h2>All time <small class="muted">since ${short(epoch)}</small></h2>
        <div class="tiles">
          ${tile("Players", players.length, "devices with a guess")}
          ${tile("Rounds finished", plays.length, `${pct(plays.length, Object.values(daysOf).reduce((a, s) => a + s.size, 0))}% of rounds started`)}
          ${tile("Came back", `${pct(back, players.length)}%`, `${back} of ${players.length} played on 2+ days`)}
          ${tile("Guesses", guesses.length, "")}
        </div>
      </section>
      <section class="card">
        <h2>Today <small class="muted">${short(today)} · ${lastAt ? `last guess ${ago(lastAt)}` : "no guesses yet"}</small></h2>
        <div class="tiles">
          ${tile("Played", t.started, `${t.fresh} new · ${t.returning} returning`)}
          ${tile("Finished", t.finished, `${pct(t.finished, t.started)}% of those who started`)}
          ${tile("Average score", t.avg, `out of ${5 * PER_QUESTION}`)}
          ${tile("Best score", t.best, "")}
        </div>
      </section>
      <section class="card">
        <h2>Players per day</h2>
        <p class="legend"><span><i style="background:var(--c-many)"></i>Returning</span><span><i style="background:var(--c-far)"></i>New</span></p>
        ${bars([...span].reverse())}
        <div class="table-wrap"><table class="stat-table">
          <thead><tr><th>Day</th><th class="n">Played</th><th class="n">New</th><th class="n">Finished</th><th class="n">Avg</th><th class="n">Best</th></tr></thead>
          <tbody>${span.map((d) => `<tr><td>${short(d.day)}</td><td class="n">${d.started}</td><td class="n">${d.fresh}</td><td class="n">${d.finished}</td><td class="n">${d.avg}</td><td class="n">${d.best}</td></tr>`).join("")}</tbody>
        </table></div>
      </section>
      <section class="card">
        <h2>Question by question</h2>
        <p class="muted fine">Real guesses only. The herd's guess includes the 15 starter guesses, as players see it. Today's answers show tomorrow.</p>
        ${questionDays}
      </section>
      <label class="fine muted me-toggle"><input type="checkbox" id="hide-me" ${hideMe ? "checked" : ""}> Leave out this device (it played on ${myDays} day${myDays === 1 ? "" : "s"})</label>
    </main>`;
  document.getElementById("hide-me").onchange = (e) => {
    hideMe = e.target.checked;
    try { localStorage.setItem("ox-stats-hide-me", hideMe ? "1" : "0"); } catch { /* fine */ }
    render(data, bank, schedule);
  };
}

async function boot() {
  el.innerHTML = `<main class="screen"><section class="card"><p class="muted">Counting the herd…</p></section></main>`;
  try {
    const json = async (f) => (await fetch(f, { cache: "no-cache" })).json();
    const [{ questions }, { days }] = await Promise.all([json("/data/questions.json"), json("/data/schedule.json")]);
    const bank = Object.fromEntries(questions.map((q) => [q.id, q]));
    const data = await loadActivity(Object.keys(days).sort()[0]);
    render(data, bank, days);
  } catch (e) {
    const rules = e?.code === "permission-denied";
    el.innerHTML = `<main class="screen"><section class="card"><h2>No stats yet</h2><p>${rules
      ? "Firestore won't let this page read guesses and plays. Publish the latest <code>firestore.rules</code> in the Firebase console (Firestore Database → Rules)."
      : `Couldn't load: ${e?.message ?? e}`}</p></section></main>`;
  }
}
boot();
