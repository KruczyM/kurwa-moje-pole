# Komory skalne — przechodniość kampanii

Gałąź: `feat/bongo-avalanche-puzzles`. Poprzednią wersję zachowano na
`feat/bongo-gameplay-polish`. Nie wykonywano push ani merge.

## Co się zmieniło

Każdy poziom ma własny układ i kolejność zagadek. Sześć nowych komór wydobywczych
łączy się z sześcioma istniejącymi zagadkami zasuw, stosów i kolejności kopania.
To 12 różnych kompozycji, a nie obietnica 12 zupełnie nowych zasad fizyki.

- **Łup pod podporą:** zabranie przedmiotu z bocznej wnęki uwalnia głaz.
  Wycofanie w bok otwiera górny korytarz.
- **Dwie niezależne kieszenie:** dwa spusty uruchamia się osobno, z osobnymi drogami odwrotu.
- **Zawał i górne obejście:** czteropiętrowy komin zawala dolne przejście po zabraniu łupu.
  Trzeba wykorzystać górną pętlę zamiast przepychać stos.
- **Jednokierunkowa żyła:** sześć przedmiotów pod trzema parami skalnych kolumn.
  Po przejściu para głazów zamyka odwrót — nie można odsunąć dwóch jednocześnie.
- **Skarbiec za zasuwą:** najpierw przygotowuje się wnękę górnym obejściem,
  potem przesuwa głaz i schodzi po łup.
- **Dwa łupy, przeciwne zasuwy:** dwie wysokości i dwie przeciwne strony pchania;
  pozostawienie miejsca na dolny głaz jest częścią rozwiązania.

Poziomy 4, 9, 11 i 12 mają większe kolumny skał; 9 skupia się na kolejnych zawałach,
a 12 łączy je z zasuwami i istniejącą zagrodą bossa. Poziomy 6 i 10 są bardziej
logiczne niż lawinowe: głównym problemem jest kolejność i strona przesuwania skał.
Główna sieć komór zachowuje odnogi, opcjonalne złoża, patrole i Kobrę.

## Obowiązkowy łup

Przedmioty ze złotą obwódką w skrzydle zagadki trzeba zebrać **wszystkie**.
Zwykłe nadmiarowe przedmioty z innych komór nie zastępują ich. HUD pokazuje liczbę
pozostałych po wypełnieniu normalnej dostawy, minimapa zaznacza je na złoto,
a pomoc wyjaśnia regułę. Pozycje startowe zapisuje `LevelDefinition.requiredPickups`;
flaga `LooseObject.required` podąża za konkretnym ciałem, także gdy ono spadnie.

Nie zmieniono zasad grawitacji. Stojący głaz nad graczem jest podparty graczem;
już spadający głaz przygniata. Komory nie wymagają błyskawicznego kliknięcia:
testowane rozwiązania nowych komór działają także z 30 pustymi krokami między ruchami.

## Symulacja wszystkich poziomów

```powershell
npx tsx scripts/simulate-bongo-campaign.ts
npm run test:unit -- src/games/bongo-rush
```

Skrypt przechodzi produkcyjny `Simulation.step`, bez teleportacji, usuwania skał,
zmiany zegara ani wyłączania przeciwników. Sprawdza każdy ruch, brak przegranej,
stan `won` i zebranie całego wymaganego łupu. Uruchamia dwa profile na każdy poziom:
ciągły oraz z dwoma pustymi krokami przy zmianie kierunku. Wynik: **24/24 wygrane**.

| Poziom | Ruchy | Wymagany łup | Czas trasy bez przerw | Limit czasu |
| ------ | ----- | ------------ | --------------------- | ----------- |
| 1      | 370   | 1            | 51,80 s               | 210 s       |
| 2      | 344   | 2            | 48,16 s               | 210 s       |
| 3      | 401   | 1            | 56,14 s               | 240 s       |
| 4      | 334   | 6            | 46,76 s               | 210 s       |
| 5      | 415   | 2            | 58,10 s               | 240 s       |
| 6      | 436   | 2            | 61,04 s               | 270 s       |
| 7      | 502   | 1            | 70,28 s               | 300 s       |
| 8      | 495   | 3            | 69,30 s               | 300 s       |
| 9      | 504   | 9            | 70,56 s               | 300 s       |
| 10     | 673   | 2            | 94,22 s               | 390 s       |
| 11     | 758   | 7            | 106,12 s              | 450 s       |
| 12     | 773   | 9            | 108,22 s              | 450 s       |

