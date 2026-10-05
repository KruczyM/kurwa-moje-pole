import math
import os
import json

WIDTH = 1800
HEIGHT = 1800
CENTER = 900
SCALE = 5.0  # 1 metr = 5 px (zakres 320m = 1600px + 100px marginesu)

def w2s(x, z):
    return CENTER + x * SCALE, CENTER + z * SCALE

# 1. OBIEKTY FESTIWALU ZE ŹRÓDEŁ W .ai/worktrees/festival-2026-tent-upgrades
# ------------------------------------------------------------------------------

# Betonowe aleje
lanes = [
    {
        'id': 'NORTH_CONCRETE_LANE',
        'label': 'Północna Aleja Betonowa (Główny Pasaż)',
        'minX': -140, 'maxX': 140, 'minZ': -40, 'maxZ': -30,
        'desc': 'Szerokość 10m, długość 280m. Nawierzchnia: płyty betonowe Concrete019. Ciągnie się od Strefy Pomorza Zachodniego, przez Pasaż Handlowy i SiemaShop, aż pod Diabelski Młyn i Red Bulla.'
    },
    {
        'id': 'SOUTH_CONCRETE_LANE',
        'label': 'Południowa Aleja Betonowa',
        'minX': -140, 'maxX': 140, 'minZ': 26, 'maxZ': 36,
        'desc': 'Szerokość 10m, długość 280m. Nawierzchnia: płyty betonowe. Łączy Wioskę Kryszny, Lidl Rock Shop, Małą Scenę / ASP oraz południowe sektory kempingowe.'
    }
]

# Parcele namiotowe
camping_plots = [
    {'id': 'Camp', 'name': 'Główny Obóz #KURWAMOJEPOLE', 'minX': -18, 'maxX': 18, 'minZ': -18, 'maxZ': 18, 'isPrimary': True},
    {'id': 'N1-1', 'name': 'Pole Namiotowe Północne N1-1', 'minX': -118, 'maxX': -82, 'minZ': -140, 'maxZ': -104, 'isPrimary': False},
    {'id': 'N1-2', 'name': 'Pole Namiotowe Północne N1-2', 'minX': -78, 'maxX': -42, 'minZ': -140, 'maxZ': -104, 'isPrimary': False},
    {'id': 'N1-3', 'name': 'Pole Namiotowe Północne N1-3', 'minX': -38, 'maxX': -2, 'minZ': -140, 'maxZ': -104, 'isPrimary': False},
    {'id': 'N1-4', 'name': 'Pole Namiotowe Północne N1-4', 'minX': 2, 'maxX': 38, 'minZ': -140, 'maxZ': -104, 'isPrimary': False},
    {'id': 'N1-5', 'name': 'Pole Namiotowe Północne N1-5', 'minX': 42, 'maxX': 78, 'minZ': -140, 'maxZ': -104, 'isPrimary': False},
    {'id': 'N1-6', 'name': 'Pole Namiotowe Północne N1-6', 'minX': 82, 'maxX': 118, 'minZ': -140, 'maxZ': -104, 'isPrimary': False},
    {'id': 'Neighbour-1', 'name': 'Sąsiedzi Zachód (Neighbour-1)', 'minX': -58, 'maxX': -22, 'minZ': -18, 'maxZ': 18, 'isPrimary': False},
    {'id': 'Neighbour-2', 'name': 'Sąsiedzi Wschód (Neighbour-2)', 'minX': 22, 'maxX': 58, 'minZ': -18, 'maxZ': 18, 'isPrimary': False},
    {'id': 'Neighbour-3', 'name': 'Sąsiedzi Południe (Neighbour-3)', 'minX': -102, 'maxX': -66, 'minZ': 62, 'maxZ': 98, 'isPrimary': False},
    {'id': 'Neighbour-4', 'name': 'Sąsiedzi Południe (Neighbour-4)', 'minX': -18, 'maxX': 18, 'minZ': 62, 'maxZ': 98, 'isPrimary': False},
    {'id': 'Neighbour-5', 'name': 'Sąsiedzi Południe (Neighbour-5)', 'minX': -58, 'maxX': -22, 'minZ': 102, 'maxZ': 138, 'isPrimary': False},
    {'id': 'Neighbour-6', 'name': 'Sąsiedzi Południe (Neighbour-6)', 'minX': -18, 'maxX': 18, 'minZ': 102, 'maxZ': 138, 'isPrimary': False},
]

# Sceny
stages = [
    {
        'id': 'mainStage',
        'name': 'Duża Scena (Main Stage)',
        'x': 116, 'z': 18, 'width': 42, 'depth': 24, 'height': 22, 'rot': -math.pi / 2,
        'desc': 'Monumentalna scena główna festiwalu. Front skierowany na zachód na wielkie pole koncertowe. Nagłośnienie liniowe, potężne telebimy LED i wieże delay.'
    },
    {
        'id': 'smallStage',
        'name': 'Mała Scena / Namiot ASP',
        'x': 52, 'z': 63, 'width': 38, 'depth': 54, 'height': 19, 'rot': 0,
        'desc': 'Monumentalny zadaszony namiot koncertowo-warsztatowy ASP na południe od alei południowej. Spotkania, koncerty nocne i warsztaty.'
    }
]

