/**
 * ConcertLibrary — Biblioteka koncertów KręciołaTV (G1 / E1)
 *
 * Zarządza manifestem lokalnych nagrań koncertowych, walidacją formatów,
 * synchronizacją czasu odtwarzania i bezpiecznym fallbackiem przy braku plików na dysku.
 * Zgodne z wytycznymi prawnymi E0 z docs/attractions-plan.md:
 * - brak sekretnych tokenów,
 * - brak nieautoryzowanego pobierania / obchodzenia DRM,
 * - jawny podział na 'local_file' oraz 'pending_permission'.
 */

export type TrackSourceType = 'local_file' | 'pending_permission';

export type SupportedAudioExtension = 'mp3' | 'ogg' | 'wav';

export interface ConcertTrack {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly year: number;
  readonly durationSeconds: number;
  readonly localAudioPath: string;
  readonly sourceType: TrackSourceType;
  readonly licenseNotes: string;
}

export interface ValidationIssue {
  readonly trackId: string;
  readonly field: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface ManifestValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationIssue[];
  readonly warnings: readonly ValidationIssue[];
}

export interface ConcertLibraryOptions {
  /** Inicjalny zestaw utworów manifestu */
  readonly initialTracks?: readonly ConcertTrack[];
  /** Opcjonalna funkcja sprawdzająca fizyczną obecność pliku na dysku/serwerze */
  readonly fileExists?: (path: string) => boolean;
  /** Identyfikator bezpiecznego utworu awaryjnego (domyślnie 'fallback_test_riff') */
  readonly fallbackTrackId?: string;
}

export const SUPPORTED_AUDIO_EXTENSIONS: readonly SupportedAudioExtension[] = ['mp3', 'ogg', 'wav'];

/**
 * Domyślny manifest koncertowy:
 * Zawiera lokalny syntetyczny sygnał testowy ('local_file') oraz wpisy utworów z KręciołaTV
 * oznaczone jako 'pending_permission' do czasu uzyskania autoryzacji (zgodnie z E0).
 */
export const DEFAULT_CONCERT_MANIFEST: readonly ConcertTrack[] = [
  {
    id: 'fallback_test_riff',
    title: 'Rozgrzewka Dużej Sceny (Test Riff)',
    artist: "Pol'and'Rock Soundcheck",
    year: 2026,
    durationSeconds: 120,
    localAudioPath: '/audio/concerts/fallback_test_riff.mp3',
    sourceType: 'local_file',
    licenseNotes: 'Lokalny sygnał testowy audio stworzony do kalibracji nagłośnienia i akustyki.',
  },
  {
    id: 'kreciolatv_woodstock_anthem',
    title: "Hymn Pol'and'Rock (Live Duża Scena)",
    artist: 'KręciołaTV Official',
    year: 2023,
    durationSeconds: 245,
    localAudioPath: '/audio/concerts/kreciolatv_woodstock_anthem.mp3',
    sourceType: 'pending_permission',
    licenseNotes: 'Archiwum KręciołaTV. Oczekuje na formalną licencję WOŚP/Złoty Melon zgodnie z E0.',
  },
  {
    id: 'kreciolatv_nocny_kochanek',
    title: 'Zdrajcy Metalu (Live)',
    artist: 'Nocny Kochanek',
    year: 2018,
    durationSeconds: 310,
    localAudioPath: '/audio/concerts/kreciolatv_nocny_kochanek.ogg',
    sourceType: 'pending_permission',
    licenseNotes: 'Rejestracja koncertu KręciołaTV. Status: oczekuje na potwierdzenie praw autorskich.',
  },
  {
    id: 'kreciolatv_hunter_kiedy_umieram',
    title: 'Kiedy Umieram (Live Duża Scena)',
    artist: 'Hunter',
    year: 2019,
    durationSeconds: 420,
    localAudioPath: '/audio/concerts/kreciolatv_hunter_kiedy_umieram.wav',
    sourceType: 'pending_permission',
    licenseNotes: 'Rejestracja koncertu KręciołaTV. Status: oczekuje na autoryzację zespołu.',
  },
];

