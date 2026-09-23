# Punkt wznowienia — 2026-09-23

Branch: `feat/festival-2026-tent-upgrades`.
Worktree: `E:/kodowanie/gra/.ai/worktrees/festival-2026-tent-upgrades`.
Baza: `382488d` (animacje używania przedmiotów).
Główny katalog nadal na `feat/issue-24-use-animations`; nie uruchamiać stamtąd odbioru tych zmian.
Plan: [festival-2026-plan.md](festival-2026-plan.md).

## Najnowszy checkpoint — SiemaShop, pasaż, trawa i głośnik

- SiemaShop jest dużą halą 24 × 18 m z kolorowym, na razie zastępczym frontem. Obejrzano rendery frontu i pasażu. Prawdziwa tekstura ze zdjęcia jest na liście zadań; do ostrego banera potrzebny lepszy oryginał od użytkownika.
- Siedem istniejących stoisk ustawiono przy betonowej drodze 7 × 64 m. Generator namiotów omija drogę i halę, a testy sprawdzają brak nakładania i dostępne dojścia.
- Jedna maska wykluczeń obejmuje wszystkie trzy warstwy trawy, także ruchomą warstwę wokół gracza i daleką. Brak trawy pod Lidlem, stoiskami i betonem jest objęty testem deterministycznym.
- Głośnik jest samodzielnym obiektem sceny, nie dzieckiem NPC. Test potwierdza nieruchomą pozycję po ruchu postaci, warstwę interakcji i poprawny korzeń raycastu.
- Użytkownik potwierdził ustąpienie okresowego cofania NPC. Nowe 90 modeli nadal nie ma rigów i nie zostało dodanych do runtime.
- Dalsza delegacja Antigravity zatrzymana na prośbę użytkownika; konfiguracja dostępu pozostaje, ale nie uruchamiać kolejnych zadań.
- Odbiór runtime: **VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN**. Niedostępny backend przeglądarki; rendery offline nie zastępują sprawdzenia gry.
- Walidacja 23.09.2026: build (z ostrzeżeniem rozmiaru bundla), pełny lint i formatowanie, walidacja assetów/rigów/kodowania, 387 testów jednostkowych w 63 plikach, 24 testy orkiestratora oraz 4 testy audytora modeli — zaliczone. Niezależny review Antigravity nie zwrócił raportu; nie oznaczać go jako zaliczonego.

### Historia poprawek NPC

Po zgłoszeniu cofania na końcu chodu usunięto źródłowy postęp poziomy z Walk/Run (pozostaje ruch nawigacji), poprawiono pomiar sklonowanego szkieletu i dodano regresję na wszystkich 8 prawdziwych GLB. **391 testów jednostkowych i build zaliczone**, odbiór w grze nadal oczekuje. Szczegóły przyczyny i ograniczeń w [raporcie NPC](festival-npc-progress.md). Nowe 90 modeli nadal wymaga riggingu.

[Audyt modeli, poprawki ruchu i następne kroki](festival-npc-progress.md): 90 statycznych modeli wymaga riggingu, brak modelu `091_punk_rocker`. Nowe modele **nie są jeszcze w runtime**. Poprawiono ruch istniejących NPC (prędkość animacji, postój, dojście na nierównościach, skręty, kontrolę odcinka i granic). Pełna walidacja po poprawkach: 381 testów jednostkowych, 23 orkiestratora, 4 osobne testy audytora, build i zakresowy ESLint. Odbiór wizualny nadal oczekuje. Użytkownik otrzymał pytanie o gotowe rigi lub lokalną próbę jednej postaci; nie wykonano kolejnego modelu otoczenia.

## Checkpoint otoczenia — Red Bull i pasaż domknięte

- Red Bull przebudowany według załączników 1/25 na niebieski namiot gwiaździsty, sześć kotwionych ramion, otwarte łuki, szwy, centralny maszt i lada. Cztery klony współdzielonego wariantu, sześć instancji stref łącznie. Biblioteka 1 706 864 B; sam Red Bull 6 meshy / 13 824 trójkąty. Wymiary, miejsca i napis uproszczone; pełny collider nadal blokuje wejście pod dach.
- Pasaż: trzy nowe warianty hal dwuspadowych, Festiwalowy Antykwariat, Punkt Informacyjny oraz Kodano Optyk. Szyldy, książki/winyle, ulotki i ekspozycja okularów; źródła w `festivalVendors.json`. Biblioteka siedmiu wariantów, 1 470 636 B. Nadal sześć stanowisk — trzy ogólne powtórzenia zastąpiono nazwanymi. Konstrukcja i tekstury współdzielone.
- Poprawiono stelaż wystający przez poszycie. Test promieniowy chroni przed regresją. Obejrzano końcowy `reports/festival-market/passage.png`, fronty i podglądy trzech stoisk oraz `reports/festival-zones/redBull-star/`.
- Walidacja tej iteracji: 376 testów jednostkowych, 23 orkiestratora, 180 assetów bez błędów/ostrzeżeń, 8 rigów; build i zakresowy ESLint zaliczone. Pozostaje ostrzeżenie rozmiaru bundla i `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`.
- **Nie zaczynać następnego modelu otoczenia.** Kolejny priorytet użytkownika to NPC z `E:/kodowanie/gra/Hunyuan3D-2GP/output/characters_mv` (faktyczna nazwa katalogu). Audyt: 91 folderów, 90 teksturowanych GLB, zero szkieletów i klipów, około 417 MB. Potrzebny rigging i optymalizacja przed integracją.

