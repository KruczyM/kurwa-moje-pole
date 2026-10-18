# Bongo Rush: mobile menu and viewport

Branch: `fix/bongo-mobile-menu`.

The canvas is positioned absolutely within the board so its backing-store dimensions cannot influence the grid layout. Starting a selected level refreshes the viewport after closing the menu. Each existing animation frame restores the canvas transform using its actual backing-store dimensions.

The game toolbar, HUD, overlays, buttons and footer use square festival frames and hard pixel shadows. Touch movement is on the right; restart is on the left.

Validation: 239 Bongo Rush tests passed, production build passed, targeted ESLint and git diff whitespace checks passed. Independent static review found no blocking issues. The lifecycle regression test covers repeated renderer resize, terrain cache reuse, clipping and disposal; it does not reproduce browser layout.

Runtime status: `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`. Browser access to localhost is blocked by the saved browser permission. On a phone, start a level, reopen level selection, choose the same level and start it again; verify full board rendering, touch movement, restart and portrait/landscape layout.
