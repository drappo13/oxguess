import json, sys, time, urllib.request
K = "AIzaSyBPXZMRXSoT5muwLfckEi-wMkAXQ2gJy64"
P = "projects/oxguess-a2a1b/databases/(default)/documents"
HID = sys.argv[1] if len(sys.argv) > 1 else f"2099-01-03_t{int(time.time()) % 100000}"
BASE = "https://firestore.googleapis.com/v1/"
def call(method, path, body=None):
    req = urllib.request.Request(BASE + path + "?key=" + K, method=method,
                                 data=json.dumps(body).encode() if body else None, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r: return True, json.load(r)
    except urllib.error.HTTPError as e: return False, json.load(e).get("error", {}).get("status")
def guess(n=1, b=42, by=1, k=None):
    # Same shape as the app's setDoc(merge) with increments: set k, increment n and one bin.
    return {"writes": [{"update": {"name": f"{P}/herd/{HID}", "fields": {"k": {"stringValue": str(k if k is not None else b)}}},
                        "updateMask": {"fieldPaths": ["k"]},
                        "updateTransforms": [{"fieldPath": "n", "increment": {"integerValue": str(n)}},
                                             {"fieldPath": f"b.`{b}`", "increment": {"integerValue": str(by)}}]}]}
res = []
def check(label, body, expect):
    ok, _ = call("POST", f"{P}:commit", body); res.append(ok == expect)
    print(f"{'PASS' if ok == expect else 'FAIL'}  {label}: {'allowed' if ok else 'blocked'}")
check("first guess (creates the herd)", guess(b=42), True)
check("second guess, same bin", guess(b=42), True)
check("third guess, new bin", guess(b=57), True)
check("cheat: add 5 at once", guess(n=5, b=42, by=5), False)
check("cheat: count 1, stuff a bin with 3", guess(b=42, by=3), False)
check("cheat: bin 150", guess(b=150), False)
check("cheat: claim bin 10, add to bin 42", guess(b=42, k=10), False)
ok, d = call("GET", f"{P}/herd/{HID}")
f = d["fields"]; print("      herd:", "n =", f["n"]["integerValue"], "bins =", {k: v["integerValue"] for k, v in f["b"]["mapValue"]["fields"].items()})
print("ALL PASS" if all(res) else "SOME FAILED")
