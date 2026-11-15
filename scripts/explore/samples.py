"""Pull sample candidates per category so we can judge quality by eye.

usage: python3 samples.py <probe> [min_sitelinks]
"""
import json
import sys
from wd import sparql, qid

LABELS = 'SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }'


def quantity_probe(prop, min_sl, limit=400, extra=""):
    """Items with a numeric property, its unit, and what kind of thing they are."""
    return sparql(f"""
      SELECT ?item ?itemLabel ?amount ?unitLabel ?sl (SAMPLE(?typeLabel_) AS ?type) WHERE {{
        ?item p:{prop} ?st ; wikibase:sitelinks ?sl .
        FILTER(?sl >= {min_sl})
        ?st psv:{prop} ?v ; wikibase:rank ?rank . FILTER(?rank != wikibase:DeprecatedRank)
        ?v wikibase:quantityAmount ?amount ; wikibase:quantityUnit ?unit .
        OPTIONAL {{ ?item wdt:P31 ?type_ . ?type_ rdfs:label ?typeLabel_ . FILTER(LANG(?typeLabel_) = "en") }}
        {extra}
        ?unit rdfs:label ?unitLabel . FILTER(LANG(?unitLabel) = "en")
        ?item rdfs:label ?itemLabel . FILTER(LANG(?itemLabel) = "en")
      }} GROUP BY ?item ?itemLabel ?amount ?unitLabel ?sl ORDER BY DESC(?sl) LIMIT {limit}""")


def coord_probe(type_qid, min_sl, limit=300):
    return sparql(f"""
      SELECT ?item ?itemLabel ?coord ?sl ?countryLabel WHERE {{
        ?item wdt:P31/wdt:P279? wd:{type_qid} ; wdt:P625 ?coord ; wikibase:sitelinks ?sl .
        FILTER(?sl >= {min_sl})
        ?item rdfs:label ?itemLabel . FILTER(LANG(?itemLabel) = "en")
        OPTIONAL {{ ?item wdt:P17 ?country . ?country rdfs:label ?countryLabel . FILTER(LANG(?countryLabel) = "en") }}
      }} ORDER BY DESC(?sl) LIMIT {limit}""")


def date_probe(prop, min_sl, limit=400):
    return sparql(f"""
      SELECT ?item ?itemLabel ?date ?precision ?sl (SAMPLE(?typeLabel_) AS ?type) WHERE {{
        ?item p:{prop} ?st ; wikibase:sitelinks ?sl .
        FILTER(?sl >= {min_sl})
        ?st psv:{prop} ?v . ?v wikibase:timeValue ?date ; wikibase:timePrecision ?precision .
        OPTIONAL {{ ?item wdt:P31 ?type_ . ?type_ rdfs:label ?typeLabel_ . FILTER(LANG(?typeLabel_) = "en") }}
        ?item rdfs:label ?itemLabel . FILTER(LANG(?itemLabel) = "en")
      }} GROUP BY ?item ?itemLabel ?date ?precision ?sl ORDER BY DESC(?sl) LIMIT {limit}""")


PROBES = {
    "height": lambda sl: quantity_probe("P2048", sl),
    "mass": lambda sl: quantity_probe("P2067", sl),
    "length": lambda sl: quantity_probe("P2043", sl),
    "area": lambda sl: quantity_probe("P2046", sl),
    "episodes": lambda sl: quantity_probe("P1113", sl),
    "floors": lambda sl: quantity_probe("P1101", sl),
    "capacity": lambda sl: quantity_probe("P1083", sl),
    "produced": lambda sl: quantity_probe("P1092", sl),
    "deaths": lambda sl: quantity_probe("P1120", sl),
    "speed": lambda sl: quantity_probe("P2052", sl),
    "melting": lambda sl: quantity_probe("P2101", sl),
    "duration": lambda sl: quantity_probe("P2047", sl),
    "boxoffice": lambda sl: quantity_probe("P2142", sl),
    "opening": lambda sl: date_probe("P1619", sl),
    "inception": lambda sl: date_probe("P571", sl),
    "publication": lambda sl: date_probe("P577", sl),
    "stadiums": lambda sl: coord_probe("Q483110", sl),
    "landmarks": lambda sl: coord_probe("Q2319498", sl),  # landmark
    "towers": lambda sl: coord_probe("Q12518", sl),
    "museums": lambda sl: coord_probe("Q33506", sl),
}

if __name__ == "__main__":
    name = sys.argv[1]
    sl = int(sys.argv[2]) if len(sys.argv) > 2 else 40
    rows = PROBES[name](sl)
    for r in rows:
        r["item"] = qid(r["item"])
    json.dump(rows, open(f"../../data/samples/{name}.json", "w"), indent=1, ensure_ascii=False)
    for r in rows[:40]:
        vals = " | ".join(str(r.get(k, "")) for k in ("itemLabel", "amount", "unitLabel", "date", "coord", "type", "countryLabel", "sl") if r.get(k))
        print(vals)
    print(f"... {len(rows)} rows total")
