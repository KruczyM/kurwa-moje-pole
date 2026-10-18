import math
import os

# Parametry rzutowania
WIDTH = 1400
HEIGHT = 1400
ORIGIN_X = 660
ORIGIN_Y = 660
SCALE = 32.0  # pikseli na metr

def w2s(x, z):
    """Przelicza współrzędne świata gry (X, Z) na piksele SVG (sx, sy)."""
    return ORIGIN_X + x * SCALE, ORIGIN_Y + z * SCALE

def camp_pos(xp, yp):
    return (xp / 100.0 - 0.5) * 30.0, (yp / 100.0 - 0.5) * 30.0

# 1. NAMIOTY
tents = [
    {
        'id': 'T01', 'label': 'Rodzinny T01', 'model': 'big2', 'xp': 24, 'yp': 17,
        'rot': 1.5 * math.pi, 'psize': (7.56, 5.04, 11.592), 'csize': (5.2, 7.6),
        'color': '#4a6042', 'border': '#2d3b28', 'desc': 'Największy namiot wojskowy/rodzinny'
    },
    {
        'id': 'T02', 'label': 'Namiot T02', 'model': 'small', 'xp': 44, 'yp': 16,
        'rot': -0.052, 'psize': (4.2, 2.8, 3.6), 'csize': (4.2, 3.6),
        'color': '#3f784e', 'border': '#254a30', 'desc': 'Mały namiot igloo'
    },
    {
        'id': 'T03', 'label': 'Namiot T03', 'model': 'blue', 'xp': 57, 'yp': 16,
        'rot': 0.0, 'psize': (4.2, 2.8, 3.6), 'csize': (4.2, 3.6),
        'color': '#3d6c96', 'border': '#244563', 'desc': 'Niebieski namiot igloo'
    },
    {
        'id': 'T04', 'label': 'Namiot T04', 'model': 'white', 'xp': 71, 'yp': 17,
        'rot': 0.052, 'psize': (4.2, 2.8, 3.6), 'csize': (4.2, 3.6),
        'color': '#d8d4c7', 'border': '#8a8575', 'desc': 'Biały namiot igloo'
    },
    {
        'id': 'T05', 'label': 'Namiot T05', 'model': 'small2', 'xp': 88, 'yp': 21,
        'rot': 0.262, 'psize': (4.2, 2.8, 3.6), 'csize': (4.2, 3.6),
        'color': '#588252', 'border': '#355231', 'desc': 'Kopułowy namiot small2'
    },
    {
        'id': 'T06', 'label': 'Namiot T06', 'model': 'small', 'xp': 10, 'yp': 40,
        'rot': -0.052, 'psize': (4.2, 2.8, 3.6), 'csize': (4.2, 3.6),
        'color': '#3f784e', 'border': '#254a30', 'desc': 'Mały namiot boczny zachodni'
    },
    {
        'id': 'T07', 'label': 'Namiot T07', 'model': 'colorful', 'xp': 83, 'yp': 39,
        'rot': 0.0, 'psize': (4.2, 2.8, 3.6), 'csize': (4.2, 3.6),
        'color': '#c25c38', 'border': '#7a361e', 'desc': 'Kolorowy namiot wschodni'
    },
    {
        'id': 'T08', 'label': 'Namiot T08', 'model': 'blueOrange', 'xp': 11, 'yp': 62,
        'rot': 0.0, 'psize': (4.2, 2.8, 3.6), 'csize': (4.2, 3.6),
        'color': '#d47a37', 'border': '#80451a', 'desc': 'Niebiesko-pomarańczowy szeroki'
    },
    {
        'id': 'T09', 'label': 'Rodzinny T09', 'model': 'large', 'xp': 29, 'yp': 64,
        'rot': -0.105, 'psize': (4.1975, 2.8, 6.44), 'csize': (4.1975, 6.44),
        'color': '#2a5944', 'border': '#163628', 'desc': 'Duży tunelowy namiot rodzinny'
    },
    {
        'id': 'T10', 'label': 'Namiot T10', 'model': 'small', 'xp': 45, 'yp': 65,
        'rot': -0.087, 'psize': (4.2, 2.8, 3.6), 'csize': (4.2, 3.6),
        'color': '#3f784e', 'border': '#254a30', 'desc': 'Mały namiot igloo'
    },
    {
        'id': 'T11', 'label': 'Namiot T11', 'model': 'blue', 'xp': 63, 'yp': 65,
        'rot': -0.122, 'psize': (4.2, 2.8, 3.6), 'csize': (4.2, 3.6),
        'color': '#3d6c96', 'border': '#244563', 'desc': 'Niebieski namiot igloo'
    },
    {
        'id': 'T12', 'label': 'Namiot T12', 'model': 'colorful', 'xp': 76, 'yp': 62,
        'rot': -0.105, 'psize': (4.2, 2.8, 3.6), 'csize': (4.2, 3.6),
        'color': '#c25c38', 'border': '#7a361e', 'desc': 'Kolorowy namiot południowo-wschodni'
    },
    {
        'id': 'T13', 'label': 'Namiot T13', 'model': 'white', 'xp': 22, 'yp': 82,
        'rot': -0.122, 'psize': (4.2, 2.8, 3.6), 'csize': (4.2, 3.6),
        'color': '#d8d4c7', 'border': '#8a8575', 'desc': 'Biały namiot rząd dolny'
    },
    {
        'id': 'T14', 'label': 'Rodzinny T14', 'model': 'large', 'xp': 37, 'yp': 83,
        'rot': -0.087, 'psize': (4.1975, 2.8, 6.44), 'csize': (4.1975, 6.44),
        'color': '#2a5944', 'border': '#163628', 'desc': 'Duży tunelowy namiot rodzinny'
    },
    {
        'id': 'T15', 'label': 'Namiot T15', 'model': 'small2', 'xp': 62, 'yp': 83,
        'rot': 0.052, 'psize': (4.2, 2.8, 3.6), 'csize': (4.2, 3.6),
        'color': '#588252', 'border': '#355231', 'desc': 'Kopułowy namiot rząd dolny'
    },
]