# Strefy komercyjne i partnerskie
commercial_zones = [
    {'id': 'pomorze', 'name': 'Strefa Pomorza Zachodniego', 'x': -122, 'z': -44, 'w': 17.0, 'd': 6.4, 'desc': 'Pop-artowa strefa z kontenerami, tarasem widokowym i animacjami na zachodnim krańcu alei.'},
    {'id': 'redBull_1', 'name': 'Strefa Red Bull (Zachód)', 'x': -46.7, 'z': -46, 'w': 11.3, 'd': 9.8, 'desc': 'Namiot gwiazdowy Red Bulla z barem i strefą relaksu.'},
    {'id': 'iqos', 'name': 'Strefa IQOS', 'x': 94, 'z': -44, 'w': 9.0, 'd': 5.7, 'desc': 'Strefa partnerska dla dorosłych.'},
    {'id': 'redBull_2', 'name': 'Strefa Red Bull (Wschód)', 'x': 133, 'z': -46, 'w': 11.3, 'd': 9.8, 'desc': 'Drugi namiot gwiazdowy Red Bull przy Diabelskim Młynie.'},
    {'id': 'lidlRockShop', 'name': 'Lidl Rock Shop', 'x': -50, 'z': 46, 'w': 24.3, 'd': 18.3, 'desc': 'Wielki sklep festiwalowy Lidla przy południowej alei betonowej. Świeże pieczywo, napoje, lód i zaopatrzenie.'},
    {'id': 'ferrisWheel', 'name': 'Diabelski Młyn (Ferris Wheel)', 'x': 116, 'z': -59, 'w': 32.4, 'd': 11.0, 'desc': 'Wielkie koło widokowe z gondolami, obracające się co 120 sekund.'}
]

# Stoiska jarmarku (wzdłuż Alei Północnej)
stalls = [
    {'id': 'siemaShop', 'name': 'SiemaShop (Oficjalny Sklep WOŚP)', 'x': 75, 'z': -50, 'w': 24.3, 'd': 18.3, 'color': '#e74c3c'},
    {'id': 'food', 'name': 'Strefa Gastronomiczna (Food Court)', 'x': -100, 'z': -43, 'w': 4.9, 'd': 4.3, 'color': '#f39c12'},
    {'id': 'coffee', 'name': 'Kawiarnia Festiwalowa', 'x': -93, 'z': -43, 'w': 4.9, 'd': 4.3, 'color': '#d35400'},
    {'id': 'antykwariat', 'name': 'Festiwalowy Antykwariat', 'x': -86, 'z': -43, 'w': 4.9, 'd': 4.3, 'color': '#8e44ad'},
    {'id': 'informacja', 'name': 'Punkt Informacyjny WOŚP', 'x': -79, 'z': -43, 'w': 4.9, 'd': 4.3, 'color': '#2980b9'},
    {'id': 'kodano', 'name': 'Kodano Optyk', 'x': -72, 'z': -43, 'w': 4.9, 'd': 4.3, 'color': '#16a085'},
    {'id': 'merch', 'name': 'Rock Merch', 'x': -65, 'z': -43, 'w': 4.9, 'd': 4.3, 'color': '#27ae60'},
    {'id': 'swiece', 'name': 'Świece Ręcznie Malowane', 'x': -33, 'z': -43, 'w': 4.9, 'd': 4.3, 'color': '#f1c40f'},
    {'id': 'bizuteria', 'name': 'Biżuteria Naturalna', 'x': -26, 'z': -43, 'w': 4.9, 'd': 4.3, 'color': '#e67e22'},
    {'id': 'ksiazki', 'name': 'Książki z Dedykacją', 'x': -19, 'z': -43, 'w': 4.9, 'd': 4.3, 'color': '#34495e'},
    {'id': 'kwiatek', 'name': 'Kwiatek Lasu (Wianki)', 'x': -12, 'z': -43, 'w': 4.9, 'd': 4.3, 'color': '#9b59b6'},
    {'id': 'zuch', 'name': 'Zuch Olek (Militaria & Bushcraft)', 'x': -5, 'z': -43, 'w': 4.9, 'd': 4.3, 'color': '#27ae60'},
    {'id': 'altercore', 'name': 'Altercore (Glany & Odzież)', 'x': 2, 'z': -43, 'w': 4.9, 'd': 4.3, 'color': '#2c3e50'},
    {'id': 'sankowo', 'name': 'Sankowo (Rękodzieło)', 'x': 9, 'z': -43, 'w': 4.9, 'd': 4.3, 'color': '#1abc9c'},
    {'id': 'vesper', 'name': 'Wydawnictwo Vesper / In Rock', 'x': 16, 'z': -43, 'w': 4.9, 'd': 4.3, 'color': '#2980b9'},
    {'id': 'militaria', 'name': 'Militaria & Outdoor', 'x': 23, 'z': -43, 'w': 4.9, 'd': 4.3, 'color': '#7f8c8d'},
    {'id': 'lokaah', 'name': 'Lokaah (Kadzidła & Orient)', 'x': 30, 'z': -43, 'w': 4.9, 'd': 4.3, 'color': '#e84393'},
    {'id': 'siva', 'name': 'Siva (Herbata Indyjska)', 'x': 37, 'z': -43, 'w': 4.9, 'd': 4.3, 'color': '#fdcb6e'}
]

