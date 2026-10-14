"""Pack locally rendered v5 atlases; validate every frame before writing runtime assets."""
import json
import hashlib
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def pack(folder):
    metadata = json.loads((folder / 'meta.json').read_text(encoding='utf-8'))
    size = metadata['frameWidth']
    count = metadata['framesPerDirection']
    if count != 10 or len(metadata['animationColumns']['walk']) != 8:
        raise ValueError(f'Incomplete idle/walk animation: {folder.name}')
    sheet = Image.new('RGBA', (size * count, size * 4))
    for row in range(4):
        walk_hashes = set()
        for column in range(count):
            with Image.open(folder / f'{row}-{column}.png') as frame:
                box = frame.getchannel('A').point(lambda a: 255 if a >= 32 else 0).getbbox()
                if not box or min(box[0], box[1], size-box[2], size-box[3]) < 2:
                    raise ValueError(f'Empty or clipped frame: {folder.name}/{row}-{column}')
                sheet.paste(frame, (column * size, row * size))
                if column in metadata['animationColumns']['walk']:
                    walk_hashes.add(hashlib.sha256(frame.tobytes()).digest())
        if len(walk_hashes) != 8:
            raise ValueError(f'Duplicated walk frames: {folder.name}/{row}')
    out = ROOT / 'public/game-assets/2d/bongo-rush/characters-v5' / folder.name
    out.mkdir(parents=True, exist_ok=True)
    sheet.save(out / 'spritesheet.png', optimize=True)
    (out / 'meta.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
    print(f'VALIDATED {folder.name}: 4 directions, 2 idle + 8 walk, no clipped frames')


if __name__ == '__main__':
    for directory in sorted((ROOT / 'reports/bongo-readable').iterdir()):
        if (directory / 'meta.json').exists():
            pack(directory)
