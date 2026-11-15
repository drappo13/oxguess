"""Tiny Wikidata SPARQL helper for data exploration (stdlib only)."""
import json
import sys
import time
import urllib.parse
import urllib.request

ENDPOINT = "https://qlever.dev/api/wikidata"  # QLever mirror: much faster than WDQS for scans
UA = "oxguess-research/0.1 (data feasibility exploration)"

PREFIXES = """
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX ps: <http://www.wikidata.org/prop/statement/>
PREFIX psv: <http://www.wikidata.org/prop/statement/value/>
PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX schema: <http://schema.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX bd: <http://www.bigdata.com/rdf#>
"""


def sparql(query: str, retries: int = 2):
    data = urllib.parse.urlencode({"query": PREFIXES + query, "format": "json"}).encode()
    req = urllib.request.Request(ENDPOINT, data=data, headers={"User-Agent": UA, "Accept": "application/sparql-results+json"})
    for attempt in range(retries + 1):
        try:
            t = time.time()
            with urllib.request.urlopen(req, timeout=120) as r:
                rows = json.load(r)["results"]["bindings"]
            print(f"  [{len(rows)} rows, {time.time() - t:.1f}s]", file=sys.stderr)
            return [{k: v["value"] for k, v in row.items()} for row in rows]
        except Exception as e:  # noqa: BLE001
            print(f"  query failed ({e}), attempt {attempt + 1}", file=sys.stderr)
            time.sleep(5)
    return []


def qid(uri: str) -> str:
    return uri.rsplit("/", 1)[-1]
