// The question editor's page: the schedule day by day, the whole bank, and an edit panel with live slider previews.
// Uses the game's own rules (game.js) so slider ends, answer positions and scores match what players see.
import { rangeFor, toPos, toValue, points, withUnit, CATS, catLabel, STEPS, THIS_YEAR } from "/site/js/game.js";
import { oxHead } from "/site/js/art.js";

const ORDER = ["when", "big", "far", "many", "wild"];
const KINDS = { "": "(category default)", height: "How tall", weight: "How heavy", length: "How long", hot: "How hot", fast: "How fast", old: "How old", time: "How long (time)", other: "Other" };
const UNITS = ["", "km", "m", "cm", "t", "kg", "s", "min", "km/h", "years", "°C"];
const el = document.getElementById("ed");
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const shift = (k, n) => { const d = dateOf(k); d.setDate(d.getDate() + n); return keyOf(d); };
const nice = (k) => dateOf(k).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const today = keyOf(new Date());
// Your own mark for each day, clicked through in turn. Untouched is the default (what Claude filled in).
const MARKS = { "": ["untouched", "Untouched"], doing: ["doing", "In progress"], ready: ["ready", "Ready"] }, NEXT = { "": "doing", doing: "ready", ready: "" };
const TICK = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const mark = (d) => { const m = MARKS[REVIEW[d] ?? ""]; return `<button class="mark ${m[0]}" data-mark="${d}" title="Click to change: untouched, in progress, ready">${m[0] === "ready" ? TICK : ""}${m[1]}</button>`; };
// Your own "this question is ready" tick, per question. Click to toggle, in the bank, the schedule or the edit panel.
const readyBtn = (id) => { const on = READY.has(id); return `<button class="qready ${on ? "on" : ""}" data-ready="${esc(id)}" title="${on ? "Ready. Click to unmark" : "Not marked ready. Click to mark it ready"}" aria-pressed="${on}">${on ? TICK : ""}</button>`; };
const WARN = `<svg class="warn-ico" viewBox="0 0 24 24" width="20" height="20" aria-label="Careful"><path d="M12 3 2 21h20L12 3z" fill="var(--c-when)" stroke="var(--ink)" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 10v5" stroke="var(--ink)" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="18" r="1.3" fill="var(--ink)"/></svg>`;

let Q = [], DAYS = {}, IDEAS = [], REVIEW = {}, READY = new Set(), HASH = "", saved = new Set();
// unpushed: saved here but not on GitHub yet. L: the live check from /api/live (null until it answers).
let dirty = false, unpushed = false, L = null, report = null, reportOk = true, busy = false;
let view = "schedule", editing = null, filter = { status: "bank", cat: "", ready: "", text: "" }, showPast = false, showToday = false;

const byId = () => Object.fromEntries(Q.map((q) => [q.id, q]));
const dateOfId = () => { const m = {}; for (const [d, ids] of Object.entries(DAYS)) for (const id of ids) m[id] = d; return m; };
const touch = () => { dirty = true; report = null; };

