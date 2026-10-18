# Klątwa — korekta wag, 27.09.2026

Poprawiono oba pliki nowej postaci: `new-preview-animations.glb` (menu) i `npc-animations.glb` (gra). Stary model i statyczne źródła pozostają bez zmian.

Dedykowany profil usuwa wpływy ramion z dolnej twarzy, warkoczy i przodu koszulki. Twarz podąża za kością Head przez istniejący łańcuch szyi. Dolne warkocze pozostają przy tułowiu, z przejściem wag przy szyi — nie jest to symulacja włosów. Dopasowano również wagi rękawów. Nie zmieniono siatki, tekstur, szkieletu ani klipów.

Odtworzenie: `npx tsx scripts/repair-character-weights.ts --klatwa --install`. Kopie przed korektą i wyniki znajdują się w `reports/klatwa-skin-repair-20260927`; narzędzie zaczyna z kopii, a nie z poprzednio skorygowanego pliku.

Sprawdzenie: dwa testy rzeczywistych GLB przeszły (wagi twarzy/tułowia, normalizacja, lokalnie także zgodność pozostałych bajtów z kopią). Build przeszedł. Obejrzano rendery Three.js przed/po (`reports/klatwa-before`, `reports/klatwa-candidate-v2`) oraz teksturowane klatki Idle i Run (`reports/klatwa-fixed-textured`). Narzędzie wygenerowało również pozostałe klatki Walk/Run i widoki boczne.

VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN — wymagana ocena całych animacji w grze; rendery pojedynczych klatek nie są pełnym odbiorem. Bez push i merge.
