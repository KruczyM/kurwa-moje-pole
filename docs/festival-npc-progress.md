# NPC — audyt modeli i pierwsza poprawka ruchu (2026-09-22)

Worktree: `E:/kodowanie/gra/.ai/worktrees/festival-2026-tent-upgrades`.
Na prośbę użytkownika domknięto Red Bulla/pasaż i wstrzymano kolejne modele otoczenia.

## Modele źródłowe — nie zostały jeszcze dodane do runtime

Faktyczny katalog: `E:/kodowanie/gra/Hunyuan3D-2GP/output/characters_mv`.
Podana w rozmowie ścieżka `output/characters/_mv` nie istnieje.

- 91 numerowanych katalogów, 90 poprawnych `textured.glb`.
- **Wszystkie 90 modeli: brak szkieletu, wag skóry i klipów animacji.** Każdy ma jeden mesh, jedną osadzoną teksturę i 40 000 trójkątów.
- Łącznie 417 335 444 B i 3 600 000 trójkątów przed dodaniem rigów/LOD. Nie zmierzono zużycia GPU/FPS.
- `091_punk_rocker`: brak zarówno `textured.glb`, jak i `shape.glb`.
- Oryginałów nie zmieniono, nie kopiowano 417 MB statycznych figur do produkcyjnego katalogu ani nie udawano chodu przesuwaniem sztywnego modelu.

Powtarzalny audyt (bez sieci, bez płatnych API):

```powershell
node scripts/audit-npc-source.mjs E:/kodowanie/gra/Hunyuan3D-2GP/output/characters_mv
node --test scripts/audit-npc-source.test.mjs
```

Raport `reports/npc-source-audit.json` zawiera wszystkie identyfikatory, pliki, SHA-256, budżety, kości/skiny i klipy. Status `RIGGING_REQUIRED` nie oznacza gotowości do gry. Nawet model z kośćmi i klipami wymaga oceny deformacji.

## Wdrożone poprawki istniejących ośmiu NPC

Wykorzystano istniejący `NpcManager`, nawigację, steering, miksery, crossfade i pojedynczą pętlę gry:

1. Tempo oraz wybór animacji zależą od **faktycznej poziomej prędkości**, a nie pozostałej zadanej prędkości po zatrzymaniu ruchu.
2. Usunięto sinusoidalne unoszenie całego korzenia podczas postoju/oczekiwania. Postać pozostaje na terenie; ruch oddechu powinien pochodzić z klipu.
3. Osiągnięcie celu porównuje X/Z. Wcześniej różnica wysokości terenu i płaskiej trasy mogła uniemożliwiać zakończenie dojścia.
4. Przy ostrych skrętach postać stopniowo zwalnia, zachowując ograniczenie szybkości obrotu i przyspieszenia.
5. Ruch sprawdza przechodniość odcinka, nie wyłącznie końcowej pozycji. Pozioma prędkość steeringu nie zawiera wysokości terenu.
6. Granice używają min/max obu osi, również dla niesymetrycznego obszaru. Nieprawidłowe lub niedodatnie delta time nie zmienia stanu.

Pięć nowych testów regresyjnych najpierw odtworzyło błędy (5 FAIL), a po poprawce przechodzi. Pełne `npm test`: **381 testów jednostkowych**, 23 orkiestratora, walidacja 180 assetów i 8 istniejących rigów. Osobno 4 testy audytora. Zakresowy ESLint, build i `git diff --check` zaliczone. Pozostaje ostrzeżenie bundla >500 kB.

Przechodzi dotychczasowa deterministyczna symulacja 30 minut dla 8 NPC: brak trwałego utknięcia/lawiny decyzji; każdy odwiedza minimum 3 z 9 sektorów. To test logiki, **nie** pomiar wydajności 90 postaci ani ocena naturalności ich animacji.

**VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN** — brak raportu przeglądarki. Ręcznie sprawdzić start/stop, Walk/Run, skręty, nierówności terenu, mijanie gracza i NPC oraz narożniki namiotów. Renderów otoczenia nie traktować jako testów ruchu.

