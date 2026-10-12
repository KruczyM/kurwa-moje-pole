import bpy
import math
from pathlib import Path

CHARACTERS = [
    "amper", "korba", "klatwa", "chlebak", "kobra", "zawor", "szerszen", "dziaslo",
    "hemoroid", "jeczmien", "ambona", "antena", "gruczol", "krwiak", "pien", "pierscien"
]

root_dir = Path(".").resolve()
sprites_dir = (root_dir / "public/game-assets/2d/fighter/sprites").resolve()
sprites_dir.mkdir(parents=True, exist_ok=True)

# 1. Load animations from Amper
bpy.ops.wm.read_factory_settings(use_empty=True)
p_amper = (root_dir / "public/game-assets/characters/amper/npc-animations.glb").resolve()
bpy.ops.import_scene.gltf(filepath=str(p_amper))

actions_bank = {
    "idle": (bpy.data.actions.get("Idle"), 12),
    "walk": (bpy.data.actions.get("Walk"), 6),
    "punch": (bpy.data.actions.get("HipHopDancing"), 38),
    "kick": (bpy.data.actions.get("Capoeira"), 55),
    "crouch": (bpy.data.actions.get("SneakWalk"), 10),
    "hit": (bpy.data.actions.get("DrunkWalkingTurn"), 22),
}

# Keep action datablocks, clear objects
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') and 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.resolution_x = 256
scene.render.resolution_y = 256

# Sun lighting (scale-invariant illumination)
sun1 = bpy.data.lights.new('KeySun', type='SUN')
sun1.energy = 4.5
s1_obj = bpy.data.objects.new('KeySun', sun1)
scene.collection.objects.link(s1_obj)
s1_obj.rotation_euler = (math.radians(45), math.radians(20), math.radians(40))

sun2 = bpy.data.lights.new('FillSun', type='SUN')
sun2.energy = 2.0
s2_obj = bpy.data.objects.new('FillSun', sun2)
scene.collection.objects.link(s2_obj)
s2_obj.rotation_euler = (math.radians(45), math.radians(-20), math.radians(-30))

sun3 = bpy.data.lights.new('RimSun', type='SUN')
sun3.energy = 2.8
s3_obj = bpy.data.objects.new('RimSun', sun3)
scene.collection.objects.link(s3_obj)
s3_obj.rotation_euler = (math.radians(-30), math.radians(-30), math.radians(160))

cam_data = bpy.data.cameras.new('FighterCam')
cam_data.type = 'ORTHO'
cam_obj = bpy.data.objects.new('FighterCam', cam_data)
scene.collection.objects.link(cam_obj)
scene.camera = cam_obj

yaw = math.radians(78)
cam_obj.rotation_euler = (math.radians(90), 0, yaw)

for char_id in CHARACTERS:
    char_dir = sprites_dir / char_id
    char_dir.mkdir(parents=True, exist_ok=True)

    glb_path = (root_dir / f"public/game-assets/characters/{char_id}/npc-animations.glb").resolve()
    if not glb_path.is_file():
        print(f"Skipping {char_id}: file not found")
        continue

    bpy.ops.import_scene.gltf(filepath=str(glb_path))

    arm = next((o for o in scene.objects if o.type == 'ARMATURE' and o != cam_obj), None)
    mesh = next((o for o in scene.objects if o.type == 'MESH' and len(o.data.vertices) > 200), None)

    if not arm or not mesh:
        print(f"Error: Armature or Mesh missing for {char_id}")
        continue

    if not arm.animation_data:
        arm.animation_data_create()

    for pose_name, (act, frame) in actions_bank.items():
        if not act:
            continue
        arm.animation_data.action = act
        if act.slots:
            arm.animation_data.action_slot = act.slots[0]

        scene.frame_set(frame)
        bpy.context.view_layer.update()

        depsgraph = bpy.context.evaluated_depsgraph_get()
        eval_obj = mesh.evaluated_get(depsgraph)
        eval_mesh = eval_obj.to_mesh()
        vs = [(eval_obj.matrix_world @ v.co) for v in eval_mesh.vertices]
        eval_obj.to_mesh_clear()

        if not vs:
            continue

        min_x, max_x = min(v.x for v in vs), max(v.x for v in vs)
        min_y, max_y = min(v.y for v in vs), max(v.y for v in vs)
        min_z, max_z = min(v.z for v in vs), max(v.z for v in vs)
        height = max_z - min_z
        center_x = (min_x + max_x) / 2
        center_y = (min_y + max_y) / 2
        center_z = (min_z + max_z) / 2

        cam_data.ortho_scale = height * 1.15
        dist = 10.0
        cam_obj.location = (center_x + dist * math.sin(yaw), center_y - dist * math.cos(yaw), center_z)

        scene.render.filepath = str(char_dir / f"{pose_name}.png")
        bpy.ops.render.render(write_still=True)

    print(f"Rendered all 6 poses for: {char_id}")

    # Remove character objects so scene stays clean for next fighter
    for o in list(scene.objects):
        if o not in [cam_obj, s1_obj, s2_obj, s3_obj]:
            bpy.data.objects.remove(o, do_unlink=True)

print("ALL_16_ROSTER_CHARACTERS_RENDERED_SUCCESSFULLY")
