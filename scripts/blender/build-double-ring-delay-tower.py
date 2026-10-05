"""
Procedural 3D Generator for the Official Pol'and'Rock Festival Heavy Double-Ring PA Delay Tower
Based directly on user-uploaded photo from Pol'and'Rock Festival:
- Total height: ~27 meters
- Monumental double-tier circular lighting rig:
  - Lower Ring (Diameter 5.6m) at Z ~ 18.0m with 16 Matrix Blinders on top & 16 Robe Pointes underneath
  - Upper Ring (Diameter 4.4m) at Z ~ 23.5m with 12 Matrix Blinders on top & 12 Robe Pointes underneath
  - Top Cross-Bridge Truss inside upper ring with 4 high-output center blinders/strobes
- Heavy square box-truss mast (0.9m x 0.9m x 27.0m) with 4 main chords, 26 bays, climber ladder, and cable loom
- High-tension diagonal guy cables (odciągi linowe) running from Z ~ 20m down to ground outrigger anchors
- Top cantilever outrigger beam with 2x 2-tonne chain hoists and long hoist cables
- Extended 13-enclosure L-Acoustics K1/K2 Line Array cluster (Z = 8.5m to 16.5m) in authentic progressive J-Curve
- Heavy steel base (6.0m x 6.0m) with 4 concrete ballast blocks, diagonal kickers, black scrim, flight cases, 400V distro, and Mojo crowd barriers
- Exports both GLB runtime asset and .blend authoring file
- Renders 5 high-resolution preview shots perfectly framed
"""

import os
import sys
import math
from pathlib import Path
import bpy
from mathutils import Vector, Euler

def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for col in list(bpy.data.collections):
        bpy.data.collections.remove(col, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh, do_unlink=True)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat, do_unlink=True)
    for img in list(bpy.data.images):
        bpy.data.images.remove(img, do_unlink=True)
    for cam in list(bpy.data.cameras):
        bpy.data.cameras.remove(cam, do_unlink=True)
    for light in list(bpy.data.lights):
        bpy.data.lights.remove(light, do_unlink=True)

def get_or_create_collection(name, parent_col=None):
    if name in bpy.data.collections:
        return bpy.data.collections[name]
    col = bpy.data.collections.new(name)
    if parent_col:
        parent_col.children.link(col)
    else:
        bpy.context.scene.collection.children.link(col)
    return col

def make_pbr_material(name, base_color=(0.8, 0.8, 0.8, 1.0), roughness=0.5, metallic=0.0,
                       emission_color=(0, 0, 0, 1.0), emission_strength=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new(type='ShaderNodeOutputMaterial')
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = base_color
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic

    if emission_strength > 0:
        bsdf.inputs['Emission Color'].default_value = emission_color
        bsdf.inputs['Emission Strength'].default_value = emission_strength

    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    return mat

def create_mesh(name, vertices, faces, material=None, collection=None, smooth=False):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()

    if smooth:
        for p in mesh.polygons:
            p.use_smooth = True

    obj = bpy.data.objects.new(name, mesh)
    target_col = collection if collection else bpy.context.scene.collection
    target_col.objects.link(obj)
    if material:
        obj.data.materials.append(material)
    return obj

def build_box(name, center, size, material=None, rot_x=0.0, rot_y=0.0, rot_z=0.0, collection=None):
    cx, cy, cz = center
    sx, sy, sz = size
    hx, hy, hz = sx / 2.0, sy / 2.0, sz / 2.0

    raw_verts = [
        (-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz),
        (-hx, -hy, hz),  (hx, -hy, hz),  (hx, hy, hz),  (-hx, hy, hz)
    ]

    rot_verts = []
    for vx, vy, vz in raw_verts:
        if rot_x != 0:
            c, s = math.cos(rot_x), math.sin(rot_x)
            vy, vz = vy * c - vz * s, vy * s + vz * c
        if rot_y != 0:
            c, s = math.cos(rot_y), math.sin(rot_y)
            vx, vz = vx * c + vz * s, -vx * s + vz * c
        if rot_z != 0:
            c, s = math.cos(rot_z), math.sin(rot_z)
            vx, vy = vx * c - vy * s, vx * s + vy * c
        rot_verts.append((cx + vx, cy + vy, cz + vz))

    faces = [
        (0, 3, 2, 1), (4, 5, 6, 7),
        (0, 1, 5, 4), (2, 3, 7, 6),
        (0, 4, 7, 3), (1, 2, 6, 5)
    ]
    return create_mesh(name, rot_verts, faces, material, collection=collection, smooth=False)

def build_cylinder(name, center, radius, height, segments=12, material=None, rot_x=0.0, rot_y=0.0, rot_z=0.0, collection=None, smooth=True):
    cx, cy, cz = center
    hz = height / 2.0
    raw_verts = []
    for i in range(segments):
        a = (i / segments) * 2 * math.pi
        raw_verts.append((math.cos(a) * radius, math.sin(a) * radius, -hz))
    for i in range(segments):
        a = (i / segments) * 2 * math.pi
        raw_verts.append((math.cos(a) * radius, math.sin(a) * radius, hz))

    rot_verts = []
    for vx, vy, vz in raw_verts:
        if rot_x != 0:
            c, s = math.cos(rot_x), math.sin(rot_x)
            vy, vz = vy * c - vz * s, vy * s + vz * c
        if rot_y != 0:
            c, s = math.cos(rot_y), math.sin(rot_y)
            vx, vz = vx * c + vz * s, -vx * s + vz * c
        if rot_z != 0:
            c, s = math.cos(rot_z), math.sin(rot_z)
            vx, vy = vx * c - vy * s, vx * s + vy * c
        rot_verts.append((cx + vx, cy + vy, cz + vz))

    faces = []
    for i in range(segments):
        next_i = (i + 1) % segments
        faces.append((i, next_i, segments + next_i, segments + i))
    faces.append(list(range(segments - 1, -1, -1)))
    faces.append(list(range(segments, segments * 2)))
    return create_mesh(name, rot_verts, faces, material, collection=collection, smooth=smooth)

def build_tube_between(name, p1, p2, radius, material=None, segments=8, collection=None, smooth=True):
    dx, dy, dz = p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]
    length = math.sqrt(dx*dx + dy*dy + dz*dz)
    if length < 0.0001:
        return None
    mid = ((p1[0] + p2[0]) / 2.0, (p1[1] + p2[1]) / 2.0, (p1[2] + p2[2]) / 2.0)

    rot_y = math.atan2(dx, dz)
    rot_x = math.atan2(-dy, math.sqrt(dx*dx + dz*dz))
    return build_cylinder(name, mid, radius, length, segments=segments, material=material,
                          rot_x=rot_x, rot_y=rot_y, collection=collection, smooth=smooth)

