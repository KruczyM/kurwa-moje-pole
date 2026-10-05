"""Export the edited world without modifying the source .blend or baking gameplay."""
import hashlib
import json
import re
import os
import sys
import struct
from pathlib import Path
import bpy
from mathutils import Matrix

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'blender/festival-layout.blend'
OUT = ROOT / 'public/game-assets/world/festival/authored-festival.glb'
PENDING = OUT.with_name('authored-festival.pending.glb')
source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
original_scene = bpy.context.scene
runtime = bpy.data.scenes.new('Festival_Runtime_Export')
bpy.context.window.scene = runtime
root = bpy.data.objects.new('AuthoredFestival', None)
runtime.collection.objects.link(root)
root['authoringSource'] = 'blender/festival-layout.blend'
root['schemaVersion'] = 1

def copy_instance(instance, parent):
    collection = instance.instance_collection
    copies = {o: o.copy() for o in collection.all_objects if o.type not in {'CAMERA', 'LIGHT'}}
    for source, obj in copies.items():
        runtime.collection.objects.link(obj)
        obj['runtimeNode'] = re.sub(r'\.\d{3}$', '', source.name)
        obj.parent = copies.get(source.parent, parent)
        obj.matrix_parent_inverse = source.matrix_parent_inverse.copy() if source.parent in copies else Matrix.Identity(4)
        obj.matrix_basis = source.matrix_basis.copy()
        if source.parent not in copies:
            obj.location -= collection.instance_offset
        if obj.animation_data:
            obj.animation_data_clear()
        if obj.instance_collection:
            copy_instance(obj, obj)
            obj.instance_type = 'NONE'
            obj.instance_collection = None

def copy_child(source, parent):
    obj = source.copy()
    runtime.collection.objects.link(obj)
    obj.parent = parent
    obj.matrix_parent_inverse = source.matrix_parent_inverse.copy()
    obj.matrix_basis = source.matrix_basis.copy()
    obj['runtimeNode'] = re.sub(r'\.\d{3}$', '', source.name)
    if source.instance_collection:
        copy_instance(source, obj)
        obj.instance_type = 'NONE'
        obj.instance_collection = None
    for child in source.children:
        copy_child(child, obj)
    return obj

count = 0
placement_counts = {}
for obj in original_scene.objects:
    if obj.get('placement_id'):
        key = obj['placement_id']
        placement_counts[key] = placement_counts.get(key, 0) + 1
for source in original_scene.objects:
    if any(c.name.startswith('Asset_') for c in source.users_collection):
        continue
    if source.type in {'CAMERA', 'LIGHT'} or any(c.name in {'Guides', 'Terrain', 'Lighting', 'Cameras'} for c in source.users_collection):
        continue
    if source.parent is not None:
        continue
    # Guide empties have no drawable children and are not gameplay objects.
    if source.type == 'EMPTY' and not source.children and not source.instance_collection:
        continue
    parent = source.copy()
    runtime.collection.objects.link(parent)
    parent.parent = root
    parent.matrix_parent_inverse = Matrix.Identity(4)
    parent.matrix_basis = source.matrix_world.copy()
    source_id = source.get('placement_id', source.name)
    parent['runtimePlacement'] = source.name if placement_counts.get(source_id, 0) > 1 else source_id
    parent['runtimeSourcePlacement'] = source_id
    parent['runtimeCategory'] = source.users_collection[0].name if source.users_collection else ''
    if source.get('camp_detail'):
        parent['campDetail'] = True
    if source.instance_collection:
        copy_instance(source, parent)
        parent.instance_type = 'NONE'
        parent.instance_collection = None
    for child in source.children:
        copy_child(child, parent)
    # Roads use world-space tiled UVs; glTF cannot preserve Blender Object-coordinate nodes.
    if parent.type == 'MESH' and parent['runtimeCategory'] in {'Roads', 'Sunflowers'}:
        parent.data = parent.data.copy()
        uv = parent.data.uv_layers.new(name='RuntimeUV')
        parent.data.uv_layers.active = uv
        tile = parent.get('runtimeTileMeters', 5)
        for loop in parent.data.loops:
            point = parent.matrix_world @ parent.data.vertices[loop.vertex_index].co
            uv.data[loop.index].uv = (point.x / tile, point.y / tile)
    count += 1
OUT.parent.mkdir(parents=True, exist_ok=True)
# Export only gameplay metadata. Cached addon/account metadata is not a web asset.
allowed = {'runtimeNode', 'runtimePlacement', 'runtimeSourcePlacement', 'runtimeCategory',
           'asset_path', 'placement_id', 'campDetail', 'wheelPart', 'wheelGondolaIndex',
           'replace_with_photo', 'flag_placeholder', 'campFlagDesign', 'campFlagCamp', 'campFlagPole', 'schemaVersion', 'authoringSource'}
for obj in runtime.objects:
    for key in list(obj.keys()):
        if key not in allowed:
            del obj[key]
for material in bpy.data.materials:
    for key in list(material.keys()):
        del material[key]
bpy.ops.export_scene.gltf(filepath=str(PENDING), export_format='GLB', export_extras=True,
                         export_animations=False, export_cameras=False, export_lights=False,
                         use_active_scene=True)
# Registered addon PropertyGroups can be emitted even after removing ID keys.
# Whitelist final glTF extras as well; geometry/buffer offsets are unchanged.
binary = PENDING.read_bytes()
json_length = struct.unpack_from('<I', binary, 12)[0]
document = json.loads(binary[20:20 + json_length].decode('utf-8'))
def sanitize(value):
    if isinstance(value, dict):
        if 'extras' in value:
            value['extras'] = {key: item for key, item in value['extras'].items() if key in allowed}
            if not value['extras']:
                del value['extras']
        for child in value.values():
            sanitize(child)
    elif isinstance(value, list):
        for child in value:
            sanitize(child)
sanitize(document)
# The glTF exporter omits the constant tint behind Blender MixRGB nodes.
# Preserve it explicitly for our two road surfaces instead of altering bitmaps.
for material in document.get('materials', []):
    if material.get('name') in {'Passage_Gray_Concrete', 'Camp_Worn_Grass'}:
        source_material = bpy.data.materials[material['name']]
        material.setdefault('pbrMetallicRoughness', {})['baseColorFactor'] = list(source_material.diffuse_color)
encoded = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
encoded += b' ' * (-len(encoded) % 4)
tail = binary[20 + json_length:]
packed = struct.pack('<III', 0x46546c67, 2, 20 + len(encoded) + len(tail))
packed += struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + tail
PENDING.write_bytes(packed)
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == source_hash, 'Source changed during export; export again'
os.replace(PENDING, OUT)
report = {'source': str(SOURCE), 'sourceSha256': source_hash,
          'placements': count, 'bytes': OUT.stat().st_size, 'sourceModified': False}
(ROOT / 'reports/festival-blender/runtime-export.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
# Blender 5.2 can crash during teardown of this large temporary instance graph.
# Export/report have completed synchronously; the source file was never saved.
sys.stdout.flush()
sys.stderr.flush()
os._exit(0)
