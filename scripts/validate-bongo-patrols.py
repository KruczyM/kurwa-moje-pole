"""Reject missing animation, clipped/dark output and identical enemy identities after Blender export."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[1]


def validate():
    records = []
    for name in ['patrol-red-v3', 'patrol-blue-v3', 'undercover-v3']:
        path = ROOT / f'public/game-assets/2d/bongo-rush/characters/{name}'
        metadata = json.loads((path/'meta.json').read_text(encoding='utf-8'))
        assert metadata['frameWidth'] == metadata['frameHeight'] == 128
        assert metadata['framesPerDirection'] == 10
        assert metadata['animationColumns'] == {'idle':[0,1],'walk':list(range(2,10))}
        assert metadata['rigStatus'] == 'animated'
        image = Image.open(path/'spritesheet.png').convert('RGBA')
        assert image.size == (1280,512)
        for row in range(4):
            frames = [image.crop((column*128,row*128,(column+1)*128,(row+1)*128)) for column in range(10)]
            for frame in frames:
                mask = frame.getchannel('A').point(lambda a:255 if a>=32 else 0)
                box = mask.getbbox()
                assert box and min(box[0],box[1],128-box[2],128-box[3]) >= 2, (name,row,'clipped')
                assert max(ImageStat.Stat(frame.convert('RGB'), mask).mean) > 35, (name,row,'black bake')
            assert len({hashlib.sha256(f.tobytes()).hexdigest() for f in frames[2:]}) >= 6
            # Side-view lower limbs must visibly change, not only tiny studio-noise changes.
            if row in [1,3]:
                lower = [f.crop((20,75,108,120)).convert('RGB') for f in frames[2:]]
                assert max(sum(ImageStat.Stat(ImageChops.difference(lower[0],f)).mean) for f in lower) > 2, (name,'static legs')
        records.append({'name':name,'sha256':hashlib.sha256(image.tobytes()).hexdigest(),'frames':40,'result':'PASS'})
    assert len({record['sha256'] for record in records}) == 3, 'Enemy variants are identical'
    print(json.dumps(records, indent=2))


if __name__ == '__main__':
    validate()
