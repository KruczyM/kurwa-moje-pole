"""Inspect source extraction before exporting generated poses."""
import importlib.util
import json
from pathlib import Path

spec = importlib.util.spec_from_file_location('packer', Path(__file__).with_name('pack-illustrated-combat.py'))
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)
config = json.loads((p.ROOT/'docs/fighter-powers-generation.json').read_text(encoding='utf-8'))
selected = {entry['id']:entry for entry in config['entries']}
failures = []
for entry in selected.values():
    path = p.ROOT/'art/fighter/combat-powers-v2'/entry['file']
    try:
        p.extract(path)
        print(path.parent.name, path.name, 'PASS')
    except ValueError as error:
        print(error)
        failures.append(str(error))
if failures:
    raise SystemExit(1)
