import json
from pathlib import Path

catalog_path = Path('E:/kodowanie/gra/.ai/worktrees/festival-2026-tent-upgrades/src/game/assets/assetCatalog.json')

with open(catalog_path, 'r', encoding='utf-8') as f:
    catalog = json.load(f)

# The new heroes based on image names
new_heroes = [
    {"id": "ambona", "name": "Ambona"},
    {"id": "chlebak", "name": "Chlebak"},
    {"id": "dziaslo", "name": "Dziąsło"},
    {"id": "hemoroid", "name": "Hemoroid"},
    {"id": "jeczmien", "name": "Jęczmień"},
    {"id": "kobra", "name": "Kobra"},
    {"id": "korba", "name": "Korba"},
    {"id": "szerszen", "name": "Szerszeń"}
]

# Add only if not already present
for hero in new_heroes:
    if not any(h['id'] == hero['id'] for h in catalog['characters']):
        catalog['characters'].append(hero)

with open(catalog_path, 'w', encoding='utf-8') as f:
    json.dump(catalog, f, indent=2, ensure_ascii=False)

print("Updated assetCatalog.json with new heroes.")
