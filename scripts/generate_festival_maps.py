import math
import os

# ==============================================================================
# 1. MAPA MAKRO ŚWIATA 3D GRY (117.6m x 117.6m)
# ==============================================================================

def generate_macro_world_svg():
    WIDTH = 1300
    HEIGHT = 1300
    CENTER = 650
    # Skala: 117.6m świata + margines na ramy (łącznie 130m) -> 9.5 px na metr
    SCALE = 9.2

    def w2s(x, z):
        return CENTER + x * SCALE, CENTER + z * SCALE

    svg = []
    svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" width="100%" height="100%" style="background:#0e1710; font-family:-apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;">')
    
    svg.append('''
    <defs>
      <filter id="m-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="3" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.5" />
      </filter>
      <filter id="m-glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="4" result="b"/>
        <feComposite in="SourceGraphic" in2="b" operator="over"/>
      </filter>
      <radialGradient id="fogGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#1e3818" stop-opacity="0.2" />
        <stop offset="60%" stop-color="#1e3818" stop-opacity="0.6" />
        <stop offset="90%" stop-color="#3d5a42" stop-opacity="0.85" />
        <stop offset="100%" stop-color="#8da1b5" stop-opacity="0.95" />
      </radialGradient>
      <pattern id="m-grid10" width="92" height="92" patternUnits="userSpaceOnUse">
        <path d="M 92 0 L 0 0 0 92" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
      </pattern>
    </defs>
    ''')

    # Tło
    svg.append(f'<rect width="{WIDTH}" height="{HEIGHT}" fill="#101c12" />')

    # Cylinder panoramy horyzontu (R = 85m)
    hr_px = 85.0 * SCALE
    svg.append(f'''
    <!-- PANORAMA HORYZONTU R = 85m -->
    <circle cx="{CENTER}" cy="{CENTER}" r="{hr_px:.1f}" fill="url(#fogGrad)" stroke="#8da1b5" stroke-width="2.5" stroke-dasharray="8,4">
      <title>Cylinder Panoramy Horyzontu (R = 85m, wys. 34m, field.jpg + mgła od 45m)</title>
    </circle>
    <text x="{CENTER}" y="{CENTER - hr_px + 22:.1f}" fill="#8da1b5" font-size="12" font-weight="bold" text-anchor="middle" letter-spacing="1">CYLINDER PANORAMY HORYZONTU (R = 85 m • 360° field.jpg • Mgła od 45 m do 120 m)</text>
    ''')

    # Granica świata fizycznego 3D (WORLD_LIMIT = 58.8m, kwadrat 117.6 x 117.6m)
    w_px = 117.6 * SCALE
    wl_x = CENTER - w_px / 2
    wl_y = CENTER - w_px / 2
    svg.append(f'''
    <!-- GRANICE ŚWIATA THREE.JS (117.6m x 117.6m) -->
    <rect x="{wl_x:.1f}" y="{wl_y:.1f}" width="{w_px:.1f}" height="{w_px:.1f}" fill="#1a3118" stroke="#e74c3c" stroke-width="3" filter="url(#m-shadow)">
      <title>Granica Świata Gry (WORLD_SIZE = 117.6m, WORLD_LIMIT = 58.8m, canMove() blokuje wyjście)</title>
    </rect>
    <rect x="{wl_x:.1f}" y="{wl_y:.1f}" width="{w_px:.1f}" height="{w_px:.1f}" fill="url(#m-grid10)" />
    ''')

    # Strefa paniki i powrotu NPC (Near-Edge Zone: 2m od krawędzi)
    edge_margin_px = 2.0 * SCALE
    ew_px = w_px - 2 * edge_margin_px
    svg.append(f'''
    <!-- STREFA OSTRZEGAWCZA NEAR-EDGE (|X|,|Z| > 56.5m) -->
    <rect x="{wl_x + edge_margin_px:.1f}" y="{wl_y + edge_margin_px:.1f}" width="{ew_px:.1f}" height="{ew_px:.1f}" 
          fill="none" stroke="rgba(231, 76, 60, 0.4)" stroke-width="1.5" stroke-dasharray="4,4">
      <title>Strefa Near-Edge: NPC przy krawędzi włączają stan run-home i sprintują do obozu</title>
    </rect>
    ''')

    # Podział na 9 makro-sektorów nawigacji A* (Sektory 0 - 8)
    sec_w = w_px / 3
    sec_names = [
        ("SEKTOR 0 (NW)", "Otwarte łąki północno-zachodnie"),
        ("SEKTOR 1 (N)", "Łąki północne • Korytarz A*"),
        ("SEKTOR 2 (NE)", "Otwarte łąki północno-wschodnie"),
        ("SEKTOR 3 (W)", "Łąki zachodnie • Dojście do wcTronu"),
        ("SEKTOR 4 (CENTRUM)", "GŁÓWNY OBÓZ #KURWAMOJEPOLE (30×30m)"),
        ("SEKTOR 5 (E)", "Łąki wschodnie • Patrol Pierścienia"),
        ("SEKTOR 6 (SW)", "Łąki południowo-zachodnie"),
        ("SEKTOR 7 (S)", "Łąki południowe • Szlak Pnia"),
        ("SEKTOR 8 (SE)", "Łąki południowo-wschodnie • Wolna przestrzeń")
    ]
    svg.append('<!-- 9 MAKRO-SEKTORÓW A* -->')
    for row in range(3):
        for col in range(3):
            idx = row * 3 + col
            sx = wl_x + col * sec_w
            sy = wl_y + row * sec_w
            name, desc = sec_names[idx]
            is_center = (idx == 4)
            fill_col = "rgba(46, 204, 113, 0.12)" if is_center else "none"
            stroke_col = "rgba(255, 255, 255, 0.2)"
            svg.append(f'''
            <rect x="{sx:.1f}" y="{sy:.1f}" width="{sec_w:.1f}" height="{sec_w:.1f}" fill="{fill_col}" stroke="{stroke_col}" stroke-width="1.5"/>
            <text x="{sx + 12:.1f}" y="{sy + 22:.1f}" fill="#7bed9f" font-size="11" font-weight="bold">{name}</text>
            <text x="{sx + 12:.1f}" y="{sy + 36:.1f}" fill="#a4b0be" font-size="9">{desc}</text>
            ''')

    # Bezpieczna strefa obozu: CAMP_RADIUS = 13m (kwadrat 26x26m)
    cr_px = 13.0 * 2 * SCALE
    cx_pos = CENTER - cr_px / 2
    cy_pos = CENTER - cr_px / 2
    svg.append(f'''
    <!-- SAFE ZONE (CAMP_RADIUS = 13m) -->
    <rect x="{cx_pos:.1f}" y="{cy_pos:.1f}" width="{cr_px:.1f}" height="{cr_px:.1f}" 
          fill="rgba(46, 204, 113, 0.25)" rx="8" stroke="#2ed573" stroke-width="2.5" stroke-dasharray="6,3" filter="url(#m-shadow)">
      <title>Safe Zone obozu (CAMP_RADIUS = 13m): Cel ucieczki NPC w stanie run-home</title>
    </rect>
    <text x="{CENTER}" y="{cy_pos - 8:.1f}" fill="#2ed573" font-size="11" font-weight="900" text-anchor="middle">STREFA BEZPIECZNA OBOZU (CAMP_RADIUS = 13 m)</text>
    ''')

    # Zarys zadaszenia Mad Dog w centrum (22.3 x 22.2m)
    md_w_px = 22.316 * SCALE
    md_h_px = 22.232 * SCALE
    md_cx, md_cy = w2s(-0.6, -3.9)
    svg.append(f'''
    <!-- MAD DOG (CENTRUM) -->
    <rect x="{md_cx - md_w_px/2:.1f}" y="{md_cy - md_h_px/2:.1f}" width="{md_w_px:.1f}" height="{md_h_px:.1f}" 
          fill="rgba(15, 15, 20, 0.85)" rx="4" stroke="#ffffff" stroke-width="1.5">
      <title>Mad Dog (22.3m x 22.2m) - Centrum życia obozu, stół, krzesła</title>
    </rect>
    <text x="{md_cx:.1f}" y="{md_cy + 4:.1f}" fill="#ffffff" font-size="11" font-weight="bold" text-anchor="middle">MAD DOG</text>
    ''')

    # Toaleta i Flaga
    tcx, tcy = w2s(-12.6, -9.6)
    svg.append(f'<circle cx="{tcx:.1f}" cy="{tcy:.1f}" r="7" fill="#2980b9" stroke="#ffffff" stroke-width="1.5"><title>wcTron (Toi-Toi w rogu)</title></circle>')
    
    fcx, fcy = w2s(0.6, 0.6)
    svg.append(f'<circle cx="{fcx:.1f}" cy="{fcy:.1f}" r="7" fill="#e74c3c" stroke="#ffffff" stroke-width="1.5"><title>Flaga #kurwamojepole (16.4m)</title></circle>')

    # Wektory powrotu NPC (Run-Home vectors)
    arrow_coords = [
        (-48, -48), (0, -50), (48, -48),
        (-50, 0), (50, 0),
        (-48, 48), (0, 50), (48, 48)
    ]
    svg.append('<!-- STRZAŁKI POWROTU RUN-HOME -->')
    for ax, az in arrow_coords:
        asx, asy = w2s(ax, az)
        # wektor do środka (CENTER, CENTER)
        dx = CENTER - asx
        dy = CENTER - asy
        length = math.sqrt(dx*dx + dy*dy)
        nx = dx / length
        ny = dy / length
        p2_x = asx + nx * 40
        p2_y = asy + ny * 40
        svg.append(f'''
        <line x1="{asx:.1f}" y1="{asy:.1f}" x2="{p2_x:.1f}" y2="{p2_y:.1f}" stroke="#e74c3c" stroke-width="2.5" stroke-dasharray="4,2"/>
        <polygon points="{p2_x:.1f},{p2_y:.1f} {p2_x - ny*5 - nx*8:.1f},{p2_y + nx*5 - ny*8:.1f} {p2_x + ny*5 - nx*8:.1f},{p2_y - nx*5 - ny*8:.1f}" fill="#e74c3c"/>
        ''')

    # Tytuł
    svg.append(f'''
    <!-- NAGŁÓWEK -->
    <g transform="translate(60, 50)">
      <rect x="0" y="0" width="540" height="90" rx="8" fill="rgba(15, 22, 15, 0.92)" stroke="#2ecc71" stroke-width="1.5" filter="url(#m-shadow)"/>
      <text x="20" y="28" fill="#2ed573" font-size="18" font-weight="900" letter-spacing="1">#KURWAMOJEPOLE — CAŁY ŚWIAT 3D (MAKRO)</text>
      <text x="20" y="48" fill="#f1f2f6" font-size="12">Pełna przestrzeń renderowana Three.js (117.6 m × 117.6 m • $R_{{horyzont}} = 85\text{{ m}}$)</text>
      <text x="20" y="68" fill="#a4b0be" font-size="11">9 Makro-sektorów A* • Promień Safe Zone = 13 m • Strefy paniki i biegu NPC</text>
    </g>
    ''')

    # Legenda
    svg.append(f'''
    <!-- LEGENDA MAKRO -->
    <g transform="translate(60, 1110)" filter="url(#m-shadow)">
      <rect x="0" y="0" width="560" height="135" rx="8" fill="rgba(15, 22, 15, 0.92)" stroke="#2ecc71" stroke-width="1.5"/>
      <text x="20" y="22" fill="#2ed573" font-size="12" font-weight="900">LEGENDA ŚWIATA MAKRO 3D</text>
      
      <g transform="translate(20, 36)">
        <rect x="0" y="0" width="16" height="12" fill="rgba(46, 204, 113, 0.25)" stroke="#2ed573" stroke-width="1.5"/>
        <text x="24" y="10" fill="#f1f2f6" font-size="11">Safe Zone obozu (CAMP_RADIUS = 13m) • Cel ucieczki NPC</text>

        <rect x="0" y="20" width="16" height="12" fill="#1a3118" stroke="#e74c3c" stroke-width="1.5"/>
        <text x="24" y="30" fill="#f1f2f6" font-size="11">Granica świata gry (117.6 × 117.6m) • Blokada canMove()</text>

        <circle cx="8" cy="48" r="6" fill="#8da1b5" stroke="#fff" stroke-width="1"/>
        <text x="24" y="52" fill="#f1f2f6" font-size="11">Cylinder horyzontu (R = 85m) • Płynny alpha fade do nieba</text>

        <line x1="0" y1="70" x2="16" y2="70" stroke="#e74c3c" stroke-width="2.5"/>
        <polygon points="18,70 12,67 12,73" fill="#e74c3c"/>
        <text x="24" y="74" fill="#f1f2f6" font-size="11">Wektor ucieczki NPC (stan run-home z prędkością biegu 3.6 m/s)</text>
      </g>
    </g>
    ''')

    svg.append('</svg>')
    return '\n'.join(svg)