// ---------- slider maths ----------
const rangeA = (q) => { try { const r = rangeFor(q); return Number.isFinite(r.min) && Number.isFinite(r.max) ? r : null; } catch { return null; } };
const rangeB = (q) => (q.minB != null && q.maxB != null ? { min: q.minB, max: q.maxB } : null);
const at = (q, r, v) => { try { const p = toPos(q, r, v) / STEPS; return Number.isFinite(p) ? p : null; } catch { return null; } };
const fmt = (q, v) => { try { return withUnit(q, v); } catch { return String(v); } };
function problemsOf(q, r) {
  if (!r) return [];
  const out = [], p = at(q, r, q.answer);
  if (q.scale === "log" && r.min <= 0) out.push("A log slider can't start at 0 or below.");
  if (!(r.min < r.max)) out.push("The low end must be below the high end.");
  else if (p == null || p < 0 || p > 1) out.push("The answer is outside the slider.");
  else if (p < 0.05 || p > 0.95) out.push("The answer sits right at one end, which gives it away.");
  return out;
}
function mirror(q) {
  const r = rangeA(q); if (!r) return null;
  const p = at(q, r, q.answer); if (p == null) return null;
  if (q.scale === "log") {
    const w = Math.log10(r.max / r.min), lo = Math.log10(q.answer) - (1 - p) * w;
    return { min: Number((10 ** lo).toPrecision(2)), max: Number((10 ** (lo + w)).toPrecision(2)) };
  }
  const w = r.max - r.min; let min = q.answer - (1 - p) * w, max = min + w;
  if (q.scale === "year" && max > THIS_YEAR) { max = THIS_YEAR; min = max - w; }
  const round = q.scale === "year" || Number.isInteger(r.min) ? Math.round : (v) => Math.round(v * 10) / 10;
  return { min: round(min), max: round(max) };
}
/** Short labels for the scale drawings: 1,500 · 25k · 2.5m · 350 BC. */
function short(q, v) {
  if (q.scale === "year") return v < 0 ? `${-v} BC` : String(v);
  const a = Math.abs(v), n = (x) => Number(x.toPrecision(4)).toLocaleString("en-GB");
  return a >= 1e9 ? `${n(v / 1e9)}bn` : a >= 1e6 ? `${n(v / 1e6)}m` : a >= 1e4 ? `${n(v / 1e3)}k` : n(v);
}
/** A and B drawn on one shared scale, from the lower of the two low ends to the higher of the two high ends, so you
 *  can see at a glance how differently the answer sits on each. Grey ticks are each slider's middle. */
function pair(q, big = false) {
  const A = rangeA(q), B = rangeB(q), rs = [A, B].filter(Boolean);
  if (!rs.length) return `<div class="pair"><span></span><span class="muted small">No slider yet</span></div>`;
  const log = q.scale === "log" && rs.every((r) => r.min > 0) && q.answer > 0;
  const lo = Math.min(...rs.map((r) => r.min)), hi = Math.max(...rs.map((r) => r.max));
  const x = (v) => { const t = log ? Math.log(v / lo) / Math.log(hi / lo) : (v - lo) / (hi - lo); return Math.max(0, Math.min(1, t)) * 100; };
  const ax = Number.isFinite(q.answer) ? x(q.answer) : null;
  const row = (label, r) => {
    if (!r) return `<span class="pl">${label}</span><div class="ptrack"><span class="none">no ${label} slider</span></div>`;
    const a = x(r.min), b = x(r.max), mid = toValue(q, r, STEPS / 2);
    return `<span class="pl">${label}</span><div class="ptrack"><i class="seg ${label}" style="left:${a}%;width:${b - a}%"></i><i class="mid" style="left:${x(mid)}%"></i>${ax != null ? `<i class="ans" style="left:${ax}%"></i>` : ""}<span class="lo" style="left:${a}%">${esc(short(q, r.min))}</span><span class="hi" style="left:${b}%">${esc(short(q, r.max))}</span></div>`;
  };
  return `<div class="pair ${big ? "big" : ""}" title="A and B on one scale. Green: the answer. Grey: each slider's middle.">
    <span></span><div class="phead">${ax != null ? `<span class="aval" style="left:${ax}%">${esc(short(q, q.answer))}</span>` : ""}</div>
    ${row("A", A)}${row("B", B)}</div>`;
}

