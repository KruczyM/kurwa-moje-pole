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

export type LocomotionState = 'Idle' | 'Walk' | 'Run';

export interface PlayerTransform {
  position: [x: number, y: number, z: number];
  yaw: number;
  pitch?: number;
  locomotion: LocomotionState;
  speed: number;
  timestamp: number;
}

export interface PlayerSnapshot {
  playerId: string;
  character: CharacterName;
  nickname: string;
  transform: PlayerTransform;
}

export interface WorldSnapshotPayload {
  timestamp: number;
  players: PlayerSnapshot[];
}

export const MAP_POSITION_LIMIT = 60.0;
export const MAX_ALLOWED_PLAYER_SPEED = 25.0; // m/s (sanity check limit)

/**
 * Waliduje dane ruchu i pozycji gracza w celu ochrony przed błędnymi danymi (NaN/Infinity) i teleportami poza mapę.
 */
export function validatePlayerTransform(input: unknown): {
  valid: boolean;
  transform?: PlayerTransform;
  error?: string;
} {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Nieprawidłowy obiekt transformacji.' };
  }

  const raw = input as Partial<PlayerTransform>;

  if (
    !Array.isArray(raw.position) ||
    raw.position.length !== 3 ||
    !raw.position.every((coord) => typeof coord === 'number' && Number.isFinite(coord))
  ) {
    return { valid: false, error: 'Pozycja musi zawierać 3 skończone liczby [x, y, z].' };
  }

  const [x, y, z] = raw.position;
  if (Math.abs(x) > MAP_POSITION_LIMIT || Math.abs(z) > MAP_POSITION_LIMIT || y < -10 || y > 30) {
    return { valid: false, error: 'Pozycja gracza wykracza poza dozwolone granice świata.' };
  }

  if (typeof raw.yaw !== 'number' || !Number.isFinite(raw.yaw)) {
    return { valid: false, error: 'Kąt obrotu yaw musi być skończoną liczbą.' };
  }

  const validLocomotion: LocomotionState[] = ['Idle', 'Walk', 'Run'];
  const locomotion: LocomotionState = validLocomotion.includes(raw.locomotion as LocomotionState)
    ? (raw.locomotion as LocomotionState)
    : 'Idle';

  const speed =
    typeof raw.speed === 'number' && Number.isFinite(raw.speed)
      ? Math.max(0, Math.min(raw.speed, MAX_ALLOWED_PLAYER_SPEED))
      : 0;

  const timestamp =
    typeof raw.timestamp === 'number' && Number.isFinite(raw.timestamp) ? raw.timestamp : Date.now();

  return {
    valid: true,
    transform: {
      position: [x, y, z],
      yaw: raw.yaw,
      pitch: typeof raw.pitch === 'number' && Number.isFinite(raw.pitch) ? raw.pitch : 0,
      locomotion,
      speed,
      timestamp,
    },
  };
}
