import bpy
import math
import mathutils
import json
from pathlib import Path

CHARACTERS = [
    "amper", "antena", "gruczol", "klatwa", "krwiak", "pien", "pierscien", "zawor",
    "ambona", "chlebak", "dziaslo", "hemoroid", "jeczmien", "kobra", "korba", "szerszen"
]

SPRITE_CHARACTERS = CHARACTERS

root_dir = Path(".").resolve()
portraits_dir = (root_dir / "public/game-assets/2d/after/portraits").resolve()
chars_dir = (root_dir / "public/game-assets/2d/after/characters").resolve()
portraits_dir.mkdir(parents=True, exist_ok=True)
chars_dir.mkdir(parents=True, exist_ok=True)

def setup_base_scene(res_x=256, res_y=256):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') and 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.resolution_x = res_x
    scene.render.resolution_y = res_y

    # Key light
    key_data = bpy.data.lights.new("Key", type='POINT')
    key_data.energy = 55.0
    key_data.color = (1.0, 0.96, 0.9)
    key_obj = bpy.data.objects.new("Key", key_data)
    bpy.context.collection.objects.link(key_obj)
    key_obj.location = (0.5, -1.0, 1.2)

    # Fill light
    fill_data = bpy.data.lights.new("Fill", type='POINT')
    fill_data.energy = 28.0
    fill_data.color = (0.8, 0.9, 1.0)
    fill_obj = bpy.data.objects.new("Fill", fill_data)
    bpy.context.collection.objects.link(fill_obj)
    fill_obj.location = (-0.6, -0.9, 0.9)

    # Rim light
    rim_data = bpy.data.lights.new("Rim", type='POINT')
    rim_data.energy = 38.0
    rim_data.color = (1.0, 0.85, 0.6)
    rim_obj = bpy.data.objects.new("Rim", rim_data)
    bpy.context.collection.objects.link(rim_obj)
    rim_obj.location = (0.2, 0.8, 1.3)

    return scene

def get_main_mesh():
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not meshes:
        return None
    valid_meshes = [m for m in meshes if len(m.data.vertices) > 200]
    return max(valid_meshes, key=lambda o: len(o.data.vertices)) if valid_meshes else meshes[0]

def render_portrait(char_id):
    glb_path = (root_dir / f"public/game-assets/characters/{char_id}/preview.glb").resolve()
    if not glb_path.is_file():
        glb_path = (root_dir / f"public/game-assets/characters/{char_id}/npc-animations.glb").resolve()
    if not glb_path.is_file():
        print(f"Character {char_id} not found")
        return

    setup_base_scene(256, 256)
    scene = bpy.context.scene
    bpy.ops.import_scene.gltf(filepath=str(glb_path))

    for o in scene.objects:
        if o.type == 'MESH' and len(o.data.vertices) < 200:
            o.hide_render = True

    main_mesh = get_main_mesh()
    if not main_mesh:
        return

    vs = [(main_mesh.matrix_world @ v.co) for v in main_mesh.data.vertices]
    min_z = min(v.z for v in vs)
    max_z = max(v.z for v in vs)
    height = max_z - min_z
    face_z = max_z - height * 0.14
    cam_dist = height * 0.64

    cam_data = bpy.data.cameras.new("PortCam")
    cam_data.lens = 60
    cam_obj = bpy.data.objects.new("PortCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    yaw = math.radians(7)
    cam_obj.location = (
        cam_dist * math.sin(yaw),
        -cam_dist * math.cos(yaw),
        face_z
    )
    cam_obj.rotation_euler = (math.radians(90), 0, yaw)

    out_file = portraits_dir / f"{char_id}.png"
    scene.render.filepath = str(out_file)
    bpy.ops.render.render(write_still=True)
    print(f"Rendered portrait: {out_file.name}")

def render_sprite_frames(char_id):
    glb_path = (root_dir / f"public/game-assets/characters/{char_id}/preview.glb").resolve()
    if not glb_path.is_file():
        glb_path = (root_dir / f"public/game-assets/characters/{char_id}/npc-animations.glb").resolve()
    if not glb_path.is_file():
        return

    frame_size = 64
    setup_base_scene(frame_size, frame_size)
    scene = bpy.context.scene

    bpy.ops.import_scene.gltf(filepath=str(glb_path))

    for o in scene.objects:
        if o.type == 'MESH' and len(o.data.vertices) < 200:
            o.hide_render = True

    main_mesh = get_main_mesh()
    if not main_mesh:
        return

    vs = [(main_mesh.matrix_world @ v.co) for v in main_mesh.data.vertices]
    min_z = min(v.z for v in vs)
    max_z = max(v.z for v in vs)
    height = max_z - min_z
    center_z = (min_z + max_z) / 2

    # Orthographic Top-Down Camera with 48-degree festival perspective
    cam_data = bpy.data.cameras.new("SpriteCam")
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 1.85
    cam_obj = bpy.data.objects.new("SpriteCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    armature = next((o for o in scene.objects if o.type == 'ARMATURE'), None)
    walk_action = None
    idle_action = None
    if armature and armature.animation_data:
        for action in bpy.data.actions:
            if 'walk' in action.name.lower():
                walk_action = action
            elif 'idle' in action.name.lower():
                idle_action = action

    char_frames_dir = (chars_dir / char_id / "raw").resolve()
    char_frames_dir.mkdir(parents=True, exist_ok=True)
    if (char_frames_dir / "left_3.png").is_file():
        print(f"Skipping {char_id}: raw frames already exist")
        return

    directions = [
        ("down", 0),
        ("right", 90),
        ("up", 180),
        ("left", 270)
    ]
    cols = 4

    pitch = math.radians(48)
    dist = 4.0
    target_z = -0.05

    walk_frames = [0, 5, 12, 20]
    if walk_action and walk_action.frame_range[1] > 1:
        f_start, f_end = int(walk_action.frame_range[0]), int(walk_action.frame_range[1])
        span = f_end - f_start
        walk_frames = [
            f_start,
            f_start + int(span * 0.25),
            f_start + int(span * 0.50),
            f_start + int(span * 0.75)
        ]

    for dir_name, yaw_deg in directions:
        yaw = math.radians(yaw_deg)
        cam_obj.location = (
            dist * math.sin(yaw) * math.cos(pitch),
            -dist * math.cos(yaw) * math.cos(pitch),
            target_z + dist * math.sin(pitch)
        )
        cam_obj.rotation_euler = (pitch, 0, yaw)

        for col_idx in range(cols):
            if col_idx == 0 and idle_action and armature:
                armature.animation_data.action = idle_action
                scene.frame_set(1)
            elif walk_action and armature:
                armature.animation_data.action = walk_action
                scene.frame_set(walk_frames[col_idx])
            else:
                scene.frame_set(col_idx * 5)

            frame_file = char_frames_dir / f"{dir_name}_{col_idx}.png"
            scene.render.filepath = str(frame_file)
            bpy.ops.render.render(write_still=True)

    print(f"Rendered raw frames for {char_id} -> {char_frames_dir}")

def main():
    print("=== Checking 16 Character Portraits ===")
    for char_id in CHARACTERS:
        if not (portraits_dir / f"{char_id}.png").is_file():
            render_portrait(char_id)

    print("\n=== Rendering Character Sprite Frames ===")
    for char_id in SPRITE_CHARACTERS:
        render_sprite_frames(char_id)

    print("Blender character phase complete!")

if __name__ == "__main__":
    main()
