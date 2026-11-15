# OxGuess

**https://oxguess.com**: a friendly daily numbers game. Five questions a day, guess on a slider, win up to 20 points
each for getting close, then see how the whole herd guessed.

Named after a 1906 country fair in Plymouth, England, where about 800 people guessed the weight of an ox and the middle
guess was out by just 9 lb.

- **Play:** https://oxguess.com (no sign-up)
- **Run locally:** `python3 -m http.server 4321 --directory site` → http://localhost:4321/?day=2026-12-20
- **Deploy:** push to `main`; GitHub Actions checks the questions and publishes `site/` to GitHub Pages.

| Where | What |
|---|---|
| `CLAUDE.md` | How to work on the repo: layout, run, test, deploy, house rules |
| `docs/vision.md` | The game as it stands, and ideas for later |
| `docs/decisions.md` | Dated log of product and technical decisions |
| `docs/data-feasibility.md` | How questions are sourced and checked, and why it scales |
| `content/` | Question sets with sources and evidence |
| `site/` | The website: plain HTML, CSS and JavaScript, no build step |
| `firestore.rules` | Security rules for the herd data |
