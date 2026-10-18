"""Pack authored, transparent poses. Only crop/encode: never invent or warp a pose.

One scale per character across walking, falling, getting up and ultimate. Original
ImageGen sheets and their hashes are preserved alongside the authoring manifest.
"""
import hashlib
import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art-source/fighter-motion-v4'
OUTPUT = ROOT / 'public/game-assets/2d/fighter/motion-v4'
SIZE, BASELINE = 256, 230
spec = importlib.util.spec_from_file_location('existing_packer', Path(__file__).with_name('pack-illustrated-combat.py'))
packer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packer)


def extract(path, rows):
    image = Image.open(path).convert('RGBA')
    alpha = np.array(image.getchannel('A'))
    assert np.mean(alpha < 8) > .3, (path, 'background must be transparent')
    groups = packer.components(alpha > 128)
    groups.sort(key=lambda g: sum(r-l for y,l,r in g), reverse=True)
    major = groups[:rows*4]
    assert len(major) == rows*4 and min(sum(r-l for y,l,r in g) for g in major) > 900, (path, 'incomplete poses')
    detached = groups[rows*4:]
    major.sort(key=lambda g: (min(y for y,l,r in g)+max(y for y,l,r in g))/2)
    result, audit = [], []
    for row in range(rows):
        poses = sorted(major[row*4:row*4+4], key=lambda g: min(l for y,l,r in g))
        for col, group in enumerate(poses):
            left, right = min(l for y,l,r in group), max(r for y,l,r in group)
            top, bottom = min(y for y,l,r in group), max(y for y,l,r in group)+1
            assert left > 0 and top > 0 and right < image.width and bottom < image.height, (path.name, row, col, 'clipped source pose')
            for small in detached:
                sl, sr = min(l for y,l,r in small), max(r for y,l,r in small)
                st, sb = min(y for y,l,r in small), max(y for y,l,r in small)+1
                if sl >= left-8 and sr <= right+8 and st >= top-8 and sb <= bottom+8:
                    group = group + small
            # Keep antialiased edges near the component, exclude unrelated cells.
            box = (max(0,left-4), max(0,top-4), min(image.width,right+4), min(image.height,bottom+4))
            crop = image.crop(box)
            mask = np.zeros((box[3]-box[1], box[2]-box[0]), dtype=np.uint8)
            for yy,ll,rr in group:
                if box[1] <= yy < box[3]: mask[yy-box[1], max(0,ll-box[0]):min(box[2]-box[0],rr-box[0])] = 255
            crop.putalpha(ImageChops.multiply(crop.getchannel('A'), Image.fromarray(mask).filter(ImageFilter.MaxFilter(7))))
            crop.info['anchor'] = (col+.5)*image.width/4-box[0]
            result.append(crop)
            audit.append([int(left),int(top),int(right),int(bottom)])
    return result, audit


def pack(frames, scale):
    strip = Image.new('RGBA', (SIZE*len(frames), SIZE))
    for i, image in enumerate(frames):
        resized = image.resize((round(image.width*scale), round(image.height*scale)), Image.Resampling.LANCZOS)
        strip.alpha_composite(resized, (round(i*SIZE+SIZE/2-image.info['anchor']*scale), BASELINE-resized.height))
        cell = strip.crop((i*SIZE,0,(i+1)*SIZE,SIZE))
        bounds = cell.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox()
        assert bounds and min(bounds[:2]) > 3 and max(bounds[2:]) < SIZE-3, ('clipped output',i,bounds)
    return strip


def main():
    config = json.loads((SOURCE/'sources.json').read_text(encoding='utf-8'))
    manifest = {'version':4,'fighters':{},'sources':{}}
    for fighter, entry in sorted(config['fighters'].items()):
        path = SOURCE/entry['file']
        frames, boxes = extract(path,entry['rows'])
        idle_path = ROOT/'public/game-assets/2d/fighter/combat-illustrated-v1'/fighter/'idle.png'
        old = json.loads((idle_path.parent/'manifest.json').read_text(encoding='utf-8'))
        idle = Image.open(idle_path).crop((0,0,256,256))
        old_height = idle.getchannel('A').getbbox()[3]-idle.getchannel('A').getbbox()[1]
        runtime_height = old_height * old['clips']['idle'].get('worldSize',old['worldSize']) / 256
        reference_height = boxes[0][3]-boxes[0][1]
        scale = min(190/reference_height, *[min(112/max(im.info['anchor'],im.width-im.info['anchor']),216/im.height) for im in frames])
        world_size = runtime_height * 256 / (reference_height*scale)
        folder = OUTPUT/fighter
        folder.mkdir(parents=True,exist_ok=True)
        clips = {'walk':frames[:8], 'walk_start':frames[:2], 'walk_stop':[frames[7],frames[0]],
                 'fall':frames[8:12], 'get_up':frames[12:16]}
        if entry['rows'] == 6: clips['ultimate'] = frames[16:24]
        metadata = {}
        for name, cells in clips.items():
            pack(cells,scale).save(folder/(name+'.png'),optimize=True)
            metadata[name] = {'file':name+'.png','frames':len(cells),'durationTicks':48,
                              'size':SIZE,'pivot':[.5,BASELINE/SIZE],'worldSize':world_size,
                              'facing':1,'motion':True,'locomotion':name.startswith('walk')}
        manifest['fighters'][fighter] = metadata
        manifest['sources'][fighter] = {'file':entry['file'],'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                                       'boxes':boxes,'scale':scale,'worldSize':world_size}
        print(f'Packed {fighter}: {len(frames)} poses',flush=True)
    props = OUTPUT/'props'
    props.mkdir(exist_ok=True)
    for name, filename in config['props'].items():
        image = Image.open(SOURCE/filename).convert('RGBA')
        image = image.crop(image.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox())
        image.thumbnail((640,640),Image.Resampling.LANCZOS)
        image.save(props/(name+'.webp'),quality=94,method=6)
    (OUTPUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')


if __name__ == '__main__': main()
