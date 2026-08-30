"""Create a conservative, opaque FBX upload package for Mixamo.

Run with Blender:
  blender --background --factory-startup --python export-mixamo-upload.py -- \
    --input character.glb --texture character_basecolor.jpg --output character.fbx

The script deliberately uses one simple material. Mixamo only needs the mesh,
UVs and base-colour texture while it creates the rig. Procedural nodes, normal
maps and alpha modes are removed because Mixamo's importer handles them
inconsistently.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import bpy


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--texture", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args(argv)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.materials, bpy.data.images, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            datablocks.remove(datablock)


def make_opaque_material(texture_path: Path) -> bpy.types.Material:
    material = bpy.data.materials.new("character_material")
    material.use_nodes = True
    material.diffuse_color = (1.0, 1.0, 1.0, 1.0)
    material.surface_render_method = "DITHERED"

    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = bpy.data.images.load(str(texture_path), check_existing=False)
    texture.image.name = "character_basecolor.jpg"
    texture.interpolation = "Linear"

    shader.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    shader.inputs["Metallic"].default_value = 0.0
    shader.inputs["Roughness"].default_value = 0.65
    shader.inputs["Alpha"].default_value = 1.0
    material.node_tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])
    material.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material


def main() -> None:
    args = parse_args()
    input_path = args.input.resolve()
    texture_path = args.texture.resolve()
    output_path = args.output.resolve()
    if not input_path.is_file():
        raise FileNotFoundError(input_path)
    if not texture_path.is_file():
        raise FileNotFoundError(texture_path)

    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(input_path))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("The input contains no mesh")

    material = make_opaque_material(texture_path)
    for index, mesh in enumerate(meshes):
        mesh.name = "character" if index == 0 else f"character_{index + 1}"
        mesh.data.name = f"{mesh.name}_mesh"
        mesh.data.materials.clear()
        mesh.data.materials.append(material)
        for polygon in mesh.data.polygons:
            polygon.material_index = 0

    bpy.ops.object.select_all(action="DESELECT")
    for mesh in meshes:
        mesh.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]

    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.fbx(
        filepath=str(output_path),
        use_selection=True,
        object_types={"MESH"},
        apply_unit_scale=True,
        apply_scale_options="FBX_SCALE_NONE",
        axis_forward="-Z",
        axis_up="Y",
        path_mode="COPY",
        embed_textures=True,
        add_leaf_bones=False,
        bake_anim=False,
    )
    print(f"MIXAMO_EXPORT_OK meshes={len(meshes)} output={output_path}")


if __name__ == "__main__":
    main()
