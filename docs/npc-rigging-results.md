# Szkielety i wagi NPC — 25.09.2026

Gałąź: `feat/festival-next`, worktree `.ai/worktrees/festival-2026-tent-upgrades`.

## Zakres

Lokalny pipeline `scripts/rig_all_npcs.py` obejmuje postacie główne, przygotowywane postacie i 91 modeli tłumu. Zachowuje istniejące szkielety. Statycznym modelom dopasowuje 22 kości ciała, przypisuje maksymalnie cztery znormalizowane wpływy na wierzchołek i dołącza Idle, Walk oraz Run przez istniejący builder animacji. Nie używa płatnych API ani zewnętrznych agentów.

Instalacja odbywa się pod dotychczasowymi adresami katalogu gry. Bazowe riggi do kolejnych animacji znajdują się w `source-assets/rigged-festival/<id>/t-pose.glb`. Instrukcja: [animate-all-npcs.md](animate-all-npcs.md).

Raport wykonania i kopie oryginałów: `reports/npc-rig-batch/20260925T020716182272Z/`. Każdy katalog modelu zawiera `original.glb`, wynik, bazowy rig oraz log Blendera. Kopie są lokalne, ignorowane przez Git; ich usunięcie utrudni cofnięcie zmian.

## Poprawki i ograniczenia

- Retargeter uwzględnia różne osie lokalne armatur źródłowej i docelowej. Bez tego ręce w nowych rigach były skierowane do przodu zamiast w dół.
- Skala ruchu kości głównej jest wyznaczana z pozycji stawów, a nie z długości końcówek kości odtwarzanych przez importer glTF.
- Gdy Bone Heat nie potrafi przypisać wag siatce Hunyuan, nieprzypisane wierzchołki otrzymują wygładzone wagi na podstawie odległości od segmentów kości. Raport podaje ich liczbę dla każdego modelu.
- `dino` zawierał cztery widoki sklejone w jedną siatkę, w tym połączone dłonie dwóch figur. Wyodrębniono przednią postać i odtworzono drugą połowę symetrycznego kostiumu. Jest to naprawa robocza, nie wierna rekonstrukcja utraconych detali.
- Wagi są automatycznymi wersjami roboczymi. Szerokie rękawy, włosy, peleryny i zespolone akcesoria mogą wymagać ręcznej korekty. Brak osobnej animacji palców i twarzy w nowych rigach.
- Siadanie, leżenie i wstawanie nadal wymagają dodatkowych klipów oraz stanów zachowania. Nie dodano ich zastępczych animacji.

## Kontrola

### Dalsza kontrola ciągłości animacji

Test `NpcLocomotionAssets.test.ts` rozszerzono z 8 na wszystkie 107 modeli. Sprawdza skalowanie do 2,45 m, ruch bioder przez kilka cykli oraz pozycje wszystkich kości tuż przed i po granicy pętli Walk/Run. Ten dokładniejszy test ujawnił skoki kończyn w 101 modelach, mimo ciągłego położenia bioder.

`locomotionLoop.ts` domyka różniące się końce klipów w krótkim oknie (maks. 0,12 s, nie więcej niż 20% cyklu), interpolując obroty sferycznie. Działa po usunięciu przesunięcia kości głównej, podczas przygotowania animatora, bez dodatkowego kosztu przeliczania klipów co klatkę. Nie nadpisuje GLB, klipów w cache ani animacji jednorazowych. Po poprawce wszystkie 107 modeli przeszły test ciągłości kończyn.

NPC startują z różnymi, deterministycznie losowanymi fazami animacji; przejścia zachowują fazę. Domyślne zachowanie innych użytkowników NpcAnimator pozostaje bez zmian. Osobne testy chronią normalizację fazy, start jednorazowych animacji od początku, niezmienność źródeł i bardzo krótkie klipy.

Weryfikacja po tych poprawkach: 182 testy NPC/pipeline'u zaliczone; pełny zestaw — 656 testów zaliczonych, jedna niezaliczona kolekcja (nadal pusty `FootstepAudio.test.ts`). Build, kontrola typów, lint zmienionych plików i formatowanie zaliczone. Nadal wymagany odbiór wizualny w grze.

Wynik partii: **99 nowych rigów zainstalowanych** (91 modeli tłumu i 8 przygotowywanych postaci), **8 istniejących rigów zachowanych**, 0 błędów. To 107 modeli ze szkieletem i wagami; przygotowywane postacie nadal pozostają poza aktywnym wyborem gracza.

Zaliczone: 6 testów walidatora wag, 5 testów buildera animacji, regresja osi/skalowania w Blenderze oraz 3 testy pipeline'u tłumu. Test loadera obejmuje wszystkie 91 rzeczywistych GLB, trzy klipy lokomocji i niezerowe, skończone deformacje próbek siatki. Pozostały zestaw gry: 545 zaliczonych testów, ale jedna niezaliczona kolekcja testów — niezwiązany z tą zmianą `src/game/audio/FootstepAudio.test.ts` był pusty (0 bajtów). Nie modyfikowano go. Build zaliczony.

Walidator sprawdza każdy wierzchołek wyeksportowanego modelu: skończone wagi, sumę równą 1, poprawne indeksy kości i brak statycznych prymitywów w rigowanej siatce. Osobno sprawdzane są trzy klipy lokomocji. Test runtime parsuje modele przez właściwy GLTFLoader i próbkuje deformację siatek przez NpcAnimator.

Rendery reprezentatywnych modeli i animacji: `reports/npc-rig-probes/poses/`. Obejrzano m.in. postać z papugą, postać z parasolem, kostium tygrysa i naprawione dino. Testy matematyczne nie zastępują oceny jakości wag na każdej sylwetce.

**VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN** — umiejętność Browser nie udostępniła przeglądarki. Rendery offline nie potwierdzają FPS, płynności całego tłumu ani oświetlenia w grze. Brak push, PR i merge.
