"""Reference-led tent prototypes with two detail levels, in metres; Blender 5, local.

Reuses the existing tent material/export pipeline. No generative service, network,
new runtime loader or renderer. These are original models, not branded replicas.
"""
import importlib.util
import argparse
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

SPEC = importlib.util.spec_from_file_location('tent_upgrade', Path(__file__).with_name('upgrade-tents.py'))
U = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(U)
OUT = U.SOURCE / 'festival'


def canvas(name, color, maps):
    mat = U.material(name, color)
    U.improve_material(mat, maps)
    y, x = np.mgrid[0:128, 0:128]
    weave = 0.97 + 0.018 * np.sin(x * math.tau / 8) * np.cos(y * math.tau / 8)
    pixels = np.ones((128, 128, 4))
    pixels[:, :, :3] = weave[:, :, None]
    image = U.image_data(name + '_WovenColor', pixels)
    node = U.texture_node(mat, image, 'TentDetail')
    mat.node_tree.links.new(node.outputs['Color'], mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    # Explicit glTF factor added at finalization: exporter otherwise bakes tint into the bitmap.
    mat['tentBaseColorLinear'] = list(color)
    if name in ('Fly_Ripstop', 'Lower_Colored_Fabric'):
        mat['tentFabricRole'] = 'fly' if name == 'Fly_Ripstop' else 'accent'
    return mat


def mesh(name, points, faces, material, smooth=False, density=5):
    obj = U.mesh_object(name, points, faces, material)
    U.cloth_detail_uv(obj, density)
    for face in obj.data.polygons:
        face.use_smooth = smooth
    return obj


def tube(name, points, radius, mat):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 1
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new('POLY')
    spline.points.add(len(points)-1)
    for target, source in zip(spline.points, points):
        target.co = (*source, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    curve.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    obj = bpy.context.object
    U.cloth_detail_uv(obj, 5)
    return obj


def quad(name, points, mat):
    return mesh(name, points, [(0, 1, 2, 3)], mat)


def guy(anchor, direction, materials, index):
    end = Vector(anchor) + Vector(direction)
    end.z = 0.012
    tube(f'Guyline_{index}', [anchor, tuple(end)], 0.0025, materials['cord'])
    tube(f'Peg_{index}', [tuple(end + Vector((0, 0, -0.04))), tuple(end),
                         tuple(end + Vector((0.03, 0, 0.015)))], 0.006, materials['peg'])
    tensioner = Vector(anchor).lerp(end, 0.82)
    tube(f'Tensioner_{index}', [tuple(tensioner), tuple(tensioner + Vector((0, 0, 0.035)))],
         0.009, materials['zip'])


def floor(outline, maps):
    U.groundsheet(outline, 0.018, 0.065, 5, maps)


def dome(materials, maps, vestibule=False):
    rx, ry, height = (1.22, 1.4, 1.62) if vestibule else (1.08, 1.3, 1.32)
    gap, cutoff = 0.68, 0.93

    def surface(angle, elevation, offset=0):
        a, b = math.cos(angle), math.sin(angle)
        square_x = math.copysign(abs(a)**0.72, a)
        square_y = math.copysign(abs(b)**0.72, b)
        tension = math.sin(elevation*2)**2
        folds = 0.004 * math.sin(angle*36 + elevation*11) * tension
        ring = math.cos(elevation)
        return ((rx*ring + folds + offset)*square_x,
                (ry*ring + folds + offset)*square_y,
                0.025 + height*math.sin(elevation) + folds + offset)

    def panel(name, a0, a1, p0, p1, mat, columns, rows):
        points = [surface(a0 + (a1-a0)*i/columns, p0+(p1-p0)*j/rows)
                  for j in range(rows+1) for i in range(columns+1)]
        faces = [(j*(columns+1)+i, j*(columns+1)+i+1,
                  (j+1)*(columns+1)+i+1, (j+1)*(columns+1)+i)
                 for j in range(rows) for i in range(columns)]
        mesh(name, points, faces, mat, True)

    front = -math.pi/2
    # Continuous sides/back with an accurately bounded opening (no jagged face deletion).
    panel('Fly_Sides_Back', front+gap, front+math.tau-gap, 0, math.pi/2-0.001,
          materials['fly'], 72, 22)
    panel('Fly_Above_Door', front-gap, front+gap, cutoff, math.pi/2-0.001,
          materials['fly'], 20, 10)
    door_edge = [surface(front-gap, cutoff*i/24, 0.008) for i in range(25)]
    door_edge += [surface(front-gap+2*gap*i/20, cutoff, 0.008) for i in range(1,21)]
    door_edge += [surface(front+gap, cutoff*(1-i/24), 0.008) for i in range(1,25)]
    tube('Door_Zipper_Binding', door_edge, 0.012, materials['zip'])
    for i, angle in enumerate((math.pi/4, math.pi*3/4)):
        path = [surface(angle, math.pi/2*t/36, 0.018) for t in range(37)]
        path += [surface(angle+math.pi, math.pi/2*(1-t/36), 0.018) for t in range(1,37)]
        tube(f'Crossed_Pole_{i}', path, 0.011, materials['pole'])
        for t in (6, 13, 23, 31, 43, 53, 63):
            p = Vector(path[t])
            tube(f'Pole_Clip_{i}_{t}', [tuple(p-Vector((0.015,0,0))), tuple(p+Vector((0.015,0,0)))],
                 0.01, materials['zip'])
    for i, angle in enumerate((0, math.pi/2, math.pi, math.pi*1.2)):
        path = [surface(angle, math.pi/2*t/30, 0.004) for t in range(31)]
        tube(f'Stitched_Seam_{i}', path, 0.0035, materials['binding'])
    # Inset the bathtub rim: coplanar fly/floor surfaces flicker at the hem.
    outline = [tuple(value * .977 for value in surface(math.tau*i/64, 0)[:2]) for i in range(64)]
    if not vestibule:
        floor(outline, maps)
        # Rolled-open door leaf follows the upper arch, leaving an unobstructed entrance.
        tube('Rolled_Door', [surface(front-gap+2*gap*i/24, cutoff, 0.02) for i in range(25)],
             0.035, materials['inner'])
    else:
        vestibule_canopy(materials, maps)
        floor([(-0.95,-1.75),(0.95,-1.75),(1.15,-0.6),(1.21,0),
               (0.93,1.12),(0,1.37),(-0.93,1.12),(-1.21,0),(-1.15,-0.6)], maps)
    # A rear inner liner makes the entrance readable without blocking the front opening.
    points = [(-rx*.66, ry*.55, .1), (rx*.66, ry*.55, .1),
              (rx*.46, ry*.55, height*.66), (0, ry*.55, height*.79),
              (-rx*.46, ry*.55, height*.66)]
    mesh('Rear_Inner_Liner', points, [(0,1,2,3,4)], materials['inner'])
    for i, angle in enumerate((math.pi*.2, math.pi*.8, math.pi*1.2, math.pi*1.8)):
        p = surface(angle, .16)
        guy(p, (math.cos(angle)*.7, math.sin(angle)*.7, 0), materials, i)


def vestibule_canopy(materials, maps):
    columns, rows = 40, 12

    def point(i, j, offset=0):
        theta, depth = math.pi*i/columns, j/rows
        width = 1.07 - 0.06*depth
        height = 1.44 + 0.1*depth
        fold = .003*math.sin(theta*24 + depth*17)*math.sin(theta)
        return ((width+offset)*math.cos(theta), -1.76+depth*.95,
                .035+(height+offset)*math.sin(theta)+fold)

    vertices = [point(i,j) for j in range(rows+1) for i in range(columns+1)]
    fabric_faces, window_faces = [], []
    for j in range(rows):
        for i in range(columns):
            face = (j*(columns+1)+i,j*(columns+1)+i+1,(j+1)*(columns+1)+i+1,(j+1)*(columns+1)+i)
            is_window = 3 <= j < 9 and (5 <= i < 11 or 29 <= i < 35)
            (window_faces if is_window else fabric_faces).append(face)
    mesh('Vestibule_Fly', vertices, fabric_faces, materials['accent'], True)
    net = mesh('Vestibule_Mosquito_Windows', vertices, window_faces, materials['net'], True, 80)
    net['tentPart'] = 'window-mesh'
    tube('Vestibule_Front_Pole', [point(i,0,.014) for i in range(columns+1)], .014, materials['pole'])
    tube('Vestibule_Front_Binding', [point(i,0,.005) for i in range(columns+1)], .024, materials['accent'])
    for lo, hi in ((5,11),(29,35)):
        border = [point(i,3,.005) for i in range(lo,hi+1)]
        border += [point(hi,j,.005) for j in range(4,10)]
        border += [point(i,9,.005) for i in range(hi-1,lo-1,-1)]
        border += [point(lo,j,.005) for j in range(8,2,-1)]
        tube(f'Vestibule_Window_Binding_{lo}', border, .012, materials['binding'])


def shelter(materials, maps):
    half, roof_half, shoulder, top = 1.5, 1.25, 1.82, 2.32

    def wall(side, u, z):
        radius = half + (roof_half-half)*z/shoulder
        p = Vector((u*radius, -radius, z))
        a = side*math.pi/2
        return (p.x*math.cos(a)-p.y*math.sin(a), p.x*math.sin(a)+p.y*math.cos(a), p.z)

    for side in range(4):
        # Fabric skirts; open front has only two jambs, not a solid threshold wall.
        if side != 0:
            quad(f'Lower_Skirt_{side}', [wall(side,-1,.04),wall(side,1,.04),
                 wall(side,1,.6),wall(side,-1,.6)], materials['accent'])
        for sign in (-1,1):
            edge, inside = sign, sign*.69
            quad(f'Corner_Panel_{side}_{sign}', [wall(side,edge,.04),wall(side,inside,.04),
                 wall(side,inside,shoulder),wall(side,edge,shoulder)], materials['fly'])
        if side != 0:
            quad(f'Window_Lower_Binding_{side}', [wall(side,-.69,.6),wall(side,.69,.6),
                 wall(side,.69,.78),wall(side,-.69,.78)], materials['fly'])
            window = quad(f'Shelter_Window_{side}', [wall(side,-.69,.78),wall(side,.69,.78),
                          wall(side,.69,1.60),wall(side,-.69,1.60)], materials['net'])
            U.cloth_detail_uv(window, 80)
            window['tentPart'] = 'window-mesh'
        quad(f'Header_{side}', [wall(side,-.69,1.60 if side else 1.74),
             wall(side,.69,1.60 if side else 1.74),wall(side,.69,shoulder),wall(side,-.69,shoulder)],materials['fly'])
        if side:
            tube(f'Rolled_Window_Cover_{side}', [wall(side,-.69,1.66),wall(side,.69,1.66)], .035, materials['fly'])
        else:
            path = [wall(0,-.69,.04),wall(0,-.69,1.72),wall(0,.69,1.72),wall(0,.69,.04)]
            tube('Shelter_Door_Zipper', path, .012, materials['zip'])
            tube('Shelter_Rolled_Door', [wall(0,-.66,1.74),wall(0,.66,1.74)], .055, materials['fly'])

    def roof(x,y):
        return shoulder + (top-shoulder)*math.cos(x/roof_half*math.pi/2)*math.cos(y/roof_half*math.pi/2)

    steps=24
    vertices=[(x,y,roof(x,y)) for y in np.linspace(-roof_half,roof_half,steps+1)
              for x in np.linspace(-roof_half,roof_half,steps+1)]
    faces=[(j*(steps+1)+i,j*(steps+1)+i+1,(j+1)*(steps+1)+i+1,(j+1)*(steps+1)+i)
           for j in range(steps) for i in range(steps)]
    mesh('Shelter_Roof', vertices, faces, materials['fly'], True)
    for diagonal in (-1,1):
        p=[(-half,-half*diagonal,.035),(-1.42,-1.42*diagonal,.55),
           (-1.32,-1.32*diagonal,1.25)]
        p += [(x,x*diagonal,roof(x,x*diagonal)+.025) for x in np.linspace(-roof_half,roof_half,49)]
        p += [(1.32,1.32*diagonal,1.25),(1.42,1.42*diagonal,.55),(half,half*diagonal,.035)]
        tube(f'Shelter_Cross_Pole_{diagonal}', p, .016, materials['pole'])
    floor([(-1.44,-1.44),(1.44,-1.44),(1.44,1.44),(-1.44,1.44)],maps)
    for i,(x,y) in enumerate(((-1,-1),(1,-1),(1,1),(-1,1))):
        guy((x*1.36,y*1.36,1.0),(x*.65,y*.65,0),materials,i)


def family_tunnel(materials, maps):
    """Original family tunnel inspired by the white/beige reference, not a product scan."""
    arches = [(-2.3, 1.65, 2.16), (-.85, 1.65, 2.20), (.7, 1.60, 2.10), (2.1, 1.50, 1.94)]
    columns, rows = 48, 18

    def cross(theta, y, width, height, offset=0):
        cosine = math.cos(theta)
        return ((width+offset)*math.copysign(abs(cosine)**.8, cosine), y,
                .035+(height+offset)*math.sin(theta)**.65)

    for section, (start, end) in enumerate(zip(arches, arches[1:])):
        def point(i, j, offset=0):
            t, theta = j/rows, math.pi*i/columns
            y, width, height = [a+(b-a)*t for a,b in zip(start,end)]
            # Tension sag between arches and shallow wrinkles in the lower fabric.
            sag = .045*math.sin(math.pi*t)**2
            fold = .009*math.sin(theta*30 + t*11)*math.sin(math.pi*t)**2
            p = cross(theta,y,width,height,offset)
            return (p[0] + fold*math.cos(theta),p[1],p[2]-sag*math.sin(theta)+fold*.25)
        vertices = [point(i,j) for j in range(rows+1) for i in range(columns+1)]
        faces = {'fly':[], 'accent':[], 'window':[]}
        for j in range(rows):
            for i in range(columns):
                face=(j*(columns+1)+i,j*(columns+1)+i+1,(j+1)*(columns+1)+i+1,(j+1)*(columns+1)+i)
                window = section == 0 and 3 <= j < 15 and (4 <= i < 11 or 37 <= i < 44)
                key = 'window' if window else ('accent' if i < 3 or i >= 45 else 'fly')
                faces[key].append(face)
        for key, indices in faces.items():
            if indices:
                obj=mesh(f'Tunnel_{section}_{key}',vertices,indices,materials[key],True)
                if key == 'window':
                    obj['tentPart']='side-window'
        if section == 0:
            for lo,hi in ((4,11),(37,44)):
                path=[point(i,3,.008) for i in range(lo,hi+1)]
                path += [point(hi,j,.008) for j in range(4,16)]
                path += [point(i,15,.008) for i in range(hi-1,lo-1,-1)]
                path += [point(lo,j,.008) for j in range(14,2,-1)]
                tube(f'Tunnel_Window_Binding_{lo}',path,.016,materials['accent'])
                top_index=hi if lo < columns/2 else lo
                tube(f'Tunnel_Rolled_Window_{lo}',[point(top_index,j,.035) for j in range(3,16)],.045,materials['fly'])

    for index,(y,width,height) in enumerate(arches):
        path=[cross(math.pi*i/64,y,width,height,.035) for i in range(65)]
        tube(f'Tunnel_Air_Arch_{index}',path,.045,materials['fly'])
        tube(f'Tunnel_Arch_Seam_{index}',[cross(math.pi*i/64,y-.046,width,height,.038) for i in range(65)],.006,materials['binding'])
        for side in (-1,1):
            theta=math.pi*.17 if side == 1 else math.pi*.83
            anchor=cross(theta,y,width,height,.05)
            direction=(side*.92, -.3 if index < 2 else .3,0)
            guy(anchor,direction,materials,index*2+(side+1)//2)
            end=Vector(anchor)+Vector(direction)
            end.z=.012
            junction=Vector(anchor).lerp(end,.3)
            upper=cross(math.pi*.26 if side == 1 else math.pi*.74,y,width,height,.05)
            tube(f'Tunnel_Y_Tie_{index}_{side}',[upper,tuple(junction)],.0025,materials['cord'])

    # Concave front panel wraps around an actual rectangular doorway.
    y,width,height=arches[0]
    points=[(-.75,y-.01,.035)]
    points += [cross(math.pi*(1-i/48),y-.01,width,height) for i in range(49)]
    points += [(.75,y-.01,.035),(.75,y-.01,1.72),(-.75,y-.01,1.72)]
    mesh('Tunnel_Front_Door_Panel',points,[tuple(range(len(points)))],materials['accent'])
    tube('Tunnel_Front_Zipper',[(-.75,y-.025,.04),(-.75,y-.025,1.72),(.75,y-.025,1.72),(.75,y-.025,.04)],.012,materials['zip'])
    tube('Tunnel_Rolled_Door',[(-.71,y-.03,1.78),(.71,y-.03,1.78)],.06,materials['fly'])

    # Rear arched mosquito window with a solid, beige lower panel.
    y,width,height=arches[-1]
    outer=[cross(math.pi*i/48,y+.01,width,height) for i in range(49)]
    inner=[(1.12*math.cos(math.pi*i/48),y+.01,.68+1.02*math.sin(math.pi*i/48)) for i in range(49)]
    count=len(outer)
    faces=[(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    mesh('Tunnel_Rear_Window_Surround',outer+inner,faces,materials['accent'])
    mesh('Tunnel_Rear_Mosquito',inner,[tuple(range(count))],materials['net'],density=80)
    tube('Tunnel_Rear_Window_Binding',inner+[inner[0]],.018,materials['binding'])
    floor([(-1.60,-2.27),(1.60,-2.27),(1.60,-.85),(1.55,.7),(1.45,2.06),
           (-1.45,2.06),(-1.55,.7),(-1.60,-.85)],maps)


def batch_by_material():
    """Keep the floor independently testable; batch other static parts by material."""
    groups = {}
    for obj in list(bpy.context.scene.objects):
        if obj.type != 'MESH' or obj.get('tentPart') == 'groundsheet':
            continue
        mat = obj.data.materials[0]
        groups.setdefault(mat.name, []).append(obj)
    for name, objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        if len(objects) > 1:
            bpy.ops.object.join()
        bpy.context.object.name = 'Batched_' + name


def add_detail_levels(root):
    """Package shared-material high/low groups; runtime chooses one with THREE.LOD."""
    high=bpy.data.objects.new('Tent_LOD0',None)
    low=bpy.data.objects.new('Tent_LOD1',None)
    for level,obj in enumerate((high,low)):
        bpy.context.collection.objects.link(obj)
        obj.parent=root
        obj['tentLodLevel']=level
    originals=[obj for obj in list(root.children) if obj.type == 'MESH']
    for obj in originals:
        obj.parent=high
        mat=obj.data.materials[0]
        # Sub-pixel cords, metal pegs, clips and narrow bindings disappear at distance.
        if mat.name in ('Guy_Cord','Aluminium_Pegs','Zipper_and_Clips','Seam_Binding'):
            continue
        reduced=obj.copy()
        reduced.data=obj.data.copy()
        reduced.name=obj.name+'_LOD1'
        bpy.context.collection.objects.link(reduced)
        reduced.parent=low
        if len(reduced.data.polygons) > 100:
            bpy.ops.object.select_all(action='DESELECT')
            reduced.select_set(True)
            bpy.context.view_layer.objects.active=reduced
            modifier=reduced.modifiers.new('Distance_Reduction','DECIMATE')
            modifier.ratio=.18
            modifier.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=modifier.name)


def build(kind):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    maps=U.weave_maps()
    is_shelter=kind=='baseShelter'
    is_vestibule=kind=='domeVestibule'
    is_tunnel=kind=='familyTunnel'
    materials={
        'fly':canvas('Fly_Ripstop', (.65,.68,.68) if (is_shelter or is_vestibule or is_tunnel) else (.26,.28,.27),maps),
        'accent':canvas('Lower_Colored_Fabric', (.56,.47,.34) if is_tunnel else ((.025,.14,.18) if is_vestibule else (.025,.075,.105)),maps),
        'inner':canvas('Inner_Liner', (.07,.085,.085),maps),
        'binding':canvas('Seam_Binding',(.17,.19,.18),maps),
        'zip':U.material('Zipper_and_Clips',(.36,.045,.025) if is_shelter else (.03,.045,.045)),
        'pole':U.material('Fibreglass_Poles',(.065,.08,.08),.5),
        'peg':U.material('Aluminium_Pegs',(.3,.32,.33),.4),
        'cord':U.material('Guy_Cord',(.45,.055,.035) if is_tunnel else (.55,.58,.53)),
        'net':U.mosquito_material(),
    }
    if is_tunnel:
        window=U.material('Tunnel_Window_PVC',(.32,.38,.38),.44)
        window.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value=.62
        window.surface_render_method='DITHERED'
        materials['window']=window
        family_tunnel(materials,maps)
    elif is_shelter:
        shelter(materials,maps)
    else:
        dome(materials,maps,is_vestibule)
    batch_by_material()
    root=bpy.data.objects.new(kind,None)
    bpy.context.collection.objects.link(root)
    for obj in list(bpy.context.scene.objects):
        if obj != root and obj.parent is None:
            obj.parent=root
    root['festivalTentPrototype']=kind
    root['units']='metres'
    root['reference']='User-provided tent product comparison; original unbranded interpretation'
    add_detail_levels(root)
    OUT.mkdir(parents=True,exist_ok=True)
    path=OUT/f'{kind}.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_extras=True,
                              export_animations=False,export_yup=True)
    U.finalize_gltf(path)
    print('FESTIVAL_TENT',kind,path.stat().st_size)


if __name__ == '__main__':
    kinds=('trekkingDome','baseShelter','domeVestibule','familyTunnel')
    parser=argparse.ArgumentParser()
    parser.add_argument('--only',nargs='+',choices=kinds)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    for kind in args.only or kinds:
        build(kind)
