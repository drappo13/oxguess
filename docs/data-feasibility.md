# Can we get enough good questions? (data feasibility, 15 Nov 2026)

**Status (15 Nov 2026):** launched with 21 days (105 questions) written and source-checked by hand-run agents
(`content/`). The automated question factory below is the plan for keeping it going; it isn't built yet.

**Short answer: yes, but not just by pulling straight from a database.** Wikidata has thousands of well-known
numeric facts per category, enough for years of play. Around 10–20% of its values are disputed or plain
wrong, and the most famous things are the most likely to have several competing figures. So the plan is a
**question factory**: pull candidates automatically, let an LLM phrase each question so it pins one exact
figure, check that figure against a second source, then a person approves it. We need about 1,825 questions a
year (5 a day), which is about 35 a week to review (around 10 minutes).

**The accuracy bar (Freddy, 15 Nov):** it's a game, not a science paper. An answer doesn't need to be
beyond all argument; it must **not be clearly wrong under any reasonable reading of the question**, and
**every answer must cite a real source** (Wikipedia, an official body, a rulebook, a record keeper), never
just an LLM's memory. Each question stores its source URL, and the reveal can link to it.

Sources don't have to be Wikidata. A handful of long, reliable lists covers most of what we need: Wikipedia
"List of tallest statues", "List of heaviest bells", "List of most-produced aircraft", sports rulebooks,
Guinness and record keepers, NASA fact sheets, official building sites.

Scripts are in `scripts/explore/` (stdlib Python, queries the QLever Wikidata mirror, which answers in seconds
where the main Wikidata service times out). Raw output is in `data/samples/`.

"Well-known" below means the item has a page in at least 40 Wikipedia languages. That is a rough fame filter. Fun
places are often below it (Court Philippe-Chatrier has 3), so fame should eventually come from English
Wikipedia page views, as drapk.in does for players.

## Category by category

### 📅 When: plenty

| Source (Wikidata) | Well-known items (≥40 wikis) | ≥80 wikis |
|---|---|---|
| Founded / inception | 21,055 | 3,241 |
| Points in time (events) | 4,233 | 2,425 |
| Released / published (films, games, albums, books) | 3,552 | 299 |
| Discovered / invented | 1,942 | 323 |
| Officially opened | 929 | 70 |

Examples: Minecraft released (2011), Uranus discovered (1781), basketball invented (1891), Pluto discovered
(1930), The Matrix released (1999).

Watch-outs: films have several release dates (premiere, US, UK), so the question asks for the year of
**first** release. "Invented" is often arguable (the computer: 1945?), so prefer crisp events: opened,
released, discovered, first flight, first ascent.

### 📏 How big: enough, with editing

- **Heights**: 1,643 well-known non-human items have one; 1,431 have a single agreed value. Best kinds:
  buildings, towers, monuments, waterfalls, statues, paintings. Taj Mahal 73 m, Leaning Tower of Pisa
  58.36 m, Golden Gate Bridge towers 746 ft. The most famous ones have several figures (Eiffel Tower 300 /
  324 / 330 m; Burj Khalifa 584.5 / 828 / 829.8 m). Pick a trusted figure and say which one in the question:
  "to the tip of its antenna", "as built in 1889".
- **Weights**: 4,285 well-known items; most are chemicals and species. The good ones are planets and moons,
  landmarks (Eiffel Tower 10,100 tonnes), vehicles and aircraft. Animal weights conflict (lion 126 vs 188 kg),
  as you'd expect. Astronomical weights need a display idea, because nobody can picture 73.5 sextillion tonnes
  (for example "how many Moons make an Earth?").
- **Object lengths**: Wikidata lengths are almost all rivers, islands and mountain ranges, which is How
  far's territory. Short objects (tennis court 78 ft, cricket pitch 22 yards, marathon 42.195 km, bowling
  lane 60 ft) come from **sports rulebooks and official specs**. That's a one-off curated list of a couple of
  hundred, and it never goes stale.
