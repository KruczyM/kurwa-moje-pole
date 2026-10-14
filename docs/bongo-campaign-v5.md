# Bongo Rush — kampania i postacie v5

## Przekazanie

Branch: `codex/bongo-campaign-expansion`. Worktree: `.ai/worktrees/bongo-campaign-expansion`.
Zmiany rozszerzają lokalne v4 z commita `9333f48`; bazą opublikowanej gry jest `985fee9`.
Push, PR i merge nie zostały wykonane. Niezależny review przed integracją: **PENDING**.

## Kampania

Aktywny wybór obejmuje 20 plansz głównych i cztery wcześniejsze wyzwania, a nie ukryte definicje legacy.
Rezerwuary, wyspy i spirala zachowują poprzednią geometrię. Napis KURWA / MOJE / POLE
ma dziewięć dodatkowych obowiązkowych wnęk między literami; końcowa trasa wymaga 52 przedmiotów,
w tym łupu z wymaganej eliminacji. Nie wystarczy zamiatanie dolnych rzędów.

Pierwsza plansza łączy złoże 4×3 z łupem pod podporą. Druga ma złoże 7×4 oraz przygotowywaną
zasuwę; trzecia wymaga przygotowania górnego głazu przed złożem 6×5. Są też leje, przeciwne
zasuwy, dwupoziomowe złoża, ruchome cele i finał z istniejącą zagrodą bossa.
Plansze 7 i 19 prowadzą przez środek fizycznej górki do konkretnej amareny; poprawna ucieczka
schodzi w dół, bo zawrócenie wchodzi pod spadający łup. Nadmiar zwykłych przedmiotów nie zastępuje
obowiązkowego znaleziska. Bogaty kafelek na 10 uwalnia 12 przedmiotów do szerokiej galerii.

Portale występują tylko na 12 (dwie pary) i 18 (trzy pary). Tworzą pętle przez komory,
z lądowaniami we wnękach poza trasą zbierania. Wszystkie komory aktualizuje ten sam zegar:
grawitacja, patrole i Kobra nie zamrażają się po przejściu przez portal. Nieaktywne komory nie mają
fikcyjnego gracza blokującego obiekty. Restart odtwarza całość.

Kobra jest widoczną kolonią (`V` w ASCII albo `colonies` w definicji) od początku.
Rośnie falami na cztery sąsiednie, faktycznie puste pola. Nie kopie ziemi, nie przenika przez
ściany, przedmioty, gracza, przeciwników ani portale. Zdobycie łupu może odsłonić miejsce do wzrostu.
Warianty 8, 15 i 17 używają fal co 2,4 s; pozostałe co 5 s. Pierwszy wariant ma otwarty korytarz
zarastający od startu, więc długie zwlekanie zamyka przejście. Pauza zatrzymuje symulację.

Zapis pozostaje pod istniejącym kluczem, z `campaignRevision: 2`. Stare odblokowania 13–16
przechodzą na 21–24; preferencje postaci i dźwięku zostają. Ukończenie starej kampanii nie jest
przedstawiane jako ukończenie nowej. Zachowanie odblokowanych bonusów oznacza również dostęp
do poprzedzających je nowych plansz w istniejącym modelu odblokowania kolejnego numeru.

## Grafika i animacja

Ściany mają jeden dominujący materiał na komorę oraz ciągłe pasma zgodne z granicami pomieszczeń.
Usunięto losowanie rozmieszczenia architektury i zmiany materiału co kilka kafelków.
Mikrowarianty powierzchni są nadal zakotwiczone w świecie.

19 nowych atlasów: 15 bohaterów, trzy patrole i boss. Każdy ma cztery kierunki,
dwie klatki idle i osiem chodu, rozmiar klatki 128×128. Wykorzystano istniejące modele,
większe głowy, niższy kąt kamery i czytelniejsze oświetlenie; boss otrzymał lokalny rig i cykle.
Nie dodano modeli 3D do runtime. Cały zestaw PNG i metadanych zajmuje około 6 MB.
Galeria i gra korzystają z tych samych nowych atlasów i istniejącego cache.

Ruch patroli ma ciągłą prezentację przez ich istniejący okres dwóch lub trzech ticków.
Subtelny obrys podłoża wskazuje logiczne zajęte pole podczas interpolacji; kolizje i tempo fizyki
pozostają wspólne z poprzednią grą. Zmiana komory i restart resetują prezentację.
Animacja zachowuje fazę przy zmianach kierunku i nie wraca stale do pierwszej klatki;
idle ma spokojniejsze tempo. Pojedynczy RAF pozostaje w istniejącym hoście.

