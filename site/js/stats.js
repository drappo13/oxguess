// oxguess.com/stats: who's playing, who comes back, and how each round went.
// Public but unlinked, so today's answers stay hidden until you ask for them.
import { oxHead } from "/js/art.js";
import { catLabel, points, withUnit, herd, rangeFor, toPos, CATS, STEPS, PER_QUESTION } from "/js/game.js";
import { loadActivity, playerId } from "/js/herd-store.js";

const el = document.getElementById("stats");
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const shift = (k, n) => { const d = dateOf(k); d.setDate(d.getDate() + n); return keyOf(d); };
const short = (k) => dateOf(k).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const dayNum = (k) => dateOf(k).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const fmt1 = (v) => (v == null ? "–" : Math.round(v).toString());
const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };
const msOf = (r) => r.at?.toMillis?.() ?? 0;
const today = keyOf(new Date()), me = playerId();
let hideMe = false, showToday = false;
try { hideMe = localStorage.getItem("ox-stats-hide-me") === "1"; } catch { /* fine */ }

const tile = (l, v, s = "") => `<div class="st-tile"><span class="l">${l}</span><span class="v">${v}</span>${s ? `<span class="s">${s}</span>` : ""}</div>`;
/** A little ox for charts, drawn in place so it scales with the SVG. */
const ox = (x, y, r = 8) => `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${r / 9})">
  <path d="M-6 -5 Q-14 -8 -12 -15 L-9 -7 Z M6 -5 Q14 -8 12 -15 L9 -7 Z" fill="var(--horn)" stroke="var(--art-ink)" stroke-width="1.6" stroke-linejoin="round"/>
  <circle r="9" fill="var(--ox)" stroke="var(--art-ink)" stroke-width="1.8"/><ellipse cy="4" rx="5.4" ry="3.6" fill="var(--muzzle)"/>
  <circle cx="-3.3" cy="-2" r="1.4" fill="var(--art-ink)"/><circle cx="3.3" cy="-2" r="1.4" fill="var(--art-ink)"/></g>`;

