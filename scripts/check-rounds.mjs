// Fails the deploy if any question breaks the game rules (answer outside its slider, can't score 100,
// bullseye unreachable by dragging, or no source).
import fs from "fs";
import { rangeFor, score, toValue, toPos, STEPS, CATS } from "../site/js/game.js";

const d = JSON.parse(fs.readFileSync(new URL("../site/data/rounds.json", import.meta.url)));
const problems = [];
for (const day of d.days) {
  if (day.questions.length !== 5) problems.push(`day ${day.day}: ${day.questions.length} questions`);
  for (const q of day.questions) {
    const r = rangeFor(q), p = toPos(q, r, q.answer);
    if (!CATS[q.cat]) problems.push(`${q.id}: unknown category ${q.cat}`);
    if (!(q.answer >= r.min && q.answer <= r.max)) problems.push(`${q.id}: answer outside slider`);
    if (score(q, q.answer) !== 100) problems.push(`${q.id}: answer doesn't score 100`);
    const best = Math.max(...[-2, -1, 0, 1, 2].map((k) => score(q, toValue(q, r, Math.min(STEPS, Math.max(0, p + k))))));
    if (best < 100) problems.push(`${q.id}: bullseye not reachable by dragging`);
    if (!q.source?.url) problems.push(`${q.id}: no source`);
  }
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
console.log(`${d.days.length} days, ${d.days.length * 5} questions: all fine`);
