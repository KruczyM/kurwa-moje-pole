# Fighter motion v4 — źródła ilustracji

344 nowe pozy postaci i pięć ilustracji rekwizytów przygotowano wbudowanym ImageGen. Nie używano kluczy API, płatnych kredytów, Gemini ani Vertex AI. Zachowano wygląd istniejących zawodników z atlasów `combat-illustrated-v1` i `art-v3`.

`sources.json` wskazuje wybrane arkusze. Układ każdego arkusza: cztery kolumny; pierwsze dwa wiersze to osiem faz chodu, trzeci to cztery fazy upadku, czwarty to cztery fazy wstawania. Jedenaście postaci ma dodatkowe dwa wiersze z ośmioma pozami ulti. Pozostałe pięć zachowuje dotychczasowe ulti.

WC TRON odtworzono z dostarczonej przez użytkownika fotografii czterech widoków białej kabiny. Szyld SUMMER CONTRAST odtworzono z logo na załączonym zrzucie plakatu. Megafon zachowuje wygląd istniejącego rekwizytu, ale nie zawiera wrysowanej fali. Zapalniczka i szyszka są osobnymi małymi przedmiotami.

Pakowanie: `python scripts/fighter/pack-motion-v4.py`. Skrypt wykorzystuje istniejącą analizę komponentów alfa, sprawdza liczbę sylwetek i marginesy, zachowuje jedną skalę postaci oraz wspólny punkt podparcia przez wszystkie klipy. Nie generuje ani nie deformuje pozy. Sumy SHA-256 wybranych arkuszy i prostokąty źródłowe trafiają do runtime `motion-v4/manifest.json`.

Arkusze źródłowe nie są serwowane przez grę. Do `public/` trafiają wyłącznie spakowane atlasy i zakodowane rekwizyty. Pliki graficzne podlegają istniejącym regułom Git LFS.

Dodatkowe źródła: `prop-wc_tron_open.png` i `prop-wc_tron_open_right.png` mają po cztery klatki otwierania drzwi w jednym wierszu. Logo pozostaje czytelne w obu kierunkach bez odbijania tekstu. `prop-dj_front.png` przedstawia szerszą konsolę od strony widza. Pakowanie: `python scripts/fighter/pack-ulti-props-followup.py`; rozmiary i sumy SHA-256 zapisuje `motion-v4/props/followup.json`.

Aktualna konsola: `prop-dj_operator_side.png`, wbudowany ImageGen (edycja `prop-dj_front.png`), przezroczyste tło. Runtime: `public/game-assets/2d/fighter/motion-v4/props/dj_operator_side.webp`. Prompt zachowano w `dj-operator-prompt.md`. Starsze ujęcia pozostają źródłami.
