# Audyt telefonu i ładowania modeli — 2026-10-08

> ARCHIWUM: 2026-10-10 użytkownik zlecił cofnięcie tego pakietu optymalizacji,
> ponieważ pogorszył wygląd i nie zapewnił wystarczającej płynności. Poniżej
> zachowano historyczne pomiary, nie opis bieżącego działania. Szczegóły cofnięcia:
> `docs/mobile-rollback.md`. Skrypty dotyczące usuniętego wariantu mobilnego również usunięto.

Gałąź: `fix/iphone-memory`, worktree `.ai/worktrees/iphone-memory`.
Pierwsza część prac została wykonana bez zmiany `main`. Następna, wyraźna prośba
użytkownika obejmuje publikację całości na GitHub i merge do `main` po walidacji.

## Diagnoza

Biały ekran na fizycznym iPhonie nie został odtworzony. Brakuje modelu telefonu,
wersji iOS i treści błędu. Przeciążenie pamięci jest hipotezą, nie potwierdzoną
przyczyną. Desktopowy WebKit nie odtwarza ograniczeń pamięci procesu Safari na iOS.

W kodzie znaleziono konkretne źródła ryzyka:

- Safari bez `navigator.deviceMemory` dostawało profil standardowy zamiast oszczędnego.
- Równoczesne ładowanie 16 modeli postaci i osobny strumień 91 unikalnych modeli tłumu.
- Oryginalny świat: 197 383 572 B GLB, 145 obrazów, szacunkowo 711,8 MiB tekstur
  RGBA wraz z mipmapami. Wielkość JPEG/PNG na dysku nie określa ich kosztu po rozpakowaniu.
- Pełne rozgrzewanie sceny i tekstur przed wejściem, cienie oraz inicjalizacja wideo
  podczas ciężkiego ładowania.
- Brak czytelnej obsługi utraty kontekstu WebGL; ponowne alokacje buforów przy
  zdarzeniach resize, nawet gdy rozmiar i DPR się nie zmieniały.

