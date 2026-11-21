# Delight pass: handoff (21 Nov 2026)

Read this first if you're picking up the delight work in a new session.

## Where things are

- **Branch:** the work is on branch `delight`, in a separate git worktree at `~/projects/oxguess-delight`. It
  has 15 commits on top of `main` (531acb2) and nothing is pushed.
- **Preview:** served at http://localhost:4322 (the launch config "oxguess-delight" in `~/.claude/launch.json`).
  - If it stops, run `python3 -m http.server 4322 --directory ~/projects/oxguess-delight/site`.
- **What's in, what was dropped, how to test:** `docs/plans/delight-test-guide.md`.
- **How we got here:**
  - `docs/plans/delight-longlist.md`: 34 ideas.
  - `docs/plans/delight-plan.md`: the plan merged from the product and design reviews.
  - After that, the owner went through every change one by one on `site/review.html`. Their verdicts are what's in
    the test guide now.
- **Reviews done:** a final end-to-end run (new player, three days in a row, a skipped day, menu, story, dark mode,
  phone size) and an independent code review. Everything found was fixed: 18 issues, the worst being `?carry=`
  links being read while the feature was off.
- **Not tested:** a real phone (sounds, haptics, iOS `:active` presses).

## The main checkout (`~/projects/oxguess`) has uncommitted work

1. **`site/data/questions.json`: new slider ends for 48 questions on untouched days** (24 Nov to 5 Dec).
   - They follow the rules in `docs/content.md` and were set on 20 Nov.
   - No question that's ticked ready, or on a Ready day, was changed.
   - The owner hasn't reviewed or published them. Don't throw them away.
   - **To publish:** open the question editor and use Save and publish, or commit them on their own.
2. **`site/js/app.js`, `site/js/art.js`, `site/styles.css`: an old copy of the Yesterday prize board.**
   - It's superseded by the branch, where it was later replaced by the score chart.
   - **Discard before merging:** `git -C ~/projects/oxguess checkout -- site/js/app.js site/js/art.js site/styles.css`.

## To ship (only when the owner says so)

1. **Clear out the old prize-board copies** in the main checkout (step 2 above). Commit or publish the slider changes
   first if the owner wants them; the branch doesn't touch `questions.json`, so they merge cleanly.
2. **Tidy the branch:**
   - Delete `site/review.html` (the throwaway review page).
   - Keep or delete `docs/plans/*`, as the owner prefers.
   - Commit.
3. **Merge:** `git -C ~/projects/oxguess merge delight`. This is a fast-forward if main hasn't moved; otherwise a
   normal merge.
4. **Check:** `node scripts/check-content.mjs --live`. Today and earlier days must match the live game.
5. **Push:** `git -C ~/projects/oxguess push origin main` (SSH, as drappo13).
6. **Confirm it's live:**
   - Watch the Deploy run with `GH_TOKEN=$(gh auth token --user drappo13) gh run watch …`. It retries the Pages
     step once by itself.
   - Then confirm oxguess.com serves the new `js/app.js` (curl it, or open the live site in the browser pane).
7. **Firestore rules:** no change needed. The rules file allows a `kept` field for the home-screen card, which is on
   hold and never sends it.
8. **Clean up afterwards:**
   - `git worktree remove ~/projects/oxguess-delight` and `git branch -d delight`.
   - Remove the "oxguess-delight" launch config.
9. **Measure:** compare next-day return before and after.
   - Before this pass: 20–39%; 197 of 235 players had played once; about 85% of starters finish.
   - The /stats page has the retention cohorts.

## On hold, for later

- **Add to Home Screen:** `SHOW_HOME_SCREEN = false` in app.js.
  - The card, the iPhone progress carry-over (`carryOver` / `importCarried`, with value checks) and the manifest and
    icons are all built.
  - When it's switched on, link `manifest.webmanifest` and add `apple-mobile-web-app-capable` in index.html (a
    comment there says so).
  - Test on a real iPhone that the streak survives.
