"""
Procedural 3D Generator for the Official Pol'and'Rock Festival PA / Delay Tower
Based strictly on "POL'AND'ROCK FESTIVAL: PA TOWER MODELING BLUEPRINT":
- Total height: ~22 meters
- Heavy ground base with steel H-beams, concrete ballast slabs, and 3.8m diagonal kickers
- Central vertical square truss mast (0.8m x 0.8m x 22m) with 4 main chords and diagonal webbing
- Cantilever outrigger beam at top with electric chain hoist motors and rigging cables
- Curved J-Array speaker cluster (L-Acoustics K2 style, 10 enclosures with progressive downward curve)
- Unique circular lighting rig (diameter 4.2m) mounted at ~19m:
  - 8 Matrix Blinders on top chord
  - 12 Robe Pointe Moving Heads with yokes and lens barrels hanging under the circular truss
- Power distro & touring amplifier racks on base
"""

import os
import sys
import math
from pathlib import Path
import bpy

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

def make_pbr_material(name, base_color=(0.8, 0.8, 0.8, 1.0), roughness=0.5, metallic=0.0,
                       texture_path=None, emission_color=(0, 0, 0, 1.0), emission_strength=0.0):
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

    if texture_path and os.path.exists(texture_path):
        img = bpy.data.images.load(str(Path(texture_path).resolve()))
        img.colorspace_settings.name = 'sRGB'
        tex_node = nodes.new(type='ShaderNodeTexImage')
        tex_node.image = img
        links.new(tex_node.outputs['Color'], bsdf.inputs['Base Color'])
        if 'Alpha' in tex_node.outputs and 'Alpha' in bsdf.inputs:
            links.new(tex_node.outputs['Alpha'], bsdf.inputs['Alpha'])

    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    return mat

def create_mesh(name, vertices, faces, material=None, uvs=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()

    if uvs:
        uv_layer = mesh.uv_layers.new(name="UVMap")
        for poly in mesh.polygons:
            for loop_index in poly.loop_indices:
                v_idx = mesh.loops[loop_index].vertex_index
                if v_idx in uvs:
                    uv_layer.data[loop_index].uv = uvs[v_idx]

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if material:
        obj.data.materials.append(material)
    return obj

def build_box(name, center, size, material=None, rot_x=0.0, rot_y=0.0, rot_z=0.0):
    cx, cy, cz = center
    sx, sy, sz = size
    hx, hy, hz = sx / 2.0, sy / 2.0, sz / 2.0

    raw_verts = [
        (-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz),
        (-hx, -hy, hz),  (hx, -hy, hz),  (hx, hy, hz),  (-hx, hy, hz)
    ]

    # Rotate & translate vertices
    rot_verts = []
    for vx, vy, vz in raw_verts:
        # Rot X
        if rot_x != 0:
            c, s = math.cos(rot_x), math.sin(rot_x)
            vy, vz = vy * c - vz * s, vy * s + vz * c
        # Rot Y
        if rot_y != 0:
            c, s = math.cos(rot_y), math.sin(rot_y)
            vx, vz = vx * c + vz * s, -vx * s + vz * c
        # Rot Z
        if rot_z != 0:
            c, s = math.cos(rot_z), math.sin(rot_z)
            vx, vy = vx * c - vy * s, vx * s + vy * c
        rot_verts.append((cx + vx, cy + vy, cz + vz))

    faces = [
        (0, 3, 2, 1), (4, 5, 6, 7),
        (0, 1, 5, 4), (2, 3, 7, 6),
        (0, 4, 7, 3), (1, 2, 6, 5)
    ]
    return create_mesh(name, rot_verts, faces, material)

def build_cylinder(name, center, radius, height, segments=12, material=None, rot_x=0.0, rot_y=0.0, rot_z=0.0):
    cx, cy, cz = center
    hz = height / 2.0
    raw_verts = []
    # Bottom ring
    for i in range(segments):
        a = (i / segments) * 2 * math.pi
        raw_verts.append((math.cos(a) * radius, math.sin(a) * radius, -hz))
    # Top ring
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
    return create_mesh(name, rot_verts, faces, material)

def build_tube_between(name, p1, p2, radius, material=None, segments=8):
    dx, dy, dz = p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]
    length = math.sqrt(dx*dx + dy*dy + dz*dz)
    if length < 0.0001:
        return None
    mid = ((p1[0] + p2[0]) / 2.0, (p1[1] + p2[1]) / 2.0, (p1[2] + p2[2]) / 2.0)

    # Orientation angles
    rot_y = math.atan2(dx, dz)
    rot_x = math.atan2(-dy, math.sqrt(dx*dx + dz*dz))
    return build_cylinder(name, mid, radius, length, segments=segments, material=material, rot_x=rot_x, rot_y=rot_y)