def generate_heavy_double_ring_tower():
    clear_scene()

    # Collections
    col_base = get_or_create_collection('01_Base_And_Ballast')
    col_mast = get_or_create_collection('02_Mast_Truss')
    col_cantilever = get_or_create_collection('03_Cantilever_Hoists')
    col_k2 = get_or_create_collection('04_K2_Line_Array')
    col_ring_lower = get_or_create_collection('05_Lower_Lighting_Ring_5.6m')
    col_ring_upper = get_or_create_collection('06_Upper_Lighting_Ring_4.4m')
    col_gear = get_or_create_collection('07_Ground_Gear')

    # Materials
    mat_truss = make_pbr_material('Mat_PA_AluTruss', base_color=(0.82, 0.84, 0.88, 1.0), roughness=0.35, metallic=0.90)
    mat_dark_steel = make_pbr_material('Mat_PA_SteelBase', base_color=(0.18, 0.19, 0.22, 1.0), roughness=0.55, metallic=0.75)
    mat_concrete = make_pbr_material('Mat_PA_BallastConcrete', base_color=(0.60, 0.59, 0.56, 1.0), roughness=0.92)
    mat_scrim = make_pbr_material('Mat_PA_BaseScrim', base_color=(0.08, 0.08, 0.09, 1.0), roughness=0.85)
    mat_speaker_body = make_pbr_material('Mat_PA_K2_Speaker', base_color=(0.10, 0.10, 0.12, 1.0), roughness=0.6, metallic=0.15)
    mat_speaker_grille = make_pbr_material('Mat_PA_K2_Grille', base_color=(0.04, 0.04, 0.05, 1.0), roughness=0.8, metallic=0.45)
    mat_rigging_pins = make_pbr_material('Mat_PA_RiggingHardware', base_color=(0.85, 0.86, 0.88, 1.0), roughness=0.25, metallic=0.95)
    mat_cable = make_pbr_material('Mat_PA_HeavyCable', base_color=(0.03, 0.03, 0.04, 1.0), roughness=0.9)
    mat_guy_wire = make_pbr_material('Mat_PA_GuyWire', base_color=(0.75, 0.76, 0.80, 1.0), roughness=0.2, metallic=0.95)
    mat_moving_head = make_pbr_material('Mat_PA_RobePointe', base_color=(0.12, 0.12, 0.14, 1.0), roughness=0.4, metallic=0.5)
    mat_lens_emissive = make_pbr_material('Mat_PA_HeadLens', base_color=(0.8, 0.95, 1.0, 1.0), roughness=0.1,
                                          emission_color=(0.2, 0.75, 1.0, 1.0), emission_strength=16.0)
    mat_blinder_emissive = make_pbr_material('Mat_PA_BlinderFace', base_color=(1.0, 0.92, 0.8, 1.0), roughness=0.2,
                                             emission_color=(1.0, 0.85, 0.55, 1.0), emission_strength=18.0)
    mat_strobe_emissive = make_pbr_material('Mat_PA_StrobeFace', base_color=(1.0, 1.0, 1.0, 1.0), roughness=0.1,
                                            emission_color=(0.95, 0.98, 1.0, 1.0), emission_strength=25.0)
    mat_barrier = make_pbr_material('Mat_PA_MojoBarrier', base_color=(0.20, 0.22, 0.24, 1.0), roughness=0.5, metallic=0.85)

    # =========================================================================
    # 1. HEAVY BASE WITH BALLAST & GUY WIRE ANCHORS (6.0m x 6.0m)
    # =========================================================================
    base_spread = 6.0
    beam_h = 0.38
    beam_w = 0.30
    half_s = base_spread / 2.0

    # Heavy steel H-beam cross
    build_box('Base_Beam_X', (0, 0, 0.20), (base_spread, beam_w, beam_h), mat_dark_steel, collection=col_base)
    build_box('Base_Beam_Y', (0, 0, 0.20), (beam_w, base_spread, beam_h), mat_dark_steel, collection=col_base)

    # Outer perimeter frame
    build_box('Base_Outer_N', (0, half_s - 0.2, 0.20), (base_spread - 0.4, 0.22, beam_h), mat_dark_steel, collection=col_base)
    build_box('Base_Outer_S', (0, -half_s + 0.2, 0.20), (base_spread - 0.4, 0.22, beam_h), mat_dark_steel, collection=col_base)
    build_box('Base_Outer_E', (half_s - 0.2, 0, 0.20), (0.22, base_spread - 0.4, beam_h), mat_dark_steel, collection=col_base)
    build_box('Base_Outer_W', (-half_s + 0.2, 0, 0.20), (0.22, base_spread - 0.4, beam_h), mat_dark_steel, collection=col_base)

    # 4 Heavy Screw Jack Feet & Ground Spreader Plates
    for fx in [-half_s + 0.2, half_s - 0.2]:
        for fy in [-half_s + 0.2, half_s - 0.2]:
            build_box(f'Jack_Plate_{fx}_{fy}', (fx, fy, 0.03), (0.9, 0.9, 0.06), mat_dark_steel, collection=col_base)
            build_cylinder(f'Jack_Screw_{fx}_{fy}', (fx, fy, 0.22), 0.07, 0.38, segments=12, material=mat_dark_steel, collection=col_base)

    # 4 Extra-Heavy Concrete Ballast Clusters with Clamping Beams
    ballast_coords = [(-1.6, -1.6), (1.6, -1.6), (-1.6, 1.6), (1.6, 1.6)]
    for idx, (bx, by) in enumerate(ballast_coords):
        build_box(f'Ballast_Block_{idx}', (bx, by, 0.78), (2.0, 1.6, 0.85), mat_concrete, collection=col_base)
        build_box(f'Ballast_Clamp_1_{idx}', (bx, by - 0.45, 1.25), (2.1, 0.16, 0.08), mat_dark_steel, collection=col_base)
        build_box(f'Ballast_Clamp_2_{idx}', (bx, by + 0.45, 1.25), (2.1, 0.16, 0.08), mat_dark_steel, collection=col_base)

    # Black Scrim Skirt covering ballast perimeter (as seen in festival photo)
    for s_idx, (sc_center, sc_size) in enumerate([
        ((0, -2.5, 0.65), (5.2, 0.04, 1.2)),
        ((0, 2.5, 0.65), (5.2, 0.04, 1.2)),
        ((-2.5, 0, 0.65), (0.04, 5.2, 1.2)),
        ((2.5, 0, 0.65), (0.04, 5.2, 1.2))
    ]):
        build_box(f'Base_Scrim_{s_idx}', sc_center, sc_size, mat_scrim, collection=col_base)

    # Mast base shoe plate
    build_box('Mast_Base_Plate', (0, 0, 0.48), (1.45, 1.45, 0.20), mat_dark_steel, collection=col_base)

    # 4 Heavy Diagonal Outrigger Kickers (up to Z = 4.2m on mast)
    for kx, ky in [(-half_s + 0.6, -half_s + 0.6), (half_s - 0.6, -half_s + 0.6),
                   (-half_s + 0.6, half_s - 0.6),  (half_s - 0.6, half_s - 0.6)]:
        p_base = (kx, ky, 0.45)
        p_mast = (math.copysign(0.46, kx), math.copysign(0.46, ky), 4.2)
        build_tube_between(f'Diagonal_Kicker_{kx}_{ky}', p_base, p_mast, 0.07, mat_dark_steel, collection=col_base)

    # Mojo Crowd Barrier Perimeter around base (7.2m x 7.2m)
    barrier_r = 3.6
    barrier_h = 1.18
    for side_idx, (b_start, b_end) in enumerate([
        ((-barrier_r, -barrier_r), (barrier_r, -barrier_r)),
        ((barrier_r, -barrier_r), (barrier_r, barrier_r)),
        ((barrier_r, barrier_r), (-barrier_r, barrier_r)),
        ((-barrier_r, barrier_r), (-barrier_r, -barrier_r))
    ]):
        x1, y1 = b_start
        x2, y2 = b_end
        mid_x, mid_y = (x1 + x2) / 2.0, (y1 + y2) / 2.0
        length = math.hypot(x2 - x1, y2 - y1)
        rot_z = math.atan2(y2 - y1, x2 - x1)
        build_box(f'Mojo_Handrail_{side_idx}', (mid_x, mid_y, barrier_h), (length, 0.08, 0.08), mat_barrier, rot_z=rot_z, collection=col_base)
        build_box(f'Mojo_Foot_{side_idx}', (mid_x, mid_y, 0.04), (length, 0.6, 0.02), mat_barrier, rot_z=rot_z, collection=col_base)
        build_box(f'Mojo_Mesh_{side_idx}', (mid_x, mid_y, barrier_h / 2.0), (length, 0.02, barrier_h - 0.1), mat_dark_steel, rot_z=rot_z, collection=col_base)

    # =========================================================================
    # 2. PIONOWY MASZT KRATOWNICY (0.90m x 0.90m x 27.0m)
    # =========================================================================
    mw = 0.90
    hw = mw / 2.0
    chord_r = 0.035
    web_r = 0.018
    total_height = 27.0
    mast_bottom_z = 0.58

    # 4 Main Vertical Chords
    chord_corners = [(-hw, -hw), (hw, -hw), (hw, hw), (-hw, hw)]
    for idx, (cx, cy) in enumerate(chord_corners):
        build_cylinder(f'Mast_Chord_{idx}', (cx, cy, (mast_bottom_z + total_height) / 2.0),
                       chord_r, total_height - mast_bottom_z, segments=12, material=mat_truss, collection=col_mast)

    # 26 Horizontal Bays & Diagonal Lacing
    num_bays = int((total_height - mast_bottom_z) / 1.0)
    for bay in range(num_bays):
        z0 = mast_bottom_z + bay * 1.0
        z1 = z0 + 1.0

        p_sw = (-hw, -hw, z1)
        p_se = (hw, -hw, z1)
        p_ne = (hw, hw, z1)
        p_nw = (-hw, hw, z1)

        build_tube_between(f'Rung_S_{bay}', p_sw, p_se, web_r, mat_truss, collection=col_mast)
        build_tube_between(f'Rung_E_{bay}', p_se, p_ne, web_r, mat_truss, collection=col_mast)
        build_tube_between(f'Rung_N_{bay}', p_ne, p_nw, web_r, mat_truss, collection=col_mast)
        build_tube_between(f'Rung_W_{bay}', p_nw, p_sw, web_r, mat_truss, collection=col_mast)

        # Internal ladder rung on back face (+Y)
        build_tube_between(f'Ladder_Rung_{bay}', (-0.22, hw, z0 + 0.5), (0.22, hw, z0 + 0.5), 0.015, mat_truss, collection=col_mast)

        p0_sw = (-hw, -hw, z0)
        p0_se = (hw, -hw, z0)
        p0_ne = (hw, hw, z0)
        p0_nw = (-hw, hw, z0)

        if bay % 2 == 0:
            build_tube_between(f'Diag_S_{bay}', p0_sw, p_se, web_r, mat_truss, collection=col_mast)
            build_tube_between(f'Diag_E_{bay}', p0_se, p_ne, web_r, mat_truss, collection=col_mast)
            build_tube_between(f'Diag_N_{bay}', p0_ne, p_nw, web_r, mat_truss, collection=col_mast)
            build_tube_between(f'Diag_W_{bay}', p0_nw, p_sw, web_r, mat_truss, collection=col_mast)
        else:
            build_tube_between(f'Diag_S_{bay}', p0_se, p_sw, web_r, mat_truss, collection=col_mast)
            build_tube_between(f'Diag_E_{bay}', p0_ne, p_se, web_r, mat_truss, collection=col_mast)
            build_tube_between(f'Diag_N_{bay}', p0_nw, p_ne, web_r, mat_truss, collection=col_mast)
            build_tube_between(f'Diag_W_{bay}', p0_sw, p_nw, web_r, mat_truss, collection=col_mast)

    # Double Cable Loom down back chords
    build_cylinder('Cable_Loom_1', (-0.15, hw + 0.06, total_height / 2.0), 0.045, total_height - 0.5, segments=8, material=mat_cable, collection=col_mast)
    build_cylinder('Cable_Loom_2', (0.15, hw + 0.06, total_height / 2.0), 0.045, total_height - 0.5, segments=8, material=mat_cable, collection=col_mast)

    # Top Lightning Protection Finial (Z = 27.0m to 28.0m)
    build_cylinder('Lightning_Rod', (0, 0, 27.5), 0.02, 1.0, segments=8, material=mat_rigging_pins, collection=col_mast)

    # 4 High-Tension Structural Guy Wires (Odciągi linowe ze zdjęcia!)
    for gx, gy in [(-half_s + 0.3, -half_s + 0.3), (half_s - 0.3, -half_s + 0.3),
                   (-half_s + 0.3, half_s - 0.3),  (half_s - 0.3, half_s - 0.3)]:
        p_ground = (gx, gy, 0.4)
        p_mast_top = (math.copysign(0.48, gx), math.copysign(0.48, gy), 20.0)
        build_tube_between(f'Guy_Wire_{gx}_{gy}', p_ground, p_mast_top, 0.012, mat_guy_wire, collection=col_mast)

    # =========================================================================
    # 3. TOP CANTILEVER BEAM & MOTOR HOISTS (Z = 26.0m to 27.0m)
    # =========================================================================
    arm_reach = 3.0
    arm_mid_y = -arm_reach / 2.0
    arm_z = 26.4

    build_box('Cantilever_Beam_Top', (0, arm_mid_y, arm_z + 0.35), (0.75, arm_reach + mw, 0.14), mat_truss, collection=col_cantilever)
    build_box('Cantilever_Beam_Btm', (0, arm_mid_y, arm_z - 0.35), (0.75, arm_reach + mw, 0.14), mat_truss, collection=col_cantilever)
    build_tube_between('Cantilever_Kicker', (0, -0.45, 23.8), (0, -arm_reach + 0.2, arm_z - 0.35), 0.06, mat_truss, collection=col_cantilever)

    # 2 Heavy 2-Tonne Chain Hoists dropping load cables down to array bumper (Z = 16.5m)
    array_bumper_z = 16.5
    hoist_positions = [-arm_reach + 0.5, -arm_reach + 1.8]
    for idx, hy in enumerate(hoist_positions):
        build_box(f'Motor_Hoist_{idx}', (0, hy, arm_z - 0.5), (0.38, 0.55, 0.42), mat_dark_steel, collection=col_cantilever)
        build_cylinder(f'Chain_Bag_{idx}', (0.18, hy, arm_z - 0.8), 0.14, 0.46, segments=8, material=mat_cable, collection=col_cantilever)
        cable_len = (arm_z - 0.7) - array_bumper_z
        cable_mid_z = (arm_z - 0.7 + array_bumper_z) / 2.0
        build_cylinder(f'Hoist_Cable_{idx}', (0, hy, cable_mid_z), 0.016, cable_len, segments=6, material=mat_rigging_pins, collection=col_cantilever)

    # =========================================================================
    # 4. LOWER CIRCULAR LIGHTING RIG (Ring 1 at Z = 18.0m, Diameter = 5.6m)
    # =========================================================================
    ring1_r = 2.8
    ring1_z_top = 18.2
    ring1_z_btm = 17.8
    ring1_segs = 36

    for i in range(ring1_segs):
        a1 = (i / ring1_segs) * 2 * math.pi
        a2 = ((i + 1) / ring1_segs) * 2 * math.pi
        p1_top = (math.cos(a1) * ring1_r, math.sin(a1) * ring1_r, ring1_z_top)
        p2_top = (math.cos(a2) * ring1_r, math.sin(a2) * ring1_r, ring1_z_top)
        build_tube_between(f'R1_Chord_Top_{i}', p1_top, p2_top, 0.026, mat_truss, collection=col_ring_lower)

        p1_btm = (math.cos(a1) * ring1_r, math.sin(a1) * ring1_r, ring1_z_btm)
        p2_btm = (math.cos(a2) * ring1_r, math.sin(a2) * ring1_r, ring1_z_btm)
        build_tube_between(f'R1_Chord_Btm_{i}', p1_btm, p2_btm, 0.026, mat_truss, collection=col_ring_lower)

        build_tube_between(f'R1_Spacer_{i}', p1_top, p1_btm, 0.018, mat_truss, collection=col_ring_lower)

    # 4 Radial Outrigger Spoke Arms connecting lower ring to mast
    for s_angle in [0.0, math.pi / 2.0, math.pi, 3 * math.pi / 2.0]:
        px = math.cos(s_angle)
        py = math.sin(s_angle)
        p_mast = (px * 0.46, py * 0.46, 18.0)
        p_ring = (px * ring1_r, py * ring1_r, 18.0)
        build_tube_between(f'R1_Spoke_{s_angle:.2f}', p_mast, p_ring, 0.045, mat_truss, collection=col_ring_lower)

    # 16 Matrix Blinders on top of Lower Ring (Z = 18.4m)
    num_blinders_1 = 16
    for i in range(num_blinders_1):
        a = (i / num_blinders_1) * 2 * math.pi
        bx = math.cos(a) * ring1_r
        by = math.sin(a) * ring1_r
        build_box(f'R1_Blinder_Bracket_{i}', (bx, by, ring1_z_top + 0.1), (0.24, 0.24, 0.08), mat_dark_steel, rot_z=-a, collection=col_ring_lower)
        build_box(f'R1_Blinder_Housing_{i}', (bx, by, ring1_z_top + 0.24), (0.42, 0.18, 0.32), mat_dark_steel, rot_z=-a, collection=col_ring_lower)
        face_x = bx + math.cos(a) * 0.1
        face_y = by + math.sin(a) * 0.1
        build_box(f'R1_Blinder_Face_{i}', (face_x, face_y, ring1_z_top + 0.24), (0.38, 0.04, 0.28), mat_blinder_emissive, rot_z=-a, collection=col_ring_lower)

    # 16 Robe Pointe Moving Heads under Lower Ring (Z = 17.4m)
    num_heads_1 = 16
    for i in range(num_heads_1):
        a = (i / num_heads_1) * 2 * math.pi
        hx = math.cos(a) * ring1_r
        hy = math.sin(a) * ring1_r
        build_box(f'R1_Head_Base_{i}', (hx, hy, ring1_z_btm - 0.08), (0.28, 0.28, 0.12), mat_moving_head, rot_z=-a, collection=col_ring_lower)
        build_box(f'R1_Head_Yoke_{i}', (hx, hy, ring1_z_btm - 0.25), (0.32, 0.12, 0.24), mat_moving_head, rot_z=-a, collection=col_ring_lower)

        tilt = math.radians(35.0)
        barrel_z = ring1_z_btm - 0.42
        build_cylinder(f'R1_Head_Barrel_{i}', (hx, hy, barrel_z), 0.14, 0.38, segments=12, material=mat_moving_head,
                       rot_x=-tilt * math.sin(a), rot_y=tilt * math.cos(a), rot_z=-a, collection=col_ring_lower)

        lens_offset = 0.2
        lx = hx + math.cos(a) * math.sin(tilt) * lens_offset
        ly = hy + math.sin(a) * math.sin(tilt) * lens_offset
        lz = barrel_z - math.cos(tilt) * lens_offset
        build_cylinder(f'R1_Head_Lens_{i}', (lx, ly, lz), 0.11, 0.04, segments=16, material=mat_lens_emissive,
                       rot_x=-tilt * math.sin(a), rot_y=tilt * math.cos(a), rot_z=-a, collection=col_ring_lower)

    # =========================================================================
    # 5. UPPER CIRCULAR LIGHTING RIG (Ring 2 at Z = 23.5m, Diameter = 4.4m)
    # =========================================================================
    ring2_r = 2.2
    ring2_z_top = 23.7
    ring2_z_btm = 23.3
    ring2_segs = 32

    for i in range(ring2_segs):
        a1 = (i / ring2_segs) * 2 * math.pi
        a2 = ((i + 1) / ring2_segs) * 2 * math.pi
        p1_top = (math.cos(a1) * ring2_r, math.sin(a1) * ring2_r, ring2_z_top)
        p2_top = (math.cos(a2) * ring2_r, math.sin(a2) * ring2_r, ring2_z_top)
        build_tube_between(f'R2_Chord_Top_{i}', p1_top, p2_top, 0.024, mat_truss, collection=col_ring_upper)

        p1_btm = (math.cos(a1) * ring2_r, math.sin(a1) * ring2_r, ring2_z_btm)
        p2_btm = (math.cos(a2) * ring2_r, math.sin(a2) * ring2_r, ring2_z_btm)
        build_tube_between(f'R2_Chord_Btm_{i}', p1_btm, p2_btm, 0.024, mat_truss, collection=col_ring_upper)

        build_tube_between(f'R2_Spacer_{i}', p1_top, p1_btm, 0.016, mat_truss, collection=col_ring_upper)

    # 4 Radial Outrigger Spoke Arms connecting upper ring to mast
    for s_angle in [0.0, math.pi / 2.0, math.pi, 3 * math.pi / 2.0]:
        px = math.cos(s_angle)
        py = math.sin(s_angle)
        p_mast = (px * 0.46, py * 0.46, 23.5)
        p_ring = (px * ring2_r, py * ring2_r, 23.5)
        build_tube_between(f'R2_Spoke_{s_angle:.2f}', p_mast, p_ring, 0.042, mat_truss, collection=col_ring_upper)

    # 12 Matrix Blinders on top of Upper Ring (Z = 23.9m)
    num_blinders_2 = 12
    for i in range(num_blinders_2):
        a = (i / num_blinders_2) * 2 * math.pi
        bx = math.cos(a) * ring2_r
        by = math.sin(a) * ring2_r
        build_box(f'R2_Blinder_Bracket_{i}', (bx, by, ring2_z_top + 0.1), (0.24, 0.24, 0.08), mat_dark_steel, rot_z=-a, collection=col_ring_upper)
        build_box(f'R2_Blinder_Housing_{i}', (bx, by, ring2_z_top + 0.24), (0.42, 0.18, 0.32), mat_dark_steel, rot_z=-a, collection=col_ring_upper)
        face_x = bx + math.cos(a) * 0.1
        face_y = by + math.sin(a) * 0.1
        build_box(f'R2_Blinder_Face_{i}', (face_x, face_y, ring2_z_top + 0.24), (0.38, 0.04, 0.28), mat_blinder_emissive, rot_z=-a, collection=col_ring_upper)

    # 12 Robe Pointe Moving Heads under Upper Ring (Z = 22.9m)
    num_heads_2 = 12
    for i in range(num_heads_2):
        a = (i / num_heads_2) * 2 * math.pi
        hx = math.cos(a) * ring2_r
        hy = math.sin(a) * ring2_r
        build_box(f'R2_Head_Base_{i}', (hx, hy, ring2_z_btm - 0.08), (0.28, 0.28, 0.12), mat_moving_head, rot_z=-a, collection=col_ring_upper)
        build_box(f'R2_Head_Yoke_{i}', (hx, hy, ring2_z_btm - 0.25), (0.32, 0.12, 0.24), mat_moving_head, rot_z=-a, collection=col_ring_upper)

        tilt = math.radians(35.0)
        barrel_z = ring2_z_btm - 0.42
        build_cylinder(f'R2_Head_Barrel_{i}', (hx, hy, barrel_z), 0.14, 0.38, segments=12, material=mat_moving_head,
                       rot_x=-tilt * math.sin(a), rot_y=tilt * math.cos(a), rot_z=-a, collection=col_ring_upper)

        lens_offset = 0.2
        lx = hx + math.cos(a) * math.sin(tilt) * lens_offset
        ly = hy + math.sin(a) * math.sin(tilt) * lens_offset
        lz = barrel_z - math.cos(tilt) * lens_offset
        build_cylinder(f'R2_Head_Lens_{i}', (lx, ly, lz), 0.11, 0.04, segments=16, material=mat_lens_emissive,
                       rot_x=-tilt * math.sin(a), rot_y=tilt * math.cos(a), rot_z=-a, collection=col_ring_upper)

    # Center Cross-Bridge Truss across Upper Ring (holding 4 center high-output arena strobes)
    build_box('R2_Cross_Bridge', (0, 0, ring2_z_top + 0.35), (ring2_r * 2.0, 0.35, 0.25), mat_truss, collection=col_ring_upper)
    for si, sx in enumerate([-1.2, -0.4, 0.4, 1.2]):
        build_box(f'Arena_Strobe_{si}', (sx, 0, ring2_z_top + 0.55), (0.45, 0.22, 0.25), mat_dark_steel, collection=col_ring_upper)
        build_box(f'Arena_Strobe_Face_{si}', (sx, -0.12, ring2_z_top + 0.55), (0.42, 0.04, 0.22), mat_strobe_emissive, collection=col_ring_upper)

    # =========================================================================
    # 6. EXTENDED CONCERT LINE ARRAY (13 Enclosures from Z = 16.5m to Z = 8.5m)
    # =========================================================================
    array_center_y = -arm_reach + 1.1
    build_box('Array_Bumper_Frame', (0, array_center_y, array_bumper_z + 0.08), (1.50, 0.85, 0.18), mat_dark_steel, collection=col_k2)
    build_box('Array_Bumper_Spine', (0, array_center_y, array_bumper_z + 0.20), (0.26, 1.25, 0.14), mat_dark_steel, collection=col_k2)

    speaker_w = 1.34
    speaker_h = 0.35
    speaker_d = 0.48
    # 13 Progressive J-curve angles
    angles_deg = [1.0, 2.0, 3.5, 5.0, 7.0, 9.5, 12.5, 16.0, 20.0, 24.5, 29.5, 35.0, 41.0]

    current_z = array_bumper_z - 0.2
    current_y = array_center_y

    for idx, deg in enumerate(angles_deg):
        rad = math.radians(deg)
        box_center = (0, current_y, current_z)

        # Cabinet body
        build_box(f'K2_Cabinet_{idx}', box_center, (speaker_w, speaker_d, speaker_h), mat_speaker_body, rot_x=-rad, collection=col_k2)

        # Front steel acoustic grille
        gf_y = current_y - (speaker_d / 2.0 + 0.01) * math.cos(rad)
        gf_z = current_z + (speaker_d / 2.0 + 0.01) * math.sin(rad)
        build_box(f'K2_Grille_{idx}', (0, gf_y, gf_z), (speaker_w - 0.08, 0.02, speaker_h - 0.04), mat_speaker_grille, rot_x=-rad, collection=col_k2)

        # Center acoustic waveguide fin
        build_box(f'K2_Fin_{idx}', (0, gf_y - 0.01 * math.cos(rad), gf_z + 0.01 * math.sin(rad)), (0.04, 0.03, speaker_h - 0.06), mat_rigging_pins, rot_x=-rad, collection=col_k2)

        # Side rigging plates and captive pins
        for rx in [-speaker_w / 2.0 - 0.01, speaker_w / 2.0 + 0.01]:
            build_box(f'K2_RigPlate_{idx}_{rx:.2f}', (rx, current_y, current_z), (0.02, speaker_d * 0.7, 0.12), mat_rigging_pins, rot_x=-rad, collection=col_k2)

        step_z = speaker_h * math.cos(rad) + 0.02
        step_y = speaker_h * math.sin(rad)
        current_z -= step_z
        current_y += step_y

    # Rear pull-back stabilization chain linking bottom enclosure back to mast
    build_tube_between('Array_PullBack_Chain', (0, current_y + 0.2, current_z), (0, -0.45, current_z + 1.4), 0.016, mat_dark_steel, collection=col_k2)

    # =========================================================================
    # 7. GROUND EQUIPMENT (400V Power Distro & 3 Touring Amp Racks on Base)
    # =========================================================================
    build_box('Power_Distro_400V', (-1.4, 0.9, 0.90), (0.85, 0.60, 0.95), mat_dark_steel, collection=col_gear)
    build_cylinder('Distro_Lid_Handle', (-1.4, 0.9, 1.42), 0.04, 0.38, segments=8, material=mat_truss, collection=col_gear)
    build_box('FlightCase_Rack1', (1.4, -0.8, 0.78), (0.70, 0.75, 0.78), mat_dark_steel, collection=col_gear)
    build_box('FlightCase_Rack2', (1.4, 0.0, 0.78), (0.70, 0.75, 0.78), mat_dark_steel, collection=col_gear)
    build_box('FlightCase_Rack3', (1.4, 0.8, 0.78), (0.70, 0.75, 0.78), mat_dark_steel, collection=col_gear)
    build_box('Case_Trim1', (1.4, -0.8, 1.18), (0.72, 0.77, 0.04), mat_truss, collection=col_gear)
    build_box('Case_Trim2', (1.4, 0.0, 1.18), (0.72, 0.77, 0.04), mat_truss, collection=col_gear)
    build_box('Case_Trim3', (1.4, 0.8, 1.18), (0.72, 0.77, 0.04), mat_truss, collection=col_gear)

    print("Successfully built heavy double-ring delay tower components in Blender scene.")

