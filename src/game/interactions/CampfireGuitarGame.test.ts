import { describe, it, expect, beforeEach } from 'vitest';
import { CampfireGuitarGame, PERFECT_WINDOW, guitarFrequencies } from './CampfireGuitarGame';

describe('CampfireGuitarGame', () => {
  it('recognizes MIDI pitches, including octave -1, instead of falling back to A minor', () => {
    expect(guitarFrequencies('A4')).toEqual([440]);
    expect(guitarFrequencies('C-1')[0]).toBeCloseTo(8.1758);
    expect(guitarFrequencies('C#4')[0]).toBeCloseTo(277.1826);
    expect(guitarFrequencies('Dm')).toHaveLength(4);
  });
  it('includes five supplied MIDI arrangements with sorted playable notes', () => {
    const songs = new CampfireGuitarGame().getAvailableSongs();
    for (const id of [
      'zegarmistrz-midi',
      'czarny-chleb-midi',
      'pila-tango-midi',
      'sen-victoria-midi',
      'czerwony-cegla-midi',
    ]) {
      const song = songs.find((s) => s.id === id)!;
      expect(song).toBeDefined();
      expect(song.notes.length).toBeGreaterThan(50);
      expect(song.duration).toBeGreaterThan(60);
      expect(song.notes[0].time).toBeCloseTo(2.5);
      song.notes.forEach((note, i) => {
        expect(note.lane).toBeGreaterThanOrEqual(0);
        expect(note.lane).toBeLessThan(5);
        expect(note.time).toBeLessThan(song.duration);
        if (i) expect(note.time - song.notes[i - 1].time).toBeGreaterThanOrEqual(0.179999);
      });
    }
  });
  it('ships complete licensed MIDI charts with stable pitch lanes and no notes after song end', () => {
    const songs = new CampfireGuitarGame().getAvailableSongs();
    for (const id of ['ode', 'amazing']) {
      const song = songs.find((s) => s.id === id)!;
      expect(song.notes.length).toBeGreaterThan(50);
      const lanes = new Map<string, number>();
      for (const note of song.notes) {
        expect(note.time).toBeLessThan(song.duration);
        expect(note.time).toBeGreaterThanOrEqual(2.5);
        if (lanes.has(note.chordName)) expect(note.lane).toBe(lanes.get(note.chordName));
        lanes.set(note.chordName, note.lane);
      }
    }
    for (const song of songs) expect(song.notes.at(-1)!.time).toBeLessThan(song.duration);
  });
  let game: CampfireGuitarGame;
  let toasts: string[];
  let playedChords: string[];
  let crowdCheers: number;

  beforeEach(() => {
    toasts = [];
    playedChords = [];
    crowdCheers = 0;

    game = new CampfireGuitarGame(
      {
        onToast: (m) => toasts.push(m),
        onPlayChord: (c) => playedChords.push(c),
        onCrowdCheerSfx: () => crowdCheers++,
      },
      // Mock synthezera bez fizycznego AudioContext w środowisku Node/Vitest
      {
        init: () => {},
        startBackingTrack: () => {},
        stopBackingTrack: () => {},
        updateBackingTrack: () => {},
        playChord: () => {},
        playMissBuzz: () => {},
        playCrowdCheer: () => crowdCheers++,
        dispose: () => {},
      } as any,
    );
  });

  it('inicjalizuje się w stanie idle z listą utworów festiwalowych', () => {
    expect(game.getPhase()).toBe('idle');
    const songs = game.getAvailableSongs();
    expect(songs.length).toBeGreaterThanOrEqual(4);
    expect(songs.some((s) => s.id === 'wehikul')).toBe(true);
    expect(songs.some((s) => s.id === 'arahja')).toBe(true);
  });

  it('startSong() rozpoczyna rozgrywkę i resetuje punkty oraz combo', () => {
    const started = game.startSong('wehikul');
    expect(started).toBe(true);
    expect(game.getPhase()).toBe('playing');
    const hud = game.getHudState();
    expect(hud.score).toBe(0);
    expect(hud.combo).toBe(0);
    expect(hud.multiplier).toBe(1);
    expect(hud.currentSong?.id).toBe('wehikul');
    expect(toasts.some((t) => t.includes('Ogniskowy rock'))).toBe(true);
  });

  it('hitLane() ocenia perfekcyjne trafienie (PERFECT) w oknie czasowym', () => {
    game.startSong('wehikul');
    const song = (game as any).currentSong;
    const firstNote = song.notes[0];

    // Uderzamy idealnie w czasie nuty
    const result = game.hitLane(firstNote.lane, firstNote.time);
    expect(result.rating).toBe('perfect');
    expect(result.scoreAwarded).toBe(100);
    expect(result.combo).toBe(1);
    expect(game.getHudState().score).toBe(100);
    expect(playedChords.length).toBe(1);
  });

  it('hitLane() ocenia trafienie dobre (GOOD) w dopuszczalnym marginesie', () => {
    game.startSong('wehikul');
    const song = (game as any).currentSong;
    const firstNote = song.notes[0];

    // Uderzamy z przesunięciem pomiędzy PERFECT a GOOD
    const timeWithOffset = firstNote.time + PERFECT_WINDOW + 0.04;
    const result = game.hitLane(firstNote.lane, timeWithOffset);
    expect(result.rating).toBe('good');
    expect(result.scoreAwarded).toBe(50);
    expect(result.combo).toBe(1);
    expect(game.getHudState().score).toBe(50);
  });

  it('hitLane() w pustą ścieżkę powoduje pudło i zeruje combo', () => {
    game.startSong('wehikul');
    const song = (game as any).currentSong;
    const firstNote = song.notes[0];

    // Najpierw trafiamy
    game.hitLane(firstNote.lane, firstNote.time);
    expect(game.getHudState().combo).toBe(1);

    // Następnie uderzamy w inną ścieżkę z dala od nuty
    const wrongLane = (firstNote.lane + 1) % 5;
    const result = game.hitLane(wrongLane, 99.0);
    expect(result.rating).toBe('miss');
    expect(game.getHudState().combo).toBe(0);
    expect(game.getHudState().multiplier).toBe(1);
  });

  it('akumuluje combo i podnosi mnożnik (x2 od 5 combo, x3 od 10 combo, x4 od 20 combo)', () => {
    game.startSong('wehikul');

    for (let i = 0; i < 5; i++) {
      (game as any).combo++;
    }
    (game as any).updateMultiplier();
    expect(game.getHudState().multiplier).toBe(2);

    for (let i = 0; i < 5; i++) {
      (game as any).combo++;
    }
    (game as any).updateMultiplier();
    expect(game.getHudState().multiplier).toBe(3);

    for (let i = 0; i < 10; i++) {
      (game as any).combo++;
    }
    (game as any).updateMultiplier();
    expect(game.getHudState().multiplier).toBe(4);
  });

  it('update() przesuwa czas, rejestruje minięte nuty i kończy utwór', () => {
    let finishedStats: any = null;
    game.setCallbacks({
      onSongFinished: (stats) => {
        finishedStats = stats;
      },
      onToast: (m) => toasts.push(m),
    });

    game.startSong('wehikul');
    const duration = (game as any).currentSong.duration;

    // Przeskakujemy czas poza czas trwania utworu
    game.update(duration + 1.0);

    expect(game.getPhase()).toBe('song_finished');
    expect(finishedStats).toBeDefined();
    expect(finishedStats.misses).toBeGreaterThan(0);
    expect(toasts.some((t) => t.includes('Koniec utworu') || t.includes('BRAWO'))).toBe(true);
  });

  it('zwraca aktywne nuty w getHudState() z poprawnym progresem 0..1', () => {
    game.startSong('wehikul');
    // Ustawiamy czas na 0.5s przed pierwszą nutą
    const firstNote = (game as any).currentSong.notes[0];
    (game as any).currentTime = firstNote.time - 1.0;

    const hud = game.getHudState();
    expect(hud.activeNotes.length).toBeGreaterThan(0);
    const activeNote = hud.activeNotes.find((n) => n.id === firstNote.id);
    expect(activeNote).toBeDefined();
    expect(activeNote!.progress).toBeGreaterThan(0);
    expect(activeNote!.progress).toBeLessThanOrEqual(1.0);
  });

  it('rozpoczyna, aktualizuje i wyłącza podkład muzyczny przy rozpoczęciu i zakończeniu utworu', () => {
    let backingStarted = false;
    let backingUpdates = 0;
    let backingStopped = false;

    const synthMock = {
      init: () => {},
      startBackingTrack: () => {
        backingStarted = true;
      },
      updateBackingTrack: () => {
        backingUpdates++;
      },
      stopBackingTrack: () => {
        backingStopped = true;
      },
      playChord: () => {},
      playMissBuzz: () => {},
      playCrowdCheer: () => {},
      dispose: () => {},
    };

    const g = new CampfireGuitarGame({}, synthMock as any);
    g.startSong('arahja');
    expect(backingStarted).toBe(true);

    g.update(0.1);
    expect(backingUpdates).toBe(1);

    g.stopSong();
    expect(backingStopped).toBe(true);
  });

  it('obsługuje 5 torów (0..4) i różnorodne poziomy trudności w utworach', () => {
    const songs = game.getAvailableSongs();
    const difficultSongs = songs.filter((s) => s.difficulty === 'Trudny');
    expect(difficultSongs.length).toBeGreaterThanOrEqual(2);

    // Sprawdzamy czy utwory korzystają ze wszystkich 5 torów 0, 1, 2, 3, 4
    for (const song of songs) {
      const lanes = new Set(song.notes.map((n) => n.lane));
      expect(lanes.has(0)).toBe(true);
      expect(lanes.has(4)).toBe(true);
    }
  });

  it('dispose() bezpiecznie zwalnia zasoby', () => {
    expect(() => game.dispose()).not.toThrow();
    expect(game.getPhase()).toBe('idle');
  });
});
