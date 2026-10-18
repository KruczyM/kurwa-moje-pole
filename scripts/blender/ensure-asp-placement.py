"""Add the existing ASP asset when absent from the saved layout; never save the blend."""
import math
import bpy
from mathutils import Vector


def ensure_asp(root):
    existing = next((o for o in bpy.context.scene.objects if o.get('placement_id') == 'smallStage'), None)
    if existing:
        return existing
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.import_scene.gltf(filepath=str(root / 'public/game-assets/world/festival/small_stage.glb'))
    imported = list(bpy.context.selected_objects)
    meshes = [o for o in imported if o.type == 'MESH']
    assert meshes, 'ASP model has no geometry'
    bpy.context.view_layer.update()
    points = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    low = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    high = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    size = high - low
    # Blender XY is the ground plane; exported world Z = -Blender Y.
    scale = min(38 / size.x, 54 / size.y, 19 / size.z)
    center = Vector(((low.x + high.x)/2, (low.y + high.y)/2, low.z))
    parent = bpy.data.objects.new('smallStage', None)
    stages = bpy.data.collections.get('Stages')
    if stages is None:
        stages = bpy.data.collections.new('Stages')
        bpy.context.scene.collection.children.link(stages)
    stages.objects.link(parent)
    parent['placement_id'] = 'smallStage'
    for obj in imported:
        if obj.parent not in imported:
            matrix = obj.matrix_world.copy()
            obj.parent = parent
            obj.matrix_world = matrix
    for obj in parent.children:
        obj.location -= center
    parent.scale = (scale, scale, scale)
    parent.rotation_euler.z = -math.pi / 2
    # Flat southern grounds; same clearance as the existing stage placement.
    parent.location = (-65, -97, 0.025)
    bpy.context.view_layer.update()
    return parent