function crunch(data, bank, schedule) {
  const keep = (r) => r.day <= today && !(hideMe && r.player === me);
  const G = data.guesses.filter(keep);
  const dates = Object.keys(schedule).sort(), epoch = dates[0];
  const days = []; for (let k = epoch; k <= today; k = shift(k, 1)) days.push(k);
  const roundFor = (k) => {
    const n = Math.round((dateOf(k) - dateOf(epoch)) / 86400000);
    return { number: n + 1, questions: (schedule[k] ?? schedule[dates[((n % dates.length) + dates.length) % dates.length]]).map((id) => bank[id]).filter(Boolean) };
  };
  // Rescore every finished round from its guesses with today's rules, so players and the herd are scored alike.
  const guessOf = {};
  for (const g of [...G].sort((a, b) => msOf(a) - msOf(b))) guessOf[`${g.day}|${g.player}|${g.qid}`] = g.value;
  const rescore = (p) => {
    const vals = roundFor(p.day).questions.map((q) => [q, guessOf[`${p.day}|${p.player}|${q.id}`]]);
    return vals.every(([, v]) => v != null) ? vals.reduce((a, [q, v]) => a + points(q, v), 0) : p.total;
  };
  const P = data.plays.filter(keep).map((p) => ({ ...p, total: rescore(p) }));

  // Who played when (a player is anyone with a guess that day).
  const on = new Map(days.map((d) => [d, new Set()]));
  for (const g of G) on.get(g.day)?.add(g.player);
  const firstDay = {};
  for (const d of days) for (const p of on.get(d)) firstDay[p] ??= d;
  const players = Object.keys(firstDay);
  const daysPlayed = (p) => days.filter((d) => on.get(d).has(p)).length;

  // Each day's round: the herd as players saw it (15 starter guesses plus real ones) and every finished score.
  const round = (d) => {
    const r = roundFor(d), gs = G.filter((g) => g.day === d), ps = P.filter((p) => p.day === d);
    const qs = r.questions.map((q) => {
      const mine = gs.filter((g) => g.qid === q.id), b = {};
      for (const g of mine) { const k = Math.min(99, Math.floor((g.pos / STEPS) * 100)); b[k] = (b[k] ?? 0) + 1; }
      const h = herd(q, { n: mine.length, b }, d), hp = points(q, h.median), pts = mine.map((g) => points(q, g.value));
      return { q, guesses: mine, median: h.median, hp, avgPts: avg(pts), beat: pct(pts.filter((x) => x < hp).length, pts.length) };
    });
    const herdScore = qs.reduce((a, x) => a + x.hp, 0), totals = ps.map((p) => p.total);
    const fresh = [...on.get(d)].filter((p) => firstDay[p] === d).length;
    return { day: d, number: r.number, qs, herdScore, totals, avg: avg(totals), best: totals.length ? Math.max(...totals) : null,
      started: on.get(d).size, fresh, returning: on.get(d).size - fresh, finished: ps.length, beatHerd: totals.filter((t) => t > herdScore).length };
  };
  const rounds = days.map(round);

  // Retention: back the next day, and cohorts by first day played.
  const nextDay = days.slice(0, -1).map((d) => {
    const a = on.get(d), b = on.get(shift(d, 1)), both = [...a].filter((p) => b.has(p)).length;
    return { day: d, both, of: a.size };
  });
  const cohorts = days.slice().reverse().slice(0, 10).map((c) => {
    const members = players.filter((p) => firstDay[p] === c);
    const cells = Array.from({ length: 7 }, (_, k) => { const d = shift(c, k); return d > today ? null : members.filter((p) => on.get(d).has(p)).length; });
    const ever = c === today ? null : members.filter((p) => days.some((d) => d > c && on.get(d).has(p))).length;
    return { day: c, size: members.length, cells, ever };
  }).filter((c) => c.size);

  const hours = new Array(24).fill(0), since = shift(today, -13);
  for (const p of P) if (p.day >= since && msOf(p)) hours[new Date(msOf(p)).getHours()]++;
  const lastAt = Math.max(0, ...G.map(msOf));
  const myDays = new Set(data.guesses.filter((g) => g.player === me && g.day <= today).map((g) => g.day)).size;
  return { G, P, days, players, daysPlayed, rounds, nextDay, cohorts, hours, lastAt, myDays, epoch };
}

// ---------- charts ----------
/** Players per day: returning at the bottom, new on top, with the total above each bar. */
function playersChart(rounds) {
  const rs = rounds.slice(-14), slots = Math.max(rs.length, 7), off = slots - rs.length;
  const W = 360, H = 150, B = 122, L = 4, bw = (W - L * 2) / slots, top = Math.max(1, ...rs.map((r) => r.started));
  let s = "";
  rs.forEach((r, j) => {
    const i = j + off, x = L + i * bw + 3, w = bw - 6, hr = (r.returning / top) * (B - 22), hn = (r.fresh / top) * (B - 22);
    s += `<rect x="${x}" y="${B - hr}" width="${w}" height="${hr}" rx="4" fill="var(--c-many)"/>`;
    s += `<rect x="${x}" y="${B - hr - hn - (hr ? 2 : 0)}" width="${w}" height="${hn}" rx="4" fill="var(--c-far)"/>`;
    s += `<text class="ink" x="${x + w / 2}" y="${B - hr - hn - 7}" text-anchor="middle">${r.started}</text>`;
    s += `<text x="${x + w / 2}" y="${B + 16}" text-anchor="middle">${dateOf(r.day).getDate()}</text>`;
  });
  return `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="Players per day, new and returning">${s}<line x1="${L}" x2="${W - L}" y1="${B}" y2="${B}" stroke="var(--line)" stroke-width="1.5"/></svg>`;
}

