import bpy
from mathutils import Vector
from pathlib import Path

def render_model(glb_path, out_img):
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for col in list(bpy.data.collections):
        bpy.data.collections.remove(col, do_unlink=True)

    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 20
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.image_settings.file_format = 'PNG'

    # World
    world = bpy.data.worlds.new('WhiteStudio')
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.9, 0.9, 0.9, 1.0)
    bg.inputs['Strength'].default_value = 1.0
    scene.world = world

    # Lights
    bpy.ops.object.light_add(type='SUN', location=(5, -10, 10))
    sun = bpy.context.object
    sun.data.energy = 2.5
    sun.rotation_euler = (0.7, 0.2, -0.4)

    bpy.ops.import_scene.gltf(filepath=str(glb_path))

    # Center camera on bounds
    bounds_min = Vector((float('inf'), float('inf'), float('inf')))
    bounds_max = Vector((float('-inf'), float('-inf'), float('-inf')))
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            for corner in obj.bound_box:
                world_coord = obj.matrix_world @ Vector(corner)
                bounds_min.x = min(bounds_min.x, world_coord.x)
                bounds_min.y = min(bounds_min.y, world_coord.y)
                bounds_min.z = min(bounds_min.z, world_coord.z)
                bounds_max.x = max(bounds_max.x, world_coord.x)
                bounds_max.y = max(bounds_max.y, world_coord.y)
                bounds_max.z = max(bounds_max.z, world_coord.z)

    center = (bounds_min + bounds_max) / 2.0
    size = bounds_max - bounds_min
    max_dim = max(size.x, size.y, size.z, 0.1)

    cam_data = bpy.data.cameras.new('Cam')
    cam_data.lens = 45
    cam = bpy.data.objects.new('Cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    cam.location = center + Vector((0.0, -max_dim * 2.5, max_dim * 0.2))
    cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()

    scene.render.filepath = str(out_img)
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {glb_path} to {out_img}")

artifacts_dir = Path(r"C:\Users\krucz\.gemini\antigravity\brain\d81ba138-3200-4466-b868-2f212dff67d0")
p = Path("public/game-assets/characters/klatwa")

for name in ['legacy-preview.glb', 'preview.glb', 'new-preview-animations.glb', 'npc-animations.glb']:
    render_model(p / name, artifacts_dir / f"klatwa_render_{name}.png")