# Infrastruktura, woda, scenotechnika, służby
infras = [
    {'id': 'festivalGate', 'name': 'Główna Brama Festiwalowa', 'x': 0, 'z': -68, 'w': 18.0, 'd': 4.0, 'desc': 'Monumentalna brama wejściowa na teren festiwalu.'},
    {'id': 'signpost_1', 'name': 'Drogowskaz: Skrzyżowanie Obozowe', 'x': 14, 'z': -25, 'w': 1.5, 'd': 1.5, 'desc': 'Kierunki: Duża Scena, ASP, Pasaż, Obóz.'},
    {'id': 'signpost_2', 'name': 'Drogowskaz: Aleja Scen', 'x': 48, 'z': 28, 'w': 1.5, 'd': 1.5, 'desc': 'Kierunki: Duża Scena, ASP, Lidl.'},
    {'id': 'fohTower', 'name': 'Wieża FOH (Reżyseria Dużej Sceny)', 'x': 72, 'z': 18, 'w': 6.5, 'd': 4.8, 'desc': 'Centrum realizacji dźwięku i oświetlenia sceny głównej.'},
    {'id': 'delayNorth', 'name': 'Wieża Nagłośnieniowa Delay (Północ)', 'x': 54, 'z': -4, 'w': 4.0, 'd': 4.0, 'desc': 'Wieża opóźniająca nagłośnienia pola koncertowego.'},
    {'id': 'delaySouth', 'name': 'Wieża Nagłośnieniowa Delay (Południe)', 'x': 54, 'z': 40, 'w': 4.0, 'd': 4.0, 'desc': 'Wieża nagłośnieniowa południowego sektora koncertowego.'},
    {'id': 'mudBath', 'name': 'Kąpiel Błotna (Tradycyjne Błoto)', 'x': 64, 'z': -12, 'w': 9.6, 'd': 9.6, 'desc': 'Słynna festiwalowa kąpiel błotna chłodząca uczestników.'},
    {'id': 'fireTruck', 'name': 'Wóz Bojowy OSP Czaplinek', 'x': 64, 'z': -19, 'w': 3.2, 'd': 8.2, 'desc': 'Wóz strażacki OSP podlewający błoto i kurtyny wodne.'},
    {'id': 'waterCurtain', 'name': 'Kurtyna Wodna (Aleja Główna)', 'x': 32, 'z': 10, 'w': 7.2, 'd': 2.5, 'desc': 'Brama wodna dająca ochłodę w upalne dni.'},
    {'id': 'grzybek', 'name': 'Grzybek Wodny — Zraszacz', 'x': 76, 'z': 18, 'w': 3.5, 'd': 3.5, 'desc': 'Festiwalowy grzybek wodny z cząsteczkami kropel wody.'},
    {'id': 'patrolTent', 'name': 'Pokojowy Patrol & Punkt Medyczny', 'x': -24, 'z': -25, 'w': 4.4, 'd': 4.4, 'desc': 'Centrum ratownictwa, pierwszej pomocy i wolontariuszy WOŚP.'},
    {'id': 'krishna', 'name': 'Wioska Kryszny (Kuchnia & Strefa Pokoju)', 'x': -88, 'z': 28, 'w': 10.5, 'd': 7.5, 'desc': 'Ciepłe wegetariańskie posiłki, medytacja i spokój.'},
    {'id': 'trash_1', 'name': 'Eko Zagroda Odpadów (Pasaż)', 'x': -12, 'z': -26, 'w': 4.8, 'd': 3.2, 'desc': 'Punkt segregacji odpadów „Zaraz Będzie Czysto”.'},
    {'id': 'trash_2', 'name': 'Eko Zagroda Odpadów (Pole Koncertowe)', 'x': 44, 'z': 4, 'w': 4.8, 'd': 3.2, 'desc': 'Punkt segregacji odpadów przy FOH.'},
    {'id': 'toitoiCamp', 'name': 'Bateria Kabin TOI TOI (Sektor Obozowy)', 'x': 20, 'z': -50, 'w': 8.0, 'd': 2.2, 'desc': 'Rząd toalet festiwalowych.'},
    {'id': 'washCamp', 'name': 'Krany Wielostanowiskowe (Sektor Obozowy)', 'x': 28, 'z': -50, 'w': 6.5, 'd': 2.6, 'desc': 'Umywalnie z bieżącą wodą.'},
    {'id': 'toitoiWest', 'name': 'Bateria Kabin TOI TOI (Sektor Zachodni)', 'x': -60, 'z': 10, 'w': 2.2, 'd': 8.0, 'desc': 'Rząd toalet zachodnich.'},
    {'id': 'washWest', 'name': 'Krany Wielostanowiskowe (Sektor Zachodni)', 'x': -60, 'z': 18, 'w': 2.6, 'd': 6.5, 'desc': 'Umywalnie zachodnie.'}
]

# BUDUJEMY KOMPLETNY KOD SVG DLA CAŁEGO ŚWIATA FESTIWALU (320x320m)
svg = []
svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" width="100%" height="100%" style="background:#0e1710; font-family:-apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;">')

svg.append('''
<defs>
  <filter id="fest-shadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="3" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.6"/>
  </filter>
  <filter id="fest-glow" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="4" result="b"/>
    <feComposite in="SourceGraphic" in2="b" operator="over"/>
  </filter>
  <pattern id="fest-grid20" width="100" height="100" patternUnits="userSpaceOnUse">
    <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
  </pattern>
  <linearGradient id="concreteGrad" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#7f8c8d"/>
    <stop offset="50%" stop-color="#95a5a6"/>
    <stop offset="100%" stop-color="#7f8c8d"/>
  </linearGradient>
</defs>
''')

# Tło
svg.append(f'<rect width="{WIDTH}" height="{HEIGHT}" fill="#162917" />')
svg.append(f'<rect width="{WIDTH}" height="{HEIGHT}" fill="url(#fest-grid20)" />')

# Granica świata 320x320m
w320_px = 320 * SCALE
svg.append(f'''
<rect x="{CENTER - w320_px/2:.1f}" y="{CENTER - w320_px/2:.1f}" width="{w320_px:.1f}" height="{w320_px:.1f}" fill="none" stroke="#27ae60" stroke-width="2.5" stroke-dasharray="10,5">
  <title>Granica Świata Gry (320m x 320m, WORLD_LIMIT = 160m)</title>
</rect>
''')

# 1. PARCELE NAMIOTOWE SĄSIADÓW
svg.append('<!-- PARCELE NAMIOTOWE -->')
for plot in camping_plots:
    px1, pz1 = w2s(plot['minX'], plot['minZ'])
    px2, pz2 = w2s(plot['maxX'], plot['maxZ'])
    pw = px2 - px1
    pd = pz2 - pz1
    is_p = plot['isPrimary']
    fill_col = "rgba(46, 204, 113, 0.22)" if is_p else "rgba(39, 174, 96, 0.08)"
    stroke_col = "#2ed573" if is_p else "rgba(46, 204, 113, 0.35)"
    thick = 3.0 if is_p else 1.5
    svg.append(f'''
    <rect x="{px1:.1f}" y="{pz1:.1f}" width="{pw:.1f}" height="{pd:.1f}" rx="6" fill="{fill_col}" stroke="{stroke_col}" stroke-width="{thick}" filter="url(#fest-shadow)">
      <title>{plot['name']} ({plot['minX']}m do {plot['maxX']}m, {plot['minZ']}m do {plot['maxZ']}m)</title>
    </rect>
    <text x="{px1 + pw/2:.1f}" y="{pz1 + 18:.1f}" fill="{('#2ed573' if is_p else '#a4b0be')}" font-size="11" font-weight="bold" text-anchor="middle">{plot['id']}</text>
    ''')
    if not is_p:
        # Wrysuj 16 małych namiotów w obwodzie parceli (CAMP_TENT_SLOTS)
        slots = [
            (4,4), (11,4), (18,4), (25,4), (32,4),
            (4,11), (32,11),
            (4,18), (32,18),
            (4,25), (32,25),
            (4,32), (11,32), (18,32), (25,32), (32,32)
        ]
        for tx_rel, tz_rel in slots:
            tsx, tsy = w2s(plot['minX'] + tx_rel, plot['minZ'] + tz_rel)
            svg.append(f'<rect x="{tsx-6:.1f}" y="{tsy-5:.1f}" width="12" height="10" rx="2" fill="#3c6340" stroke="#254228" stroke-width="0.8"/>')

