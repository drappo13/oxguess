# Decisions log

Newest first. Each entry: what was decided, and why.

## 17 Nov 2026

- **A fuller stats page, styled like drapk.in/stats but simpler:** all-time and today tiles, players per day (new
  and returning), back-the-next-day and cohorts, every round's scores against the herd, and each question drawn on its
  slider. Today's answers are behind a button rather than hidden outright, since the page is unlinked. Rounds are
  rescored from their guesses with the current rules, so players and the herd are always scored alike.
- **Scoring is judged against the answer, never the slider.** Even and year sliders used to score by the slider's width,
  so a wide or hand-set slider made a question easier (the Burj Khalifa on 0 to 10,000 m gave 19 of 20 to a guess 21%
  too tall). Now every question scores by how many times out the guess is: full marks within 2%, then a smooth
  log curve to zero. Amounts are forgiving (zero at 4 times out). Calendar years and human ages are strict (zero at
  1.6 times out), measured as how long ago and age, each plus 10 years so recent events and young ages stay fair.
  Temperatures count from an ordinary day (15°C) with the forgiving curve. The steeper curve is the same formula
  with a nearer endpoint, not a cut-off, so there's no cliff. Picked against real guesses: dates average about 11
  points a guess, amounts about 12. Scores are recalculated from guesses, so rounds played before the change show
  slightly different points; stored round totals keep their old values.

## 16 Nov 2026

- **A stats page at oxguess.com/stats**, public but unlinked and not indexed (no users to hide it from yet). It reads
  every guess and finished round since launch, so `guesses` and `plays` became readable; they hold an anonymous device
  id and numbers only. It never shows today's answers or herd. It counts everyone, the owner included (leaving the
  owner out by default hid the only returning player); a checkbox can leave out the viewing device. Rows dated after
  today (the rules test writes to 2099) are ignored.
  Add a date window to its reads once there are thousands of guesses.
- **Content is a bank plus a dated schedule** (`questions.json`, `schedule.json`) instead of a list of days. Moving
  or swapping a question is a one-line edit, spares and retired questions stay in the bank with their sources, and
  `show-schedule.mjs` prints the schedule for checking without answers. Replaces the `version` number: a device
  notices for itself when today's question ids change.
- **A changed day starts afresh, even if finished.** Old guesses can't be scored against new questions, so the
  player gets the new ones (their old guesses stay in the herd for the questions that remain).
- **Ages use a 0 to 100 years slider.** Everyone knows roughly how long people live, so a 1,000-year end looked
  silly. Other sliders still run past what's possible (How far up to 500,000 km): most people don't know the size
  of the Earth, and the slider shouldn't give clues.
- **Questions should be guessable, not obscure or workable-out.** Retired: Statue of Unity (few have heard of it),
  Rubik's Cube stickers (easy arithmetic).

## 15 Nov 2026 (launch day)

**Product**
- **Name and theme: OxGuess**, after the 1906 Plymouth ox-weighing (wisdom of crowds). Chosen over Ballpark,
  Thereabouts, Give or Take, Nearest the Pin: a real story, memorable, and it makes the crowd reveal the point.
- **Five fixed categories a day** (When, How big, How far, How many, Wildcard). Content fits a category; the core
  game doesn't change for one-off questions (Lake Baikal's depth went in How big, not a new "How deep").
- **20 whole points per question, 100 per round.** The wildcard is no longer double points: simpler to read.
- **Accuracy:** not clearly wrong under any reasonable reading, plus a real cited source for every answer; never
  LLM memory alone. No people's heights/weights, animal sizes, death tolls or still-changing counts.
- **No manual approval of questions.** Future content comes from an automated draft-then-verify skill.
- **The herd = median**, with 15 seeded starter guesses per question kept forever (two steps: crowd hunch, then
  scattered guesses plus wild ones), so early players see a lively, realistic herd and it never jumps.
  No "sample herd" labelling.
- **Story numbers stay historical:** guesses roughly 1,000–1,500 lb ("around 1,000", "over 1,500"); not invented
  extremes like 400 or 3,000 lb.
- **Reveal order:** timeline (guess → flag ticks to answer) and how far off, then the prize (strength tester,
  points, rosette), then Next question above the fold; the herd panels, chart and fun fact in a second card below.
- **Category label lives in the progress bar** (solid colour pill, white text); no separate chip, no "2 of 5".
- **Look:** country fair, Fredoka/Nunito, no emoji in the chrome, green ticks, beige week tickets, the existing
  cartoon ox as the logo (with a pale badge in dark mode).

**Technical**
- **Plain HTML/CSS/JS, no build step**, not drapk.in's Vite + React + TypeScript. OxGuess should stay simpler; switch
  only if it grows accounts, friends and so on.
- **Hosting:** GitHub Pages from personal `drappo13/oxguess` (public, needed for free Pages), domain at GoDaddy.
- **Firebase via the gstatic CDN modules**, Firestore (not Realtime Database), no Analytics for now (avoids a cookie
  banner). Herd stored as small per-question summaries (100 bins) so each player reads 5 tiny docs a day at any
  scale. Rules allow only shaped writes (exactly +1 guess per herd write), nothing readable except herd summaries.
- **Player record** (`players/{id}`) added for future features and querying; no log-in or cross-device streaks yet.
- **Personal accounts only:** personal GitHub account and git identity.
- **Clean code:** one rule set per component in the stylesheet, no stacked overrides; dead code removed as it appears.
