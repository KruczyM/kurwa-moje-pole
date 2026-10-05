# Parcele i stała łąka — 24.09.2026

Gałąź: `feat/festival-next`.

- Dwa Red Bulle przy asfaltowym pasażu: pierwszy w 1/3 długości licząc od zachodniego końca (X = -46,67), drugi przy wschodnim końcu (X = 133). Stoiska przesunięto, zachowując odstępy od Lidla. Młyn cofnięto o 7 m, żeby jego obrys nie kolidował z drugim Red Bullem.
- Parcele pozostały równe głównemu obozowi: 36 × 36 m. W każdym dodatkowym obozie 16 namiotów stoi wokół wspólnego zielonego dziedzińca, wejściami do środka. Usunięto siatkę wewnętrznych ścieżek dzielącą parcelę na pojedyncze stanowiska. Pozostały przejścia wokół parceli. Cztery prototypy należą do tego samego układu; łącznie nadal 207 namiotów.
- Dalsza warstwa trawy ma niezmienną pozycję w świecie: 80% dotychczasowego budżetu źdźbeł rozłożono równomiernie pomiędzy obozami, resztę po świecie. Źdźbła poszerzono, żeby mniej znikały po oddaleniu. Maska nadal wyklucza namioty, drogę i obiekty.
- Podłoże zachowuje fotograficzny detal, normalne, roughness oraz oświetlenie PBR, ale otrzymuje zieloną korekcję koloru. Dzięki temu widok odległej łąki nie zależy od widoczności pojedynczych trójkątów trawy. Bliska, ruchoma warstwa pozostaje dodatkowym detalem. Nie dodano kolejnej pętli renderowania ani zwiększenia liczby źdźbeł.

Weryfikacja: 36 testów w siedmiu plikach dotyczących świata zaliczone, w tym dojścia do wszystkich namiotów, kolizje pasażu i odtwarzalność stałych pozycji trawy po zmianie jakości. Build zaliczony, pozostaje ostrzeżenie o rozmiarze bundla.

Pełny zestaw: 509 testów zaliczonych, 47 błędów w NPC i interakcjach. W zastanym, równolegle modyfikowanym katalogu postaci brakuje części `npc-animations.glb`, nowe riggi nie spełniają części testów, a liczba wpisów przekracza tablicę punktów startowych `NpcManager`. Tych zmian nie cofano ani nie włączano do tej poprawki.

**VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN** — brak odbioru shaderów w grze i pomiaru FPS. Sprawdzić trawę przy obozie, z 30–100 m i nocą oraz czytelność grup namiotów. Sam build nie potwierdza wyglądu.
