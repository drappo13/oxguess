# OxGuess: the game, the feel, and what's next

Live at **https://oxguess.com** since 15 Nov 2026. Why particular choices were made is in `decisions.md`.

## The game

A daily numbers game for everyone. Five questions, each answered with a guess on a slider (or typed). Everyone
gets the same five each day. You win **up to 20 whole points per question, 100 per round**, by how close you are,
so nobody bombs out.

| Slot | Category | What goes in it |
|---|---|---|
| 1 | **When**: a year | Crisp events: first released, opened, discovered. |
| 2 | **How big**: height, weight, length or depth of a thing | Not geographic lengths like rivers (that's How far). Labels: How tall, How heavy, How long, or plain How big. |
| 3 | **How far**: point to point, as the crow flies | Fun landmark pairs (Wimbledon Centre Court → Court Philippe-Chatrier), at least ~100 km apart. |
| 4 | **How many**: a count | Finished or fixed things (an ended TV series, aircraft built). No death tolls. |
| 5 | **Wildcard** | How hot, how fast, how old, how long (time), or a weight. Same 20 points as the rest. |

Scoring: years and temperatures by distance across the slider; everything else on a log scale (2x off is about
half marks). Prize tiers: 20 Best in show, 17+ First, 13+ Second, 8+ Third, 3+ Highly commended, else Thanks for
entering. Slider ends are tidy figures (1/2/5 × 10ⁿ); the answer always sits 15–80% along. Metric and imperial
toggle on measured questions (remembered; US visitors default to imperial).

Accuracy bar: not clearly wrong under any reasonable reading, and every answer cites a real source (Wikipedia or
Wikidata so far, quoted as evidence in `site/data/questions.json`). Pin ambiguous measures in the wording ("to the tip of her torch").

## The feel

A country fair, not a tech startup: meadow greens and barn red, the Fredoka rounded font, a cartoon ox and a 1906
fairgoer (flat cap, moustache) as "the herd" and "you", prize rosettes, ink stamps, bunting, beige fair tickets. Dark
mode is the fair at dusk. Category colours do the theming; no emoji in the UI chrome.

The satisfying moments, borrowed in spirit from drapk.in:
- **Each guess:** the guess becomes a numbered fair ticket and drops into the judges' box; the timeline flag ticks
  from your guess to the answer; "x years too early" lands; a fairground strength tester fills to your points and
  rings the bell at 20 (bunting confetti, flash, haptics); the rosette pins on.
- **End of round:** your score and the herd's count up, a ribbon unfurls ("You beat the herd!"), your five rosettes
  drop in, "Round complete" is stamped and today's ticket on the week strip gets its green tick.
- **Streaks:** a week of beige tickets: green tick for played, greyed with a dash for missed, a play button on today.
- Sounds are synthesised (no files) with a mute toggle; everything respects reduced-motion.

## The herd

The crowd is the heart of it: "Together, the crowd knew."
- The reveal shows how the herd guessed (histogram), the herd's middle guess and its points, and "You beat X% of
  the herd" / "Your guess pulled the herd's middle closer to the answer."
- Results put **You vs The herd** side by side, question by question.
- The middle guess is the median, as in 1906 (robust to silly guesses).
- Every question starts with 15 seeded starter guesses (a crowd "hunch" near the answer, then scattered guesses
  and the odd wild one), kept forever so the herd never jumps when real players arrive. The starter herd averages
  about 75/100.

## The story (first visit, and "The story" in the header)

Five tap-through pages: the 1906 illustration (Plymouth, England); 787 tickets on a teetering balance; the guesses
spread on a dot chart; the crowd's middle guess (1,207 lb) landing next to the ox's weight (1,198 lb); "OxGuess is
that fair, every day" under swaying bunting. Facts from Galton's "Vox Populi", *Nature* 75 (1907). Frame it around
the ox and the fair, not Galton.

## Ideas for later

- **Question factory as a skill:** one agent drafts questions from sources, a second independently re-checks every
  answer, wording and fact; failures are dropped, not queued for a person (see `data-feasibility.md`).
- **From drapk.in, when wanted:** names and log-in, cross-device streaks, friends boards, share cards, Add to Home
  Screen, streak reminders by web push. Keep OxGuess simpler than drapk.in.
- **Early-days herd:** "you're one of the first N", next-morning herd summaries, a "Founding herd" badge.
- **Content:** news-linked distance pairs (this weekend's final venues), themed days (all five about one subject).
- `www.oxguess.com` over HTTPS should appear once GitHub adds www to the certificate.
