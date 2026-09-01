# Sterowanie i interakcje mobilne

## Zakres wdrożony

- lewy joystick odpowiada za ruch; wychylenie powyżej 88% uruchamia bieg;
- przeciąganie palcem bezpośrednio po scenie obraca kamerę FPS;
- `UŻYJ` uruchamia tę samą kontekstową interakcję co klawisz `E`;
- `MENU` otwiera pauzę;
- `EKWIPUNEK` otwiera ekwipunek, a w jego wnętrzu zmienia się w `ZAMKNIJ`;
- istniejące przyciski modali obsługują użycie przedmiotu, powrót z inspekcji,
  zamknięcie dialogu i wznowienie gry;
- kontrolki uwzględniają `safe-area-inset-*`, więc nie wchodzą pod notch i pasek systemowy;
- Pointer Lock jest wyłączony dla sterowania dotykowego i pozostaje aktywny na komputerze.

## Zasady wejścia

Joystick i kamera przechowują osobne identyfikatory palców, dlatego można iść
i rozglądać się jednocześnie. Dotknięcie przycisku UI nie może obracać kamery.
Otwarcie modala natychmiast zeruje ruch, aby postać nie szła dalej po puszczeniu
palca poza joystickem. Interakcja nadal korzysta z celownika na środku ekranu.

## Plan kolejnych etapów

1. **Inspekcja przedmiotu** — przeciągnięcie obraca model ręcznie, pinch zmienia
   przybliżenie, a podwójne dotknięcie przywraca domyślne ustawienie. Automatyczny
   obrót zostaje zatrzymany podczas gestu.
2. **Akcje kontekstowe** — etykieta `UŻYJ` powinna zmieniać się na `ROZMAWIAJ`,
   `WEŹ`, `WŁĄCZ` albo `WEJDŹ`, bez dokładania wielu przycisków na ekranie.
3. **Interakcje przytrzymywane** — czynności wymagające czasu dostają okrągły
   wskaźnik postępu i możliwość anulowania przez odsunięcie palca.
4. **Bieg i kucanie** — obecny bieg z pełnego wychylenia należy przetestować z
   graczami; alternatywą jest blokowany przycisk sprintu. Kucanie może używać
   osobnego przycisku tylko wtedy, gdy zostanie dodane do mechaniki gry.
5. **Sterowanie kamerą** — opcjonalna regulacja czułości, odwrócenie osi Y oraz
   żyroskop uruchamiany wyłącznie po zgodzie użytkownika.
6. **Wibracje** — krótkie `navigator.vibrate()` dla trafnej interakcji i błędu,
   z możliwością całkowitego wyłączenia w ustawieniach.
7. **Multiplayer** — przycisk push-to-talk, stan mikrofonu i lista graczy muszą
   trafić do górnego HUD bez zasłaniania menu i ekwipunku.
8. **Dostępność** — zmiana rozmiaru przycisków, tryb dla lewej ręki, wysoki
   kontrast oraz brak gestu jako jedynej drogi wykonania ważnej akcji.

## Kryteria testowe

- portret i landscape na szerokościach 360, 390, 412, 768 i 1024 px;
- Android Chrome, Samsung Internet oraz iOS Safari;
- jednoczesny joystick i obrót kamery bez skoków lub zakleszczenia palca;
- otwarcie każdego modala zatrzymuje gracza;
- wszystkie modale można zamknąć bez klawiatury i przycisku systemowego Wstecz;
- przy 30 FPS sterowanie pozostaje stabilne, a delta gestu nie zależy od FPS;
- desktop zachowuje WASD, mysz, Pointer Lock, `E`, `Tab` i `Escape`.
