"""
Render check for Duża Scena front skirt and town signs.
Renders two views:
1. duza_scena_skirt_closeup.png: Exact eye-level perspective in front of the stage (matching user view).
2. duza_scena_full_front.png: Full stage front view showing all town signs and stage structure.
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
    scene.render.resolution_y = 600
    scene.render.image_settings.file_format = 'PNG'

def point_camera_at(camera, target_pos):
    loc = camera.location
    direction = Vector(target_pos) - loc
    rot_quat = direction.to_track_quat('-Z', 'Y')
    camera.rotation_euler = rot_quat.to_euler()

def render_views():
    root = Path(__file__).resolve().parents[2]
    glb_path = root / "public" / "game-assets" / "world" / "festival" / "main_stage.glb"
    out_dir = Path("C:/Users/krucz/.gemini/antigravity/brain/d81ba138-3200-4466-b868-2f212dff67d0")

    # 1. Close-up skirt view (matching user screenshot)
    clear_scene()
    scene = bpy.context.scene
    setup_render_engine(scene)
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 450

    # Lighting
    world = bpy.data.worlds.new('Sky')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.7, 0.8, 0.95, 1.0)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
    scene.world = world

    bpy.ops.object.light_add(type='SUN', location=(10, -15, 20))
    sun = bpy.context.object
    sun.data.energy = 2.5
    sun.rotation_euler = (0.6, 0.3, -0.6)

    # Import Duza Scena
    bpy.ops.import_scene.gltf(filepath=str(glb_path))

    # In Blender coordinate system:
    # Three.js (X, Y, Z) -> Blender (X, -Z, Y up)
    # Stage front skirt in Three.js is at Z = 2.51, facing +Z.
    # In Blender, this is Y = -2.51, facing -Y!
    # Stage center is X = 0, Y_blender = -2.51, Z_blender = 1.1 (skirt height 0 to 2.2).
    # Camera in Three.js: in front of skirt, say Z = 7.0, Y = 1.6, X = 0.0.
    # In Blender: location = (0.0, -8.0, 1.5).

    bpy.ops.object.camera_add(location=(0.0, -8.5, 1.4))
    cam = bpy.context.object
    scene.camera = cam
    cam.data.lens = 32
    point_camera_at(cam, (0.0, -2.51, 1.2))

    scene.render.filepath = str(out_dir / "duza_scena_skirt_closeup.png")
    bpy.ops.render.render(write_still=True)
    print("Rendered duza_scena_skirt_closeup.png")

    # 2. Wide front view
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 700
    cam.location = (0.0, -24.0, 4.5)
    cam.data.lens = 28
    point_camera_at(cam, (0.0, -2.51, 3.5))

    scene.render.filepath = str(out_dir / "duza_scena_full_front.png")
    bpy.ops.render.render(write_still=True)
    print("Rendered duza_scena_full_front.png")

if __name__ == '__main__':
    render_views()