# 2. SEKTORY TRAWIASTE
camp_sectors = [
    {'minX': -14.2, 'maxX': -0.6, 'minZ': -14.2, 'maxZ': -7.0, 'name': 'Sektor Północny - Zachód'},
    {'minX': 0.8, 'maxX': 14.2, 'minZ': -14.2, 'maxZ': -7.0, 'name': 'Sektor Północny - Wschód'},
    {'minX': -14.2, 'maxX': -0.6, 'minZ': 2.8, 'maxZ': 7.0, 'name': 'Sektor SW - Górny'},
    {'minX': -14.2, 'maxX': -0.6, 'minZ': 8.2, 'maxZ': 14.2, 'name': 'Sektor SW - Dolny'},
    {'minX': 0.8, 'maxX': 14.2, 'minZ': 2.8, 'maxZ': 7.0, 'name': 'Sektor SE - Górny'},
    {'minX': 0.8, 'maxX': 14.2, 'minZ': 8.2, 'maxZ': 14.2, 'name': 'Sektor SE - Dolny'},
    {'minX': -14.2, 'maxX': -9.2, 'minZ': -6.0, 'maxZ': 1.8, 'name': 'Sektor Boczny W przy T06'},
    {'minX': 7.2, 'maxX': 14.2, 'minZ': -6.0, 'maxZ': 1.8, 'name': 'Sektor Boczny E przy T07'},
]

# 3. DROGI POŻAROWE
fire_roads = [
    {'minX': -16.0, 'maxX': 16.0, 'minZ': -7.0, 'maxZ': -4.8, 'name': 'Północna Droga Pożarowa W-E'},
    {'minX': -16.0, 'maxX': 16.0, 'minZ': 1.2, 'maxZ': 2.8, 'name': 'Południowa Droga Pożarowa W-E'},
    {'minX': -16.0, 'maxX': 16.0, 'minZ': 7.0, 'maxZ': 8.2, 'name': 'Droga Międzyrzędowa Południe W-E'},
    {'minX': -0.6, 'maxX': 0.8, 'minZ': -16.0, 'maxZ': 16.0, 'name': 'Główna Aleja N-S'},
    {'minX': -14.8, 'maxX': -10.4, 'minZ': -11.2, 'maxZ': -6.0, 'name': 'Aleja Dojazdowa Do Toi-Toia'},
    {'minX': -17.0, 'maxX': -14.2, 'minZ': -17.0, 'maxZ': 17.0, 'name': 'Obwodnica Zachodnia'},
    {'minX': 14.2, 'maxX': 17.0, 'minZ': -17.0, 'maxZ': 17.0, 'name': 'Obwodnica Wschodnia'},
    {'minX': -17.0, 'maxX': 17.0, 'minZ': -17.0, 'maxZ': -14.2, 'name': 'Obwodnica Północna'},
    {'minX': -17.0, 'maxX': 17.0, 'minZ': 14.2, 'maxZ': 17.0, 'name': 'Obwodnica Południowa'},
]

