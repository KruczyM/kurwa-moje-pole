# Mapa z Blendera i podglądy telebimów — 2026-10-04

Gałąź `feat/festival-next`, bez push/merge. Nie zmieniono ustawienia modeli ani zapisanego `.blend`.

## Mapa

Przyczyna starego schematu: menu w `main.ts` tworzyło oddzielną instancję FestivalMap bez danych authored world. Samo przekazanie footprintów po starcie Game nie mogło jej naprawić.

Obie instancje korzystają teraz z lekkiej referencji eksportowanej z aktualnego Blendera: `public/game-assets/world/festival/map-top.png` (1600 × 1200, około 2,1 MB) i `map-layout.json`. Nie trzeba pobierać i dekodować całego GLB, aby obejrzeć mapę w menu. Obraz jest renderem ortograficznym z teksturami, bez grzybka. Metryczna rejestracja obejmuje X −170…290 i Z −172,5…172,5. Obraz, znaczniki, cel, zoom i przeciąganie korzystają ze wspólnej projekcji. Po starcie gry dane runtime aktualizują pozycje markerów, nie rysują drugiej warstwy arbitralnych prostokątów ponad obrazem. Brakujące modele nie zachowują markerów pod starymi współrzędnymi (np. aktualny eksport nie zawiera `smallStage`).

`node scripts/export-authored-world.mjs` po udanym eksporcie świata odświeża również rzut i manifest mapy. Rzut wymaga ponownego eksportu po przesunięciu modeli w Blenderze; nie jest dynamiczną kamerą Three.js.

## Ekrany sceny

`StageLiveScreens` obsługuje istniejące `Wing_Single_Telebim_Left/Right`, wyłączone z batchingu statycznego. Oba ekrany korzystają ze wspólnej tekstury renderowanej na żywo: 512 × 288, maksymalnie 10 klatek/s. Nie powstaje drugi renderer ani RAF. Podgląd jest wykonywany przed głównym renderem, z przywróceniem render targetu, viewportu, scissora, XR i ustawień cieni. Same ekrany są ukryte podczas nagrania, aby uniknąć rekurencji. Daleko od ekranów (ponad 240 m) render podglądu jest pomijany; cykl ujęć nadal się aktualizuje.

Cykl: pasaż północny → pasaż południowy → widownia pod sceną → główny obóz → losowy zalogowany gracz z góry. Każdy slot trwa 30 sekund. Gracz jest wybierany raz na slot, kamera podąża za aktualną pozycją tego ID. Przy braku gracza/rozłączeniu następuje fallback na obóz. Wybór obejmuje innych graczy z markerów sieciowych i własnego gracza, jeśli połączony. Własny avatar korzysta z istniejącej fabryki postaci i cached GLTF; jest widoczny tylko w renderze TV, nie zasłania kamery FPS. Materiał, render target, prywatny szkielet/mixer oraz instancja lokalnego avatara są sprzątane przy dispose.

## Walidacja

30 testów deterministycznych w 5 plikach: mapa, harmonogram/wylosowanie ujęć, współdzielenie tekstury, przywracanie stanu renderera nawet przy wyjątku, limit FPS, sprzątanie, wyłączenie ekranów z batchingu, istniejące kolizje namiotów — PASS. Typecheck i build — PASS (istniejące ostrzeżenie wielkości bundla). ESLint plików objętych zmianą — PASS.

Browser QA: `scripts/verify-map-live-screens.py`, raport i screenshoty w `reports/festival-blender/map-live-screens/`. Zweryfikowano mapę w menu i w grze, dwa rzeczywiste meshe ekranów, pięć slotów, niepusty framebuffer ujęć, podążanie za markerem oraz brak błędów JS. Obejrzano mapę menu i podgląd obozu na obu ekranach. Śledzenie zdalnego ID sprawdzono kontrolowanym markerem; nie należy utożsamiać tego z pełnym testem sesji dwóch ludzi.

`VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`: sesja z dwoma rzeczywiście zalogowanymi graczami, sprawdzenie ruchu na podglądzie oraz benchmark FPS na docelowym sprzęcie. Limit 10 FPS zmniejsza częstotliwość dodatkowego renderu, nie dowodzi określonego wzrostu wydajności.

Znany problem poza zakresem: w testowanej sesji sekcja loading przechwytywała kliknięcie przycisku pomijania doczytywania tłumu. QA wywołuje istniejący przycisk programowo, następnie czeka na stan playing; to nie dowód poprawności jego kliknięcia myszą.

Korekta proporcji fasady z poprzedniego zadania pozostaje osobnym niedokończonym tematem; działające telebimy jej nie rozwiązują.

## Korekta podpisów i kliknięcia mapy

Usunięto ustawianie namiotu w handlerze pointerup/pointercancel oraz instrukcję „Kliknij: zmiana celu”. Kliknięcie nie zapisuje ani nie przestawia celu; istniejący zapisany znacznik nie jest automatycznie kasowany. Przeciąganie i scroll nadal działają.

Dodano Siema Shop na `Market_1` (użytkownik potwierdził przeznaczenie modelu), strefę jedzenia przy słonecznikach obejmującą `food_tent_south_*` i południowe foodtrucki oraz jedzenie naprzeciw Pomorza obejmujące `food_tent_north_2`, Churros i Makarun. Pozycje grup wynikają ze wspólnych granic modeli. Eksport mapy i odczyt świata runtime uwzględniają te obiekty Infrastructure, wcześniej pomijane w metadanych mapy. Nie przesuwano modeli.

Dwa nowe testy: kliknięcie/anulowanie pointera nie zmienia znacznika; podpisy mają współrzędne z danych modeli i nie zostają po usunięciu obiektów. 22 testy w FestivalMap/AuthoredFestivalWorld — PASS; typecheck — PASS. Browser QA dodatkowo sprawdza obecność wszystkich trzech podpisów oraz brak zmiany zapisanego namiotu po rzeczywistym kliknięciu canvasu.