// ---------- top bar ----------
function topBar() {
  const state = busy ? ["", "Saving and publishing…"] : dirty ? ["warn", "Unsaved changes"] : !reportOk ? ["bad", "Saved, not live: see below"] : liveBadge();
  const retry = !busy && !dirty && !unpushed && L && !L.live && L.deploy?.current && L.deploy.conclusion === "failure";
  return `<div class="ed-bar">
    <h1>${oxHead({ size: 30 })} OxGuess questions</h1>
    <span class="ed-state ${state[0]}">${state[1]}</span>
    <div class="ed-tabs"><button data-view="schedule" class="${view === "schedule" ? "on" : ""}">Schedule</button><button data-view="bank" class="${view === "bank" ? "on" : ""}">Bank</button><button data-view="ideas" class="${view === "ideas" ? "on" : ""}">Ideas (${IDEAS.length})</button></div>
    <button class="btn" id="reload" ${busy ? "disabled" : ""}>Reload</button>
    <input id="msg" placeholder="What changed? (optional)" style="font:600 13px var(--body);padding:8px 10px;border-radius:10px;border:2px solid var(--line);min-width:180px">
    ${retry ? `<button class="btn" id="redeploy" title="GitHub's deploy failed after the push. This runs it again.">Retry deploy</button>` : ""}
    <button class="btn primary" id="save" ${(!dirty && !unpushed) || busy ? "disabled" : ""} title="Saves, runs the check and, if it passes, publishes: the game updates in about a minute">Save and publish</button>
  </div>${report ? `<div class="ed-report ${reportOk ? "" : "bad"}">${esc(report)}</div>` : ""}${notLive()}`;
}
// The badge says what oxguess.com is actually serving, never what the push hoped for.
function liveBadge() {
  if (unpushed) return ["warn", "Saved, not published"];
  if (!L) return ["", "Checking the live game…"];
  if (L.error) return ["warn", "Can't check the live game"];
  if (L.live) return ["good", "Live"];
  const d = L.deploy;
  if (d?.current && d.status !== "completed") return ["", "Going live…"];
  if (d?.current && d.conclusion === "failure") return ["bad", "Not live: the deploy failed"];
  return ["warn", "Not live yet"];
}
function notLive() {
  if (dirty || !L || L.live || L.error || unpushed) return L?.error && !dirty ? `<div class="ed-report bad">${esc(L.error)}</div>` : "";
  const d = L.deploy, failed = d?.current && d.conclusion === "failure";
  return `<div class="ed-report ${failed ? "bad" : ""}">${failed ? `GitHub's deploy failed after your changes were pushed, so oxguess.com still has the old questions. Retry deploy runs it again.` : `oxguess.com doesn't have these yet.`}${L.todayChanges ? `\nGoing live will change today's round: anyone who has already played today starts again.` : ""}${d?.url ? `\nDeploy: ${d.url}` : ""}</div>`;
}

