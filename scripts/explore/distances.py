"""How far: how many well-known places have coordinates, and what do fun pairs look like?

Great-circle distance is computed (haversine), so no API is needed; it only depends on the two points.
"""
import json
import math
import random
import re
import sys
from wd import sparql, qid

MIN_SL = int(sys.argv[1]) if len(sys.argv) > 1 else 50

# Famous places of the kinds that make fun pairs: landmarks, stadiums, venues, buildings, natural wonders.
rows = sparql(f"""
SELECT ?item ?itemLabel ?coord ?sl ?typeLabel WHERE {{
  ?item wdt:P625 ?coord ; wikibase:sitelinks ?sl ; wdt:P31 ?type .
  FILTER(?sl >= {MIN_SL})
  MINUS {{ ?item wdt:P31 wd:Q5 }}
  VALUES ?type {{ wd:Q2319498 wd:Q483110 wd:Q1076486 wd:Q12518 wd:Q570116 wd:Q33506 wd:Q16970 wd:Q2977
                  wd:Q16560 wd:Q41176 wd:Q4989906 wd:Q12280 wd:Q34038 wd:Q8502 wd:Q23397 wd:Q11303 wd:Q44539
                  wd:Q1248784 wd:Q174782 wd:Q179700 wd:Q24354 wd:Q153562 wd:Q1307276 wd:Q2087181 wd:Q839954
                  wd:Q1081138 wd:Q17350442 wd:Q5003624 wd:Q15243209 wd:Q55488 wd:Q644371 wd:Q107425 }}
  ?item rdfs:label ?itemLabel . FILTER(LANG(?itemLabel) = "en")
  ?type rdfs:label ?typeLabel . FILTER(LANG(?typeLabel) = "en")
}}""")

places = {}
for r in rows:
    m = re.match(r"(?i)Point\(([-\d.eE]+) ([-\d.eE]+)\)", r["coord"])
    if not m:
        continue
    p = places.setdefault(r["item"], {"label": r["itemLabel"], "sl": int(r["sl"]), "lon": float(m[1]), "lat": float(m[2]), "types": set()})
    p["types"].add(r["typeLabel"])

print(f"{len(places)} well-known places (>= {MIN_SL} wikis) with coordinates")
from collections import Counter
print("by type:", ", ".join(f"{t} {n}" for t, n in Counter(t for p in places.values() for t in p["types"]).most_common(20)))


def km(a, b):
    R = 6371.0088
    la1, la2 = math.radians(a["lat"]), math.radians(b["lat"])
    dla, dlo = la2 - la1, math.radians(b["lon"] - a["lon"])
    h = math.sin(dla / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(dlo / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


n = len(places)
print(f"possible pairs: {n * (n - 1) // 2:,}")
random.seed(15)
ps = list(places.values())
print("\nrandom pairs:")
for _ in range(15):
    a, b = random.sample(ps, 2)
    print(f"  {a['label']} → {b['label']}: {km(a, b):,.0f} km")

json.dump([{"qid": qid(k), **{kk: (sorted(v) if isinstance(v, set) else v) for kk, v in p.items()}} for k, p in places.items()],
          open(f"../../data/samples/places-{MIN_SL}.json", "w"), indent=1, ensure_ascii=False)
