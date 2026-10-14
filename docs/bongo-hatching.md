# Kobra — wykluwanie i rozszczepianie

Zmiana po kampanii v5 (`5a3f021`), w tym samym branchu/worktree.

- Przez ostatnie 0,7 s przed falą kolonia z wolnym sąsiadem drży coraz mocniej, lekko puchnie i pokazuje krótką rysę.
- Po rzeczywistym zajęciu wolnego pola nowa twarz oddziela się od konkretnego rodzica, rozciąga i osiada w swoim polu w 0,24 s. Nie jest to pojawienie obrazu dopiero po wejściu w kadr.
- Zablokowana kolonia nie zapowiada rozmnażania. Wybrany rodzic jest deterministyczny, także gdy kilku sąsiadów mogłoby zająć to samo pole.
- Fizyka, tempo i reguły wzrostu pozostają te same. Zegar symulacji steruje efektem; pauza zamraża drganie i podział, restart usuwa historię narodzin. Reduced motion wyłącza wstrząsy i rozciąganie.
- Istniejący renderer oraz pojedynczy RAF; bez nowych obrazów, loaderów i timerów. Indeks narodzin jest odświeżany po zmianie komory lub pojawieniu się nowych segmentów.

Walidacja: 353 testy Bongo PASS, typy/lint/format PASS, build Pages PASS oraz 24 trasy kampanii PASS. `verify-bongo-hatching.py`: Chromium i WebKit/iPhone PASS — fazy spoczynku, drgania, pęknięcia, rozdzielenia i osadzenia, rzeczywiste narodziny w ticku 12 oraz nieruchomy canvas podczas pauzy. Obejrzano zrzuty faz. Raport i obrazy: `reports/bongo-hatching/`.

Niezależny review przed publikacją pozostaje wymagany przez AGENTS.md. Nie wykonano push, PR ani merge. Fizyczny telefon pozostaje do odbioru.
