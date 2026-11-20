# OxGuess: delight and come-back ideas (long list, 20 Nov 2026)

## Where we are

- **What already works:** the round itself is already rich: tickets dropping into the judges' box, the answer flag
  sliding out from your guess, the ox walking to the herd's guess, the strength tester with a bell at 20, rosettes,
  the end-of-round count-up, ribbon and bunting. Sounds are synthesised, and everything honours reduced motion.
- **The problem is coming back.**
  - Days 1 to 5 had 14, 38, 49, 56 and 42 finishers, then 112 on 20 Nov.
  - Next-day return runs at 20 to 39%.
  - 197 of 235 players have played only once.
  - Completion is high: about 85% of players who start a round finish it.
  - So nobody drops off inside the game; they simply don't remember to return, or don't feel a pull to.
- **Constraints:**
  - Keep it simple: plain JS, no accounts, no backend beyond the Firestore we have, no push service yet.
  - A country fair look: no emoji in the UI chrome, and category colours do the theming.
  - Never touch the questions or the scoring.

## A. The pull to come back

1. **"Where the herd finished" morning payoff.** The finished screen promises "the herd is still moving, come back
   tomorrow". When a returning player opens today's page, a small card at the top pays that off before today's
   start button:
   - "Yesterday: you finished 14th of 112."
   - You v the herd, final score.
   - Which question you won.
   - It animates in, like a results board being flipped.
2. **This week's series against the herd.** Each ticket on the week strip shows who won that day (a tiny fairgoer or
   ox stamp instead of a plain tick). A line reads "This week: You 3, Herd 1". Sunday settles the week ("You won the
   week!"). The week becomes a contest worth finishing.
3. **Tomorrow's peek.** On the finished screen, tomorrow shows as five face-down tickets with category icons, and
   one cryptic teaser line written per day ("Tomorrow: something in Tokyo, something with wings"). Curiosity is the
   hook. It needs a short teaser per date in the schedule, or one generated from tomorrow's categories.
4. **A daily reminder in your calendar.** A "Remind me tomorrow" button downloads a repeating `.ics` event at a time
   you pick ("OxGuess: five numbers", with a link). No push service needed, and it works on iPhone.
5. **Add to Home Screen nudge.** After your 2nd round, a gentle card explains how to add OxGuess to your home screen
   (iOS Share → Add to Home Screen). It needs a manifest and icons.
6. **Streak milestones as rosettes.** 3, 7, 14 and 30 days earn a special streak rosette ("A week at the fair") with
   its own pinning moment. A small "Next: 7 days, 2 to go" sits under the streak.
7. **Your prize case.** A lifetime collection of every rosette you've won, by tier ("Best in show ×2, First ×9…"),
   shown as a shelf that fills up. Collections pull people back. Built from localStorage history.
8. **Personal best moment.** When a round beats your best, a "New personal best" stamp lands on the score.
9. **First-ever moments.** Your first Best in show and your first win over the herd each get a one-time line ("Your
   first Best in show. The judges are impressed.").
10. **Your guessing style.** After 3 or more rounds, one line on the stats card: "You guess too high 68% of the
    time" or "You're best at How far". Personal insight people like to share.
11. **Today's champion.** The finished screen shows the day's top score so far ("Top score today: 96"). It's
    aspirational and needs no names.
12. **Live crowd count before you play.** "112 people have guessed today" ticking on the start card. It's social
    proof, and the fair feels busy.
13. **A sixth "bonus" question** (the owner asked us to judge this): optional, after the round, not scored into the
    100. Or a quick "Will you beat the herd?" prediction before the round. The risk: a longer, less snackable round.
14. **Catch up on yesterday.** Play yesterday's round "just for fun" after today's, when you missed it. It doesn't
    count for the streak.

## B. Small moments inside the round

15. **Satisfying buttons.** Primary buttons sink on press (translateY plus the bottom-edge shadow collapsing, scale
    .97), a soft tap sound and a 6 ms haptic. Consistent across all buttons.
16. **A slider that feels physical.**
    - The thumb squishes when grabbed.
    - The tick pitch rises gently as the value climbs.
    - A tiny haptic notch at "round" values (1,000, 1900, 100 km).
    - The readout digits roll like an odometer.
17. **Transitions between questions.** On Next, the current card slides off like a ticket torn from a book, and the
    next question's card slides in with its category colour sweeping across the progress pill.
18. **Category intro stamp.** Before each question, its category label stamps in for a beat ("How far" with the
    compass spinning).
19. **Rising chime for a run of good guesses.** Each consecutive 13+ question chimes a step higher (drapk.in's
    combo trick).
20. **Near-miss line.** 19 points: "So close!" with a little wobble of the bell (it nearly rang).
21. **Crowd murmur.** A soft filtered-noise "ooh" from the crowd when the herd's guess is revealed, louder when the
    herd beats you.
22. **The ox reacts.**
    - The start-card ox blinks now and then.
    - It looks happy or "wow" on the results when you beat the herd, "meh" when it beats you (oxHead has moods).
23. **Tap the ox for a moo.** An Easter egg: tapping the header ox plays a synthesised "moo" and the ox wiggles. A
    rare golden ox on a lucky tap?
24. **End-of-round arpeggio.** An up-arpeggio (C-E-G-C) when you beat the herd, a gentle falling one when you
    don't, instead of the same fanfare.
25. **Round score rolls with a tick per point**, ending on a "thunk", with personal best (8) if earned.

## C. The day screen and the story

26. **Start card progress as rosettes.** The five empty rings on the start card fill with each question's rosette
    as you go (they already show rosettes when done); the ring draws in with a stroke animation the first time.
27. **Today's ticket glows before you play.** The week strip's today ticket gently pulses until played.
28. **Yesterday's prize board animates in.** The tokens drop into their rows staggered when the card scrolls into
    view, and your face lands last.
29. **"The herd just moved."** If the herd's score changes while you're looking (it's refetched), the number ticks
    to the new value with a little ox nudge, rather than silently redrawing.
30. **An interactive story.** On page 2, instead of only watching, "Have a go: how heavy was the ox?" with the real
    slider. Your guess then appears among the 787 on the dot chart, next to the crowd's 1,207 lb and the true
    1,198 lb. You learn the mechanic by doing, and get a wow moment.
31. **Story page transitions.** Pages slide like turning a programme, and the bunting on the last page sways in.
32. **Time-of-day greeting** on the start card: "Morning at the fair" / "Evening at the fair".
33. **The streak pill without an emoji.** A small drawn flame or ticket in the header, in keeping with "no emoji in
    the chrome", that hops when the streak goes up.
34. **Dusk fair lights.** In dark mode, a string of little bulbs along the top of the header twinkles softly.
