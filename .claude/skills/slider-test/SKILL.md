---
name: slider-test
description: Report on the OxGuess slider A/B test (minB/maxB slider ends) for a day or a run of days. Pulls every real guess from Firestore, charts each question's guesses on slider A and B against the answer, the drift towards the slider's middle and the scores, and publishes it as an Artifact. Use for "chart the A/B test", "slider test for today", "refresh the slider test", or the test over several days.
---

# Slider test report

The test is described in `docs/decisions.md` (19 Nov 2026) and `game.js` (`AB_START`, `armFor`, `sliderFor`). Each
player gets slider A or B per question; every guess row in Firestore keeps its `arm`, `lo` and `hi`.

## Run it

1. **Pick the days.** Default: today (UK date). "Since the start" means `2026-11-19..<today>`. Several days pool into
   one page, with the date on each question.
2. **Build a first draft without notes** to read the numbers:
   ```bash
   node scripts/slider-test/report.mjs <day | from..to> --out <scratchpad>/slider-test.html
   ```
   It prints, per question and slider: the ends, where the answer sat along it, the median guess and where that sat,
   the average score and how many guesses were left at the slider's starting point (the middle). Rows without an arm
   (players on a stale cached page) are dropped and counted.
3. **Write the notes**, `scripts/slider-test/notes/<day or from..to>.json` (copy the shape of an existing one):
   - `short`: a two-to-four-word name per question id, used on the charts.
   - `findings`: two or three plain sentences on what stands out, each opening with a bold claim. Every number in
     them must come from the printed summary. Don't repeat what the page already computes (averages, p-value,
     answer ranges, guesses left at the start).
   - `caveats`: anything that limits the reading for these days (what B actually changed, questions people simply
     know). The page already adds the sample size and the left-at-the-start guesses itself.
   Keep the house style: short direct sentences, no em-dashes, no hype. Scores are fine as a summary, but don't put
   them in a question's caption (the owner asked for ends and medians only there).
4. **Build again with the notes:**
   ```bash
   node scripts/slider-test/report.mjs <days> --notes scripts/slider-test/notes/<days>.json --out <scratchpad>/slider-test.html
   ```
5. **Look once, then publish.** The browser pane can't open claude.ai, and a file outside the project renders as a
   static snapshot. To look, add a temporary `python3 -m http.server` config for the scratchpad to
   `~/.claude/launch.json`, open it with a copy of the page that has `<meta charset="utf-8">` prepended (the
   Artifact skeleton adds the charset; a bare local file shows mojibake), then remove the config.
   Publish with the Artifact tool. The running report is https://claude.ai/artifact/FBUc2Z2jeP1iJ87eu6Ln7A: pass
   it as `url` to update it (read it first in a new session), or publish without `url` for a separate page (for
   example, one per week).
6. **Commit the notes file** (and any change to the script or template) with the repo-local identity. The page
   itself is not committed: it shows answers, and this repo is public.

## What's where

- `scripts/slider-test/report.mjs`: fetches guesses (Firestore REST `runQuery`, public reads), scores them with
  `game.js`, runs a permutation test (arms shuffled within each question, 20,000 times) and fills the template.
- `scripts/slider-test/template.html`: the page. Meadow tokens and Fredoka/Nunito from `site/styles.css`; A blue,
  B orange (checked for colour-blind separation in both themes), the answer green as in the game. Charts are drawn
  at the container's real width so text stays legible on a phone.
- `scripts/slider-test/notes/`: one notes file per report.

## Reading it honestly

- The starter herd never guesses, so it's left out; the owner's own device is counted like anyone's.
- Slider B was set by hand per question, so B can differ from A in several ways at once (width, and where the answer
  sits). Say which one a result is really about.
- A small gap on a day or two is noise. Give the guesses per slider per question, and the shuffle count, before
  any verdict.
