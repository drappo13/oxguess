// The question editor: a small local server, no dependencies. Run `node tools/editor/server.mjs` and open
// http://localhost:4400. It reads and writes site/data/questions.json, schedule.json and docs/question-ideas.md, runs the content check on
// every save, and Publish commits those two files and pushes, which deploys the game. Never part of the website.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = Number(process.env.PORT) || 4400;
const FILES = { questions: "site/data/questions.json", schedule: "site/data/schedule.json", ideas: "docs/question-ideas.md" };
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".webp": "image/webp" };

const run = (cmd, args) => new Promise((done) => {
  execFile(cmd, args, { cwd: ROOT }, (err, stdout, stderr) => done({ ok: !err, out: `${stdout}${stderr}`.trim() }));
});
const readData = async () => {
  const [q, s, i] = await Promise.all([FILES.questions, FILES.schedule, FILES.ideas].map((f) => fs.readFile(path.join(ROOT, f), "utf8").catch(() => "")));
  return { questions: JSON.parse(q).questions, days: JSON.parse(s).days, ideas: ideasFrom(i), hash: crypto.createHash("sha1").update(q + s + i).digest("hex") };
};
// Ideas live in a small Markdown file: an intro, then one "- idea" line each.
const IDEAS_HEAD = "# Question ideas\n\nRough ideas for future questions, newest first. Not checked or sourced yet: when one becomes a real question it\nmoves into the bank (with a source) and comes off this list. Edit here, in the question editor's Ideas tab, or ask\nClaude in the chat.\n\n";
const ideasFrom = (text) => text.split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2).trim()).filter(Boolean);
const ideasText = (ideas) => `${IDEAS_HEAD}${ideas.map((i) => `- ${i.replace(/\s+/g, " ").trim()}`).join("\n")}\n`;
// Same layout as the files have always had: 2-space JSON for the bank, one line per day for the schedule.
const bankText = (questions) => `${JSON.stringify({ questions }, null, 2)}\n`;
const scheduleText = (days) => `{\n  "days": {\n${Object.keys(days).sort().map((d) => `    "${d}": [${days[d].map((id) => JSON.stringify(id)).join(", ")}]`).join(",\n")}\n  }\n}\n`;
const check = () => run("node", ["scripts/check-content.mjs"]);
const status = async () => (await run("git", ["status", "--porcelain", "--", ...Object.values(FILES)])).out;

const send = (res, code, body, type = "application/json") => {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
};
const body = (req) => new Promise((done) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => done(b ? JSON.parse(b) : {})); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/api/data") return send(res, 200, { ...(await readData()), unpublished: Boolean(await status()) });
    if (url.pathname === "/api/save" && req.method === "POST") {
      const b = await body(req), now = await readData();
      // Someone (usually Claude, from the chat) changed the files since this page loaded: don't overwrite their work.
      if (b.hash !== now.hash) return send(res, 409, { error: "The question files changed since you loaded them. Reload to pick up those changes, then make your edit again." });
      await fs.writeFile(path.join(ROOT, FILES.questions), bankText(b.questions));
      await fs.writeFile(path.join(ROOT, FILES.schedule), scheduleText(b.days));
      if (Array.isArray(b.ideas)) await fs.writeFile(path.join(ROOT, FILES.ideas), ideasText(b.ideas));
      const c = await check(), after = await readData();
      return send(res, 200, { ok: c.ok, report: c.out, hash: after.hash, unpublished: Boolean(await status()) });
    }
    if (url.pathname === "/api/publish" && req.method === "POST") {
      const b = await body(req), c = await check();
      if (!c.ok) return send(res, 400, { error: "The content check failed, so nothing was published.", report: c.out });
      if (!(await status())) return send(res, 200, { ok: true, report: "Nothing to publish: the live questions already match these." });
      const steps = [
        ["git", ["add", "--", ...Object.values(FILES)]],
        ["git", ["commit", "-m", (b.message || "Questions: edits from the question editor").slice(0, 200), "--", ...Object.values(FILES)]],
        ["git", ["push", "origin", "main"]],
      ];
      const log = [];
      for (const [cmd, args] of steps) {
        const r = await run(cmd, args);
        log.push(r.out);
        if (!r.ok) return send(res, 500, { error: `${cmd} ${args[0]} failed`, report: log.join("\n") });
      }
      return send(res, 200, { ok: true, report: `${c.out}\nPublished. The game updates in about a minute.\n${log.filter(Boolean).join("\n")}` });
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
