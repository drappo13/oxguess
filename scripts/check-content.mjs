// Fails the deploy if the question bank or the schedule breaks the game rules.
// Bank: unique ids the Firestore rules accept, a known category, the answer inside its slider, scores 100,
// bullseye reachable by dragging, a source, and slider B (if any) has both ends with the answer inside. Schedule: consecutive dates, five ids a day in category order,
// every id in the bank and not retired, and no question scheduled twice.
// With --live (CI and the question editor run it this way): today and every day before it must match what
// oxguess.com is serving, so a deploy can never change a round people are playing or have played. "Today" is the UK
// date. --allow-played skips that, for a deliberate fix (say, a wrong answer today).
import fs from "fs";
import { rangeFor, score, toValue, toPos, STEPS, CATS } from "../site/js/game.js";

const read = (f) => JSON.parse(fs.readFileSync(new URL(`../site/data/${f}`, import.meta.url)));
const { questions } = read("questions.json"), { days } = read("schedule.json");
const ORDER = ["when", "big", "far", "many", "wild"];
const problems = [], bank = {};

for (const q of questions) {
  if (bank[q.id]) problems.push(`${q.id}: id used twice in the bank`);
  bank[q.id] = q;
  if (!/^[a-z0-9-]{1,24}$/.test(q.id)) problems.push(`${q.id}: id must be 1-24 of a-z, 0-9 and -`);
  if (!CATS[q.cat]) { problems.push(`${q.id}: unknown category ${q.cat}`); continue; }
  const r = rangeFor(q), p = toPos(q, r, q.answer);
  if (!(q.answer >= r.min && q.answer <= r.max)) problems.push(`${q.id}: answer outside slider`);
  if (score(q, q.answer) !== 100) problems.push(`${q.id}: answer doesn't score 100`);
  const best = Math.max(...[-2, -1, 0, 1, 2].map((k) => score(q, toValue(q, r, Math.min(STEPS, Math.max(0, p + k))))));
  if (best < 100) problems.push(`${q.id}: bullseye not reachable by dragging`);
  if (!q.source?.url) problems.push(`${q.id}: no source`);
  // Optional second slider for the A/B test: both ends or neither, answer well inside.
  if ((q.minB == null) !== (q.maxB == null)) problems.push(`${q.id}: slider B needs both ends`);
  else if (q.minB != null) {
    const pb = toPos({ ...q, min: q.minB, max: q.maxB }, { min: q.minB, max: q.maxB }, q.answer) / STEPS;
    if (q.scale === "log" && q.minB <= 0) problems.push(`${q.id}: slider B can't start at 0 on a log scale`);
    else if (!(pb > 0 && pb < 1)) problems.push(`${q.id}: answer outside slider B`);
  }
}

const dates = Object.keys(days).sort(), seen = {};
dates.forEach((d, i) => {
  if (i && Date.parse(d) - Date.parse(dates[i - 1]) !== 86400000) problems.push(`${d}: not the day after ${dates[i - 1]}`);
  const ids = days[d];
  if (ids.length !== 5) problems.push(`${d}: ${ids.length} questions`);
  ids.forEach((id, j) => {
    const q = bank[id];
    if (!q) return problems.push(`${d}: ${id} is not in the bank`);
    if (q.retired) problems.push(`${d}: ${id} is retired (${q.retired})`);
    if (q.cat !== ORDER[j]) problems.push(`${d}: slot ${j + 1} should be ${ORDER[j]}, ${id} is ${q.cat}`);
    if (seen[id]) problems.push(`${d}: ${id} is also on ${seen[id]}`);
    seen[id] = d;
  });
});

// ---- today and the past are frozen ----
// What a player sees or is scored against. Facts and sources can still be corrected.
const PLAYED = ["cat", "q", "answer", "unit", "alt", "scale", "min", "max", "minB", "maxB"];
let frozen = "";
if (process.argv.includes("--live") && !process.argv.includes("--allow-played")) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const live = async (f) => {
    const r = await fetch(`https://oxguess.com/data/${f}?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) throw new Error(`oxguess.com said ${r.status} for ${f}`);
    return r.json();
  };
  try {
    const [lq, ls] = await Promise.all([live("questions.json"), live("schedule.json")]);
    const lbank = Object.fromEntries(lq.questions.map((q) => [q.id, q])), was = [];
    for (const d of Object.keys(ls.days).filter((d) => d <= today)) {
      const label = d === today ? `${d} (today)` : d;
      if (JSON.stringify(days[d]) !== JSON.stringify(ls.days[d])) { was.push(`${label}: the questions changed (live: ${ls.days[d].join(", ")})`); continue; }
      for (const id of ls.days[d]) {
        const changed = PLAYED.filter((k) => JSON.stringify(bank[id]?.[k]) !== JSON.stringify(lbank[id]?.[k]));
        if (changed.length) was.push(`${label}: ${id} changed (${changed.join(", ")})`);
      }
    }
    if (was.length) problems.push("Today and earlier days must stay as they are live (deploy with --allow-played to override):", ...was);
    else frozen = `, today (${today}) and earlier match the live game`;
  } catch (e) {
    problems.push(`Couldn't check against the live game, so not deploying: ${e.message ?? e}`);
  }
}

if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
const spare = questions.filter((q) => !seen[q.id] && !q.retired).length;
console.log(`${questions.length} questions, ${dates.length} days (${dates[0]} to ${dates.at(-1)}), ${spare} spare: all fine${frozen}`);
