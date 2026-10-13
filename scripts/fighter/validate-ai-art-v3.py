"""Validate shipped AI cutouts, transparent atlas margins, anchors and provenance."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'public/game-assets/2d/fighter/art-v3'
SOURCE = ROOT / 'art-source/fighter-v3'


def main():
    data = json.loads((ART / 'locomotion.json').read_text(encoding='utf-8'))
    ids = set(data['fighters'])
    assert len(ids) == 16 and data['version'] == 3
    frames, byte_count = 0, 0
    for fighter, clips in data['fighters'].items():
        assert clips['walk']['frames'] == 12
        assert clips['walk_start']['frames'] == clips['walk_stop']['frames'] == 4
        for name, clip in clips.items():
            path = ART / 'locomotion' / fighter / clip['file']
            byte_count += path.stat().st_size
            image = Image.open(path)
            assert image.mode == 'RGBA' and image.size == (256 * clip['frames'], 256), (fighter, name)
            assert clip['pivot'] == [0.5, 230 / 256] and clip['worldSize'] == 200
            hashes = set()
            for index in range(clip['frames']):
                cell = image.crop((index * 256, 0, (index + 1) * 256, 256))
                bbox = cell.getchannel('A').getbbox()
                assert bbox and min(bbox[:2]) > 1 and max(bbox[2:]) < 255, (fighter, name, index, bbox)
                assert abs(bbox[3] - 230) <= 1, (fighter, name, 'foot anchor')
                hashes.add(hashlib.sha256(cell.tobytes()).hexdigest())
                frames += 1
            assert len(hashes) >= min(4, clip['frames']), (fighter, name, 'static animation')
        original = SOURCE / data['sources'][fighter]['source']
        assert hashlib.sha256(original.read_bytes()).hexdigest() == data['sources'][fighter]['sha256']
        assert data['sources'][fighter]['completePoses'] >= 12
    assert frames == 326
    for name in ids | {'paper', 'soundwave'}:
        path = ART / 'props' / (name + '.webp')
        byte_count += path.stat().st_size
        image = Image.open(path)
        assert image.mode == 'RGBA' and max(image.size) <= 640
        low, high = image.getchannel('A').getextrema()
        assert low == 0 and high > 240, (name, 'missing transparency')
    for name in ['wristbands-wide', 'wristbands-portrait']:
        image = Image.open(ART / (name + '.webp'))
        assert min(image.size) >= 900
    assert len(list(SOURCE.glob('*.png'))) == 37
    assert len(json.loads((SOURCE / 'prompts.json').read_text(encoding='utf-8-sig'))['records']) == 37
    report = {'status': 'PASS', 'characters': 16, 'frames': frames, 'props': 18, 'backgrounds': 2, 'sourceImages': 37, 'runtimeMiB': round(byte_count / 2**20, 2), 'visualGameplay': 'VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN'}
    (ROOT / 'reports').mkdir(exist_ok=True)
    (ROOT / 'reports/fighter-ai-art-v3-validation.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
