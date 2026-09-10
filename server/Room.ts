import {
  CANONICAL_CHARACTERS,
  type CharacterName,
  type CharacterSlot,
  type RoomState,
  PROTOCOL_VERSION,
  RESERVATION_TIMEOUT_MS,
  RECONNECT_GRACE_PERIOD_MS,
  validateAndSanitizeNickname,
  isCharacterName,
} from '../src/game/network/networkProtocol.js';

export interface RoomOptions {
  roomId: string;
  reservationTimeoutMs?: number;
  gracePeriodMs?: number;
  onSlotChanged?: (character: CharacterName, slot: CharacterSlot) => void;
}

export class Room {
  readonly roomId: string;
  private readonly reservationTimeoutMs: number;
  private readonly gracePeriodMs: number;
  private readonly onSlotChanged?: (character: CharacterName, slot: CharacterSlot) => void;

  private slots: Record<CharacterName, CharacterSlot>;
  private disconnectTimers = new Map<CharacterName, NodeJS.Timeout>();
  private reservationTimers = new Map<CharacterName, NodeJS.Timeout>();

  constructor(options: RoomOptions) {
    this.roomId = options.roomId;
    this.reservationTimeoutMs = options.reservationTimeoutMs ?? RESERVATION_TIMEOUT_MS;
    this.gracePeriodMs = options.gracePeriodMs ?? RECONNECT_GRACE_PERIOD_MS;
    this.onSlotChanged = options.onSlotChanged;

    this.slots = CANONICAL_CHARACTERS.reduce(
      (acc, name) => {
        acc[name] = { character: name, status: 'free' };
        return acc;
      },
      {} as Record<CharacterName, CharacterSlot>,
    );
  }

  getPublicState(): RoomState {
    const publicSlots = {} as Record<CharacterName, CharacterSlot>;
    let count = 0;
    for (const name of CANONICAL_CHARACTERS) {
      const slot = this.slots[name];
      publicSlots[name] = {
        character: slot.character,
        status: slot.status,
        playerId: slot.playerId,
        nickname: slot.nickname,
        expiresAt: slot.expiresAt,
      };
      if (slot.status !== 'free') count++;
    }

    return {
      roomId: this.roomId,
      protocolVersion: PROTOCOL_VERSION,
      slots: publicSlots,
      playerCount: count,
    };
  }

  getSlot(character: CharacterName): CharacterSlot | undefined {
    return this.slots[character];
  }

  findSlotByPlayerId(playerId: string): CharacterSlot | undefined {
    return Object.values(this.slots).find((slot) => slot.playerId === playerId);
  }

  findSlotBySessionToken(sessionToken: string): CharacterSlot | undefined {
    return Object.values(this.slots).find((slot) => slot.sessionToken === sessionToken);
  }

  reserve(
    playerId: string,
    character: unknown,
    nickname: unknown,
    sessionToken: string,
  ): { success: boolean; error?: string; slot?: CharacterSlot } {
    if (!isCharacterName(character)) {
      return { success: false, error: 'Nieprawidłowa nazwa postaci.' };
    }

    const validation = validateAndSanitizeNickname(nickname);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const currentSlot = this.slots[character];

    // Sprawdzenie, czy ten gracz posiada już inny slot w tym pokoju:
    const existingPlayerSlot = this.findSlotByPlayerId(playerId);
    if (existingPlayerSlot && existingPlayerSlot.character !== character) {
      this.freeSlot(existingPlayerSlot.character);
    }

    // Sprawdzenie dostępności żądanego slotu:
    if (currentSlot.status !== 'free') {
      // Jeśli to ten sam gracz, pozwalamy na ponowną rezerwację/odświeżenie
      if (currentSlot.playerId === playerId || currentSlot.sessionToken === sessionToken) {
        currentSlot.nickname = validation.sanitized;
        currentSlot.playerId = playerId;
        currentSlot.sessionToken = sessionToken;
        this.scheduleReservationTimeout(character);
        this.onSlotChanged?.(character, currentSlot);
        return { success: true, slot: currentSlot };
      }
      return {
        success: false,
        error: currentSlot.status === 'occupied' ? 'Postać jest już zajęta.' : 'Postać jest właśnie rezerwowana.',
      };
    }

    // Atomowa rezerwacja slotu:
    currentSlot.status = 'reserving';
    currentSlot.playerId = playerId;
    currentSlot.sessionToken = sessionToken;
    currentSlot.nickname = validation.sanitized;
    currentSlot.expiresAt = Date.now() + this.reservationTimeoutMs;

    this.scheduleReservationTimeout(character);
    this.onSlotChanged?.(character, currentSlot);

    return { success: true, slot: currentSlot };
  }

