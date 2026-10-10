# Cofnięcie pakietu mobilnego — 2026-10-10

Gałąź: `fix/revert-mobile-visuals`, punkt wyjścia `6c59cda`.

Na prośbę użytkownika cofnięto wizualne i assetowe optymalizacje dodane w `4d758dd`:
osobny świat mobilny i redukcję tekstur do 256 px, sekwencyjne ładowanie, zastąpienie
91 modeli tłumu 24 kopiami postaci, ciaśniejsze zasięgi widoczności, mocniejszą mgłę,
obniżony DPR, wyłączenie cieni/antialiasingu, pomijanie rozgrzewania GPU i odroczony start wideo.
Te ustawienia i loader przywrócono do wersji `2ee6f7b`.

Nie cofnięto starszych responsywnych widoków i sterowania dotykowego z `a70d095`.
Zachowano brak autostartu głośnika, neonowe −/+, dostęp do stołu z każdej strony,
naprawę nakładania mikrofonu na skok oraz obsługę utraty WebGL i bezpieczny resize
podglądu (błędy Safari nie są elementem wyglądu gry).

Usunięto nieużywany mobilny GLB (~111 MB w tym worktree) i dedykowane mu skrypty
oraz testy. Oryginalny świat i modele są nietknięte; usunięty wariant można odzyskać
z commita `4d758dd`. Obiekty Git LFS i kopie innych worktree nie zostały usunięte.
Raport `iphone-performance-audit.md` oznaczono jako historyczny.

Rollback przywraca wygląd, ale nie obiecuje lepszej wydajności: wraca również
większy koszt pamięci tekstur i ładowania. Nie publikowano zmian na `main`/GitHub.
Status fizycznego telefonu i rozgrywki: `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`.

Walidacja cofnięcia: `npm run ci:code` — format, lint, typy, kodowanie, 6 testów
narzędziowych i 1379 jednostkowych OK. `npm run build` — OK (pozostaje ostrzeżenie
Vite o dużym bundlu JS). Nie deklarujemy przetestowania runtime po rollbacku.

## Najlepszy następny kierunek

Najpierw pomiar na docelowym iPhonie: osobno czas klatki CPU/GPU, liczba trójkątów,
draw calls, koszt animacji, dodatkowe rendery telebimów, postprocessing i pamięć.
Emulacja dotyku/viewportu nie emuluje GPU, RAM ani nagrzewania telefonu.

1. Sektory świata: osobne GLB i współdzielony cache z licznikami referencji,
   wczytywanie sąsiednich sektorów z wyprzedzeniem, zwalnianie nieużywanych modeli.
   Mapa i kolizje pozostają niezależne od widocznej geometrii. Samo `visible=false`
   zmniejsza rysowanie, lecz nie usuwa danych z pamięci.
2. LOD geometrii: szczegółowy model blisko, uproszczony dalej. Szczególnie NPC,
   namioty i duże rekwizyty. Kontrola wag, twarzy i ubrań obowiązkowa; bez ślepego
   decymowania wszystkich postaci. [Three.js LOD](https://threejs.org/docs/pages/LOD.html).
3. Instancing powtarzalnych statycznych obiektów: wspólne modele/materiały dla
   identycznych namiotów, krzeseł, barierek. Nie scalać całego świata w jeden mesh,
   ponieważ utrudni to sektorowanie i selektywne pomijanie. Zwykły InstancedMesh
   nie jest gotowym rozwiązaniem dla osobno animowanych szkieletowych NPC.
   [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html).
4. KTX2/Basis: kompresja tekstur obsługiwana przez GPU zamiast globalnego
   zmniejszania obrazów do 256 px. Można zachować większe wymiary grafik, ale trzeba
   sprawdzić artefakty i koszt transkodowania na urządzeniu. Kompresja geometrii
   Meshopt/Draco służy głównie transferowi; sama nie obniża liczby trójkątów.
   [KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html),
   [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html).
5. Budżet renderowania: dynamiczna rozdzielczość, limit 30 FPS, rzadsze aktualizacje
   odległych animacji, ograniczenie postprocessingu/cieni i renderów telebimów.
   Limit FPS stabilizuje zużycie/temperaturę, ale nie naprawi klatki dłuższej niż 33 ms.

## Mgła i 15 metrów

Sama mgła zmienia kolor renderowanych pikseli, nie wyłącza obiektów:
[dokumentacja Three.js](https://threejs.org/manual/pages/fog.html).
Eksperyment 15 m ma sens tylko wraz z cullingiem i zatrzymywaniem kosztownych
aktualizacji wizualnych. Całkowite odcięcie w 15 m ukryje scenę i punkty orientacyjne.
Lepszy wariant do porównania na urządzeniu: drobnica 15–20 m, postacie i namioty
25–35 m, odległa scena jako bardzo lekki LOD, płynne wygaszanie/histereza.
To propozycja testowa, nie ustawienia wdrożone podczas rollbacku.
