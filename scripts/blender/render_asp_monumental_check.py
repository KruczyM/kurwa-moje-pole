"""
Render check for Monumental Scena ASP:
1. asp_monumental_exterior.png: Front 3/4 perspective showing the monumental 34m entrance portal,
   towering 9.5m totems with guy-wires, 3D ASP letters, and branded gable wall.
2. asp_monumental_interior.png: Interior perspective inside the pavilion looking towards the
   22m wide stage deck, Persian rug, armchairs, amps, and "MALA SCENA TYLKO Z NAZWY" backdrop.
3. stages_scale_comparison.png: Aerial comparison showing both Duza Scena and Scena ASP.
"""

from pathlib import Path
import bpy
from mathutils import Vector

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def setup_render_engine(scene):
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.image_settings.file_format = 'PNG'

def point_camera_at(camera, target_pos):
    loc = camera.location
    direction = Vector(target_pos) - loc
    rot_quat = direction.to_track_quat('-Z', 'Y')
    camera.rotation_euler = rot_quat.to_euler()

def add_sun_and_sky(scene):
    world = bpy.data.worlds.new('FestivalSky')
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.68, 0.80, 0.95, 1.0)
    bg.inputs['Strength'].default_value = 0.85
    scene.world = world

    bpy.ops.object.light_add(type='SUN', location=(30, -35, 45))
    sun = bpy.context.object
    sun.data.energy = 2.6
    sun.rotation_euler = (0.55, 0.35, -0.65)

def add_ground_plane():
    mat_grass = bpy.data.materials.new(name='Mat_Ground_Turf')
    mat_grass.use_nodes = True
    bsdf = mat_grass.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.18, 0.32, 0.12, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.9

    mesh = bpy.data.meshes.new('TurfPlane')
    half_size = 75.0
    verts = [
        (-half_size, -half_size, -0.02),
        (half_size, -half_size, -0.02),
        (half_size, half_size, -0.02),
        (-half_size, half_size, -0.02),
    ]
    faces = [(0, 1, 2, 3)]
    mesh.from_pydata(verts, [], faces)
    mesh.update()

    obj = bpy.data.objects.new('TurfPlane', mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat_grass)

def render_views():
    root = Path(__file__).resolve().parents[2]
    asp_glb = root / "public" / "game-assets" / "world" / "festival" / "small_stage.glb"
    main_glb = root / "public" / "game-assets" / "world" / "festival" / "main_stage.glb"
    out_dir = Path("C:/Users/krucz/.gemini/antigravity/brain/d81ba138-3200-4466-b868-2f212dff67d0")

    # -------------------------------------------------------------
    # 1. EXTERIOR 3/4 PERSPECTIVE: asp_monumental_exterior.png
    # -------------------------------------------------------------
    clear_scene()
    scene = bpy.context.scene
    setup_render_engine(scene)
    add_sun_and_sky(scene)
    add_ground_plane()

    # Import small_stage.glb
    bpy.ops.import_scene.gltf(filepath=str(asp_glb))

    # Add warm fill light near the entrance portal
    bpy.ops.object.light_add(type='POINT', location=(0.0, -4.0, 6.0))
    fill = bpy.context.object
    fill.data.energy = 8000.0
    fill.data.color = (1.0, 0.94, 0.85)
    fill.data.shadow_soft_size = 3.0

    # Camera looking at entrance and plaza
    # In Blender: entrance is at Y = -6.0, plaza at Y = -8.5, height is 16.5m.
    bpy.ops.object.camera_add(location=(-32.0, -38.0, 12.0))
    cam = bpy.context.object
    scene.camera = cam
    cam.data.lens = 28
    point_camera_at(cam, (0.0, -4.0, 7.5))

    scene.render.filepath = str(out_dir / "asp_monumental_exterior.png")
    bpy.ops.render.render(write_still=True)
    print("Rendered asp_monumental_exterior.png")

    # -------------------------------------------------------------
    # 2. INTERIOR PERSPECTIVE: asp_monumental_interior.png
    # -------------------------------------------------------------
    # Warm spotlights on stage backdrop & armchairs
    bpy.ops.object.light_add(type='POINT', location=(0.0, 31.0, 8.5))
    stage_light = bpy.context.object
    stage_light.data.energy = 15000.0
    stage_light.data.color = (1.0, 0.88, 0.72)
    stage_light.data.shadow_soft_size = 2.0

    # Camera positioned inside the pavilion looking down the center aisle at the stage
    cam.location = (0.0, 6.0, 3.2)
    cam.data.lens = 24
    point_camera_at(cam, (0.0, 33.0, 5.5))

    scene.render.filepath = str(out_dir / "asp_monumental_interior.png")
    bpy.ops.render.render(write_still=True)
    print("Rendered asp_monumental_interior.png")

    # -------------------------------------------------------------
    # 3. SIDE-BY-SIDE SCALE COMPARISON: stages_scale_comparison.png
    # -------------------------------------------------------------
    clear_scene()
    scene = bpy.context.scene
    setup_render_engine(scene)
    add_sun_and_sky(scene)
    add_ground_plane()

    # Import both stages side-by-side
    # ASP on left (offset X = -32)
    bpy.ops.import_scene.gltf(filepath=str(asp_glb))
    asp_root = bpy.context.selected_objects[0]
    for obj in bpy.context.selected_objects:
        obj.location.x -= 32.0

    # Duza Scena on right (offset X = +32)
    bpy.ops.import_scene.gltf(filepath=str(main_glb))
    for obj in bpy.context.selected_objects:
        obj.location.x += 32.0

    bpy.ops.object.camera_add(location=(0.0, -85.0, 38.0))
    cam = bpy.context.object
    scene.camera = cam
    cam.data.lens = 35
    point_camera_at(cam, (0.0, 0.0, 10.0))

    scene.render.filepath = str(out_dir / "stages_scale_comparison.png")
    bpy.ops.render.render(write_still=True)
    print("Rendered stages_scale_comparison.png")

if __name__ == '__main__':
    render_views()
