import math
import os
import json

# Wczytujemy wygenerowany docs/camp-map.svg
svg_path = os.path.abspath('docs/camp-map.svg')
with open(svg_path, 'r', encoding='utf-8') as f:
    svg_content = f.read()

# Dane obiektów do bazy wiedzy w interfejsie HTML
objects_db = {
    "T01": {
        "nazwa": "Rodzinny namiot T01",
        "kategoria": "Namiot",
        "model": "public/game-assets/world/tents/big2.glb",
        "pozycja": "X = -7.80 m, Z = -9.90 m",
        "wymiary": "7.56 m (szer.) × 11.59 m (dł.) × 5.04 m (wys.)",
        "obrot": "270.0° (1.5π rad)",
        "kolizja": "Box: 5.20 m × 7.60 m (pomija odciągi i linki)",
        "opis": "Największy namiot w obozie, zlokalizowany w północno-zachodnim narożniku tuż obok toi-toia. Posiada obniżenie podłoża groundOffset = -2.2 m."
    },
    "T02": {
        "nazwa": "Namiot T02",
        "kategoria": "Namiot",
        "model": "public/game-assets/world/tents/small.glb",
        "pozycja": "X = -1.80 m, Z = -10.20 m",
        "wymiary": "4.20 m × 3.60 m × 2.80 m",
        "obrot": "-3.0° (-0.052 rad)",
        "kolizja": "Box: 4.20 m × 3.60 m",
        "opis": "Mały zielony namiot igloo w rzędzie północnym, na zachód od głównej alei."
    },
    "T03": {
        "nazwa": "Namiot T03",
        "kategoria": "Namiot",
        "model": "public/game-assets/world/tents/niebieski.glb",
        "pozycja": "X = 2.10 m, Z = -10.20 m",
        "wymiary": "4.20 m × 3.60 m × 2.80 m",
        "obrot": "0.0° (0.0 rad)",
        "kolizja": "Box: 4.20 m × 3.60 m",
        "opis": "Niebieski namiot igloo po wschodniej stronie głównej alei w rzędzie północnym."
    },
    "T04": {
        "nazwa": "Namiot T04",
        "kategoria": "Namiot",
        "model": "public/game-assets/world/tents/biały.glb",
        "pozycja": "X = 6.30 m, Z = -9.90 m",
        "wymiary": "4.20 m × 3.60 m × 2.80 m",
        "obrot": "+3.0° (0.052 rad)",
        "kolizja": "Box: 4.20 m × 3.60 m",
        "opis": "Biały namiot w północno-wschodniej części obozu. Posiada groundOffset = -0.45 m."
    },
    "T05": {
        "nazwa": "Namiot T05",
        "kategoria": "Namiot",
        "model": "public/game-assets/world/tents/small2.glb",
        "pozycja": "X = 11.40 m, Z = -8.70 m",
        "wymiary": "4.20 m × 3.60 m × 2.80 m",
        "obrot": "+15.0° (0.262 rad)",
        "kolizja": "Box: 4.20 m × 3.60 m",
        "opis": "Kopułowy namiot small2 wysunięty najbardziej na wschód w sektorze północnym."
    },
    "T06": {
        "nazwa": "Namiot T06",
        "kategoria": "Namiot",
        "model": "public/game-assets/world/tents/small.glb",
        "pozycja": "X = -12.00 m, Z = -3.00 m",
        "wymiary": "4.20 m × 3.60 m × 2.80 m",
        "obrot": "-3.0° (-0.052 rad)",
        "kolizja": "Box: 4.20 m × 3.60 m",
        "opis": "Mały namiot boczny na zachodniej flance obozu, przy drodze dojazdowej."
    },
    "T07": {
        "nazwa": "Namiot T07",
        "kategoria": "Namiot",
        "model": "public/game-assets/world/tents/kolorwy.glb",
        "pozycja": "X = 9.90 m, Z = -3.30 m",
        "wymiary": "4.20 m × 3.60 m × 2.80 m",
        "obrot": "0.0° (0.0 rad)",
        "kolizja": "Box: 4.20 m × 3.60 m",
        "opis": "Kolorowy namiot na wschodniej flance obozu, obok którego patroluje Pierścień."
    },
    "T08": {
        "nazwa": "Namiot T08",
        "kategoria": "Namiot",
        "model": "public/game-assets/world/tents/niebppom.glb",
        "pozycja": "X = -11.70 m, Z = 3.60 m",
        "wymiary": "4.20 m × 3.60 m × 2.80 m",
        "obrot": "0.0° (0.0 rad)",
        "kolizja": "Box: 4.20 m × 3.60 m",
        "opis": "Niebiesko-pomarańczowy szeroki namiot na zachodnim skraju środkowo-południowego rzędu."
    },
    "T09": {
        "nazwa": "Rodzinny namiot T09",
        "kategoria": "Namiot",
        "model": "public/game-assets/world/tents/dużynamiot.glb",
        "pozycja": "X = -6.30 m, Z = 4.20 m",
        "wymiary": "4.20 m × 6.44 m × 2.80 m",
        "obrot": "-6.0° (-0.105 rad)",
        "kolizja": "Box: 4.20 m × 6.44 m",
        "opis": "Duży tunelowy namiot rodzinny w południowo-zachodnim sektorze."
    },
    "T10": {
        "nazwa": "Namiot T10",
        "kategoria": "Namiot",
        "model": "public/game-assets/world/tents/small.glb",
        "pozycja": "X = -1.50 m, Z = 4.50 m",
        "wymiary": "4.20 m × 3.60 m × 2.80 m",
        "obrot": "-5.0° (-0.087 rad)",
        "kolizja": "Box: 4.20 m × 3.60 m",
        "opis": "Mały namiot igloo w rzędzie środkowo-południowym, tuż przy głównej alei."
    },
    "T11": {
        "nazwa": "Namiot T11",
        "kategoria": "Namiot",
        "model": "public/game-assets/world/tents/niebieski.glb",
        "pozycja": "X = 3.90 m, Z = 4.50 m",
        "wymiary": "4.20 m × 3.60 m × 2.80 m",
        "obrot": "-7.0° (-0.122 rad)",
        "kolizja": "Box: 4.20 m × 3.60 m",
        "opis": "Niebieski namiot we wschodniej części rzędu środkowo-południowego."
    },
    "T12": {
        "nazwa": "Namiot T12",
        "kategoria": "Namiot",
        "model": "public/game-assets/world/tents/kolorwy.glb",
        "pozycja": "X = 7.80 m, Z = 3.60 m",
        "wymiary": "4.20 m × 3.60 m × 2.80 m",
        "obrot": "-6.0° (-0.105 rad)",
        "kolizja": "Box: 4.20 m × 3.60 m",
        "opis": "Kolorowy namiot w sektorze południowo-wschodnim."
    },
    "T13": {
        "nazwa": "Namiot T13",
        "kategoria": "Namiot",
        "model": "public/game-assets/world/tents/biały.glb",
        "pozycja": "X = -8.40 m, Z = 9.60 m",
        "wymiary": "4.20 m × 3.60 m × 2.80 m",
        "obrot": "-7.0° (-0.122 rad)",
        "kolizja": "Box: 4.20 m × 3.60 m",
        "opis": "Biały namiot w najniższym (południowym) rzędzie. Posiada groundOffset = -0.45 m."
    },
    "T14": {
        "nazwa": "Rodzinny namiot T14",
        "kategoria": "Namiot",
        "model": "public/game-assets/world/tents/dużynamiot.glb",
        "pozycja": "X = -3.90 m, Z = 9.90 m",
        "wymiary": "4.20 m × 6.44 m × 2.80 m",
        "obrot": "-5.0° (-0.087 rad)",
        "kolizja": "Box: 4.20 m × 6.44 m",
        "opis": "Duży namiot rodzinny w najdalszym rzędzie południowym."
    },
    "T15": {
        "nazwa": "Namiot T15",
        "kategoria": "Namiot",
        "model": "public/game-assets/world/tents/small2.glb",
        "pozycja": "X = 3.60 m, Z = 9.90 m",
        "wymiary": "4.20 m × 3.60 m × 2.80 m",
        "obrot": "+3.0° (0.052 rad)",
        "kolizja": "Box: 4.20 m × 3.60 m",
        "opis": "Kopułowy namiot small2 na południu. Na wschód od niego rozciąga się otwarta łąka."
    },
    "MadDogCanopy": {
        "nazwa": "Mad Dog (Centralne Zadaszenie)",
        "kategoria": "Główny Landmark",
        "model": "public/game-assets/world/tents/main.glb",
        "pozycja": "X = -0.60 m, Z = -3.90 m",
        "wymiary": "22.32 m (szer.) × 22.23 m (dł.) × 6.58 m (wys.)",
        "obrot": "0.0°",
        "kolizja": "Brak collidera wewnętrznego (pełna swoboda przejścia)",
        "opis": "Serce obozu. Czarne, otwarte ze wszystkich stron zadaszenie chroniące przed słońcem i deszczem. Pod spodem mieści się stół biesiadny, 8 krzeseł S01-S08, oświetlenie wypełniające (ambient & local fill) oraz główne postacie."
    },
    "CampTable": {
        "nazwa": "Stół Biesiadny",
        "kategoria": "Meble / Interakcje",
        "model": "public/game-assets/interactables/table.glb",
        "pozycja": "X = -0.60 m, Z = -3.90 m (centrum Mad Doga)",
        "wymiary": "2.40 m × 1.20 m, wys. 1.12 m",
        "obrot": "-28.6° (-0.5 rad)",
        "kolizja": "Cylinder: promień 1.35 m",
        "opis": "Centralny stół z drewna, na którym rozłożone są używki (Papieros, Blant, Kreska, MDMA, Grzyby, LSD). Każdy przedmiot można podnieść lub zbadać klawiszem E."
    },
    "ToiletWcTron": {
        "nazwa": "wcTron (Kabina Toi-Toi)",
        "kategoria": "Sanitariat / Landmark",
        "model": "public/game-assets/world/toilet.glb",
        "pozycja": "X = -12.60 m, Z = -9.60 m",
        "wymiary": "1.50 m × 1.50 m, wys. 3.60 m",
        "obrot": "0.0°",
        "kolizja": "Box kabiny z wycięciem na wejście",
        "opis": "Legendarny festiwalowy toi-toi w północno-zachodnim rogu obozu. Interakcja klawiszem E przy drzwiach ('Wejdź do toi-toia')."
    },
    "PlayerSpawn": {
        "nazwa": "Punkt Spawnu Gracza",
        "kategoria": "Spawn",
        "model": "Kapsuła gracza (r=0.34m, h=1.80m)",
        "pozycja": "X = -12.60 m, Z = -6.80 m",
        "wymiary": "Pozycja 2.80 m przed wejściem do wcTronu",
        "obrot": "Zwrócony w stronę centrum obozu (yaw ≈ -121°)",
        "kolizja": "Kapsuła dynamiczna gracza",
        "opis": "Miejsce pojawienia się gracza po dołączeniu do gry i wyborze postaci. Bezpieczna strefa poza kolizjami namiotów i kabiny toalety."
    },
    "CampFlag": {
        "nazwa": "Flaga Obozowa #kurwamojepole",
        "kategoria": "Landmark",
        "model": "public/game-assets/world/flaga2.glb",
        "pozycja": "X = 0.60 m, Z = 0.60 m",
        "wymiary": "Wysokość masztu: 16.40 m, promień kolizji: 0.28 m",
        "obrot": "0.0°",
        "kolizja": "Cylinder masztu (r=0.28m), płat flagi przenikalny",
        "opis": "Wielki maszt z flagą obozu stojący na południowej krawędzi Mad Doga, przy głównej alei. Widoczny z całego pola kempingowego."
    },
    "NPC_Amper": {
        "nazwa": "Amper (z głośnikiem JBL)",
        "kategoria": "NPC",
        "model": "public/game-assets/characters/amper/npc-animations.glb",
        "pozycja": "X = -2.00 m, Z = -1.00 m (pod Mad Dogiem)",
        "wymiary": "Wysokość nominalna: 1.80 m (hitbox 2.50m × 1.05m)",
        "obrot": "Dynamiczny (NpcSteering & A*)",
        "kolizja": "Kapsuła r=0.34m",
        "opis": "Nosi głośnik JBL grający muzykę. Kwestie dialogowe: 'Dobrze, że jesteś. Pod plandeką jest jeszcze miejsce.', 'Nie zgub się między namiotami.'"
    },
    "NPC_Antena": {
        "nazwa": "Antena",
        "kategoria": "NPC",
        "model": "public/game-assets/characters/antena/npc-animations.glb",
        "pozycja": "X = 1.00 m, Z = -1.00 m (pod Mad Dogiem)",
        "wymiary": "Wysokość: 1.80 m",
        "obrot": "Dynamiczny",
        "kolizja": "Kapsuła r=0.34m",
        "opis": "Kwestie dialogowe: 'Maszt pokazuje drogę do obozu.', 'Wieczorem tu jest najjaśniej.'"
    },
    "NPC_Gruczoł": {
        "nazwa": "Gruczoł",
        "kategoria": "NPC",
        "model": "public/game-assets/characters/gruczol/npc-animations.glb",
        "pozycja": "X = 2.40 m, Z = 1.00 m (obok flagi)",
        "wymiary": "Wysokość: 1.80 m",
        "obrot": "Dynamiczny",
        "kolizja": "Kapsuła r=0.34m",
        "opis": "Kwestie dialogowe: 'Widziałeś już nasze pole?', 'Spokojnie, wszystko jest pod kontrolą.'"
    },
    "NPC_Klątwa": {
        "nazwa": "Klątwa",
        "kategoria": "NPC",
        "model": "public/game-assets/characters/klatwa/npc-animations.glb",
        "pozycja": "X = -2.60 m, Z = 1.20 m (na południe od Mad Dog)",
        "wymiary": "Wysokość: 1.80 m",
        "obrot": "Dynamiczny",
        "kolizja": "Kapsuła r=0.34m",
        "opis": "Kwestie dialogowe: 'Namioty stoją, czyli jest dobrze.', 'Chodź pod plandekę, jeśli pada.'"
    },
    "NPC_Krwiak": {
        "nazwa": "Krwiak",
        "kategoria": "NPC",
        "model": "public/game-assets/characters/krwiak/npc-animations.glb",
        "pozycja": "X = 0.00 m, Z = 1.30 m (główna aleja)",
        "wymiary": "Wysokość: 1.80 m",
        "obrot": "Dynamiczny",
        "kolizja": "Kapsuła r=0.34m",
        "opis": "Kwestie dialogowe: 'Najkrótsza droga zawsze prowadzi przez błoto.', 'Miło cię widzieć.'"
    },
    "NPC_Pień": {
        "nazwa": "Pień (aka Peposz)",
        "kategoria": "NPC",
        "model": "public/game-assets/characters/pien/npc-animations.glb",
        "pozycja": "X = 4.80 m, Z = 2.70 m (droga południowa)",
        "wymiary": "Wysokość: 1.80 m",
        "obrot": "Dynamiczny",
        "kolizja": "Kapsuła r=0.34m",
        "opis": "Gospodarz pola. Kwestie dialogowe: 'To naprawdę moje pole.', 'Przy wejściu jest flaga, nie miniesz jej.'"
    },
    "NPC_Pierścień": {
        "nazwa": "Pierścień",
        "kategoria": "NPC",
        "model": "public/game-assets/characters/pierscien/npc-animations.glb",
        "pozycja": "X = 7.00 m, Z = -4.00 m (przejście wschodnie)",
        "wymiary": "Wysokość: 1.80 m",
        "obrot": "Dynamiczny",
        "kolizja": "Kapsuła r=0.34m",
        "opis": "Kwestie dialogowe: 'Pilnuję przejścia między namiotami.', 'Jest tu więcej miejsca niż wygląda.'"
    },
    "NPC_Zawór": {
        "nazwa": "Zawór",
        "kategoria": "NPC",
        "model": "public/game-assets/characters/zawor/npc-animations.glb",
        "pozycja": "X = -8.00 m, Z = 5.00 m (sektor SW)",
        "wymiary": "Wysokość: 1.80 m",
        "obrot": "Dynamiczny",
        "kolizja": "Kapsuła r=0.34m",
        "opis": "Kwestie dialogowe: 'Toi-toi jest w rogu, jak zwykle.', 'Nie stój za długo w słońcu.'"
    }
}

