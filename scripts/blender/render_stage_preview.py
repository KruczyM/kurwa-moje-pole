"""
Render script for Scena ASP previews:
1. scena_asp_preview.png - 3/4 exterior perspective view showing the long white tent pavilion,
   front branded gable wall, open portal, 3D ASP letters, 3D mBank totem, and folk art totems.
2. scena_asp_interior_preview.png - Interior perspective looking from audience grass at the
   stage deck, Persian rug, debate armchairs, amp stacks, and "MALA SCENA TYLKO Z NAZWY" backdrop.
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
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'

def setup_world(scene, sky_color=(0.7, 0.8, 0.95, 1.0), strength=0.8):
    world = bpy.data.worlds.new('FestivalSky')
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = sky_color
    bg.inputs['Strength'].default_value = strength
    scene.world = world

def add_sun_light(location=(18, -25, 30), energy=2.2, rotation=(0.55, 0.35, -0.7)):
    bpy.ops.object.light_add(type='SUN', location=location)
    sun = bpy.context.object
    sun.data.energy = energy
    sun.rotation_euler = rotation
    return sun

def add_ground_plane():
    mat_grass = bpy.data.materials.new(name='Mat_Ground_Turf')
    mat_grass.use_nodes = True
    bsdf = mat_grass.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.16, 0.30, 0.11, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.9

    mesh = bpy.data.meshes.new('TurfPlane')
    half_size = 35.0
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
    return obj

def point_camera_at(camera, target_pos):
    loc = camera.location
    direction = Vector(target_pos) - loc
    rot_quat = direction.to_track_quat('-Z', 'Y')
    camera.rotation_euler = rot_quat.to_euler()

def render_previews(glb_path, output_dir):
    output_dir = Path(output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    # ---------------------------------------------------------
    # 1. EXTERIOR 3/4 VIEW: scena_asp_preview.png
    # ---------------------------------------------------------
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    setup_render_engine(scene)
    setup_world(scene, sky_color=(0.65, 0.78, 0.92, 1.0), strength=0.85)
    add_sun_light(location=(22, -26, 32), energy=2.4, rotation=(0.52, 0.38, -0.68))

    # Soft warm fill light near the entrance so the interior stage glows invitingly
    bpy.ops.object.light_add(type='POINT', location=(0.0, -1.0, 3.5))
    fill_light = bpy.context.object
    fill_light.data.energy = 500.0
    fill_light.data.color = (1.0, 0.92, 0.8)
    fill_light.data.shadow_soft_size = 2.0

    # Stage interior spotlight pointing at backdrop & carpet
    bpy.ops.object.light_add(type='POINT', location=(0.0, 5.0, 4.5))
    stage_light = bpy.context.object
    stage_light.data.energy = 900.0
    stage_light.data.color = (1.0, 0.85, 0.7)
    stage_light.data.shadow_soft_size = 1.5

    add_ground_plane()

    # Import small_stage.glb
    bpy.ops.import_scene.gltf(filepath=str(glb_path))

    # Exterior Camera: 3/4 perspective showing the long side stretching back + front gable & lawn
    bpy.ops.object.camera_add(location=(-17.0, -17.5, 8.0))
    cam = bpy.context.object
    cam.data.lens = 30
    scene.camera = cam
    point_camera_at(cam, (0.0, 1.0, 3.8))

    ext_preview = output_dir / 'scena_asp_preview.png'
    scene.render.filepath = str(ext_preview)
    print(f"Rendering exterior preview to {ext_preview}...")
    bpy.ops.render.render(write_still=True)
    print("Exterior preview done!")

    # ---------------------------------------------------------
    # 2. INTERIOR STAGE VIEW: scena_asp_interior_preview.png
    # ---------------------------------------------------------
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    setup_render_engine(scene)
    # Darker ambient sky for dramatic concert stage lighting
    setup_world(scene, sky_color=(0.05, 0.06, 0.08, 1.0), strength=0.2)

    # Portal ambient light from outdoor lawn
    bpy.ops.object.light_add(type='POINT', location=(0.0, -3.0, 2.5))
    portal_fill = bpy.context.object
    portal_fill.data.energy = 250.0
    portal_fill.data.color = (0.7, 0.8, 0.95)

    # Warm key light on Persian rug and armchairs (moderate energy to preserve colors)
    bpy.ops.object.light_add(type='SPOT', location=(0.0, 2.5, 5.8))
    spot_main = bpy.context.object
    spot_main.data.energy = 750.0
    spot_main.data.color = (1.0, 0.92, 0.82)
    spot_main.data.spot_size = math.radians(70)
    spot_main.data.spot_blend = 0.3
    point_camera_at(spot_main, (0.0, 5.6, 1.15))

    # Gentle warm fill from stage truss
    bpy.ops.object.light_add(type='POINT', location=(0.0, 5.2, 5.5))
    truss_fill = bpy.context.object
    truss_fill.data.energy = 450.0
    truss_fill.data.color = (1.0, 0.88, 0.75)

    add_ground_plane()

    # Import small_stage.glb
    bpy.ops.import_scene.gltf(filepath=str(glb_path))

    # Interior Camera: Inside the tent on the central grass floor looking at the stage
    bpy.ops.object.camera_add(location=(0.0, -1.2, 1.9))
    cam_int = bpy.context.object
    cam_int.data.lens = 26
    scene.camera = cam_int
    point_camera_at(cam_int, (0.0, 5.8, 3.2))

    int_preview = output_dir / 'scena_asp_interior_preview.png'
    scene.render.filepath = str(int_preview)
    print(f"Rendering interior preview to {int_preview}...")
    bpy.ops.render.render(write_still=True)
    print("Interior preview done!")

if __name__ == '__main__':
    repo_root = Path(__file__).resolve().parents[2]
    glb_file = repo_root / 'public' / 'game-assets' / 'world' / 'festival' / 'small_stage.glb'
    artifacts_dir = Path(r'C:\Users\krucz\.gemini\antigravity\brain\d81ba138-3200-4466-b868-2f212dff67d0')
    render_previews(glb_file, artifacts_dir)
