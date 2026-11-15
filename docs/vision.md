# OxGuess: vision and running notes

Domain: **oxguess.com** (available as of 15 Nov 2026).

## The game

A daily numbers game. Five questions, each answered with a guess on a slider (or typed). You score up to
100 per question by how close you are, so nobody bombs out. Everyone gets the same five questions each day.

Each day has one question from each category:

| Slot | Category | Notes |
|---|---|---|
| 1 | **When**: a year | Plenty of data. |
| 2 | **How big**: height, weight, or the length of an *object* | Not geographic lengths like rivers (too close to How far). Weight is in: "weigh the ox", the Moon, the Eiffel Tower. Short objects in feet are good (tennis court, baseball bat). |
| 3 | **How far**: point to point | Fun landmark pairs beat city pairs (Wimbledon Centre Court → Court Philippe-Chatrier, not London → Paris). News-relevant pairs later, not MVP. |
| 4 | **How many**: a count | Good category, but the data could be anything. Idea: work backwards from a number ("what is 2049?"). |
| 5 | **Wildcard** | Rotates: speed, temperature, age, duration, money, %. Possibly double points. |

Every answer must be **exact and indisputable**. No "how long is a blue whale" (varies by animal). The
prototype's "interesting fact" under each answer comes from an LLM, grounded in a source and checked.
Volume is small: 5 a day is about 1,825 a year, so every question can be reviewed.

## Theme: the ox and the crowd

Named after the 1906 Plymouth fair, where about 800 people guessed the weight of an ox and the middle
guess of the crowd landed within 1% of the true weight. (Write the story about the ox and the fair, not about
Francis Galton, who later became known for eugenics.)

- The whole thing is ox-themed, with a cool, friendly ox logo. Fun, warm, a bit playful.
- Intro tells the ox story, with some graphics.
- **The crowd ("the herd") is a sub-theme of the whole game**: how good is everyone together?
  - Daily crowd metrics: did the herd beat the average player today? Herd guess vs answer per question.
  - "You helped the herd today": your guess pulled the crowd average towards the answer (the herd average
    was above the answer and you guessed below it, or the other way round).
  - Players like playing together: the crowd histogram on each reveal is the key shared moment.

## Later (from drapk.in)

Streaks, friends boards, "tick off today", guest play then pick a name, log in, share grids, Add to Home
Screen, reminders. Reuse the patterns and code from drapk.in (`Player-Chain-Blitz`): `lib/daily.ts`
streaks, guest players stored as ordinary docs, Friends, `/stats`, end-screen flow.

## Prototype

`prototype/ballpark-v0.html` is the first playable mock (published as a private artifact,
https://claude.ai/artifact/G7NNqaBECoMipWta7tU16c). Its crowd is simulated.