/** Every finished round's score by day: a dot per player, the herd's score as an ox, the average as a bar. */
function scoresChart(rounds) {
  const rs = rounds.slice(-14), slots = Math.max(rs.length, 5), off = slots - rs.length;
  const W = 360, H = 220, T = 12, B = 190, L = 28, cw = (W - L - 4) / slots, Y = (v) => B - (v / 100) * (B - T);
  let s = "";
  for (const v of [0, 25, 50, 75, 100]) s += `<line x1="${L}" x2="${W - 4}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
  rs.forEach((r, j) => {
    const cx = L + (j + off) * cw + cw / 2, seen = {};
    for (const t of r.totals) { const k = Math.round(t / 4); const n = (seen[k] = (seen[k] ?? 0) + 1) - 1; const dx = (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 5; s += `<circle cx="${(cx + dx).toFixed(1)}" cy="${Y(t).toFixed(1)}" r="2.8" fill="var(--muted)" opacity=".55"/>`; }
    if (r.avg != null) s += `<line x1="${cx - cw * 0.3}" x2="${cx + cw * 0.3}" y1="${Y(r.avg)}" y2="${Y(r.avg)}" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"/>`;
    if (r.started) s += ox(cx + cw * 0.36, Y(r.herdScore), 7);
    s += `<text x="${cx}" y="${B + 18}" text-anchor="middle">${dayNum(r.day)}</text>`;
  });
  return `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="Every finished round's score by day, with the herd's score and the average">${s}</svg>`;
}

/** One question on its own slider: each guess a dot, the herd an ox, the answer a green flag. */
function questionStrip(x, showAnswer) {
  const q = x.q, r = rangeFor(q), W = 340, L = 10, R = W - 10, X = (pos) => L + pos * (R - L), pv = (v) => toPos(q, r, v) / STEPS;
  let s = `<line x1="${L}" x2="${R}" y1="34" y2="34" stroke="var(--line)" stroke-width="5" stroke-linecap="round"/>`;
  const seen = {};
  for (const g of x.guesses) { const p = g.pos / STEPS, k = Math.round(p * 60), n = (seen[k] = (seen[k] ?? 0) + 1) - 1; s += `<circle cx="${X(p).toFixed(1)}" cy="${(24 - n * 6).toFixed(1)}" r="2.8" fill="var(--muted)" opacity=".6"/>`; }
  if (showAnswer) { const ax = X(pv(q.answer)); s += `<line x1="${ax}" x2="${ax}" y1="6" y2="40" stroke="var(--good)" stroke-width="3" stroke-linecap="round"/><path d="M${ax + 1.5} 6 l10 4 l-10 4 z" fill="var(--good)"/>`; }
  s += ox(X(pv(x.median)), 46, 7);
  s += `<text x="${L}" y="64">${withUnit(q, r.min)}</text><text x="${R}" y="64" text-anchor="end">${withUnit(q, r.max)}</text>`;
  return `<svg class="ch" viewBox="0 0 ${W} 68" role="img" aria-label="${x.guesses.length} guesses on the slider${showAnswer ? ", with the answer" : ""}">${s}</svg>`;
}

function hoursChart(hours) {
  const W = 340, H = 110, B = 88, mx = Math.max(1, ...hours), bw = (W - 16) / 24, peak = hours.indexOf(Math.max(...hours));
  let s = "";
  hours.forEach((c, h) => { const bh = (c / mx) * (B - 8); s += `<rect x="${8 + h * bw + 1}" y="${B - bh}" width="${bw - 2}" height="${Math.max(c ? 2 : 0, bh)}" rx="2" fill="var(--ox)" opacity="${h === peak ? 1 : 0.55}"><title>${h}:00 · ${c}</title></rect>`; });
  for (const h of [0, 6, 12, 18]) s += `<text x="${8 + h * bw}" y="${B + 16}">${h === 0 ? "midnight" : h === 12 ? "noon" : `${h}:00`}</text>`;
  return `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="Finished rounds by hour of day">${s}</svg>`;
}

