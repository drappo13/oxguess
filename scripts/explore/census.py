"""Quantity census: for a property, how many well-known non-human items have ONE agreed value?

Values are compared after Wikidata's own unit normalisation (to SI). An item counts as "clean" when all
its non-deprecated values agree within 1% (so 93 m and 305 ft are one value, 157 cm vs 170 cm is not).

usage: python3 census.py P2048 [min_sitelinks] [--show N]
"""
import collections
import json
import sys
from wd import sparql, qid

prop = sys.argv[1]
min_sl = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 40
show = int(sys.argv[sys.argv.index("--show") + 1]) if "--show" in sys.argv else 30

rows = sparql(f"""
PREFIX psn: <http://www.wikidata.org/prop/statement/value-normalized/>
SELECT ?item ?itemLabel ?sl ?norm ?amount ?unitLabel ?typeLabel WHERE {{
  ?item p:{prop} ?st ; wikibase:sitelinks ?sl .
  FILTER(?sl >= {min_sl})
  ?st wikibase:rank ?rank . FILTER(?rank != wikibase:DeprecatedRank)
  ?st psv:{prop} ?v . ?v wikibase:quantityAmount ?amount ; wikibase:quantityUnit ?unit .
  OPTIONAL {{ ?st psn:{prop} ?nv . ?nv wikibase:quantityAmount ?norm . }}
  MINUS {{ ?item wdt:P31 wd:Q5 }}
  OPTIONAL {{ ?unit rdfs:label ?unitLabel . FILTER(LANG(?unitLabel) = "en") }}
  OPTIONAL {{ ?item wdt:P31 ?type . ?type rdfs:label ?typeLabel . FILTER(LANG(?typeLabel) = "en") }}
  ?item rdfs:label ?itemLabel . FILTER(LANG(?itemLabel) = "en")
}}""")

items = {}
for r in rows:
    it = items.setdefault(r["item"], {"label": r["itemLabel"], "sl": int(r["sl"]), "vals": set(), "raw": set(), "types": set()})
    v = float(r.get("norm") or r["amount"])
    it["vals"].add(v)
    it["raw"].add(f'{float(r["amount"]):g} {r.get("unitLabel", "")}'.strip())
    if r.get("typeLabel"):
        it["types"].add(r["typeLabel"])

clean, disputed = [], []
for k, it in items.items():
    vals = [abs(x) for x in it["vals"] if x != 0] or [0]
    ok = max(vals) <= min(vals) * 1.01 if min(vals) > 0 else len(it["vals"]) == 1
    (clean if ok else disputed).append((k, it))

types = collections.Counter(t for _, it in clean for t in list(it["types"])[:1])
print(f"{prop}: {len(items)} well-known non-human items (>= {min_sl} wikis); {len(clean)} clean, {len(disputed)} disputed")
print("top types (clean):", ", ".join(f"{t} {n}" for t, n in types.most_common(15)))
clean.sort(key=lambda x: -x[1]["sl"])
print("\nmost famous clean:")
for k, it in clean[:show]:
    print(f"  {it['label']} | {' / '.join(sorted(it['raw']))} | {', '.join(list(it['types'])[:2])} | {it['sl']}")
print("\nexamples of disputed:")
for k, it in sorted(disputed, key=lambda x: -x[1]["sl"])[:8]:
    print(f"  {it['label']} | {' / '.join(sorted(it['raw']))}")

json.dump({"prop": prop, "min_sitelinks": min_sl, "items": len(items), "clean": len(clean), "disputed": len(disputed),
           "top_types": types.most_common(30),
           "clean_items": [{"qid": qid(k), "label": it["label"], "sl": it["sl"], "values": sorted(it["raw"]), "types": sorted(it["types"])} for k, it in clean]},
          open(f"../../data/samples/census-{prop}-{min_sl}.json", "w"), indent=1, ensure_ascii=False)
