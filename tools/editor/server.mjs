// The question editor: a small local server, no dependencies. Run `node tools/editor/server.mjs` and open
// http://localhost:4400. It reads and writes site/data/questions.json, schedule.json and docs/question-ideas.md. Save
// runs the content check and, if it passes, commits and pushes them, which deploys the game. A save is never refused:
// your changes are merged onto whatever is on disk (merge.mjs). Whether the game is live
// is never taken on trust from the push: /api/live compares oxguess.com's own data files with these and follows the
// GitHub deploy, which can fail on GitHub's side after a good push. Never part of the website.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { merge } from "./merge.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = Number(process.env.PORT) || 4400;
// review.json: your own "untouched / in progress / ready" mark for each day. ready.json: the questions you've marked
// ready. Both editor-only; the game never reads them.
const FILES = { questions: "site/data/questions.json", schedule: "site/data/schedule.json", ideas: "docs/question-ideas.md", review: "tools/editor/review.json", ready: "tools/editor/ready.json" };
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".webp": "image/webp" };

const run = (cmd, args, env = {}) => new Promise((done) => {
  execFile(cmd, args, { cwd: ROOT, env: { ...process.env, ...env } }, (err, stdout, stderr) => done({ ok: !err, out: `${stdout}${stderr}`.trim() }));
});
const readData = async () => {
  const [q, s, i, r, y] = await Promise.all([FILES.questions, FILES.schedule, FILES.ideas, FILES.review, FILES.ready].map((f) => fs.readFile(path.join(ROOT, f), "utf8").catch(() => "")));
  return { questions: JSON.parse(q).questions, days: JSON.parse(s).days, ideas: ideasFrom(i), review: r ? JSON.parse(r) : {}, ready: y ? JSON.parse(y).ready : [] };
};
// Ideas live in a small Markdown file: an intro, then one "- idea" line each.
const IDEAS_HEAD = "# Question ideas\n\nRough ideas for future questions, newest first. Not checked or sourced yet: when one becomes a real question it\nmoves into the bank (with a source) and comes off this list. Edit here, in the question editor's Ideas tab, or ask\nClaude in the chat.\n\n";
const ideasFrom = (text) => text.split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2).trim()).filter(Boolean);
const ideasText = (ideas) => `${IDEAS_HEAD}${ideas.map((i) => `- ${i.replace(/\s+/g, " ").trim()}`).join("\n")}\n`;
// Same layout as the files have always had: 2-space JSON for the bank, one line per day for the schedule.
const bankText = (questions) => `${JSON.stringify({ questions }, null, 2)}\n`;
const scheduleText = (days) => `{\n  "days": {\n${Object.keys(days).sort().map((d) => `    "${d}": [${days[d].map((id) => JSON.stringify(id)).join(", ")}]`).join(",\n")}\n  }\n}\n`;
const check = () => run("node", ["scripts/check-content.mjs", "--live"]);
const status = async () => (await run("git", ["status", "--porcelain", "--", ...Object.values(FILES)])).out;
const unpushed = async () => Boolean(await status()) || (await run("git", ["rev-list", "--count", "@{u}..HEAD"])).out !== "0";