## Kolejny etap wymaga przygotowania rigów

### Poprawka po zgłoszeniu cofania przy zapętleniu — 22.09.2026

Zgłoszenie użytkownika odtworzono na rzeczywistych ośmiu `npc-animations.glb`: Walk zawierał przesunięcie bioder do przodu, niezależne od ruchu nawigacji. Na końcu pętli następował skok do początku (w pierwotnym pomiarze około 1,3–1,8 m po normalizacji wysokości). Dotychczasowy próg ochronny `LOCOMOTION_ROOT_LIMIT=4` nie wykrywał tego dryfu w małej skali źródłowej rigów.

`stabilizeLocomotionRoot` usuwa teraz liniowy postęp poziomy w Walk/Run, zachowując okresowe kołysanie, pionowy ruch i wszystkie tracki kończyn. Projekcja uwzględnia obrót i skalę rodzica bioder (eksporty Z-up). Korekta odbywa się na kopii tracka: GLB/cache bez zmian, bez dodatkowej pętli. Zwykłe klipy gestów i istniejąca ochrona przed ekstremalnie błędną translacją pozostają bez zmian.

Przed pomiarem wielkości klona `NpcManager.fit` odświeża wszystkie macierze szkieletu po zastosowaniu Idle. Zastąpiono też dolne ograniczenie wymiaru 0,01 bezpieczną kontrolą wymiaru zerowego: prawidłowe modele mają źródłowo mniej niż 0,01 jednostki, więc wcześniejsze ograniczenie zaniżało ich docelową wysokość.

Regresja: `NpcLocomotionAssets.test.ts` ładuje wszystkie 8 prawdziwych GLB, sprawdza rzeczywistą wysokość sklonowanego i animowanego NPC (2,45 m), obie animacje, granicę pętli oraz trzy następne cykle przy 120 próbkach/s. Poziomy skok między próbkami pozostaje poniżej 8 cm; oryginalne tablice klatek nie są modyfikowane. Testy jednostkowe sprawdzają też zachowanie kołysania/pionowego ruchu i obrócony rig.

Po poprawce: **391 testów w 62 plikach**, 23 testy orkiestratora, walidacja assetów/rigów, build, zakresowy ESLint i `git diff --check` zaliczone. Ostrzeżenie bundla >500 kB nadal występuje. Próba przez skill browser: `Browser is not available: iab`, lista `[]`, diagnostyka odczytana. **VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN**. Pełne odświeżenie gry z tego worktree i ręczna kontrola chodu/biegu nadal wymagane.

### Rigi nowych postaci — nadal oczekują

Zapytano użytkownika, czy ma już zriggowane wersje; alternatywą jest lokalny próbny rig jednej postaci i kontrola deformacji przed powielaniem procesu. Nie wykonano jeszcze próbnego riggingu.

1. Zweryfikować pozę, orientację, topologię, odseparowanie kończyn i akcesoriów na próbnej postaci.
2. Przygotować szkielet i wagi, potem Idle/Walk/Run; sprawdzić kolana, biodra, dłonie, ubrania i pętlę kroku. Istniejący generator bibliotek animacji wymaga już zriggowanej bazy — sam nie dodaje kości do statycznego GLB.
3. Przygotować zoptymalizowane pochodne/LOD i manifest wszystkich gotowych postaci; uzupełnić brakujący model 091 lub jawnie go wykluczyć do czasu dostarczenia.
4. Dopiero wtedy rozszerzyć istniejący loader o kontrolowane ładowanie i NPC o bezpieczne rozproszone spawny (obecna lista ma osiem pozycji), bez drugiego renderera/pętli i bez modyfikacji oryginałów.
5. Przeprowadzić testy rzeczywistych rigów, mapy, kolizji, pamięci i FPS, a następnie odbiór wyglądu w ruchu. Nie ogłaszać ukończenia integracji na podstawie samego builda.

Nie wykonano commit/push/PR/merge ani operacji na kluczach API.
