# Bongo Rush — audyt biomów, trudności i dalszych prac

Data: 2026-10-11. Gałąź: `feat/bongo-biomes-puzzles`.
Worktree: `.ai/worktrees/bongo-puzzles`.

## Co wykazał przegląd

Poprzednie plansze były duże, ale rozmiar nie oznaczał trudności logicznej.
Większość obowiązkowej trasy prowadziła przez ziemię i bezpieczne przedmioty.
Wnęki do przepychania były już puste, więc wystarczało trzymać kierunek.
Nadmiar łatwych złóż pozwalał ominąć ryzykowne odnogi i patrole. Finał wymagał
zamknięcia zagrody, ale wcześniejsze poziomy nie miały obowiązkowej zagadki wyjścia.

Nie nazywam tych poziomów trudnymi tylko dlatego, że test przejścia trwa dłużej.
Testowana trasa jest dowodem istnienia rozwiązania, nie pomiarem najkrótszej drogi
ani satysfakcji gracza.

## Wdrożone ulepszenia

### Cztery konstrukcje ścian

| Biom              | Ściana nieprzekopywalna                                         | Materiał do kopania             |
| ----------------- | --------------------------------------------------------------- | ------------------------------- |
| Magazyn Amarena   | Cegły z przesuniętymi spoinami, odpryski, stalowe klamry        | Ciemny gruz i ziemia            |
| Zielone podziemia | Grube splątane korzenie, odnogi i liście                        | Próchnica z cienkimi korzeniami |
| Neonowy rave      | Ścięte metalowe panele, wentylacja, śruby i neonowe przewody    | Pokruszony asfalt z przewodami  |
| Dymna grota       | Duże jasne tafle lodowo-szklane, rozgałęzione pęknięcia i bąble | Szron i drobne płatki           |

Zmieniono geometrię rysunku, nie tylko kolory. Test porównuje polecenia rysowania
bez kolorów, więc samo przefarbowanie kafelków nie zalicza różnorodności biomów.
Kafelki nadal powstają raz w istniejącym cache; nie dodano renderera, RAF ani assetów bitmapowych.

### Obowiązkowe zagadki wyjścia

Komora ma jedno wejście i jest otoczona ścianami. Zebranie nadmiaru przedmiotów
nie pozwala przejść obok jej głazu:

1. **Poziomy 1–3 — Kieszeń na głaz.** Pchanie nie działa, dopóki we wnęce jest ziemia.
   Trzeba dojść do niej od góry, przygotować miejsce i wrócić na stronę pchania.
2. **Poziomy 4–6 — Spust skalny.** Głaz zagradza przejście i nie można go od razu
   przepchnąć w ziemię. Dolnym odgałęzieniem odkopuje się podporę, wycofuje w bok
   i wraca na górną trasę po uwolnieniu głazu do dołu.
3. **Poziomy 7–12 — Podwójny spust.** Dwie takie operacje w kolejności przestrzennej.
   Na poziomie 12 dodatkowo zachowano zamykanie zagrody bossa.

Podpowiedzi komory są kontekstowe: pojawiają się przy skrzydle wyjściowym,
nie zastępują instrukcji eksploracji przez całą planszę. Pierwsze poziomy celowo
tłumaczą zasadę, zamiast karać za nieznajomość mechaniki.

Ocena projektowa po zmianie: **łatwe wprowadzenie → łatwe/średnie planowanie**.
To nadal nie jest kampania dla ekspertów. Trzy powtarzane rodziny zagadek uczą
podstaw, ale podwójny spust nie jest dwukrotnie trudniejszy od pojedynczego.

## Mierzalna weryfikacja

- Wszystkie 12 pełnych tras przechodzi prawdziwą symulację, bez zablokowanych ruchów.
- Trasy mają 319–639 ruchów i 4–21 przepchnięć. To trasy akceptacyjne, nie wyniki optymalne.
- We wszystkich komorach test bez przesuwania/spadania skał nie znajduje drogi do wyjścia,
  nawet jeśli pozwala swobodnie kopać ziemię i zbierać przedmioty.
- Testy obejmują złą próbę pchania w ziemię, blokadę wejścia w poruszający się głaz,
  poprawne przygotowanie wnęki, oba spusty oraz pełną kampanię z nadmiarem zbiorów.
- Zachowano testy spójności całej mapy, deterministyczności i wzrostu Kobry.
- Zagadki działają również po 30 pustych tickach przed każdym ruchem: można się
  zatrzymać i planować. Patrole w pozostałych częściach mapy nadal poruszają się
  w czasie aktywnej gry; pauza pozostaje bezpiecznym sposobem przemyślenia trasy.
- `npm run ci:code`: PASS — 1540 testów jednostkowych w 168 plikach i 6 narzędziowych.
- `npm run build`: PASS. Pozostaje wcześniejsze ostrzeżenie o wielkości osobnego
  bundla festiwalu 3D; wejście Bongo Rush nie pobiera tego bundla.
