"""Technical atlas packing/encoding of imagegen artwork; never invents poses.

Original AI PNGs are retained. Walk exit uses reversed entry poses. Truncated
source rows are excluded; each runtime clip contains only complete cutouts.
"""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'public/game-assets/2d/fighter/art-v3'
SOURCE = ROOT / 'art-source/fighter-v3'
SIZE = 256
PIVOT = [0.5, 230 / 256]


def extract(path, columns):
    image = Image.open(path).convert('RGBA')
    mask = np.array(image.getchannel('A')) > 128
    occupied = mask.sum(axis=1) > 10
    runs, start = [], None
    for y, active in enumerate(occupied):
        if active and start is None:
            start = y
        if not active and start is not None:
            if y - start > 30:
                runs.append((start, y))
            start = None
    # A run reaching the final pixel is clipped and cannot be used.
    frames, boxes = [], []
    for top, bottom in runs:
        for col in range(columns):
            left = round(col * image.width / columns)
            right = round((col + 1) * image.width / columns)
            ys, xs = np.nonzero(mask[top:bottom, left:right])
            assert len(xs) > 1500, (path, top, col, 'empty frame')
            box = (left + int(xs.min()), top + int(ys.min()), left + int(xs.max()) + 1, top + int(ys.max()) + 1)
            frames.append(image.crop(box))
            boxes.append(box)
    return frames, boxes


def strip(path, frames, target_height, fixed_scale=None):
    output = Image.new('RGBA', (SIZE * len(frames), SIZE))
    for i, frame in enumerate(frames):
        scale = fixed_scale or target_height / frame.height
        scale = min(scale, 220 / frame.width, 218 / frame.height)
        frame = frame.resize((round(frame.width * scale), round(frame.height * scale)), Image.Resampling.LANCZOS)
        output.paste(frame, (i * SIZE + 128 - frame.width // 2, 230 - frame.height))
    output.save(path, optimize=True)


def main():
    (ART / 'props').mkdir(exist_ok=True)
    for path in SOURCE.glob('*.png'):
        if path.stem.startswith(('walk-', 'ultimate-')):
            continue
        image = Image.open(path)
        if path.stem.startswith('wristbands'):
            image.save(ART / (path.stem + '.webp'), quality=88, method=6)
        else:
            image = image.crop(image.getchannel('A').getbbox())
            image.thumbnail((640, 640), Image.Resampling.LANCZOS)
            image.save(ART / 'props' / (path.stem + '.webp'), quality=92, method=6)

    fighters, sources = {}, {}
    for path in sorted(SOURCE.glob('walk-*.png')):
        fighter = path.stem.removeprefix('walk-')
        frames, boxes = extract(path, 4)
        assert len(frames) >= 12, (fighter, 'requires 12 complete AI poses')
        entry = frames[:4]
        cycle = frames[4:16] if len(frames) >= 16 else frames[:12]
        exit_frames = list(reversed(entry))
        old = ROOT / 'public/game-assets/2d/fighter/combat-illustrated-v1' / fighter
        metadata = json.loads((old / 'manifest.json').read_text(encoding='utf-8'))
        idle = Image.open(old / 'idle.png').crop((0, 0, 256, 256))
        bounds = idle.getchannel('A').getbbox()
        target_height = round((bounds[3] - bounds[1]) * metadata['clips']['idle'].get('worldSize', metadata['worldSize']) / 200)
        folder = ART / 'locomotion' / fighter
        folder.mkdir(parents=True, exist_ok=True)
        clips = {}
        for name, poses in [('walk_start', entry), ('walk', cycle), ('walk_stop', exit_frames)]:
            strip(folder / (name + '.png'), poses, target_height)
            clips[name] = {'file': name + '.png', 'frames': len(poses), 'durationTicks': 8 if len(poses) == 4 else 48, 'size': SIZE, 'pivot': PIVOT, 'worldSize': 200, 'facing': 1, 'locomotion': True}
        if fighter == 'szerszen':
            poses, _ = extract(SOURCE / 'ultimate-szerszen.png', 3)
            assert len(poses) == 6
            strip(folder / 'ultimate.png', poses, target_height, target_height / poses[0].height)
            clips['ultimate'] = {'file': 'ultimate.png', 'frames': 6, 'durationTicks': 105, 'size': SIZE, 'pivot': PIVOT, 'worldSize': 200, 'facing': 1, 'locomotion': True}
        fighters[fighter] = clips
        sources[fighter] = {'source': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'completePoses': len(frames), 'sourceBoxes': boxes, 'exit': 'reversed entry', 'cycle': 'rows 2-4' if len(frames) >= 16 else '12 complete poses'}
    assert len(fighters) == 16
    (ART / 'locomotion.json').write_text(json.dumps({'version': 3, 'fighters': fighters, 'sources': sources}, indent=2) + '\n', encoding='utf-8')
    print('Packed 16 fighters: 12 walk + 4 entry + 4 reversed exit frames each, plus 6 Szerszen ultimate poses.')


if __name__ == '__main__':
    main()
