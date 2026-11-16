// Fails the deploy if the question bank or the schedule breaks the game rules.
// Bank: unique ids the Firestore rules accept, a known category, the answer inside its slider, scores 100,
// bullseye reachable by dragging, and a source. Schedule: consecutive dates, five ids a day in category order,
// every id in the bank and not retired, and no question scheduled twice.
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

if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
const spare = questions.filter((q) => !seen[q.id] && !q.retired).length;
console.log(`${questions.length} questions, ${dates.length} days (${dates[0]} to ${dates.at(-1)}), ${spare} spare: all fine`);
