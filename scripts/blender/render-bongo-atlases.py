"""Render animation-derived Bongo atlases, never modifying shared After artwork.

Run with Blender --background --python this-file -- [hero ...].
The companion packer uses Pillow from the normal local Python environment.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
HEROES = ['amper', 'antena', 'gruczol', 'klatwa', 'krwiak', 'pien', 'pierscien', 'zawor',
          'ambona', 'chlebak', 'dziaslo', 'hemoroid', 'jeczmien', 'korba', 'szerszen', 'kobra']


def bounds(meshes):
    """Measure evaluated skinned vertices, not bind-pose object boxes or helper meshes."""
    points = []
    graph = bpy.context.evaluated_depsgraph_get()
    for obj in meshes:
        evaluated = obj.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        points.extend(evaluated.matrix_world @ vertex.co for vertex in mesh.vertices)
        evaluated.to_mesh_clear()
    return points


def action_frame(rig, action, fraction):
    """Select one imported action and its slot, with no active NLA strips blending other clips."""
    rig.animation_data_create()
    rig.animation_data.action = action
    if action.slots:
        rig.animation_data.action_slot = action.slots[0]
    start, end = action.frame_range
    bpy.context.scene.frame_set(int(start + (end - start) * fraction))
    bpy.context.view_layer.update()


def render(hero):
    """Fit all idle/walk frames and four views into one fixed orthographic camera scale."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 8
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = 96
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'Standard'
    npc = hero in ['owsiak', 'patrol']
    source = (ROOT / f'source-assets/bongo-rush/models/{hero}-textured.glb' if npc else
              ROOT / f'public/game-assets/characters/{hero}/npc-animations.glb')
    bpy.ops.import_scene.gltf(filepath=str(source))
    rigs = [obj for obj in scene.objects if obj.type == 'ARMATURE']
    if not rigs and not npc:
        raise RuntimeError(f'{hero}: no animated armature; refusing a T-pose fallback')
    rig = rigs[0] if rigs else None
    for animated in rigs:
        if animated.animation_data:
            for track in animated.animation_data.nla_tracks:
                track.mute = True
    meshes = [obj for obj in scene.objects if obj.type == 'MESH' and len(obj.data.vertices) > 200]
    for obj in scene.objects:
        if obj.type == 'MESH' and obj not in meshes:
            obj.hide_render = True
    actions = {action.name.lower(): action for action in bpy.data.actions}
    idle, walk = actions.get('idle'), actions.get('walk')
    if not npc and (not idle or not walk):
        raise RuntimeError(f'{hero}: Idle/Walk missing; refusing static fallback')
    samples = [(None, 0)] if npc else [(idle, 0.25)] + [(walk, fraction) for fraction in [0, 0.25, 0.5, 0.75]]
    all_points = []
    for action, fraction in samples:
        if action:
            action_frame(rig, action, fraction)
        all_points.extend(bounds(meshes))
    low = Vector(tuple(min(p[axis] for p in all_points) for axis in range(3)))
    high = Vector(tuple(max(p[axis] for p in all_points) for axis in range(3)))
    center = (low + high) / 2
    span = high - low
    # Normalize through a parent, preserving animated armature/object transforms.
    wrapper = bpy.data.objects.new('BongoRoot', None)
    scene.collection.objects.link(wrapper)
    for obj in list(scene.objects):
        if obj != wrapper and obj.parent is None:
            world = obj.matrix_world.copy()
            obj.parent = wrapper
            obj.matrix_world = world
    factor = 1 / max(span.z, 0.001)
    wrapper.scale = (factor,) * 3
    wrapper.location = -center * factor
    world = bpy.data.worlds.new('Studio')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.65
    scene.world = world
    for name, location, energy, size in [
        ('Key', (2, -3, 4), 240, 4), ('Fill', (-3, -1, 2), 150, 4), ('Rim', (0, 3, 3), 160, 3),
    ]:
        data = bpy.data.lights.new(name, 'AREA')
        data.energy, data.shape, data.size = energy, 'DISK', size
        light = bpy.data.objects.new(name, data)
        scene.collection.objects.link(light)
        light.location = location
        light.rotation_euler = (-light.location).to_track_quat('-Z', 'Y').to_euler()
    data = bpy.data.cameras.new('Camera')
    data.type = 'ORTHO'
    # A bounding sphere contains every evaluated point at every yaw, including hats/hands.
    radius = max((p - center).length for p in all_points) * factor
    data.ortho_scale = radius * 2 * 1.12
    camera = bpy.data.objects.new('Camera', data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    out = ROOT / f'reports/bongo-atlases/{hero}'
    out.mkdir(parents=True, exist_ok=True)
    for row, yaw_degrees in enumerate([0, -90, 180, 90]):
        yaw = math.radians(yaw_degrees)
        camera.location = (3 * math.sin(yaw), -3 * math.cos(yaw), 2.3)
        camera.rotation_euler = (-camera.location).to_track_quat('-Z', 'Y').to_euler()
        for column, (action, fraction) in enumerate(samples):
            if action:
                action_frame(rig, action, fraction)
            scene.render.filepath = str(out / f'{row}-{column}.png')
            bpy.ops.render.render(write_still=True)
    (out / 'meta.json').write_text(json.dumps({
        'character': hero, 'frameWidth': 96, 'frameHeight': 96, 'framesPerDirection': len(samples),
        'rows': {'down': 0, 'right': 1, 'up': 2, 'left': 3},
        'animationColumns': {'idle': [0], 'walk': [0] if npc else [1, 2, 3, 4]},
        'source': str(source.relative_to(ROOT)).replace('\\', '/'),
        'cameraFit': 'all-evaluated-frames-sphere',
        'rigStatus': 'unrigged-generated-mesh' if npc else 'animated',
    }, indent=2), encoding='utf-8')
    print(f'BONGO_ATLAS_RENDERED {hero}', flush=True)


if __name__ == '__main__':
    selected = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else HEROES
    for character in selected or HEROES:
        render(character)
