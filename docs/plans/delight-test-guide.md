# Testing the delight pass (branch `delight`, not live)

Everything is on the local branch `delight` in `~/projects/oxguess-delight`. Nothing is pushed, and the live game
and your question editor are untouched.

## Opening it

- **On the Mac:** http://localhost:4322 (the "oxguess-delight" preview).
  - In Chrome, devtools' phone view (iPhone size) is closest to the real thing.
  - Turn the sound on: the menu, then Sound.
- **On your phone:** try `http://192.168.0.62:4322` on the same wifi. I couldn't reach that address from here, so
  it may be blocked; if so, use the Mac.
  - Local addresses never write to the real herd or plays, so test freely.
- **Pretend it's another day:** add `?day=2026-11-22` (works only on local addresses).
- **Be a brand-new player:** a private window. Or in the console, `localStorage.clear()`, then reload.
- **Haptics:** Android only. iPhones don't vibrate for web pages.

## The changes, and how to see each

### Coming back (the retention work)

1. **Morning chalkboard.**
   - **What changed:** yesterday's result, chalked up above the start card before you play.
   - **To see it:** play a day, then open the next day (`?day=` the day after), unplayed.
   - In the top half it says "You came 14th of 112" and the number counts. Otherwise it leads with the herd ("You
     scored 31. The herd scored 73. It usually does.").
   - "See the board" opens yesterday below.
2. **Tonight's placing.**
   - **What changed:** "You're 14th of 112 so far. Final placings go up in the morning." under the scores. It only
     shows in the top half; otherwise just "Final placings go up in the morning."
   - **To see it:** play today's real date (other players' rounds are needed).
3. **The week against the herd.**
   - **What changed:**
     - Each played ticket is stamped with the fairgoer (you won the day), the ox (the herd won) or both.
     - "This week: You 1, The herd 2" under the strip.
     - On a played Sunday, who took the week.
     - Once today's done, tomorrow's ticket is dashed and labelled "Day 3".
   - **To see it:** play two or three days in a row with `?day=`.
4. **Tomorrow's programme.**
   - **What changed:** "On tomorrow's programme: two very busy crossings, and a little gold man." in Back tomorrow.
   - The hints are in `site/data/teasers.json`, one vague line per question, and never the answer.
5. **"Same time tomorrow?"**
   - **What changed:** an ADMIT ONE ticket under Share, on your first two rounds only. It comes in after the
     celebration.
     - "Remind me at 8:15am" adds a daily calendar event at the time you played (8am if you played late at night).
       On iPhone it should open Add to Calendar.
     - "Add to Home Screen" installs on Android, or shows the iPhone steps.
     - "Not for me" hides it for good.
   - Later rounds get a small "Remind me tomorrow" link instead.
   - **To see it:** a new player (private window), finish a round.
6. **The share text names the herd.** "Beat the herd by 6 🐂", or "Herd: 73 🐂" when it won.
7. **The streak as a ticket.**
   - **What changed:**
     - The 🔥 in the header is now a drawn ticket stub.
     - It hops up a number at the end of a round.
     - Milestones: Day tripper (3 days), a week at the fair (7), Season ticket (30), e.g. "One more day and you're a
       Day tripper."
8. **Through the gate.** "143 through the gate today" under the start button (today's real date only).
9. **Tab title.** A tab left open overnight changes its title to "New round · OxGuess".
10. **A slimmer finished screen.**
    - The separate Your stats card is gone.
    - Yesterday folds to one line: "Yesterday · You came 9th of 42 · Herd 66". Tap it for the full prize board.

### Inside the round (the feel)

11. **Buttons.** They sink a little and spring back; the big ones give a soft wooden tap.
12. **Moving between questions.**
    - Each question slides out left and the next slides in.
    - The finished progress segment fills in, and the next category pill pops.
13. **The slider.** The tick rises in pitch as you drag right, and the knob squishes while held.
14. **The strength tester.**
    - One tick a point as the puck climbs, each a semitone higher, landing with a thunk.
    - The bell at 20 is a proper bell now.
    - At 19 it trembles: "A whisker off the bell!"
15. **Sounds for good guesses.**
    - Ding-ding when you beat the herd on a question.
    - The chime steps up a tone with each good guess (13+) in a row.
    - Rosettes pin on with a little "tk".
16. **Tap to hurry.** Tap the card during a reveal and it jumps to the end. The reveal is also about a second
    quicker per question.
17. **End of the round.**
    - A brass-band flourish when you beat the herd; a good-humoured tuba ("pah-PAH") when it beats you.
    - A red "Personal best" stamp when you beat your best round (needs two or more rounds).
    - Or a one-off note:
      - "Your first Best in show. The judges are impressed."
      - "Beat the herd on your first go. Beginner's luck?"
18. **The ox.**
    - It blinks on the start card now and then.
    - It looks impressed on the results when you win.
    - Tap the ox in the header: it moos.
19. **The story.**
    - Page 3 is now "Your go. How heavy was the ox?" with a slider, before you see anyone else's guess.
    - Page 4 drops your guess in among the 787: "You were 112 lb out."
    - Pages slide the way you're going.
    - **To see it:** menu, then The story.
20. **Yesterday's chart as a prize board** (from earlier this week): a row per rosette tier, a token per player.

## Before it goes live

- **Paste the rules first:** `firestore.rules` from this branch, in the Firebase console (Firestore, then Rules,
  then Publish). The only change lets the player summary record `kept` (calendar, home screen or no thanks). If the
  new code goes live first, player summaries won't save until the rules are in.
- **Reads:** a day's scores are now kept on the device (a past day's for good, today's for five minutes) instead of
  being read on every view. If the game keeps growing, the next step is one summary document per day of score
  counts, like the herd's.
- **To ship:** merge `delight` into `main` and push. Today and earlier days are unaffected (the deploy check guards
  that).
- **Not built, and why:**
  - A sixth question: both reviewers said no, because the round isn't where people drop off.
  - A prize case and a guessing-style line: more clutter than pull for now.
  - A crowd murmur: synthesised noise sounds like static.
  - Story drop-off tracking: needs a new collection and a rules change.