Poniższe zestawienie opisuje historię wcześniejszych etapów; powyższy checkpoint zastępuje starsze statusy parasola, rejestru szyldów i liczby testów. Dalszy plan otoczenia pozostaje wstrzymany.

## Wykonane wcześniej

1. Audyt dziewięciu istniejących GLB i rendery w Blenderze.
2. Dziewięć pochodnych w `public/game-assets/world/tents/upgraded/`: materiały tkaniny, zachowane atlasy kolorów, podłogi `big2`/`large`, moskitiery, rzeczywisty otwór boczny dużego namiotu i zwinięta osłona. Oryginały bez zmian.
3. Maska trawy pod namiotami; istniejący loader, cache i pojedyncza pętla renderowania zachowane.
4. Cztery nowe, niebrandowane prototypy: kopułowy trekkingowy, wysoki przedsionek, kopułowy z przedsionkiem i rodzinny tunelowy. Proceduralne lokalne PBR, podłogi, stelaże, linki i moskitiery. Tunelowy ma także okna PVC i czerwone odciągi Y. Modele w `world/tents/festival/`.
5. T16–T19 podpięte przez ten sam katalog i `CampWorld`, poza dawnym obozem, na Z=24 i X=-11/0/11/22. Nie zmieniono położenia T01–T18 przy dodawaniu T19. Kolizje i maska trawy obejmują również nowe namioty.
6. Wszystkie cztery prototypy mają LOD0/LOD1 w jednym GLB: około 83–88% mniej trójkątów daleko, wspólne materiały, istniejący renderer przełącza przy 28 m z histerezą. Szczegóły: [tent-lod.md](tent-lod.md).
7. Rozbudowano obozowisko o 47 namiotów w czterech roboczych sektorach: 66 łącznie, sześć palet, drożne alejki i dopasowanie podłóg do terenu. To nie rekonstrukcja mapy 2026. Szczegóły: [festival-camping.md](festival-camping.md).
8. Prototyp hali Lidl Rock Shop: 24 × 18 m, dach dwuspadowy, ramy, szyld, przeszklenia, dwa otwory drzwiowe i podłoga. Wymiary szacunkowe; elewacja inspirowana fotografią z oficjalnego artykułu 2026. Podłączony do istniejącego loadera, roboczo na (0, -38), z maską trawy i pełnym colliderem. Na tym etapie oglądanie z zewnątrz, nie działający sklep. Szczegóły: [festival-rock-shop.md](festival-rock-shop.md).
9. Prototyp młyna Allegro na (37, 0): dwie obręcze, podpory, 24 współdzielone gondole, stałe kolorowe LED, podest i ogrodzenie. Obrót w istniejącej pętli z delta time, gondole pionowo, reduceMotion zatrzymuje obrót. Geometria i wymiary szacunkowe. Szczegóły: [festival-wheel.md](festival-wheel.md).
10. Pasaż: trzy wzorce (koszulki, jedzenie, kawa), sześć instancji przy X=-37, szyldy, wyposażenie, podłogi, collidery i asfaltowa alejka dopasowana do terenu. Wspólne geometrie/materiały. Roboczy fragment bez zakupów i sprzedawców. Szczegóły: [festival-market.md](festival-market.md).
11. Pasaż z białymi poszyciami i osłonami lad; dodatkowy wzorzec SiemaShop z widocznym szyldem i źródłem potwierdzającym obecność. Pozostałe nazwy kategorii pozostają ogólne — brak pełnej potwierdzonej listy sklepów 2026. Rozmieszczenie nadal robocze.
12. [Trzy strefy](festival-zones.md): scena Pomorza Zachodniego na podstawie obejrzanych zdjęć (niebieskie kontenery, mały daszek, kratownica, front); duży parasol Red Bull z ladą; dwa robocze kioski IQOS/strefa 18+. Dwie ostatnie konstrukcje wymagają zdjęć do korekty wyglądu. Jedna biblioteka GLB, istniejący loader, dopasowanie terenu, maski trawy i collidery; bez zakupów i wejść do środka.
13. Wszystkie 374 testy jednostkowe, 23 orkiestratora, walidacja assetów i 8 rigów zaliczone. Build i zakresowy ESLint zaliczone. Ostrzeżenie bundla >500 kB pozostaje. Testy obejmują także budżety i źródła stref, współdzielenie zasobów, brakujące modele oraz dojścia obok nowych obiektów.