Szacunek tekstur opiera się na wymiarach obrazów (`width × height × 4 × 1,33`),
nie jest pomiarem całkowitej pamięci GPU. Zasady wyjaśnia
[dokumentacja Three.js](https://threejs.org/manual/pages/textures.html).

## Wdrożone zmiany

- Osobny `authored-festival-mobile.glb`: tekstury maksymalnie 256 px, zachowane
  proporcje i przezroczystość. 111 257 416 B, szacunkowo 22,8 MiB tekstur z mipmapami.
  Oryginał desktopowy pozostaje bez zmian.
- Geometria, materiały, animacje, węzły i metadane świata są identyczne: porównano
  17 538 nieobrazowych bufferViews bajt po bajcie. Nie zmieniono mapy ani kolizji.
- Ładowanie postaci i rekwizytów w ograniczonych partiach na mobile; zmniejszanie
  tekstur przed uploadem do renderera także dla postaci i podglądu w menu.
- Tłum mobilny współdzieli już załadowane modele: 16 obozowiczów + 24 statystów,
  po 8 na dużej scenie i obu pasażach. Nie pobiera 91 dodatkowych modeli tłumu.
  Gracze sieciowi nie są zastępowani botami; desktop zachowuje pełny tłum.
- Auto bez informacji o RAM wybiera profil oszczędny. Standardowy i oszczędny:
  DPR maksymalnie 1, brak cieni. Dalsze postacie przestają być animowane/rysowane;
  symulacja i rozgrywka pozostają aktywne.
- Istniejący mechanizm widoczności: drobne obiekty około 20 m w oszczędnym i 30 m
  w standardowym; animacje około 15/25 m, namioty 30/45 m, punkty orientacyjne 90/150 m.
  Granice uwzględniają rozmiar obiektów i histerezę. To nie jest globalne kasowanie
  wszystkiego poza okręgiem; obiekty interaktywne i dynamiczne mają wyjątki.
- Mniejszy bloom/telebimy i mgła maskująca ograniczony zasięg. Wideo uruchamia się
  dopiero po ładowaniu; bez pełnego rozgrzewania GPU na telefonie.
- Świat mobilny korzysta z cache HTTP zamiast klonowania wielkiej odpowiedzi dla
  CacheStorage. Inne assety zachowują istniejący trwały cache.
- Powtórny resize bez zmiany rozmiaru/DPR nie odtwarza buforów. Utrata WebGL zatrzymuje
  istniejącą pętlę i pokazuje komunikat, zamiast pozostawiać pusty ekran.
- Podczas audytu WebKit wykryto `ResizeObserver loop completed with undelivered
notifications` przy zmianach układu menu. Zmiany rozmiaru podglądu są teraz
  scalane w istniejącej pętli podglądu, zamiast zapisywać rozmiar canvasa wewnątrz
  obserwatora. Powtórny test WebKit zakończył się bez tego błędu.
- Usunięto konflikt `!important`, przez który mikrofon zasłaniał mobilny skok/rzut.

Wszystko używa istniejącego renderera, kontrolerów, loadera/cache i pojedynczej
pętli gry. Profile jakości nie przełączają wariantu tekstur w czasie rozgrywki:
wszystkie telefony korzystają z mobilnego świata.

## Testy i audyt UI

- `npm run ci:code`: 1382 testy jednostkowe (z testem wskaźnika głośnika), format,
  lint, typy i kontrola kodowania OK.
- Test narzędzi sprawdzający wyjątek cache mobilnego GLB: OK.
- `npm run ci:assets`: walidacja assetów i 16 rigów bez blockerów/błędów.
- `npm run build`: OK; pozostaje ostrzeżenie Vite o dużym bundlu JS.
- `python scripts/check-mobile-world.py`: identyczność geometrii/metadanych OK.
- Playwright, desktopowy WebKit i Chromium z viewportem/UA/dotykiem iPhone 13:
  ładowanie do gry bez błędów JavaScript, 40 NPC, DPR 1, cienie wyłączone,
  brak pobierania osobnej kolekcji modeli tłumu.
- Rozmiary 360×800, 390×844, 412×915, 768×1024, 844×390, 1024×768:
  start, ładowanie, pauza, ekwipunek, dialog, inspekcja, ostrzeżenie efektu,
  pomoc, mapa, lobby flanek, eko i gitara bez wykrytego poziomego przepełnienia
  lub panelu wychodzącego poza viewport.
- Dodatkowo oba silniki: lobby flanek z listami i wyborem biegacza, eko z 20 wierszami
  wyników i pełny wybór utworów gitary. Dotykowe zamknięcie lobby sprawdzone.
- Skok/rzut, interakcja i menu: środki przycisków osiągalne przez hit-test na wszystkich
  sześciu rozmiarach w obu silnikach; mikrofon już nie blokuje skoku.
- Syntetyczny `webglcontextlost`: stan `error` i komunikat WebGL; dwa identyczne
  resize: zero wywołań `renderer.setSize`. Nie jest to test faktycznego wyczerpania RAM.

Surowe JSON i zrzuty: `reports/iphone-audit/`, katalog ignorowany przez Git.
Skrypt `scripts/verify-iphone.py` wymaga Python Playwright z przeglądarkami,
serwera gry na 3102 i Vite na 5182. Parametr `chromium` lub `webkit` wybiera silnik.

## Wydajność: nadal nie jest zakończona

Nie deklarujemy płynnych 30/60 FPS. W pomiarze po zmianach nadal rysowano około
1,8–2,2 mln trójkątów. Chromium D3D11 na tym komputerze osiągnął około 198 ms/klatkę
w przebiegu bez równoległego CI. To nie jest wynik fizycznego iPhone'a ani kontrolowane
porównanie przed/po. World GLB nadal zawiera całą geometrię (~107 MB danych innych
niż obrazy); ukrywanie obiektów oszczędza rysowanie, nie usuwa ich z pamięci.

Najbardziej sensowne kolejne etapy:

1. Osobne LOD-y mobilne dla postaci: mniej trójkątów z zachowaniem wag, twarzy,
   włosów i ubrań. Automatyczna ślepa redukcja nie jest bezpieczna po wcześniejszych
   problemach rigów. Zweryfikować idle/chód/bieg/rzut/siadanie na kilku sylwetkach.
2. Zredukować geometrię i scalić materiały powtarzalnych rekwizytów; instancing tam,
   gdzie assety są identyczne i nie mają indywidualnych interakcji.
3. Podzielić eksport świata na sektory ładowane/zwalniane w istniejącym loaderze,
   z lekką warstwą mapy/kolizji niezależną od widocznych modeli. To rozwiązuje koszt
   całego GLB w RAM, czego sam promień 15/30 m nie rozwiązuje.
4. Rozważyć KTX2/Basis dla tekstur i Meshopt dla transferu geometrii; zmierzyć koszt
   dekodowania na docelowym telefonie, nie tylko rozmiar pliku.

Status: `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN` dla fizycznego iPhone'a,
wszystkich minigier, klawiatury ekranowej, safe-area/notcha, audio/autoplay,
dłuższej rozgrywki i ponownego wejścia po błędzie. Audyt paneli nie oznacza,
że każda kombinacja zawartości i każdy przycisk został przetestowany.

## Aktualizacja modelu Blender

Po zmianie/eksporcie oryginalnego świata uruchomić:

```powershell
python scripts/build-mobile-world.py
python scripts/check-mobile-world.py
npm run ci:code
npm run ci:assets
npm run build
```

Generator wymaga Pillow. Nie uruchamia Blendera i nie zmienia źródłowego GLB.
Nowy wariant jest objęty istniejącą regułą Git LFS `*.glb`.

## Głośnik i dostęp do stołu — kolejna prośba użytkownika

- Każde wejście zaczyna z wyłączonym głośnikiem, także przy zapisanym wcześniej
  `speakerEnabled=true`. Start wymaga interakcji gracza; domyślne ustawienie jest wyłączone.
- Nad głośnikiem znajduje się neonowozielony znak szerokości 20 cm: minus wyłączony,
  plus włączony. Dwa małe meshe, bez dodatkowego światła, tekstury ani pętli renderowania.
  Znak obraca się ku graczowi w istniejącej aktualizacji NPC.
- Usunięto jednostronne ograniczenie interakcji z przedmiotami na stole. Nie ma powodu,
  żeby zwykły przedmiot zachowywał się jak drzwi dostępne tylko od frontu. Zachowano
  kolizję blatu i normalny limit zasięgu/raycast — nie można przechodzić przez stół.
- Test WebKit: wszystkie 8 pozycji można namierzyć prawdziwym raycastem z miejsc
  dopuszczonych przez `world.canMove` (promień postaci 0,34 m), w odległości poziomej
  0,65–1 m od środka hitboxa przedmiotu. Nie było potrzeby dalszego zmniejszania kolizji.
- W emulacji iPhone 13 dotyk przycisku interakcji przełączył głośnik
  `wyłączony (-) → włączony (+) → wyłączony (-)`. Wcześniej zapisano stan włączony,
  aby sprawdzić, że nie powoduje autostartu. Wejście do gry, panele, hit-testy przycisków
  i obsługa utraty WebGL również przeszły bez błędów JavaScript.

## Retest na telefonie

Przed testem sprawdzić, że serwer udostępnia nowy mobilny GLB (nie wskaźnik LFS),
odświeżyć stronę i wybrać jakość automatyczną/oszczędną. Sprawdzić wejście, obrót,
spacer obóz → pasaże → scena, mapę, pomoc, ekwipunek, flanki, eko, gitarę i koło.
W razie błędu zebrać model iPhone'a, iOS, zrzut dokładnego komunikatu i log konsoli
Safari z podłączonego urządzenia. Dopiero wtedy można potwierdzić przyczynę białego ekranu.
