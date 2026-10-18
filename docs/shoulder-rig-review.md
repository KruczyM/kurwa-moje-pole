# Barki i deformacje automatycznych rigów — 27.09.2026

## Najnowsza iteracja: położenie stawu i obojczyk

Po kolejnym zgłoszeniu poprzedniej korekty NIE uznano za zakończoną. Zbadano krawędzie siatki Korby w Idle (0,4 s): maksymalne rozciągnięcie w badanym obszarze wynosiło 3,7593. Pozostawione mieszane wpływy Head/Shoulder/Spine2 przy obojczyku oraz niski staw powodowały rozciągnięcie powierzchni barku.

Nowy profil usuwa resztkowe wagi przy obojczyku i podnosi staw ramienia o 4,5% wysokości modelu. Obszar wyboru wag pozostaje oparty o niezmienioną wysokość szyi, aby podniesienie stawu nie przesuwało maski na twarz. Zachowano neutralną siatkę, UV, obrazy i rotacje klipów; zaktualizowano macierze wiązania i translacje. Próby samego zwężenia przejścia lub podniesienia stawu z przesuwającą się maską zostały odrzucone.

Obejrzano próbę na 57 modelach (`reports/shoulder-pivot-review/grid.png`). Zastosowano do 37: siedmiu głównych i 30 NPC; jawny wybór to `raisedShoulderAssets` w katalogu napraw. Pozostałe 20 zachowuje wcześniejszy profil, pozostałe 41 NPC nadal wymagają osobnego opracowania. W szczególności nie należy uznawać włosów/kapeluszy wszystkich NPC za poprawione.

Po zmianie ten sam pomiar Korby wynosi 2,3192 (nie jest to gwarancja braku deformacji w innych klatkach). Dodano test tej granicy oraz test wysokości stawu wszystkich modeli. 118 wcześniejszych testów przeszło; 58 testów szkieletu przeszło ponownie po dodaniu nowej regresji. Weryfikator binarny potwierdził zachowanie geometrii i tekstur. Rendery Korby: `reports/korba-raised-pivot-textured`, oglądane Idle i Run. Pełny odbiór nadal: VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN. Nie opublikowano zmian.

## Kolejna korekta po zgłoszeniu użytkownika

Poprzednia wersja nadal deformowała górną część barków Korby. Dla siedmiu postaci głównych z listy DRAFT_ARM_MODELS poszerzono przejście wag w barku i pozostawiono wewnętrzny obszar obojczyka przy tułowiu. Rozszerzono pionowy obszar korekty, żeby górna powierzchnia barku nie zachowywała starych, niezgodnych wag. Profil jest jawnie opcjonalny; NPC nie otrzymały tej kolejnej korekty bez osobnego przeglądu.

Zainstalowano siedem GLB z zachowaniem niezmiennych kopii źródłowych. Dodano filtr `--ids=` do narzędzia naprawy. Porównania: `reports/korba-current-audit`, `reports/korba-candidate-audit`, `reports/shoulder-candidate-seven`, `reports/korba-fixed-run`. Rendery pokazują wygładzenie barków w Idle oraz klatce Run; nie zastępują odbioru całej animacji w grze. Testy dwóch modułów: 115/115, następnie 59/59 testów wag z nowym testem obojczyka. Build przeszedł. Status pozostaje VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN.

## Wynik tej iteracji

Zapisano korektę **57 modeli**: Korba, Chlebak, Dziąsło, Hemoroid, Jęczmień, Kobra, Szerszeń oraz 50 NPC. Dokładna lista plików jest w `src/game/animation/shoulderRepairCatalog.ts`. Gruczoł i pozostałe oryginalne rigi Mixamo nie są zmieniane tym etapem.

Poprzednia korekta samych wag nie rozwiązywała problemu. Automatyczny szkielet wyznaczał bark z rozpiętości całych ramion, co zostawiało staw za daleko od tułowia. Ponadto twarda granica korekty wag tworzyła skoki wpływów na sąsiednich wierzchołkach. Nowy etap:

