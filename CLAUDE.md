# OxGuess: notes for working on this repo

Live at **https://oxguess.com**. A daily numbers guessing game: five questions, guess on a slider, points for
getting close, then see how "the herd" (everyone) guessed. See `docs/vision.md` for the game and
`docs/decisions.md` for why things are the way they are.

## Ground rules

- **Personal project.** Commit with the repo-local identity
  `Freddie Drapkin <52531169+drappo13@users.noreply.github.com>`; check `git config user.email` before committing.
- **Clean code.** Edit the existing rule or function in place. Never append override blocks to the bottom of
  `site/styles.css` (one rule set per component, in screen order). Remove anything a change makes unused.
- **Don't change the core game for one-off content.** Fit content into the existing five categories; change data,
  not code.
- **Keep it simple.** Plain HTML/CSS/JS, no framework, no build step (decided 15 Nov 2026; revisit only if accounts,
  friends and the like make it outgrow this).
- **Every answer needs a real, cited source.** It's a game, so answers needn't be beyond argument, but they must not
  be clearly wrong under any reasonable reading, and never come from an LLM's memory alone.
- **No emoji in the UI chrome.** Category colours do the theming.

## Layout

```
site/                 the whole website (deployed as-is)
  index.html
  styles.css          tokens, then one section per screen
  js/app.js           screens: the day (start, then you v the herd, question by question, tomorrow, yesterday), story,
                      ask, reveal (you, the answer and the herd on one line); the menu (story, prizes, sound); state and
                      streaks (localStorage)
  js/game.js          rules: slider ranges, scoring (0-20 per question), units, the herd
  js/fx.js            sounds (Web Audio), haptics, confetti, stamps, count-ups, the ticket drop
  js/art.js           SVG art: ox head, fairgoer, rosettes, balance scale
  js/herd-store.js    Firestore: read today's herds, record guesses, plays and player summaries, read activity
  js/stats.js         the /stats page: tiles, players per day, retention and cohorts, rounds (today's answers behind a button)
  stats/index.html    oxguess.com/stats, public but unlinked and noindex
  staging/            oxguess.com/staging: unlinked, noindex prototypes to try on a phone (now: the tape measure, parked)
  data/questions.json the question bank: every question with its source and evidence (spares and retired too)
  data/schedule.json  date -> five question ids; the first date is round 1
  img/                ox.svg (favicon), fair-1906.webp (story illustration)
tools/editor/          the question editor (local only): `node tools/editor/server.mjs` or double-click
                        "OxGuess editor.command", then http://localhost:4400. "Save and publish" merges your changes
                        onto the data files (merge.mjs: edits made meanwhile, say from the chat, are kept, never a
                        conflict), runs the check and, if it passes, commits and pushes; the badge follows it to
                        live. Today and earlier are read-only. Unsaved edits are kept in the browser
scripts/
  check-content.mjs   validates the bank and the schedule against the game rules (runs in CI before deploy)
  show-schedule.mjs   prints the schedule from today with slider ends and no answers, plus spares and retired
  test-rules.py       live test of the Firestore rules, on 2099 dates
  slider-test/        the slider A/B test report (report.mjs, template.html, notes/ per report); run it via the
                      `slider-test` skill in .claude/skills
  explore/            Wikidata (QLever) exploration from the feasibility study
firestore.rules       paste into Firebase console → Firestore → Rules → Publish (no CLI here)
docs/                 vision, decisions, content (how questions were sourced and checked), data feasibility
prototype/            the first single-file mock
```

## Run, test, deploy

- **Local preview:** `python3 -m http.server 4321 --directory site`, then `http://localhost:4321/?day=YYYY-MM-DD`.
  `?day=` only works on localhost. Localhost reads the real herd but never writes to it (with or without `?day=`).
  The browser caches modules, so after edits reload with `fetch(url, {cache: 'reload'})` or a hard refresh.
- **Checks:** `node scripts/check-content.mjs` (every answer inside its slider, scores 20, bullseye reachable,
  has a source; the schedule has consecutive dates, five questions a day in category order, no repeats, nothing
  retired). With `--live` (how CI and the editor run it) it also fails if today (UK date) or any earlier day differs
  from what oxguess.com serves, so a deploy can't change a round in play; a deliberate fix runs the Deploy workflow by
  hand with `allow_played`. `python3 scripts/test-rules.py` exercises the live Firestore rules.
- **Deploy:** push to `main` on `github.com/drappo13/oxguess` (SSH remote). GitHub Actions runs the content check,
  then publishes `site/` to Pages in about a minute. A good push isn't proof: the deploy can fail on GitHub's side
  (it did on 19 Nov), so check the run or the live files. The editor's badge does this. For `gh` calls use `GH_TOKEN=$(gh auth token --user drappo13)`
  (the active gh account is a different one).
- **Checking the live site from a machine with stale DNS:** `curl --resolve oxguess.com:443:185.199.108.153 https://oxguess.com/...`.

## Hosting and data

- **Domain:** GoDaddy DNS, four GitHub Pages A records on `@` (185.199.108-111.153), `www` CNAME → `drappo13.github.io`.
  HTTPS enforced (certificate issued 15 Nov 2026). Lesson: setting the Pages custom domain before DNS points there
  leaves the certificate stuck; once Pages health says eligible, remove and re-add the domain.
- **Firebase project `oxguess-a2a1b`** (personal Google account), Firestore in eur3. Config is in `herd-store.js`
  (public by design; the rules protect the data). No Analytics, no Auth.
- **Collections:**
  - `herd/{date}_{questionId}`: `{ n, b: {bin: count}, k }`, 100 bins across the herd's range (slider A before
    19 Nov; both sliders together from then, see `herdRange` in game.js), one guess added per write. The rules check
    exactly +1 in bin `k`.
  - `guesses/{auto}`: one row per guess (readable, for /stats), with the A/B arm and the ends of the slider it was
    made on (`arm`, `lo`, `hi`).
  - `plays/{date}_{player}`: finished round (readable, for /stats).
  - `players/{id}`: summary rebuilt by the device after each round (write-only).
- **Players** are anonymous per device (`ox-player` in localStorage). No accounts or cross-device streaks yet.

## How a day works

- The first date in `data/schedule.json` (2026-11-15) is round 1. Past the last date the schedule starts again
  from the top, so add days before it runs out.
- Every herd = 15 seeded made-up guesses (fixed per date and question, kept forever) plus real guesses.
- **Slider A/B test:** a question with `minB` and `maxB` gives each player slider A or B (per question, from their
  player id). Testing locally: the herd and arms can't be faked on :4321, so use a stubbed `herd-store.js` server.
- **Changing the questions:** use the question editor (above), or edit `data/schedule.json` (move ids between dates, swap in a spare). To drop a
  question for good, take it off the schedule and give it `"retired": "why"` in the bank rather than deleting it.
  To set a slider's ends by hand, give the question `min` and `max` (any scale; otherwise log and year sliders
  are generated around the answer). Never change a question's `id`: it seeds the slider range and the herd. Run `check-content.mjs` and
  `show-schedule.mjs`. If today's questions change, a device that already played today starts today afresh
  (its earlier guesses stay in the herd). Guesses are stored per date, so a question moved to another day gets a
  fresh herd there.