# 2. OBIE BETONOWE ALEJE (NORTH & SOUTH)
svg.append('<!-- BETONOWE ALEJE 10m x 280m -->')
for lane in lanes:
    lx1, lz1 = w2s(lane['minX'], lane['minZ'])
    lx2, lz2 = w2s(lane['maxX'], lane['maxZ'])
    lw = lx2 - lx1
    ld = lz2 - lz1
    svg.append(f'''
    <rect x="{lx1:.1f}" y="{lz1:.1f}" width="{lw:.1f}" height="{ld:.1f}" fill="url(#concreteGrad)" stroke="#bdc3c7" stroke-width="2" rx="4" filter="url(#fest-shadow)">
      <title>{lane['label']} • 10m x 280m • Płyty betonowe Concrete019</title>
    </rect>
    <!-- Linie dylatacji płyt co 10m -->
    ''')
    for div_x in range(lane['minX'], lane['maxX'] + 1, 10):
        dsx, _ = w2s(div_x, 0)
        svg.append(f'<line x1="{dsx:.1f}" y1="{lz1:.1f}" x2="{dsx:.1f}" y2="{lz2:.1f}" stroke="rgba(0,0,0,0.3)" stroke-width="1.5"/>')
    svg.append(f'<text x="{lx1 + lw/2:.1f}" y="{lz1 + ld/2 + 5:.1f}" fill="#2c3e50" font-size="14" font-weight="900" letter-spacing="2" text-anchor="middle">{lane["label"].upper()}</text>')

# 3. NASZ GŁÓWNY OBÓZ #KURWAMOJEPOLE (Detal w centrum)
md_sx, md_sy = w2s(-0.6, -3.9)
md_w = 22.316 * SCALE
md_d = 22.232 * SCALE
flg_sx, flg_sy = w2s(0.6, 0.6)
toi_sx, toi_sy = w2s(-12.6, -9.6)

svg.append(f'''
<!-- NASZ GŁÓWNY OBÓZ -->
<!-- Mad Dog -->
<rect x="{md_sx - md_w/2:.1f}" y="{md_sy - md_d/2:.1f}" width="{md_w:.1f}" height="{md_d:.1f}" fill="rgba(15,15,20,0.85)" rx="4" stroke="#ffffff" stroke-width="2">
  <title>Mad Dog (22.3m x 22.2m) - Zadaszenie centralne obozu</title>
</rect>
<text x="{md_sx:.1f}" y="{md_sy - 4:.1f}" fill="#f1c40f" font-size="12" font-weight="bold" text-anchor="middle">MAD DOG</text>
<text x="{md_sx:.1f}" y="{md_sy + 10:.1f}" fill="#fff" font-size="9" text-anchor="middle">Stół • Krzesła S01-S08 • Używki</text>

<!-- Flaga maszt 16.4m -->
<circle cx="{flg_sx:.1f}" cy="{flg_sy:.1f}" r="8" fill="#e74c3c" stroke="#ffffff" stroke-width="2"/>
<text x="{flg_sx + 12:.1f}" y="{flg_sy + 4:.1f}" fill="#f1c40f" font-size="11" font-weight="bold">FLAGA #kurwamojepole (16.4m)</text>

<!-- Toi-toi wcTron -->
<rect x="{toi_sx - 8:.1f}" y="{toi_sy - 8:.1f}" width="16" height="16" fill="#2980b9" stroke="#fff" stroke-width="1.5"/>
<text x="{toi_sx:.1f}" y="{toi_sy - 12:.1f}" fill="#2980b9" font-size="9" font-weight="bold" text-anchor="middle">wcTron</text>
''')

# 4. DUŻA SCENA & MAŁA SCENA / ASP
for st in stages:
    sx, sy = w2s(st['x'], st['z'])
    is_main = (st['id'] == 'mainStage')
    # Dla mainStage: rotacja -90 deg (skierowana na zachód)
    sw = st['width'] * SCALE
    sd = st['depth'] * SCALE
    if is_main:
        # Odwrócone wymiary po obrocie 90 deg
        sw, sd = sd, sw
    color = "#c0392b" if is_main else "#d35400"
    svg.append(f'''
    <!-- SCENA: {st['name']} -->
    <g id="{st['id']}" filter="url(#fest-shadow)">
      <rect x="{sx - sw/2:.1f}" y="{sy - sd/2:.1f}" width="{sw:.1f}" height="{sd:.1f}" fill="#2c3e50" stroke="{color}" stroke-width="4" rx="6">
        <title>{st['name']}\nWymiary: {st['width']}m x {st['depth']}m, wys. {st['height']}m\n{st['desc']}</title>
      </rect>
      <!-- Zadaszenie i podest -->
      <rect x="{sx - sw/2 + 8:.1f}" y="{sy - sd/2 + 8:.1f}" width="{sw - 16:.1f}" height="{sd - 16:.1f}" fill="{color}" rx="3"/>
      <text x="{sx:.1f}" y="{sy - 4:.1f}" fill="#ffffff" font-size="14" font-weight="900" text-anchor="middle">{st['name'].upper()}</text>
      <text x="{sx:.1f}" y="{sy + 12:.1f}" fill="#f1f2f6" font-size="10" text-anchor="middle">{st['width']}m × {st['depth']}m • wys. {st['height']}m</text>
    </g>
    ''')

