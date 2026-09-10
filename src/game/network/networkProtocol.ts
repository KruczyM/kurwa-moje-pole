export const PROTOCOL_VERSION = '1.0.0';

export const CANONICAL_CHARACTERS = [
  'Amper',
  'Antena',
  'Gruczoł',
  'Klątwa',
  'Krwiak',
  'Pień',
  'Pierścień',
  'Zawór',
] as const;

export type CharacterName = (typeof CANONICAL_CHARACTERS)[number];

export function isCharacterName(value: unknown): value is CharacterName {
  return typeof value === 'string' && (CANONICAL_CHARACTERS as readonly string[]).includes(value);
}

export type SlotStatus = 'free' | 'reserving' | 'occupied';

export interface CharacterSlot {
  character: CharacterName;
  status: SlotStatus;
  playerId?: string;
  sessionToken?: string;
  nickname?: string;
  expiresAt?: number;
}

export interface RoomState {
  roomId: string;
  protocolVersion: string;
  slots: Record<CharacterName, CharacterSlot>;
  playerCount: number;
}

export interface JoinRoomPayload {
  roomId?: string;
  sessionToken?: string;
}

export interface ReserveCharacterPayload {
  character: CharacterName;
  nickname: string;
  sessionToken?: string;
}

export interface ConfirmCharacterPayload {
  character: CharacterName;
  sessionToken?: string;
}

export interface ReleaseCharacterPayload {
  character: CharacterName;
  sessionToken?: string;
}

export interface NetworkErrorPayload {
  code:
    | 'INVALID_PROTOCOL'
    | 'ROOM_FULL'
    | 'CHARACTER_NOT_FOUND'
    | 'CHARACTER_OCCUPIED'
    | 'CHARACTER_RESERVING'
    | 'INVALID_NICKNAME'
    | 'UNAUTHORIZED'
    | 'TIMEOUT';
  message: string;
}

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 18;
export const RESERVATION_TIMEOUT_MS = 15_000;
export const RECONNECT_GRACE_PERIOD_MS = 30_000;

export interface NicknameValidationResult {
  valid: boolean;
  sanitized: string;
  error?: string;
}

/**
 * Waliduje i sanityzuje pseudonim gracza.
 * Wymagania:
 * - Długość od 2 do 18 znaków
 * - Brak tagów HTML i znaków sterujących
 * - Nie może składać się wyłącznie z białych znaków
 * - Dozwolone litery (w tym polskie znaki), cyfry, spacje, myślniki i podkreślenia
 */
export function validateAndSanitizeNickname(input: unknown): NicknameValidationResult {
  if (typeof input !== 'string') {
    return { valid: false, sanitized: '', error: 'Pseudonim musi być ciągiem znaków.' };
  }

  // Usuwanie potencjalnych tagów HTML, znaków sterujących oraz znaków specjalnych:
  const stripped = input
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    .replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ _-]/g, '')
    .trim();

  if (stripped.length < NICKNAME_MIN_LENGTH) {
    return {
      valid: false,
      sanitized: stripped,
      error: `Pseudonim musi mieć co najmniej ${NICKNAME_MIN_LENGTH} znaki.`,
    };
  }

  if (stripped.length > NICKNAME_MAX_LENGTH) {
    return {
      valid: false,
      sanitized: stripped.slice(0, NICKNAME_MAX_LENGTH),
      error: `Pseudonim nie może przekraczać ${NICKNAME_MAX_LENGTH} znaków.`,
    };
  }

  return { valid: true, sanitized: stripped };
}
