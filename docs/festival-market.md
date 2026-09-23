# Pasaż handlowy — prototyp

Inspiracja: zdjęcie alei z białymi stoiskami i mapa przekazane przez użytkownika. Autorskie pawilony i wymiary szacunkowe; nie pełna lista wystawców ani rekonstrukcja układu 2026. Fotografii nie użyto jako tekstur.

## Domknięcie iteracji — segmentowe hale i trzy nowe szyldy

### Aktualizacja 23.09.2026 — duży SiemaShop i droga betonowa

SiemaShop przebudowano na halę 24 × 18 m o wysokości około 7 m: dach dwuspadowy, kolorowa fasada, przeszklenia, dwa otwory wejściowe i wyposażenie. Obecna grafika frontu jest autorskim placeholderem, **nie teksturą wyciętą ze zdjęcia**. Prawdziwy front fotograficzny pozostaje na liście prac w `festival-2026-plan.md` i wymaga lepszego pliku źródłowego.

Wszystkie siedem istniejących wariantów stoi w jednym rzędzie przy betonowej drodze 7 × 64 m: SiemaShop, jedzenie, kawa, Antykwariat, informacja, Kodano i odzież. Nie dodano jeszcze wszystkich pozostałych wystawców ze zdjęć. Skorygowano rezerwację miejsca w generatorze obozowiska, collidery, dojścia i maski trawy. Wykluczenia Lidla, stoisk i drogi działają także na dwóch dodatkowych shaderowych warstwach trawy, nie tylko warstwie CPU. Maska jest wspólna, statyczna, zwalniana wraz ze światem.

Biblioteka GLB: 3 457 276 B. Obejrzano render frontu hali i pasażu; są to podglądy offline, nie odbiór gry. **VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN** — przeglądarka `iab` nadal niedostępna. Poniższe liczby i układ opisują wcześniejsze iteracje.

Dodano **Festiwalowy Antykwariat**, **Punkt Informacyjny** oraz **Kodano Optyk** według zdjęć 16 i 13 użytkownika. Nowy wspólny typ dachu dwuspadowego/segmentowego, wyposażenie (książki/winyle, ulotki, ekspozytory okularów), podłogi i białe poszycie. Źródła w `festivalVendors.json`, bez niezależnego potwierdzenia roku zdjęć i bez przypisywania docelowych współrzędnych.

Siedem wariantów biblioteki, 1 470 636 B; sześć instancji: SiemaShop, jedzenie, kawa, Antykwariat, informacja, Kodano. Zachowano położenia i współdzielenie konstrukcji; dachy współdzielone w obrębie dwóch typów. Skorygowano stelaż wystający przez materiał, z regresyjnym testem promieniowym. Końcowy podgląd pasażu oraz fronty trzech nowych stoisk obejrzane. 376 testów jednostkowych i build zaliczone po iteracji otoczenia. **VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN**.

Kolejne modele otoczenia wstrzymane zgodnie z nową prośbą użytkownika. Poniżej historia poprzedniego etapu, z wcześniejszymi rozmiarami i liczbami wariantów.

## Historia: nazwy i białe namioty — 22.09.2026

Dachy, ściany, markizy oraz osłony lad są białe; kolor pozostaje na szyldach i wyposażeniu. Cztery wzorce w bibliotece: koszulki, jedzenie, kawa oraz **SiemaShop** (638684 B). Sześć instancji zachowuje dotychczasowe położenie; tylko pierwsza otrzymała nazwę SiemaShop i widoczny szyld z geometrii liter.