# Pole koncertowe przed Dużą Sceną
ms_x, ms_z = w2s(116, 18)
svg.append(f'''
<!-- POLE KONCERTOWE POGO -->
<ellipse cx="{ms_x - 140:.1f}" cy="{ms_z:.1f}" rx="110" ry="140" fill="rgba(231, 76, 60, 0.12)" stroke="#e74c3c" stroke-width="2" stroke-dasharray="6,4">
  <title>Pole Koncertowe pod Dużą Sceną (tysiące uczestników, pogo, strefa FOH)</title>
</ellipse>
<text x="{ms_x - 140:.1f}" y="{ms_z:.1f}" fill="#ff7675" font-size="13" font-weight="bold" text-anchor="middle">POLE KONCERTOWE (POGO)</text>
''')

# 5. DIABELSKI MŁYN (FERRIS WHEEL)
wh_x, wh_z = w2s(116, -59)
svg.append(f'''
<!-- DIABELSKI MŁYN -->
<g id="FerrisWheel" filter="url(#fest-shadow)">
  <circle cx="{wh_x:.1f}" cy="{wh_z:.1f}" r="45" fill="rgba(52, 152, 219, 0.25)" stroke="#3498db" stroke-width="3"/>
  <circle cx="{wh_x:.1f}" cy="{wh_z:.1f}" r="8" fill="#e74c3c" stroke="#fff" stroke-width="2"/>
  <!-- Szprychy koła -->
  <line x1="{wh_x-45:.1f}" y1="{wh_z:.1f}" x2="{wh_x+45:.1f}" y2="{wh_z:.1f}" stroke="#3498db" stroke-width="2"/>
  <line x1="{wh_x:.1f}" y1="{wh_z-45:.1f}" x2="{wh_x:.1f}" y2="{wh_z+45:.1f}" stroke="#3498db" stroke-width="2"/>
  <line x1="{wh_x-32:.1f}" y1="{wh_z-32:.1f}" x2="{wh_x+32:.1f}" y2="{wh_z+32:.1f}" stroke="#3498db" stroke-width="1.5"/>
  <line x1="{wh_x-32:.1f}" y1="{wh_z+32:.1f}" x2="{wh_x+32:.1f}" y2="{wh_z-32:.1f}" stroke="#3498db" stroke-width="1.5"/>
  <text x="{wh_x:.1f}" y="{wh_z - 52:.1f}" fill="#3498db" font-size="12" font-weight="900" text-anchor="middle">DIABELSKI MŁYN</text>
  <text x="{wh_x:.1f}" y="{wh_z + 58:.1f}" fill="#ecf0f1" font-size="9" text-anchor="middle">Obrót co 120s • Gondole widokowe</text>
</g>
''')

# 6. STREFY KOMERCYJNE & LIDL & POMORZE
for cz in commercial_zones:
    if cz['id'] == 'ferrisWheel': continue
    cx, cz_pos = w2s(cz['x'], cz['z'])
    cw = cz['w'] * SCALE
    cd = cz['d'] * SCALE
    svg.append(f'''
    <!-- STREFA: {cz['name']} -->
    <g id="{cz['id']}" filter="url(#fest-shadow)">
      <rect x="{cx - cw/2:.1f}" y="{cz_pos - cd/2:.1f}" width="{cw:.1f}" height="{cd:.1f}" fill="#34495e" stroke="#f1c40f" stroke-width="2" rx="4">
        <title>{cz['name']}\n{cz['desc']}</title>
      </rect>
      <text x="{cx:.1f}" y="{cz_pos + 4:.1f}" fill="#ffffff" font-size="11" font-weight="bold" text-anchor="middle">{cz['name']}</text>
    </g>
    ''')

# 7. STOISKA JARMARKU (STALLS WZDŁUŻ ALEI PÓŁNOCNEJ)
svg.append('<!-- STOISKA JARMARKU -->')
for stl in stalls:
    sx, sz = w2s(stl['x'], stl['z'])
    sw = stl['w'] * SCALE
    sd = stl['d'] * SCALE
    svg.append(f'''
    <rect x="{sx - sw/2:.1f}" y="{sz - sd/2:.1f}" width="{sw:.1f}" height="{sd:.1f}" fill="{stl['color']}" stroke="#2c3e50" stroke-width="1.5" rx="2" filter="url(#fest-shadow)">
      <title>{stl['name']} (x={stl['x']}m, z={stl['z']}m)</title>
    </rect>
    <text x="{sx:.1f}" y="{sz - sd/2 - 4:.1f}" fill="#ecf0f1" font-size="8" font-weight="bold" text-anchor="middle" transform="rotate(-30, {sx}, {sz - sd/2 - 4})">{stl['name'].split('(')[0]}</text>
    ''')

# 8. INFRASTRUKTURA (WODA, BŁOTO, OSP, FOH, DELAY, SANITARIATY)
svg.append('<!-- INFRASTRUKTURA I SŁUŻBY -->')
for inf in infras:
    ix, iz = w2s(inf['x'], inf['z'])
    iw = inf['w'] * SCALE
    id_dim = inf['d'] * SCALE
    
    # Kolor w zależności od typu
    b_col = "#e74c3c" if "fire" in inf['id'] or "patrol" in inf['id'] or "Gate" in inf['id'] else "#3498db" if "water" in inf['id'] or "grzybek" in inf['id'] or "wash" in inf['id'] or "toitoi" in inf['id'] else "#795548" if "mud" in inf['id'] else "#f39c12"
    
    svg.append(f'''
    <g id="{inf['id']}" filter="url(#fest-shadow)">
      <rect x="{ix - iw/2:.1f}" y="{iz - id_dim/2:.1f}" width="{iw:.1f}" height="{id_dim:.1f}" fill="{b_col}" stroke="#ffffff" stroke-width="1.5" rx="3">
        <title>{inf['name']}\n{inf['desc']}</title>
      </rect>
      <text x="{ix:.1f}" y="{iz + id_dim/2 + 10:.1f}" fill="#ecf0f1" font-size="9" font-weight="bold" text-anchor="middle">{inf['name'].split('(')[0]}</text>
    </g>
    ''')

