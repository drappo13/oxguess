"""Reshuffle the launch rounds: pin chosen questions to day 1, deal the rest randomly across the days.

Each day still gets one question per category (when, big, far, many, wild). A day is rejected and redealt
if two questions share a landmark or there is more than one space question.

usage: python3 scripts/reshuffle.py   (reads content/rounds-v1.json, writes content/rounds-v2.json and
site/data/rounds.json)
"""
import json
import random
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
src = json.loads((ROOT / "content/rounds-v1.json").read_text())
qs = {q["id"]: q for day in src["days"] for q in day["questions"]}

# Freddy's picks for day 1 (15 Nov 2026). Baikal goes in day 1's "How big" slot.
baikal = dict(qs.pop("d15-wild"), cat="big", kind=None)
isner = qs.pop("d06-wild")
# One "big" weight moves to the wildcard pool so every category still has 21 questions.
bell = dict(qs.pop("d16-big"), cat="wild", kind="weight")
qs[bell["id"]] = bell
pinned = {"big": baikal, "wild": isner}

CATS = ["when", "big", "far", "many", "wild"]
pools = {c: [q for q in qs.values() if q["cat"] == c] for c in CATS}
pools["big"] = [q for q in pools["big"]]  # baikal is pinned separately
for c in CATS:
    need = 21 - (1 if c in pinned else 0)
    assert len(pools[c]) == need, (c, len(pools[c]), need)

LANDMARKS = ["eiffel", "colosseum", "burj", "statue of liberty", "hagia sophia", "leaning tower", "pisa", "pyramid",
             "giza", "taj mahal", "forbidden city", "golden gate", "sydney opera", "wimbledon", "christ the redeemer",
             "disney", "terracotta", "angkor", "machu picchu", "stonehenge", "petra", "everest", "abbey road",
             "graceland", "kennedy space", "saturn v", "concorde", "a380", "boeing", "kremlin", "tsar", "big ben",
             "panama", "uluru", "times square", "lord's", "cricket", "tennis", "golf", "beatles", "friends",
             "star wars", "pokémon", "monopoly", "rubik", "olympic", "world cup", "fifa", "shinkansen", "tgv"]
SPACE = ["uranus", "saturn v", "kennedy space", "baikonur", "moon", "venus", "apollo", "nasa"]


def text(q):
    return (q["q"] + " " + q.get("source", {}).get("name", "")).lower()


def ok(day):
    seen = set()
    for q in day:
        t = text(q)
        hits = {k for k in LANDMARKS if k in t}
        if hits & seen:
            return False
        seen |= hits
    return sum(any(k in text(q) for k in SPACE) for q in day) <= 1


rng = random.Random(20261115)
for attempt in range(20000):
    dealt = {c: rng.sample(pools[c], len(pools[c])) for c in CATS}
    days = []
    for i in range(21):
        day = []
        for c in CATS:
            if i == 0 and c in pinned:
                day.append(pinned[c])
            else:
                day.append(dealt[c].pop())
        days.append(day)
    # Day 1 must not reuse any of the old day-1 questions (they already have a few guesses stored).
    if any(q["id"].startswith("d01-") for q in days[0]):
        continue
    if all(ok(d) for d in days):
        break
else:
    raise SystemExit("no clean deal found")

out = {"version": 2, "generated": "2026-11-15", "note": "Reshuffled from rounds-v1; day 1 pins Lake Baikal and Isner-Mahut.",
       "days": [{"day": i + 1, "questions": d} for i, d in enumerate(days)]}
(ROOT / "content/rounds-v2.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
(ROOT / "site/data/rounds.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
print(f"dealt after {attempt + 1} tries")
for i, d in enumerate(days[:3]):
    print(f"day {i + 1}:", " | ".join(f"{q['cat']}: {q['q'][:48]}" for q in d))
