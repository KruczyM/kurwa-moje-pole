"""Read GLB UV/base-color samples without changing geometry or the image."""
import bpy
import json
import struct
import sys
import tempfile
from pathlib import Path

src, output = map(Path, sys.argv[sys.argv.index('--') + 1:])
raw = src.read_bytes()
length = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20+length])
binary = raw[28+length:]

def accessor(index):
    a = doc['accessors'][index]
    v = doc['bufferViews'][a['bufferView']]
    width = {'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'SCALAR': 1}[a['type']]
    code = {5126: 'f', 5123: 'H', 5125: 'I', 5121: 'B'}[a['componentType']]
    size = struct.calcsize('<'+code)*width
    start = v.get('byteOffset', 0)+a.get('byteOffset', 0)
    return [struct.unpack_from('<'+code*width, binary, start+i*v.get('byteStride', size)) for i in range(a['count'])]

results = []
with tempfile.TemporaryDirectory(prefix='zawor-colors-') as folder:
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            material = doc['materials'][primitive.get('material', 0)]
            texture = material['pbrMetallicRoughness']['baseColorTexture']['index']
            image = doc['images'][doc['textures'][texture]['source']]
            view = doc['bufferViews'][image['bufferView']]
            path = Path(folder)/'source-image.png'
            start = view.get('byteOffset', 0)
            path.write_bytes(binary[start:start+view['byteLength']])
            bitmap = bpy.data.images.load(str(path), check_existing=False)
            width, height = bitmap.size
            pixels = list(bitmap.pixels)
            colors = []
            for u, v in accessor(primitive['attributes']['TEXCOORD_0']):
                x = max(0,min(width-1,round(u*(width-1))))
                y = max(0,min(height-1,round((1-v)*(height-1))))
                offset = (y*width+x)*4
                colors.append([round(c*255) for c in pixels[offset:offset+3]])
            results.append(colors)
            bpy.data.images.remove(bitmap)
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(results))
print('sampled', sum(map(len,results)), 'vertices')