// ---------- page ----------
function render(data, bank, schedule) {
  const c = crunch(data, bank, schedule), t = c.rounds.at(-1);
  const back = c.players.filter((p) => c.daysPlayed(p) > 1).length;
  const allHerd = c.rounds.filter((r) => r.totals.length);
  const beat = allHerd.reduce((a, r) => a + r.beatHerd, 0), finished = c.P.length;
  const started = c.rounds.reduce((a, r) => a + r.started, 0);
  const yBoth = c.nextDay.at(-1); // yesterday's players, and how many are back today

  const heat = (n, size) => { if (n == null) return `<td></td>`; const p = pct(n, size); return `<td style="background:color-mix(in srgb, var(--c-many) ${Math.round(12 + p * 0.75)}%, var(--card))" title="${n} of ${size}">${p}%</td>`; };

  const roundCards = c.rounds.slice(-7).reverse().map((r) => {
    const isToday = r.day === today, show = !isToday || showToday;
    const rows = r.qs.map((x) => `<div class="st-q" style="--cat:${CATS[x.q.cat].color}">
        <div class="qt"><span class="chip">${catLabel(x.q)}</span><span>${x.q.q}</span></div>
        ${questionStrip(x, show)}
        <div class="nums"><span>Answer <b>${show ? withUnit(x.q, x.q.answer) : "hidden"}</b></span><span>Herd <b>${withUnit(x.q, x.median)}</b>${show ? ` · ${x.hp} pts` : ""}</span>${show ? `<span>Players avg <b>${fmt1(x.avgPts)}</b> pts</span><span>Herd beat <b>${x.beat}%</b></span>` : ""}<span>${x.guesses.length} guesses</span></div>
      </div>`).join("");
    return `<details class="st-round" ${isToday ? "open" : ""}>
      <summary><b>Round ${r.number}</b><span class="meta">${short(r.day)} · ${r.started} played · ${r.finished} finished${show && r.totals.length ? ` · players avg ${fmt1(r.avg)}, herd ${r.herdScore}` : ""}</span><span class="chev">›</span></summary>
      <div class="body">${isToday && !showToday ? `<button class="btn st-hide" id="show-today">Show today's answers</button>` : ""}${rows}</div>
    </details>`;
  }).join("");

  el.innerHTML = `
    <header class="st-top"><a class="brand" href="/">${oxHead({ size: 34 })}<span>OxGuess stats</span></a><span class="when">${c.lastAt ? `Last guess ${ago(c.lastAt)}` : "No guesses yet"}</span></header>

    <h2 class="st-h">All time · since ${short(c.epoch)}</h2>
    <div class="st-tiles">
      ${tile("Players", c.players.length, "devices with a guess")}
      ${tile("Rounds finished", finished, `${pct(finished, started)}% of rounds started`)}
      ${tile("Played 2+ days", `${pct(back, c.players.length)}%`, `${back} of ${c.players.length} players`)}
      ${tile("Average score", fmt1(avg(c.P.map((p) => p.total))), `herd averaged ${fmt1(avg(allHerd.map((r) => r.herdScore)))}`)}
      ${tile("Beat the herd", `${pct(beat, finished)}%`, `${beat} of ${finished} rounds`)}
      ${tile("Guesses", c.G.length.toLocaleString("en-GB"), `${(c.G.length / Math.max(1, c.players.length)).toFixed(1)} per player`)}
    </div>

    <h2 class="st-h">Today · ${short(today)}</h2>
    <div class="st-tiles">
      ${tile("Played", t.started, `${t.fresh} new · ${t.returning} returning`)}
      ${tile("Finished", t.finished, `${pct(t.finished, t.started)}% of those who started`)}
      ${tile("Back from yesterday", yBoth ? `${pct(yBoth.both, yBoth.of)}%` : "–", yBoth ? `${yBoth.both} of yesterday's ${yBoth.of}` : "")}
      ${tile("Average score", fmt1(t.avg), showToday ? `herd ${t.herdScore} so far` : "herd's score shows with the answers")}
    </div>

    <h2 class="st-h">Players</h2>
    <div class="st-card">
      <h3>Players per day</h3>
      <div class="st-legend"><span><i style="background:var(--c-far)"></i>New</span><span><i style="background:var(--c-many)"></i>Returning</span></div>
      ${playersChart(c.rounds)}
      <div class="st-scroll"><table class="st-t">
        <thead><tr><th>Day</th><th>Played</th><th>New</th><th>Returning</th><th>Finished</th><th>Avg score</th><th>Herd</th><th>Best</th></tr></thead>
        <tbody>${c.rounds.slice(-14).reverse().map((r) => { const hidden = r.day === today && !showToday; return `<tr><td>${short(r.day)}</td><td>${r.started}</td><td class="dim">${r.fresh}</td><td class="dim">${r.returning}</td><td>${r.finished}</td><td>${fmt1(r.avg)}</td><td>${r.started && !hidden ? r.herdScore : "–"}</td><td>${r.best ?? "–"}</td></tr>`; }).join("")}</tbody>
      </table></div>
    </div>

    <h2 class="st-h">Retention</h2>
    <div class="st-card">
      <h3>Back the next day</h3>
      <p class="note">Of each day's players, the share who played again the day after.</p>
      <div class="st-tiles">${c.nextDay.slice(-7).reverse().map((n) => tile(`${dayNum(n.day)} → ${dayNum(shift(n.day, 1))}`, `${pct(n.both, n.of)}%`, `${n.both} of ${n.of}`)).join("")}</div>
    </div>
    <div class="st-card">
      <h3>Cohorts</h3>
      <p class="note">Players grouped by the day they first played, and the share who played again on each day after. Ever back = any later day.</p>
      <div class="st-scroll"><table class="st-cohort">
        <thead><tr><th style="text-align:left">First played</th><th style="text-align:right">Players</th>${[1, 2, 3, 4, 5, 6].map((k) => `<th>Day ${k}</th>`).join("")}<th>Ever back</th></tr></thead>
        <tbody>${c.cohorts.map((h) => `<tr><td class="lab">${short(h.day)}</td><td class="n">${h.size}</td>${h.cells.slice(1).map((n) => heat(n, h.size)).join("")}${heat(h.ever, h.size)}</tr>`).join("")}</tbody>
      </table></div>
    </div>

    <h2 class="st-h">Rounds</h2>
    <div class="st-card">
      <h3>Every score, day by day</h3>
      <div class="st-legend"><span><i style="background:var(--muted);border-radius:50%"></i>A finished round</span><span><i style="background:var(--ink);height:3px"></i>Average</span><span>${oxHead({ size: 14 })} The herd's score</span></div>
      ${scoresChart(c.rounds.map((r) => (r.day === today && !showToday ? { ...r, herdScore: 0, started: 0 } : r)))}
    </div>
    ${roundCards}

    <div class="st-two">
      <div class="st-card"><h3>When people play</h3>${hoursChart(c.hours)}<p class="note">Finished rounds by hour, last 14 days, your local time.</p></div>
      <div class="st-card st-foot">
        <h3>About these numbers</h3>
        <span>A player is a device. The herd is as players saw it: 15 starter guesses plus every real one. Every round is scored with today's rules, so older rounds can differ from what players saw at the time.</span>
        <label><input type="checkbox" id="hide-me" ${hideMe ? "checked" : ""}> Leave out this device (it played on ${c.myDays} day${c.myDays === 1 ? "" : "s"})</label>
      </div>
    </div>`;

  document.getElementById("hide-me").onchange = (e) => {
    hideMe = e.target.checked;
    try { localStorage.setItem("ox-stats-hide-me", hideMe ? "1" : "0"); } catch { /* fine */ }
    render(data, bank, schedule);
  };
  const reveal = document.getElementById("show-today");
  if (reveal) reveal.onclick = () => { showToday = true; render(data, bank, schedule); };
}

async function boot() {
  el.innerHTML = `<section class="st-card"><p class="note">Counting the herd…</p></section>`;
  try {
    const json = async (f) => (await fetch(f, { cache: "no-cache" })).json();
    const [{ questions }, { days }] = await Promise.all([json("/data/questions.json"), json("/data/schedule.json")]);
    const bank = Object.fromEntries(questions.map((q) => [q.id, q]));
    const data = await loadActivity(Object.keys(days).sort()[0]);
    render(data, bank, days);
  } catch (e) {
    el.innerHTML = `<section class="st-card"><h3>No stats yet</h3><p>${e?.code === "permission-denied" ? "Firestore won't let this page read guesses and plays. Publish the latest firestore.rules." : `Couldn't load: ${e?.message ?? e}`}</p></section>`;
  }
}
boot();
