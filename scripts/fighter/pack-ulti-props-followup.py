"""Encode the four authored door poses and operator-facing DJ desk; no pose generation."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT/'art-source/fighter-motion-v4'
OUT = ROOT/'public/game-assets/2d/fighter/motion-v4/props'


def main():
    OUT.mkdir(exist_ok=True,parents=True)
    metadata = {}
    for stem in ['wc_tron_open','wc_tron_open_right']:
        source = SOURCE/f'prop-{stem}.png'
        image = Image.open(source).convert('RGBA')
        assert image.width % 4 == 0
        width = image.width//4
        scale = min(256/width,352/image.height)
        frame_width,frame_height = round(width*scale),round(image.height*scale)
        strip = Image.new('RGBA',(256*4,352))
        for frame in range(4):
            cell = image.crop((frame*width,0,(frame+1)*width,image.height))
            box = cell.getchannel('A').point(lambda a:255 if a>128 else 0).getbbox()
            assert box and box[0]>0 and box[2]<width, ('clipped cabin frame',frame,box)
            cell = cell.resize((frame_width,frame_height),Image.Resampling.LANCZOS)
            strip.alpha_composite(cell,(frame*256+(256-frame_width)//2,352-frame_height))
        strip.save(OUT/f'{stem}.webp',lossless=True,method=6)
        metadata[stem] = {'columns':4,'frameWidth':256,'frameHeight':352,'sha256':hashlib.sha256(source.read_bytes()).hexdigest()}
    source_dj = SOURCE/'prop-dj_operator_side.png'
    dj = Image.open(source_dj).convert('RGBA')
    dj = dj.crop(dj.getchannel('A').point(lambda a:255 if a>8 else 0).getbbox())
    dj.thumbnail((960,480),Image.Resampling.LANCZOS)
    dj.save(OUT/'dj_operator_side.webp',quality=94,method=6)
    metadata['dj_operator_side'] = {'columns':1,'sha256':hashlib.sha256(source_dj.read_bytes()).hexdigest()}
    (OUT/'followup.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8')
    print('Packed four cabin door frames and operator-facing DJ console.')


if __name__ == '__main__': main()
