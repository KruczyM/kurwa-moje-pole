import sys
from pathlib import Path
import bpy
from mathutils import Vector

def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    output_path = argv[0] if argv else "new_characters_showcase.png"

    # Clear scene
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    root = Path(__file__).resolve().parents[2]
    chars = [
        ("hemoroid", -1.6),
        ("zawor", 0.0),
        ("korba", 1.6),
    ]

    for name, x_offset in chars:
        model_path = root / f"public/game-assets/characters/{name}/npc-animations.glb"
        bpy.ops.import_scene.gltf(filepath=str(model_path))
        # Find newly imported root/armature/meshes
        # Move them by x_offset
        for obj in bpy.context.selected_objects:
            if obj.parent is None:
                obj.location.x += x_offset

    # Lighting
    world = bpy.context.scene.world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.08, 0.09, 0.12, 1.0)
        bg.inputs["Strength"].default_value = 1.0

    # Key light
    bpy.ops.object.light_add(type="SUN", location=(3, -5, 6))
    sun = bpy.context.object
    sun.data.energy = 4.0
    sun.rotation_euler = (0.7, 0.2, 0.4)

    # Fill light
    bpy.ops.object.light_add(type="SUN", location=(-4, -3, 4))
    fill = bpy.context.object
    fill.data.energy = 2.0
    fill.rotation_euler = (0.8, -0.4, -0.6)

    # Rim light
    bpy.ops.object.light_add(type="SUN", location=(0, 6, 4))
    rim = bpy.context.object
    rim.data.energy = 2.5
    rim.rotation_euler = (-0.8, 0, 3.14)

    # Camera
    bpy.ops.object.camera_add(location=(0, -8.2, 1.35))
    cam = bpy.context.object
    cam.data.lens = 42
    bpy.context.scene.camera = cam

    target = Vector((0, 0, 1.22))
    direction = target - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

    # Render settings
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.filepath = str(output_path)
    bpy.ops.render.render(write_still=True)
    print(f"Rendered showcase to {output_path}")

if __name__ == "__main__":
    main()