Pełny lokalny wynik: `reports/bongo-avalanche/simulation-report.json`.
`reports/` jest ignorowany przez Git; skrypt odtwarza raport po pobraniu kodu.

Nowe testy obejmują 6 komór × 3 tempa, wszystkie 12 poziomów przy nadmiarze
zwykłego łupu, blokadę odwrotu, zachowanie znacznika po upadku przedmiotu
i walidację błędnych współrzędnych oraz rzeczywistą blokadę wyjścia po ominięciu łupu.
Łącznie 181 testów gry Bongo Rush.
`npm run ci:code`: 1655 testów jednostkowych i 6 testów narzędzi — PASS.
`npm run build`: PASS; istniejące ostrzeżenie o dużym pakiecie gry 3D pozostaje.

## Przeglądarka i ograniczenia dowodu

Weryfikacja przeglądarki — PASS:

- Galeria wszystkich 12 jaskiń i minimapa.
- Pełne trasy 1, 9 i 12 przez rzeczywiste wejście klawiatury w Chromium.
- Pełna trasa 7 przez rzeczywiste wejście klawiatury w WebKit z profilem iPhone 13.
- Wszystkie sześć nowych rodzajów komór występuje w sprawdzonych trasach.
- Pauza zamraża symulację, ale RAF działa dalej; brak błędów JavaScript i HTTP.
- Skompilowany build z prefiksem Pages działa w Chromium i WebKit;
  przywraca fokus i sterowanie po pauzie, nie udostępnia debugowego API.
- Obejrzany zrzut mobilny: HUD, informacja o wymaganym łupie, podpowiedź i gałka
  mieszczą się w szerokości ekranu. Fizyczny iPhone nadal wymaga sprawdzenia człowieka.

Raporty lokalne: `reports/bongo-avalanche/browser-report.json`, zrzuty `vault-*.png`
oraz `reports/bongo-rush/production-report.json`. Test tras odtwarza polecenie:

```powershell
python scripts/verify-bongo-puzzles.py --port 5200 --levels 1 7 9 12 --output reports/bongo-avalanche
```

Pierwszy przebieg został unieważniony przez automatyczne przeładowanie Vite podczas
formatowania kodu. Raport PASS pochodzi z powtórzenia po ustabilizowaniu plików.
Po rozbudowie tras dwa zbiorcze testy wszystkich poziomów przekroczyły limit 5 sekund
przy równoległej pracy przeglądarek. Rozdzielono je na przypadki dla każdego poziomu,
bez usuwania asercji i bez zwiększania globalnego limitu czasu.

## Samodzielne review

Sprawdzono: nowe trasy nie wyłączają zagrożeń; wymagany łup zachowuje tożsamość
po upadku; nadmiar zwykłego łupu nie otwiera wyjścia; cały zawał nie blokuje trasy
referencyjnej; pary skalne rzeczywiście blokują odwrót. Poprawiono pojedynczą kolumnę,
którą dało się przepchnąć wstecz, oraz nieaktualne wyjaśnienie podpór w pomocy.
Zachowano istniejący renderer, grawitację, dt i jedyny RAF. Nie zmieniano modeli 3D,
lokalnych grafik użytkownika ani publikacji GitHub.

Symulacja dowodzi istnienia poprawnej trasy każdego poziomu, **nie** tego,
że dowolna kolejność kopania jest bezpieczna. Celowo można zaklinować skały
lub pozwolić Kobrze odciąć przejście; R / ↻ restartuje poziom. Cofanie ruchów
i automatyczne wykrywanie wszystkich blokad nie są zaimplementowane.
Subiektywny balans trudności oraz wygoda na fizycznym telefonie wymagają gry człowieka.
