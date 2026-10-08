"""Verify all non-image bytes and authored metadata are identical to the desktop GLB."""
import json
import struct
from pathlib import Path

def read(path):
    handle = path.open('rb')
    handle.read(12)
    size, kind = struct.unpack('<II', handle.read(8))
    assert kind == 0x4E4F534A
    doc = json.loads(handle.read(size))
    handle.read(8)
    return handle, handle.tell(), doc

root = Path(__file__).resolve().parents[1] / 'public/game-assets/world/festival'
a, offset_a, source = read(root / 'authored-festival.glb')
b, offset_b, mobile = read(root / 'authored-festival-mobile.glb')
for key in ['nodes', 'scenes', 'meshes', 'accessors', 'materials', 'textures', 'samplers', 'animations', 'skins']:
    assert source.get(key) == mobile.get(key), key
images = {image['bufferView'] for image in source['images']}
checked = 0
for index, view in enumerate(source['bufferViews']):
    if index in images:
        continue
    target = mobile['bufferViews'][index]
    assert view['byteLength'] == target['byteLength']
    a.seek(offset_a + view.get('byteOffset', 0))
    b.seek(offset_b + target.get('byteOffset', 0))
    assert a.read(view['byteLength']) == b.read(target['byteLength']), index
    checked += 1
a.close(); b.close()
print(f'Mobile world verified: {checked} unchanged non-image buffer views; all geometry, UV, collision and map metadata preserved.')
