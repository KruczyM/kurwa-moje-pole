"""Derive a wall-only scenery variant from the preserved historical bundle."""

import copy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PREVIEW = ROOT / "historical-preview/kurwa-moje-pole"
SOURCE = PREVIEW / "assets/bongo-B7Wb6hvb.js"
TARGET = PREVIEW / "assets/bongo-no-decorative-chambers.js"
source = SOURCE.read_text(encoding="utf-8")
start = source.index('[{"id":1,"title"')
levels, length = json.JSONDecoder().raw_decode(source[start:])
assert len(levels) == 24
assert source[start - 12:start] == "JSON.parse('"
assert source[start + length:start + length + 2] == "')"
changed = copy.deepcopy(levels)
removed = {key: 0 for key in ("views", "props", "rays", "floorDetails")}
for level in changed:
    for space in [level, *level.get("chambers", [])]:
        scenery = space.get("scenery")
        if scenery:
            for key in removed:
                removed[key] += len(scenery.get(key, []))
                scenery[key] = []


def gameplay(value):
    value = copy.deepcopy(value)
    for level in value:
        for space in [level, *level.get("chambers", [])]:
            space.pop("scenery", None)
    return value


assert gameplay(levels) == gameplay(changed), "Gameplay definitions changed"
payload = json.dumps(changed, ensure_ascii=False, separators=(",", ":"))
expression = "JSON.parse(" + json.dumps(payload, ensure_ascii=True) + ")"
TARGET.write_text(source[:start - 12] + expression + source[start + length + 2:], encoding="utf-8", newline="")
html = PREVIEW / "bongo-rush.html"
original = PREVIEW / "bongo-original.html"
if not original.exists():
    original.write_bytes(html.read_bytes())
html.write_text(original.read_text(encoding="utf-8").replace("bongo-B7Wb6hvb.js", TARGET.name), encoding="utf-8", newline="")
report = {
    "change": "Decorative chambers replaced by the existing solid wall material",
    "removed": removed,
    "gameplayUnchanged": True,
    "playablePortalChambersPreserved": True,
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "outputSha256": hashlib.sha256(TARGET.read_bytes()).hexdigest(),
}
(ROOT / "docs/historical-preview/wall-only-change.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report))