- przesuwa stawy barkowe do 75% dotychczasowego odsunięcia od środka i łokcie do 90%; pozostawia pozycje dłoni w pozie wiązania;
- aktualizuje odwrotne macierze wiązania i lokalne translacje stawów we wszystkich klipach; zachowuje rotacje animacji;
- stosuje płynne przejście wag przy granicach obszaru korekty;
- nie zmienia pozycji wierzchołków, UV ani tekstur; zachowuje neutralny kształt modelu;
- działa offline, bez dodatkowego kosztu w klatce gry i bez zmiany istniejącego loadera/retargetera.

Potwierdzono SHA-256, że serwer 5173 podawał korygowany plik Korby — wcześniejszy problem nie był cache'em. Przeglądarka aplikacji pozostaje niedostępna.

## Odtwarzanie i kopie

```powershell
npx tsx scripts/repair-character-weights.ts --arms --install
node scripts/verify-shoulder-rig.mjs
```

Tryb bez `--install` zapisuje tylko kandydatów w raporcie. Kopie i wyniki: `reports/shoulder-rig-repair-20260926/{originals,corrected}`. Nazwa folderu pozostaje historyczna. Dla Korby/Chlebaka kopia pochodzi z wersji sprzed pierwszej, niewystarczającej korekty barków. Ponowne uruchomienie zawsze zaczyna od kopii, nie zwęża szkieletu drugi raz. Nie wywoływać `refitDraftShoulders` ponownie na już poprawionym GLB ani podczas runtime. Po ponownym wygenerowaniu modeli trzeba świadomie odnowić bazę kopii; nie usuwać obecnych kopii przed odbiorem.

Weryfikator tej iteracji dopuszcza wyłącznie wagi, macierze wiązania oraz translacje stawów ramion. Stary `verify-weight-repair.mjs` sprawdzał tylko wagi i nie jest właściwy dla zmienionego szkieletu.

## Przegląd i wyłączenia

Porównano wszystkie 91 NPC przed i po próbie korekty: `reports/crowd-rig-review/0-before` do `5-after`, pliki `grid.png`. To diagnostyczne rendery siatek odkształcanych przez rzeczywisty Three.js, a nie pełny odbiór gry. Korbę dodatkowo obejrzano z teksturami w Idle/Walk/Run: `reports/korba-refit-textured` i `reports/korba-refit-motion`.

Nie zastosowano korekty do pozostałych 41 NPC. Nie oznacza to, że wszystkie są poprawne. Część ma nietypową pozę źródłową lub proporcje; część wymaga ręcznego oddzielenia wag włosów, rekwizytów i ubrań. Szczególnie do dalszej naprawy: 002, 007, 015, 018, 023, 024, 027, 033, 034, 042, 046, 047, 048, 052, 057, 064, 071, 075, 078. Próbna korekta poszerzała lub ujawniała tam deformacje dodatków, dlatego wynik nie został zainstalowany. Dino i postaci w innych pozach bazowych nie powinny otrzymywać tej korekty tylko dlatego, że mają 22 kości.

## Weryfikacja

- 124 testy dedykowane przeszły: zgodność neutralnej geometrii ze źródłem, nowe położenie stawów, zgodność translacji Idle/Walk/Run, lokalne wpływy ramion, normalizacja wag i zachowanie brody.
- Weryfikator binarny przeszedł dla wszystkich 57 plików; geometria, obrazy i rotacje klipów zachowane.
- Build przeszedł; pozostaje ostrzeżenie Vite o rozmiarze bundla.
- Lint zmienionych plików przeszedł. Pełny przebieg z dwoma workerami i limitem 20 s: 821 testów przeszło, ale trzy niezwiązane puste suity blokują wynik całości: `festivalProps.test.ts`, `StageConcertAudio.test.ts`, `stageConcertEffects.test.ts`. Nie zmieniano ich w tym zadaniu.

**VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN** — odebrać barki w menu, podczas chodzenia/biegu i gestów. Nie traktować zielonych testów jako akceptacji wyglądu wszystkich postaci. Zmiany lokalnie na `feat/festival-next`, bez push/merge.
