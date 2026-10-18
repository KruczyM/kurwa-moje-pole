"""Change only authored road materials/UVs, preserving every placement."""
import json
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[2]
FILE = ROOT / 'blender/festival-layout.blend'
bpy.ops.wm.open_mainfile(filepath=str(FILE))
bpy.context.preferences.filepaths.save_version = 0
before = {o.name: tuple(v for row in o.matrix_basis for v in row) for o in bpy.context.scene.objects}

def surface(name, folder, prefix, tint, normal_strength):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.node_tree.nodes.clear()
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    output = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = .95
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    textures = {}
    for channel in ('Color', 'NormalGL', 'Roughness'):
        path = ROOT / 'public/game-assets/textures' / folder / f'{prefix}_{channel}.jpg'
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(str(path), check_existing=True)
        tex.image.colorspace_settings.name = 'sRGB' if channel == 'Color' else 'Non-Color'
        tex.extension = 'REPEAT'
        textures[channel] = tex
    multiply = nodes.new('ShaderNodeMixRGB')
    multiply.blend_type = 'MULTIPLY'
    multiply.inputs[0].default_value = 1
    multiply.inputs[2].default_value = (*tint, 1)
    links.new(textures['Color'].outputs['Color'], multiply.inputs[1])
    links.new(multiply.outputs['Color'], bsdf.inputs['Base Color'])
    links.new(textures['Roughness'].outputs['Color'], bsdf.inputs['Roughness'])
    normal = nodes.new('ShaderNodeNormalMap')
    normal.inputs['Strength'].default_value = normal_strength
    links.new(textures['NormalGL'].outputs['Color'], normal.inputs['Color'])
    links.new(normal.outputs['Normal'], bsdf.inputs['Normal'])
    mat.diffuse_color = (*tint, 1)
    return mat

concrete = surface('Passage_Gray_Concrete', 'concrete', 'Concrete019_1K-JPG', (.78, .78, .78), .35)
worn = surface('Camp_Worn_Grass', 'ground', 'Grass004_1K-JPG', (.82, .76, .60), .15)
changed = []
for obj in bpy.data.collections['Roads'].objects:
    if obj.type != 'MESH':
        continue
    if obj.name.startswith('Camp_path_'):
        mat, tile = worn, 2.0
    elif obj.name.startswith('Road_'):
        mat, tile = concrete, 3.0
    else:
        continue
    changed.append({'object': obj.name, 'previousMaterials': [m.name for m in obj.data.materials], 'newMaterial': mat.name})
    obj.data = obj.data.copy()
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    obj['runtimeTileMeters'] = tile
    uv = obj.data.uv_layers.get('RuntimeUV') or obj.data.uv_layers.new(name='RuntimeUV')
    obj.data.uv_layers.active = uv
    for loop in obj.data.loops:
        point = obj.matrix_world @ obj.data.vertices[loop.vertex_index].co
        uv.data[loop.index].uv = (point.x / tile, point.y / tile)
for name, matrix in before.items():
    assert tuple(v for row in bpy.context.scene.objects[name].matrix_basis for v in row) == matrix, name
assert any(r['newMaterial'] == concrete.name for r in changed)
assert any(r['newMaterial'] == worn.name for r in changed)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(FILE))
(ROOT / 'reports/festival-blender/road-surfaces.json').write_text(json.dumps({'objects': changed, 'placementsPreserved': len(before)}, indent=2), encoding='utf-8')
print(json.dumps({'updatedSurfaces': len(changed), 'placementsPreserved': len(before)}))
