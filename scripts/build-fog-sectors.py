"""Split the authored GLB without reducing geometry or image quality. Generated assets only."""
import copy
import hashlib
import itertools
import json
import math
import struct
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public/game-assets/world/festival/authored-festival.glb'
OUT = SOURCE.with_name('fog-trial')


def build():
    raw = SOURCE.read_bytes()
    size = struct.unpack_from('<I', raw, 12)[0]
    src = json.loads(raw[20:20 + size])
    binary = raw[28 + size:]
    assert not src.get('skins') and not src.get('animations'), 'World rig/animation needs an explicit export rule'
    revision = hashlib.sha256(raw).hexdigest()
    OUT.mkdir(exist_ok=True)
    (OUT / 'sectors').mkdir(exist_ok=True)
    (OUT / 'textures').mkdir(exist_ok=True)
    image_paths = []
    for i, image in enumerate(src.get('images', [])):
        view = src['bufferViews'][image['bufferView']]
        offset = view.get('byteOffset', 0)
        blob = binary[offset:offset + view['byteLength']]
        suffix = {'image/png': 'png', 'image/jpeg': 'jpg'}[image['mimeType']]
        path = f'textures/image-{i}.{suffix}'
        (OUT / path).write_bytes(blob)
        image_paths.append(path)
    parents = {child: i for i, node in enumerate(src['nodes']) for child in node.get('children', [])}
    matrices = {}

    def matrix(i):
        if i in matrices:
            return matrices[i]
        node = src['nodes'][i]
        if 'matrix' in node:
            local = np.array(node['matrix']).reshape((4, 4), order='F')
        else:
            x, y, z, w = node.get('rotation', [0, 0, 0, 1])
            local = np.array([
                [1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w), 0],
                [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w), 0],
                [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y), 0],
                [0, 0, 0, 1],
            ], dtype=float)
            local[:3, :3] *= np.array(node.get('scale', [1, 1, 1]))
            local[:3, 3] = node.get('translation', [0, 0, 0])
        matrices[i] = matrix(parents[i]) @ local if i in parents else local
        return matrices[i]

    def mesh_bounds(mesh):
        accessors = [src['accessors'][p['attributes']['POSITION']] for p in src['meshes'][mesh]['primitives']]
        return [min(a['min'][j] for a in accessors) for j in range(3)], [max(a['max'][j] for a in accessors) for j in range(3)]

    def corners(bounds):
        return list(itertools.product(*zip(*bounds)))

    def resident(i):
        while True:
            node = src['nodes'][i]
            extras = node.get('extras', {})
            name = str(extras.get('runtimeNode', node.get('name', '')))
            if extras.get('runtimePlacement') == 'AllegroWheel' or extras.get('wheelPart'):
                return True
            if name.startswith('ToiToi_Door_') or name in ['Wing_Single_Telebim_Left', 'Wing_Single_Telebim_Right']:
                return True
            if i not in parents:
                return False
            i = parents[i]

    static = set()
    cells = {}
    for i, node in enumerate(src['nodes']):
        if 'mesh' not in node or resident(i):
            continue
        static.add(i)
        points = [(matrix(i) @ [*point, 1])[:3] for point in corners(mesh_bounds(node['mesh']))]
        bounds = [[float(min(p[j] for p in points)) for j in range(3)], [float(max(p[j] for p in points)) for j in range(3)]]
        center = [(bounds[0][j] + bounds[1][j]) / 2 for j in range(3)]
        key = f'{math.floor(center[0]/16)}_{math.floor(center[2]/16)}'
        cell = cells.setdefault(key, {'nodes': set(), 'bounds': [[math.inf]*3, [-math.inf]*3]})
        cell['nodes'].add(i)
        for j in range(3):
            cell['bounds'][0][j] = min(cell['bounds'][0][j], bounds[0][j])
            cell['bounds'][1][j] = max(cell['bounds'][1][j], bounds[1][j])

    def emit(path, selected, base=False):
        doc = {k: copy.deepcopy(v) for k, v in src.items() if k not in ['nodes', 'scenes', 'meshes', 'accessors', 'bufferViews', 'buffers', 'materials', 'textures', 'images', 'samplers']}
        for key in ['nodes', 'meshes', 'accessors', 'bufferViews', 'materials', 'textures', 'images', 'samplers']:
            doc[key] = []
        data = bytearray()
        caches = {key: {} for key in ['mesh', 'accessor', 'view', 'material', 'texture', 'image', 'sampler', 'proxy']}

        def append_view(blob, original=None):
            while len(data) % 4:
                data.append(0)
            view = copy.deepcopy(original or {})
            view.update(buffer=0, byteOffset=len(data), byteLength=len(blob))
            index = len(doc['bufferViews'])
            doc['bufferViews'].append(view)
            data.extend(blob)
            return index

        def remap(kind, i):
            if i in caches[kind]:
                return caches[kind][i]
            plural = {'mesh': 'meshes', 'accessor': 'accessors', 'view': 'bufferViews', 'material': 'materials', 'texture': 'textures', 'image': 'images', 'sampler': 'samplers'}[kind]
            value = copy.deepcopy(src[plural][i])
            if kind == 'view':
                start = value.get('byteOffset', 0)
                value.setdefault('extras', {})['fogSourceView'] = i
                result = append_view(binary[start:start+value['byteLength']], value)
                caches[kind][i] = result
                return result
            if kind == 'accessor':
                if 'bufferView' in value:
                    value['bufferView'] = remap('view', value['bufferView'])
                if 'sparse' in value:
                    for part in ['indices', 'values']:
                        value['sparse'][part]['bufferView'] = remap('view', value['sparse'][part]['bufferView'])
            if kind == 'mesh':
                for primitive in value['primitives']:
                    assert not primitive.get('extensions'), 'Compressed primitive needs a dedicated rule'
                    primitive['attributes'] = {k: remap('accessor', v) for k, v in primitive['attributes'].items()}
                    if 'indices' in primitive:
                        primitive['indices'] = remap('accessor', primitive['indices'])
                    if 'material' in primitive:
                        primitive['material'] = remap('material', primitive['material'])
                    for target in primitive.get('targets', []):
                        for k, v in target.items():
                            target[k] = remap('accessor', v)
            if kind == 'material':
                def textures(obj, parent=''):
                    if isinstance(obj, dict):
                        for k, v in obj.items():
                            if k == 'index' and 'texture' in parent.lower():
                                obj[k] = remap('texture', v)
                            elif k != 'extras':
                                textures(v, k)
                    elif isinstance(obj, list):
                        for item in obj:
                            textures(item, parent)
                textures(value)
                value.setdefault('extras', {})['fogMaterialKey'] = f'{revision}:{i}'
            if kind == 'texture':
                if 'source' in value:
                    value['source'] = remap('image', value['source'])
                if 'sampler' in value:
                    value['sampler'] = remap('sampler', value['sampler'])
            if kind == 'image':
                value.pop('bufferView', None)
                value['uri'] = ('../' if not base else '') + image_paths[i]
                value.setdefault('extras', {})['fogImageKey'] = f'{revision}:{i}'
            result = len(doc[plural])
            doc[plural].append(value)
            caches[kind][i] = result
            return result

        def proxy(i):
            if i in caches['proxy']:
                return caches['proxy'][i]
            bounds = mesh_bounds(i)
            vertices = [coordinate for point in corners(bounds) for coordinate in point]
            view = append_view(struct.pack('<24f', *vertices))
            accessor = len(doc['accessors'])
            doc['accessors'].append({'bufferView': view, 'componentType': 5126, 'count': 8, 'type': 'VEC3', 'min': bounds[0], 'max': bounds[1]})
            # Bounds-only geometry: never rendered, never uploaded. Preserve exact local AABB.
            result = len(doc['meshes'])
            indices = [0,1,3,0,3,2,4,6,7,4,7,5,0,4,5,0,5,1,2,3,7,2,7,6,0,2,6,0,6,4,1,5,7,1,7,3]
            index_accessor = len(doc['accessors'])
            doc['accessors'].append({'bufferView': append_view(struct.pack('<36H', *indices)), 'componentType': 5123, 'count': 36, 'type': 'SCALAR'})
            doc['meshes'].append({'name': src['meshes'][i].get('name', ''), 'primitives': [{'attributes': {'POSITION': accessor}, 'indices': index_accessor}]})
            caches['proxy'][i] = result
            return result

        included = set(range(len(src['nodes']))) if base else set(selected)
        for i in list(included):
            while i in parents:
                i = parents[i]
                included.add(i)
        order = sorted(included)
        node_map = {i: j for j, i in enumerate(order)}
        for i in order:
            value = copy.deepcopy(src['nodes'][i])
            value.setdefault('extras', {})['fogSourceNode'] = i
            if 'children' in value:
                value['children'] = [node_map[j] for j in value['children'] if j in included]
            if 'mesh' in value:
                if base and i in static:
                    value['mesh'] = proxy(value['mesh'])
                    value.setdefault('extras', {})['fogProxy'] = True
                elif base or i in selected:
                    value['mesh'] = remap('mesh', value['mesh'])
                else:
                    value.pop('mesh')
            doc['nodes'].append(value)
        doc['scenes'] = []
        for scene in src['scenes']:
            value = copy.deepcopy(scene)
            if base:
                value.setdefault('extras', {})['fogStreamScaffold'] = True
            value['nodes'] = [node_map[i] for i in scene.get('nodes', []) if i in included]
            doc['scenes'].append(value)
        doc['buffers'] = [{'byteLength': len(data)}]
        encoded = json.dumps(doc, separators=(',', ':')).encode()
        encoded += b' ' * (-len(encoded) % 4)
        data.extend(b'\0' * (-len(data) % 4))
        glb = struct.pack('<III', 0x46546C67, 2, 28+len(encoded)+len(data)) + struct.pack('<II', len(encoded), 0x4E4F534A) + encoded + struct.pack('<II', len(data), 0x004E4942) + data
        (OUT / path).write_bytes(glb)
        return len(glb)

    base_size = emit('base.glb', set(), True)
    manifest = {'schema': 1, 'sourceSha256': revision, 'cellSize': 16, 'sectors': []}
    for key, cell in sorted(cells.items()):
        path = f'sectors/{key}.glb'
        size = emit(path, cell['nodes'])
        manifest['sectors'].append({'id': key, 'path': path, 'bounds': cell['bounds'], 'bytes': size})
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps({'baseBytes': base_size, 'sectors': len(cells), 'staticNodes': len(static), 'sourceSha256': revision}))


if __name__ == '__main__':
    build()
