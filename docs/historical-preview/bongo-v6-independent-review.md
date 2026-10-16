# Bongo Rush v6 — niezależny review

Data: 2026-10-15. Zakres: worktree `E:/kodowanie/gra/.ai/worktrees/bongo-rush-v6`, branch `codex/bongo-rush-v6`, baza `c6284e5`. Kontrole kodu i replayów były tylko odczytowe; reviewer nie implementował zmian gry. Ten dokument utrwala wyniki kontroli, nie zastępuje końcowego raportu przeglądarkowego.

## Potwierdzone fakty

- Etap A: niezależnie sprawdzono 24 pełne zwycięstwa i 24 rzeczywiste porażki przez produkcyjną symulację, wymagany łup i cele, pierwsze odsłonięcia kolonii oraz 449 zgłoszonych zdarzeń dostępu po upadku skały. Sprawdzono skuteczne alternatywy poziomów 1, 9, 14 i 19.
- Korekta poziomu 9 jest jawna: 13 pól `#` → `.`, zachowane oryginalne referencje i manifest korekt. Przy promocji pozostałe 23 definicje i replaye zachowały zgodność. SHA-256 definicji 9 przy promocji etapu A, przed końcowymi metadanymi `scenery`: `39719a4dd88d5686f7843e96cc049654fc75881866ca11980ef3b64fd209bcc6`. Jest to suma historyczna; aktualna suma definicji obejmuje również scenografię.
- Główna trasa 9: 726 wejść, `WON`, 153/153 i pięć celów; pierwsze odsłonięcie w kroku 376 przy 71/153. Alternatywa: 736 wejść i pełne zwycięstwo; wspólny prefiks 661 wejść, odmienny odbiór spadającego przedmiotu 304 oraz odwrócona kolejność 234/235. Nie potwierdzono odwrócenia kolejności 304/314. Korekta nie jest dowodem niewykonalności oryginału ani globalnej minimalności zmian.
- Runtime B/C zachowuje istniejący renderer, loader i pojedynczy RAF. Sprawdzono animację zależną od prezentowanego dystansu, pauzę, reset między komorami, ograniczony cache kafelków, clipping dekoracji oraz migrację zachowującą odblokowania i preferencje bez automatycznego ukończenia v6.
- Znaleziony P2 dotyczący obrazów kończących ładowanie po błędzie batcha został poprawiony. `settleImageBatch` czeka na wszystkie rozpoczęte żądania w `atlas()` i `loadRun()` przed sprzątaniem; zaakceptowano regresję z odrzuconymi metadata i późnym obrazem.
- Sprawdzono kontrakt eksportera i registry, osobny wózek, jego ładowanie/rysowanie/zwalnianie oraz tryb builda `verification`. Udostępniony snapshot kopiuje świat i nie daje interfejsu mutowania symulacji. W ostatnim zakresie review nie pozostał konkretny blokujący błąd.

## Wykonane kontrole

- Przy promocji kampanii: 129 testów dotyczących kampanii, wariantów geometrii i dowodów replayów.
- Pierwsza kontrola runtime: 74 testy w ośmiu plikach dotyczących cache, galerii, renderera, scenografii, migracji i animacji.
- Po poprawce batcha i ukończeniu atlasów: 67 testów w sześciu plikach; wszystkie przeszły. To wybrane zestawy review, nie liczba wszystkich testów projektu.
- `python scripts/bongo-v6/validate-art.py --complete` przeszedł: 19 humanoidów, cztery biomy i osobny wózek; sprawdzane sumy źródeł/eksportów, klatki, przezroczystość, marginesy i metadane.
- Obejrzano `reports/bongo-campaign-v6/art/roster-1.png` do `roster-4.png`: brak widocznych ucięć sylwetek przy rozmiarach 40/48/64/80 px.
- Końcowy lekki przegląd zapisanych raportów potwierdził kompletność czterech `final-{chromium,webkit}-{landscape,portrait}/report.json`: każdy zawiera poziomy 1–24 dokładnie raz, wszystkie `WON`, wszystkie z `controlsVerified`, bez zgłoszonych błędów JavaScript i nieudanych odpowiedzi HTTP. Łącznie 96 ukończonych przejść. Są to odczytane wyniki automatyzacji, nie dodatkowe przejścia uruchomione przez reviewera.
- `roster-gameplay`: 15/15 bohaterów kończy poziom 2 zwycięstwem, bez zgłoszonych błędów. `production-default`: poziom 2 `WON`, diagnostyczny snapshot nie jest ujawniony. `production-base`: poziomy 2/12/18/20 `WON`; `production-reduced-webkit`: poziom 18 `WON` z reduced motion. Te raporty również nie zgłaszają błędów ani nieudanych odpowiedzi.
- `memory-switches/report.json`: 15 zmian bohatera/poziomu w jednej stronie, zero pełnych atlasów galerii podczas gry, bez zgłoszonych błędów. Maksimum raportowanej sumy obrazów i cache wynosi około 24,93 MiB; w czterech pełnych przejściach około 31,63 MiB. Jest to oszacowanie zdekodowanych obrazów i własnych cache, nie całkowite zużycie pamięci procesu ani GPU.
- Odczytano `final-unit-tests.log`: 2195/2195 testów w 217 plikach przeszło. Nie ponawiano testów podczas końcowego pomiaru. Sprawdzono lokalny timeout 30 s w trzech ciężkich zestawach v6; zwiększony limit czasu nie jest dowodem zmiany warunków zwycięstwa.
- Atlasy blue/undercover są przygotowane, ale jawne siatki v6 nie zawierają `B` ani `U`; sprawdzono też ich brak w v5. Przejścia kampanii nie obejmują więc ich zachowania podczas rozgrywki.
- Odczytano końcowe `docs/bongo-v6-performance.json` i `docs/bongo-v6-browser-report.json` oraz potwierdzono obecność 13 obrazów w `docs/bongo-v6-qa/`. Liczby w obu tabelach przed/po w `docs/bongo-v6-validation.md` zgadzają się z danymi JSON po zaokrągleniu: renderowanie, odstępy klatek, obrazy, canvasy i cache kafelków.

