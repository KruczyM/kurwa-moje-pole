# Modele Eko z Blendera

Oryginalne modele stworzone lokalnie w Blenderze 5.2, bez pobierania płatnych zasobów czy usług AI. Zestaw obejmuje puszkę z wieczkiem/zawleczką i etykietą, butelkę PET z żebrami i nakrętką, zgnieciony papier, zawiązany worek, dwugałkowy lód w waflu oraz hamburger z sezamem, sałatą, pomidorem i serem.

- Lód zastępuje ośmiościan sprintu (+35% przez 12 s).
- Hamburger zastępuje pomarańczową kulę bonusu 3 punktów.
- Śmieci i bonusy stoją na gruncie, mają stabilne skale oraz zmienny kierunek; dotychczasowe E, respawn, mapa i punktacja pozostają.
- `public/game-assets/world/festival/eco-pickups.glb`: 431044 bajty, 6 modeli, jeden mesh i materiał na model, vertex colors, bez tekstur, kości ani animacji. Trójkąty: puszka 1716, butelka 2228, papier 80, worek 948, lód 2748, burger 3780.
- Wspólna geometria z istniejącego AssetLoader/cache; osobne materiały instancji dla izolacji podświetlenia. Nadal 48 slotów, bez nowych świateł, fizyki, cieni dynamicznych i osobnej pętli. Obiekt i materiał używane ponownie przy respawnie. Proceduralny fallback tylko gdy pack nie jest dostępny.
- Edytowalne źródło lokalne: `blender/eco-pickups.blend` (folder celowo ignorowany przez Git). Powtarzalny generator: `scripts/blender/build-eco-pickups.py`. Uruchamiaj Blender przez `--factory-startup --background --python ...`.

## QA

54 testy systemów modeli/kolektora/mapy/UI PASS. Test GLB sprawdza kompletność, kolor wierzchołków, osadzenie na gruncie, rozmiar, limit geometrii, współdzielenie geometrii i izolację materiału. Typecheck, lint i build PASS (standardowe ostrzeżenie o rozmiarze bundla).

Chromium: rzeczywiste E, solo, podnoszenie, sprint1.35, fala×2, poprawna nazwa modelu `EcoIceCream`, panel mobilny/wyjście, sześć modeli widocznych w runtime, brak page errors. Wizualnie obejrzano render Blendera oraz zrzut gry. Raport i obrazy: `reports/eco-challenge/browser-report.json`, `reports/eco-challenge/models-in-game.png`, `reports/eco-models/blender-preview.png`.

## Uwaga dotycząca dodatków

Pierwsze uruchomienie bez `--factory-startup` załadowało istniejące dodatki (BlenderKit/bridge/generator). Ich log przy przywróceniu ustawień fabrycznych zgłosił zatrzymywanie usług NIM i procesów Python generatora. Nie wysłano zadań generacji ani zapytań do płatnych API. Kolejne eksporty używają `--factory-startup` i nie ładują tych dodatków. Jeśli usługi generatora były wcześniej potrzebne, może być konieczne ich ponowne uruchomienie.

Nie wykonano push/merge ani przebudowy świata festiwalu.