[Organizator potwierdza SiemaShop i Lidl w edycji 2026](https://newsroom.polandrockfestival.pl/466163-juz-w-czwartek-oficjalnie-rozpoczniemy-festiwal). Lidl ma już osobną halę. Źródło nie potwierdza konstrukcji ani dokładnego położenia namiotu SiemaShop: oba elementy są robocze. Rejestr `src/game/world/festivalVendors.json` rozdziela obecność, wygląd i lokalizację; generator i runtime korzystają z tego samego wpisu.

Nie znaleziono pełnej, wiarygodnej listy sklepów pasażu 2026. Pozostałe szyldy są kategoriami, nie wymyślonymi markami. Nie przeniesiono listy NGO/partnerów do listy sklepów. Wpis Black Monk na nieoficjalnej mapce nie wystarczył do potwierdzenia sklepu pasażu tej edycji; starszy wpis o Decathlonie także nie. Nie dodano tych nazw jako zweryfikowanych.

Kolorowe wyjątki są osobnymi obiektami: [Red Bull i strefa IQOS](festival-zones.md). Nadal bez docelowej mapy, sprzedawców i mechaniki zakupów.

## Wykonane

- `world/festival/marketStalls.glb`: trzy kategorie wyposażenia i dodatkowy wzorzec SiemaShop. Współdzielona konstrukcja, dach, podłoga, ściany i lada oraz materiały/tekstury.
- Około 4,83 m szerokości, 5,13 m głębokości z markizą, 3,96 m wysokości. Poszycie PBR, fałdy bocznych ścian, panele dachu, nogi z obciążnikami, markiza ze wspornikami, podłoga i lada.
- Różne wyposażenie: odzież na wieszakach i w stosach, płyta gastronomiczna/tace/menu, ekspres/młynek/kubki/menu. Geometria liter szyldów. Wyposażenie nadal uproszczone, nie fotorealistyczne.
- Sześć stanowisk: X=-37, Z od -14 do +14 co 5,6 m, fronty w +X. Robocza lokalizacja, nie układ z mapy lotniska.
- Asfaltowa alejka 4,1 × 36 m dopasowana do terenu, faktura ziarnista i roughness; jeden mesh, 1296 trójkątów, bez collidera. Maska trawy pod alejką i stoiskami.
- Istniejący katalog, loader/cache i sprzątanie sceny. Brak nowych pętli, timerów i listenerów. Sześć stoisk z alejką: 57 instancji meshy i około 24,2 tys. trójkątów. To nie pomiar GPU/FPS; brak osobnego LOD i instancingu.

## Ograniczenia

Można dojść przed lady, ale collidery blokują wnętrza. Bez zakupów, obsługi i nowych NPC. Brak wariantu nie tworzy jego obiektu, collidera ani wyciętej trawy; brak całej biblioteki nie tworzy alejki. Podłogi nad najwyższym punktem obrysu, bez spłaszczania terenu. Alejka jest prostokątnym fragmentem, bez docelowych poboczy i połączenia z pasem lotniska.

Docelowo: referencje konkretnych wystawców, bardziej różnorodne konstrukcje, grafiki, zabrudzenia, sprzedawcy/kolejki i mapa 2026.

## Weryfikacja

`festivalMarket.test.ts`: parser rzeczywistego GLB, warianty, budżety, skala, współdzielenie zasobów/PBR, podłogi, otwarte okna sprzedażowe, niezmieniony cache, pojedyncze zwalnianie, brakujące modele, maska trawy i nawierzchnia ponad terenem. `festivalCamping.test.ts`: dojścia do lad i namiotów z colliderami Lidla, młyna oraz pasażu.

Po aktualizacji nazw i dodaniu stref: 374 testy jednostkowe w 61 plikach, 23 orkiestratora, walidacja assetów i 8 rigów. Build i zakresowy ESLint zaliczone. Ostrzeżenie bundla >500 kB pozostaje.

Obejrzano bibliotekę, fronty, zbliżenie kawiarni oraz `reports/festival-market/passage.png`. Eksporter rozmieszczenia używa kodu placementu gry i tej samej funkcji terenu. Światło/podłoże są uproszczonym podglądem offline, bez trawy runtime.

Poprawiono quaternionowy obrót importowanych GLB w podglądzie pasażu oraz flagę `--wheel-angle` audytu młyna. Nocny podgląd przy 67° z kontrolą pionu gondoli obejrzany. To poprawka narzędzia podglądowego, nie animacji gry.

**VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN**. Ostatnia próba przeglądarki wykazała brak backendu `iab`; brak raportu rozgrywki. Sprawdzić ręcznie fronty, styki nawierzchni, przejścia, cienie, dzień/noc i wydajność.

## Odtworzenie

Z dedykowanego worktree:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --factory-startup --python scripts/blender/build-market-stalls.py
npx tsx scripts/export-festival-market.ts
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --factory-startup --python scripts/blender/render-festival-market.py
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --factory-startup --python scripts/blender/audit-tents.py -- --root public/game-assets/world/festival --output reports/festival-landmarks/market-coffee --models marketStalls --views beauty front --market-variant coffee --size 1024
```