// ---------- schedule ----------
function slot(d, j, locked) {
  const id = DAYS[d][j], q = byId()[id], cat = ORDER[j], used = dateOfId();
  const spares = Q.filter((x) => x.cat === cat && !used[x.id] && !x.retired);
  const later = Object.keys(DAYS).filter((k) => k > today && k !== d && byId()[DAYS[k][j]]).sort();
  const pick = locked ? "" : `<select data-swap="${d}|${j}"><option value="">Swap for…</option>
    ${spares.length ? `<optgroup label="Spare ${CATS[cat].label} questions">${spares.map((x) => `<option value="spare:${x.id}">${esc(x.q.slice(0, 70))}</option>`).join("")}</optgroup>` : ""}
    ${later.length ? `<optgroup label="Swap days with">${later.map((k) => `<option value="day:${k}">${nice(k)}: ${esc(byId()[DAYS[k][j]].q.slice(0, 50))}</option>`).join("")}</optgroup>` : ""}
  </select>`;
  if (!q) return `<div class="ed-slot" style="--cat:${CATS[cat].color}"><span class="ed-chip">${CATS[cat].label}</span><span class="ed-q ed-warn">${id ? `${esc(id)} isn't in the bank` : "Empty: pick a question"}</span><span></span><span></span><div class="ed-acts">${pick}</div></div>`;
  return `<div class="ed-slot" style="--cat:${CATS[cat].color}">
    <span class="ed-chip">${esc(catLabel(q))}</span>
    <span class="ed-q">${locked ? "" : readyBtn(q.id)}<span><b>${esc(q.q)}</b><br><span class="id">${esc(q.id)}</span></span></span>
    <span class="ed-ans">${esc(fmt(q, q.answer))}</span>
    ${pair(q)}
    <div class="ed-acts"><button class="btn" data-edit="${esc(q.id)}">Edit</button>${pick}</div>
  </div>`;
}
function schedule() {
  const dates = Object.keys(DAYS).sort(), past = dates.filter((d) => d < today), rest = dates.filter((d) => d >= today);
  if (!dates.length) return `<p class="muted">Loading the questions…</p>`;
  const day = (d) => {
    const isToday = d === today, locked = d < today;
    // Today is in play, so it stays folded away unless you open it on purpose.
    if (isToday && !showToday) return `<section class="ed-day today folded"><h3>${WARN}${nice(d)} <small>Round ${dates.indexOf(d) + 1} · today, in play</small>${mark(d)}</h3>
      <span class="note">Editing today restarts the round for anyone who has already started it.</span><button class="btn" id="today">Show today's questions</button></section>`;
    const n = DAYS[d].filter((id) => READY.has(id)).length;
    return `<section class="ed-day ${isToday ? "today" : ""} ${locked ? "past" : ""}">
      <h3>${isToday ? WARN : ""}${nice(d)} <small>Round ${dates.indexOf(d) + 1}${isToday ? " · today, in play" : ""}${locked ? " · played, can't change" : ""}</small>${locked ? "" : `${mark(d)}<small class="qcount ${n === DAYS[d].length ? "all" : ""}">${n} of ${DAYS[d].length} questions ready</small>`}${isToday ? `<button class="btn" id="today" style="margin-left:auto">Fold away</button>` : ""}</h3>
      ${isToday ? `<span class="note">Editing today restarts the round for anyone who has already started it.</span>` : ""}
      ${DAYS[d].map((_, j) => slot(d, j, locked)).join("")}
    </section>`;
  };
  const last = dates.at(-1);
  const counts = { ready: 0, doing: 0, "": 0 }; for (const d of rest) counts[REVIEW[d] ?? ""]++;
  const summary = `<div class="ed-tools"><span class="mark ready">${TICK}Ready ${counts.ready}</span><span class="mark doing">In progress ${counts.doing}</span><span class="mark untouched">Untouched ${counts[""]}</span><span class="muted small">of ${rest.length} days to come. Click a day's mark to change it.</span></div>`;
  return `${summary}${past.length ? `<button class="btn" id="past">${showPast ? "Hide" : "Show"} ${past.length} played day${past.length === 1 ? "" : "s"}</button>` : ""}
    ${showPast ? past.map(day).join("") : ""}
    ${rest.map(day).join("")}
    <div class="ed-tools"><button class="btn primary" id="add-day">Add ${nice(shift(last, 1))}</button>${last > today ? `<button class="btn" id="drop-day">Remove ${nice(last)}</button>` : ""}
      <span class="muted small">${Q.filter((q) => !dateOfId()[q.id] && !q.retired).length} spare questions in the bank. The schedule runs to ${nice(last)}; after that the game repeats from round 1.</span></div>`;
}