# 9. RÓŻA WIATRÓW
cx = 1680
cy = 120
svg.append(f'''
<!-- RÓŻA WIATRÓW -->
<g transform="translate({cx}, {cy})" filter="url(#fest-shadow)">
  <circle cx="0" cy="0" r="50" fill="#1b281c" stroke="#27ae60" stroke-width="2"/>
  <polygon points="0,-40 7,-8 0,-14" fill="#e74c3c"/>
  <polygon points="0,-40 -7,-8 0,-14" fill="#c0392b"/>
  <polygon points="0,40 7,8 0,14" fill="#ecf0f1"/>
  <polygon points="0,40 -7,8 0,14" fill="#bdc3c7"/>
  <polygon points="40,0 8,7 14,0" fill="#ecf0f1"/>
  <polygon points="-40,0 -8,7 -14,0" fill="#ecf0f1"/>
  <text x="0" y="-45" fill="#e74c3c" font-size="14" font-weight="900" text-anchor="middle">N (-Z)</text>
  <text x="0" y="55" fill="#ecf0f1" font-size="12" font-weight="bold" text-anchor="middle">S (+Z)</text>
  <text x="52" y="4" fill="#ecf0f1" font-size="12" font-weight="bold" text-anchor="start">E (+X)</text>
  <text x="-52" y="4" fill="#ecf0f1" font-size="12" font-weight="bold" text-anchor="end">W (-X)</text>
</g>
''')

# 10. TYTUŁ I SKALA
svg.append(f'''
<!-- TYTUŁ -->
<g transform="translate(60, 50)">
  <rect x="0" y="0" width="680" height="95" rx="8" fill="rgba(15, 25, 15, 0.95)" stroke="#2ed573" stroke-width="2" filter="url(#fest-shadow)"/>
  <text x="25" y="32" fill="#2ed573" font-size="22" font-weight="900" letter-spacing="1">POL'AND'ROCK FESTIVAL — CAŁY ŚWIAT GRY (320 × 320 m)</text>
  <text x="25" y="56" fill="#ffffff" font-size="13" font-weight="bold">Rzeczywisty rozkład obiektów z silnika Three.js (worktree festival-2026-tent-upgrades)</text>
  <text x="25" y="78" fill="#a4b0be" font-size="11">Dwie aleje betonowe 280m • Duża Scena • ASP • Diabelski Młyn • Lidl • Jarmark • 200+ namiotów</text>
</g>
''')

# 11. LEGENDA
svg.append(f'''
<!-- LEGENDA -->
<g transform="translate(60, 1580)" filter="url(#fest-shadow)">
  <rect x="0" y="0" width="1020" height="150" rx="8" fill="rgba(15, 25, 15, 0.95)" stroke="#2ed573" stroke-width="2"/>
  <text x="20" y="24" fill="#2ed573" font-size="14" font-weight="900">KOMPLETNA LEGENDA INFRASTRUKTURY FESTIWALU</text>
  
  <g transform="translate(20, 38)">
    <rect x="0" y="0" width="20" height="14" fill="#2ed573" stroke="#fff" stroke-width="1.5"/>
    <text x="30" y="12" fill="#fff" font-size="12">Główny Obóz #KURWAMOJEPOLE (X: [-18, 18], Z: [-18, 18])</text>

    <rect x="0" y="22" width="20" height="14" fill="url(#concreteGrad)" stroke="#bdc3c7"/>
    <text x="30" y="34" fill="#fff" font-size="12">Aleje Betonowe (Północna Z: [-40, -30], Południowa Z: [26, 36])</text>

    <rect x="0" y="44" width="20" height="14" fill="#c0392b"/>
    <text x="30" y="56" fill="#fff" font-size="12">Duża Scena (116, 18) & Mała Scena / ASP (52, 63)</text>

    <circle cx="10" cy="74" r="8" fill="#3498db" stroke="#fff" stroke-width="1.5"/>
    <text x="30" y="78" fill="#fff" font-size="12">Diabelski Młyn (116, -59 • Obrót co 120s)</text>
  </g>

  <g transform="translate(480, 38)">
    <rect x="0" y="0" width="20" height="14" fill="#f1c40f" stroke="#2c3e50"/>
    <text x="30" y="12" fill="#fff" font-size="12">Pasaż Handlowy (SiemaShop, stoiska rękodzieła, food trucki)</text>

    <rect x="0" y="22" width="20" height="14" fill="#34495e" stroke="#f1c40f"/>
    <text x="30" y="34" fill="#fff" font-size="12">Strefy Partnerskie: Lidl Rock Shop, Pomorze Zachodnie, Red Bull, IQOS</text>

    <rect x="0" y="44" width="20" height="14" fill="#795548"/>
    <text x="30" y="56" fill="#fff" font-size="12">Kąpiel Błotna (64, -12) + Wóz Bojowy OSP Czaplinek (64, -19)</text>

    <rect x="0" y="66" width="20" height="14" fill="#3498db"/>
    <text x="30" y="78" fill="#fff" font-size="12">Woda i Sanitariaty: Grzybek Wodny (76, 18), Kurtyny, Baterie TOI TOI</text>
  </g>
</g>
''')

svg.append('</svg>')

svg_content = '\n'.join(svg)

# Zapisujemy do docs/festival-map-complete.svg oraz docs/festival-context-map.svg
with open(os.path.abspath('docs/festival-map-complete.svg'), 'w', encoding='utf-8') as f:
    f.write(svg_content)
with open(os.path.abspath('docs/festival-context-map.svg'), 'w', encoding='utf-8') as f:
    f.write(svg_content)

print(f'Zapisano zaktualizowany docs/festival-context-map.svg ({len(svg_content)} bajtów)')

# Teraz aktualizujemy docs/festival-overview.html
with open(os.path.abspath('docs/camp-map.svg'), 'r', encoding='utf-8') as f:
    camp_svg = f.read()

with open(os.path.abspath('docs/game-world-macro-map.svg'), 'r', encoding='utf-8') as f:
    macro_svg = f.read()

