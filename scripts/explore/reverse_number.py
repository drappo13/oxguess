"""Work backwards from a number: which well-known things have exactly N of something?

usage: python3 reverse_number.py 54 [min_sitelinks]
"""
import sys
from wd import sparql

n = sys.argv[1]
min_sl = int(sys.argv[2]) if len(sys.argv) > 2 else 40

rows = sparql(f"""
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
SELECT DISTINCT ?itemLabel ?propLabel ?unitLabel ?sl WHERE {{
  ?item ?p ?st ; wikibase:sitelinks ?sl .
  FILTER(?sl >= {min_sl})
  ?prop wikibase:claim ?p ; wikibase:statementValue ?psv ; wikibase:propertyType wikibase:Quantity .
  ?st ?psv ?v .
  ?v wikibase:quantityAmount ?amt ; wikibase:quantityUnit ?unit .
  FILTER(?amt = {n})
  MINUS {{ ?item wdt:P31 wd:Q5 }}
  ?prop rdfs:label ?propLabel . FILTER(LANG(?propLabel) = "en")
  OPTIONAL {{ ?unit rdfs:label ?unitLabel . FILTER(LANG(?unitLabel) = "en") }}
  ?item rdfs:label ?itemLabel . FILTER(LANG(?itemLabel) = "en")
}} ORDER BY DESC(?sl) LIMIT 60""")

print(f"Well-known things with a value of exactly {n}:")
for r in rows:
    unit = r.get("unitLabel", "")
    unit = "" if unit in ("1", "") else f" {unit}"
    print(f"  {r['itemLabel']}: {r['propLabel']} = {n}{unit}  ({r['sl']} wikis)")
