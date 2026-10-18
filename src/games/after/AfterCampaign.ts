import type { CharacterName } from '../../game/network/networkProtocol';
import { createPilotMap } from './data/pilotMap';
import { PILOT_DIALOGUES, PILOT_DIALOGUE_FLAGS } from './data/pilotDialogues';
import { PILOT_CHARACTERS, PILOT_FINALE, PILOT_QUESTS } from './data/pilotStory';
import { AfterSimulation } from './simulation/AfterSimulation';
import type { InteractionCommand, PlayerInput, WorldEvent } from './simulation/WorldState';
import { QuestEngine } from './story/QuestEngine';
import { DialogueEngine } from './story/DialogueEngine';
import type { DialogueChoiceCommand } from './story/DialogueTypes';

/** Pilot session facade: one movement simulation and one shared quest owner for solo/co-op slots. */
export class AfterCampaign {
  private readonly simulation: AfterSimulation;
  private readonly quests: QuestEngine;
  private readonly dialogues: DialogueEngine;
  private finished = false;
  private paused = false;

  /** Wires story prerequisites into the existing interaction mechanism instead of adding another controller. */
  constructor(sessionId = 'after-pilot', seed = 1) {
    const map = createPilotMap();
    this.quests = new QuestEngine(map, PILOT_QUESTS, PILOT_FINALE);
    this.dialogues = new DialogueEngine(sessionId, PILOT_DIALOGUES, {
      targetIds: map.interactions.map((target) => target.id),
      questIds: PILOT_QUESTS.map((quest) => quest.id),
      flagIds: [...map.interactions.map((target) => `interaction:${target.id}`), ...PILOT_DIALOGUE_FLAGS],
    });
    this.simulation = new AfterSimulation(
      map,
      sessionId,
      seed,
      (targetId, flags) => !this.finished && this.quests.canInteract(targetId, flags),
    );
  }

  /** Restricts the first content slice to the two authored pilot heroes. */
  addPlayer(slotId: string, characterId: CharacterName): void {
    if (this.finished) throw new Error('After campaign already finished');
    if (!PILOT_CHARACTERS.some((id) => id === characterId))
      throw new Error('After pilot character unavailable');
    this.simulation.addPlayer(slotId, characterId);
  }

  /** Forwards sanitized movement input; a completed campaign no longer accepts movement. */
  setInput(slotId: string, input: PlayerInput): void {
    if (!this.finished && !this.dialogues.isActive(slotId)) this.simulation.setInput(slotId, input);
  }

  /** Supplies host elapsed time to the single fixed-tick simulation. */
  advance(elapsedSeconds: number): number {
    return this.simulation.advance(elapsedSeconds);
  }

  /** Pauses only this offline session, never a shared festival/server loop. */
  setPaused(paused: boolean): void {
    this.paused = paused || this.finished;
    this.simulation.setPaused(this.paused);
  }

  /** Exposes the same legal story-aware target used by command validation. */
  prompt(slotId: string) {
    if (this.paused || this.dialogues.isActive(slotId)) return;
    return this.simulation.prompt(slotId);
  }

  /** Commits a legal interaction before calculating shared quest rewards and the return finale. */
  interact(command: InteractionCommand): WorldEvent | undefined {
    if (this.dialogues.isActive(command.slotId)) return;
    const event = this.simulation.interact(command);
    if (!event) return;
    const flags = this.simulation.snapshot().flags;
    this.quests.update(flags);
    if (this.dialogues.hasTarget(event.targetId)) {
      this.simulation.setInput(event.slotId, { moveX: 0, moveY: 0, sprint: false });
      this.dialogues.begin(event.slotId, event.targetId, this.dialogueContext());
    }
    if (this.quests.snapshot().completedQuestIds.length === PILOT_QUESTS.length)
      this.simulation.approachDawn();
    if (event.targetId === 'camp-return' && this.quests.canFinish([...flags, 'interaction:camp-return'])) {
      this.finished = true;
      this.dialogues.closeAll();
      this.setPaused(true);
    }
    return event;
  }

  /** Returns isolated world/story state; callers cannot grant themselves progress or unlock targets. */
  snapshot() {
    return {
      world: this.simulation.snapshot(),
      story: this.quests.snapshot(),
      social: this.dialogues.snapshot(),
      finished: this.finished,
    };
  }

  /** Builds read-only conditions from session-owned flags and quest progress. */
  private dialogueContext() {
    return {
      flags: this.simulation.snapshot().flags,
      completedQuestIds: this.quests.snapshot().completedQuestIds,
    };
  }

  /** Reads a slot's dialogue; a future network adapter must authenticate slot ownership separately. */
  dialogue(slotId: string) {
    return this.dialogues.view(slotId, this.dialogueContext());
  }

  /** Accepts only fresh owner choices while this local campaign is running. */
  chooseDialogue(command: DialogueChoiceCommand) {
    if (this.paused || this.finished) return;
    return this.dialogues.choose(command, this.dialogueContext());
  }

  /** Escape/back cancels a conversation only; it does not open pause or apply rewards. */
  closeDialogue(slotId: string): boolean {
    return this.dialogues.close(slotId);
  }

  /** Retrieves the last hint for a journal without replaying dialogue effects. */
  repeatHint(slotId: string) {
    return this.dialogues.repeatHint(slotId);
  }
}