  confirm(
    playerId: string,
    character: unknown,
    sessionToken: string,
  ): { success: boolean; error?: string; slot?: CharacterSlot } {
    if (!isCharacterName(character)) {
      return { success: false, error: 'Nieprawidłowa nazwa postaci.' };
    }

    const currentSlot = this.slots[character];
    if (!currentSlot || currentSlot.status === 'free') {
      return { success: false, error: 'Postać nie została wcześniej zarezerwowana.' };
    }

    if (currentSlot.playerId !== playerId && currentSlot.sessionToken !== sessionToken) {
      return { success: false, error: 'Brak uprawnień do potwierdzenia tej postaci.' };
    }

    this.clearReservationTimeout(character);
    this.clearDisconnectTimer(character);

    currentSlot.status = 'occupied';
    currentSlot.expiresAt = undefined;
    currentSlot.playerId = playerId;
    currentSlot.sessionToken = sessionToken;

    this.onSlotChanged?.(character, currentSlot);
    return { success: true, slot: currentSlot };
  }

  release(
    playerId: string,
    character: unknown,
    sessionToken?: string,
  ): { success: boolean; error?: string } {
    if (!isCharacterName(character)) {
      return { success: false, error: 'Nieprawidłowa nazwa postaci.' };
    }

    const currentSlot = this.slots[character];
    if (
      currentSlot &&
      (currentSlot.playerId === playerId || (sessionToken && currentSlot.sessionToken === sessionToken))
    ) {
      this.freeSlot(character);
      return { success: true };
    }

    return { success: false, error: 'Nie jesteś właścicielem tej postaci.' };
  }

  handleDisconnect(playerId: string): CharacterName | undefined {
    const slot = this.findSlotByPlayerId(playerId);
    if (!slot) return undefined;

    const charName = slot.character;

    if (slot.status === 'reserving') {
      // Jeśli gracz był w trakcie rezerwacji i się rozłączył, natychmiast zwalniamy slot:
      this.freeSlot(charName);
      return charName;
    }

    if (slot.status === 'occupied') {
      // Grace period na ponowne połączenie:
      slot.playerId = undefined;
      this.clearDisconnectTimer(charName);

      const timer = setTimeout(() => {
        this.freeSlot(charName);
      }, this.gracePeriodMs);

      this.disconnectTimers.set(charName, timer);
      return charName;
    }

    return undefined;
  }

  handleReconnect(sessionToken: string, newPlayerId: string): { restored: boolean; character?: CharacterName; nickname?: string } {
    const slot = this.findSlotBySessionToken(sessionToken);
    if (!slot || slot.status !== 'occupied') {
      return { restored: false };
    }

    const charName = slot.character;
    this.clearDisconnectTimer(charName);
    slot.playerId = newPlayerId;

    this.onSlotChanged?.(charName, slot);
    return { restored: true, character: charName, nickname: slot.nickname };
  }

  private freeSlot(character: CharacterName): void {
    this.clearReservationTimeout(character);
    this.clearDisconnectTimer(character);

    this.slots[character] = {
      character,
      status: 'free',
    };

    this.onSlotChanged?.(character, this.slots[character]);
  }

  private scheduleReservationTimeout(character: CharacterName): void {
    this.clearReservationTimeout(character);
    const timer = setTimeout(() => {
      const slot = this.slots[character];
      if (slot && slot.status === 'reserving') {
        this.freeSlot(character);
      }
    }, this.reservationTimeoutMs);

    this.reservationTimers.set(character, timer);
  }

  private clearReservationTimeout(character: CharacterName): void {
    const timer = this.reservationTimers.get(character);
    if (timer) {
      clearTimeout(timer);
      this.reservationTimers.delete(character);
    }
  }

  private clearDisconnectTimer(character: CharacterName): void {
    const timer = this.disconnectTimers.get(character);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(character);
    }
  }

  dispose(): void {
    for (const timer of this.reservationTimers.values()) clearTimeout(timer);
    for (const timer of this.disconnectTimers.values()) clearTimeout(timer);
    this.reservationTimers.clear();
    this.disconnectTimers.clear();
  }
}