- **People**: no heights or weights of people. Wikidata shows why: Trump has five different heights, Putin
  two. Even for sportspeople, weights change across a career and listed figures are rounded or flattering.
  Use fixed moments instead (Bolt's 100 m record time, a regulation shot put = 7.26 kg).

### 🧭 How far: unlimited, choose for fun

1,243 well-known places with coordinates (stadiums, landmarks, museums, palaces, airports, mountains) gives
770,000 possible pairs before even adding venues. Distance is calculated exactly from the two coordinates, so
no API or distance list is needed. **Random pairs are dull** ("Hjälmaren → Ngurah Rai Airport"), so pairs are
**chosen** from themed sets (a LLM can suggest, a person picks):

| Pair | As the crow flies |
|---|---|
| Wimbledon Centre Court → Court Philippe-Chatrier | 336.9 km |
| Old Trafford → Camp Nou | 1,383 km |
| Stonehenge → Great Pyramid of Giza | 3,596 km |
| Big Ben → Statue of Liberty | 5,575 km |
| Augusta National → St Andrews Links | 6,327 km |
| Abbey Road Studios → Graceland | 7,027 km |
| Christ the Redeemer → Sydney Opera House | 13,516 km |

Rule: keep pairs at least about 100 km apart, so a slightly off coordinate (a stadium's pin could be 200 m
from centre) changes the answer by far less than the 2% bullseye. News-linked pairs (this weekend's final
venues) fit straight in later.

### 🔢 How many: hundreds, spread thin

No single source, but lots of small ones (well-known items with one agreed value):

| Count | Items | Examples |
|---|---|---|
| Episodes | 332 | Game of Thrones 73, South Park 344 |
| Capacity | 256 | Colosseum 65,000, Maracanã 78,838 |
| Total produced | 282 | Boeing 747s built 1,574, Airbus A380s built 251 |
| Parts of a work | 208 | Tale of Genji 54 chapters, Naruto 72 volumes |
| Floors | 76 | Petronas Towers 88, Burj Khalifa 163 |
| Collection size | 45 | British Museum 8 million objects |
| Deaths | 236 | Avoid. Wrong tone for a friendly game. |

Watch-outs: **anything still changing** (The Simpsons' episodes, stadium capacities after a rebuild) is
either dropped or asked "as of" a date. Finished things are best (A380 production ended, Game of Thrones
ended). An LLM can also suggest count questions ("bones in the human body", "keys on a piano", "squares on a
Scrabble board"). Those then need the same check against a source.

**Working backwards from a number** (`reverse_number.py`) works technically: give it 88 and it finds every
well-known thing with exactly 88 of something. But most results are junk (village populations, elevations,
thermal conductivity of osmium), with the odd gem (The Lion King runs 88 minutes; Petronas Towers have 88
floors; The Tale of Genji has 54 chapters). Wikipedia's "54 (number)" style pages are mostly maths. Verdict:
a nice **ideas tool for whoever picks questions**, not a generator. It could also power a later twist (a
"number of the day" that links all five answers).

### 🎲 Wildcard: fine if we stay with exact kinds

The trick is to only use wildcard types where the number is fixed by definition or by record:

- **How hot**: melting and boiling points (gold melts at 1,064 °C), planet surface temperatures.
  Physical constants never change.
- **How fast**: records (land speed record, Thrust SSC 1,228 km/h; fastest serve; Concorde's cruise speed).
- **How old**: calculated exactly from two dates (age at coronation, at first Oscar, at death). Wikidata has
  birth and event dates for millions of people.
- **How long (time)**: world-record times, film running times (say "theatrical cut"), how long a mission
  lasted (Apollo 11: 8 days 3 h).
- **Money**: risky (inflation, conflicting box office). Only with a named source and year.
- **Percentages**: few exact ones. Curated list only.

Double points for the wildcard works, because it'll often be the least familiar kind of number.

## The question factory (proposed)

1. **Generate** candidates per category: Wikidata queries (as in `scripts/explore/`), curated lists
   (rulebooks, records), and LLM suggestions.
2. **Score fame**: English Wikipedia page views, so questions are about things people have heard of.
3. **LLM pass** per candidate: word the question so it pins one figure ("from the ground to the tip of the
   torch"), give units and a sensible slider range, write the fun fact from the Wikipedia intro (not from
   memory), and flag anything arguable.
4. **Auto-check**: the figure must also appear on the item's English Wikipedia page (or a named official
   source). Where they disagree, it goes to review with both figures shown. Example caught already: Wikidata
   gives the Mona Lisa as 79.4 cm tall; the Louvre and Wikipedia say 77 cm.
5. **No human review (Freddy, 15 Nov).** Instead a Claude Code skill runs the whole factory on a schedule: one
   agent drafts a batch from sources, a second independent agent re-fetches every source and checks each
   answer, wording and fact, and anything that fails is dropped rather than queued for a person.
6. **Schedule**: approved questions go into a frozen schedule months ahead, with variety rules (no two
   space questions in a week, a mix of eras and regions).

The LLM cost is tiny at this volume (a few thousand short calls a year).

## Open questions

- Units: metric first with imperial underneath, or follow the player's locale?
- Huge numbers (the weight of the Moon): log slider plus a friendlier display, or avoid?
- Wildcard at double points: yes or no?
- ~~How much hand-curation?~~ None: fully automatic via a skill (see step 5). Launch content: 3 weeks written
  and source-checked up front (now in `site/data/questions.json`) to test whether the game gets traction first.
