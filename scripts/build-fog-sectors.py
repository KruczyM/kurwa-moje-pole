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
AREAS = json.loads((ROOT / 'src/game/world/mobileFestivalAreas.json').read_text(encoding='utf-8'))


def area_at(x, z):
    for area in AREAS['areas']:
        if any(a <= x < b and c <= z < d for a, b, c, d in area['regions']):
            return area['id']
    return AREAS['fallback']


def build():
    previous_paths = set()
    for name in ['manifest.json', 'mobile-manifest.json']:
        manifest_path = OUT / name
        if manifest_path.exists():
            previous_paths.update(s['path'] for s in json.loads(manifest_path.read_text(encoding='utf-8'))['sectors'])
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

    # All meshes of a placement stay together, including roofs, barriers and tower parts.
    owners = {}
    world_bounds = {}
    placement_bounds = {}
    for i, node in enumerate(src['nodes']):
        owner = i
        while not src['nodes'][owner].get('extras', {}).get('runtimePlacement') and owner in parents:
            owner = parents[owner]
        owners[i] = owner
        if 'mesh' not in node:
            continue
        points = [(matrix(i) @ [*point, 1])[:3] for point in corners(mesh_bounds(node['mesh']))]
        bounds = [[float(min(p[j] for p in points)) for j in range(3)], [float(max(p[j] for p in points)) for j in range(3)]]
        world_bounds[i] = bounds
        union = placement_bounds.setdefault(owner, [[math.inf]*3, [-math.inf]*3])
        for j in range(3):
            union[0][j] = min(union[0][j], bounds[0][j])
            union[1][j] = max(union[1][j], bounds[1][j])

    def placement_area(i):
        owner = owners[i]
        extras = src['nodes'][owner].get('extras', {})
        name = extras.get('runtimePlacement', '')
        if name == 'Lidl':
            return 'lidl'
        if name == 'AllegroWheel':
            return 'wheel'
        if name == 'smallStage':
            return 'south-passage'
        if name == 'Road_0':
            return 'north-passage'
        if name == 'Road_1':
            return 'south-passage'
        bounds = placement_bounds[owner]
        x, z = (bounds[0][0] + bounds[1][0]) / 2, (bounds[0][2] + bounds[1][2]) / 2
        if name.startswith('StageBarrier_') or 'tower' in name.lower() or (extras.get('runtimeCategory') == 'Stages' and z < 64):
            return 'main-stage'
        return area_at(x, z)

    static = set()
    cells = {}
    mobile_cells = {area['id']: {'nodes': set(), 'bounds': [[math.inf]*3, [-math.inf]*3]} for area in AREAS['areas']}
    for i, node in enumerate(src['nodes']):
        if 'mesh' not in node or resident(i):
            continue
        static.add(i)
        bounds = world_bounds[i]
        center = [(bounds[0][j] + bounds[1][j]) / 2 for j in range(3)]
        key = f'{math.floor(center[0]/16)}_{math.floor(center[2]/16)}'
        cell = cells.setdefault(key, {'nodes': set(), 'bounds': [[math.inf]*3, [-math.inf]*3]})
        cell['nodes'].add(i)
        for j in range(3):
            cell['bounds'][0][j] = min(cell['bounds'][0][j], bounds[0][j])
            cell['bounds'][1][j] = max(cell['bounds'][1][j], bounds[1][j])
        mobile = mobile_cells[placement_area(i)]
        mobile['nodes'].add(i)
        for j in range(3):
            mobile['bounds'][0][j] = min(mobile['bounds'][0][j], bounds[0][j])
            mobile['bounds'][1][j] = max(mobile['bounds'][1][j], bounds[1][j])

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
    mobile_manifest = {'schema': 1, 'sourceSha256': revision, 'areas': AREAS['areas'], 'sectors': []}
    def chunks(nodes):
        selected, views, size = set(), set(), 0
        meshes = {}
        for i in sorted(nodes):
            meshes.setdefault(src['nodes'][i]['mesh'], set()).add(i)
        # Keep every instance of a source mesh together, so heavy tent geometry is not repeated.
        for mesh, instances in sorted(meshes.items()):
            used = set()
            for primitive in src['meshes'][mesh]['primitives']:
                accessors = list(primitive['attributes'].values())
                if 'indices' in primitive:
                    accessors.append(primitive['indices'])
                for index in accessors:
                    accessor = src['accessors'][index]
                    if 'bufferView' in accessor:
                        used.add(accessor['bufferView'])
            extra = sum(src['bufferViews'][view]['byteLength'] for view in used - views)
            if selected and size + extra > 8 * 1024 * 1024:
                yield selected
                selected, views, size = set(), set(), 0
                extra = sum(src['bufferViews'][view]['byteLength'] for view in used)
            selected.update(instances)
            views.update(used)
            size += extra
        if selected:
            yield selected

    for area in AREAS['areas']:
        key = area['id']
        cell = mobile_cells[key]
        assert cell['nodes'], f'Empty mobile area: {key}'
        for index, nodes in enumerate(chunks(cell['nodes'])):
            path = f'sectors/mobile-{key}-{index}.glb'
            size = emit(path, nodes)
            mobile_manifest['sectors'].append({'id': f'{key}-{index}', 'area': key, 'path': path, 'bounds': cell['bounds'], 'bytes': size})
    (OUT / 'mobile-manifest.json').write_text(json.dumps(mobile_manifest, indent=2), encoding='utf-8')
    current_paths = {s['path'] for s in manifest['sectors'] + mobile_manifest['sectors']}
    for path in previous_paths - current_paths:
        target = (OUT / path).resolve()
        assert target.parent == (OUT / 'sectors').resolve(), 'Unexpected generated path'
        target.unlink(missing_ok=True)
    for target in (OUT / 'textures').iterdir():
        if target.stem.startswith('image-') and target.stem[6:].isdigit() and target.suffix in ['.png', '.jpg'] and f'textures/{target.name}' not in image_paths:
            target.unlink()
    print(json.dumps({'baseBytes': base_size, 'sectors': len(cells), 'staticNodes': len(static), 'sourceSha256': revision}))


if __name__ == '__main__':
    build()