# 4. KRZESŁA S01-S08
mdx, mdz = camp_pos(48, 37)
offset_distance = 1.0
seats = []
for index in range(8):
    angle = (index / 8.0) * math.pi * 2
    lx = math.cos(angle) * 3.15
    lz = math.sin(angle) * 2.35
    l = math.sqrt(lx * lx + lz * lz)
    if l > 0:
        lx += (lx / l) * offset_distance
        lz += (lz / l) * offset_distance
    wx = mdx + lx
    wz = mdz + lz
    rot_y = math.atan2(-lx, -lz) + math.pi
    seats.append({
        'id': f'S{index+1:02d}',
        'wx': wx, 'wz': wz,
        'rot': rot_y
    })

# 5. POSTACIE NPC
npc_data = [
    {'name': 'Amper', 'wx': -2.0, 'wz': -1.0, 'desc': 'Głośnik JBL, pod Mad Dogiem', 'color': '#ff4757'},
    {'name': 'Antena', 'wx': 1.0, 'wz': -1.0, 'desc': 'Rozmowa, pod Mad Dogiem', 'color': '#ffa502'},
    {'name': 'Gruczoł', 'wx': 2.4, 'wz': 1.0, 'desc': 'Przy krawędzi Mad Dog / Fladze', 'color': '#2ed573'},
    {'name': 'Klątwa', 'wx': -2.6, 'wz': 1.2, 'desc': 'Na południe od Mad Doga', 'color': '#1e90ff'},
    {'name': 'Krwiak', 'wx': 0.0, 'wz': 1.3, 'desc': 'Na głównej alei przy fladze', 'color': '#e84118'},
    {'name': 'Pień', 'wx': 4.8, 'wz': 2.7, 'desc': 'aka Peposz, na południowej drodze', 'color': '#9b59b6'},
    {'name': 'Pierścień', 'wx': 7.0, 'wz': -4.0, 'desc': 'Przejście wschodnie przy T07', 'color': '#00d2d3'},
    {'name': 'Zawór', 'wx': -8.0, 'wz': 5.0, 'desc': 'Sektor SW przy namiocie T09', 'color': '#57606f'},
]

# 6. PRZEDMIOTY NA STOLE
table_items = [
    {'id': 'cigarette', 'name': 'Papieros', 'lx': 0.0, 'lz': 0.18, 'color': '#ffffff', 'desc': 'Pojedynczy papieros z filtrem'},
    {'id': 'joint', 'name': 'Blant', 'lx': -0.82, 'lz': -0.18, 'color': '#7bed9f', 'desc': 'Zwijany blant z dobrym ziołem'},
    {'id': 'cocaine', 'name': 'Kreska', 'lx': -0.41, 'lz': 0.18, 'color': '#f1f2f6', 'desc': 'Biała kreska na blacie stołu'},
    {'id': 'mdma', 'name': 'MDMA', 'lx': 0.0, 'lz': -0.18, 'color': '#70a1ff', 'desc': 'Piguła MDMA'},
    {'id': 'mushrooms', 'name': 'Grzyby', 'lx': 0.41, 'lz': 0.18, 'color': '#eccc68', 'desc': 'Suszone grzybki halucynogenne'},
    {'id': 'lsd', 'name': 'LSD', 'lx': 0.68, 'lz': 0.12, 'color': '#ff6b81', 'desc': 'Kartonik LSD'}
]

# BUDUJEMY PLIK SVG
svg_parts = []
svg_parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" width="100%" height="100%" style="background:#1b2e17; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;">')

# Definicje styli i filtrów
svg_parts.append('''
<defs>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="3" dy="5" stdDeviation="4" flood-color="#000000" flood-opacity="0.45" />
  </filter>
  <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="3" result="blur" />
    <feComposite in="SourceGraphic" in2="blur" operator="over" />
  </filter>
  <radialGradient id="compassGrad" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#2c3e50" stop-opacity="0.8" />
    <stop offset="100%" stop-color="#1a252f" stop-opacity="0.95" />
  </radialGradient>
  <linearGradient id="flagPoleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#f5f6fa" />
    <stop offset="100%" stop-color="#718093" />
  </linearGradient>
  <pattern id="grid1m" width="32" height="32" patternUnits="userSpaceOnUse">
    <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
  </pattern>
</defs>
''')

# 1. Tło siatki terenu
svg_parts.append(f'<rect width="{WIDTH}" height="{HEIGHT}" fill="#1c3017" />')
svg_parts.append(f'<rect width="{WIDTH}" height="{HEIGHT}" fill="url(#grid1m)" />')

