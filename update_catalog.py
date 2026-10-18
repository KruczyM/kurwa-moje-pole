import json
from pathlib import Path

catalog_path = Path('E:/kodowanie/gra/.ai/worktrees/festival-2026-tent-upgrades/src/game/assets/assetCatalog.json')
npc_dir = Path('E:/kodowanie/gra/.ai/worktrees/festival-2026-tent-upgrades/public/game-assets/npc_models')

with open(catalog_path, 'r', encoding='utf-8') as f:
    catalog = json.load(f)

# Find all .glb files in npc_dir
npc_models = []
for file in sorted(npc_dir.glob('*.glb')):
    name = file.stem
    npc_models.append({
        'id': name,
        'name': ' '.join(word.capitalize() for word in name.split('_')[1:]) or name,
        'path': f'npc_models/{file.name}'
    })

catalog['festivalNpcs'] = npc_models

with open(catalog_path, 'w', encoding='utf-8') as f:
    json.dump(catalog, f, indent=2, ensure_ascii=False)

print(f"Added {len(npc_models)} festivalNpcs to assetCatalog.json")
