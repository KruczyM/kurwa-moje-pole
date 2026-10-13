# Żywe biomy i wybór bohatera

Implementacja na `feat/bongo-living-biomes`, oparta na `10c584c`. Nie zmienia plansz,
kolizji, czasu spadania ani zapisów postępu. Zmiany nie są automatycznie publikowane.

## Menu i oprawa

Przepływ: **tytuł → galeria → poziomy → gra**. Zapamiętana postać jest tylko
wyróżniona; trzeba zatwierdzić ją przyciskiem. Escape cofa o jeden ekran menu,
a w grze wyłącznie przełącza pauzę. Powrót z pauzy otwiera tytuł i kasuje
zatwierdzenie bohatera. Kobra nie jest grywalna. Galeria pokazuje 15 pełnych
sylwetek i animuje jedynie wybraną, korzystając z istniejących klatek Walk.
Miniatury ładują się po dwie naraz; nieudane pobrania można ponowić, otwierając
galerię ponownie. Zablokowane poziomy pozostają niedostępne.

Cztery własne scenerie zostały wygenerowane wbudowanym `image_gen` zgodnie ze skillem
`imagegen`, bez API, kopiowania referencji ani odtwarzania GIF/MP4 w grze:

| Biom     | Sceneria                               | Plik                                                                        |
| -------- | -------------------------------------- | --------------------------------------------------------------------------- |
| Amarena  | Magazyn, ciepłe lampy, mokry pasaż     | [amarena-v1.png](../public/game-assets/2d/bongo-rush/living/amarena-v1.png) |
| Korzenie | Zatopione kamienne ruiny i świetliki   | [roots-v1.png](../public/game-assets/2d/bongo-rush/living/roots-v1.png)     |
| Rave     | Zaplecze sceny, kable, cyan i magenta  | [rave-v1.png](../public/game-assets/2d/bongo-rush/living/rave-v1.png)       |
| Grota    | Lodowe sklepienia, kryształy i odbicia | [glass-v1.png](../public/game-assets/2d/bongo-rush/living/glass-v1.png)     |

Dokładne prompty: [bongo-living-prompts.json](bongo-living-prompts.json).
Źródła mają 1536×1024 px i około 10,5 MB łącznie; są ładowane według potrzeb przez
istniejący cache. Górny szyld, dolna rama i tło sterowania dotykowego korzystają
z tej samej grafiki, bez dodatkowych pobrań i powiększania pasów ekranu.
Tytuł przyjmuje biom najwyższego odblokowanego poziomu. Wybór poziomu zmienia
scenerię; nie ma automatycznej karuzeli biomów.

Menu ma powolną paralaksę i maksymalnie 24 świetlne punkty. Gra ma 12 spokojniejszych
punktów za terenem. Refleksy to niewielkie, powoli zmieniające się kreski. Zachowano
dotychczasowe warstwy dekoracyjne z `Depth.ts`, jeden renderer i jeden RAF.
`prefers-reduced-motion` wyłącza ruch scenerii, miniatur i odpryski. Pauza zamraża
widok gry, ale RAF nadal działa.

## Prześwity, krawędzie i efekty

Grunt nadal jest solidną przeszkodą. Jego istniejące wygenerowane tekstury otrzymują
niewielkie otwory alfa **podczas przygotowania cache kafelków**, nie przez edycję
źródłowych PNG: poszarpane szczeliny w glinie, korzeniach i lodzie oraz prostokątne
perforacje w biomie metalowym. Budżet otworów wynosi około 5–15% powierzchni;
zewnętrzny obrys pozostaje pełny. Mury są nieprzezroczyste.

Krawędzie odsłoniętego tunelu są wyznaczane z czterech sąsiadów. Odłamki i krótkie
korzenie pozostają wewnątrz komórki, nie zasłaniają wolnej drogi. Cache ma maksymalnie
64 kombinacje na biom: dwa materiały, dwa warianty i 16 masek krawędzi.
Kopanie emituje krótkie odpryski, lądowanie wcześniej spadających obiektów — pył.
Łącznie może istnieć najwyżej 32 odprysków; nie zmieniają stanu symulacji.

## Muzyka

