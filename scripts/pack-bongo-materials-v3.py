"""Deterministically pack reviewed AI source regions; no generated art is repainted."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def pack(name):
    """Select quiet bases and preserve contiguous horizontal/vertical strip segments."""
    source = ROOT / f'source-assets/bongo-rush/materials-v3/{name}-source.png'
    image = Image.open(source).convert('RGBA')
    # Root/ice source boards have particularly quiet unused masonry cells.
    walls = [(4, 0), (5, 0), (4, 1), (5, 1)] if name in ['roots', 'glass'] else [(x, 0) for x in range(4)]
    regions = walls + [(x, 1) for x in range(4)] + [(x, 2) for x in range(4)]
    regions += [(x, 3) for x in range(6)]
    regions += [(x, y) for x in [6, 7] for y in range(3)]
    sheet = Image.new('RGBA', (768, 512))
    for index, (x, y) in enumerate(regions):
        box = (round(x * image.width / 8), round(y * image.height / 4),
               round((x + 1) * image.width / 8), round((y + 1) * image.height / 4))
        tile = image.crop(box).resize((128, 128), Image.Resampling.LANCZOS)
        sheet.paste(tile, ((index % 6) * 128, (index // 6) * 128))
    output = ROOT / 'public/game-assets/2d/bongo-rush/materials-v3'
    output.mkdir(parents=True, exist_ok=True)
    sheet.save(output / f'{name}.png', optimize=True)
    manifest = {'version': 3, 'tileSize': 128, 'columns': 6, 'rows': 4,
                'wall': [0, 1, 2, 3], 'soil': [4, 5, 6, 7], 'accents': [8, 9, 10, 11],
                'horizontal': [[12, 13, 14], [15, 16, 17]],
                'vertical': [[18, 19, 20], [21, 22, 23]],
                'source': str(source.relative_to(ROOT)), 'sourceGrid': [8, 4], 'sourceCells': regions}
    (output / f'{name}.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(f'{name}: {sheet.size}, {len(regions)} reviewed regions', flush=True)


if __name__ == '__main__':
    for biome in ['amarena', 'roots', 'rave', 'glass']:
        pack(biome)
