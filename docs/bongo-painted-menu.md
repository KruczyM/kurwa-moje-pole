# Bongo Rush — malarskie menu główne

## Zakres

Menu w stylu Artystycznym odtwarza zaakceptowaną kompozycję: jesienna podziemna budowla,
Amper przy gramofonie, kamienne złote logo, drewniane przyciski i cztery karty biomów.
Scena, logo i ramy są grafikami rastrowymi. CSS odpowiada za układ, stany kontrolek i delikatną
zmianę jasności sceny; animacja respektuje `prefers-reduced-motion`.

Styl Standardowy pozostaje dostępny w „Oprawa i muzyka” i nie pobiera rasterów menu.
Mechanika, geometria map, sterowanie, pełnoekranowy widok planszy i opcjonalna minimapa
nie zostały zmienione.

## Nawigacja i zapis

- „Kontynuuj” uruchamia ostatnio rozpoczęty poziom z wybraną postacią.
- Starszy zapis bez `lastLevel` wskazuje najwyższy odblokowany poziom.
- Kliknięcie podglądu innej planszy nie zmienia zapisu kontynuacji.
- Karty biomów filtrują istniejący wybór poziomów, zachowując globalne indeksy i blokady.
  Każdy biom obejmuje pięć plansz kampanii i jedno wyzwanie.
- „Wybierz poziom” nadal otwiera wszystkie 24 plansze bez ponownego wyboru postaci.
- Tryb `art-preview` nie zmienia odblokowań ani `lastLevel` kampanii.

## Grafiki i zasoby

Trzy obrazy menu są pobierane przez istniejący ImageCache i ujawniane razem po ukończeniu
całego zestawu. Przy błędzie pozostaje działające proste menu z jawnym przyciskiem ponowienia;
nie następują automatyczne ponowienia w pętli renderowania. Późna odpowiedź po zmianie stylu
nie przywraca poprzedniego wyglądu. Późna odpowiedź po zamknięciu hosta usuwa obrazy z cache.

Źródłowe PNG znajdują się w `source-assets/bongo-menu-v1/`, a pliki WebP w
`public/game-assets/2d/bongo-rush/menu-v1/`. Ich pochodzenie, sumy kontrolne, wymiary i rozmiary
zapisano w `docs/bongo-painted-menu-sources.json`. Łączny transfer WebP wynosi 1 937 448 bajtów.
Konwersja nie zmienia wymiarów; logo i atlas zachowują przezroczystość.

Portret wybranej postaci wykorzystuje dotychczasowy atlas i miniatury HeroGallery.
Menu nie dodaje nowego loadera postaci ani pętli requestAnimationFrame.

## Walidacja

- `npm run ci:code`: PASS, 231 plików / 2338 testów, format, lint i TypeScript.
- `npm run ci:assets`: PASS, walidacja assetów, rigów i sektorów mgły.
- `npm run build`: PASS.
- Niezależny przegląd: brak otwartych P1/P2; 31 testów ukierunkowanych PASS.
- Przeglądarka Chromium i WebKit: style Standardowy i Artystyczny, rozmiary 320×568,
  390×844, 844×390, 1280×800, 1672×941 i 1912×900.
- Kontynuacja po przeładowaniu, filtry, blokady i bezpośredni wybór planszy: PASS.
- Brak poziomego przewijania, kontrolki dostępne na niskich ekranach przez przewijanie: PASS.
- Utrata wszystkich trzech obrazów menu, brak ponawiania w RAF i ręczne odzyskanie: PASS.
- Spóźnione obrazy po zmianie stylu na Standardowy: PASS.
- Niezależna reprodukcja zamknięcia hosta podczas pobierania: RAF wyłączony, cache pusty
  także po ukończeniu odpowiedzi.
- Jazz menu: odtwarzanie i pojedynczy głos potwierdzone w Chromium. Automatyczny WebKit
  na tym komputerze nie udostępnia działającego kontekstu Web Audio; nie stanowi testu dźwięku iOS.

Powtarzalna kontrola przeglądarkowa:
`python scripts/bongo-v6/verify-painted-menu.py http://127.0.0.1:5188/bongo-rush.html?verify`.
Szczegółowy raport i zrzuty ekranu powstają w ignorowanym katalogu `reports/bongo-painted-menu/`.

Zachowano aktualne poprawki muzyki z main, w tym PR #137 i #138. Test preload akceptuje
formatowanie wielowierszowe HTML. Zmiany są wydzielone w commitach gałęzi
`codex/bongo-painted-menu`, aby można było je niezależnie wycofać.