## Końcowy pomiar przed/po

Każda z pięciu identycznych tras 1/9/16/18/20 kończy się `won` przed i po zmianach, z odpowiednio 232/726/353/154/102 krokami, dodatnią liczbą próbek renderera i pustą listą błędów. Pomiar używa rzeczywistego zegara Chromium headless 1280×800, a punkt odniesienia ma stary renderer/galerię/grafiki oraz przeniesione dane i symulację v6 dla porównywalnych tras.

| Poziom | Render mediana/p95, ms — przed → po | Odstęp klatek mediana/p95, ms — przed → po |
| ------ | ----------------------------------- | ------------------------------------------ |
| 1      | 1,10/1,60 → 1,30/1,80               | 18,30/22,60 → 16,60/18,00                  |
| 9      | 1,10/1,70 → 1,50/2,10               | 18,60/22,40 → 16,70/18,10                  |
| 16     | 1,10/1,80 → 1,40/2,00               | 19,00/23,00 → 16,60/18,00                  |
| 18     | 1,10/1,50 → 1,10/1,60               | 18,50/22,40 → 16,60/18,00                  |
| 20     | 1,00/1,50 → 1,10/1,60               | 18,40/22,20 → 16,60/18,00                  |

Mediana kosztu renderowania rośnie o 0,0–0,4 ms; raportowane odstępy klatek są niższe. Obrazy spadają z 24–26 do 6–8, a ich zdekodowany rozmiar z 73,00–82,50 MiB do 14,34–23,33 MiB. Cache kafelków rośnie z 0,58–0,97 MiB do 1,30–2,50 MiB. Całkowite canvasy wynoszą po zmianach 5,68–6,88 MiB i już obejmują cache kafelków oraz widoczny framebuffer; nie należy liczyć tych samych bajtów dwukrotnie. Wynik jest lokalnym pomiarem po GC, bez alokacji GPU i gwarancji FPS na urządzeniu użytkownika.

## Ograniczenia odbioru

Cztery pełne warianty przejść przeglądarkowych są ukończone i ich raporty sprawdzono pod kątem kompletności. Używają kontrolowanego zegara Playwright oraz produkcyjnego RAF i akumulatora; są oddzielone od zakończonego pomiaru wydajności na rzeczywistym zegarze. Statyczne zrzuty i raporty automatyzacji nie zastępują subiektywnej oceny płynności animacji i czytelności całej sceny podczas ruchu. W sprawdzonych raportach nie znaleziono konkretnego blokera przekazania; nie uruchamiano ponownie ciężkich testów.

Nie wykonano niezależnego odbioru na fizycznym telefonie. Ocena dotyku, orientacji, odczuwanej trudności, atrakcyjności zagadek i czasu człowieka pozostaje do osobnego potwierdzenia. Sekundy symulacji nie są czasem rozgrywki człowieka.

Status pozostający do odbioru człowieka: **VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN**. Ten review nie jest deklaracją ukończenia całego planu.