# Pasy dróg pożarowych (podłoże wydeptane - gleba/piasek)
svg_parts.append('<!-- DROGI POŻAROWE -->')
for road in fire_roads:
    x1, z1 = w2s(road['minX'], road['minZ'])
    x2, z2 = w2s(road['maxX'], road['maxZ'])
    rw = x2 - x1
    rh = z2 - z1
    svg_parts.append(f'<rect x="{x1:.1f}" y="{z1:.1f}" width="{rw:.1f}" height="{rh:.1f}" fill="#726146" rx="4" opacity="0.85"><title>{road["name"]}</title></rect>')

# Sektory bujnej trawy obozowej
svg_parts.append('<!-- SEKTORY TRAWIASTE -->')
for sector in camp_sectors:
    x1, z1 = w2s(sector['minX'], sector['minZ'])
    x2, z2 = w2s(sector['maxX'], sector['maxZ'])
    sw = x2 - x1
    sh = z2 - z1
    svg_parts.append(f'<rect x="{x1:.1f}" y="{z1:.1f}" width="{sw:.1f}" height="{sh:.1f}" fill="#2e5223" rx="8" stroke="#3b692d" stroke-width="1.5" opacity="0.9"><title>{sector["name"]}</title></rect>')

# Siatka metryczna z osiami
svg_parts.append('<!-- OSIE WSPÓŁRZĘDNYCH -->')
for m in range(-16, 17, 2):
    # Pionowe linie (X)
    sx, _ = w2s(m, 0)
    alpha = "0.2" if m % 5 == 0 else "0.08"
    thick = "1.5" if m % 5 == 0 else "1.0"
    if m == 0:
        alpha, thick = "0.5", "2.0"
    svg_parts.append(f'<line x1="{sx:.1f}" y1="80" x2="{sx:.1f}" y2="1240" stroke="rgba(255,255,255,{alpha})" stroke-width="{thick}" stroke-dasharray="{"none" if m==0 else "3,3"}"/>')
    if m % 5 == 0:
        svg_parts.append(f'<text x="{sx:.1f}" y="70" fill="#a4b0be" font-size="11" font-weight="bold" text-anchor="middle">{m}m</text>')
        svg_parts.append(f'<text x="{sx:.1f}" y="1255" fill="#a4b0be" font-size="11" font-weight="bold" text-anchor="middle">{m}m</text>')

for m in range(-16, 17, 2):
    # Poziome linie (Z)
    _, sy = w2s(0, m)
    alpha = "0.2" if m % 5 == 0 else "0.08"
    thick = "1.5" if m % 5 == 0 else "1.0"
    if m == 0:
        alpha, thick = "0.5", "2.0"
    svg_parts.append(f'<line x1="80" y1="{sy:.1f}" x2="1240" y2="{sy:.1f}" stroke="rgba(255,255,255,{alpha})" stroke-width="{thick}" stroke-dasharray="{"none" if m==0 else "3,3"}"/>')
    if m % 5 == 0:
        svg_parts.append(f'<text x="65" y="{sy+4:.1f}" fill="#a4b0be" font-size="11" font-weight="bold" text-anchor="end">{m}m</text>')
        svg_parts.append(f'<text x="1255" y="{sy+4:.1f}" fill="#a4b0be" font-size="11" font-weight="bold" text-anchor="start">{m}m</text>')

# 2. CENTRALNY MAD DOG
md_sx, md_sy = w2s(mdx, mdz)
md_w = 22.316 * SCALE
md_h = 22.232 * SCALE
svg_parts.append('<!-- MAD DOG CANOPY -->')
svg_parts.append(f'''
<g id="MadDogCanopy">
  <rect x="{md_sx - md_w/2:.1f}" y="{md_sy - md_h/2:.1f}" width="{md_w:.1f}" height="{md_h:.1f}" 
        fill="rgba(20, 20, 24, 0.45)" rx="16" stroke="#121214" stroke-width="3" stroke-dasharray="8,4" filter="url(#shadow)">
    <title>Zadaszenie Mad Dog (22.3m × 22.2m) - otwarte ze wszystkich stron, ochrona przed słońcem</title>
  </rect>
  <text x="{md_sx - md_w/2 + 20:.1f}" y="{md_sy - md_h/2 + 30:.1f}" fill="#f1f2f6" font-size="14" font-weight="900" letter-spacing="2">MAD DOG (ZADASZENIE 22.3m × 22.2m)</text>
  <text x="{md_sx - md_w/2 + 20:.1f}" y="{md_sy - md_h/2 + 48:.1f}" fill="#ced6e0" font-size="11">Brak kolizji wewnętrznej • Swobodne przejście i cień</text>
</g>
''')

