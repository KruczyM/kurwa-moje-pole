import bpy
import sys
import math
import mathutils
from pathlib import Path

# Mapping of GLB files to target output PNGs
# (glb_path, output_name, resolution, ortho_padding, pitch_deg, yaw_deg)
PROPS_TO_RENDER = [
    ("public/game-assets/world/toitoi_blue.glb", "toitoi.png", 128, 1.25, 48, 25),
    ("public/game-assets/world/camping_chair.glb", "camping_chair.png", 128, 1.2, 50, 35),
    ("public/game-assets/interactables/table.glb", "picnic_table.png", 160, 1.3, 48, 30),
    ("public/game-assets/world/flag.glb", "camp_flag.png", 160, 1.25, 45, 15),
    ("public/game-assets/world/tents/small.glb", "tent_small.png", 192, 1.3, 48, 30),
    ("public/game-assets/world/tents/big2.glb", "tent_large.png", 224, 1.35, 48, 30),
    ("public/game-assets/interactables/water.glb", "items/water_bottle.png", 96, 1.3, 45, 20),
    ("public/game-assets/interactables/sunglasses.glb", "items/sunglasses.png", 96, 1.35, 55, 10),
]

out_base = Path("public/game-assets/2d/after/props").resolve()
out_base.mkdir(parents=True, exist_ok=True)
(out_base / "items").mkdir(parents=True, exist_ok=True)

def setup_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') and 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'

    # Camera
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = 'ORTHO'
    cam_obj = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    # Main Sun light
    sun_data = bpy.data.lights.new("Sun", type='SUN')
    sun_data.energy = 4.0
    sun_obj = bpy.data.objects.new("Sun", sun_data)
    bpy.context.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = (math.radians(45), math.radians(25), math.radians(55))

    # Fill Sun light (soft blue ambient)
    fill_data = bpy.data.lights.new("Fill", type='SUN')
    fill_data.energy = 1.5
    fill_data.color = (0.75, 0.85, 1.0)
    fill_obj = bpy.data.objects.new("Fill", fill_data)
    bpy.context.collection.objects.link(fill_obj)
    fill_obj.rotation_euler = (math.radians(-35), math.radians(-30), math.radians(135))

    return cam_obj

def render_prop(glb_rel_path, out_filename, res, padding, pitch_deg, yaw_deg):
    glb_path = Path(glb_rel_path).resolve()
    if not glb_path.is_file():
        print(f"Skipping missing GLB: {glb_path}")
        return

    cam_obj = setup_scene()
    scene = bpy.context.scene
    scene.render.resolution_x = res
    scene.render.resolution_y = res

    # Import
    bpy.ops.import_scene.gltf(filepath=str(glb_path))

    # Calculate bounding box of all imported meshes
    meshes = [o for o in scene.objects if o.type == 'MESH']
    if not meshes:
        print(f"No meshes in {glb_path}")
        return

    min_c = [float('inf')] * 3
    max_c = [float('-inf')] * 3
    for obj in meshes:
        for v in obj.bound_box:
            w_v = obj.matrix_world @ mathutils.Vector(v)
            for i in range(3):
                min_c[i] = min(min_c[i], w_v[i])
                max_c[i] = max(max_c[i], w_v[i])

    center = mathutils.Vector([(min_c[i] + max_c[i]) / 2 for i in range(3)])
    size = mathutils.Vector([max_c[i] - min_c[i] for i in range(3)])
    max_dim = max(size.x, size.y, size.z)

    # Position camera
    pitch = math.radians(pitch_deg)
    yaw = math.radians(yaw_deg)
    dist = max(max_dim * 4.0, 5.0)

    cam_pos = center + mathutils.Vector((
        dist * math.sin(yaw) * math.cos(pitch),
        -dist * math.cos(yaw) * math.cos(pitch),
        dist * math.sin(pitch)
    ))
    cam_obj.location = cam_pos
    cam_obj.rotation_euler = (pitch, 0, yaw)
    cam_obj.data.ortho_scale = max_dim * padding

    # Render
    out_file = (out_base / out_filename).resolve()
    out_file.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(out_file)
    bpy.ops.render.render(write_still=True)
    print(f"Rendered: {out_file} ({res}x{res})")

def main():
    for glb_rel, out_name, res, pad, pitch, yaw in PROPS_TO_RENDER:
        render_prop(glb_rel, out_name, res, pad, pitch, yaw)

if __name__ == "__main__":
    main()
