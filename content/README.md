# OxGuess launch content

`rounds-v1.json` holds 21 days of five questions (105 in all), always in the order
when, big, far, many, wild.

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
