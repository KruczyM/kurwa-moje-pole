# Przedmioty Rave

Wbudowany imagegen wygenerował przezroczysty atlas `public/game-assets/2d/bongo-rush/art-v2/rave-tablets.png`.
Tabletki mają porowatą, matową fakturę i obrysy znaków: różowy Instagram, żółte EB Bugatti, niebieskie f Facebooka oraz fioletowa gwiazda.
Obecny renderer wybiera wariant z czterech równych ćwiartek. Atlas ładuje się przez ImageCache tylko dla biomu Rave.

Prompt edycji: Preserve matte porous pressed tablet texture, colors, lighting and transparent background. Change outer silhouettes to actual Instagram camera glyph, Bugatti EB monogram, Facebook lowercase f and five-point star. Remove rectangular, oval and round backing plates. Preserve exact two-by-two grid, one centered sprite per cell, transparent logo openings and bevelled thickness.

Walidacja: trzy testy ArtDirection i typecheck przeszły. VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN.