# 3. STÓŁ BIESIADNY (CampTable)
table_rot_deg = math.degrees(-0.5)
tbl_w = 2.4 * SCALE
tbl_h = 1.2 * SCALE
svg_parts.append('<!-- STÓŁ BIESIADNY -->')
svg_parts.append(f'''
<g id="CampTable" transform="translate({md_sx:.1f}, {md_sy:.1f}) rotate({table_rot_deg:.1f})" filter="url(#shadow)">
  <rect x="{-tbl_w/2:.1f}" y="{-tbl_h/2:.1f}" width="{tbl_w:.1f}" height="{tbl_h:.1f}" 
        fill="#5c3818" rx="6" stroke="#3d240d" stroke-width="2">
    <title>Stół Biesiadny pod Mad Dogiem (2.4m × 1.2m, r=1.35m kolizja)</title>
  </rect>
  <text x="0" y="4" fill="#f5cd79" font-size="10" font-weight="bold" text-anchor="middle" transform="rotate({-table_rot_deg:.1f})">STÓŁ (UŻYWKI)</text>
''')
# Rysujemy przedmioty na stole
for it in table_items:
    it_x = it['lx'] * SCALE
    it_z = it['lz'] * SCALE
    svg_parts.append(f'''
  <circle cx="{it_x:.1f}" cy="{it_z:.1f}" r="4.5" fill="{it['color']}" stroke="#1e272e" stroke-width="1.5">
    <title>{it['name']} ({it['id']}): {it['desc']}</title>
  </circle>
''')
svg_parts.append('</g>')

# 4. KRZESŁA S01-S08
svg_parts.append('<!-- KRZESŁA S01-S08 -->')
for seat in seats:
    ssx, ssy = w2s(seat['wx'], seat['wz'])
    sdeg = math.degrees(seat['rot'])
    svg_parts.append(f'''
<g id="{seat['id']}" transform="translate({ssx:.1f}, {ssy:.1f}) rotate({sdeg:.1f})" filter="url(#shadow)">
  <circle cx="0" cy="0" r="{0.48 * SCALE:.1f}" fill="none" stroke="rgba(56, 92, 130, 0.4)" stroke-width="1" stroke-dasharray="2,2"/>
  <rect x="-8" y="-8" width="16" height="16" rx="3" fill="#2980b9" stroke="#1c5980" stroke-width="1.5">
    <title>Miejsce siedzące {seat['id']} (Usiądź: E)</title>
  </rect>
  <line x1="-8" y1="-8" x2="8" y2="-8" stroke="#f1c40f" stroke-width="2.5" />
  <text x="0" y="18" fill="#ecf0f1" font-size="9" font-weight="bold" text-anchor="middle" transform="rotate({-sdeg:.1f})">{seat['id']}</text>
</g>
''')

# 5. TOI-TOI (wcTron) & SPAWN GRACZA
tx, tz = camp_pos(8, 18)
tsx, tsy = w2s(tx, tz)
tw = 1.5 * SCALE
th = 1.5 * SCALE
svg_parts.append('<!-- TOI-TOI wcTron -->')
svg_parts.append(f'''
<g id="ToiletWcTron" transform="translate({tsx:.1f}, {tsy:.1f})" filter="url(#shadow)">
  <rect x="{-tw/2:.1f}" y="{-th/2:.1f}" width="{tw:.1f}" height="{th:.1f}" 
        fill="#2980b9" rx="4" stroke="#1b4f72" stroke-width="2.5">
    <title>wcTron (Toi-Toi) wys. 3.6m - Interakcja: E Wejdź do toi-toia</title>
  </rect>
  <!-- Dach / wywietrznik -->
  <rect x="{-tw/3:.1f}" y="{-th/3:.1f}" width="{2*tw/3:.1f}" height="{2*th/3:.1f}" fill="#3498db" rx="2"/>
  <!-- Drzwi (od południa) -->
  <line x1="{-tw/2+4:.1f}" y1="{th/2:.1f}" x2="{tw/2-4:.1f}" y2="{th/2:.1f}" stroke="#e74c3c" stroke-width="3" />
  <text x="0" y="-14" fill="#ffffff" font-size="11" font-weight="bold" text-anchor="middle">wcTron</text>
  <text x="0" y="4" fill="#f1f2f6" font-size="9" font-weight="bold" text-anchor="middle">TOI-TOI</text>
</g>
''')

