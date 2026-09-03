"""Print world-space dimensions and vertical offset of GLB environment models."""

import argparse
from pathlib import Path
import sys

import bpy
from mathutils import Vector


def reset_scene() -> None:
    """Remove objects left by the previous inspected file."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def world_bounds():
    """Return bounds spanning every imported mesh in world coordinates."""
    corners = [
        obj.matrix_world @ Vector(corner)
        for obj in bpy.context.scene.objects
        if obj.type == "MESH"
        for corner in obj.bound_box
    ]
    if not corners:
        return None
    low = Vector((min(point.x for point in corners), min(point.y for point in corners), min(point.z for point in corners)))
    high = Vector((max(point.x for point in corners), max(point.y for point in corners), max(point.z for point in corners)))
    return low, high


def main() -> None:
    """Import every requested GLB and print its unscaled world bounds."""
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="+", type=Path)
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    options = parser.parse_args(arguments)
    for path in options.paths:
        reset_scene()
        bpy.ops.import_scene.gltf(filepath=str(path.resolve()))
        bounds = world_bounds()
        if not bounds:
            print(f"MODEL_DIMENSIONS {path.name}: no mesh")
            continue
        low, high = bounds
        size = high - low
        print(
            f"MODEL_DIMENSIONS {path.name}: "
            f"X={size.x:.4f}m Y={size.y:.4f}m Z={size.z:.4f}m "
            f"MIN_Z={low.z:.4f}m MAX_Z={high.z:.4f}m"
        )


if __name__ == "__main__":
    main()