Twarz z dostarczonego później zdjęcia w lepszej jakości przygotowano wbudowanym `image_gen` jako przezroczysty wycinek z obrysem.
Runtime: `public/game-assets/2d/bongo-rush/kobra-face/face.png`.
Referencja i prompt: `source-assets/bongo-rush/kobra-face/`.
Każdy segment Kobry pokazuje twarz; nowe segmenty mają krótką animację pojawienia opartą o ticki,
z uwzględnieniem reduced motion. Obraz jest raz wypiekany do małego canvasa w rendererze.

Na telefonie mniejsza minimapa znajduje się przy dolnym sterowaniu, poza górnym obszarem zbierania.
Pomoc opisuje samoczynny wzrost i stale aktywne komory.

Regeneracja postaci: Blender z `scripts/blender/render-bongo-readable.py`, potem
`python scripts/pack-bongo-readable.py`. Boss: wcześniej `scripts/blender/build-readable-boss.py`.
Packer odrzuca puste lub przycięte klatki. Bez kluczy API, płatnych usług i dodatkowych loaderów.

## Walidacja

- `npm run ci:code`: PASS — 204 pliki, 1933 testy jednostkowe i 6 testów narzędzi.
- `npm run ci:assets`: PASS. Build z bazą `/kurwa-moje-pole/`: PASS.
- Wszystkie 19 atlasów: 40 kompletnych klatek, poprawna alfa i marginesy, bez przycięć.
- `scripts/audit-bongo-campaign-v5.ts`: 24 zwycięskie trasy oraz 24 konkretne nieudane sekwencje.
  Nieudane sekwencje nie są dowodem nieodwracalności każdego błędu; część można naprawić inną trasą.
  Osobne testy sprawdzają śmierć przy zawróceniu pod kaskadę, zablokowanie przesmyku przez zwlekanie,
  obowiązkowy łup, wzrost kolonii i działanie opuszczonych komór.
- `verify-bongo-campaign-v5.py`: 24/24 zwycięstwa Chromium oraz 24/24 WebKit/iPhone; prawdziwe wejścia, pauza, restart, chwyt joysticka, cache ≤256, brak błędów JS/HTTP.
- `verify-bongo-campaign-v5-production.py`: PASS — desktop, WebKit pion/poziom; po sześć plansz, rzeczywiste wejście w portal, pauza, pomoc, geometria nakładki, zgodność SHA256 twarzy, postaci i tekstur. Końcowe atlasy, minimapa oraz nowa twarz sprawdzone w skompilowanym buildzie.
- Raporty i zrzuty: `reports/bongo-campaign-v5/` (ignorowane pliki generowane).

Pomiar końcowy `measure-bongo-v5.py` (krótka próbka, bez równoległych testów): koszt callbacku
mediana/p95 desktop 0,8/2,4 ms, WebKit pion 1/36 ms, poziom 1/42 ms. Odstępy klatek:
desktop 16,7/33,4 ms, WebKit pion 67/90 ms, poziom 79/100 ms. Emulowany WebKit ma nadal
wyraźne spadki; te wyniki nie potwierdzają 60 FPS ani usunięcia wszystkich problemów wydajnościowych
na telefonie. Ciągłość ruchu i fazy animacji jest sprawdzona deterministycznie; wydajność sprzętowa wymaga odbioru.

Sam replay i build nie dowodzą zabawy. Ocena atrakcyjności, odsłuch oraz wygoda i FPS na fizycznym
telefonie: **PENDING_HUMAN**. Emulacja WebKit nie zastępuje fizycznego urządzenia.
Niezależny review: **PENDING**; dopiero po nim orkiestrator może wykonać integrację i publikację.

## Odniesienia

- [Układy ASCII klasycznego Boulder Dash](https://codeincomplete.com/articles/javascript-boulderdash/decoded_cave_data.pdf): komory, złoża, tory, leje i zbiorniki.
- [Katalog Rocks’n’Diamonds](https://www.artsoft.org/rocksndiamonds/levels/): bank dalszych różnorodnych konstrukcji.
- [BD2K3](https://www.artsoft.org/rocksndiamonds/levels/BD2K3/): zależności przestrzenne i przygotowanie przeszkód.

Układy v5 są autorskimi adaptacjami zasad, nie importem całego katalogu ani kopią wszystkich map.
