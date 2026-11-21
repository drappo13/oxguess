# Testing the delight pass (branch `delight`, local only)

Everything is on the local branch `delight` in `~/projects/oxguess-delight`, served at http://localhost:4322.
Nothing is pushed, and the live game and your question editor are untouched.

## How to test

- **Open the game:** http://localhost:4322. Turn the sound on in the menu.
- **Pretend it's another day:** add `?day=2026-11-21`.
- **Be a new player:** use a private window, or run `localStorage.clear()` in the console and reload.
- **Review page:** http://localhost:4322/review.html shows each change on its own card, with your decisions recorded.
  Delete it before shipping.
- **Local addresses never write to the real herd** (localhost, 127.0.0.1, [::1], *.local, 192.168.x.x and the like).

## What's in

1. **Morning chalkboard** above the start card, before you've played.
   - Yesterday's scores in big chalk, with yours in yellow.
   - One headline: "You beat the herd by 7 points!" / "The herd pipped you by 3 points" / "The herd won this one" /
     "Dead level with the herd!" / "You missed out on the fun!".
   - Your placing when you're in the top half ("You came 14th of 112", or "Joint 31st of 112"), with "More →" on
     the same line. More scrolls down to Yesterday.
   - A rosette swings onto the corner for a top-20 finish, carrying your place (purple for 1st).
2. **Best in show counter.**
   - A pill in the header (purple rosette and your all-time number of 20s), next to the 🔥 streak.
   - At the end of a round, each 20 rosette wiggles and flies up into the counter, which ticks up and pops.
3. **One badge a round.** A gold "Personal best" badge on its own row under the scores (from your second round on),
   else "Your first Best in show", else "Beat the herd first go". Never more than one.
4. **Results card:** the /100 is gone from both big scores.
5. **Share text** adds "Beat the herd by 7 🐂", or "Herd: 77 🐂" when the herd won.
6. **Yesterday's chart**, drawn like the stats page's.
   - The score runs up the left, with light lines at 0, 25, 50, 75 and 100.
   - Every player is a dot in one swarm, coloured by the rosette their score would win.
   - The ox and you are bigger dots inside it.
7. **Tab title:** a tab left open past midnight says "New round ready! OxGuess".
8. **Buttons** sink and spring back, and the big ones give a soft tap.
9. **Moving between questions:** the card fades a short way left and the next drifts in. The progress bar fills, and
   the header stays still.
10. **Slider:** the tick rises in pitch as you drag right, and the knob squishes while held.
11. **Strength tester:**
    - A tick per point as the puck climbs, landing with a thunk.
    - Ding-ding at 20.
    - At 19 the bell trembles: "A whisker off the bell!"
12. **Sounds for good guesses:**
    - Ding-ding when you beat the herd on a question.
    - The chime climbs for a run of good guesses.
    - Rosettes pin on with a "tk".
13. **End of round:** brass when you beat the herd, and a cheerful tuba when it beats you.
14. **The ox:** it blinks on the start card, looks impressed when you win, and moos when you tap it in the header.

## Dropped or on hold (originals kept)

- **Dropped:**
  - Tonight's placing.
  - The week against the herd: the original ticks and the Your stats card stay.
  - Tomorrow's teaser.
  - The calendar reminder.
  - The streak ticket: the 🔥 stays.
  - The gate count.
  - Folding Yesterday.
  - Tap to hurry: the reveal keeps its original timings.
  - The interactive story.
- **On hold:** Add to Home Screen.
  - The card and the iPhone progress carry-over are built but switched off (`SHOW_HOME_SCREEN` in app.js).
  - The home-screen tags are left out of index.html until it's switched back on. On iPhone a full-screen
    home-screen app has its own storage, and without the carry-over it would open as a new player.

## Before it goes live

- Nothing in this set needs a Firestore rules change while the home-screen card is off. `firestore.rules` on this
  branch already allows the `kept` field for when it returns.
- Delete `site/review.html` and the plan docs you don't want to keep.
- **To ship:** merge `delight` into `main` and push. The deploy check guards today and earlier days.
