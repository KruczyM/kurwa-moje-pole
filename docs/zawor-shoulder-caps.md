# Zawór — kształt barków, 29.09

Po doprecyzowaniu użytkownika poprawiono sam kształt barków, nie pozę menu ani frędzle.

Zainstalowana korekta: punkty obrotu ramion przesunięto do środka o 2,5% wysokości modelu na stronę, bez zmiany ich wysokości. Neutralne położenie łokci i dłoni zachowano przez przeliczenie pozycji lokalnych i macierzy wiązania. W górnej części poncza wygładzono przejście wag między tułowiem i ramieniem. To zmniejsza odstające, poziome czapy barków przy opuszczonych rękach.

Próby podnoszenia punktów obrotu odrzucono: tworzyły kanciaste wypukłości i chowały ręce za ubraniem. Przyjęta wersja: `reports/zawor-caps-menu-v5/grid.png`, kontrola biegu: `reports/zawor-caps-run/grid.png`. Renderowane rzeczywiste pozycje skinned vertices Three.js, nie podmieniona ilustracja.

Testy sprawdzają zachowanie neutralnej geometrii, niezmienione wagi poza pasmem barków (m.in. głowa i dół ciała), normalizację wag i przesunięcie pivotów. Audyt binarny potwierdza zachowanie geometrii, UV, tekstur i klipów obrotu. 28 testów barków, menu i brody przechodzi.

Odtworzenie: `npx tsx scripts/repair-character-weights.ts --zawor-shoulders`; instalacja wymaga `--install`. Niezmienna kopia wejściowa: `reports/zawor-shoulder-caps-20260929/originals`.

Frędzle i zachowanie całego poncza nadal mają osobne, znane niedoskonałości; ta korekta nie deklaruje ich naprawy. `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`: potrzebny odbiór teksturowanego modelu w działającym menu. Bez merge/push.