// ---------- bank ----------
function bank() {
  const used = dateOfId(), t = filter.text.toLowerCase();
  // Bank = everything still to come (scheduled from tomorrow, plus spares): the list you edit most.
  const status = (q) => (q.retired ? "retired" : !used[q.id] ? "spare" : used[q.id] < today ? "played" : used[q.id] === today ? "today" : "scheduled");
  const group = (q) => ({ spare: "bank", scheduled: "bank" })[status(q)] ?? status(q);
  const rows = Q.filter((q) => group(q) === filter.status && (!filter.cat || q.cat === filter.cat) && (!filter.ready || READY.has(q.id) === (filter.ready === "ready")) && (!t || `${q.id} ${q.q}`.toLowerCase().includes(t)))
    .sort((a, b) => (used[a.id] ?? "9999").localeCompare(used[b.id] ?? "9999") || ORDER.indexOf(a.cat) - ORDER.indexOf(b.cat) || a.id.localeCompare(b.id));
  return `<div class="ed-tools">
      <button class="btn primary" id="new">New question</button>
      <input id="f-text" placeholder="Search" value="${esc(filter.text)}">
      <select id="f-status">${[["bank", "Bank (coming up and spare)"], ["today", "Today"], ["played", "Played"], ["retired", "Retired"]].map(([v, l]) => `<option value="${v}" ${filter.status === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      <select id="f-ready">${[["", "Ready or not"], ["ready", "Ready"], ["not", "Not ready"]].map(([v, l]) => `<option value="${v}" ${filter.ready === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      <select id="f-cat"><option value="">Every category</option>${ORDER.map((c) => `<option value="${c}" ${filter.cat === c ? "selected" : ""}>${CATS[c].label}</option>`).join("")}</select>
      <span class="muted small">${rows.length} of ${Q.length}</span>
    </div>
    <table class="ed-bank"><thead><tr><th>Ready</th><th>Status</th><th>Category</th><th>Question</th><th>Answer</th><th style="width:320px">Sliders A and B</th></tr></thead><tbody>
    ${rows.map((q) => { const s = status(q); return `<tr data-edit="${esc(q.id)}" style="--cat:${CATS[q.cat].color}">
      <td>${readyBtn(q.id)}</td>
      <td class="st ${s}">${s === "scheduled" ? nice(used[q.id]) : s === "played" ? `Played ${nice(used[q.id])}` : s === "today" ? "Today" : s === "spare" ? "Spare" : "Retired"}</td>
      <td><span class="ed-chip">${esc(catLabel(q))}</span></td><td>${esc(q.q)}<br><span class="muted" style="font:600 11px ui-monospace,Menlo,monospace">${esc(q.id)}</span></td>
      <td>${esc(fmt(q, q.answer))}</td><td>${pair(q)}</td></tr>`; }).join("")}
    </tbody></table>`;
}

// ---------- ideas ----------
function ideas() {
  return `<div class="ed-tools"><input id="idea-new" placeholder="Add an idea, then press Enter" style="flex:1;min-width:240px"><button class="btn primary" id="idea-add">Add</button>
      <span class="muted small">Rough ideas, newest first. Saved with everything else in docs/question-ideas.md.</span></div>
    <div class="ed-ideas">${IDEAS.map((t, i) => `<div class="ed-idea"><input data-idea="${i}" value="${esc(t)}"><button class="btn" data-idea-del="${i}">Remove</button></div>`).join("") || `<p class="muted">No ideas yet.</p>`}</div>`;
}
const addIdea = () => { const box = document.getElementById("idea-new"), t = box.value.trim(); if (!t) return; IDEAS.unshift(t); touch(); draw(); document.getElementById("idea-new").focus(); };

// ---------- edit panel ----------
function preview(q) {
  const one = (label, r, isB) => {
    if (!r) return `<div class="ed-slider"><span class="muted small">${isB ? "No B slider yet." : "Set the low and high ends (even sliders need both)."}</span>${isB ? `<button class="btn" data-mirror style="align-self:flex-start">Make B by mirroring A</button>` : ""}</div>`;
    const p = at(q, r, q.answer), probs = problemsOf(q, r);
    return `<div class="ed-slider"><div class="top"><span>${label}: ${esc(fmt(q, r.min))} to ${esc(fmt(q, r.max))}</span><span>${p != null ? `answer ${Math.round(p * 100)}% along · middle ${esc(fmt(q, toValue(q, r, STEPS / 2)))}` : ""}</span></div>
      ${probs.map((m) => `<span class="ed-warn">${m}</span>`).join("")}</div>`;
  };
  const a = q.answer, misses = !Number.isFinite(a) ? [] : q.scale === "year" ? [a - 5, a - 20, a - 50] : q.unit === "years" ? [a + 2, a + 5, a + 10] : q.unit === "°C" ? [a + 5, a + 20, a + 50] : [a * 1.1, a * 1.5, a * 2];
  return `<div class="ed-prev"><h4>Preview</h4>
    ${pair(q, true)}
    ${one(`Slider A${q.min == null ? " (made from the answer)" : ""}`, rangeA(q), false)}
    ${one("Slider B", rangeB(q), true)}
    ${misses.length ? `<span class="ed-misses">Scoring: ${misses.map((g) => `${esc(fmt(q, Number(g.toPrecision(4))))} scores ${points(q, g)}`).join(" · ")}</span>` : ""}
  </div>`;
}
function panel() {
  const q = byId()[editing]; if (!q) return "";
  const when = dateOfId()[q.id], isNew = !saved.has(q.id);
  const num = (k) => (q[k] ?? "");
  const f = (key, label, html, cls = "") => `<label class="ed-f ${cls}">${label}${html}</label>`;
  const input = (key, val, type = "text", extra = "") => `<input data-k="${key}" type="${type}" value="${esc(val)}" ${extra}>`;
  return `<div class="ed-shade" id="shade"></div><aside class="ed-panel" style="--cat:${CATS[q.cat].color}">
    <h2><span>${isNew ? "New question" : "Edit question"}</span><span class="ed-ready">${readyBtn(q.id)} Ready</span><button class="btn primary" id="done">Done</button></h2>
    ${when && when <= today ? `<span class="ed-warn">Played on ${nice(when)}. Changing its answer or slider changes how that day's stored herd reads.</span>` : when ? `<span class="muted small">Scheduled for ${nice(when)}.</span>` : `<span class="muted small">Not scheduled (spare).</span>`}
    <div class="ed-grid">
      ${f("id", "Id", input("id", q.id, "text", isNew ? 'placeholder="e.g. far-sydney-uluru"' : "readonly"), "w2")}
      ${f("cat", "Category", `<select data-k="cat">${ORDER.map((c) => `<option value="${c}" ${q.cat === c ? "selected" : ""}>${CATS[c].label}</option>`).join("")}</select>`)}
      ${f("kind", "Label", `<select data-k="kind">${Object.entries(KINDS).map(([k, l]) => `<option value="${k}" ${(q.kind ?? "") === k ? "selected" : ""}>${l}</option>`).join("")}</select>`)}
      ${f("q", "Question", `<textarea data-k="q">${esc(q.q)}</textarea>`, "w4")}
      ${f("answer", "Answer", input("answer", num("answer"), "number", 'step="any"'))}
      ${f("unit", "Unit", `<select data-k="unit">${UNITS.map((u) => `<option value="${u}" ${(q.unit ?? "") === u ? "selected" : ""}>${u || "(count or year)"}</option>`).join("")}</select>`)}
      ${f("scale", "Slider", `<select data-k="scale">${[["log", "Log (amounts)"], ["lin", "Even"], ["year", "Year"]].map(([v, l]) => `<option value="${v}" ${q.scale === v ? "selected" : ""}>${l}</option>`).join("")}</select>`)}
      ${f("alt", "Imperial note", input("alt", q.alt ?? "", "text", 'placeholder="e.g. 883 ft"'))}
      ${f("min", "A low end", input("min", num("min"), "number", 'step="any" placeholder="auto"'))}
      ${f("max", "A high end", input("max", num("max"), "number", 'step="any" placeholder="auto"'))}
      ${f("minB", "B low end", input("minB", num("minB"), "number", 'step="any" placeholder="none"'))}
      ${f("maxB", "B high end", input("maxB", num("maxB"), "number", 'step="any" placeholder="none"'))}
    </div>
    <div id="preview">${preview(q)}</div>
    <div class="ed-grid">
      ${f("fact", "Fact shown after the answer", `<textarea data-k="fact">${esc(q.fact)}</textarea>`, "w4")}
      ${f("source.name", "Source name", input("source.name", q.source?.name ?? ""), "w2")}
      ${f("source.url", "Source link", input("source.url", q.source?.url ?? "", "url"), "w2")}
      ${f("evidence", "Evidence (the line in the source that gives the answer)", `<textarea data-k="evidence">${esc(q.evidence)}</textarea>`, "w4")}
      ${f("retired", "Retired because (leave empty to keep it in play)", input("retired", q.retired ?? ""), "w4")}
    </div>
    ${isNew ? `<button class="btn" id="delete" style="align-self:flex-start">Delete this new question</button>` : ""}
  </aside>`;
}

function setField(q, k, raw) {
  const nums = ["answer", "min", "max", "minB", "maxB"];
  if (k === "id") {
    const id = raw.trim().toLowerCase();
    if (!/^[a-z0-9-]{1,24}$/.test(id) || (id !== q.id && byId()[id])) return false;
    for (const ids of Object.values(DAYS)) ids.forEach((x, i) => { if (x === q.id) ids[i] = id; });
    q.id = id; editing = id; return true;
  }
  if (k.startsWith("source.")) { q.source = { ...(q.source ?? {}), [k.slice(7)]: raw.trim() }; return true; }
  if (nums.includes(k)) { const v = raw === "" ? null : Number(raw); if (v === null) delete q[k]; else if (Number.isFinite(v)) q[k] = v; return true; }
  if (k === "kind") { q.kind = raw || null; return true; }
  if (k === "alt") { q.alt = raw.trim() || null; return true; }
  if (k === "retired") { if (raw.trim()) q.retired = raw.trim(); else delete q.retired; return true; }
  q[k] = raw; return true;
}

// ---------- drawing and events ----------
function draw() {
  const scroll = window.scrollY;
  el.innerHTML = `${topBar()}${view === "schedule" ? schedule() : view === "bank" ? bank() : ideas()}${editing ? panel() : ""}`;
  window.scrollTo(0, scroll);
}

el.addEventListener("click", async (e) => {
  const t = e.target.closest("button, tr[data-edit]");
  if (!t) { if (e.target.id === "shade") { editing = null; draw(); } return; }
  if (t.dataset.view) { view = t.dataset.view; draw(); }
  else if (t.dataset.edit) { editing = t.dataset.edit; draw(); }
  else if (t.id === "done") { editing = null; draw(); }
  else if (t.id === "past") { showPast = !showPast; draw(); }
  else if (t.id === "today") { showToday = !showToday; draw(); }
  else if (t.dataset.ready) { const id = t.dataset.ready; if (READY.has(id)) READY.delete(id); else READY.add(id); touch(); draw(); }
  else if (t.dataset.mark) { const d = t.dataset.mark, n = NEXT[REVIEW[d] ?? ""]; if (n) REVIEW[d] = n; else delete REVIEW[d]; touch(); draw(); }
  else if (t.id === "reload") { if (!dirty || confirm("Throw away your unsaved changes and reload?")) await load(); }
  else if (t.id === "save") await save();
  else if (t.id === "redeploy") await redeploy();
  else if (t.id === "idea-add") addIdea();
  else if (t.dataset.ideaDel !== undefined) { IDEAS.splice(Number(t.dataset.ideaDel), 1); touch(); draw(); }
  else if (t.id === "new") {
    let n = 1; while (byId()[`new-${n}`]) n++;
    Q.push({ id: `new-${n}`, cat: "far", kind: null, q: "", answer: null, unit: "km", alt: null, scale: "log", fact: "", source: { name: "", url: "" }, evidence: "" });
    editing = `new-${n}`; touch(); draw();
  } else if (t.id === "delete") { Q = Q.filter((q) => q.id !== editing); for (const ids of Object.values(DAYS)) ids.forEach((x, i) => { if (x === editing) ids[i] = ""; }); editing = null; touch(); draw(); }
  else if (t.id === "add-day") {
    const dates = Object.keys(DAYS).sort(), next = shift(dates.at(-1), 1), used = dateOfId();
    DAYS[next] = ORDER.map((c) => { const q = Q.find((x) => x.cat === c && !used[x.id] && !x.retired); if (q) used[q.id] = next; return q?.id ?? ""; });
    touch(); draw();
  } else if (t.id === "drop-day") { const last = Object.keys(DAYS).sort().at(-1); delete DAYS[last]; touch(); draw(); }
  else if (t.dataset.mirror !== undefined) { const q = byId()[editing], m = mirror(q); if (m) { q.minB = m.min; q.maxB = m.max; touch(); draw(); } }
});

el.addEventListener("change", (e) => {
  const s = e.target;
  if (s.dataset.swap) {
    const [d, j] = s.dataset.swap.split("|"), [kind, val] = s.value.split(":");
    if (kind === "spare") DAYS[d][j] = val;
    else if (kind === "day") [DAYS[d][j], DAYS[val][j]] = [DAYS[val][j], DAYS[d][j]];
    if (kind) { touch(); draw(); }
  } else if (s.id === "f-status") { filter.status = s.value; draw(); }
  else if (s.id === "f-cat") { filter.cat = s.value; draw(); }
  else if (s.id === "f-ready") { filter.ready = s.value; draw(); }
  else if (s.dataset.k) {
    const q = byId()[editing];
    if (!setField(q, s.dataset.k, s.value)) { s.style.borderColor = "var(--stamp)"; return; }
    s.style.borderColor = ""; touch();
    if (s.dataset.k === "cat") draw(); else { document.getElementById("preview").innerHTML = preview(byId()[editing]); el.querySelector(".ed-state").outerHTML = `<span class="ed-state warn">Unsaved changes</span>`; el.querySelector("#save").disabled = false; }
  }
});
el.addEventListener("input", (e) => {
  const s = e.target;
  if (s.dataset.idea !== undefined) { IDEAS[Number(s.dataset.idea)] = s.value; touch(); const st = el.querySelector(".ed-state"); if (st) { st.className = "ed-state warn"; st.textContent = "Unsaved changes"; } el.querySelector("#save").disabled = false; return; }
  if (s.id === "f-text") { filter.text = s.value; const pos = s.selectionStart; draw(); const n = document.getElementById("f-text"); n.focus(); n.setSelectionRange(pos, pos); }
  else if (s.dataset.k && s.tagName !== "SELECT" && s.dataset.k !== "id") { const q = byId()[editing]; if (setField(q, s.dataset.k, s.value)) { touch(); document.getElementById("preview").innerHTML = preview(q); } }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "idea-new") { e.preventDefault(); addIdea(); return; } if (e.key === "Escape" && editing) { editing = null; draw(); } if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); if (dirty) save(); } });
window.addEventListener("beforeunload", (e) => { if (dirty) e.preventDefault(); });

// ---------- talking to the server ----------
async function load() {
  busy = true; draw();
  const d = await (await fetch("/api/data", { cache: "no-store" })).json();
  Q = d.questions; DAYS = d.days; IDEAS = d.ideas ?? []; REVIEW = d.review ?? {}; READY = new Set(d.ready ?? []); HASH = d.hash; unpushed = d.unpublished; saved = new Set(Q.map((q) => q.id));
  dirty = false; busy = false; report = null; reportOk = true; editing = null; draw();
  watchLive();
}
// Ask the server whether the game is live; while a deploy is on its way, ask again every 10 seconds (for up to
// 15 minutes: Pages can take a while to serve a new copy).
let watching = null;
async function checkLive() {
  L = await (await fetch("/api/live", { cache: "no-store" })).json().catch(() => ({ error: "Couldn't reach the editor's server." }));
  if (L.live && report?.startsWith("Saved and sent")) report = "Live: the game has these now.";
  if (!dirty && !busy) draw();
  return L;
}
async function watchLive() {
  clearTimeout(watching);
  const until = Date.now() + 15 * 60 * 1000;
  const tick = async () => {
    const l = await checkLive();
    const waiting = !l.error && !l.live && !unpushed && !(l.deploy?.current && l.deploy.conclusion === "failure");
    if (waiting && Date.now() < until) watching = setTimeout(tick, 10000);
  };
  tick();
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && !busy) watchLive(); });
async function save() {
  busy = true; draw();
  const message = document.getElementById("msg")?.value.trim();
  const r = await fetch("/api/save", { method: "POST", body: JSON.stringify({ questions: Q, days: DAYS, ideas: IDEAS.map((t) => t.trim()).filter(Boolean), review: REVIEW, ready: [...READY], hash: HASH, message: message ? `Questions: ${message}` : "" }) });
  const d = await r.json();
  busy = false;
  if (!r.ok) { report = d.error ?? "Save failed."; reportOk = false; draw(); return; }
  HASH = d.hash; dirty = false; unpushed = !d.ok; reportOk = d.ok; report = d.report; saved = new Set(Q.map((q) => q.id));
  L = null; draw();
  if (d.ok) watchLive();
}
async function redeploy() {
  if (L?.todayChanges && !confirm("Going live will change today's round: anyone who has already played today starts again. Deploy anyway?")) return;
  busy = true; draw();
  const d = await (await fetch("/api/redeploy", { method: "POST" })).json();
  busy = false; report = d.report; reportOk = d.ok; L = null; draw();
  if (d.ok) setTimeout(watchLive, 5000);
}
load();
