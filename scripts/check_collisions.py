import re

def parse_tents():
    with open('src/game/world/campLayout.ts', 'r', encoding='utf-8') as f:
        content = f.read()
    
    tents = []
    # match T01..T15
    # position: campPosition(x, z) or [-x, 0, -z]
    # campPosition(x, z) = [x - 50, 0, z - 50]
    # collider: { type: 'box', size: [w, d] }
    # Let's extract tent blocks
    pattern = re.compile(r"id:\s*'(T\d+)',.*?position:\s*(?:campPosition\((\d+),\s*(\d+)\)|\[(-?\d+),\s*0,\s*(-?\d+)\]).*?collider:\s*\{\s*type:\s*'box',\s*size:\s*\[([\d\.]+),\s*([\d\.]+)\]", re.DOTALL)
    for m in pattern.finditer(content):
        tid = m.group(1)
        if m.group(2) is not None:
            px = float(m.group(2)) - 50
            pz = float(m.group(3)) - 50
        else:
            px = float(m.group(4))
            pz = float(m.group(5))
        size_w = float(m.group(6))
        size_d = float(m.group(7))
        tents.append({
            'id': tid,
            'x': px,
            'z': pz,
            'minX': px - size_w / 2,
            'maxX': px + size_w / 2,
            'minZ': pz - size_d / 2,
            'maxZ': pz + size_d / 2,
        })
    return tents

def parse_market():
    stalls = []
    # index 0: siemaShop, x=75, z=-50, box: x +- 12.15, z +- 9.15
    stalls.append({'id': 'Market_1 (siemaShop)', 'minX': 75 - 12.15, 'maxX': 75 + 12.15, 'minZ': -50 - 9.15, 'maxZ': -50 + 9.15})
    # index 1..5: x = -100 + (index-1)*7, z = -43
    for i in range(1, 6):
        x = -100 + (i - 1) * 7
        stalls.append({'id': f'Market_{i+1}', 'minX': x - 2.45, 'maxX': x + 2.45, 'minZ': -43 - 2.15, 'maxZ': -43 + 2.05})
    # index 6..17: x = -33 + (index-6)*7, z = -43
    for i in range(6, 18):
        x = -33 + (i - 6) * 7
        stalls.append({'id': f'Market_{i+1}', 'minX': x - 2.45, 'maxX': x + 2.45, 'minZ': -43 - 2.15, 'maxZ': -43 + 2.05})
    return stalls

def overlaps(a, b):
    return a['minX'] < b['maxX'] and a['maxX'] > b['minX'] and a['minZ'] < b['maxZ'] and a['maxZ'] > b['minZ']

def main():
    tents = parse_tents()
    stalls = parse_market()
    print(f"Checking {len(tents)} tents against {len(stalls)} market stalls:")
    conflicts = 0
    for t in tents:
        for s in stalls:
            if overlaps(t, s):
                print(f"CONFLICT: Tent {t['id']} at ({t['x']}, {t['z']}) collides with {s['id']} ([{s['minX']:.1f}, {s['maxX']:.1f}], [{s['minZ']:.1f}, {s['maxZ']:.1f}])")
                conflicts += 1
    if conflicts == 0:
        print(">> SUCCESS: Zero collisions between tents and market stalls.")
    else:
        print(f">> FOUND {conflicts} COLLISIONS.")

if __name__ == '__main__':
    main()
