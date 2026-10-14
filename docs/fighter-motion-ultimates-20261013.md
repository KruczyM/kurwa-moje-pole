# Kurwa moje combo — ruch i ulti, 13.10.2026

Zmiany znajdują się w branchu `fix/fighter-motion-ultimates`, w worktree `.ai/worktrees/fighter-motion-ultimates`, na bazie `codex/festival-games-release` (`508570e`). Nie wykonano push, PR ani merge. Lokalne zmiany głównego katalogu pozostają zachowane.

## Animacje i zachowanie

Wszystkie 16 postaci otrzymały nowe, indywidualne ilustracje chodu, upadku i wstawania. Chód ma osiem faz z uniesieniem stopy, przełożeniem nogi i zamianą nóg podporowych. Cykl odpowiada 120 jednostkom przebytej drogi; hitstop zatrzymuje fazę. Upadek i wstawanie mają po cztery pozy, a KO zatrzymuje ostatnią pozycję leżącą.

Przygotowano 344 nowe pozy, spakowane w 91 klipów / 408 klatek wraz z przejściami start/stop. Pakowanie zachowuje jedną skalę dla całego zestawu danej postaci, wspólny punkt podparcia i marginesy. Oryginały i konfiguracja pozostają w `art-source/fighter-motion-v4`; gra ładuje wyłącznie zasoby runtime.

| Postać    | Ulti                                                                                         |
| --------- | -------------------------------------------------------------------------------------------- |
| Klątwa    | Lekki kuc, otwarte usta podczas krzyku, lecący napis „KURWA MOJE POLE”.                      |
| Chlebak   | Konsola nisko przed postacią, wyjęcie i rzut płytą; usunięta fala ulti.                      |
| Kobra     | Poza sikania, wąski łuk strumienia z okolicy krocza, krople i rozprysk.                      |
| Zawór     | Rozbieg, wyskok, kopnięcie obiema nogami, lądowanie, wstanie i zjedzenie grzyba.             |
| Jęczmień  | Dwie serie po trzy zapalniczki, fanowe ustawienie w dłoniach i podczas lotu.                 |
| Ambona    | Dziesięć szybkich rzutów szyszkami, naprzemienna praca rąk, duży napis „KOSTRZYN”.           |
| Antena    | Podbiegnięcie i mocne przytulenie; reakcja ściskanego przeciwnika.                           |
| Gruczoł   | Biała kabina WC TRON ze złotym logo, według załączonego zdjęcia; zachowany ostrzał papierem. |
| Krwiak    | Szyld z pełnym logo SUMMER CONTRAST według załączonego plakatu.                              |
| Pień      | Megafon przed postacią; złote, rozszerzające się łuki zaczynają się przy jego wylocie.       |
| Pierścień | Napis „dobrze dobrze” wylatuje z głośnika w stronę przeciwnika.                              |

Zachowano obrażenia, koszt, timingi i zasięg ulti na całej arenie. Serie pocisków nie dodają obrażeń. Symulacja nadal rozstrzyga trafienie, blok i pudło; choreografia podbiegnięć nie zmienia pozycji logicznych zawodników. Dotychczasowa prezentacja ataków specjalnych pozostaje osobna.

Kabina unosi się nad Gruczołem i otwiera w stronę przeciwnika. Osobne arkusze obu kierunków zachowują czytelne logo WC TRON. Osiem rolek wylatuje z kabiny, a sześć dodatkowych Gruczoł rzuca rękami. Duży wóz i warkocz są rysowane za zawodnikami; mniejsze rekwizyty przed nimi. Napisy nie odbijają się lustrzanie. Wspólne kadrowanie istniejącego renderera mieści obu zawodników i rekwizyty także w widoku pionowym. Zachowano istniejącą pętlę gry i cache aktywnej pary; nie dodano renderera, pętli RAF ani nowego loadera.

## Dodatkowe poprawki ulti i menu

- Chlebak: konsola na stojaku w bocznym ujęciu, panel zwrócony do operatora. Rekwizyt 130 × 120 stoi 100 jednostek przed postacią (po prawej przy kierunku +1), przy podłożu; blat na wysokości pasa. Zachowano rzut płytą.
- Szerszeń: nazwa ulti „Wyrok Hipokristis”.
- Hemoroid: wóz 480 × 300 przejeżdża przez całą arenę; przedni zderzak dociera do przeciwnika przy trafieniu.
- Krwiak: trzy napisy „summer” nad głową i po bokach, obok istniejącego szyldu SUMMER CONTRAST.
- Pierścień: głośnik 175 × 125; nadal emituje napis „dobrze dobrze”.
- Korba: większy warkocz 220 × 160.
- Menu: półprzezroczyste panele odsłaniają grafikę; tekst zachowuje pełną nieprzezroczystość, kontrast i cień. Osobno sprawdzono desktop, telefon oraz start treningu.

## Walidacja

- Testy bijatyki: **94/94 PASS** (`npm run test:unit -- src/games/fighter`).
- Przeglądarka Chromium: **1484 przypadki PASS**, 16 postaci, oba kierunki, chodzenie do przodu/tyłu, upadki, wstawanie, KO, trzy dystanse ulti, blok i pudło.
- Sprawdzono widoczność klatek ulti w szerokości 390 px oraz rzeczywisty cios i chód przód/tył sterowane klawiaturą.
- Brak błędów JavaScript i odpowiedzi HTTP 4xx/5xx w końcowym przebiegu.
- Sprawdzono ilustracje i zrzuty wszystkich zmienionych ulti, w tym widok telefonu, wachlarz zapalniczek, wyjście fali z megafonu i pozycję grzyba.
- TypeScript / build produkcyjny, ESLint zmienionych plików, UTF-8 i `git diff --check`: PASS. Build zachowuje istniejące ostrzeżenie o dużym głównym chunku aplikacji.

Raport maszynowy i zrzuty: [browser-report.json](../reports/fighter-motion-v4/browser/browser-report.json). Weryfikacja obejmuje rzeczywisty canvas i pętlę aplikacji z deterministycznym wstrzykiwaniem stanów oraz test sterowania. Nie jest pełnym ręcznym playthrough ani niezależnym review. Na wąskim ekranie przy maksymalnym dystansie postacie są odpowiednio mniejsze; istniejący układ przycisków dotykowych nie był przebudowywany.

Ostatnia korekta konsoli: 100 dodatkowych przypadków przeglądarkowych PASS, oba kierunki, bliski/daleki dystans i telefon, bez błędów JavaScript/HTTP. Raport: `reports/fighter-motion-v4/chlebak-console-browser/browser-report.json`. Obejrzano zrzuty desktop i telefonu.

## Odtworzenie

1. `python scripts/fighter/pack-motion-v4.py` — pakuje źródła i sprawdza alfa, liczbę sylwetek oraz marginesy.
2. `python scripts/fighter/pack-ulti-props-followup.py` — pakuje dwa kierunki otwierania kabiny i konsolę.
3. `npm run test:unit -- src/games/fighter` i `npm run build`.
4. `npx vite --host 127.0.0.1 --port 5187 --strictPort`.
5. `python scripts/fighter/verify-motion-v4-browser.py` — wymaga lokalnego Playwright/Chromium.

Podgląd lokalny: <http://127.0.0.1:5187/fighter-demo.html>. Wybrać „Trening”, postać i start.
