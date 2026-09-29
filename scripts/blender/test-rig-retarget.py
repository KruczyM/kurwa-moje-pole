"""Deterministic regression for differently oriented armatures (run in Blender)."""
import importlib.util
import math
from pathlib import Path

import bpy
from mathutils import Matrix

spec = importlib.util.spec_from_file_location('builder', Path(__file__).with_name('build-character-animation-library.py'))
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)
api.reset()


def rig(name, y_up):
    data = bpy.data.armatures.new(name)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    root = data.edit_bones.new('Hips')
    root.head = (0, 0, 0)
    root.tail = (0, 1, 0) if y_up else (0, 0, 1)
    child = data.edit_bones.new('Spine')
    child.head = root.tail
    child.tail = (0, 200, 0) if y_up else (0, 0, 3)
    child.parent = root
    bpy.ops.object.mode_set(mode='OBJECT')
    if y_up:
        obj.matrix_world = Matrix.Rotation(math.pi / 2, 4, 'X')
    return obj


source, target = rig('source', True), rig('target', False)
assert abs(api.skeleton_span(source) - api.skeleton_span(target)) < 1e-6, 'Invented bone tails must not change root-motion scale'
root = source.pose.bones['Hips']
root.rotation_mode = 'XYZ'
root.rotation_euler = (0, 0, 0)
root.keyframe_insert('rotation_euler', frame=1)
root.rotation_euler = (0, .7, 0)
root.keyframe_insert('rotation_euler', frame=2)
source_action = source.animation_data.action
result = api.retarget_action(source, source_action, target, 'Test')
source.animation_data.action = source_action
target.animation_data.action = result
bpy.context.scene.frame_set(2)
bpy.context.view_layer.update()
for name in ['Hips', 'Spine']:
    def delta(obj):
        pose = (obj.matrix_world @ obj.pose.bones[name].matrix).to_quaternion()
        rest = (obj.matrix_world @ obj.data.bones[name].matrix_local).to_quaternion()
        return pose @ rest.inverted()
    assert delta(source).rotation_difference(delta(target)).angle < 1e-4, f'{name}: armature basis mismatch'
print('RIG_RETARGET_TESTS_OK: world rotations and joint-based root scale')