# Spawn gracza
px, pz = tx, tz + 2.8
psx, psy = w2s(px, pz)
# Kąt do środka obozu: atan2(-12.6, -6.8)
spawn_angle_deg = math.degrees(math.atan2(px, pz))
svg_parts.append('<!-- SPAWN GRACZA -->')
svg_parts.append(f'''
<g id="PlayerSpawn" transform="translate({psx:.1f}, {psy:.1f})" filter="url(#glow)">
  <circle cx="0" cy="0" r="16" fill="rgba(46, 204, 113, 0.25)" stroke="#2ecc71" stroke-width="2" stroke-dasharray="3,2"/>
  <circle cx="0" cy="0" r="7" fill="#2ecc71" stroke="#ffffff" stroke-width="2">
    <title>Początkowy Spawn Gracza (x={px:.2f}m, z={pz:.2f}m)</title>
  </circle>
  <!-- Strzałka kierunku patrzenia -->
  <g transform="rotate({spawn_angle_deg+90:.1f})">
    <line x1="0" y1="0" x2="22" y2="0" stroke="#2ecc71" stroke-width="3" />
    <polygon points="26,0 18,-5 18,5" fill="#2ecc71" />
  </g>
  <text x="0" y="28" fill="#2ecc71" font-size="10" font-weight="bold" text-anchor="middle">SPAWN GRACZA</text>
</g>
''')

# 6. MASZT Z FLAGĄ (CampFlag)
fx, fz = camp_pos(52, 52)
fsx, fsy = w2s(fx, fz)
svg_parts.append('<!-- FLAGA OBOZOWA -->')
svg_parts.append(f'''
<g id="CampFlag" transform="translate({fsx:.1f}, {fsy:.1f})" filter="url(#shadow)">
  <!-- Fundament i promień kolizji masztu -->
  <circle cx="0" cy="0" r="{0.28*SCALE:.1f}" fill="#2f3542" stroke="#ffffff" stroke-width="1.5">
    <title>Maszt flagi #kurwamojepole (wys. 16.4m, r=0.28m)</title>
  </circle>
  <circle cx="0" cy="0" r="12" fill="none" stroke="#f1c40f" stroke-width="2" stroke-dasharray="4,2"/>
  <!-- Płat flagi -->
  <path d="M 0 0 L 28 -8 L 28 10 L 0 4 Z" fill="#e74c3c" stroke="#c0392b" stroke-width="1.5" />
  <text x="34" y="5" fill="#f1c40f" font-size="11" font-weight="bold">#FLAGA (16.4m)</text>
  <text x="34" y="18" fill="#ecf0f1" font-size="9">#kurwamojepole</text>
</g>
''')

# 7. NAMIOTY T01-T15
svg_parts.append('<!-- NAMIOTY T01-T15 -->')
for t in tents:
    tx_val, tz_val = camp_pos(t['xp'], t['yp'])
    tsx, tsy = w2s(tx_val, tz_val)
    rot_deg = math.degrees(t['rot'])
    
    # Szerokość i długość kolizji w pikselach
    cw = t['csize'][0] * SCALE
    cd = t['csize'][1] * SCALE
    
    # Rozmiar fizyczny (pełny obrys)
    pw = t['psize'][0] * SCALE
    pd = t['psize'][2] * SCALE
    
    svg_parts.append(f'''
<g id="Tent_{t['id']}" transform="translate({tsx:.1f}, {tsy:.1f}) rotate({rot_deg:.1f})" filter="url(#shadow)">
  <!-- Obrys fizyczny modelu (np. z linkami) -->
  <rect x="{-pw/2:.1f}" y="{-pd/2:.1f}" width="{pw:.1f}" height="{pd:.1f}" 
        fill="none" stroke="{t['border']}" stroke-width="1" stroke-dasharray="2,2" opacity="0.6"/>
  <!-- Collider właściwy namiotu (blokujący przejście) -->
  <rect x="{-cw/2:.1f}" y="{-cd/2:.1f}" width="{cw:.1f}" height="{cd:.1f}" 
        fill="{t['color']}" rx="5" stroke="{t['border']}" stroke-width="2.5">
    <title>{t['id']} - {t['label']} ({t['model']})\nWymiary: {t['psize'][0]:.2f}m x {t['psize'][2]:.2f}m, wys. {t['psize'][1]:.2f}m\nKolizja: {t['csize'][0]:.2f}m x {t['csize'][1]:.2f}m\nWspółrzędne świata: ({tx_val:.2f}m, {tz_val:.2f}m)\n{t['desc']}</title>
  </rect>
  <!-- Grzbiet namiotu (linia kalenicy) -->
  <line x1="0" y1="{-cd/2 + 4:.1f}" x2="0" y2="{cd/2 - 4:.1f}" stroke="rgba(255,255,255,0.45)" stroke-width="2"/>
  <!-- Etykieta ID -->
  <rect x="-18" y="-9" width="36" height="18" rx="3" fill="rgba(0,0,0,0.65)"/>
  <text x="0" y="4" fill="#ffffff" font-size="11" font-weight="900" text-anchor="middle">{t['id']}</text>
</g>
<!-- Zewnętrzny podpis pod namiotem -->
<text x="{tsx:.1f}" y="{tsy + (cd/2 if abs(t['rot']) < 1 else cw/2) + 14:.1f}" fill="#f1f2f6" font-size="10" font-weight="bold" text-anchor="middle" filter="url(#shadow)">{t['id']} ({t['model']})</text>
''')

