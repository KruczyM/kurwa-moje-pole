# Strefy partnerów i scena Pomorza — pierwsza iteracja

Prace w `feat/festival-2026-tent-upgrades`, nie w głównym katalogu projektu. Wszystkie pozycje są roboczymi punktami odbioru modeli, nie rekonstrukcją układu lotniska.

**Aktualizacja po zdjęciach użytkownika:** przebudowano Red Bulla na niebieski **namiot gwiaździsty**, sześć kotwionych ramion i otwarte łuki. Podstawa: zdjęcia 1 i 25 z [pakietu referencji](festival-user-reference-batch.md). Cztery instancje robocze: `(-22, 0)`, `(0, -21)`, `(0, 33)`, `(45, 13)`; razem ze sceną i IQOS sześć stref. Red Bull ma 6 meshy / 13 824 trójkąty i około 11,13 × 9,66 × 5,72 m. Wymiary oraz napis (bez dokładnego logotypu byków) są uproszczeniem. Biblioteka ma 1 706 864 B. Obejrzano podglądy `reports/festival-zones/redBull-star/`. Testy sprawdzają sześć niskich kotew, szczyt, otwarte wizualnie boki, unikalne identyfikatory i drożne dojścia.

Pełne collidery nadal blokują wnętrza. Mały parasol przy gastronomii nie ma jeszcze osobnego modelu. IQOS pozostaje bez referencji. Dalsze modele otoczenia wstrzymano na rzecz NPC. Poniższy opis zachowuje historię pierwszej iteracji; powyższa aktualizacja zastępuje starsze parametry i status Red Bulla.

## Zakres i źródła

