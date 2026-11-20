# OxGuess content

The questions live in `site/data/questions.json` (the bank) and `site/data/schedule.json` (which five play on
which date, in the order when, big, far, many, wild). The launch set was 105 questions written and checked as below;
the ids (`d01-when` and so on) come from that first draft's day numbers and mean nothing now.

## Sources

- **When, Big, Many, Wild**: English Wikipedia articles, one per question. `source.url` is the article. Wikipedia
  articles on rulebook items (tennis court, cricket pitch, bowling lane, FIBA court, golf hole) cite the governing body's
  rules.
- **How far**: coordinates (P625) of the two places from Wikidata, read through the QLever mirror
  (`scripts/explore/wd.py`). `source.url` and `source.url2` are the two Wikidata items. `evidence` lists both points
  (`Point(lon lat)`) and the result. The distance is great-circle (haversine, R = 6371.0088 km), rounded to whole km;
  `alt` is the same distance in miles. Items with more than one P625 value were checked: the spread changed nothing after
  rounding.
- **Fun facts** come from the same article as the answer. For How far, the fact comes from the English Wikipedia
  article on one of the two places.

## How it was checked

1. Every article was fetched (MediaWiki `action=parse`, November 2026), converted to plain text and cached.
2. Each `evidence` field is an exact quote from that text, including infobox lines such as
   `Running time | 201 minutes`. Where an answer needs two facts (the `old` questions, which need a birth date and an
   event date), both quotes are given, joined by ` … `. A build script checked that every quote appears word for word in
   the fetched article.
3. Where a thing has several legitimate figures, the question pins one: Statue of Liberty "from the ground to the tip
   of her torch", Burj Khalifa "to the top of its spire", Statue of Unity "not counting its base", Great Pyramid "when
   it was first built", Sydney Harbour Bridge "steelwork ... arch and approach spans included", Friends "not counting
   the 2021 reunion special", Bohemian Rhapsody "the original 1975 single".
4. Ages (`old`) were worked out from the two dates in the evidence (for example, Pelé was born on 23 October 1940 and
   the 1958 final was on 29 June 1958, so he was 17).
5. Unit conversions not stated in the source: bowling lane 60 ft is 18.29 m (the article gives both), golf hole
   108 mm is shown as 10.8 cm, Bohemian Rhapsody 5:55 is 355 s, Isner v Mahut 11 h 5 min is 665 min.
6. Structure checks: the JSON parses, there are 21 days of 5 questions in the right order, ids are unique, every
   How far answer is over 100 km, `lin` questions carry `min` and `max` with the answer between 20% and 80% of the
   range, and no question or fact contains an em-dash.

## Slider ends

Worked out on 20 Nov 2026 from the 25 sliders the owner set by hand, and used for every question set since.

1. **Round, natural ends.** 1, 2, 5, 10, 20, 25, 50, 100, 150, 200, 250, 500 and so on. Low end is the honest floor
   where there is one (1 for counts and lengths, 0 for ages and temperatures, absolute zero, the present year 2026 as
   the top for anything recent).
2. **Realistic for the kind of thing, but room for the clueless.** The high end is a believable ceiling for that kind
   of thing (a film runs up to 240 minutes, a train tops out near 1,000 km/h, nowhere on Earth is over 20,000 km
   away), and the range still holds the guesses someone with no idea would make. Don't narrow it so far that it
   gives the answer away.
3. **Even (`lin`) for small counts and sizes** with a floor of 1 that stay within about two orders of magnitude
   (piano keys, episodes, letters, minutes, a court's length). **Log** for distances, heights, weights and
   populations that span many.
4. **A and B put the answer either side of the middle**, typically one around 20 to 45% along and the other 55 to
   90%. Every slider starts in the middle and guesses drift towards it (the A/B test, 19 to 20 Nov), so the answer
   should never sit near 50% on both. Up to about 90% along is fine when the realistic ceiling forces it; when it
   can't be done honestly (a recent year can't pass 2026), both on one side is fine.
5. **B is its own slider, not a mechanical mirror.** Often B is the wider, more open one (floor of 1, or a higher
   ceiling) and A the tighter, realistic one, or the other way round.

Years: modern things get a window ending at 2026 or a round year near it, from a sensible era start (Gangnam Style
2000 to 2026, Star Wars 1950 to 2026); older things a few centuries (the Colosseum 500 BC to AD 1500).

## Changes since launch

- 15 Nov 2026: reshuffled so day 1 had Lake Baikal's depth (as How big) and Isner v Mahut (wildcard); the rest dealt
  randomly with no repeated landmark in a day and at most one space question a day. Tsar Bell moved to the wildcards.
- 16 Nov 2026: split into a bank and a dated schedule. Ages (How old) moved to a plain 0 to 100 years slider. Statue
  of Unity (too obscure) and the Rubik's Cube stickers (too easy to work out) retired. Today got the Titanic and the
  lowest recorded temperature; the CN Tower and the 747s filled the gaps, so the schedule now runs to 4 Dec, with
  Herschel's Uranus, Angkor Wat to the Forbidden City and the Wright brothers' flight left as spares.
