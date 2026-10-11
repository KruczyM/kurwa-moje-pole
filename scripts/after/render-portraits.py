import bpy
import math
from pathlib import Path

CHARACTERS = [
    "amper", "antena", "gruczol", "klatwa", "krwiak", "pien", "pierscien", "zawor",
    "ambona", "chlebak", "dziaslo", "hemoroid", "jeczmien", "kobra", "korba", "szerszen"
]

root_dir = Path(".").resolve()
out_dir = (root_dir / "public/game-assets/2d/after/portraits").resolve()
out_dir.mkdir(parents=True, exist_ok=True)

def setup_portrait_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') and 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.resolution_x = 256
    scene.render.resolution_y = 256

    # Portrait camera (Perspective 65mm lens, looking at head/bust z=0.65)
    cam_data = bpy.data.cameras.new("PortraitCam")
    cam_data.lens = 65
    cam_obj = bpy.data.objects.new("PortraitCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    # Key light (Warm key)
    key_data = bpy.data.lights.new("Key", type='POINT')
    key_data.energy = 75.0
    key_data.color = (1.0, 0.95, 0.9)
    key_obj = bpy.data.objects.new("Key", key_data)
    bpy.context.collection.objects.link(key_obj)
    key_obj.location = (0.5, -1.2, 1.3)

    # Fill light (Cool blue fill)
    fill_data = bpy.data.lights.new("Fill", type='POINT')
    fill_data.energy = 35.0
    fill_data.color = (0.8, 0.9, 1.0)
    fill_obj = bpy.data.objects.new("Fill", fill_data)
    bpy.context.collection.objects.link(fill_obj)
    fill_obj.location = (-0.6, -1.1, 1.0)

    # Rim light
    rim_data = bpy.data.lights.new("Rim", type='POINT')
    rim_data.energy = 50.0
    rim_data.color = (1.0, 0.85, 0.6)
    rim_obj = bpy.data.objects.new("Rim", rim_data)
    bpy.context.collection.objects.link(rim_obj)
    rim_obj.location = (0.2, 0.8, 1.5)

    return cam_obj

def render_character_portrait(char_id):
    glb_path = (root_dir / f"public/game-assets/characters/{char_id}/preview.glb").resolve()
    if not glb_path.is_file():
        glb_path = (root_dir / f"public/game-assets/characters/{char_id}/npc-animations.glb").resolve()
    if not glb_path.is_file():
        print(f"Character {char_id} not found at {glb_path}")
        return

    cam_obj = setup_portrait_scene()
    scene = bpy.context.scene

    # Import
    bpy.ops.import_scene.gltf(filepath=str(glb_path))

    # All character models in this repo are normalized to z in [-1.0, 1.0]
    # Head and face center is at z ≈ 0.65, chest at z ≈ 0.35
    head_z = 0.62
    cam_dist = 1.15

    # 10 degrees yaw, looking directly at face
    yaw = math.radians(10)
    cam_obj.location = (
        cam_dist * math.sin(yaw),
        -cam_dist * math.cos(yaw),
        head_z
    )
    cam_obj.rotation_euler = (math.radians(90), 0, yaw)

    out_file = (out_dir / f"{char_id}.png").resolve()
    scene.render.filepath = str(out_file)
    bpy.ops.render.render(write_still=True)
    print(f"Rendered portrait for {char_id} -> {out_file}")

def main():
    print(f"Rendering calibrated portraits for {len(CHARACTERS)} characters...")
    for char_id in CHARACTERS:
        render_character_portrait(char_id)
    print("All portraits rendered successfully!")

if __name__ == "__main__":
    main()
