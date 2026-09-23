"""Build non-destructive tent upgrades with Blender 5; no network or paid services.

blender --background --python scripts/blender/upgrade-tents.py -- --only big2 large
Original GLBs are inputs; outputs live in world/tents/upgraded/. Blender uses Z-up.
Native material data textures are deterministic mathematical weave patterns, not AI artwork.
"""
import argparse
import hashlib
import json
import math
import struct
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'public/game-assets/world/tents'
FILES = {
    'main': 'main.glb', 'small': 'small.glb', 'small2': 'small2.glb',
    'large': 'dużynamiot.glb', 'big2': 'big2.glb', 'white': 'biały.glb',
    'colorful': 'kolorwy.glb', 'blue': 'niebieski.glb', 'blueOrange': 'niebppom.glb',
}


def image_data(name, pixels):
    height, width, _ = pixels.shape
    image = bpy.data.images.new(name, width=width, height=height, alpha=True)
    image.colorspace_settings.name = 'Non-Color'
    image.pixels.foreach_set(np.asarray(pixels, dtype=np.float32).ravel())
    image.pack()
    return image


def weave_maps():
    """Periodic 256px ripstop tile: normal and scalar roughness, no painted lighting."""
    y, x = np.mgrid[0:256, 0:256]
    thread = np.sin(x * math.tau / 8) * np.cos(y * math.tau / 8)
    ripstop = np.cos(x * math.tau / 64) ** 24 + np.cos(y * math.tau / 64) ** 24
    height = thread * 0.018 + ripstop * 0.024
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * 0.5
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * 0.5
    normal = np.stack((-dx * 3, -dy * 3, np.ones_like(dx)), axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    rgba = np.ones((256, 256, 4))
    rgba[:, :, :3] = normal * 0.5 + 0.5
    normals = image_data('Tent_Ripstop_Normal', rgba)
    roughness = np.clip(0.82 + 0.025 * thread + 0.035 * ripstop, 0.76, 0.92)
    rgba[:, :, :3] = roughness[:, :, None]
    rough = image_data('Tent_Ripstop_Roughness', rgba)
    rgba[:, :, :3] = (0.038 + 0.004 * thread)[:, :, None]
    color = image_data('Tent_Groundsheet_Weave', rgba)
    return normals, rough, color


def texture_node(material, image, uv_name, repeat=1):
    nodes, links = material.node_tree.nodes, material.node_tree.links
    node = nodes.new('ShaderNodeTexImage')
    node.image = image
    node.extension = 'REPEAT'
    uv = nodes.new('ShaderNodeUVMap')
    uv.uv_map = uv_name
    if repeat != 1:
        mapping = nodes.new('ShaderNodeMapping')
        mapping.inputs['Scale'].default_value = (repeat, repeat, 1)
        links.new(uv.outputs['UV'], mapping.inputs['Vector'])
        links.new(mapping.outputs['Vector'], node.inputs['Vector'])
    else:
        links.new(uv.outputs['UV'], node.inputs['Vector'])
    return node


def cloth_detail_uv(obj, density):
    """Separate detail UVs leave original colour atlases untouched."""
    data = obj.data
    uv = data.uv_layers.get('TentDetail') or data.uv_layers.new(name='TentDetail')
    transform = obj.matrix_world
    normal_transform = transform.to_3x3().inverted().transposed()
    for poly in data.polygons:
        n = normal_transform @ poly.normal
        axis = max(range(3), key=lambda a: abs(n[a]))
        a, b = ((1, 2), (0, 2), (0, 1))[axis]
        for loop_index in poly.loop_indices:
            p = transform @ data.vertices[data.loops[loop_index].vertex_index].co
            uv.data[loop_index].uv = (p[a] * density, p[b] * density)


def improve_material(material, maps, uv_name='TentDetail', repeat=1):
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    # These are fabric assets; keep existing maps and their authored UVs when present.
    for link in list(shader.inputs['Metallic'].links):
        links.remove(link)
    shader.inputs['Metallic'].default_value = 0
    material.use_backface_culling = False
    if not shader.inputs['Roughness'].is_linked:
        node = texture_node(material, maps[1], uv_name, repeat)
        links.new(node.outputs['Color'], shader.inputs['Roughness'])
    if not shader.inputs['Normal'].is_linked:
        node = texture_node(material, maps[0], uv_name, repeat)
        normal = nodes.new('ShaderNodeNormalMap')
        normal.uv_map = uv_name
        normal.inputs['Strength'].default_value = 0.65
        links.new(node.outputs['Color'], normal.inputs['Color'])
        links.new(normal.outputs['Normal'], shader.inputs['Normal'])
    material['tentUpgrade'] = '2026-material-v1'


def material(name, color, roughness=0.85):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = 0
    mat.use_backface_culling = False
    return mat


def mesh_object(name, vertices, faces, mat):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(mat)
    return obj


def groundsheet(outline, z, wall, density, maps):
    """Closed thin bathtub floor with a low perimeter; no geometry in door height."""
    count = len(outline)
    vertices = [(x, y, z) for x, y in outline]
    vertices += [(x, y, z + wall) for x, y in outline]
    faces = [tuple(range(count))]
    faces += [(i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)]
    mat = material('Tent_Groundsheet_PBR', (0.038, 0.043, 0.042))
    improve_material(mat, maps)
    node = texture_node(mat, maps[2], 'TentDetail')
    shader = mat.node_tree.nodes.get('Principled BSDF')
    mat.node_tree.links.new(node.outputs['Color'], shader.inputs['Base Color'])
    obj = mesh_object('Tent_Groundsheet', vertices, faces, mat)
    cloth_detail_uv(obj, density)
    obj['tentPart'] = 'groundsheet'
    return obj


def mosquito_material():
    mat = material('Tent_Mosquito_Mesh', (0.035, 0.038, 0.04), 0.95)
    # Opaque textile with fine alpha-cutout pores (not alpha-blend sorting).
    y, x = np.mgrid[0:64, 0:64]
    rgba = np.ones((64, 64, 4))
    rgba[:, :, :3] = 0.17
    rgba[:, :, 3] = ((x % 8 < 3) | (y % 8 < 3)).astype(float)
    tex = image_data('Tent_Mosquito_Alpha', rgba)
    node = texture_node(mat, tex, 'TentDetail')
    shader = mat.node_tree.nodes.get('Principled BSDF')
    mat.node_tree.links.new(node.outputs['Color'], shader.inputs['Base Color'])
    mat.node_tree.links.new(node.outputs['Alpha'], shader.inputs['Alpha'])
    mat.surface_render_method = 'DITHERED'
    return mat


def interior_floor_outline(shell, z, wall):
    """Sample the actual inner wall so the floor cannot stick out at tapered ends."""
    inverse = shell.matrix_world.inverted()
    deps = bpy.context.evaluated_depsgraph_get()
    outline = []
    for index in range(96):
        angle = index * math.tau / 96
        direction = Vector((math.cos(angle), math.sin(angle), 0))
        distances = []
        for level in (z, z + wall):
            origin = Vector((0, 0, level))
            hit, point, _, _ = shell.ray_cast(inverse @ origin,
                (inverse.to_3x3() @ direction).normalized(), depsgraph=deps)
            if not hit:
                raise RuntimeError(f'Cannot fit floor at angle {angle}, height {level}')
            distances.append((shell.matrix_world @ point - origin).length)
        radius = min(distances) - 0.002
        outline.append((direction.x * radius, direction.y * radius))
    return outline


def add_details(model_id, maps):
    net = mosquito_material()
    if model_id == 'big2':
        outline = [(-0.62, -1.59), (0.62, -1.59), (0.77, -0.95),
                   (0.87, 0), (0.76, 1.10), (0.61, 1.60),
                   (-0.61, 1.60), (-0.76, 1.10), (-0.87, 0), (-0.77, -0.95)]
        groundsheet(outline, 0.029, 0.035, 5, maps)
        window = bpy.data.objects['pCube7_lambert1_0']
        window.data.materials.clear()
        window.data.materials.append(net)
        cloth_detail_uv(window, 80)
        window['tentPart'] = 'window-mesh'
    elif model_id == 'large':
        outline = interior_floor_outline(bpy.data.objects['tmpfbmc9u7k.ply'], -0.213, 0.022)
        groundsheet(outline, -0.213, 0.022, 18, maps)
        # Follow the sloping front, not a vertical rectangle protruding through the roof.
        shape = [(-0.171, -0.086), (0.171, -0.086), (0.162, 0.055),
                 (0.115, 0.108), (0.055, 0.132), (-0.055, 0.132),
                 (-0.115, 0.108), (-0.162, 0.055)]
        window = mesh_object('Tent_Front_Mosquito',
                             [(x, -0.367 + 0.53 * z, z) for x, z in shape],
                             [tuple(range(len(shape)))], net)
        cloth_detail_uv(window, 256)
        window['tentPart'] = 'window-mesh'
        add_side_window(maps)


def add_side_window(maps):
    """Cut a real opening, with a pane and stitched surround following the source shell."""
    shell = bpy.data.objects['tmpfbmc9u7k.ply']
    deps = bpy.context.evaluated_depsgraph_get()
    inverse = shell.matrix_world.inverted()

    def surface(y, z, offset=0):
        origin = inverse @ Vector((1, y, z))
        direction = (inverse.to_3x3() @ Vector((-1, 0, 0))).normalized()
        hit, location, _, _ = shell.ray_cast(origin, direction, depsgraph=deps)
        if not hit:
            raise RuntimeError(f'Side window does not hit shell: {y}, {z}')
        point = shell.matrix_world @ location
        return (point.x + offset, y, z)

    y1, y2, z1, z2 = -0.29, -0.07, -0.135, 0.068
    count = 12
    points = [surface(y1 + (y2-y1)*i/count, z1 + (z2-z1)*j/count, -0.004)
              for j in range(count+1) for i in range(count+1)]
    faces = [(j*(count+1)+i, j*(count+1)+i+1, (j+1)*(count+1)+i+1, (j+1)*(count+1)+i)
             for j in range(count) for i in range(count)]
    # Evaluate border positions before cutting away the wall.
    trim_points, trim_faces = [], []
    border = [(y1, z1), (y2, z1), (y2, z2), (y1, z2)]
    for edge in range(4):
        start, end = border[edge], border[(edge+1) % 4]
        for step in range(count):
            t0, t1 = step/count, (step+1)/count
            a = (start[0]+(end[0]-start[0])*t0, start[1]+(end[1]-start[1])*t0)
            b = (start[0]+(end[0]-start[0])*t1, start[1]+(end[1]-start[1])*t1)
            oy, oz = [(0,-0.009), (0.009,0), (0,0.009), (-0.009,0)][edge]
            base = len(trim_points)
            trim_points += [surface(*a, 0.002), surface(*b, 0.002),
                            surface(b[0]+oy, b[1]+oz, 0.002), surface(a[0]+oy, a[1]+oz, 0.002)]
            trim_faces.append((base, base+1, base+2, base+3))
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.32, (y1+y2)/2, (z1+z2)/2))
    cutter = bpy.context.object
    cutter.dimensions = (0.4, y2-y1, z2-z1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = shell.modifiers.new('Window opening', 'BOOLEAN')
    modifier.operation, modifier.solver, modifier.object = 'DIFFERENCE', 'EXACT', cutter
    bpy.context.view_layer.objects.active = shell
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    cloth_detail_uv(shell, 16)
    pane_mat = material('Tent_Side_Window_Film', (0.19, 0.22, 0.23), 0.72)
    shader = pane_mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Alpha'].default_value = 0.78
    pane_mat.surface_render_method = 'DITHERED'
    pane = mesh_object('Tent_Side_Window', points, faces, pane_mat)
    for poly in pane.data.polygons:
        poly.use_smooth = True
    cloth_detail_uv(pane, 16)
    pane['tentPart'] = 'window-film'
    trim_mat = material('Tent_Window_Binding', (0.68, 0.65, 0.57))
    improve_material(trim_mat, maps)
    trim = mesh_object('Tent_Window_Binding', trim_points, trim_faces, trim_mat)
    cloth_detail_uv(trim, 16)
    # Rolled exterior cover above the window, with the same canvas finish as the binding.
    curve = bpy.data.curves.new('Tent_Window_Rolled_Cover', 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = 0.008
    curve.bevel_resolution = 2
    spline = curve.splines.new('POLY')
    spline.points.add(count)
    # Surface points were captured before the boolean cut.
    for i, p in enumerate(spline.points):
        x, y, z = points[count*(count+1) + i]
        p.co = (x+0.012, y, z+0.014, 1)
    roll = bpy.data.objects.new('Tent_Window_Rolled_Cover', curve)
    bpy.context.collection.objects.link(roll)
    curve.materials.append(trim_mat)
    bpy.ops.object.select_all(action='DESELECT')
    roll.select_set(True)
    bpy.context.view_layer.objects.active = roll
    bpy.ops.object.convert(target='MESH')
    bpy.context.object.data.materials.clear()
    bpy.context.object.data.materials.append(trim_mat)
    cloth_detail_uv(bpy.context.object, 16)


def finalize_gltf(path):
    """Use alpha cutout for insect netting; Blender 5 otherwise exports it as BLEND."""
    source = path.read_bytes()
    size = struct.unpack_from('<I', source, 12)[0]
    document = json.loads(source[20:20+size])
    for mat in document['materials']:
        tint = mat.get('extras', {}).get('tentBaseColorLinear')
        if tint is not None:
            mat['pbrMetallicRoughness']['baseColorFactor'] = [*tint, 1]
        if mat.get('name') == 'Tent_Mosquito_Mesh':
            mat['alphaMode'] = 'MASK'
            mat['alphaCutoff'] = 0.5
    encoded = json.dumps(document, separators=(',', ':')).encode('utf-8')
    encoded += b' ' * (-len(encoded) % 4)
    rest = source[20+size:]
    path.write_bytes(struct.pack('<IIIII', 0x46546c67, 2, 20+len(encoded)+len(rest),
                                 len(encoded), 0x4e4f534a) + encoded + rest)


def run(model_id):
    source = SOURCE / FILES[model_id]
    target = SOURCE / 'upgraded' / f'{model_id}.glb'
    target.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    maps = weave_maps()
    materials = {m for o in meshes for m in o.data.materials if m}
    for obj in meshes:
        # Existing detailed materials keep their UVs. Main has >1M source vertices:
        # reuse UV0 with KHR_texture_transform instead of adding another 8 MB UV array.
        if model_id not in ('main', 'small', 'small2'):
            cloth_detail_uv(obj, 4 if model_id == 'big2' else 16)
    for mat in materials:
        if model_id == 'main':
            improve_material(mat, maps, meshes[0].data.uv_layers[0].name, 32)
        else:
            improve_material(mat, maps)
    if model_id in ('big2', 'large'):
        add_details(model_id, maps)
    for obj in bpy.context.scene.objects:
        if obj.parent is None:
            obj['tentUpgradeVersion'] = 1
    bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB',
                              export_extras=True, export_animations=False,
                              export_yup=True, export_image_format='AUTO')
    finalize_gltf(target)
    return {'id': model_id, 'source': source.name,
            'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
            'output': target.relative_to(ROOT).as_posix(), 'bytes': target.stat().st_size}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--only', nargs='+', choices=FILES, default=list(FILES))
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    report = [run(key) for key in args.only]
    destination = ROOT / 'reports/tent-audit'
    destination.mkdir(parents=True, exist_ok=True)
    (destination / 'build.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('TENT_UPGRADES', json.dumps(report))


if __name__ == '__main__':
    main()