/**
 * Sprawdza, czy ścieżka pliku audio kończy się dozwolonym rozszerzeniem (.mp3, .ogg, .wav).
 */
export function isSupportedAudioExtension(path: string): boolean {
  if (!path || typeof path !== 'string') return false;
  const match = path.toLowerCase().match(/\.([a-z0-9]+)(?:[?#].*)?$/);
  if (!match) return false;
  return SUPPORTED_AUDIO_EXTENSIONS.includes(match[1] as SupportedAudioExtension);
}

/**
 * Wyodrębnia rozszerzenie pliku ze ścieżki.
 */
export function getAudioFileExtension(path: string): SupportedAudioExtension | null {
  if (!path || typeof path !== 'string') return null;
  const match = path.toLowerCase().match(/\.([a-z0-9]+)(?:[?#].*)?$/);
  if (!match) return null;
  const ext = match[1] as SupportedAudioExtension;
  return SUPPORTED_AUDIO_EXTENSIONS.includes(ext) ? ext : null;
}

/**
 * Formatuje czas trwania w sekundach do czytelnego formatu "M:SS" lub "H:MM:SS".
 * Zabezpieczone przed wartościami ujemnymi, NaN i nieskończonością.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }
  const totalSec = Math.floor(seconds);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const remainingSec = totalSec % 60;

  const paddedSec = remainingSec.toString().padStart(2, '0');

  if (hours > 0) {
    const paddedMin = minutes.toString().padStart(2, '0');
    return `${hours}:${paddedMin}:${paddedSec}`;
  }

  return `${minutes}:${paddedSec}`;
}

/**
 * Oblicza bieżący czas odtwarzania utworu z uwzględnieniem zapętlenia.
 * Wszystkie kalkulacje są ściśle deterministyczne.
 *
 * @param track Obiekt utworu koncertowego
 * @param startedAtTimestampMs Znacznik czasu rozpoczęcia odtwarzania (w milisekundach)
 * @param isPlaying Czy odtwarzacz jest w stanie grania
 * @param currentTimestampMs Aktualny czas (domyślnie Date.now() jeśli w środowisku uruchomieniowym)
 * @returns Liczba sekund w zakresie [0, track.durationSeconds)
 */
export function getCurrentPlaybackTime(
  track: ConcertTrack,
  startedAtTimestampMs: number,
  isPlaying: boolean,
  currentTimestampMs: number = Date.now(),
): number {
  if (!isPlaying || !track || track.durationSeconds <= 0) {
    return 0;
  }
  if (!Number.isFinite(startedAtTimestampMs) || !Number.isFinite(currentTimestampMs)) {
    return 0;
  }
  if (currentTimestampMs < startedAtTimestampMs) {
    return 0;
  }

  const elapsedSeconds = (currentTimestampMs - startedAtTimestampMs) / 1000;
  if (elapsedSeconds < 0) return 0;

  return elapsedSeconds % track.durationSeconds;
}

/**
 * Sprawdza pojedynczy utwór pod kątem poprawności danych.
 */
export function validateConcertTrack(
  track: ConcertTrack,
  options?: {
    existingIds?: ReadonlySet<string>;
    existingPaths?: ReadonlySet<string>;
    fileExists?: (path: string) => boolean;
  },
): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const trackId = track?.id || 'unknown';

  if (!track || typeof track !== 'object') {
    errors.push({
      trackId: 'unknown',
      field: 'root',
      message: 'Wpis utworu musi być obiektem',
      severity: 'error',
    });
    return { errors, warnings };
  }

  if (!track.id || typeof track.id !== 'string' || track.id.trim() === '') {
    errors.push({ trackId, field: 'id', message: 'ID utworu nie może być puste', severity: 'error' });
  } else if (options?.existingIds && options.existingIds.has(track.id)) {
    errors.push({
      trackId,
      field: 'id',
      message: `Zduplikowane ID utworu: "${track.id}"`,
      severity: 'error',
    });
  }

  if (!track.title || typeof track.title !== 'string' || track.title.trim() === '') {
    errors.push({ trackId, field: 'title', message: 'Tytuł utworu nie może być pusty', severity: 'error' });
  }

  if (!track.artist || typeof track.artist !== 'string' || track.artist.trim() === '') {
    errors.push({
      trackId,
      field: 'artist',
      message: 'Artysta/wykonawca nie może być pusty',
      severity: 'error',
    });
  }

  if (!Number.isFinite(track.durationSeconds) || track.durationSeconds <= 0) {
    errors.push({
      trackId,
      field: 'durationSeconds',
      message: 'Długość utworu musi być dodatnią liczbą sekund',
      severity: 'error',
    });
  }

  if (!Number.isInteger(track.year) || track.year < 1969 || track.year > 2100) {
    errors.push({
      trackId,
      field: 'year',
      message: `Niepoprawny rok utworu: ${track.year}`,
      severity: 'error',
    });
  }

  if (
    !track.localAudioPath ||
    typeof track.localAudioPath !== 'string' ||
    track.localAudioPath.trim() === ''
  ) {
    errors.push({
      trackId,
      field: 'localAudioPath',
      message: 'Ścieżka do pliku audio nie może być pusta',
      severity: 'error',
    });
  } else {
    if (!isSupportedAudioExtension(track.localAudioPath)) {
      errors.push({
        trackId,
        field: 'localAudioPath',
        message: `Nieobsługiwany format pliku audio. Dozwolone: ${SUPPORTED_AUDIO_EXTENSIONS.join(', ')}`,
        severity: 'error',
      });
    }
    if (options?.existingPaths && options.existingPaths.has(track.localAudioPath)) {
      errors.push({
        trackId,
        field: 'localAudioPath',
        message: `Zduplikowana ścieżka pliku audio: "${track.localAudioPath}"`,
        severity: 'error',
      });
    }
    if (
      track.sourceType === 'local_file' &&
      options?.fileExists &&
      !options.fileExists(track.localAudioPath)
    ) {
      warnings.push({
        trackId,
        field: 'localAudioPath',
        message: `Plik lokalny nie został odnaleziony na dysku: "${track.localAudioPath}"`,
        severity: 'warning',
      });
    }
  }

  if (track.sourceType !== 'local_file' && track.sourceType !== 'pending_permission') {
    errors.push({
      trackId,
      field: 'sourceType',
      message: `Niepoprawny typ źródła: "${track.sourceType}". Wymagane: 'local_file' | 'pending_permission'`,
      severity: 'error',
    });
  }

  if (!track.licenseNotes || typeof track.licenseNotes !== 'string' || track.licenseNotes.trim() === '') {
    warnings.push({
      trackId,
      field: 'licenseNotes',
      message: 'Brak adnotacji licencyjnej dla nagrania',
      severity: 'warning',
    });
  }

  return { errors, warnings };
}

/**
 * Główna biblioteka utworów koncertowych z obsługą walidacji, fallbacków i synchronizacji.
 */
export class ConcertLibrary {
  private readonly tracks = new Map<string, ConcertTrack>();
  private readonly fileExistsChecker: (path: string) => boolean;
  private readonly fallbackTrackId: string;

  constructor(options: ConcertLibraryOptions = {}) {
    this.fileExistsChecker = options.fileExists ?? (() => true);
    this.fallbackTrackId = options.fallbackTrackId ?? 'fallback_test_riff';

    const initial = options.initialTracks ?? DEFAULT_CONCERT_MANIFEST;
    for (const track of initial) {
      this.addTrack(track);
    }
  }

  /**
   * Zwraca wszystkie zarejestrowane utwory w bibliotece.
   */
  getAllTracks(): readonly ConcertTrack[] {
    return Array.from(this.tracks.values());
  }

  /**
   * Pobiera utwór po unikalnym identyfikatorze ID.
   */
  getTrack(id: string): ConcertTrack | undefined {
    return this.tracks.get(id);
  }

  /**
   * Sprawdza, czy utwór o danym ID istnieje w bibliotece.
   */
  hasTrack(id: string): boolean {
    return this.tracks.has(id);
  }

  /**
   * Pobiera utwór awaryjny (fallback) na wypadek brakującego lub niedozwolonego pliku.
   */
  getFallbackTrack(): ConcertTrack | undefined {
    const fallback = this.tracks.get(this.fallbackTrackId);
    if (fallback) return fallback;
    // Jeśli zdefiniowany fallback nie istnieje, bierzemy pierwszy 'local_file'
    for (const track of this.tracks.values()) {
      if (track.sourceType === 'local_file') return track;
    }
    return undefined;
  }

  /**
   * Zwraca listę utworów bezpośrednio zdatnych do odtworzenia:
   * tylko 'local_file', z poprawnym rozszerzeniem i obecnym plikiem na dysku.
   */
  getPlayableTracks(): readonly ConcertTrack[] {
    return Array.from(this.tracks.values()).filter((track) => {
      if (track.sourceType !== 'local_file') return false;
      if (!isSupportedAudioExtension(track.localAudioPath)) return false;
      return this.fileExistsChecker(track.localAudioPath);
    });
  }

  /**
   * Rozwiązuje ścieżkę do pliku audio dla danego utworu.
   * Jeżeli utwór ma status 'pending_permission' lub plik nie istnieje fizycznie,
   * bezpiecznie zwraca ścieżkę utworu fallback (bez crashowania gry).
   */
  resolvePlayableAudioPath(trackId: string): string | null {
    const track = this.getTrack(trackId);
    if (!track) {
      const fallback = this.getFallbackTrack();
      return fallback ? fallback.localAudioPath : null;
    }

    // Jeśli utwór czeka na pozwolenie prawne, nie wolno go odtwarzać jako lokalnego audio
    if (track.sourceType === 'pending_permission') {
      const fallback = this.getFallbackTrack();
      return fallback ? fallback.localAudioPath : null;
    }

    // Jeśli plik jest lokalny, sprawdzamy czy istnieje
    if (!this.fileExistsChecker(track.localAudioPath)) {
      const fallback = this.getFallbackTrack();
      return fallback ? fallback.localAudioPath : null;
    }

    return track.localAudioPath;
  }

  /**
   * Rejestruje nowy utwór w bibliotece.
   * Zwraca true jeśli utwór został pomyślnie zweryfikowany i dodany, false w razie błędu walidacji lub duplikatu.
   */
  addTrack(track: ConcertTrack): boolean {
    const existingIds = new Set(this.tracks.keys());
    const existingPaths = new Set(Array.from(this.tracks.values()).map((t) => t.localAudioPath));

    const { errors } = validateConcertTrack(track, {
      existingIds,
      existingPaths,
      fileExists: this.fileExistsChecker,
    });

    if (errors.length > 0) {
      return false;
    }

    this.tracks.set(track.id, { ...track });
    return true;
  }

  /**
   * Waliduje cały manifest pod kątem poprawności, spójności i braku duplikatów.
   */
  validateManifest(tracksToValidate?: readonly ConcertTrack[]): ManifestValidationResult {
    const list = tracksToValidate ?? this.getAllTracks();
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    const seenIds = new Set<string>();
    const seenPaths = new Set<string>();

    for (const track of list) {
      const result = validateConcertTrack(track, {
        existingIds: seenIds,
        existingPaths: seenPaths,
        fileExists: this.fileExistsChecker,
      });

      errors.push(...result.errors);
      warnings.push(...result.warnings);

      if (track?.id) seenIds.add(track.id);
      if (track?.localAudioPath) seenPaths.add(track.localAudioPath);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Oblicza zsynchronizowany czas odtwarzania utworu.
   */
  getCurrentPlaybackTime(
    trackOrId: ConcertTrack | string,
    startedAtTimestampMs: number,
    isPlaying: boolean,
    currentTimestampMs: number = Date.now(),
  ): number {
    const track = typeof trackOrId === 'string' ? this.getTrack(trackOrId) : trackOrId;
    if (!track) return 0;
    return getCurrentPlaybackTime(track, startedAtTimestampMs, isPlaying, currentTimestampMs);
  }

  /**
   * Formatuje sekundy do formatu "M:SS" lub "H:MM:SS".
   */
  formatDuration(seconds: number): string {
    return formatDuration(seconds);
  }
}
