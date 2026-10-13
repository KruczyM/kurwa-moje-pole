"""Pack reviewed source crops into 50 runtime cells; preserve originals and manifest provenance."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def pack(name):
    image = Image.open(ROOT / f'source-assets/bongo-rush/materials-v4/{name}-source.png').convert('RGBA')
    def crop(x, y, w=1, h=1):
        return image.crop((round(x * image.width / 8) + 2, round(y * image.height / 7) + 2,
                           round((x+w) * image.width / 8) - 2, round((y+h) * image.height / 7) - 2))
    tiles = [crop(x, 0) for x in range(8)] + [crop(x, 1) for x in range(6)]
    tiles += [crop(x, 2) for x in range(8)]
    for x, y in [(0, 3), (3, 3), (0, 4)]:
        strip = crop(x, y, 3).resize((384, 128), Image.Resampling.LANCZOS)
        tiles += [strip.crop((n*128, 0, (n+1)*128, 128)) for n in range(3)]
    if name == 'amarena':
        strip = crop(3, 4, 3).resize((384, 128), Image.Resampling.LANCZOS)
        tiles += [strip.crop((n*128, 0, (n+1)*128, 128)) for n in range(3)]
    else:
        old = Image.open(ROOT / f'public/game-assets/2d/bongo-rush/materials-v3/{name}.png')
        tiles += [old.crop(((n % 6)*128, (n//6)*128, (n%6+1)*128, (n//6+1)*128)) for n in range(15, 18)]
    for x in range(4, 8):
        strip = crop(x, 5, 1, 1) if name == 'amarena' else crop(x, 4, 1, 3)
        strip = strip.resize((128, 384), Image.Resampling.LANCZOS)
        tiles += [strip.crop((0, n*128, 128, (n+1)*128)) for n in range(3)]
    tiles += [crop(x, 6) for x in range(4)]
    sheet = Image.new('RGBA', (1024, 896))
    for n, tile in enumerate(tiles):
        sheet.paste(tile.resize((128, 128), Image.Resampling.LANCZOS), ((n%8)*128, (n//8)*128))
    output = ROOT / 'public/game-assets/2d/bongo-rush/materials-v4'
    output.mkdir(parents=True, exist_ok=True)
    sheet.save(output / f'{name}.png', optimize=True)
    manifest = dict(version=4, tileSize=128, columns=8, rows=7, wall=list(range(8)), soil=list(range(8,14)),
                    accents=list(range(14,22)), horizontal=[list(range(n,n+3)) for n in range(22,34,3)],
                    vertical=[list(range(n,n+3)) for n in range(34,46,3)], corners=list(range(46,50)),
                    source=f'source-assets/bongo-rush/materials-v4/{name}-source.png',
                    note='Reviewed crops; fourth horizontal strip uses v3 except amarena; amarena pillars resampled from row 5.')
    (output / f'{name}.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(name, len(tiles), sheet.size)


if __name__ == '__main__':
    for theme in ['amarena', 'roots', 'rave', 'glass']:
        pack(theme)
