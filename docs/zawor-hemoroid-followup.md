# Zawór i Hemoroid — kolejna kontrola

## Zainstalowane

Hemoroid: zmniejszono podniesienie punktów barkowych z 4,5% do 3% wysokości. Profil przypisany wyłącznie do tej postaci; maski ochrony twarzy i brody pozostają aktywne. Render: `reports/hemoroid-shoulder-subtle/grid.png`. Audyt binarny potwierdza zachowanie siatki, tekstur i klipów obrotu. 116 testów wag, twarzy i barków przeszło.

## Niezakończone — nie instalować

Zawór: próby wag poncza są wyłącznie kandydatami w `reports/zawor-poncho-20260928/corrected`. Runtime GLB Zawora nie został w tej iteracji zmieniony. Próby v1/v2 błędnie używały surowych pozycji z dodatkowym przekształceniem obiektu; v3 miała za ostrą granicę maski. v4 poprawia układ w Idle, lecz Run nadal deformuje dolny brzeg i boczne frędzle. Nie spełnia kryterium wizualnego. `--zawor-poncho --install` jest celowo zablokowane do czasu rozwiązania tego problemu.

Następny krok: rozdzielić wpływy frędzli i bryły poncza na podstawie topologii/oznaczenia powierzchni ubrania, zamiast rozszerzać maskę wysokości na spodnie lub ręce. Porównywać także Run i boczne ujęcia, nie tylko Idle. Test nowej funkcji potwierdza jedynie zachowanie neutralnej siatki, rąk, głowy i normalizację wag — nie dowodzi poprawności ubrania w ruchu.

`VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN` dla Hemoroida. Zawór pozostaje zadaniem otwartym.
