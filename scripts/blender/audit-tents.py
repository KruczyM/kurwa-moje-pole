"""Offline tent measurements and reference renders. Run with Blender --background."""
import argparse
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector, Quaternion


def aim(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def render_model(path, target, views, size=640, lod=0, wheel_angle=0, night=False, market_variant=None, zone=None):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    if zone:
        for obj in [o for o in bpy.context.scene.objects if 'festivalZone' in o]:
            if obj['festivalZone']==zone: obj.location.x=0
            else:
                for child in list(obj.children_recursive): bpy.data.objects.remove(child,do_unlink=True)
                bpy.data.objects.remove(obj,do_unlink=True)
    if market_variant:
        for obj in [o for o in bpy.context.scene.objects if o.get('marketSurface')]:
            bpy.data.objects.remove(obj,do_unlink=True)
        variants=[obj for obj in bpy.context.scene.objects if 'marketVariant' in obj]
        for obj in variants:
            if obj['marketVariant'] == market_variant:
                obj.location.x=0
            else:
                for child in list(obj.children_recursive): bpy.data.objects.remove(child,do_unlink=True)
                bpy.data.objects.remove(obj,do_unlink=True)
    # Inspection pose only. Runtime uses the tested Three.js delta-time controller.
    for obj in bpy.context.scene.objects:
        part = obj.get('wheelPart')
        if part in ('rotor','gondola'):
            obj.rotation_mode='QUATERNION'
            angle=math.radians(wheel_angle)*(-1 if part=='rotor' else 1)
            obj.rotation_quaternion=Quaternion((0,1,0),angle)
    bpy.context.view_layer.update()
    for obj in bpy.context.scene.objects:
        if obj.get('wheelPart') == 'gondola':
            up=obj.matrix_world.to_quaternion() @ Vector((0,0,1))
            assert (up-Vector((0,0,1))).length < .0001, 'Inspection gondola is not upright'
    # GLB stores both groups; never render overlapping levels in an offline preview.
    unused_levels = [obj for obj in bpy.context.scene.objects
                     if 'tentLodLevel' in obj and obj['tentLodLevel'] != lod]
    for obj in unused_levels:
        for child in list(obj.children_recursive):
            bpy.data.objects.remove(child, do_unlink=True)
        bpy.data.objects.remove(obj, do_unlink=True)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
    low = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    high = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    extent = max(high - low)
    center = (low + high) * 0.5
    stats = {
        'file': path.name, 'lod': lod, 'wheelAngle': wheel_angle, 'night': night,
        'bounds': [list(low), list(high)],
        'triangles': sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes),
        'meshes': [{'name': o.name, 'vertices': len(o.data.vertices),
                    'materials': [m.name for m in o.data.materials if m]} for o in meshes],
        'materials': [{'name': m.name, 'images': [
            {'name': n.image.name, 'size': list(n.image.size)}
            for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image
        ]} for m in bpy.data.materials if m.use_nodes],
    }
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 16
    scene.cycles.use_denoising = True
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new('Studio')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.65, 0.7, 0.8, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = 0.025 if night else 0.6
    bpy.ops.object.light_add(type='AREA', location=center + Vector((extent, -extent, extent * 1.5)))
    bpy.context.object.data.energy = extent * extent * (3 if night else 90)
    bpy.context.object.data.shape = 'DISK'
    bpy.context.object.data.size = extent
    aim(bpy.context.object, center)
    bpy.ops.object.camera_add(location=center + Vector((extent * 0.9, -extent * 1.15, extent * 0.55)))
    scene.camera = bpy.context.object
    scene.camera.data.type = 'ORTHO'
    scene.camera.data.ortho_scale = extent * 1.45
    aim(scene.camera, center)
    scene.render.image_settings.file_format = 'PNG'
    directions = {'beauty': (0.9, -1.15, 0.55), 'front': (0, -1.5, 0.1),
                  'side': (1.5, 0, 0.1), 'rear': (0, 1.5, 0.1)}
    for view in views:
        scene.camera.data.type = 'ORTHO'
        scene.camera.data.ortho_scale = extent * 1.45
        scene.camera.data.clip_start = extent * 0.0001
        focus = center
        if view == 'interior':
            floor = bpy.data.objects.get('Tent_Groundsheet')
            if floor is None:
                continue
            p = [floor.matrix_world @ v.co for v in floor.data.vertices]
            floor_z = min(v.z for v in p)
            scene.camera.data.type = 'PERSP'
            scene.camera.data.lens = 18
            height = high.z - floor_z
            scene.camera.location = (0, -extent * 0.1, floor_z + height * 0.45)
            focus = Vector((0, extent * 0.22, floor_z + height * 0.1))
            # Inspection-only fill to reveal floor seams; not part of the exported asset/game.
            lamp = bpy.data.lights.new('Interior_Inspection_Only', 'POINT')
            lamp.energy = height * height * 18
            lamp.shadow_soft_size = height * 0.15
            inspection = bpy.data.objects.new('Interior_Inspection_Only', lamp)
            bpy.context.collection.objects.link(inspection)
            inspection.location = scene.camera.location
        else:
            scene.camera.location = center + Vector(directions[view]) * extent
        aim(scene.camera, focus)
        suffix = '' if view == 'beauty' else f'-{view}'
        scene.render.filepath = str(target / f'{path.stem}{suffix}.png')
        bpy.ops.render.render(write_still=True)
        if view == 'interior':
            bpy.data.objects.remove(inspection, do_unlink=True)
    return stats


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--models', nargs='*')
    parser.add_argument('--lod', type=int, choices=[0,1], default=0)
    parser.add_argument('--wheel-angle', type=float, default=0)
    parser.add_argument('--night', action='store_true')
    parser.add_argument('--size', type=int, choices=[640,1024,1536], default=640)
    parser.add_argument('--market-variant', choices=['merch','food','coffee','siemaShop','antykwariat','informacja','kodano'])
    parser.add_argument('--zone', choices=['pomorze','redBull','iqos'])
    parser.add_argument('--views', nargs='+', default=['beauty'],
                        choices=['beauty', 'front', 'side', 'rear', 'interior'])
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    args.output.mkdir(parents=True, exist_ok=True)
    paths = sorted(args.root.glob('*.glb'))
    if args.models:
        paths = [p for p in paths if p.stem in args.models]
    report = [render_model(p.resolve(), args.output.resolve(), args.views, size=args.size,lod=args.lod,
                          wheel_angle=args.wheel_angle, night=args.night,market_variant=args.market_variant,zone=args.zone) for p in paths]
    (args.output / 'audit.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print('TENT_AUDIT', json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