def build_blueprint_delay_tower(output_glb, tex_dir=None):
    clear_scene()

    # PBR Materials
    mat_truss = make_pbr_material('Mat_PA_AluTruss', base_color=(0.82, 0.84, 0.88, 1.0), roughness=0.32, metallic=0.92)
    mat_dark_steel = make_pbr_material('Mat_PA_SteelBase', base_color=(0.18, 0.19, 0.22, 1.0), roughness=0.6, metallic=0.75)
    mat_concrete = make_pbr_material('Mat_PA_BallastConcrete', base_color=(0.58, 0.58, 0.56, 1.0), roughness=0.94)
    mat_speaker_body = make_pbr_material('Mat_PA_K2_Speaker', base_color=(0.12, 0.12, 0.14, 1.0), roughness=0.65, metallic=0.15)
    mat_speaker_grille = make_pbr_material('Mat_PA_K2_Grille', base_color=(0.06, 0.06, 0.07, 1.0), roughness=0.85, metallic=0.4)
    mat_rigging_pins = make_pbr_material('Mat_PA_RiggingHardware', base_color=(0.75, 0.77, 0.8, 1.0), roughness=0.3, metallic=0.9)
    mat_cable = make_pbr_material('Mat_PA_HeavyCable', base_color=(0.05, 0.05, 0.06, 1.0), roughness=0.9)
    mat_moving_head = make_pbr_material('Mat_PA_RobePointe', base_color=(0.14, 0.14, 0.16, 1.0), roughness=0.4, metallic=0.5)
    mat_lens_emissive = make_pbr_material('Mat_PA_HeadLens', base_color=(0.95, 0.98, 1.0, 1.0), roughness=0.1,
                                          emission_color=(0.4, 0.8, 1.0, 1.0), emission_strength=8.0)
    mat_blinder_emissive = make_pbr_material('Mat_PA_BlinderFace', base_color=(1.0, 0.95, 0.85, 1.0), roughness=0.2,
                                             emission_color=(1.0, 0.88, 0.65, 1.0), emission_strength=10.0)

    # =========================================================================
    # 1. PODSTAWA Z BALASTEM (Base with Ballast ~5.6m x 5.6m, height ~1.2m - 1.5m)
    # =========================================================================
    base_spread = 5.6
    beam_h = 0.35
    beam_w = 0.28

    # Heavy steel H-beam cross
    build_box('Base_Beam_X', (0, 0, 0.18), (base_spread, beam_w, beam_h), mat_dark_steel)
    build_box('Base_Beam_Y', (0, 0, 0.18), (beam_w, base_spread, beam_h), mat_dark_steel)
    # Outer square perimeter frame connecting the cross arms
    half_s = base_spread / 2.0
    build_box('Base_Outer_N', (0, half_s - 0.2, 0.18), (base_spread - 0.4, 0.2, beam_h), mat_dark_steel)
    build_box('Base_Outer_S', (0, -half_s + 0.2, 0.18), (base_spread - 0.4, 0.2, beam_h), mat_dark_steel)
    build_box('Base_Outer_E', (half_s - 0.2, 0, 0.18), (0.2, base_spread - 0.4, beam_h), mat_dark_steel)
    build_box('Base_Outer_W', (-half_s + 0.2, 0, 0.18), (0.2, base_spread - 0.4, beam_h), mat_dark_steel)

    # 4 Heavy Screw Jack Feet & Ground Spreader Plates
    for fx in [-half_s + 0.2, half_s - 0.2]:
        for fy in [-half_s + 0.2, half_s - 0.2]:
            build_box(f'Jack_Plate_{fx}_{fy}', (fx, fy, 0.03), (0.75, 0.75, 0.06), mat_dark_steel)
            build_cylinder(f'Jack_Screw_{fx}_{fy}', (fx, fy, 0.18), 0.06, 0.32, segments=10, material=mat_dark_steel)

    # 4 Concrete Ballast Blocks (Massive slabs sitting on the steel grid)
    # Dimension ~1.8m x 1.4m x 0.65m each, as shown in blueprint photo
    ballast_coords = [
        (-1.5, -1.5), (1.5, -1.5),
        (-1.5, 1.5),  (1.5, 1.5)
    ]
    for idx, (bx, by) in enumerate(ballast_coords):
        # Concrete block
        build_box(f'Ballast_Block_{idx}', (bx, by, 0.68), (1.9, 1.5, 0.7), mat_concrete)
        # Steel clamping brackets on top
        build_box(f'Ballast_Clamp_{idx}', (bx, by, 1.06), (2.0, 0.14, 0.08), mat_dark_steel)

    # Heavy Mast Base Shoe & Pivot Plate at Z = 0.45m
    build_box('Mast_Base_Plate', (0, 0, 0.45), (1.3, 1.3, 0.18), mat_dark_steel)

    # 4 Diagonal Steel Outrigger Kickers / Braces (reaching from base corners up to Z = 3.8m on mast)
    for kx, ky in [(-half_s + 0.8, -half_s + 0.8), (half_s - 0.8, -half_s + 0.8),
                   (-half_s + 0.8, half_s - 0.8),  (half_s - 0.8, half_s - 0.8)]:
        p_base = (kx, ky, 0.4)
        p_mast = (math.copysign(0.42, kx), math.copysign(0.42, ky), 3.8)
        build_tube_between(f'Diagonal_Kicker_{kx}_{ky}', p_base, p_mast, 0.06, mat_dark_steel)

    # =========================================================================
    # 2. PIONOWY MASZT KRATOWNICY (Square Box Truss Mast 0.8m x 0.8m x 22m)
    # =========================================================================
    mw = 0.82  # Mast width X and Y
    hw = mw / 2.0
    chord_r = 0.032  # 64mm chord tube
    web_r = 0.016    # 32mm diagonal webbing tube
    total_height = 22.0
    mast_bottom_z = 0.54

    # 4 Vertical Main Chords
    chord_corners = [(-hw, -hw), (hw, -hw), (hw, hw), (-hw, hw)]
    for idx, (cx, cy) in enumerate(chord_corners):
        build_cylinder(f'Mast_Chord_{idx}', (cx, cy, (mast_bottom_z + total_height) / 2.0),
                       chord_r, total_height - mast_bottom_z, segments=12, material=mat_truss)

    # Horizontal rungs and diagonal lacing every 1.0 m from Z=0.5m to Z=22m
    num_bays = int((total_height - mast_bottom_z) / 1.0) # ~21 bays
    for bay in range(num_bays):
        z0 = mast_bottom_z + bay * 1.0
        z1 = z0 + 1.0

        # Horizontal perimeter frame at z1
        p_sw = (-hw, -hw, z1)
        p_se = (hw, -hw, z1)
        p_ne = (hw, hw, z1)
        p_nw = (-hw, hw, z1)

        build_tube_between(f'Rung_S_{bay}', p_sw, p_se, web_r, mat_truss)
        build_tube_between(f'Rung_E_{bay}', p_se, p_ne, web_r, mat_truss)
        build_tube_between(f'Rung_N_{bay}', p_ne, p_nw, web_r, mat_truss)
        build_tube_between(f'Rung_W_{bay}', p_nw, p_sw, web_r, mat_truss)

        # Diagonal webbing zigzag on 4 faces
        p0_sw = (-hw, -hw, z0)
        p0_se = (hw, -hw, z0)
        p0_ne = (hw, hw, z0)
        p0_nw = (-hw, hw, z0)

        if bay % 2 == 0:
            build_tube_between(f'Diag_S_{bay}', p0_sw, p_se, web_r, mat_truss)
            build_tube_between(f'Diag_E_{bay}', p0_se, p_ne, web_r, mat_truss)
            build_tube_between(f'Diag_N_{bay}', p0_ne, p_nw, web_r, mat_truss)
            build_tube_between(f'Diag_W_{bay}', p0_nw, p_sw, web_r, mat_truss)
        else:
            build_tube_between(f'Diag_S_{bay}', p0_se, p_sw, web_r, mat_truss)
            build_tube_between(f'Diag_E_{bay}', p0_ne, p_se, web_r, mat_truss)
            build_tube_between(f'Diag_N_{bay}', p0_nw, p_ne, web_r, mat_truss)
            build_tube_between(f'Diag_W_{bay}', p0_sw, p_nw, web_r, mat_truss)

    # Multicore cabling trunk running down the back chord (+Y)
    build_cylinder('Cable_Loom', (0, hw + 0.05, total_height / 2.0), 0.05, total_height - 0.5, segments=8, material=mat_cable)

    # =========================================================================
    # 3. WYSIĘGNIK GÓRNY I WYCIĄGARKI (Top Cantilever Beam & Motor Hoists)
    # =========================================================================
    # At top (Z = 21.0m to 22.0m), truss cantilever arm extends forward (-Y) by 2.6m
    arm_reach = 2.6
    arm_mid_y = -arm_reach / 2.0
    arm_z = 21.6

    # Cantilever top & bottom beams
    build_box('Cantilever_Beam_Top', (0, arm_mid_y, arm_z + 0.3), (0.7, arm_reach + mw, 0.12), mat_truss)
    build_box('Cantilever_Beam_Btm', (0, arm_mid_y, arm_z - 0.3), (0.7, arm_reach + mw, 0.12), mat_truss)
    # Diagonal outrigger brace from mast at Z=19.5m up to end of cantilever
    build_tube_between('Cantilever_Kicker', (0, -0.4, 19.8), (0, -arm_reach + 0.2, arm_z - 0.3), 0.05, mat_truss)

    # Motor Hoist Points: 2 Electric Chain Hoists (GIS / CM Lodestar)
    hoist_positions = [-arm_reach + 0.4, -arm_reach + 1.6]
    for idx, hy in enumerate(hoist_positions):
        # Hoist motor body
        build_box(f'Motor_Hoist_{idx}', (0, hy, arm_z - 0.45), (0.32, 0.48, 0.35), mat_dark_steel)
        # Chain bag
        build_cylinder(f'Chain_Bag_{idx}', (0.15, hy, arm_z - 0.7), 0.12, 0.4, segments=8, material=mat_cable)
        # Steel Hoist Cable dropping down to speaker bumper frame (~Z=17.0m)
        build_cylinder(f'Hoist_Cable_{idx}', (0, hy, (arm_z - 0.6 + 17.2) / 2.0), 0.012, (arm_z - 0.6 - 17.2), segments=6, material=mat_rigging_pins)

    # =========================================================================
    # 4. ZESTAW GŁOŚNIKÓW LINE ARRAY (L-Acoustics K2 Cluster - J-Curve 10 Enclosures)
    # =========================================================================
    # Top Rigging Bumper Bar at Z = 17.1m
    array_center_y = -arm_reach + 1.0
    build_box('Array_Bumper_Frame', (0, array_center_y, 17.15), (1.42, 0.75, 0.16), mat_dark_steel)
    build_box('Array_Bumper_Spine', (0, array_center_y, 17.26), (0.24, 1.1, 0.12), mat_dark_steel)

    # 10 L-Acoustics K2 Enclosures arranged in an authentic progressive downward curve (J-Curve)
    # Dimensions: 1.34m width, 0.36m height, 0.48m depth
    speaker_w = 1.34
    speaker_h = 0.35
    speaker_d = 0.48

    # Progressive downward angles (radians)
    angles_deg = [1.5, 3.5, 6.0, 9.0, 12.5, 16.5, 21.0, 26.5, 33.0, 40.0]

    current_z = 16.85
    current_y = array_center_y

    for idx, deg in enumerate(angles_deg):
        rad = math.radians(deg)
        # Enclosure center position
        box_center = (0, current_y, current_z)

        # Main trapezoid cabinet body
        build_box(f'K2_Cabinet_{idx}', box_center, (speaker_w, speaker_d, speaker_h), mat_speaker_body, rot_x=-rad)

        # Front acoustic steel grille face (offset forward in local -Y rotated direction)
        # Local offset along normal: dy = -speaker_d/2 - 0.01, dz = 0
        gf_y = current_y - (speaker_d / 2.0 + 0.01) * math.cos(rad)
        gf_z = current_z - (speaker_d / 2.0 + 0.01) * math.sin(rad)
        build_box(f'K2_Grille_{idx}', (0, gf_y, gf_z), (speaker_w - 0.08, 0.02, speaker_h - 0.04), mat_speaker_grille, rot_x=-rad)

        # Side rigging plates and captive pins
        for rx in [-speaker_w / 2.0 - 0.01, speaker_w / 2.0 + 0.01]:
            build_box(f'K2_RigPlate_{idx}_{rx}', (rx, current_y, current_z), (0.02, speaker_d * 0.7, 0.12), mat_rigging_pins, rot_x=-rad)

        # Step to next lower speaker:
        # Step down along speaker height vector rotated by rad
        step_z = speaker_h * math.cos(rad) + 0.02
        step_y = speaker_h * math.sin(rad)
        current_z -= step_z
        current_y += step_y # Curves back towards mast

    # Rear pull-back chain connecting bottom module (at current_z, current_y) back to mast
    build_tube_between('Array_PullBack_Chain', (0, current_y + 0.2, current_z), (0, -0.4, current_z + 1.2), 0.014, mat_dark_steel)

    # =========================================================================
    # 5. UNIKALNY KOŁOWY TRUSS OŚWIETLENIOWY (Unique Circular Lighting Rig)
    # =========================================================================
    # Mounted around mast at Z = 19.0m!
    # Ring diameter = 4.2m (radius R = 2.1m)
    # Circular truss composed of top tube ring (Z=19.2m) and bottom tube ring (Z=18.8m)
    ring_r = 2.1
    ring_z_top = 19.2
    ring_z_btm = 18.8
    ring_segs = 32

    # Ring chords: polygonal approximation with tubes
    for i in range(ring_segs):
        a1 = (i / ring_segs) * 2 * math.pi
        a2 = ((i + 1) / ring_segs) * 2 * math.pi
        p1_top = (math.cos(a1) * ring_r, math.sin(a1) * ring_r, ring_z_top)
        p2_top = (math.cos(a2) * ring_r, math.sin(a2) * ring_r, ring_z_top)
        build_tube_between(f'RingChord_Top_{i}', p1_top, p2_top, 0.025, mat_truss)

        p1_btm = (math.cos(a1) * ring_r, math.sin(a1) * ring_r, ring_z_btm)
        p2_btm = ((math.cos(a2) * ring_r), math.sin(a2) * ring_r, ring_z_btm)
        build_tube_between(f'RingChord_Btm_{i}', p1_btm, p2_btm, 0.025, mat_truss)

        # Vertical spacer between rings
        build_tube_between(f'RingSpacer_{i}', p1_top, p1_btm, 0.016, mat_truss)

    # 4 Radial Outrigger Spoke Arms connecting circular ring firmly to the mast
    for s_angle in [0.0, math.pi / 2.0, math.pi, 3 * math.pi / 2.0]:
        px = math.cos(s_angle)
        py = math.sin(s_angle)
        p_mast = (px * 0.42, py * 0.42, 19.0)
        p_ring = (px * ring_r, py * ring_r, 19.0)
        build_tube_between(f'Ring_Spoke_{s_angle:.2f}', p_mast, p_ring, 0.04, mat_truss)

    # A) 8 MATRIX BLINDERS on top of the circular ring (Z = 19.4m)
    num_blinders = 8
    for i in range(num_blinders):
        a = (i / num_blinders) * 2 * math.pi
        bx = math.cos(a) * ring_r
        by = math.sin(a) * ring_r
        # Bracket
        build_box(f'Blinder_Bracket_{i}', (bx, by, ring_z_top + 0.1), (0.24, 0.24, 0.08), mat_dark_steel, rot_z=-a)
        # Blinder housing
        build_box(f'Blinder_Housing_{i}', (bx, by, ring_z_top + 0.24), (0.42, 0.18, 0.32), mat_dark_steel, rot_z=-a)
        # Warm White Emissive LED matrix face
        # Offset slightly outward
        face_x = bx + math.cos(a) * 0.1
        face_y = by + math.sin(a) * 0.1
        build_box(f'Blinder_Face_{i}', (face_x, face_y, ring_z_top + 0.24), (0.38, 0.04, 0.28), mat_blinder_emissive, rot_z=-a)

    # B) 12 ROBE POINTE MOVING HEADS hanging under the circular ring (Z = 18.4m)
    num_heads = 12
    for i in range(num_heads):
        a = (i / num_heads) * 2 * math.pi
        hx = math.cos(a) * ring_r
        hy = math.sin(a) * ring_r

        # 1. Base clamp & power box on bottom ring chord
        build_box(f'Head_Base_{i}', (hx, hy, ring_z_btm - 0.08), (0.28, 0.28, 0.12), mat_moving_head, rot_z=-a)

        # 2. Rotating U-Yoke arm
        build_box(f'Head_Yoke_{i}', (hx, hy, ring_z_btm - 0.25), (0.32, 0.12, 0.24), mat_moving_head, rot_z=-a)

        # 3. Moving Head Barrel / Projector body
        # Angled dynamically: pitch pointing down & outwards (~25° to 45° tilt)
        tilt = math.radians(35.0)
        barrel_z = ring_z_btm - 0.42
        build_cylinder(f'Head_Barrel_{i}', (hx, hy, barrel_z), 0.14, 0.38, segments=10, material=mat_moving_head,
                       rot_x=-tilt * math.sin(a), rot_y=tilt * math.cos(a), rot_z=-a)

        # 4. Front circular high-power projector lens (Cyan/Blue Emissive)
        lens_offset = 0.2
        lx = hx + math.cos(a) * math.sin(tilt) * lens_offset
        ly = hy + math.sin(a) * math.sin(tilt) * lens_offset
        lz = barrel_z - math.cos(tilt) * lens_offset
        build_cylinder(f'Head_Lens_{i}', (lx, ly, lz), 0.11, 0.04, segments=12, material=mat_lens_emissive,
                       rot_x=-tilt * math.sin(a), rot_y=tilt * math.cos(a), rot_z=-a)

    # =========================================================================
    # 6. GROUND EQUIPMENT (400V Power Distro & Amplifier Racks on Base)
    # =========================================================================
    # 400V Main Distribution Box with CEE connectors
    build_box('Power_Distro_400V', (-1.2, 0.8, 0.85), (0.75, 0.55, 0.85), mat_dark_steel)
    build_cylinder('Distro_Lid_Handle', (-1.2, 0.8, 1.3), 0.04, 0.35, segments=8, material=mat_truss)

    # 2 Touring Amplifier Flight Cases (LA12X Amp Racks)
    build_box('FlightCase_Rack1', (1.2, -0.6, 0.75), (0.68, 0.72, 0.75), mat_dark_steel)
    build_box('FlightCase_Rack2', (1.2, 0.3, 0.75), (0.68, 0.72, 0.75), mat_dark_steel)
    # Silver aluminum edge extrusions on flight cases
    build_box('Case_Trim1', (1.2, -0.6, 1.14), (0.7, 0.74, 0.04), mat_truss)
    build_box('Case_Trim2', (1.2, 0.3, 1.14), (0.7, 0.74, 0.04), mat_truss)

    # Export to GLB
    output_path = Path(output_glb).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Exporting PA Tower model to {output_path}...")
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True
    )
    print(f"Successfully generated blueprint-accurate PA Delay Tower: {output_path}")

if __name__ == '__main__':
    repo_root = Path(__file__).resolve().parents[2]
    out_dir = repo_root / 'public' / 'game-assets' / 'world' / 'festival'
    out_file = out_dir / 'delay_tower.glb'
    build_blueprint_delay_tower(out_file)
