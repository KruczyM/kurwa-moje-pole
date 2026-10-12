# Cztery wyzwania Bongo Rush

Gałąź początkowa: `feat/bongo-challenge-caves`; trudniejsze wersje 15–16: `feat/bongo-difficulty-pass`.
Audyt wszystkich plansz: [bongo-difficulty.md](bongo-difficulty.md). Oryginalne 12 plansz i finał na poziomie 12 zostają.
Po ich ukończeniu otwiera się poziom 13, następne odblokowują się kolejno. Stary zapis
z ukończoną kampanią odblokowuje 13 automatycznie. Nie wykonano publikacji ani merge.

## Plansze

| Poziom | Konstrukcja                         | Obowiązkowa zagadka                                                                                                                         |
| ------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 13     | Dwa wysokie rezerwuary              | Zebrać łup od boku pod spadającymi przedmiotami, trafić dwa ruchome kwadraty skałami, zebrać ich łup, przejść kieszenie i zasuwę kolejności |
| 14     | Sześć wysp w dwóch rzędach          | Sześć niezależnych zrzutów na poruszające się cele; obserwować powrót kwadratu, wykopać podporę i natychmiast cofnąć się                    |
| 15     | Spirala i trzy zasuwy               | Pięć łupów na zwojach, potem dwa łupy za przeciwnymi zasuwami i osobna zasuwa kolejności                                                    |
| 16     | Kamienne litery KURWA / MOJE / POLE | 32 łupy pod kreskami i 9 wewnątrz/bokiem liter; kaskady, pułapka skalna i zasuwa kolejności                                                 |

Układy są autorską interpretacją dostarczonych zdjęć, nie kopiami kodu, grafik ani
plansz źródłowej gry. Rezerwuary, wyspy i spirala mają różne zasady przejścia;
nie są kolejnymi losowaniami jednej mapy. Poziomy 13–16 mają minimum 4 minuty.

## Eliminacje i kwadrat

Tylko **spadająca skała** eliminuje czerwony/niebieski patrol, undercover lub kwadrat.
Kontakt nadal zabija gracza. Nie dodano broni ani kolejnego kontrolera.
Finałowy boss na 12 pozostaje odporny: jego istniejącą zagadką jest zagroda.

Po trafieniu przedmiot pojawia się w polu właśnie opuszczonym przez skałę,
nad trafionym przeciwnikiem. Podlega tej samej grawitacji co reszta przedmiotów.
Nie można dostać kilku łupów z tej samej ofiary. Wyjścia na 13, 14 i 16 wymagają
odpowiednio 2, 6 i 1 eliminacji oraz zebrania oznaczonych złotą obwódką przedmiotów.
Nadmiar zwykłego łupu z rezerwuaru nie omija tych wymagań.

Kwadrat z siatką najpierw podchodzi do najbliższej widocznej krawędzi, a potem
obiega ją z przeszkodą po lewej stronie. Nie ściga gracza ani nie kopie ziemi.
W zamkniętym kanale wraca tym samym torem; w otwartej komorze obiega jej brzeg
lub pobliski wewnętrzny filar. Porusza się co dwa kroki symulacji.
Zbyt wczesny zrzut może zaklinować szyb bez trafienia: trzeba obserwować cel,
a po błędzie użyć restartu R/↻. Pomoc „?” i pauza zatrzymują czas.

## Pliki i format

- `Campaign.ts`: osobne limity kampanii (12) i wszystkich plansz (16).
- `ChallengeCaves.ts`: cztery konstrukcje, kamienny font, pułapki i referencyjne trasy.
- `Simulation.ts`: istniejąca fizyka rozszerzona o eliminacje, łup i ruch kwadratu.
- `Renderer.ts`: siatka kwadratu rysowana w istniejącym Canvas, bez nowych assetów.
- `Progress.ts`: odblokowanie i migracja ukończonego zapisu.
- `main.ts`: licznik eliminacji, przejście do bonusów, brak przycisku Dalej po 16.
- `ChallengeCaves.test.ts`: pętle patrolu, eliminacje, złe wyczucie zrzutu i przejścia.
- `scripts/simulate-bongo-campaign.ts`: odtworzenia wszystkich 16 plansz prawdziwą symulacją.
- `scripts/verify-bongo-challenges.py`: przejścia przez sterowanie w przeglądarce.

Nowe znaki ASCII: `S` — kwadrat z siatką, `Q` — zwykły opcjonalny przedmiot.
`O` może być obowiązkowe przez `requiredPickups`; znacznik podąża za spadającym łupem.
`requiredKills` określa minimum eliminacji, `world.kills` przechowuje wynik bieżącej próby.
Cały model fizyczny i pojedynczy requestAnimationFrame pozostają wspólne.

## Weryfikacja

```powershell
npm run ci:code
npx tsx scripts/simulate-bongo-campaign.ts
npm run build
# Uruchom Vite na 5202, następnie Python z zainstalowanym Playwright:
python scripts/verify-bongo-challenges.py
```

Symulacja sprawdza 32 odtworzenia: po jednej trasie ciągłej i jednej z przerwami
na każdą planszę. Kampania ma dwukrokowe przerwy na zakrętach; bonusy mają
ośmiokrokowe przerwy tylko poza aktywnymi zagrożeniami, zachowujące fazę ruchomych
pułapek. To dowód istnienia tras, nie dowód bezpieczeństwa dowolnego zwlekania.
Raport powstaje w ignorowanym `reports/bongo-avalanche/simulation-report.json`.
Trudność i zabawa nadal wymagają oceny człowieka. Emulacja iPhone’a nie zastępuje
testu na fizycznym telefonie; test mobilnej planszy używa klawiatury w emulowanym WebKit.

### Wyniki pierwotnej wersji 153393e — 2026-10-12

- `ci:code`: PASS, 173 pliki / 1678 testów jednostkowych oraz 6 testów narzędzi.
- 32/32 odtworzenia symulacji: WON, wszystkie obowiązkowe łupy zebrane.
- Przeglądarka, prawdziwe wejścia klawiatury: 13 (2 eliminacje), 14 (6), 15 (0), 16 (1): PASS.
  Plansza 14 uruchomiona w WebKit/iPhone 13, pozostałe w Chromium desktop.
  Skrypt obserwuje fazę ruchu kwadratu przed zrzutem, nie teleportuje ani nie usuwa skał.
- `npm run build`: PASS. Istniejące ostrzeżenie o dużym głównym bundlu 3D pozostaje.
- Produkcyjny lokalny preview: Chromium i WebKit/iPhone 13 PASS, brak błędów JS/HTTP,
  pauza utrzymuje obraz i aktywny RAF, wznowienie odzyskuje sterowanie.
- Obejrzano zrzuty startowe plansz 14 i 16: widoczna siatka przeciwnika, kamienne litery,
  HUD i mobilna gałka. Fizyczny telefon oraz subiektywna ocena trudności: PENDING_HUMAN.

Raporty przeglądarki: `reports/bongo-challenges/browser-report.json`
i `reports/bongo-rush/production-report.json` (generowane lokalnie, nie wersjonowane).
Samodzielny przegląd kodu: brak drugiej pętli/renderera, jedno trafienie = jeden łup,
unikalne identyfikatory żywych obiektów, zachowany finał 12, odblokowanie bonusów,
brak przejścia poza ostatnią planszę. Nie zastępuje niezależnego review przed publikacją.
