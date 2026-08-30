"""Render front/side contact frames for quick deformation review of a GLB."""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--clips", nargs="+", default=["Idle", "Walk", "Run"])
    return parser.parse_args(argv)


def look_at(camera: bpy.types.Object, target: Vector) -> None:
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


def bounds(meshes: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = []
    for obj in meshes:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        points.extend(evaluated.matrix_world @ vertex.co for vertex in mesh.vertices)
        evaluated.to_mesh_clear()
    return (
        Vector(tuple(min(point[i] for point in points) for i in range(3))),
        Vector(tuple(max(point[i] for point in points) for i in range(3))),
    )


def main() -> None:
    options = args()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(options.model.resolve()))
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if len(armatures) != 1:
        raise RuntimeError(f"Expected one armature, found {len(armatures)}")
    armature = armatures[0]
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and obj.parent == armature]
    if not meshes:
        raise RuntimeError("No skinned mesh found")

    for obj in bpy.context.scene.objects:
        if obj not in meshes and obj != armature:
            obj.hide_render = True

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 420
    scene.render.resolution_y = 560
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world.color = (0.025, 0.025, 0.035)

    camera_data = bpy.data.cameras.new("AuditCamera")
    camera_data.type = "ORTHO"
    camera = bpy.data.objects.new("AuditCamera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera

    for location, energy, size in [((-3, -4, 6), 900, 5), ((4, -2, 3), 500, 4)]:
        light_data = bpy.data.lights.new("AuditLight", "AREA")
        light_data.energy = energy
        light_data.shape = "DISK"
        light_data.size = size
        light = bpy.data.objects.new("AuditLight", light_data)
        light.location = location
        scene.collection.objects.link(light)

    animation_data = armature.animation_data_create()
    animation_data.use_nla = False
    output = options.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    for clip in options.clips:
        action = bpy.data.actions.get(clip)
        if action is None:
            raise RuntimeError(f"Missing action: {clip}")
        animation_data.action = action
        start, end = action.frame_range
        sample_frames = sorted({math.ceil(start), round((start + end) / 2), math.floor(end - 1)})
        for sample_number, frame in enumerate(sample_frames, start=1):
            scene.frame_set(frame)
            low, high = bounds(meshes)
            center = (low + high) / 2
            dimensions = high - low
            scale = max(dimensions.x, dimensions.z) * 1.25
            distance = max(dimensions.length * 2.2, 2.0)
            for view, location in {
                "front": Vector((center.x, center.y - distance, center.z)),
                "side": Vector((center.x + distance, center.y, center.z)),
            }.items():
                camera.location = location
                camera_data.ortho_scale = scale
                look_at(camera, center)
                scene.render.filepath = str(output / f"{clip.lower()}-{sample_number}-{view}.png")
                bpy.ops.render.render(write_still=True)
    print(f"ANIMATION_AUDIT_OK output={output}")


if __name__ == "__main__":
    main()