# Przygotowujemy interaktywny dashboard z bazą danych obiektów
all_objects_db = {}
for p in camping_plots:
    all_objects_db[p['id']] = {'nazwa': p['name'], 'kategoria': 'Pole Namiotowe', 'pozycja': f"X: [{p['minX']}, {p['maxX']}], Z: [{p['minZ']}, {p['maxZ']}]", 'wymiary': '36m × 36m (16 namiotów)', 'opis': 'Wydzielona parcela kempingowa z wewnętrznym dziedzińcem i drogami pożarowymi.'}
for s in stages:
    all_objects_db[st['id']] = {'nazwa': s['name'], 'kategoria': 'Scena Koncertowa', 'pozycja': f"X = {s['x']}m, Z = {s['z']}m", 'wymiary': f"{s['width']}m × {s['depth']}m, wys. {s['height']}m", 'opis': s['desc']}
for c in commercial_zones:
    all_objects_db[c['id']] = {'nazwa': c['name'], 'kategoria': 'Strefa Komercyjna', 'pozycja': f"X = {c['x']}m, Z = {c['z']}m", 'wymiary': f"{c['w']}m × {c['d']}m", 'opis': c['desc']}
for stl in stalls:
    all_objects_db[stl['id']] = {'nazwa': stl['name'], 'kategoria': 'Stoisko Jarmarku', 'pozycja': f"X = {stl['x']}m, Z = {stl['z']}m", 'wymiary': f"{stl['w']}m × {stl['d']}m", 'opis': 'Stoisko handlowe w północnym pasażu wzdłuż alei betonowej.'}
for inf in infras:
    all_objects_db[inf['id']] = {'nazwa': inf['name'], 'kategoria': 'Infrastruktura & Służby', 'pozycja': f"X = {inf['x']}m, Z = {inf['z']}m", 'wymiary': f"{inf['w']}m × {inf['d']}m", 'opis': inf['desc']}

