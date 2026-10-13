# Bijatyka: grafiki AI, areny, ultimate i trening

Branch: `codex/fighter-art-polish`, worktree `.ai/worktrees/fighter-art`, baza
`3bd5f028b2a0f3469f01be66985325cf9daae6dc`. Zmiany przeznaczone do skoordynowanej
integracji z pracą drugiego czatu nad Bongo Rush. Publikację wykonuje orkiestrator
po walidacji i niezależnym review, zgodnie z AGENTS.md.

## Zachowanie

- Grafika z opasek Woodstock / Pol’and’Rock w obu menu, z osobnym kadrem pionowym.
- Każde ultimate obejmuje całą szerokość areny i przeciwnika w powietrzu; zachowane
  koszty, obrażenia, blok i nietykalność. Zasięg i punkt trafienia rozstrzyga wspólna
  symulacja, a efekt trafienia powstaje w hurtboxie przeciwnika.
- Trening: pełny pasek gracza, nieśmiertelny nieruchomy przeciwnik z reakcjami na
  trafienia, bez końca rundy i limitu czasu. Zwykłe mecze mają dotychczasowe zasady.
- Wspólny układ tła, podłoża i postaci, oddzielna kalibracja podłoża czterech aren,
  zapas na drgania kamery ±32 px. Usunięto proceduralne słupki; pozostają elementy
  otoczenia namalowane w istniejących ilustracjach. Na wysokich ekranach wydłuża
  się tylko pierwszy plan, aby zachować scenę nad podłożem.
- Chód 16 postaci: 12 klatek cyklu, 4 wejścia i 4 wyjścia; zatrzymanie odtwarza
  wejście w odwrotnej kolejności. Faza cyklu zależy od dystansu, przejścia trwają
  8 kroków symulacji. Atak, blok i trafienie przerywają przejście, freeze zatrzymuje
  jego czas. Zachowano obecny bank sprite’ów, cache i jedną pętlę renderowania.
- Szerszeń ma 6 nowych klatek ultimate: unosi obie ręce, przywołuje odtworzoną
  naklejkę HIPOKRISTIS, rozpędza obrót i posyła ją w cel. WC Tron jest biały,
  z animowanymi rolkami papieru; głośnik, megafon i gramofony wysyłają falę dźwięku.

## Zasoby i odtwarzanie

Wbudowane `image_gen` wygenerowało 37 oryginalnych obrazów, bez płatnych API,
kluczy i zewnętrznych sampli. Oryginały oraz pełne prompty są zapisane w
`art-source/fighter-v3/`; zdjęcia prywatne użytkownika nie zostały skopiowane do
repozytorium. Naklejka jest interpretacją odtworzoną z nieostrej fotografii.

Runtime używa `public/game-assets/2d/fighter/art-v3/`: 18 przezroczystych rekwizytów
WebP, 2 tła WebP, 326 klatek atlasów PNG oraz manifest. Źródła PNG pozostają poza
`public` i nie trafiają do cache ani wydania Pages. Cache rekwizytów i atlasów
ograniczono do aktywnej pary zawodników.

```powershell
python scripts/fighter/pack-ai-art-v3.py
python scripts/fighter/validate-ai-art-v3.py
```

Pakowanie wymaga Pillow i NumPy. Nie generuje ani nie przemalowuje póz: wycina
przezroczyste klatki, wyrównuje skalę oraz punkt stóp i koduje atlasy. Przycięte
dolne rzędy źródeł są pomijane; wybrano co najmniej 12 pełnych póz każdej postaci.
Manifest zapisuje dokładne prostokąty źródłowe i SHA-256 oryginałów.

## Walidacja i ograniczenia

Nowe testy sprawdzają pełny zasięg i blok 16 ultimate, położenie efektu trafienia,
trening przy obrażeniach większych od życia, powtarzanie ulti, ograniczenia aren,
kadrowanie przy zoomie i drganiach, przejścia chodu, zatrzymanie przez freeze,
ścieżki i wymiary zasobów oraz odrzucenie protokołu 2. Zachowane testy Socket.IO
obejmują dwóch rzeczywistych klientów i izolację od festiwalu.

Niezależny review wykrył dwa problemy: brak zapasu kadrowania przy drganiu oraz
nieprawidłowy punkt efektu globalnego hitboxa. Oba poprawiono i objęto testami;
ponowny review nie wykazał dalszych problemów blokujących.

Wyniki końcowe: `ci:code` PASS — 197 plików / 1840 testów oraz 6 testów
narzędzi, lint, typy, formatowanie i kodowanie. `ci:assets` PASS — 241 zasobów,
16 rigów, sektory mgły. Produkcyjny build czterech stron PASS z bazą
`/kurwa-moje-pole/`. Dotychczasowe animacje: 272 klipy / 1632 klatki PASS.
Nowe grafiki: 16 postaci / 326 klatek / 18 rekwizytów / 2 tła / 37 źródeł PASS.
Łączny rozmiar nowych atlasów i rekwizytów runtime: 12,86 MiB.

Sprawdzono źródła i techniczny arkusz wyeksportowanych klatek. Podgląd gry w
przeglądarce był wcześniej jawnie zablokowany i nie obchodzono tego ograniczenia.
Nie potwierdzono wyglądu całej gry ani płynności animacji w ruchu.

**VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN**

Do oceny ręcznej: oba menu, cztery areny na komputerze i telefonie w obu
orientacjach, ruch i odrzut przy ścianach, kontakt stóp z podłożem, start/stop chodu,
każde ultimate i jego blok, Szerszeń/HIPOKRISTIS oraz trening.

## Backend i przekazanie do publikacji

Protokół bijatyki podniesiono do **3**. Starszy backend wyświetli niedostępność
online; bot i trening działają lokalnie. Aktualizację i restart istniejącego
backendu wykonuje właściciel według [instrukcji online](fighter-online-release.md).
Healthcheck musi zwracać `fighterProtocol: 3`; nie potwierdza to jeszcze meczu.

Orkiestrator powinien zachować lokalne zmiany głównego checkoutu, zintegrować
commit tej gałęzi z najnowszym `main` oraz zmianami Bongo Rush, uruchomić CI,
wypushować i utworzyć PR. Po scaleniu sprawdzić workflow Pages oraz publiczne
menu, bijatykę i jej nowe zasoby. Docelowy adres:
<https://kruczym.github.io/kurwa-moje-pole/fighter-demo.html>.

**PRODUCTION_ONLINE_VERIFICATION_PENDING_BACKEND_UPDATE** pozostaje aktualny
do restartu backendu i udanego pojedynku dwóch klientów na opublikowanej stronie.