| Obiekt            | Podstawa                                                                                                                                                                                 | Granica wiarygodności                                                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pomorze Zachodnie | [Artykuł organizatora z 31.07.2026](https://newsroom.polandrockfestival.pl/466920-pop-artowe-szalenstwo-w-strefie-pomorza-zachodniego-na-32-polandrock-festival) i dwa obejrzane zdjęcia | Niebieskie kontenery, kratownica, nagłośnienie, czarny daszek i biały kolorowy front są widoczne. Wymiary, ukryte elementy i grafika są interpretacją.               |
| Red Bull          | Opis użytkownika i [informator organizatora](https://issuu.com/fundacjawosp/docs/informator_32._pol_and_rock_festival_2026)                                                              | Duży parasol i lada według opisu użytkownika. Kolory, konstrukcja i rozmiar robocze; brak zweryfikowanego zdjęcia tego parasola.                                     |
| IQOS / strefa 18+ | Opis użytkownika oraz [lista wydarzeń marki](https://pl.iqos.com/pl/aktualnosci/strefy-iqos-na-festiwalach)                                                                              | Lista wymienia Czaplinek 2026, ale daty różnią się od organizatora. Nie traktować jej jako dokumentacji wyglądu. Dwa kioski to jawny placeholder, nie wierna wioska. |

Informator odczytano z [kopii osadzonej publikacji Fundacji WOŚP](https://embed-rech-01.dialog.cm/fundacjawosp/docs/informator_32._pol_and_rock_festival_2026), nie z działającego bezpośredniego widoku Issuu. Wymienia Red Bulla jako strefę partnera. Listy NGO i partnerów nie są listą sklepów pasażu.

Zdjęcia Pomorza pobrane wyłącznie do ignorowanego katalogu roboczego `reports/festival-references/`:

- `pomorze-newsroom-2026.jpg`: [źródło zdjęcia szerokiego](https://prowly-prod.s3.eu-west-1.amazonaws.com/uploads/4843/assets/845237/large-1b851c8ffca3e3750d42804f5844551a.jpg).
- `pomorze-wzp-2026.jpg`: [zdjęcie Urzędu Marszałkowskiego](https://wzp.pl/wp-content/uploads/2026/07/POLAND-ROCK-STREFA-WZP-07302026-SW-066.jpg), [artykuł źródłowy](https://wzp.pl/aktualnosci/newsy/urzad-marszalkowski/pomorze-zachodnie-zaprasza-do-strefy-na-pol-and-rock-festiwal-joga-pop-art-i-wiele-innych-atrakcji/).

Nie spakowano fotografii do gry. Szyldy są tekstem geometrii; nie są dokładnymi oficjalnymi logotypami. Dekoracja sceny to autorskie uproszczenie kolorowej obwódki, nie kopia grafiki organizatora.

## Modele i integracja

`scripts/blender/build-festival-zones.py` buduje jedną bibliotekę `world/festival/festivalZones.glb`, trzy korzenie oznaczone `festivalZone`:

- `pomorze`: kontenery z przetłoczeniami i narożnikami, podest, front, skromna kratownica z oprawami, głośniki, daszek i stanowisko DJ. Około 16,6 × 5,64 × 6,34 m. 13 meshy / 13 964 trójkąty.
- `redBull`: parasol około 7 m średnicy, żebra, podpory, maszt, obciążnik, lada, chłodziarki i uproszczone puszki. 5 meshy. Poprawiona osłona krawędzi biegnie po łuku czaszy, nie po cięciwie.
- `iqos`: dwa otwarte od frontu kioski, platforma, lady, oznaczenia i poręcze. Około 8,8 × 5,5 × 3,31 m. 7 meshy / 2404 trójkąty. Bez marek innych niż wskazana przez użytkownika, bez udawania pełnej listy wystawców.

Biblioteka około 1,34 MB. Mapy PBR tkaniny współdzielone, geometria scalona według materiału. Pozostałe materiały to proste PBR. To nadal prototypy, nie fotorealistyczne obiekty. Brak dodatkowych świateł runtime, timerów, rendererów i pętli animacji.

Istniejący `AssetLoader` i cache, katalog/manifest oraz `CampWorld` obsługują bibliotekę. `festivalZones.ts` klonuje korzenie, usuwa przesunięcia biblioteki, dopasowuje do najwyższego punktu terenu, zakłada maski trawy oraz collidery. Brak modeli nie pozostawia niewidocznych ścian ani pustych śladów. Zasoby współdzielone i sprzątane przez dotychczasowy disposer.

Pozycje robocze: scena `(0, 43)`, parasol `(-22, 0)`, IQOS `(23, 13)`. Fronty sceny i IQOS w stronę środka obozu; parasol w stronę pasażu.

Oglądanie wyłącznie z zewnątrz: całe obrysy mają pełne collidery, także pod parasolem. Brak wejścia na podesty, zakupów, sprzedawców, produktów nikotynowych do kupienia, animacji świateł i pomiarów FPS. Potrzebne zdjęcia parasola oraz wioski przed kolejną iteracją wyglądu.

## Weryfikacja

- `festivalZones.test.ts`: rzeczywisty GLB, skala/budżety/PBR, metadane źródeł, trzy warianty, dopasowanie do terenu, kolizje/grass mask, cache, pojedyncze zwalnianie, brakujące/niepełne biblioteki.
- `festivalCamping.test.ts`: ścieżki do wszystkich dotychczas testowanych namiotów, sześciu stoisk i nowych stref na siatce 0,5 m.
- 374 testy jednostkowe, 23 orkiestratora, build i zakresowy ESLint zaliczone. Walidator assetów obejmuje nową bibliotekę. Ostrzeżenie dużego bundla pozostaje.
- Podglądy Blendera: `reports/festival-zones/{pomorze,redBull,iqos}/festivalZones.png` oraz `festivalZones-front.png`.

Ponowna próba przez skill browser: `Browser is not available: iab`, lista przeglądarek `[]`; instrukcje diagnostyczne zastosowane. **VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN**. Podgląd offline nie jest raportem rozgrywki.

## Odtworzenie

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --factory-startup --python scripts/blender/build-festival-zones.py
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --factory-startup --python scripts/blender/audit-tents.py -- --root public/game-assets/world/festival --output reports/festival-zones/pomorze --models festivalZones --zone pomorze --views beauty front --size 1024
npx vitest run src/game/world/festivalZones.test.ts src/game/world/festivalMarket.test.ts src/game/world/festivalCamping.test.ts
```

Zamiana `--zone pomorze` na `redBull`/`iqos` oraz zmiana katalogu wynikowego daje pozostałe podglądy. Test wizualny w grze: `npm run dev` z dedykowanego worktree, porównanie wyglądu, skali, cieni, przejść i wydajności dzień/noc.
