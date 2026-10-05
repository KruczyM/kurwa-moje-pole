# Poza Ampera w menu — Zawór i Korba

Korekta Zawora (29.09): osobny profil menu opuszcza ręce o 85 zamiast 80 stopni i zachowuje neutralną orientację stóp, usuwając zadarte czubki po dopasowaniu nóg. Korba pozostaje bez zmian. Render: `reports/zawor-menu-refinement/grid.png`. 18 testów przechodzi, w tym kontrola orientacji stóp i niezależnych profili ramion. Nadal wymagany odbiór w działającym menu (`VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`).

Podglądy Zawora i Korby korzystają z ustawienia tułowia i nóg pierwszej klatki Idle pliku `characters/amper/preview.glb`. Ramiona obu modeli źródłowo poziome są opuszczane jednolitym obrotem skina o 80 stopni, bez osobnego celowania łokciami. Jest to stała poza menu, bez poprzedniego kołysania. Pozostałe podglądy i animacje w grze pozostają bez zmian.

Nie kopiujemy lokalnych kwaternionów między niezgodnymi szkieletami. Zmiany dotyczą wyłącznie klona modelu w CharacterPreview; referencja Ampera jest przechowywana w istniejącym cache i sprzątana razem z nim.

Poprzednie celowanie kośćmi w kierunki kości Ampera odrzucono po uwadze użytkownika: przestawione punkty obrotu Korby nie odpowiadają osi widocznego ramienia, więc zgodny kierunek kości dawał odstawione łokcie. Próby v2/v3 dziedziczyły asymetrię Idle i także odrzucono. Finalny render rzeczywistego skinningu Three.js: `reports/amper-menu-pose-v4/grid.png`. Ręce są opuszczone symetrycznie przy ciele. Test kontroluje obroty całego łańcucha ramion, zgodność nóg, stabilność pozy oraz brak modyfikacji źródłowych klipów. Ujednolicenie pozy nie naprawia automatycznie wag frędzli Zawora.

`VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN` — sprawdzenie w działającym menu pozostaje do wykonania.