Szczegóły i polecenia generatorów: [tent-upgrades.md](tent-upgrades.md).
Referencje dużego namiotu: [festival-2026-tent-references.md](festival-2026-tent-references.md).
Zdjęcia użytkownika pozostają załącznikami rozmowy; nie zapisano ich na dysku.

## Co dalej

- Nowy pakiet 31 zdjęć i relacji użytkownika został **dodany do planu**, nie wdrożony w modelach: [lista referencji i szyldów](festival-user-reference-batch.md). Obejmuje infrastrukturę drogi, rozbudowę pasażu, ASP z boku, TVP/medyczny/twórczy/warsztatowy, mBank, PZU, dwa balony Altercore, punkt zwrotu kaucji i słoneczniki.
- Priorytet korekty: duże Red Bulle to niebieskie namioty gwiaździste (około czterech według użytkownika); mały parasol jest osobnym typem widocznym przy Stacji Skierniewice. Zdjęcia zapisane jako załączniki rozmowy, nie lokalne pliki.
- Odbiór pierwszej iteracji w grze: T01/T09/T14 oraz cztery prototypy T16–T19; skala, cienie, podłogi, okna, dzień/noc, FPS, przełączanie LOD.
- Dopracować wygląd trzech nowych konstrukcji przed mnożeniem wariantów: naturalne fałdy, napięcia paneli, styk przedsionka z kopułą i lepsze obszycia. To prototypy, nie deklarowana fotorealistyka.
- Potem kolejne konstrukcje/kolory, ewentualna korekta LOD po ocenie w ruchu, teren 2026 według mapy, sceny, punkty charakterystyczne i NPC według planu.
- Rozpoczęto zbieranie oficjalnych referencji 2026: newsroom potwierdza młyn Allegro i sklep Lidl; dostępne są presskity koncertowe. Informator na Issuu nie dał się otworzyć tym narzędziem. Nie traktować przypadkowych artykułów SEO jako dokumentacji układu.
- Nie integrowano starego brancha `feat/polandrock-czaplinek-festival`; jego układ nie został potwierdzony mapą 2026.
- Duża Scena, ASP, grzybek i nowe NPC nie są jeszcze wykonane w tym worktree. Dodano wyłącznie małą scenę Pomorza Zachodniego. Wszystkie landmarki pozostają prototypami, nie ukończonym odwzorowaniem 1:1.
- IQOS nadal bez zdjęć; nie uznawać placeholdera za wierne odtworzenie. Nowe nazwy pasażu odczytano w dokumencie referencji; rejestr runtime `festivalVendors.json` nie został jeszcze rozszerzony. Nie mylić ŠIVA SHOP z SiemaShop, punktu informacji z Kodano ani sprzedaży napojów ze zwrotem kaucji.

## Narzędzia i odbiór

Blender 5.0 działa lokalnie: `C:/Program Files/Blender Foundation/Blender 5.0/blender.exe`.
Rendery w ignorowanym `reports/tent-audit/`: `after`, `details` (także wnętrza), `prototypes`, `lod1`. Audyt ma flagę `--lod 0|1`, aby nie nakładać obu poziomów w renderze. Nowy render rozmieszczenia: `reports/festival-camp/sector-SE.png`, obejrzany; ziemia i alejki są uproszczeniem offline.
Nowe modele mają 8/8/10/9 meshy blisko i 4/5/6/5 daleko. Nie ma jeszcze pomiaru FPS ani testu setek instancji. Przy zwykłym imporcie GLB trzeba ukryć jeden poziom; w grze robi to `attachTentLod`. Nowe GLB mają neutralne mapy koloru z jawnym `baseColorFactor`, potrzebne do poprawnych wariantów palet.
Kolizje namiotów nadal pełne bryły — otwarte wejścia w modelach nie oznaczają możliwości wchodzenia postacią.

Pasaż obejrzany w renderze `reports/festival-market/passage.png`; transformacje i nawierzchnia eksportowane z kodu placementu. Poprawiono quaterniony w narzędziach podglądowych (pasaż i `--wheel-angle`), bez zmiany poprawnej animacji runtime. Nocny render młyna ponowiony przy 67° z kontrolą pionu gondoli.

Przeglądarka aplikacji niedostępna: `Browser is not available: iab`; lista przeglądarek pusta.
Skill browser i instrukcje diagnostyczne odczytane; nie obchodzono mechanizmu innym narzędziem.
**VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN** — rendery Blendera nie zastępują rozgrywki.
Uruchomić `npm run dev` w podanym worktree do ręcznego odbioru.

Nie użyto płatnych API. Nie ustawiono harmonogramu ani automatycznego wznowienia.
Nie wykonano commit/push/PR/merge. Zmiany pozostają w worktree.