def setup_camera_and_lighting(daylight=True):
    col_setup = get_or_create_collection('00_Render_Studio')

    for obj in list(col_setup.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

    # Sun / Key light
    sun_data = bpy.data.lights.new('KeySun', 'SUN')
    sun_obj = bpy.data.objects.new('KeySun', sun_data)
    col_setup.objects.link(sun_obj)
    if daylight:
        sun_data.energy = 5.2
        sun_data.color = (1.0, 0.96, 0.90)
        sun_obj.rotation_euler = Euler((math.radians(48), math.radians(15), math.radians(-40)), 'XYZ')
    else:
        sun_data.energy = 0.5
        sun_data.color = (0.25, 0.4, 0.8)
        sun_obj.rotation_euler = Euler((math.radians(65), math.radians(10), math.radians(-70)), 'XYZ')

    # Fill / Rim lights
    fill_data = bpy.data.lights.new('FillLight', 'SUN')
    fill_data.energy = 2.2 if daylight else 0.35
    fill_data.color = (0.75, 0.88, 1.0)
    fill_obj = bpy.data.objects.new('FillLight', fill_data)
    fill_obj.rotation_euler = Euler((math.radians(35), math.radians(-30), math.radians(130)), 'XYZ')
    col_setup.objects.link(fill_obj)

    # Ground plane for shadows and context
    ground_mat = make_pbr_material('Studio_Ground', base_color=(0.14, 0.24, 0.12, 1.0), roughness=0.92)
    build_box('Ground_Plane', (0, 0, -0.05), (120, 120, 0.1), ground_mat, collection=col_setup)

    # World background
    scene = bpy.context.scene
    world = bpy.data.worlds.new('StudioWorld')
    world.use_nodes = True
    bg_node = world.node_tree.nodes.get('Background')
    if bg_node:
        if daylight:
            bg_node.inputs['Color'].default_value = (0.42, 0.60, 0.82, 1.0)
            bg_node.inputs['Strength'].default_value = 1.0
        else:
            bg_node.inputs['Color'].default_value = (0.02, 0.03, 0.06, 1.0)
            bg_node.inputs['Strength'].default_value = 0.6
    scene.world = world

def render_view(cam_pos, look_at, fov_deg, out_png, width=1600, height=1000):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(out_png)

    cam_data = bpy.data.cameras.new('RenderCam')
    cam_data.lens_unit = 'FOV'
    cam_data.angle = math.radians(fov_deg)
    cam_obj = bpy.data.objects.new('RenderCam', cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)

    cam_obj.location = Vector(cam_pos)
    direction = Vector(look_at) - Vector(cam_pos)
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam_obj.rotation_euler = rot_quat.to_euler()
    scene.camera = cam_obj

    print(f"Rendering view to {out_png}...")
    bpy.ops.render.render(write_still=True)

    bpy.data.objects.remove(cam_obj, do_unlink=True)
    bpy.data.cameras.remove(cam_data, do_unlink=True)

def main():
    repo_root = Path(__file__).resolve().parents[2]
    out_glb = repo_root / 'public' / 'game-assets' / 'world' / 'festival' / 'delay_tower_heavy.glb'
    out_blend = repo_root / 'blender' / 'delay_tower_heavy.blend'
    out_blend.parent.mkdir(parents=True, exist_ok=True)
    out_glb.parent.mkdir(parents=True, exist_ok=True)

    artifact_dir = Path("C:/Users/krucz/.gemini/antigravity/brain/0f469478-5ced-4cb0-85a6-506fc5188eb0")

    # 1. Build procedural scene
    generate_heavy_double_ring_tower()

    # 2. Save .blend authoring file first (before render studio objects)
    print(f"Saving Blender authoring file: {out_blend}")
    bpy.ops.wm.save_as_mainfile(filepath=str(out_blend))

    # 3. Export GLB for Three.js runtime
    print(f"Exporting GLB game model: {out_glb}")
    bpy.ops.export_scene.gltf(
        filepath=str(out_glb),
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True
    )

    # 4. Render daylight studio views
    setup_camera_and_lighting(daylight=True)

    # View 1: Full Hero Shot - perfectly framing the whole 27m double-ring tower from ground to lightning rod
    render_view(cam_pos=(24.0, -32.0, 13.5), look_at=(0.0, -1.0, 13.0), fov_deg=48.0,
                out_png=artifact_dir / 'delay_tower_heavy_hero_daylight.png')

    # View 2: Close-up of Double Circular Lighting Rig (Both lower 5.6m and upper 4.4m rings)
    render_view(cam_pos=(5.5, -6.5, 21.0), look_at=(0.0, 0.0, 20.8), fov_deg=46.0,
                out_png=artifact_dir / 'delay_tower_heavy_double_rings_detail.png')

    # View 3: Close-up of 13-enclosure L-Acoustics K1/K2 J-Curve Array & Rigging
    render_view(cam_pos=(5.0, -5.0, 13.0), look_at=(0.0, -1.8, 12.5), fov_deg=44.0,
                out_png=artifact_dir / 'delay_tower_heavy_array_detail.png')

    # View 4: Close-up of Heavy Base, Ballast Scrim, Guy Wires & Mojo Barriers
    render_view(cam_pos=(6.2, -6.8, 3.5), look_at=(0.0, 0.0, 1.4), fov_deg=52.0,
                out_png=artifact_dir / 'delay_tower_heavy_base_detail.png')

    # 5. Render night concert view with both tiers of moving heads & blinders blazing
    setup_camera_and_lighting(daylight=False)
    render_view(cam_pos=(22.0, -30.0, 12.5), look_at=(0.0, -1.0, 13.0), fov_deg=48.0,
                out_png=artifact_dir / 'delay_tower_heavy_night_concert.png')

    print("ALL BLENDER HEAVY DELAY TOWER WORK COMPLETED SUCCESSFULLY!")

if __name__ == '__main__':
    main()