Wspólny motyw **A–E–G–B–C–E** ma cztery syntezowane aranżacje:
78 BPM — magazyn, 72 BPM — korzenie, 108 BPM — rave, 60 BPM — grota.
Pełna forma trwa 120 sekund: temat, wariacja, spokojniejszy odcinek i powrót.
Menu ma mniej nut i niższy poziom. Są filtry dolnoprzepustowe, różne barwy,
dłuższe wybrzmienia groty i dyskretny puls rave. Ważniejsze efekty gry przyciszają
muzykę; zmiana biomu wygasza stare głosy przez 250 ms. Pauza/wyciszenie zatrzymują
zaplanowane głosy, także te w trakcie wygaszania.

Audio uruchamia się wyłącznie po geście użytkownika. Nie ma zewnętrznych nagrań,
nowej pętli audio ani płatnego generatora. Próbki do odsłuchu (artefakty lokalne,
nie assety pobierane przez grę):
[Amarena](../reports/bongo-living/music/amarena.wav),
[Korzenie](../reports/bongo-living/music/roots.wav),
[Rave](../reports/bongo-living/music/rave.wav),
[Grota](../reports/bongo-living/music/glass.wav).

**SUBJECTIVE_AUDIO_VERIFICATION_PENDING_HUMAN**: wyrenderowano próbki i sprawdzono
sygnał, ale nie deklarujemy subiektywnego odsłuchu. Człowiek powinien ocenić barwę,
głośność, zapamiętywalność motywu oraz zmęczenie po kilku minutach gry.

## Rola modułów

- `MenuFlow.ts`: czysta nawigacja, zatwierdzanie bohatera i blokada startu.
- `HeroGallery.ts`: miniatury, ograniczenie równoczesnych pobrań, animacja wybranej
  sylwetki i sprzątanie własnych płócien; nie ma własnego RAF.
- `LivingScene.ts`: ścieżki scenerii, palety, deterministyczne punkty świetlne i refleksy.
- `TerrainDetails.ts`: alfa gruntu i maski odsłoniętych krawędzi.
- `VisualEffects.ts`: ograniczona pula odprysków obserwująca wyniki symulacji.
- `Music.ts`: nuty, barwy, pauzy i dwuminutowa forma utworów.
- `Audio.ts`: istniejący kontekst WebAudio, planowanie głosów, filtry, wygaszanie
  i pierwszeństwo efektów; nie pobiera muzyki z sieci.
- `Renderer.ts`: integracja scenerii, cache terenu, paralaksy i efektów.
- `main.ts`: istniejący host gry spina menu, ładowanie, input i pojedynczy RAF.

## Weryfikacja

- `npm run ci:code`: 183 pliki, 1746 testów jednostkowych oraz 6 testów narzędzi;
  dodatkowo lint, TypeScript, kodowanie i format. Dotychczasowe symulacje 16 plansz
  pozostają bez zmian.
- `npm run build`: PASS; pozostaje dotychczasowe ostrzeżenie o dużym bundlu gry 3D.
- `scripts/verify-bongo-living.py`: rzeczywista nawigacja, wszystkie miniatury,
  cztery biomy, faktyczne rysowanie terenu przed zrzutem, focus, stabilny obraz pauzy
  przy działającym RAF, cache scenerii i reduced motion. Desktop Chromium oraz
  WebKit iPhone 13; także produkcyjne ścieżki z prefiksem `/kurwa-moje-pole/`.
  Po zmianie mobilnego układu test czeka na ustabilizowanie rozmiaru i sprawdza
  różnorodność aktualnych pikseli płótna, nie tylko licznik wcześniejszych rysowań.
- `scripts/verify-bongo-music.py`: cztery 20-sekundowe próbki wyrenderowane przez
  OfflineAudioContext; szczyty około 0,034–0,039, brak przesterowania.
- `scripts/verify-bongo-performance.py`: porównanie pierwszej planszy z `10c584c`,
  te same profile, wyciszenie i 120 rozgrzanych klatek na wariant. Wyniki lokalne
  w `reports/bongo-living/performance.json`; nie są pomiarem fizycznego telefonu.

W pierwszym porównaniu średni czas callbacku na desktopie wyniósł 0,65 → 0,37 ms,
a w emulacji WebKit 2,52 → 2,93 ms. WebKit miał też długie odstępy między klatkami
już w wersji bazowej. Nie wyciągamy z tego gwarancji 60 FPS ani wniosku, że nowe
efekty poprawiają wydajność. Należy sprawdzić dłuższą sesję na fizycznym iPhonie.
Raporty i zrzuty lokalne: `reports/bongo-living/`.

Do odbioru przez człowieka pozostają fizyczny iPhone, odsłuch i końcowa ocena
estetyki. Nie wykonano push, PR ani merge.