# 8. POSTACIE NPC (Spawny)
svg_parts.append('<!-- POSTACIE NPC -->')
for npc in npc_data:
    nsx, nsy = w2s(npc['wx'], npc['wz'])
    svg_parts.append(f'''
<g id="NPC_{npc['name']}" transform="translate({nsx:.1f}, {nsy:.1f})" filter="url(#glow)">
  <circle cx="0" cy="0" r="10" fill="{npc['color']}" stroke="#ffffff" stroke-width="2">
    <title>NPC: {npc['name']}\nPoczątkowy spawn: ({npc['wx']:.2f}m, {npc['wz']:.2f}m)\n{npc['desc']}</title>
  </circle>
  <circle cx="0" cy="0" r="3.5" fill="#ffffff"/>
  <rect x="-24" y="-23" width="48" height="13" rx="3" fill="rgba(0,0,0,0.75)"/>
  <text x="0" y="-13" fill="#ffffff" font-size="9" font-weight="bold" text-anchor="middle">{npc['name']}</text>
''')
    if npc['name'] == 'Amper':
        # Dodaj ikonkę głośnika JBL
        svg_parts.append('''
  <g transform="translate(10, 2)">
    <rect x="0" y="-5" width="10" height="10" rx="2" fill="#eb4d4b" stroke="#ffffff" stroke-width="1"/>
    <text x="5" y="2" fill="#ffffff" font-size="6" font-weight="bold" text-anchor="middle">JBL</text>
  </g>
''')
    svg_parts.append('</g>')

# 9. RÓŻA WIATRÓW (Kompas)
cx = 1260
cy = 140
svg_parts.append(f'''
<!-- RÓŻA WIATRÓW / KOMPAS -->
<g id="Compass" transform="translate({cx}, {cy})" filter="url(#shadow)">
  <circle cx="0" cy="0" r="50" fill="url(#compassGrad)" stroke="#485460" stroke-width="2.5"/>
  <circle cx="0" cy="0" r="42" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
  
  <!-- Strzałka Północ (-Z) -->
  <polygon points="0,-38 7,-6 0,-12" fill="#e74c3c" />
  <polygon points="0,-38 -7,-6 0,-12" fill="#c0392b" />
  <!-- Strzałka Południe (+Z) -->
  <polygon points="0,38 7,6 0,12" fill="#ecf0f1" />
  <polygon points="0,38 -7,6 0,12" fill="#bdc3c7" />
  <!-- Strzałka Wschód (+X) -->
  <polygon points="38,0 6,7 12,0" fill="#ecf0f1" />
  <polygon points="38,0 6,-7 12,0" fill="#bdc3c7" />
  <!-- Strzałka Zachód (-X) -->
  <polygon points="-38,0 -6,7 -12,0" fill="#ecf0f1" />
  <polygon points="-38,0 -6,-7 -12,0" fill="#bdc3c7" />
  
  <text x="0" y="-42" fill="#e74c3c" font-size="14" font-weight="900" text-anchor="middle">N (-Z)</text>
  <text x="0" y="54" fill="#ecf0f1" font-size="12" font-weight="bold" text-anchor="middle">S (+Z)</text>
  <text x="52" y="4" fill="#ecf0f1" font-size="12" font-weight="bold" text-anchor="start">E (+X)</text>
  <text x="-52" y="4" fill="#ecf0f1" font-size="12" font-weight="bold" text-anchor="end">W (-X)</text>
  <circle cx="0" cy="0" r="3" fill="#f1c40f"/>
</g>
''')

# 10. TYTUŁ I SKALA
svg_parts.append(f'''
<!-- NAGŁÓWEK -->
<g id="Header" transform="translate(60, 50)">
  <rect x="0" y="0" width="460" height="75" rx="8" fill="rgba(20, 25, 20, 0.85)" stroke="#385c2c" stroke-width="1.5" filter="url(#shadow)"/>
  <text x="20" y="30" fill="#2ed573" font-size="20" font-weight="900" letter-spacing="1">#KURWAMOJEPOLE — PLAN OBOZU</text>
  <text x="20" y="50" fill="#f1f2f6" font-size="12">Aktualny stan runtime • Rzut z góry (Top-Down)</text>
  <text x="20" y="65" fill="#a4b0be" font-size="10">Pole 30×30m (świat 117.6m) • 1 jednostka = 1 metr • 1m = {SCALE:.0f}px</text>
</g>
''')

