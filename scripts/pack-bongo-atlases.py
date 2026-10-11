"""Pack newly rendered frames with alpha-boundary validation; never rewrite After atlases."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def pack(directory):
    """Reject clipped/empty frames before publishing a character-specific Bongo atlas."""
    metadata = json.loads((directory / 'meta.json').read_text(encoding='utf-8'))
    size = metadata['frameWidth']
    columns = metadata['framesPerDirection']
    sheet = Image.new('RGBA', (size * columns, size * 4))
    for row in range(4):
        for column in range(columns):
            with Image.open(directory / f'{row}-{column}.png') as frame:
                alpha = frame.getchannel('A')
                box = alpha.point(lambda a: 255 if a >= 32 else 0).getbbox()
                if not box or min(box[0], box[1], size - box[2], size - box[3]) < 2:
                    raise RuntimeError(f'Empty/clipped frame: {directory.name}/{row}-{column}')
                sheet.paste(frame, (column * size, row * size))
    output = ROOT / 'public/game-assets/2d/bongo-rush/characters' / directory.name
    output.mkdir(parents=True, exist_ok=True)
    sheet.save(output / 'spritesheet.png')
    (output / 'meta.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
    print(f'BONGO_ATLAS_VALIDATED {directory.name}', flush=True)


if __name__ == '__main__':
    for folder in sorted((ROOT / 'reports/bongo-atlases').iterdir()):
        if (folder / 'meta.json').exists():
            pack(folder)
