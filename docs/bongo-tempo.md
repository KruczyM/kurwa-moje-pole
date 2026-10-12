# Walka o tasiorowe bongo

Movement and simulation now run at five steps per second (0.2 seconds per step), down from approximately seven. Falling objects and patrols retain their relationship to player movement. Deadline calculations still count active seconds, and authored route budgets are calculated from the shared simulation interval.

The public title is updated in the standalone game, main menu and guide. The existing URL and saved progress keys remain compatible. The menu heading is smaller to fit the longer title on phones.

Validation: 240 Bongo tests passed, production build passed and targeted ESLint passed. A regression test checks one second of corridor movement and the deadline; entry tests check the public name.

`VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`: phone layout and subjective movement comfort require browser verification; localhost access remains blocked by the saved browser permission.