# 11. LEGENDA
svg_parts.append(f'''
<!-- LEGENDA -->
<g id="Legend" transform="translate(60, 1060)" filter="url(#shadow)">
  <rect x="0" y="0" width="520" height="200" rx="8" fill="rgba(18, 24, 18, 0.92)" stroke="#2ed573" stroke-width="1.5"/>
  <text x="20" y="24" fill="#2ed573" font-size="13" font-weight="900" letter-spacing="1">LEGENDA I IDENTYFIKACJA OBIEKTÓW</text>
  
  <!-- Kolumna 1: Namioty -->
  <g transform="translate(20, 42)">
    <rect x="0" y="0" width="16" height="12" fill="#4a6042" rx="2" stroke="#2d3b28"/>
    <text x="24" y="10" fill="#f1f2f6" font-size="11">T01 (big2 - rodzinny wielki 7.6×11.6m)</text>
    
    <rect x="0" y="18" width="16" height="12" fill="#2a5944" rx="2" stroke="#163628"/>
    <text x="24" y="28" fill="#f1f2f6" font-size="11">T09, T14 (dużynamiot - rodzinne 4.2×6.4m)</text>
    
    <rect x="0" y="36" width="16" height="12" fill="#3f784e" rx="2" stroke="#254a30"/>
    <text x="24" y="46" fill="#f1f2f6" font-size="11">T02, T06, T10 (small - małe igloo)</text>
    
    <rect x="0" y="54" width="16" height="12" fill="#3d6c96" rx="2" stroke="#244563"/>
    <text x="24" y="64" fill="#f1f2f6" font-size="11">T03, T11 (niebieski - standardowe)</text>
    
    <rect x="0" y="72" width="16" height="12" fill="#d8d4c7" rx="2" stroke="#8a8575"/>
    <text x="24" y="82" fill="#f1f2f6" font-size="11">T04, T13 (biały - standardowe)</text>

    <rect x="0" y="90" width="16" height="12" fill="#c25c38" rx="2" stroke="#7a361e"/>
    <text x="24" y="100" fill="#f1f2f6" font-size="11">T07, T12 (kolorowy) / T08 (nieb-pom)</text>

    <rect x="0" y="108" width="16" height="12" fill="#588252" rx="2" stroke="#355231"/>
    <text x="24" y="118" fill="#f1f2f6" font-size="11">T05, T15 (small2 - kopułowe)</text>
  </g>

  <!-- Kolumna 2: Obiekty i postacie -->
  <g transform="translate(300, 42)">
    <rect x="0" y="0" width="16" height="12" fill="#2980b9" rx="2" stroke="#1b4f72"/>
    <text x="24" y="10" fill="#f1f2f6" font-size="11">wcTron (Toi-Toi w rogu)</text>
    
    <circle cx="8" cy="24" r="6" fill="#2ecc71" stroke="#ffffff" stroke-width="1.5"/>
    <text x="24" y="28" fill="#f1f2f6" font-size="11">Spawn Gracza (2.8m przed WC)</text>
    
    <rect x="0" y="36" width="16" height="12" fill="rgba(20,20,24,0.7)" rx="2" stroke="#111"/>
    <text x="24" y="46" fill="#f1f2f6" font-size="11">Mad Dog (Zadaszenie 22.3×22.2m)</text>
    
    <circle cx="8" cy="60" r="5" fill="#f1c40f" stroke="#c0392b" stroke-width="1.5"/>
    <text x="24" y="64" fill="#f1f2f6" font-size="11">Flaga #kurwamojepole (16.4m)</text>
    
    <rect x="0" y="72" width="16" height="12" fill="#2980b9" rx="2" stroke="#f1c40f"/>
    <text x="24" y="82" fill="#f1f2f6" font-size="11">S01–S08 (8 Miejsc siedzących)</text>
    
    <circle cx="8" cy="96" r="6" fill="#ff4757" stroke="#ffffff" stroke-width="1.5"/>
    <text x="24" y="100" fill="#f1f2f6" font-size="11">NPC (Amper, Antena, Pień itd.)</text>

    <rect x="0" y="108" width="16" height="12" fill="#726146" rx="2"/>
    <text x="24" y="118" fill="#f1f2f6" font-size="11">Drogi pożarowe / dojazdowe</text>
  </g>
</g>
''')

# Zamknięcie SVG
svg_parts.append('</svg>')

svg_content = '\n'.join(svg_parts)

output_path = os.path.abspath('docs/camp-map.svg')
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(svg_content)

print(f'Wygenerowano mape SVG: {output_path} ({len(svg_content)} bajtów)')
