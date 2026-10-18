import { describe, expect, it } from 'vitest';
import {
  ConcertLibrary,
  DEFAULT_CONCERT_MANIFEST,
  formatDuration,
  getCurrentPlaybackTime,
  isSupportedAudioExtension,
  validateConcertTrack,
  type ConcertTrack,
} from './ConcertLibrary';

describe('ConcertLibrary — G1 / E1 Biblioteka koncertów KręciołaTV', () => {
  describe('Format and extension validation', () => {
    it('accepts .mp3, .ogg, and .wav extensions case-insensitively', () => {
      expect(isSupportedAudioExtension('/audio/concerts/track1.mp3')).toBe(true);
      expect(isSupportedAudioExtension('/audio/concerts/track2.OGG')).toBe(true);
      expect(isSupportedAudioExtension('/audio/concerts/track3.wav')).toBe(true);
      expect(isSupportedAudioExtension('https://cdn.festival.local/track.mp3?query=1')).toBe(true);
    });

    it('rejects unsupported extensions and invalid paths', () => {
      expect(isSupportedAudioExtension('/audio/track.flac')).toBe(false);
      expect(isSupportedAudioExtension('/audio/track.m4a')).toBe(false);
      expect(isSupportedAudioExtension('/audio/track.exe')).toBe(false);
      expect(isSupportedAudioExtension('/audio/track')).toBe(false);
      expect(isSupportedAudioExtension('')).toBe(false);
    });
  });

  describe('formatDuration', () => {
    it('formats seconds into M:SS correctly', () => {
      expect(formatDuration(0)).toBe('0:00');
      expect(formatDuration(5)).toBe('0:05');
      expect(formatDuration(59)).toBe('0:59');
      expect(formatDuration(60)).toBe('1:00');
      expect(formatDuration(75)).toBe('1:15');
      expect(formatDuration(3599)).toBe('59:59');
    });

    it('formats hours into H:MM:SS correctly', () => {
      expect(formatDuration(3600)).toBe('1:00:00');
      expect(formatDuration(3665)).toBe('1:01:05');
      expect(formatDuration(7322)).toBe('2:02:02');
    });

    it('safely handles negative numbers, NaN, and infinity', () => {
      expect(formatDuration(-10)).toBe('0:00');
      expect(formatDuration(NaN)).toBe('0:00');
      expect(formatDuration(Infinity)).toBe('0:00');
      expect(formatDuration(-Infinity)).toBe('0:00');
    });
  });

  describe('getCurrentPlaybackTime', () => {
    const testTrack: ConcertTrack = {
      id: 'test_track',
      title: "Pol'and'Rock Jam",
      artist: 'Woodstock Stage Band',
      year: 2026,
      durationSeconds: 120,
      localAudioPath: '/audio/concerts/jam.mp3',
      sourceType: 'local_file',
      licenseNotes: 'Open test track',
    };

    it('returns 0 when not playing', () => {
      const now = 100000;
      const startedAt = 50000;
      expect(getCurrentPlaybackTime(testTrack, startedAt, false, now)).toBe(0);
    });

    it('calculates elapsed time accurately when playing', () => {
      const startedAt = 10000;
      const now = 35000; // 25 seconds later
      expect(getCurrentPlaybackTime(testTrack, startedAt, true, now)).toBe(25);
    });

    it('loops seamlessly when elapsed time exceeds track duration', () => {
      const startedAt = 10000;
      // 145 seconds later -> 145 % 120 = 25 seconds
      const now = startedAt + 145 * 1000;
      expect(getCurrentPlaybackTime(testTrack, startedAt, true, now)).toBe(25);

      // Exact multiple -> 0
      const exactLoop = startedAt + 240 * 1000;
      expect(getCurrentPlaybackTime(testTrack, exactLoop, true, exactLoop)).toBe(0);
    });

    it('safely handles current time before startedAt or invalid numbers', () => {
      const startedAt = 50000;
      const nowBefore = 40000;
      expect(getCurrentPlaybackTime(testTrack, startedAt, true, nowBefore)).toBe(0);
      expect(getCurrentPlaybackTime(testTrack, NaN, true, 50000)).toBe(0);
      expect(getCurrentPlaybackTime(testTrack, 50000, true, NaN)).toBe(0);
    });

    it('handles zero or negative track duration gracefully', () => {
      const invalidTrack = { ...testTrack, durationSeconds: 0 };
      expect(getCurrentPlaybackTime(invalidTrack, 10000, true, 20000)).toBe(0);
    });
  });

  describe('Track and manifest validation', () => {
    it('validates default manifest with zero errors', () => {
      const library = new ConcertLibrary();
      const validation = library.validateManifest();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('detects missing required fields in tracks', () => {
      const incompleteTrack = {
        id: '',
        title: '',
        artist: '',
        year: 1800,
        durationSeconds: -5,
        localAudioPath: 'badfile.flac',
        sourceType: 'unauthorized_rip' as unknown as 'local_file',
        licenseNotes: '',
      };

      const result = validateConcertTrack(incompleteTrack);
      expect(result.errors.length).toBeGreaterThanOrEqual(6);
      expect(result.errors.some((e) => e.field === 'id')).toBe(true);
      expect(result.errors.some((e) => e.field === 'title')).toBe(true);
      expect(result.errors.some((e) => e.field === 'durationSeconds')).toBe(true);
      expect(result.errors.some((e) => e.field === 'localAudioPath')).toBe(true);
      expect(result.errors.some((e) => e.field === 'sourceType')).toBe(true);
    });

    it('prevents duplicate track IDs and audio paths', () => {
      const library = new ConcertLibrary({
        initialTracks: [
          {
            id: 'track_1',
            title: 'Song One',
            artist: 'Artist A',
            year: 2024,
            durationSeconds: 180,
            localAudioPath: '/audio/track1.mp3',
            sourceType: 'local_file',
            licenseNotes: 'OK',
          },
        ],
      });

      // Attempt duplicate ID
      const dupId = library.addTrack({
        id: 'track_1',
        title: 'Song Duplicate',
        artist: 'Artist B',
        year: 2024,
        durationSeconds: 150,
        localAudioPath: '/audio/track2.mp3',
        sourceType: 'local_file',
        licenseNotes: 'OK',
      });
      expect(dupId).toBe(false);

      // Attempt duplicate path
      const dupPath = library.addTrack({
        id: 'track_2',
        title: 'Song Different ID',
        artist: 'Artist B',
        year: 2024,
        durationSeconds: 150,
        localAudioPath: '/audio/track1.mp3',
        sourceType: 'local_file',
        licenseNotes: 'OK',
      });
      expect(dupPath).toBe(false);

      expect(library.getAllTracks()).toHaveLength(1);
    });

    it('warns when local files are missing on disk', () => {
      const existingFiles = new Set(['/audio/present.mp3']);
      const fileExists = (p: string) => existingFiles.has(p);

      const result = validateConcertTrack(
        {
          id: 'missing_track',
          title: 'Missing File Song',
          artist: 'Ghost Band',
          year: 2024,
          durationSeconds: 200,
          localAudioPath: '/audio/missing.mp3',
          sourceType: 'local_file',
          licenseNotes: 'Test',
        },
        { fileExists },
      );

      expect(result.errors).toHaveLength(0);
      expect(result.warnings.some((w) => w.message.includes('nie został odnaleziony'))).toBe(true);
    });
  });

  describe('Playback routing and safe disk fallbacks', () => {
    it('safely falls back to fallbackTrack when local file is missing from disk', () => {
      const existingFiles = new Set(['/audio/fallback.mp3']);
      const fileExists = (p: string) => existingFiles.has(p);

      const library = new ConcertLibrary({
        fallbackTrackId: 'fallback_id',
        fileExists,
        initialTracks: [
          {
            id: 'fallback_id',
            title: 'Fallback Safe Riff',
            artist: 'System',
            year: 2026,
            durationSeconds: 60,
            localAudioPath: '/audio/fallback.mp3',
            sourceType: 'local_file',
            licenseNotes: 'Internal safe fallback',
          },
          {
            id: 'lost_track',
            title: 'Lost Track on Disk',
            artist: 'Unknown',
            year: 2025,
            durationSeconds: 180,
            localAudioPath: '/audio/not_on_disk.mp3',
            sourceType: 'local_file',
            licenseNotes: 'Local file missing',
          },
        ],
      });

      // Resolving the lost track must return the fallback audio path, not crash or return invalid path
      const resolved = library.resolvePlayableAudioPath('lost_track');
      expect(resolved).toBe('/audio/fallback.mp3');
    });

    it('routes pending_permission tracks to fallback audio until rights are secured', () => {
      const library = new ConcertLibrary({
        initialTracks: [
          {
            id: 'fallback_test_riff',
            title: 'Fallback Riff',
            artist: 'Soundcheck',
            year: 2026,
            durationSeconds: 60,
            localAudioPath: '/audio/fallback.mp3',
            sourceType: 'local_file',
            licenseNotes: 'Safe',
          },
          {
            id: 'kreciolatv_pending',
            title: 'Great Concert (Waiting)',
            artist: 'Headliner',
            year: 2023,
            durationSeconds: 300,
            localAudioPath: '/audio/headliner.mp3',
            sourceType: 'pending_permission',
            licenseNotes: 'Waiting for official clearance',
          },
        ],
      });

      // Should safely redirect pending_permission to fallback track
      const resolved = library.resolvePlayableAudioPath('kreciolatv_pending');
      expect(resolved).toBe('/audio/fallback.mp3');

      // Playable tracks should only include the cleared local_file
      const playable = library.getPlayableTracks();
      expect(playable.map((t) => t.id)).toEqual(['fallback_test_riff']);
    });

    it('returns null when unknown track is requested and no fallback exists', () => {
      const library = new ConcertLibrary({ initialTracks: [] });
      expect(library.resolvePlayableAudioPath('non_existent')).toBeNull();
    });
  });

  describe('Security and compliance rules', () => {
    it('manifest tracks contain no secret tokens or unauthorized download URLs', () => {
      for (const track of DEFAULT_CONCERT_MANIFEST) {
        expect(track.localAudioPath).not.toMatch(/token=|api_key=|bearer|secret/i);
        expect(track.localAudioPath).not.toMatch(/googlevideo\.com|youtube\.com\/videoplayback/i);
        expect(track.licenseNotes.length).toBeGreaterThan(0);
      }
    });
  });
});
