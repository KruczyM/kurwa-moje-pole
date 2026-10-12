"""Validate upgraded strips, manifest routing and reproducible source hashes."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT/'public/game-assets/2d/fighter'
FOLDER = ASSETS/'combat-powers-v2'
NAMES = ['uppercut', 'launch_hit', 'special', 'ultimate']


def main():
    audit = json.loads((FOLDER/'packing.json').read_text(encoding='utf-8'))
    assert (audit['characters'], audit['clips'], audit['frames']) == (16, 64, 384)
    ids = sorted(source['id'] for source in audit['sources'])
    assert len(set(ids)) == 16
    hashes = set()
    for source in audit['sources']:
        path = ROOT/'art/fighter/combat-powers-v2'/source['file']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == source['sha256']
        assert len(source['rectangles']) == 4
        assert all(len(row) == 6 for row in source['rectangles'])
    for fighter in ids:
        upgraded = json.loads((FOLDER/fighter/'manifest.json').read_text(encoding='utf-8'))
        active = json.loads((ASSETS/'combat-illustrated-v1'/fighter/'manifest.json').read_text(encoding='utf-8'))
        assert set(upgraded['clips']) == set(NAMES)
        for name in NAMES:
            clip = upgraded['clips'][name]
            assert active['clips'][name] == clip and clip['powers'] is True
            assert clip['frames'] == 6 and clip['facing'] == 1 and clip['size'] == 256
            path = FOLDER/fighter/clip['file']
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            assert digest not in hashes, (fighter, name, 'duplicate animation')
            hashes.add(digest)
    output = ROOT/'reports/fighter-combat-powers-v2'
    output.mkdir(parents=True, exist_ok=True)
    for sheet in range(2):
        preview = Image.new('RGB', (1080, 8*220+30), '#192331')
        draw = ImageDraw.Draw(preview)
        for col, name in enumerate(NAMES):
            draw.text((100+col*240, 8), name, fill='white')
        for row, fighter in enumerate(ids[sheet*8:sheet*8+8]):
            draw.text((5, row*220+120), fighter, fill='white')
            manifest = json.loads((FOLDER/fighter/'manifest.json').read_text(encoding='utf-8'))
            for col, name in enumerate(NAMES):
                clip = manifest['clips'][name]
                image = Image.open(FOLDER/fighter/clip['file'])
                frame = 3 if name == 'uppercut' else 2
                cell = image.crop((frame*256, 0, (frame+1)*256, 256))
                width = round(clip['worldSize'])
                cell = cell.resize((width, width), Image.Resampling.LANCZOS)
                x = 100+col*240+115-width//2
                y = 30+row*220+200-round(width*clip['pivot'][1])
                preview.paste(cell, (x,y), cell)
        preview.save(output/f'contact-{sheet+1}.jpg', quality=92)
    report = {'status':'PASS', 'characters':16, 'animations':64, 'frames':384,
              'visualGameplay':'VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN'}
    (output/'asset-report.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