html_portal = f'''<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>#KURWAMOJEPOLE — Rzeczywista Mapa Całego Festiwalu 3D (320 × 320 m)</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0a110b;
      color: #ecf0f1;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }}
    header {{
      background: #111a12;
      border-bottom: 2px solid #27ae60;
      padding: 10px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 100;
    }}
    .brand {{
      display: flex;
      align-items: center;
      gap: 12px;
    }}
    .brand h1 {{
      font-size: 18px;
      color: #2ecc71;
      letter-spacing: 0.5px;
    }}
    .brand span {{
      font-size: 11px;
      color: #f1c40f;
      background: #070d08;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid #244227;
      font-weight: bold;
    }}
    nav.tabs {{
      display: flex;
      gap: 8px;
    }}
    .tab-btn {{
      padding: 7px 16px;
      border-radius: 5px;
      border: 1px solid #27ae60;
      background: #152617;
      color: #ecf0f1;
      font-size: 12px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.15s;
    }}
    .tab-btn:hover {{
      background: #27ae60;
      color: #0b110c;
    }}
    .tab-btn.active {{
      background: #2ecc71;
      color: #0b110c;
      box-shadow: 0 0 10px rgba(46, 204, 113, 0.5);
    }}
    #content-container {{
      flex: 1;
      position: relative;
      overflow: hidden;
      display: flex;
    }}
    .tab-pane {{
      display: none;
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0; left: 0;
    }}
    .tab-pane.active {{
      display: flex;
    }}
    .map-display {{
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at center, #182e1a 0%, #070e08 100%);
      overflow: auto;
      padding: 16px;
      cursor: grab;
    }}
    .map-display:active {{ cursor: grabbing; }}
    .map-display svg {{
      max-width: 96%;
      max-height: 92vh;
      border-radius: 8px;
      box-shadow: 0 15px 45px rgba(0,0,0,0.85);
      user-select: none;
    }}
    /* Side Inspector */
    #side-inspector {{
      width: 380px;
      background: rgba(14, 22, 15, 0.96);
      border-left: 1px solid #223c24;
      display: flex;
      flex-direction: column;
      z-index: 10;
    }}
    #inspector-header {{
      padding: 16px;
      border-bottom: 1px solid #223c24;
      background: rgba(10, 16, 11, 0.8);
    }}
    #inspector-header h2 {{
      font-size: 15px;
      color: #2ecc71;
      margin-bottom: 4px;
    }}
    #coords-bar {{
      margin-top: 8px;
      padding: 6px 10px;
      background: #080d09;
      border-radius: 4px;
      font-family: monospace;
      font-size: 11px;
      color: #f1c40f;
      display: flex;
      justify-content: space-between;
    }}
    #inspector-body {{
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }}
    .info-card {{
      background: #111d13;
      border: 1px solid #28472a;
      border-radius: 6px;
      padding: 14px;
      margin-bottom: 14px;
    }}
    .info-card h3 {{
      font-size: 15px;
      color: #2ed573;
      margin-bottom: 8px;
    }}
    .prop-row {{
      display: flex;
      margin-bottom: 6px;
      font-size: 12px;
    }}
    .prop-name {{
      width: 100px;
      color: #7f8c8d;
      flex-shrink: 0;
    }}
    .prop-val {{
      color: #ecf0f1;
      font-weight: 600;
    }}
    .prop-desc {{
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px dashed #203623;
      font-size: 12px;
      line-height: 1.4;
      color: #bdc3c7;
    }}
    /* Quick Jump Pills */
    .pills-grid {{
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 8px;
    }}
    .pill-btn {{
      padding: 4px 8px;
      background: #172719;
      border: 1px solid #29472b;
      border-radius: 4px;
      color: #bdc3c7;
      font-size: 10px;
      cursor: pointer;
    }}
    .pill-btn:hover {{
      background: #2ecc71;
      color: #0b110c;
      font-weight: bold;
    }}
  </style>
</head>
<body>

  <header>
    <div class="brand">
      <h1>#KURWAMOJEPOLE</h1>
      <span>RZECZYWISTY ATLAS FESTIWALU (320 × 320 m)</span>
    </div>
    <nav class="tabs">
      <button class="tab-btn active" onclick="showTab('tab-fest')">1. Cały Festiwal 3D (320×320m)</button>
      <button class="tab-btn" onclick="showTab('tab-camp')">2. Nasz Obóz (Detal 30×30m)</button>
      <button class="tab-btn" onclick="showTab('tab-macro')">3. Makro Nawigacja A* (117.6m)</button>
    </nav>
  </header>

  <div id="content-container">
    <!-- TAB 1: CAŁY FESTIWAL 320x320m -->
    <div id="tab-fest" class="tab-pane active">
      <div class="map-display" id="fest-map-view">
        {svg_content}
      </div>
      <div id="side-inspector">
        <div id="inspector-header">
          <h2>INSPEKTOR FESTIWALU</h2>
          <div id="coords-bar">
            <span>KURSOR ŚWIATA:</span>
            <span id="coords-val">X: 0.00m | Z: 0.00m</span>
          </div>
          <div class="pills-grid">
            <button class="pill-btn" onclick="inspect('Camp')">Nasz Obóz</button>
            <button class="pill-btn" onclick="inspect('mainStage')">Duża Scena</button>
            <button class="pill-btn" onclick="inspect('smallStage')">Mała Scena/ASP</button>
            <button class="pill-btn" onclick="inspect('ferrisWheel')">Diabelski Młyn</button>
            <button class="pill-btn" onclick="inspect('lidlRockShop')">Lidl</button>
            <button class="pill-btn" onclick="inspect('pomorze')">Pomorze</button>
            <button class="pill-btn" onclick="inspect('siemaShop')">SiemaShop</button>
            <button class="pill-btn" onclick="inspect('mudBath')">Kąpiel Błotna</button>
            <button class="pill-btn" onclick="inspect('fireTruck')">Wóz OSP</button>
            <button class="pill-btn" onclick="inspect('grzybek')">Grzybek</button>
            <button class="pill-btn" onclick="inspect('patrolTent')">Patrol Med</button>
          </div>
        </div>
        <div id="inspector-body">
          <div id="inspect-content">
            <div class="info-card">
              <h3>Wszystkie obiekty festiwalu</h3>
              <p style="font-size:12px; color:#bdc3c7; line-height:1.45;">
                Ta mapa odzwierciedla w 100% <strong>rzeczywiste koordynaty świata gry w Three.js</strong> zaimplementowane w gałęzi festiwalu:
              </p>
              <div class="prop-desc">
                • <strong>Dwie betonowe aleje:</strong> Północna (Z: -40 do -30) i Południowa (Z: 26 do 36) o długości 280 m.<br>
                • <strong>Nasz Obóz #KURWAMOJEPOLE:</strong> X: [-18, 18], Z: [-18, 18] w samym centrum!<br>
                • <strong>Duża Scena (116, 18)</strong> i <strong>Mała Scena / ASP (52, 63)</strong>.<br>
                • <strong>Diabelski Młyn (116, -59)</strong>, <strong>Lidl Rock Shop (-50, 46)</strong> i <strong>Pomorze Zachodnie (-122, -44)</strong>.<br>
                • <strong>17 stoisk jarmarku</strong>, SiemaShop, Red Bull 1 i 2, IQOS.<br>
                • <strong>Kąpiel błotna (64, -12)</strong>, Wóz OSP Czaplinek, Grzybek wodny i kurtyny wodne.<br>
                • <strong>12 sąsiednich parcel namiotowych</strong> (200+ namiotów).
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: NASZ OBÓZ DETAL -->
    <div id="tab-camp" class="tab-pane">
      <div class="map-display">
        {camp_svg}
      </div>
    </div>

    <!-- TAB 3: MAKRO A* -->
    <div id="tab-macro" class="tab-pane">
      <div class="map-display">
        {macro_svg}
      </div>
    </div>
  </div>

  <script>
    const db = {json.dumps(all_objects_db, ensure_ascii=False, indent=2)};
    const coordsDisplay = document.getElementById('coords-val');
    const inspectContent = document.getElementById('inspect-content');

    function showTab(id) {{
      document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
      document.getElementById(id).classList.add('active');
      event.target.classList.add('active');
    }}

    function inspect(key) {{
      const data = db[key];
      if (!data) return;
      inspectContent.innerHTML = `
        <div class="info-card">
          <h3>${{data.nazwa}}</h3>
          <div class="prop-row"><span class="prop-name">Kategoria:</span><span class="prop-val">${{data.kategoria}}</span></div>
          <div class="prop-row"><span class="prop-name">Pozycja świata:</span><span class="prop-val" style="color:#2ecc71;">${{data.pozycja}}</span></div>
          <div class="prop-row"><span class="prop-name">Wymiary:</span><span class="prop-val">${{data.wymiary}}</span></div>
          <div class="prop-desc">${{data.opis}}</div>
        </div>
      `;
    }}

    // Nasłuch myszy dla współrzędnych świata 320x320m
    const festView = document.getElementById('fest-map-view');
    if (festView) {{
      festView.addEventListener('mousemove', (e) => {{
        const svg = festView.querySelector('svg');
        if (!svg) return;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const ctm = svg.getScreenCTM();
        if (ctm) {{
          const p = pt.matrixTransform(ctm.inverse());
          // Origin: (900, 900), SCALE: 5.0 px/m
          const wx = ((p.x - 900) / 5.0).toFixed(1);
          const wz = ((p.y - 900) / 5.0).toFixed(1);
          coordsDisplay.textContent = `X: ${{wx}}m | Z: ${{wz}}m`;
        }}
      }});
    }}

    // Kliknięcie w elementy mapy SVG
    document.querySelectorAll('#fest-map-view g[id], #fest-map-view rect[id]').forEach(el => {{
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {{
        e.stopPropagation();
        inspect(el.id);
      }});
    }});
  </script>
</body>
</html>
'''

with open(os.path.abspath('docs/festival-overview.html'), 'w', encoding='utf-8') as f:
    f.write(html_portal)
print('Zapisano zaktualizowany docs/festival-overview.html')
