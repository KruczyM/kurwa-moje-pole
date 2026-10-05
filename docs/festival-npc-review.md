# Kontrola integracji tłumu — 24.09.2026

Gałąź `feat/festival-next`, folder `.ai/worktrees/festival-2026-tent-upgrades`.

## Przyczyny niewidocznych NPC

W momencie przeglądu katalog zawierał 91 wpisów `festivalNpcs` i wszystkie odpowiadające pliki (435 156 848 bajtów), ale manifest nie eksportował ich adresów, loader nie wczytywał modeli, a menedżer tworzył tylko wpisy `characters`, korzystając z ośmiu punktów startowych. Rozszerzenie `characters` do 16 wpisów powodowało wyjątek przy indeksie 8. Serwer na porcie 5173 działał dodatkowo z głównego katalogu `E:\kodowanie\gra`, zawierającego inną gałąź.

## Poprawka

91 modeli tłumu ma osobny eksport w istniejącym manifeście. Istniejący loader doczytuje je po uruchomieniu gry, najwyżej dwa jednocześnie, z cache, obsługą pojedynczych błędów i przerwaniem dalszego ładowania po zamknięciu gry. Model, który doczytał się po zamknięciu, jest zwalniany. Tłum jest dodawany do istniejącego menedżera; nie powstaje nowa pętla animacji.

Starty są losowane na przechodnich punktach, z odstępem co najmniej 1,5 m, jeśli pozwala na to dostępne miejsce. Losowe ziarno nowej sesji zmienia układ, a testy mogą podać stałe ziarno. Około 80% dodatkowych botów zaczyna na pasażu i wybiera na przemian cele w jego przeciwległych połowach. Pozostałe zaczynają w obozie i korzystają z dotychczasowego zachowania. Nadal działają A*, omijanie przeszkód/postaci, hamowanie, postoje i odzyskiwanie po utknięciu. Głośnik ma własne stałe położenie.

Statyczne modele są centrowane względem punktu startowego i ustawiane stopami na ziemi. Po korekcie użytkownika mają wysokość **2,45 m, taką samą jak główne postacie**. Cienie rzucane przez dodatkowy tłum są wyłączone, aby ograniczyć koszt 91 modeli. Zbiór ma około 4,07 mln trójkątów; ładowanie etapami nie zastępuje optymalizacji geometrii i tekstur, pomiar FPS pozostaje do wykonania.

Osiem niegotowych dodatkowych postaci grywalnych zachowano w `stagedCharacters`, poza aktywnym wyborem gracza. Ich plików nie usuwano. Nie są to wpisy 91-osobowego tłumu.

## Animacje i dalszy etap

Pierwotny audyt 91 GLB wykazał **0 modeli ze szkieletem i 0 z animacjami**. W tym stanie ruch tłumu był przesuwaniem statycznych modeli (`animationStatus = static-needs-rig`). Kolejny etap dodaje lokalne auto-rigowanie, wagi i klipy przez `scripts/rig_all_npcs.py` — instrukcja i ograniczenia w `docs/animate-all-npcs.md`. Loader automatycznie używa animacji z podmienionych GLB, bez zmiany adresów modeli.

Do chodzenia, siadania, leżenia i wstawania potrzebny jest szkielet ze skinningiem każdego modelu oraz dopasowane klipy. Po ich dostarczeniu należy dodać przejścia: chodzenie → siadanie/kładzenie → spoczynek → wstawanie → chodzenie. Miejsce odpoczynku musi być wolne, poza głównym ruchem; nawigację trzeba zatrzymywać podczas przejść. Sam import klipu Mixamo nie deformuje statycznego modelu.

## Weryfikacja

Testy regresyjne obejmują wszystkie 91 plików, limit dwóch równoległych żądań, awarię pojedynczego modelu, anulowanie, dodanie ponad ośmiu botów, wycentrowanie figur, brak duplikatów, losowe starty, odstępy, zmianę kierunku na pasażu i odtwarzalne ziarno.

Pełny zestaw po integracji: 544 zaliczone, 2 niezaliczone testy dotyczące zmienionego poza tą poprawką modelu `characters/klatwa/npc-animations.glb` (brak oczekiwanych kości/animacji). Build, kontrola typów oraz lint zmienionego kodu zaliczone. Nie cofano równoległych zmian binarnych Klątwy.

Serwer właściwego worktree uruchomiono na `http://127.0.0.1:5174/`; sprawdzono HTTP 200 dla pierwszego i ostatniego modelu. Gra informuje o doczytywaniu tłumu i końcowej liczbie modeli. `5173` pozostawiono jako istniejącą, inną instancję użytkownika.

**VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN** — Browser nie udostępniał żadnej przeglądarki (`iab` niedostępne). Testy parsera pomijają dekodowanie obrazów; nie zastępują kontroli materiałów, FPS i wyglądu w przeglądarce.