# ==============================================================================
# 2. MAPA KONTEKSTOWA CAŁEGO FESTIWALU (Pol'and'Rock / Lotnisko Czaplinek)
# ==============================================================================

def generate_festival_context_svg():
    WIDTH = 1500
    HEIGHT = 1000

    svg = []
    svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" width="100%" height="100%" style="background:#131d14; font-family:-apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;">')

    svg.append('''
    <defs>
      <filter id="f-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="4" dy="6" stdDeviation="5" flood-color="#000000" flood-opacity="0.6"/>
      </filter>
      <filter id="f-glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="5" result="b"/>
        <feComposite in="SourceGraphic" in2="b" operator="over"/>
      </filter>
      <linearGradient id="runwayGrad" x1="0%" y1="0%" x2="100%" y2="50%">
        <stop offset="0%" stop-color="#4a5568"/>
        <stop offset="50%" stop-color="#2d3748"/>
        <stop offset="100%" stop-color="#4a5568"/>
      </linearGradient>
    </defs>
    ''')

    # Podłoże (Trawa i płyta lotniska)
    svg.append(f'<rect width="{WIDTH}" height="{HEIGHT}" fill="#19281a" />')

    # Otaczający las / drzewa
    svg.append('''
    <!-- LASY WOKÓŁ LOTNISKA -->
    <path d="M 0 0 L 1500 0 L 1500 120 C 1300 100, 1100 140, 900 110 C 600 130, 300 90, 0 130 Z" fill="#0d1b10" opacity="0.95"/>
    <path d="M 0 880 C 300 910, 600 870, 900 900 C 1200 860, 1400 910, 1500 880 L 1500 1000 L 0 1000 Z" fill="#0d1b10" opacity="0.95"/>
    <path d="M 0 0 L 120 0 L 90 1000 L 0 1000 Z" fill="#0d1b10" opacity="0.95"/>
    <path d="M 1380 0 L 1500 0 L 1500 1000 L 1410 1000 Z" fill="#0d1b10" opacity="0.95"/>
    <text x="750" y="80" fill="#2d4a30" font-size="28" font-weight="900" letter-spacing="8" text-anchor="middle">LASY I JEZIORO CZAPLINEK-BROCZYNO</text>
    ''')

    # Pas startowy lotniska (Główna arteria komunikacyjna)
    svg.append('''
    <!-- PAS STARTOWY LOTNISKA BROCZYNO (RUNWAY) -->
    <g transform="rotate(-8, 750, 500)">
      <rect x="100" y="470" width="1300" height="70" rx="4" fill="url(#runwayGrad)" stroke="#718096" stroke-width="2" filter="url(#f-shadow)"/>
      <!-- Dylatacje i oznaczenia pasa -->
      <line x1="120" y1="505" x2="1380" y2="505" stroke="#ffffff" stroke-width="3" stroke-dasharray="30,25"/>
      <text x="200" y="513" fill="#cbd5e0" font-size="18" font-weight="900" letter-spacing="3">PAS STARTOWY LOTNISKA • GŁÓWNY DEPTAK</text>
      <text x="1200" y="513" fill="#cbd5e0" font-size="18" font-weight="900" letter-spacing="3">PAS BROCZYNO</text>
    </g>
    ''')

    # DUŻA SCENA (MAIN STAGE)
    ms_x = 980
    ms_y = 260
    svg.append(f'''
    <!-- DUŻA SCENA (MAIN STAGE) -->
    <g id="MainStage" transform="translate({ms_x}, {ms_y})" filter="url(#f-shadow)">
      <!-- Plac przed sceną (Pogo-pole) -->
      <ellipse cx="0" cy="110" rx="190" ry="85" fill="rgba(214, 48, 49, 0.18)" stroke="#d63031" stroke-width="2" stroke-dasharray="6,3"/>
      <text x="0" y="140" fill="#ff7675" font-size="12" font-weight="bold" text-anchor="middle">POLE KONCERTOWE • 200 000 LUDZI</text>

      <!-- Konstrukcja sceny -->
      <rect x="-90" y="-35" width="180" height="70" rx="6" fill="#2d3436" stroke="#d63031" stroke-width="3"/>
      <!-- Zadaszenie i światła -->
      <polygon points="-80,-35 80,-35 95,-10 -95,-10" fill="#0984e3"/>
      <text x="0" y="10" fill="#ffffff" font-size="16" font-weight="900" text-anchor="middle">DUŻA SCENA</text>
      <text x="0" y="26" fill="#f5cd79" font-size="10" font-weight="bold" text-anchor="middle">MAIN STAGE • POL'AND'ROCK</text>

      <!-- Ekrany boczne -->
      <rect x="-125" y="-20" width="28" height="40" rx="2" fill="#00cec9" stroke="#fff" stroke-width="1.5"/>
      <rect x="97" y="-20" width="28" height="40" rx="2" fill="#00cec9" stroke="#fff" stroke-width="1.5"/>
      <text x="-111" y="5" fill="#000" font-size="8" font-weight="bold" text-anchor="middle">LED</text>
      <text x="111" y="5" fill="#000" font-size="8" font-weight="bold" text-anchor="middle">LED</text>

      <!-- FOH (Reżyserka dźwięku i świateł) -->
      <rect x="-25" y="80" width="50" height="30" rx="3" fill="#2d3436" stroke="#f39c12" stroke-width="1.5"/>
      <text x="0" y="99" fill="#f39c12" font-size="10" font-weight="bold" text-anchor="middle">FOH</text>
    </g>
    ''')

    # MAŁA SCENA
    ls_x = 280
    ls_y = 280
    svg.append(f'''
    <!-- MAŁA SCENA -->
    <g id="SmallStage" transform="translate({ls_x}, {ls_y})" filter="url(#f-shadow)">
      <ellipse cx="0" cy="70" rx="90" ry="45" fill="rgba(108, 92, 231, 0.18)" stroke="#6c5ce7" stroke-width="1.5" stroke-dasharray="4,2"/>
      <rect x="-55" y="-25" width="110" height="50" rx="5" fill="#2d3436" stroke="#6c5ce7" stroke-width="2.5"/>
      <text x="0" y="5" fill="#ffffff" font-size="13" font-weight="900" text-anchor="middle">MAŁA SCENA</text>
      <text x="0" y="18" fill="#a29bfe" font-size="9" text-anchor="middle">Scena Alternatywna</text>
    </g>
    ''')

    # AKADEMIA SZTUK PRZEPIĘKNYCH (ASP)
    asp_x = 420
    asp_y = 750
    svg.append(f'''
    <!-- AKADEMIA SZTUK PRZEPIĘKNYCH (ASP) -->
    <g id="ASP" transform="translate({asp_x}, {asp_y})" filter="url(#f-shadow)">
      <ellipse cx="0" cy="0" rx="105" ry="60" fill="#e67e22" stroke="#d35400" stroke-width="3"/>
      <ellipse cx="0" cy="0" rx="85" ry="45" fill="#f39c12"/>
      <text x="0" y="-5" fill="#ffffff" font-size="16" font-weight="900" text-anchor="middle">NAMIOT ASP</text>
      <text x="0" y="14" fill="#2c3e50" font-size="10" font-weight="bold" text-anchor="middle">Akademia Sztuk Przepięknych</text>
      <text x="0" y="28" fill="#ffffff" font-size="9" text-anchor="middle">Debaty • Warsztaty • Goście</text>
    </g>
    ''')

    # PASAŻ HANDLOWY / GASTRONOMIA / LIDL
    svg.append('''
    <!-- PASAŻ GASTRONOMICZNY I HANDLOWY -->
    <g id="FoodVillage" transform="translate(680, 410)" filter="url(#f-shadow)">
      <rect x="0" y="0" width="180" height="42" rx="4" fill="#f1c40f" stroke="#d68910" stroke-width="2"/>
      <text x="90" y="24" fill="#2c3e50" font-size="12" font-weight="900" text-anchor="middle">STREFA FOOD TRUCKÓW & LIDL</text>
      <text x="90" y="36" fill="#7f8c8d" font-size="9" font-weight="bold" text-anchor="middle">Gastronomia • Napoje • Sklepy</text>
    </g>

    <g id="SiemaShop" transform="translate(880, 410)" filter="url(#f-shadow)">
      <rect x="0" y="0" width="120" height="42" rx="4" fill="#e74c3c" stroke="#c0392b" stroke-width="2"/>
      <text x="60" y="26" fill="#ffffff" font-size="12" font-weight="900" text-anchor="middle">SIEMASHOP</text>
    </g>
    ''')

    # WIOSKI TEMATYCZNE
    svg.append('''
    <!-- WIOSKI TEMATYCZNE -->
    <g transform="translate(180, 440)">
      <rect x="0" y="0" width="130" height="35" rx="4" fill="#34495e" stroke="#2c3e50" stroke-width="1.5"/>
      <text x="65" y="22" fill="#ecf0f1" font-size="10" font-weight="bold" text-anchor="middle">Wioska Motocyklowa</text>
    </g>
    <g transform="translate(560, 770)">
      <rect x="0" y="0" width="110" height="35" rx="4" fill="#16a085" stroke="#0e6655" stroke-width="1.5"/>
      <text x="55" y="22" fill="#ecf0f1" font-size="10" font-weight="bold" text-anchor="middle">Wioska NGO</text>
    </g>
    <g transform="translate(1180, 620)">
      <rect x="0" y="0" width="140" height="35" rx="4" fill="#2980b9" stroke="#1f618d" stroke-width="1.5"/>
      <text x="70" y="22" fill="#ecf0f1" font-size="10" font-weight="bold" text-anchor="middle">Rock Camp (Płatne)</text>
    </g>
    ''')

    # ROZLEGŁE POLA NAMIOTOWE (TENT CITIES)
    svg.append('''
    <!-- POLA NAMIOTOWE OGÓLNE -->
    <g id="TentSectors">
      <!-- Sektor Północny (za sceną) -->
      <rect x="750" y="140" width="460" height="80" rx="8" fill="rgba(39, 174, 96, 0.15)" stroke="#27ae60" stroke-width="1.5" stroke-dasharray="5,3"/>
      <text x="980" y="185" fill="#2ecc71" font-size="13" font-weight="bold" text-anchor="middle">POLE NAMIOTOWE — SEKTOR A (PÓŁNOC)</text>

      <!-- Sektor Wschodni -->
      <rect x="1140" y="270" width="220" height="320" rx="8" fill="rgba(39, 174, 96, 0.15)" stroke="#27ae60" stroke-width="1.5" stroke-dasharray="5,3"/>
      <text x="1250" y="430" fill="#2ecc71" font-size="13" font-weight="bold" text-anchor="middle">SEKTOR B (WSCHÓD)</text>

      <!-- Sektor Południowy (Ogromny) -->
      <rect x="680" y="600" width="460" height="240" rx="8" fill="rgba(39, 174, 96, 0.15)" stroke="#27ae60" stroke-width="1.5" stroke-dasharray="5,3"/>
      <text x="910" y="725" fill="#2ecc71" font-size="14" font-weight="bold" text-anchor="middle">POLE NAMIOTOWE — GŁÓWNY SEKTOR C (POŁUDNIE)</text>

      <!-- Sektor Zachodni / Przy ASP -->
      <rect x="180" y="600" width="200" height="240" rx="8" fill="rgba(39, 174, 96, 0.15)" stroke="#27ae60" stroke-width="1.5" stroke-dasharray="5,3"/>
      <text x="280" y="725" fill="#2ecc71" font-size="13" font-weight="bold" text-anchor="middle">SEKTOR D (ZACHÓD)</text>
    </g>
    ''')

    # ==========================================================================
    # NASZ OBÓZ: #KURWAMOJEPOLE!
    # ==========================================================================
    camp_map_x = 760
    camp_map_y = 660
    svg.append(f'''
    <!-- NASZ OBÓZ: #KURWAMOJEPOLE -->
    <!-- Promień oddziaływania i linia celownika -->
    <circle cx="{camp_map_x}" cy="{camp_map_y}" r="65" fill="rgba(46, 204, 113, 0.25)" stroke="#2ecc71" stroke-width="2.5" stroke-dasharray="6,4" filter="url(#f-glow)"/>
    
    <g id="OurCampPlot" transform="translate({camp_map_x}, {camp_map_y})" filter="url(#f-shadow)">
      <!-- Parcela 30x30m (w skali festiwalu mały kwadrat) -->
      <rect x="-24" y="-24" width="48" height="48" rx="4" fill="#0f1f12" stroke="#2ed573" stroke-width="3"/>
      <!-- Mad Dog w środku -->
      <rect x="-14" y="-14" width="28" height="28" rx="2" fill="#111" stroke="#f1c40f" stroke-width="1.5"/>
      <!-- Maszt z flagą -->
      <circle cx="6" cy="6" r="4" fill="#e74c3c" stroke="#fff" stroke-width="1.5"/>
      
      <!-- Etykieta obozu -->
      <rect x="-85" y="-55" width="170" height="26" rx="4" fill="#2ed573" stroke="#fff" stroke-width="1.5"/>
      <text x="0" y="-38" fill="#0f1610" font-size="12" font-weight="900" text-anchor="middle">#KURWAMOJEPOLE</text>
      <text x="0" y="44" fill="#2ed573" font-size="11" font-weight="900" text-anchor="middle">NASZ OBÓZ (30×30m)</text>
      <text x="0" y="57" fill="#ecf0f1" font-size="9" text-anchor="middle">T01–T15 • Mad Dog • wcTron</text>
    </g>
    ''')

    # Linie dystansu od obozu do kluczowych miejsc festiwalu
    svg.append(f'''
    <!-- LINIE DYSTANSU -->
    <!-- Do Dużej Sceny -->
    <line x1="{camp_map_x}" y1="{camp_map_y}" x2="{ms_x}" y2="{ms_y + 40}" stroke="#e74c3c" stroke-width="2" stroke-dasharray="5,4" opacity="0.8"/>
    <g transform="translate({(camp_map_x + ms_x)/2 + 20}, {(camp_map_y + ms_y)/2})">
      <rect x="-55" y="-12" width="110" height="22" rx="3" fill="#c0392b"/>
      <text x="0" y="3" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">~420 m (5 min)</text>
    </g>

    <!-- Do ASP -->
    <line x1="{camp_map_x}" y1="{camp_map_y}" x2="{asp_x + 50}" y2="{asp_y}" stroke="#f39c12" stroke-width="2" stroke-dasharray="5,4" opacity="0.8"/>
    <g transform="translate({(camp_map_x + asp_x)/2}, {(camp_map_y + asp_y)/2 + 20})">
      <rect x="-50" y="-12" width="100" height="22" rx="3" fill="#d35400"/>
      <text x="0" y="3" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">~310 m (4 min)</text>
    </g>

    <!-- Do Pasu startowego / Gastro -->
    <line x1="{camp_map_x}" y1="{camp_map_y}" x2="{camp_map_x}" y2="520" stroke="#f1c40f" stroke-width="2" stroke-dasharray="5,4" opacity="0.8"/>
    <g transform="translate({camp_map_x + 45}, 570)">
      <rect x="-45" y="-12" width="90" height="22" rx="3" fill="#b7950b"/>
      <text x="0" y="3" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">~150 m (2 min)</text>
    </g>
    ''')

    # Brama Wejściowa i Sanitariaty
    svg.append('''
    <!-- BRAMA WEJŚCIOWA I BIURO POKOJOWEGO PATROLU -->
    <g transform="translate(1360, 480)" filter="url(#f-shadow)">
      <rect x="0" y="0" width="80" height="60" rx="4" fill="#e74c3c" stroke="#c0392b" stroke-width="2"/>
      <text x="40" y="26" fill="#fff" font-size="11" font-weight="bold" text-anchor="middle">BRAMA</text>
      <text x="40" y="42" fill="#fff" font-size="9" text-anchor="middle">GŁÓWNA</text>
    </g>

    <!-- PUNKTY MEDYCZNE / SANITARNE -->
    <g transform="translate(860, 560)">
      <circle cx="0" cy="0" r="14" fill="#e74c3c" stroke="#fff" stroke-width="2"/>
      <text x="0" y="5" fill="#fff" font-size="14" font-weight="bold" text-anchor="middle">+</text>
      <text x="0" y="24" fill="#f1f2f6" font-size="8" text-anchor="middle">PUNKT MEDYCZNY</text>
    </g>
    <g transform="translate(640, 560)">
      <rect x="-12" y="-12" width="24" height="24" rx="3" fill="#3498db" stroke="#fff" stroke-width="1.5"/>
      <text x="0" y="4" fill="#fff" font-size="10" font-weight="bold" text-anchor="middle">WC</text>
      <text x="0" y="24" fill="#f1f2f6" font-size="8" text-anchor="middle">BATERIA TOI-TOI</text>
    </g>
    ''')

    # Nagłówek i Tytuł
    svg.append('''
    <!-- NAGŁÓWEK -->
    <g transform="translate(50, 40)">
      <rect x="0" y="0" width="580" height="95" rx="8" fill="rgba(15, 25, 15, 0.92)" stroke="#2ecc71" stroke-width="2" filter="url(#f-shadow)"/>
      <text x="25" y="32" fill="#2ed573" font-size="20" font-weight="900" letter-spacing="1">POL'AND'ROCK FESTIVAL — CZAPLINEK-BROCZYNO</text>
      <text x="25" y="54" fill="#ffffff" font-size="13" font-weight="bold">Lokalizacja Pola Obozowego #KURWAMOJEPOLE na mapie festiwalu</text>
      <text x="25" y="74" fill="#a4b0be" font-size="11">Skala orientacyjna terenu festiwalu: ~1400 m × 900 m • Lasy, Pas Startowy, Sceny, ASP i Pola Namiotowe</text>
    </g>
    ''')

    # Legenda festiwalowa
    svg.append('''
    <!-- LEGENDA FESTIWALOWA -->
    <g transform="translate(50, 870)" filter="url(#f-shadow)">
      <rect x="0" y="0" width="620" height="95" rx="8" fill="rgba(15, 25, 15, 0.92)" stroke="#2ecc71" stroke-width="1.5"/>
      <text x="20" y="20" fill="#2ed573" font-size="12" font-weight="900">LEGENDA STRUKTURY FESTIWALU</text>
      
      <g transform="translate(20, 32)">
        <rect x="0" y="0" width="16" height="12" fill="#2ed573" stroke="#fff" stroke-width="1.5"/>
        <text x="24" y="10" fill="#f1f2f6" font-size="11"><strong>#KURWAMOJEPOLE</strong> (Nasz obóz 30×30m, flaga 16.4m, Mad Dog)</text>

        <rect x="0" y="18" width="16" height="12" fill="#d63031"/>
        <text x="24" y="28" fill="#f1f2f6" font-size="11">Duża Scena (Main Stage) • ~420m od obozu (5 min drogi)</text>

        <rect x="0" y="36" width="16" height="12" fill="#e67e22"/>
        <text x="24" y="46" fill="#f1f2f6" font-size="11">Akademia Sztuk Przepięknych (ASP) • ~310m od obozu</text>
      </g>

      <g transform="translate(340, 32)">
        <rect x="0" y="0" width="16" height="12" fill="#4a5568"/>
        <text x="24" y="10" fill="#f1f2f6" font-size="11">Pas startowy (główny deptak pieszy)</text>

        <rect x="0" y="18" width="16" height="12" fill="#f1c40f"/>
        <text x="24" y="28" fill="#f1f2f6" font-size="11">Pasaż gastronomiczny / Food Trucki / Lidl</text>

        <rect x="0" y="36" width="16" height="12" fill="rgba(39, 174, 96, 0.3)" stroke="#27ae60"/>
        <text x="24" y="46" fill="#f1f2f6" font-size="11">Główne pola namiotowe (Sektory A, B, C, D)</text>
      </g>
    </g>
    ''')

    svg.append('</svg>')
    return '\n'.join(svg)


