"""Package generated atlases for the existing renderer; preserve source images and alpha."""
from pathlib import Path
import argparse
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('terrain')
parser.add_argument('backgrounds')
parser.add_argument('items')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
target = root / 'public/game-assets/2d/bongo-rush/art-v2'
target.mkdir(parents=True, exist_ok=True)
terrain = Image.open(args.terrain).convert('RGBA')
backgrounds = Image.open(args.backgrounds).convert('RGB')
items = Image.open(args.items).convert('RGBA')
terrain.save(target / 'terrain-source.png')
backgrounds.save(target / 'backgrounds-source.png')
assert items.getextrema()[3][0] == 0, 'Collectible atlas must have actual transparency'
assert items.width == items.height
items = items.resize((1024, 1024), Image.Resampling.LANCZOS)
items.save(target / 'items.png')
for row, name in enumerate(['amarena', 'roots', 'rave', 'glass']):
    packed = Image.new('RGBA', (1024, 1024))
    for col in range(4):
        tile = terrain.crop((round(col * terrain.width / 4), round(row * terrain.height / 4),
                             round((col + 1) * terrain.width / 4), round((row + 1) * terrain.height / 4)))
        packed.paste(tile.resize((512, 512), Image.Resampling.NEAREST), ((col % 2) * 512, (col // 2) * 512))
    packed.save(target / f'{name}-terrain.png')
    x, y = row % 2, row // 2
    backgrounds.crop((round(x * backgrounds.width / 2), round(y * backgrounds.height / 2),
                      round((x + 1) * backgrounds.width / 2), round((y + 1) * backgrounds.height / 2))).save(target / f'{name}-background.png')
print('Packed four terrain atlases, four backgrounds and transparent item atlas.')
