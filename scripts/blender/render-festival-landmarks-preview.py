"""
Render script for newly created Pol'and'Rock 2026 Festival landmarks:
1. festival_gate.glb (Main Festival Gate)
2. krishna_village.glb (Hare Krishna Village)
3. mud_bath.glb (The Legendary Mud Bath)
4. fire_truck_osp.glb (Volunteer Fire Truck OSP)
5. delay_tower.glb (Concert Delay Tower)

Outputs: festival_landmarks_showcase.png in the artifacts directory.
"""

import math
from pathlib import Path
import bpy
from mathutils import Vector

def setup_render_engine(scene):
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 36
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'

def setup_world(scene):
    world = bpy.data.worlds.new('FestivalSky')
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.72, 0.82, 0.96, 1.0)
    bg.inputs['Strength'].default_value = 0.95
    scene.world = world

def add_lighting():
    # Warm festival afternoon sun
    bpy.ops.object.light_add(type='SUN', location=(25, -35, 40))
    sun = bpy.context.object
    sun.data.energy = 3.4
    sun.rotation_euler = (0.65, 0.35, -0.6)

    # Soft ambient fill
    bpy.ops.object.light_add(type='SUN', location=(-20, 20, 30))
    fill = bpy.context.object
    fill.data.energy = 1.0
    fill.rotation_euler = (0.4, -0.5, 2.2)

def add_ground_plane():
    mat_grass = bpy.data.materials.new(name='Mat_Ground_Turf')
    mat_grass.use_nodes = True
    bsdf = mat_grass.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.16, 0.30, 0.11, 1.0) # Summer meadow green
    bsdf.inputs['Roughness'].default_value = 0.9

    mesh = bpy.data.meshes.new('TurfPlane')
    half_size = 60.0
    verts = [
        (-half_size, -half_size, -0.01),
        (half_size, -half_size, -0.01),
        (half_size, half_size, -0.01),
        (-half_size, half_size, -0.01),
    ]
    faces = [(0, 1, 2, 3)]
    mesh.from_pydata(verts, [], faces)
    mesh.update()

    obj = bpy.data.objects.new('TurfPlane', mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat_grass)

def render_showcase(artifacts_dir, models_dir):
    # Clear existing
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for col in list(bpy.data.collections):
        bpy.data.collections.remove(col, do_unlink=True)

    scene = bpy.context.scene
    setup_render_engine(scene)
    setup_world(scene)
    add_lighting()
    add_ground_plane()

    landmarks = [
        ('festival_gate.glb', (0, 7.5, 0), 0.0),
        ('krishna_village.glb', (-12.0, -1.0, 0), 0.28),
        ('mud_bath.glb', (-6.5, -9.5, 0), 0.08),
        ('fire_truck_osp.glb', (7.5, -7.5, 0), -0.52),
        ('delay_tower.glb', (12.5, 1.5, 0), -0.22),
    ]

    for filename, pos, rot_z in landmarks:
        glb_path = models_dir / filename
        if not glb_path.exists():
            print(f"Warning: {glb_path} does not exist!")
            continue

        before_objs = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(glb_path))
        imported_objs = set(bpy.data.objects) - before_objs

        for obj in imported_objs:
            if obj.parent is None:
                obj.location.x += pos[0]
                obj.location.y += pos[1]
                obj.location.z += pos[2]
                obj.rotation_euler.z += rot_z

    # Camera placement
    cam_data = bpy.data.cameras.new('ShowcaseCam')
    cam_data.lens = 28
    cam_obj = bpy.data.objects.new('ShowcaseCam', cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    cam_obj.location = Vector((0.0, -25.0, 8.5))
    target = Vector((0.0, -0.5, 3.2))
    direction = target - cam_obj.location
    cam_obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

    out_file = artifacts_dir / 'festival_landmarks_showcase.png'
    scene.render.filepath = str(out_file)
    print(f"Rendering showcase to {out_file}...")
    bpy.ops.render.render(write_still=True)
    print("Render complete!")

if __name__ == '__main__':
    repo_root = Path(__file__).resolve().parents[2]
    models_dir = repo_root / 'public' / 'game-assets' / 'world' / 'festival'
    artifacts_dir = Path(r"C:\Users\krucz\.gemini\antigravity\brain\d81ba138-3200-4466-b868-2f212dff67d0")
    render_showcase(artifacts_dir, models_dir)