# ==============================================================================
# 3. ZAPIS PLIKÓW I GENEROWANIE DASHBOARDU HTML
# ==============================================================================

macro_svg_content = generate_macro_world_svg()
festival_svg_content = generate_festival_context_svg()

with open(os.path.abspath('docs/game-world-macro-map.svg'), 'w', encoding='utf-8') as f:
    f.write(macro_svg_content)
print('Zapisano docs/game-world-macro-map.svg')

with open(os.path.abspath('docs/festival-context-map.svg'), 'w', encoding='utf-8') as f:
    f.write(festival_svg_content)
print('Zapisano docs/festival-context-map.svg')

# Wczytujemy też mapę szczegółową obozu
with open(os.path.abspath('docs/camp-map.svg'), 'r', encoding='utf-8') as f:
    camp_svg_content = f.read()

# Tworzymy kombajn HTML ze wszystkimi trzema mapami i panelem architektonicznym
html_portal = f'''<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>#KURWAMOJEPOLE — Kompletny Atlas Map Festiwalu</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0b110c;
      color: #ecf0f1;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }}
    header {{
      background: #121c13;
      border-bottom: 2px solid #27ae60;
      padding: 12px 24px;
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
      font-size: 19px;
      color: #2ecc71;
      letter-spacing: 1px;
    }}
    .brand span {{
      font-size: 12px;
      color: #95a5a6;
      background: #0a0f0a;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid #233a25;
    }}
    nav.tabs {{
      display: flex;
      gap: 8px;
    }}
    .tab-btn {{
      padding: 8px 18px;
      border-radius: 6px;
      border: 1px solid #27ae60;
      background: #152617;
      color: #ecf0f1;
      font-size: 13px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
    }}
    .tab-btn:hover {{
      background: #27ae60;
      color: #0b110c;
    }}
    .tab-btn.active {{
      background: #2ecc71;
      color: #0b110c;
      box-shadow: 0 0 12px rgba(46, 204, 113, 0.5);
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
      background: radial-gradient(circle at center, #1b3017 0%, #080e09 100%);
      overflow: auto;
      padding: 20px;
    }}
    .map-display svg {{
      max-width: 95%;
      max-height: 90vh;
      border-radius: 8px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.8);
    }}
    .doc-pane {{
      flex: 1;
      overflow-y: auto;
      padding: 36px 48px;
      background: #0f1710;
      max-width: 1100px;
      margin: 0 auto;
      line-height: 1.6;
    }}
    .doc-pane h2 {{ color: #2ecc71; margin-bottom: 16px; font-size: 24px; border-bottom: 1px solid #233a25; padding-bottom: 8px; }}
    .doc-pane h3 {{ color: #f1c40f; margin: 24px 0 10px 0; font-size: 18px; }}
    .doc-pane p {{ margin-bottom: 14px; font-size: 14px; color: #bdc3c7; }}
    .doc-pane ul {{ margin-left: 24px; margin-bottom: 16px; font-size: 14px; color: #ecf0f1; }}
    .doc-pane li {{ margin-bottom: 6px; }}
    .doc-card {{
      background: #142216;
      border: 1px solid #2d4f2c;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }}
    .code-box {{
      background: #080e08;
      border: 1px solid #1c331a;
      border-radius: 6px;
      padding: 14px;
      font-family: monospace;
      font-size: 12px;
      color: #7bed9f;
      overflow-x: auto;
      margin: 12px 0;
    }}
  </style>
</head>
<body>

  <header>
    <div class="brand">
      <h1>#KURWAMOJEPOLE</h1>
      <span>ATLAS MAP FESTIWALU</span>
    </div>
    <nav class="tabs">
      <button class="tab-btn active" onclick="showTab('tab-fest')">1. Cały Festiwal (Czaplinek)</button>
      <button class="tab-btn" onclick="showTab('tab-macro')">2. Świat 3D Gry (Makro 117.6m)</button>
      <button class="tab-btn" onclick="showTab('tab-camp')">3. Nasz Obóz (Rzut 30×30m)</button>
      <button class="tab-btn" onclick="showTab('tab-arch')">4. Projekt Rozbudowy Gry 3D</button>
    </nav>
  </header>

  <div id="content-container">
    <!-- TAB 1: CAŁY FESTIWAL -->
    <div id="tab-fest" class="tab-pane active">
      <div class="map-display">
        {festival_svg_content}
      </div>
    </div>

    <!-- TAB 2: ŚWIAT 3D MAKRO -->
    <div id="tab-macro" class="tab-pane">
      <div class="map-display">
        {macro_svg_content}
      </div>
    </div>

    <!-- TAB 3: NASZ OBÓZ (DETAL) -->
    <div id="tab-camp" class="tab-pane">
      <div class="map-display">
        {camp_svg_content}
      </div>
    </div>

    <!-- TAB 4: ARCHITEKTURA ROZBUDOWY -->
    <div id="tab-arch" class="tab-pane" style="overflow-y:auto;">
      <div class="doc-pane">
        <h2>Architektura i Projekt Rozbudowy Gry o Pełną Przestrzeń Festiwalową</h2>
        
        <div class="doc-card">
          <h3>1. Założenia Techniczne i Budżet Wydajnościowy (Performance Budget)</h3>
          <p>
            Zgodnie z zasadami projektu w <code>AGENTS.md</code> oraz <code>docs/project-spec.md</code>, gra musi utrzymać <strong>stabilne 60 FPS na pojedynczej pętli requestAnimationFrame</strong>.
            Bezmyślne wstawienie setek modeli GLB na obszarze 1 km² doprowadziłoby do zapchania pamięci VRAM (Out of Memory) i spadku płynności poniżej 15 FPS.
          </p>
          <ul>
            <li><strong>InstancedMesh:</strong> Wszystkie powtarzalne namioty sąsiednich pól (namioty igloo, małe tunelowe) renderowane w 1–2 draw callach za pomocą <code>THREE.InstancedMesh</code>.</li>
            <li><strong>LOD (Level of Detail):</strong> Modele w odległości &gt; 50 m przełączają się na low-poly (&lt; 100 trójkątów) lub billboardy (impostory 2D).</li>
            <li><strong>Ograniczenie kolizji:</strong> Kolizje są aktywne tylko w promieniu 35 m od gracza. Odległe sektory namiotowe mają zgrubne strefy wykluczenia (AABB).</li>
          </ul>
        </div>

        <div class="doc-card">
          <h3>2. Nowe Modułowe Strefy Festiwalowe</h3>
          <ul>
            <li>
              <strong>Odległa Duża Scena (Main Stage Background Landmark):</strong><br>
              Umieszczona w odległości ok. 100–120 m na północny wschód. Wykorzystuje model fasady sceny, dynamiczne światła szperaczy (spotlights przecinające niebo w nocy) oraz przestrzenne źródło dźwięku audio (Web Audio API PositionalAudio z filtrem dolnoprzepustowym symulującym tłumienie basu przez odległość).
            </li>
            <li>
              <strong>Aleja Festiwalowa i Pasaż Handlowy:</strong><br>
              Ścieżka z wydeptaną glebą PBR łącząca nasz obóz z głównym pasem lotniska. Wzdłuż alei pojawiają się stoiska z jedzeniem, toalety toi-toi oraz punkty medyczne Pokojowego Patrolu.
            </li>
            <li>
              <strong>Wzgórze Akademii Sztuk Przepięknych (ASP):</strong><br>
              Charakterystyczny wielki pomarańczowy namiot na podwyższeniu terenu (wykorzystując funkcję <code>terrainHeight(x, z)</code> ze wzgórzem na południowym zachodzie).
            </li>
          </ul>
        </div>

        <div class="doc-card">
          <h3>3. Gotowy Schemat Danych dla Nowych Sektorów (TypeScript)</h3>
          <p>Struktura konfiguracji do wdrożenia w <code>campLayout.ts</code> / <code>festivalLayout.ts</code>:</p>
          <div class="code-box">
export type FestivalZoneConfig = {{
  id: 'main-stage' | 'asp' | 'runway' | 'food-court' | 'camp-c';
  label: string;
  worldCenter: [x: number, z: number];
  bounds: {{ minX: number; maxX: number; minZ: number; maxZ: number }};
  ambientAudioTrack?: string;
  lightGlowColor?: number;
  lodDistance: number;
}};

export const FESTIVAL_ZONES: FestivalZoneConfig[] = [
  {{
    id: 'camp-c',
    label: 'Obóz #KURWAMOJEPOLE (Sektor C)',
    worldCenter: [0, 0],
    bounds: {{ minX: -16, maxX: 16, minZ: -16, maxZ: 16 }},
    lodDistance: 0,
  }},
  {{
    id: 'runway',
    label: 'Pas Startowy Lotniska (Deptak)',
    worldCenter: [0, -35],
    bounds: {{ minX: -70, maxX: 70, minZ: -45, maxZ: -25 }},
    lodDistance: 40,
  }},
  {{
    id: 'main-stage',
    label: 'Duża Scena (Main Stage Background)',
    worldCenter: [85, -80],
    bounds: {{ minX: 60, maxX: 110, minZ: -100, maxZ: -60 }},
    lightGlowColor: 0xff3838,
    lodDistance: 80,
  }},
];
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    function showTab(tabId) {{
      document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');
      event.target.classList.add('active');
    }}
  </script>
</body>
</html>
'''

with open(os.path.abspath('docs/festival-overview.html'), 'w', encoding='utf-8') as f:
    f.write(html_portal)
print('Zapisano docs/festival-overview.html')
