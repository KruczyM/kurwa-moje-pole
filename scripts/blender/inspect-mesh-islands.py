"""Read-only connected-component diagnostic for multi-view generated GLBs."""
import sys
import json
import bpy
import bmesh

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=sys.argv[sys.argv.index('--') + 1])
for mesh in [o for o in bpy.data.objects if o.type == 'MESH']:
    bm = bmesh.new()
    bm.from_mesh(mesh.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-5)
    unseen = set(bm.verts)
    groups = []
    while unseen:
        seed = unseen.pop()
        component, stack = [seed], [seed]
        while stack:
            vertex = stack.pop()
            for edge in vertex.link_edges:
                neighbor = edge.other_vert(vertex)
                if neighbor in unseen:
                    unseen.remove(neighbor)
                    component.append(neighbor)
                    stack.append(neighbor)
        if len(component) > 100:
            groups.append({'count': len(component), 'min': [min(v.co[i] for v in component) for i in range(3)],
                           'max': [max(v.co[i] for v in component) for i in range(3)]})
    print(json.dumps(sorted(groups, key=lambda g: -g['count'])[:20]))
    bm.free()
