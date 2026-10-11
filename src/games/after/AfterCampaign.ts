import type { CharacterName } from '../../game/network/networkProtocol';
import { createPilotMap } from './data/pilotMap';
import { PILOT_CHARACTERS, PILOT_FINALE, PILOT_QUESTS } from './data/pilotStory';
import { AfterSimulation } from './simulation/AfterSimulation';
import type { InteractionCommand, PlayerInput, WorldEvent } from './simulation/WorldState';
import { QuestEngine } from './story/QuestEngine';

/** Pilot session facade: one movement simulation and one shared quest owner for solo/co-op slots. */
export class AfterCampaign {
  private readonly simulation: AfterSimulation;
  private readonly quests: QuestEngine;
  private finished = false;

  /** Wires story prerequisites into the existing interaction mechanism instead of adding another controller. */
  constructor(sessionId = 'after-pilot', seed = 1) {
    const map = createPilotMap();
    this.quests = new QuestEngine(map, PILOT_QUESTS, PILOT_FINALE);
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
    if (!this.finished) this.simulation.setInput(slotId, input);
  }

  /** Supplies host elapsed time to the single fixed-tick simulation. */
  advance(elapsedSeconds: number): number {
    return this.simulation.advance(elapsedSeconds);
  }

  /** Pauses only this offline session, never a shared festival/server loop. */
  setPaused(paused: boolean): void {
    this.simulation.setPaused(paused || this.finished);
  }

  /** Exposes the same legal story-aware target used by command validation. */
  prompt(slotId: string) {
    return this.simulation.prompt(slotId);
  }

  /** Commits a legal interaction before calculating shared quest rewards and the return finale. */
  interact(command: InteractionCommand): WorldEvent | undefined {
    const event = this.simulation.interact(command);
    if (!event) return;
    const flags = this.simulation.snapshot().flags;
    this.quests.update(flags);
    if (this.quests.snapshot().completedQuestIds.length === PILOT_QUESTS.length)
      this.simulation.approachDawn();
    if (event.targetId === 'camp-return' && this.quests.canFinish([...flags, 'interaction:camp-return'])) {
      this.finished = true;
      this.simulation.setPaused(true);
    }
    return event;
  }

  /** Returns isolated world/story state; callers cannot grant themselves progress or unlock targets. */
  snapshot() {
    return { world: this.simulation.snapshot(), story: this.quests.snapshot(), finished: this.finished };
  }
}
