"""How many well-known items have each numeric property? Well-known = linked from >= N Wikipedias."""
import json
import sys
from wd import sparql

PROPS = {
    # When
    "P571": "inception / founded",
    "P577": "publication date",
    "P1619": "date of official opening",
    "P580": "start time",
    "P585": "point in time",
    # How big
    "P2048": "height",
    "P2067": "mass",
    "P2043": "length",
    "P2046": "area",
    "P2044": "elevation above sea level",
    "P2050": "wingspan",
    # How far
    "P625": "coordinate location",
    # How many
    "P1113": "number of episodes",
    "P1101": "floors above ground",
    "P1083": "maximum capacity",
    "P1092": "total produced",
    "P1120": "number of deaths",
    "P1082": "population",
    "P1128": "employees",
    "P2124": "member count",
    "P1436": "collection size",
    "P1971": "number of children",
    "P2635": "number of parts of this work",
    "P1110": "attendance",
    "P1174": "visitors per year",
    # Wildcard
    "P2052": "speed",
    "P2101": "melting point",
    "P2102": "boiling point",
    "P2047": "duration",
    "P2142": "box office",
    "P2130": "cost",
    "P2120": "radius",
    "P2583": "distance from Earth",
}

MIN_SITELINKS = int(sys.argv[1]) if len(sys.argv) > 1 else 40
out = {}
for p, label in PROPS.items():
    print(f"{p} {label}", file=sys.stderr)
    rows = sparql(f"""
      SELECT (COUNT(DISTINCT ?item) AS ?n) WHERE {{
        ?item wdt:{p} ?v ; wikibase:sitelinks ?sl .
        FILTER(?sl >= {MIN_SITELINKS})
      }}""")
    n = int(rows[0]["n"]) if rows else None
    out[p] = {"label": label, "items": n}
    print(f"{p:7} {label:32} {n}")

json.dump({"min_sitelinks": MIN_SITELINKS, "coverage": out}, open(f"../../data/samples/coverage-{MIN_SITELINKS}.json", "w"), indent=1)