// ---------- is the game live? ----------
const SITE = "https://oxguess.com", REPO = "drappo13/oxguess";
const ukToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const canon = (x) => JSON.stringify(x ?? null);
// The live files, past any cache (Pages caches for ten minutes; a fresh query string skips it).
const liveFile = async (f) => {
  const r = await fetch(`${SITE}/data/${f}?t=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`${SITE} said ${r.status}`);
  return r.json();
};
// gh runs as the personal account (the active gh account is a different one).
const gh = async (args) => {
  const t = await run("gh", ["auth", "token", "--user", "drappo13"]);
  return t.ok ? run("gh", args, { GH_TOKEN: t.out }) : t;
};
// The latest deploy on main, and whether it is for the commit here.
async function lastDeploy() {
  const [r, head] = await Promise.all([
    gh(["api", `repos/${REPO}/actions/runs?branch=main&per_page=1`, "--jq", ".workflow_runs[0] | {id, status, conclusion, sha: .head_sha, url: .html_url}"]),
    run("git", ["rev-parse", "HEAD"]),
  ]);
  if (!r.ok || !r.out) return null;
  const d = JSON.parse(r.out);
  return { ...d, current: d.sha === head.out };
}
async function liveState() {
  const [lq, ls, here, deploy, ahead] = await Promise.all([liveFile("questions.json"), liveFile("schedule.json"), readData(), lastDeploy(), unpushed()]);
  const live = canon(lq.questions) === canon(here.questions) && canon(ls.days) === canon(here.days);
  // Would going live change today's round? Then anyone who has played today starts again.
  const t = ukToday(), lb = Object.fromEntries(lq.questions.map((q) => [q.id, q])), hb = Object.fromEntries(here.questions.map((q) => [q.id, q]));
  const ids = here.days[t] ?? [], todayChanges = !live && (canon(ls.days[t]) !== canon(here.days[t]) || ids.some((id) => canon(lb[id]) !== canon(hb[id])));
  return { live, todayChanges, unpushed: ahead, deploy };
}

const send = (res, code, body, type = "application/json") => {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
};
const body = (req) => new Promise((done) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => done(b ? JSON.parse(b) : {})); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/api/data") return send(res, 200, { ...(await readData()), unpublished: await unpushed() });
    if (url.pathname === "/api/live") return send(res, 200, await liveState().catch((e) => ({ error: `Couldn't check the live game: ${e.message ?? e}` })));
    // Run the latest deploy again after it failed on GitHub's side. It deploys what is already on GitHub.
    if (url.pathname === "/api/redeploy" && req.method === "POST") {
      // With changes here that GitHub hasn't got, a retry would put GitHub's older copy live: publish them instead.
      if (await unpushed()) return send(res, 200, { ok: false, report: "You have saved changes GitHub hasn't got yet. Save and publish sends them and deploys." });
      const d = await lastDeploy();
      if (!d) return send(res, 200, { ok: false, report: "Couldn't reach GitHub (is gh signed in as drappo13?)." });
      if (d.status !== "completed") return send(res, 200, { ok: true, report: "A deploy is already running." });
      const r = await gh(["run", "rerun", String(d.id), "-R", REPO]);
      return send(res, 200, r.ok ? { ok: true, report: "Deploying again. The game updates in about a minute." } : { ok: false, report: `GitHub refused the retry:\n${r.out}` });
    }
    // Save and publish in one go: merge your changes onto the files, run the content check, and if it passes commit
    // and push (the game updates about a minute later). If the check fails the files are still saved, but nothing
    // goes live. Every answer carries the files as now saved, so the page carries on from exactly what's on disk.
    if (url.pathname === "/api/save" && req.method === "POST") {
      const b = await body(req);
      if (!b.base || !b.mine) return send(res, 400, { error: "this editor page is out of date. Copy anything you can't redo, then reload the page" });
      const m = merge(b.base, b.mine, await readData());
      await fs.writeFile(path.join(ROOT, FILES.questions), bankText(m.questions));
      await fs.writeFile(path.join(ROOT, FILES.schedule), scheduleText(m.days));
      await fs.writeFile(path.join(ROOT, FILES.ideas), ideasText(m.ideas));
      await fs.writeFile(path.join(ROOT, FILES.ready), `${JSON.stringify({ ready: m.ready.filter((id) => m.questions.some((q) => q.id === id)).sort() }, null, 2)}\n`);
      await fs.writeFile(path.join(ROOT, FILES.review), `${JSON.stringify(Object.fromEntries(Object.entries(m.review).filter(([, v]) => v === "doing" || v === "ready").sort()), null, 2)}\n`);
      const c = await check(), data = await readData(), notes = m.notes.length ? `\n${m.notes.join("\n")}` : "";
      if (!c.ok) return send(res, 200, { ok: false, data, report: `Saved here, but not published. Fix these first:\n${c.out}${notes}` });
      if (!(await unpushed())) return send(res, 200, { ok: true, data, report: `Saved. Nothing new to send: GitHub already has these.${notes}` });
      const message = (b.message || "Questions: edits from the question editor").slice(0, 200), log = [];
      for (const [cmd, args] of [["git", ["add", "--", ...Object.values(FILES)]], ["git", ["commit", "-m", message, "--", ...Object.values(FILES)]], ["git", ["push", "origin", "main"]]]) {
        const r = await run(cmd, args);
        log.push(r.out);
        if (!r.ok) return send(res, 200, { ok: false, data, report: `Saved, but publishing failed at "${cmd} ${args[0]}". Try again, or ask Claude.\n${log.join("\n")}` });
      }
      return send(res, 200, { ok: true, data, report: `Saved and sent to GitHub at ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}. Going live, usually within a minute or two…${notes}` });
    }
    // Static: the editor itself, plus the game's own styles and rules so previews match the real thing.
    let file = url.pathname === "/" ? "tools/editor/index.html" : url.pathname.startsWith("/site/") ? url.pathname.slice(1) : `tools/editor${url.pathname}`;
    file = path.normalize(file);
    if (file.startsWith("..") || path.isAbsolute(file)) return send(res, 404, "Not found", "text/plain");
    let data = await fs.readFile(path.join(ROOT, file));
    // A fresh script address on every page load, so a browser never runs an old copy of the editor after a change.
    if (file.endsWith("index.html")) data = String(data).replace('src="/editor.js"', `src="/editor.js?v=${Date.now()}"`);
    return send(res, 200, data, TYPES[path.extname(file)] ?? "application/octet-stream");
  } catch (e) {
    return send(res, e.code === "ENOENT" ? 404 : 500, e.code === "ENOENT" ? "Not found" : { error: String(e.message ?? e) }, e.code === "ENOENT" ? "text/plain" : "application/json");
  }
}).listen(PORT, "127.0.0.1", () => console.log(`Question editor: http://localhost:${PORT}`));
