// Prints the schedule for checking, without answers: each day's questions with their slider ends, then the
// spare and retired questions in the bank.
// usage: node scripts/show-schedule.mjs [from-date]   (default: today)
import fs from "fs";
import { rangeFor, withUnit, catLabel } from "../site/js/game.js";

const read = (f) => JSON.parse(fs.readFileSync(new URL(`../site/data/${f}`, import.meta.url)));
const { questions } = read("questions.json"), { days } = read("schedule.json");
const bank = Object.fromEntries(questions.map((q) => [q.id, q]));
const dates = Object.keys(days).sort(), today = new Date().toLocaleDateString("en-CA");
const from = process.argv[2] ?? today;
const pretty = (d) => new Date(`${d}T12:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const slider = (q) => { const r = rangeFor(q); return `${withUnit(q, r.min)} to ${withUnit(q, r.max)}${q.scale === "log" ? " (log)" : ""}`; };
const row = (q) => `| ${catLabel(q)} | ${q.q.replace(/\|/g, "\\|")} | ${slider(q)} | ${q.id} |`;
const table = (qs) => ["| | Question | Slider | id |", "|---|---|---|---|", ...qs.map(row)].join("\n");

for (const d of dates.filter((d) => d >= from)) {
  console.log(`\n**Round ${dates.indexOf(d) + 1} · ${pretty(d)}${d === today ? " (today)" : ""}**\n\n${table(days[d].map((id) => bank[id]))}`);
}
const used = new Set(Object.values(days).flat());
const spare = questions.filter((q) => !used.has(q.id) && !q.retired), retired = questions.filter((q) => q.retired);
console.log(`\n**Spare (in the bank, not scheduled): ${spare.length}**\n\n${table(spare)}`);
console.log(`\n**Retired: ${retired.length}**\n\n${retired.map((q) => `- ${q.id}: ${q.q} (${q.retired})`).join("\n")}`);
console.log(`\nThe schedule ends ${pretty(dates.at(-1))}; after that it starts again from round 1.`);
