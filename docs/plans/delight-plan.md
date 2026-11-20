# OxGuess delight: the plan (merged from the product and design reviews, 20 Nov 2026)

The round stays five questions. Neither review wanted more: the round isn't where people drop off, and a longer one
loses the snack. Nothing below makes a round longer; tap-to-hurry makes it shorter.

## Coming back (the real problem)

1. **Tonight's placing.** On the results card: "Right now you're 14th of 112. Final placings in the morning."
   It leaves a loop open overnight.
2. **Morning payoff.** When you open today unplayed, a chalkboard-style "Yesterday's final placings" card sits
   above the start card:
   - "You finished 14th of 112", with the number counting up.
   - "The herd scored 74. You beat it by 6", or "The herd had the edge by 3".
   - A link down to the full yesterday board.
   - If you missed yesterday: "The herd scored 74 yesterday. Fancy your chances?"
3. **The week against the herd.** Each played ticket shows a tiny fairgoer (you won), ox (the herd won) or both
   (draw) instead of a plain tick. "This week: You 3, The herd 1." On Sunday it says "You won the week" or "The herd
   takes the week."
4. **Tomorrow's teaser.** Under the countdown: "Tomorrow: a famous bridge, and something very hot." The hints are
   vague one-liners per question in `site/data/teasers.json`, so the question bank isn't touched. Days without them
   show nothing.
5. **"Same time tomorrow?"** A card shown once, after your first finished round:
   - Add to calendar: a repeating 8am `.ics`.
   - Add to Home Screen: a web manifest and icons; on iPhone, one line of instructions.
   - "No thanks" hides it for good.
6. **Share text with the herd.**
   ```
   OxGuess Round 6 🐂
   🏆🥇🥈🎗️🥉 78/100
   Beat the herd by 6 🐄
   🔥 3-day streak
   oxguess.com
   ```
7. **Streak.**
   - A drawn ticket stub replaces the 🔥 in the header (no emoji in the chrome), and it hops when the streak goes
     up. The endless pulse goes.
   - A next-milestone line: "Next prize: A week at the fair, 2 days to go."
   - Tomorrow's ticket is outlined, "Day 2".
8. **Tab title after midnight.** A tab left open reads "New round · OxGuess".
9. **Turnstile count on the start card.** "112 through the gate today."

## Feel (inside the round)

10. **Buttons.** Primary buttons sink (scale .97, translateY 3px, the shadow collapsing) with a soft tap sound and
    haptic 6, and spring back on release.
11. **Sound pass.**
    - The bell gets real bell partials and a strike.
    - The strength tester ticks up a semitone per point and lands on a thunk, replacing the sawtooth whoosh.
    - Beating the herd on a question gets a "ding-ding".
    - A run of 13+ guesses chimes a tone higher each time.
    - Ends: a win arpeggio (filtered brass), a good-humoured oompah when the herd wins, a pin "tk" for rosettes.
    - Tick and count sounds get separate throttles.
    - No pile-up of sounds under reduced motion.
12. **Tap to hurry.** Tapping the reveal card skips to the end of its sequence. Timings are trimmed by about 1 s a
    question.
13. **Near miss at 19.** The bell trembles and the line reads "A whisker off the bell!"
14. **The ox reacts.** The start-card ox blinks now and then; the results ox wears "wow" when you win and "meh" when
    you lose.
15. **Ticket punch.** The stub gets a punched hole with a "chk" as it lifts at lock-in.
16. **Slider.** The tick pitch rises along the slider, a blip at round-number notches, and the thumb squishes when
    grabbed.
17. **Personal best and first-evers.** A red "Personal best" stamp on the score. One-off judges' notes ("Your first
    Best in show. The judges are impressed."). Never more than one per round.
18. **Moving between questions.**
    - The card slides out and the next slides in (300 ms in all).
    - The progress segment fills, and the category pill pops.
    - The reveal card rises in.
    - Reduced motion: a crossfade.
19. **The herd just moved.** If the herd's score changes while you look, it counts to the new value and the ox
    nudges.
20. **Tap the ox for a moo.** The header ox wiggles and moos, at most once every 1.5 s.
21. **Interactive story.** Page 3: "Your go. How heavy was the ox?" on a real slider. Page 4 drops your dot among
    the 787 next to the crowd's 1,207 lb and the true 1,198 lb. Pages slide in the direction you're going.

## Left out, and why

- **A sixth question, a bonus question or a prediction:** longer rounds, more content, weaker reveals.
- **Prize case, guessing style:** more cards on a long screen; too few players have the history yet.
- **Crowd murmur:** synthesised noise sounds like static.
- **Golden ox, greeting, dusk lights:** decoration, or a second hidden system.
- **Story drop-off tracking:** worth doing, but it needs a new Firestore collection and a rules change made in the
  console. Next time.
