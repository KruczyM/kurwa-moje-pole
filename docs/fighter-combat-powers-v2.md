# Podbródkowy, wybicie i supermoce — 16 postaci

Zestaw rozszerza wcześniejsze animacje ataków i obrony. Każda z 16 postaci otrzymuje cztery paski po sześć klatek: mocny podbródkowy, reakcję na wybicie, atak specjalny oraz ultimate. Łącznie: 64 animacje i 384 klatki RGBA, komórki 256 × 256 px.

## Zachowanie w grze

- Podbródkowy: garda, obniżenie ciała i zamach, uderzenie w górę, pełny wyprost, cofnięcie i powrót do gardy. Używa istniejącego ruchu `uppercut` (dół + mocny cios ręką).
- Ofiara: odrzut głowy i tułowia, wznoszenie, podkurczenie nóg, szczyt lotu, opadanie, przygotowanie do upadku. Wysokość i prędkość pochodzą z istniejącej symulacji; sprite nie przemieszcza postaci samodzielnie. Po lądowaniu następuje istniejący upadek i wstawanie.
- `special` i `ultimate` mają osobne pozy dla każdej postaci. Efekty korzystają z istniejącego `SuperCinematicEngine` i `SuperPropsRenderer`. Ładowanie, kontakt oraz wygaszanie śledzą fazy rzeczywistego ruchu; hitstop zatrzymuje także efekty. Przerwanie ruchu usuwa cinematic. Pudło lub blok nie uruchamia efektu potwierdzonego trafienia. Prezentacja nie zadaje dodatkowych obrażeń.
- Zachowano pojedynczą pętlę, cache aktywnych postaci oraz zwalnianie obrazów i żądań po zmianie zawodników. Walka lustrzana wiąże cinematic z konkretnym zawodnikiem, również gdy obaj mają ten sam identyfikator postaci.

## Motywy supermocy

| Postać    | Motyw animacji i istniejących efektów        |
| --------- | -------------------------------------------- |
| Amper     | Małe i duże złote lustro                     |
| Korba     | Obrotowe uderzenia i warkocze jak śmigło     |
| Klątwa    | Krzyk i wyrzut klątwy dłońmi                 |
| Chlebak   | Scratch i rzut winylem, stanowisko DJ        |
| Kobra     | Wężowy gest dłoni i komiczny atak biodrami   |
| Zawór     | Mandala, grzyb i wypad ninja                 |
| Szerszeń  | Szept, wskazanie celu i przywołanie monolitu |
| Dziąsło   | Rakietowy wyskok i nurkowanie meteoru        |
| Hemoroid  | Prowadzenie quada i szarża terenówką         |
| Jęczmień  | Zapalniczka i wachlarz zapalniczek           |
| Ambona    | Torba, klucz i rzut kuchenką                 |
| Antena    | Cukierek, ładowanie i wyrzut wiązki          |
| Gruczoł   | Rzut papierem i pozycja na tronie            |
| Krwiak    | Uderzenia małym i dużym szyldem SUMMER       |
| Pień      | Megafon, śmiech i silny krzyk                |
| Pierścień | Stawianie głośnika i uderzenie basem         |

## Pliki i odtwarzanie eksportu

Runtime: `public/game-assets/2d/fighter/combat-powers-v2/<id>/`: `uppercut_power.png`, `launch_hit.png`, `special_power.png`, `ultimate_power.png`. Aktywne manifesty w `combat-illustrated-v1` kierują te cztery klipy do nowego folderu. Poprzednie paski pozostają dostępne. Eksporter bazowego zestawu zachowuje rozszerzenie przy ponownym uruchomieniu.

Obrazy utworzono przez wbudowany `image_gen`, z referencjami zatwierdzonych postaci. Dokładne prompty i lista wariantów: [fighter-powers-generation.json](fighter-powers-generation.json). Źródła: `art/fighter/combat-powers-v2/` (lokalne, ignorowane przez istniejącą konfigurację Git). Ostatni wpis danego identyfikatora wskazuje wybrany wariant. Pakowanie wykonuje wyłącznie techniczne wycięcie po alfie, skalowanie i rozmieszczenie; zapisuje SHA-256 oraz prostokąty źródłowe w `packing.json`.

```powershell
python scripts/fighter/audit-powers.py
python scripts/fighter/pack-combat-powers.py
python scripts/fighter/validate-combat-powers.py
python scripts/fighter/validate-illustrated-combat.py
python scripts/fighter/test-illustrated-packing.py
npm run test:unit -- src/games/fighter
npm run build
```

## Weryfikacja

Wynik: **58/58 testów minigry**, **2/2 testów pakowania**, oba walidatory zasobów, lint zmienionych plików TypeScript oraz build zakończone powodzeniem. Skontrolowano obie plansze z eksportu, obejmujące wszystkie 16 postaci. Aktywny zestaw zawiera teraz 272 animacje ataków i reakcji, czyli 1632 klatki (plus pozy spoczynkowe i istniejący chód/upadek/wstawanie).

Testy deterministyczne obejmują pełną trajektorię rzeczywistego podbródkowego i wszystkie sześć faz lotu, przejście do upadku, 32 superataki wszystkich postaci, hitstop, blok, pudło, przerwanie, walkę lustrzaną i ścieżki zasobów. Walidatory kontrolują wymiary, przezroczyste marginesy, zmiany sylwetek, unikalność pasków oraz zgodność aktywnych manifestów i źródeł.

Raporty lokalne i plansze kontrolne: `reports/fighter-combat-powers-v2/`. Skrypt `verify-illustrated-combat-browser.py` uwzględnia nowe ścieżki i sześć faz lotu.

Status rozgrywki: **VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN**. Dostęp do lokalnego podglądu w przeglądarce został wcześniej odrzucony przez mechanizm uprawnień; nie obchodzono tej blokady. Kontrola obrazów i testy deterministyczne nie zastępują oceny ruchu w działającej grze.