# Generujemy HTML
html_template = f'''<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>#KURWAMOJEPOLE — Interaktywna Mapa Obozu 3D (Rzut z góry)</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      background: #0f1610;
      color: #ecf0f1;
      display: flex;
      height: 100vh;
      overflow: hidden;
    }}
    #map-container {{
      flex: 1;
      position: relative;
      background: radial-gradient(circle at center, #1b3017 0%, #0d170d 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      cursor: grab;
    }}
    #map-container:active {{ cursor: grabbing; }}
    #map-viewport {{
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.05s ease-out;
      transform-origin: center center;
    }}
    #map-viewport svg {{
      width: 92vh;
      height: 92vh;
      max-width: 95vw;
      border-radius: 12px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.8);
      user-select: none;
    }}
    /* Interaktywne elementy SVG */
    g[id^="Tent_"], g[id^="NPC_"], #MadDogCanopy, #CampTable, #ToiletWcTron, #PlayerSpawn, #CampFlag, g[id^="S0"] {{
      cursor: pointer;
      transition: filter 0.2s, transform 0.2s;
    }}
    g[id^="Tent_"]:hover, g[id^="NPC_"]:hover, #ToiletWcTron:hover, #PlayerSpawn:hover, #CampFlag:hover, #CampTable:hover {{
      filter: drop-shadow(0 0 10px #2ecc71) !important;
    }}

    /* Panel boczny */
    #sidebar {{
      width: 440px;
      background: rgba(18, 26, 18, 0.96);
      border-left: 1px solid #2e4a27;
      display: flex;
      flex-direction: column;
      z-index: 10;
      box-shadow: -5px 0 25px rgba(0,0,0,0.5);
    }}
    #sidebar-header {{
      padding: 20px;
      border-bottom: 1px solid #2e4a27;
      background: rgba(12, 18, 12, 0.8);
    }}
    #sidebar-header h1 {{
      font-size: 19px;
      color: #2ecc71;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }}
    #sidebar-header p {{
      font-size: 12px;
      color: #95a5a6;
    }}
    #coords-bar {{
      margin-top: 10px;
      padding: 6px 12px;
      background: #090e09;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      color: #f1c40f;
      display: flex;
      justify-content: space-between;
    }}
    #sidebar-content {{
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }}
    .info-card {{
      background: #141f14;
      border: 1px solid #2f4f26;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }}
    .info-card h2 {{
      font-size: 17px;
      color: #2ed573;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }}
    .badge {{
      font-size: 10px;
      padding: 3px 8px;
      border-radius: 12px;
      background: #27ae60;
      color: #fff;
      text-transform: uppercase;
      font-weight: bold;
    }}
    .prop-row {{
      display: flex;
      margin-bottom: 8px;
      font-size: 13px;
    }}
    .prop-name {{
      width: 110px;
      color: #7f8c8d;
      font-weight: 500;
      flex-shrink: 0;
    }}
    .prop-val {{
      color: #ecf0f1;
      font-weight: 600;
      word-break: break-all;
    }}
    .prop-desc {{
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed #2c4424;
      font-size: 13px;
      line-height: 1.45;
      color: #bdc3c7;
    }}
    /* Przyciski sterowania zoomem */
    #zoom-controls {{
      position: absolute;
      bottom: 24px;
      right: 464px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 20;
    }}
    .btn-zoom {{
      width: 40px;
      height: 40px;
      border-radius: 8px;
      border: 1px solid #38612f;
      background: rgba(20, 30, 20, 0.9);
      color: #2ecc71;
      font-size: 20px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }}
    .btn-zoom:hover {{
      background: #2ecc71;
      color: #0f1610;
    }}
    /* Lista szybkiego wyboru */
    .quick-list {{
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 12px;
    }}
    .quick-btn {{
      padding: 5px 10px;
      background: #192a18;
      border: 1px solid #2d4c25;
      border-radius: 4px;
      color: #bdc3c7;
      font-size: 11px;
      cursor: pointer;
      transition: 0.15s;
    }}
    .quick-btn:hover {{
      background: #2ecc71;
      color: #0f1610;
      font-weight: bold;
    }}
  </style>
</head>
<body>

  <div id="map-container">
    <div id="map-viewport">
      {svg_content}
    </div>

    <div id="zoom-controls">
      <button class="btn-zoom" id="btn-zoom-in" title="Przybliż">+</button>
      <button class="btn-zoom" id="btn-zoom-out" title="Oddal">−</button>
      <button class="btn-zoom" id="btn-zoom-reset" title="Wyśrodkuj / Reset" style="font-size:14px;">↺</button>
    </div>
  </div>

  <div id="sidebar">
    <div id="sidebar-header">
      <h1>#KURWAMOJEPOLE</h1>
      <p>Mapa Obozu 3D — Rzut z góry (Top-Down View)</p>
      <div id="coords-bar">
        <span>KURSOR ŚWIATA:</span>
        <span id="coords-display">X: 0.00m | Z: 0.00m</span>
      </div>
      
      <div class="quick-list">
        <button class="quick-btn" onclick="selectObj('MadDogCanopy')">Mad Dog</button>
        <button class="quick-btn" onclick="selectObj('ToiletWcTron')">wcTron</button>
        <button class="quick-btn" onclick="selectObj('CampFlag')">Flaga</button>
        <button class="quick-btn" onclick="selectObj('CampTable')">Stół</button>
        <button class="quick-btn" onclick="selectObj('PlayerSpawn')">Spawn</button>
        <button class="quick-btn" onclick="selectObj('T01')">T01</button>
        <button class="quick-btn" onclick="selectObj('T09')">T09</button>
        <button class="quick-btn" onclick="selectObj('NPC_Amper')">Amper</button>
        <button class="quick-btn" onclick="selectObj('NPC_Pień')">Pień</button>
      </div>
    </div>

    <div id="sidebar-content">
      <div id="details-panel">
        <div class="info-card">
          <h2>Witaj na mapie obozu!</h2>
          <p style="font-size:13px; color:#bdc3c7; line-height:1.5;">
            Kliknij dowolny namiot (T01–T15), postać NPC, krzesło, toi-toi, stół lub flagę, aby zobaczyć dokładne parametry fizyczne, model GLB, pozycję w świecie 3D oraz rolę w grze.
          </p>
          <div class="prop-desc">
            <strong>Nawigacja:</strong><br>
            • <strong>Przeciąganie:</strong> przesuwanie mapy (Pan)<br>
            • <strong>Kółko myszy:</strong> płynne przybliżanie i oddalanie (Zoom)<br>
            • <strong>Najedź kursorem:</strong> podgląd współrzędnych świata (X, Z) w czasie rzeczywistym.
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const db = {json.dumps(objects_db, ensure_ascii=False, indent=2)};
    const viewport = document.getElementById('map-viewport');
    const container = document.getElementById('map-container');
    const coordsDisplay = document.getElementById('coords-display');
    const detailsPanel = document.getElementById('details-panel');

    let scale = 1.0;
    let translateX = 0;
    let translateY = 0;
    let isDragging = false;
    let startX = 0, startY = 0;

    function updateTransform() {{
      viewport.style.transform = `translate(${{translateX}}px, ${{translateY}}px) scale(${{scale}})`;
    }}

    container.addEventListener('wheel', (e) => {{
      e.preventDefault();
      const zoomFactor = 1.15;
      if (e.deltaY < 0) {{
        scale = Math.min(scale * zoomFactor, 5.0);
      }} else {{
        scale = Math.max(scale / zoomFactor, 0.4);
      }}
      updateTransform();
    }});

    container.addEventListener('mousedown', (e) => {{
      if (e.button === 0) {{
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
      }}
    }});

    window.addEventListener('mousemove', (e) => {{
      if (isDragging) {{
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        updateTransform();
      }}

      // Obliczanie współrzędnych świata
      const svg = document.querySelector('svg');
      if (svg) {{
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const ctm = svg.getScreenCTM();
        if (ctm) {{
          const svgP = pt.matrixTransform(ctm.inverse());
          // SVG: Origin (660, 660), Scale: 32 px/m
          const worldX = ((svgP.x - 660) / 32.0).toFixed(2);
          const worldZ = ((svgP.y - 660) / 32.0).toFixed(2);
          if (svgP.x >= 0 && svgP.x <= 1400 && svgP.y >= 0 && svgP.y <= 1400) {{
            coordsDisplay.textContent = `X: ${{worldX}}m | Z: ${{worldZ}}m`;
          }}
        }}
      }}
    }});

    window.addEventListener('mouseup', () => {{
      isDragging = false;
    }});

    document.getElementById('btn-zoom-in').addEventListener('click', () => {{
      scale = Math.min(scale * 1.3, 5.0);
      updateTransform();
    }});
    document.getElementById('btn-zoom-out').addEventListener('click', () => {{
      scale = Math.max(scale / 1.3, 0.4);
      updateTransform();
    }});
    document.getElementById('btn-zoom-reset').addEventListener('click', () => {{
      scale = 1.0;
      translateX = 0;
      translateY = 0;
      updateTransform();
    }});

    function selectObj(id) {{
      const cleanId = id.replace('Tent_', '');
      const data = db[cleanId] || db[id];
      if (!data) return;

      detailsPanel.innerHTML = `
        <div class="info-card">
          <h2>${{data.nazwa}} <span class="badge">${{data.kategoria}}</span></h2>
          <div class="prop-row"><span class="prop-name">Pozycja świata:</span><span class="prop-val">${{data.pozycja}}</span></div>
          <div class="prop-row"><span class="prop-name">Wymiary:</span><span class="prop-val">${{data.wymiary}}</span></div>
          <div class="prop-row"><span class="prop-name">Obrót (Yaw):</span><span class="prop-val">${{data.obrot}}</span></div>
          <div class="prop-row"><span class="prop-name">Collider:</span><span class="prop-val">${{data.kolizja}}</span></div>
          <div class="prop-row"><span class="prop-name">Model GLB:</span><span class="prop-val" style="font-size:11px; color:#3498db;">${{data.model}}</span></div>
          <div class="prop-desc">${{data.opis}}</div>
        </div>
      `;
    }}

    // Dodanie nasłuchu na elementy SVG
    document.querySelectorAll('g[id^="Tent_"], g[id^="NPC_"], #MadDogCanopy, #CampTable, #ToiletWcTron, #PlayerSpawn, #CampFlag, g[id^="S0"]').forEach(el => {{
      el.addEventListener('click', (e) => {{
        e.stopPropagation();
        selectObj(el.id);
      }});
    }});
  </script>
</body>
</html>
'''

output_html_path = os.path.abspath('docs/camp-map.html')
with open(output_html_path, 'w', encoding='utf-8') as f:
    f.write(html_template)

print(f'Wygenerowano interaktywny widok HTML: {output_html_path}')
