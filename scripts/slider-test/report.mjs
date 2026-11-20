// The slider A/B test report: every real guess on slider A and slider B, drawn per question, as one HTML page.
//
//   node scripts/slider-test/report.mjs <day | from..to> --out <file.html> [--notes <notes.json>]
//
// Reads the live `guesses` collection over Firestore's REST API (reads are public, as for /stats), keeps rows with an
// arm (rows without one come from players on a stale cached page), scores them with the game's own rules, and fills
// template.html. The notes file holds what only a person can say about the day: short names for the questions and a
// few findings (see .claude/skills/slider-test/SKILL.md). It prints a summary to check those findings against.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)), repo = join(here, "../..");
const G = await import(join(repo, "site/js/game.js"));
const bank = Object.fromEntries(JSON.parse(readFileSync(join(repo, "site/data/questions.json"))).questions.map((q) => [q.id, q]));
const schedule = JSON.parse(readFileSync(join(repo, "site/data/schedule.json"))).days;

const args = process.argv.slice(2), flag = (k) => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1]; };
const [from, to = from] = (args[0] ?? "").split("..");
const out = flag("--out"), notesFile = flag("--notes");
if (!from || !out) { console.error("usage: report.mjs <day | from..to> --out <file.html> [--notes <notes.json>]"); process.exit(1); }
if (from < G.AB_START) { console.error(`The test starts on ${G.AB_START}`); process.exit(1); }
const days = Object.keys(schedule).filter((d) => d >= from && d <= to).sort();

// ---- every guess on those days ----
async function guesses(day) {
  const url = "https://firestore.googleapis.com/v1/projects/oxguess-a2a1b/databases/(default)/documents:runQuery";
  const where = { fieldFilter: { field: { fieldPath: "day" }, op: "EQUAL", value: { stringValue: day } } };
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "guesses" }], where } }) });
  const rows = await res.json();
  if (!res.ok) throw new Error(`Firestore said ${res.status}: ${JSON.stringify(rows).slice(0, 300)}`);
  const val = (v) => v.stringValue ?? (v.integerValue != null ? Number(v.integerValue) : v.doubleValue ?? v.timestampValue ?? null);
  return rows.filter((r) => r.document).map((r) => Object.fromEntries(Object.entries(r.document.fields).map(([k, v]) => [k, val(v)])));
}
const raw = (await Promise.all(days.map(guesses))).flat();
const all = raw.filter((g) => g.arm === "A" || g.arm === "B");

// ---- per question and arm ----
const med = (xs) => { const s = [...xs].sort((a, b) => a - b), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const r2 = (x) => Math.round(x * 100) / 100;
const CAT = { when: "When", big: "How big", far: "How far", many: "How many", wild: "Wildcard" };
const notes = notesFile ? JSON.parse(readFileSync(notesFile)) : {};

const qs = days.flatMap((day) => schedule[day].map((id) => ({ day, q: bank[id] })))
  .filter(({ q }) => q.minB != null && q.maxB != null)
  .map(({ day, q }) => {
    const arms = {};
    for (const k of ["A", "B"]) {
      const r = G.sliderFor(q, k), rows = all.filter((g) => g.day === day && g.qid === q.id && g.arm === k);
      const gs = rows.map((g) => [g.value, G.score(q, g.value), Math.round(G.toPos(q, r, g.value)) / 10]);
      arms[k] = {
        lo: r.min, hi: r.max, n: gs.length, g: gs, ansPos: G.toPos(q, r, q.answer) / 10,
        medVal: gs.length ? Number(med(gs.map((g) => g[0])).toPrecision(6)) : null, medPos: gs.length ? r2(med(gs.map((g) => g[2]))) : null,
        meanScore: gs.length ? r2(mean(gs.map((g) => g[1]))) : null, medScore: gs.length ? med(gs.map((g) => g[1])) : null,
        close: gs.length ? r2(gs.filter((g) => g[1] >= 50).length / gs.length) : null,
      };
    }
    return { day, id: q.id, cat: CAT[q.cat], short: notes.short?.[q.id] ?? CAT[q.cat], q: q.q, answer: q.answer, unit: q.unit, scale: q.scale, arms };
  })
  .filter((x) => x.arms.A.n && x.arms.B.n);
if (!qs.length) { console.error("No question has guesses on both sliders yet."); process.exit(1); }

// ---- pooled, with a permutation test that shuffles arms within each question ----
const pool = (k) => qs.flatMap((x) => x.arms[k].g.map((g) => g[1]));
const arm = (k) => { const s = pool(k); return { n: s.length, mean: r2(mean(s)), med: med(s), close: r2(s.filter((v) => v >= 50).length / s.length) }; };
const base = qs.map((x) => ({ A: x.arms.A.g.map((g) => g[1]), B: x.arms.B.g.map((g) => g[1]) }));
const gap = (Q) => mean(Q.flatMap((x) => x.B)) - mean(Q.flatMap((x) => x.A));
const obs = gap(base), N = 20000;
let seed = 7, hits = 0;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
for (let i = 0; i < N; i++) {
  const Q = base.map(({ A, B }) => { const xs = [...A, ...B]; for (let j = xs.length - 1; j > 0; j--) { const r = Math.floor(rnd() * (j + 1)); [xs[j], xs[r]] = [xs[r], xs[j]]; } return { A: xs.slice(0, A.length), B: xs.slice(A.length) }; });
  if (Math.abs(gap(Q)) >= Math.abs(obs)) hits++;
}
const used = all.filter((g) => qs.some((x) => x.day === g.day && x.id === g.qid));
const summary = {
  days, players: new Set(used.map((g) => g.player)).size, A: arm("A"), B: arm("B"), diff: r2(obs), p: hits / N, shuffles: N,
  last: used.map((g) => g.at).sort().at(-1), dropped: raw.length - all.length,
};
const page = { summary, qs, notes: { findings: notes.findings ?? [], caveats: notes.caveats ?? [] } };
// The date goes in the title, so pages for different days are told apart in the Artifacts gallery.
const short = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const when = days.length > 1 ? `${short(days[0])} to ${short(days.at(-1))}` : short(days[0]);
writeFileSync(out, readFileSync(join(here, "template.html"), "utf8").replace("<title>OxGuess Slider Test</title>", `<title>OxGuess Slider Test, ${when}</title>`).replace("__DATA__", () => JSON.stringify(page)));

// ---- what to check the notes against ----
const atStart = (g) => Math.abs(g[2] - 50) < 0.05;
console.log(`${days.join(", ")}: ${summary.players} players, ${used.length} guesses on test questions (${summary.dropped} without an arm dropped)`);
console.log(`A avg ${summary.A.mean} (n ${summary.A.n}, ${Math.round(summary.A.close * 100)}% 50+) · B avg ${summary.B.mean} (n ${summary.B.n}, ${Math.round(summary.B.close * 100)}% 50+) · gap ${summary.diff} · p ${summary.p}`);
for (const x of qs) {
  console.log(`\n${x.day} ${x.id} (${x.short}): answer ${x.answer} ${x.unit}`);
  for (const k of ["A", "B"]) {
    const a = x.arms[k];
    console.log(`  ${k} ${a.lo}–${a.hi}: n ${a.n}, answer ${a.ansPos}% along, median ${a.medVal} (${a.medPos}% along), avg ${a.meanScore}, left at start ${a.g.filter(atStart).length}`);
  }
}
console.log(`\nWrote ${out}`);