- `python scripts/verify-bongo-puzzles.py`: PASS. Galeria otworzyła wszystkie 12
  poziomów i sprawdziła przełączanie minimapy. Pełne trasy poziomów 1, 4 i 12
  ukończono klawiaturą w Chromium, a poziom 7 klawiaturą w WebKit z profilem iPhone 13.
  Obejmuje to trzy rodziny zagadek, kontekstowe podpowiedzi, pauzę przy wejściu
  do komory, działający RAF oraz końcową zagrodę bossa.
- Brak błędów JavaScript i HTTP w przebiegach zagadek. Galeria używa jawnego
  fixture odblokowanych poziomów, nie udaje przejścia całego zapisu kampanii.
  Nie teleportowano gracza ani nie przyspieszano symulacji. Test zwalnia klawisz
  zdarzeniem DOM po osiągnięciu celu, żeby opóźnienie protokołu nie dodało ruchu.
- Raport JSON i zdjęcia: lokalny, ignorowany katalog `reports/bongo-puzzles/`.
- `git diff --check`: PASS.

Przebieg przeglądarkowy wykrył także rzeczywisty błąd sterowania: po wejściu
w obszar dłuższej podpowiedzi stopka zmieniała wysokość planszy, a `resize()`
kasował trzymany kierunek. Wysokościowa zmiana układu nie resetuje już inputu.
Zmiana szerokości/orientacji oraz utrata fokusu nadal zachowują sprzątanie inputu.

Samodzielne code review objęło szczelność skrzydła zagadki, podparcie skał,
utrzymanie starej zagrody finałowej mimo szerszej mapy, istniejący cache kafelków
i brak nowych pętli/listenerów. Nie zmieniono fizyki ani assetów After.
Test fizycznego telefonu i niezależny odbiór trudności pozostają do wykonania.
Nie wykonano push, PR ani merge.

## Co jeszcze trzeba zrobić

### Najpierw — jakość kampanii

1. **12 bardziej indywidualnych projektów zagadek.** Obecnie sieci komór i trzy
   rodziny zakończeń powtarzają się. Potrzebne są mieszane układy: wybór kolejności
   podpór, ograniczona liczba wnęk, odcięcie patrolu głazem, bezpieczna lawina
   otwierająca nową drogę i sekcja z Kobrą wymagająca zaplanowania odwrotu.
2. **Balans na podstawie prób gracza.** Zmierzyć czas, zgony, momenty zagubienia
   i powody restartu. Zmniejszać nudne odcinki kopania; trudność zwiększać decyzjami,
   a nie samą powierzchnią lub liczbą przeciwników. Brak solvera najkrótszych rozwiązań.
3. **Więcej presji ze strony patroli.** Na bezpiecznej trasie część kieszeni można
   całkiem ominąć. Trzeba ręcznie zaprojektować spotkania, z czytelnym ostrzeżeniem
   i drogą ucieczki, zamiast losowo wrzucać wroga pod gracza.
4. **Czytelny sygnał ryzyka i opcjonalne podpowiedzi.** Zapowiedź uruchomienia
   spustu/lawiny, wyraźniejsze podparcie skał, podpowiedzi w dwóch stopniach na żądanie.
   Obecne automatyczne instrukcje są dobre do nauki, ale zdradzają za dużo na trudniejszych planszach.

### Potem — oprawa i odbiór

5. Dopasować skały, przedmioty i dekoracje do konstrukcji każdego biomu; teraz przede
   wszystkim ściany i ziemia mają oddzielną oprawę. Urozmaicić łączenia kafelków,
   żeby duże powierzchnie mniej przypominały powtarzaną tapetę.
6. Dopracować rozpoznawalność i animację postaci, patroli i nagrody. Wygląd postaci
   nadal jest kosmetyczny, zgodnie z założeniem jednakowych zasad gry.
7. Dobrać i odsłuchać odrębne odgłosy kopania, odbić i zbierania dla biomów,
   z bezpiecznym poziomem głośności. Obecne audio jest syntezowane przez WebAudio.
8. Sprawdzić całą kampanię dotykiem na fizycznym iPhonie i Androidzie: FPS,
   czytelność ściana/ziemia, gałka, ergonomia minimapy, pion i poziom. Emulacja
   nie potwierdza 60 FPS na urządzeniu.
9. Po odbiorze wykonać niezależne review i uzgodnioną publikację właściwej gałęzi.
   Testy lokalne nie oznaczają, że zmiany są już na GitHub Pages.

Opcjonalnie później: medale za czas/liczbę ruchów, statystyki prób i edytor plansz.
Nie są konieczne do ukończenia podstawowej gry i nie zostały dodane w tym zadaniu.
