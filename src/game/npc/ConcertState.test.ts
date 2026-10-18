import { describe, expect, it, vi } from 'vitest';
import { CONCERT_PHASES, ConcertState, type ConcertPhase } from './ConcertState';

describe('ConcertState — D3 Reakcja na koncert', () => {
  describe('Inicjalizacja i właściwości', () => {
    it('tworzy instancję z domyślnym stanem idle', () => {
      const concert = new ConcertState();
      expect(concert.phase).toBe('idle');
      expect(concert.previousPhase).toBe('idle');
      expect(concert.isPlaying).toBe(false);
      expect(concert.trackId).toBeUndefined();
    });

    it('obsługuje opcje początkowe konstruktora', () => {
      const concert = new ConcertState({
        initialPhase: 'intro',
        initialTrackId: 'woodstock_intro_2025',
      });
      expect(concert.phase).toBe('intro');
      expect(concert.previousPhase).toBe('intro');
      expect(concert.trackId).toBe('woodstock_intro_2025');
      expect(concert.isPlaying).toBe(true);
    });

    it('zawiera wszystkie wymagane fazy w CONCERT_PHASES', () => {
      const expected: ConcertPhase[] = ['idle', 'intro', 'playing', 'cheering', 'applause', 'encore'];
      expect(CONCERT_PHASES).toEqual(expected);
    });
  });

  describe('Przejścia stanów (Transitions)', () => {
    it('poprawnie przechodzi przez cykl koncertu', () => {
      const concert = new ConcertState();

      // idle -> intro
      concert.setPhase('intro', { timestamp: 10, trackId: 'song_01' });
      expect(concert.phase).toBe('intro');
      expect(concert.previousPhase).toBe('idle');
      expect(concert.trackId).toBe('song_01');
      expect(concert.isPlaying).toBe(true);

      // intro -> playing
      concert.setPhase('playing', { timestamp: 25 });
      expect(concert.phase).toBe('playing');
      expect(concert.previousPhase).toBe('intro');

      // playing -> cheering
      concert.setPhase('cheering', { timestamp: 80 });
      expect(concert.phase).toBe('cheering');
      expect(concert.previousPhase).toBe('playing');

      // cheering -> applause
      concert.setPhase('applause', { timestamp: 95 });
      expect(concert.phase).toBe('applause');
      expect(concert.previousPhase).toBe('cheering');

      // applause -> encore
      concert.setPhase('encore', { timestamp: 110, trackId: 'bis_song' });
      expect(concert.phase).toBe('encore');
      expect(concert.previousPhase).toBe('applause');
      expect(concert.trackId).toBe('bis_song');

      // encore -> idle
      concert.setPhase('idle', { timestamp: 180 });
      expect(concert.phase).toBe('idle');
      expect(concert.previousPhase).toBe('encore');
      expect(concert.isPlaying).toBe(false);
    });

    it('transitionTo zwraca true przy zmianie i false dla identycznej fazy', () => {
      const concert = new ConcertState();
      expect(concert.transitionTo('playing')).toBe(true);
      expect(concert.transitionTo('playing')).toBe(false);
    });

    it('poprawnie mierzy czas trwania fazy getElapsedSeconds', () => {
      const concert = new ConcertState();
      concert.setPhase('playing', { timestamp: 100 });
      expect(concert.getElapsedSeconds(105.5)).toBe(5.5);
      expect(concert.getElapsedSeconds(90)).toBe(0); // zabezpieczenie przed ujemnym czasem
    });
  });

  describe('Wzorzec obserwatora (onStateChange)', () => {
    it('powiadamia subskrybenta o zmianie fazy z pełnym zdarzeniem', () => {
      const concert = new ConcertState();
      const listener = vi.fn();
      concert.onStateChange(listener);

      concert.setPhase('playing', { timestamp: 12.5, trackId: 'track_a' });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith('playing', {
        phase: 'playing',
        previousPhase: 'idle',
        timestamp: 12.5,
        trackId: 'track_a',
      });
    });

    it('pozwala na czyste wyrejestrowanie obserwatora (unsubscribe)', () => {
      const concert = new ConcertState();
      const listener = vi.fn();
      const unsubscribe = concert.onStateChange(listener);

      concert.setPhase('intro');
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      concert.setPhase('playing');
      expect(listener).toHaveBeenCalledTimes(1); // brak ponownego wywołania
    });

    it('obsługuje wielu niezależnych obserwatorów', () => {
      const concert = new ConcertState();
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      concert.onStateChange(cb1);
      const unsub2 = concert.onStateChange(cb2);

      concert.setPhase('playing');
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);

      unsub2();
      concert.setPhase('applause');
      expect(cb1).toHaveBeenCalledTimes(2);
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('nie wywołuje obserwatora, gdy faza i utwór nie uległy zmianie', () => {
      const concert = new ConcertState();
      const listener = vi.fn();
      concert.onStateChange(listener);

      concert.setPhase('idle');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Deterministyczne przesunięcia czasowe per NPC (Staggered timing)', () => {
    it('oblicza deterministyczny offset dla tego samego NPC', () => {
      const concert = new ConcertState();
      const offset1 = concert.getReactionOffset('npc_woodstock_008');
      const offset2 = concert.getReactionOffset('npc_woodstock_008');
      expect(offset1).toBe(offset2);
      expect(offset1).toBeGreaterThanOrEqual(0.2);
      expect(offset1).toBeLessThanOrEqual(2.4);
    });

    it('generuje zróżnicowane opóźnienia dla różnych identyfikatorów', () => {
      const concert = new ConcertState();
      const offsets = new Set<number>();
      for (let i = 1; i <= 30; i++) {
        const offset = concert.getReactionOffset(`npc_festival_attendee_${i}`);
        offsets.add(Number(offset.toFixed(4)));
      }
      // Pomiędzy 30 NPC powinno być przynajmniej 25 unikalnych wartości
      expect(offsets.size).toBeGreaterThanOrEqual(25);
    });

    it('isNpcReacting zwraca false przed upływem opóźnienia i true po upływie', () => {
      const concert = new ConcertState();
      const npcId = 'metalhead_kuba';
      const offset = concert.getReactionOffset(npcId);

      expect(concert.isNpcReacting(npcId, offset - 0.05)).toBe(false);
      expect(concert.isNpcReacting(npcId, offset + 0.05)).toBe(true);
    });

    it('getNpcEffectiveState zatrzymuje poprzedni stan do momentu minięcia indywidualnego opóźnienia', () => {
      const concert = new ConcertState();
      concert.setPhase('playing');
      concert.setPhase('applause'); // przejście playing -> applause

      const npcId = 'fan_dziaslo';
      const offset = concert.getReactionOffset(npcId);

      // Przed minięciem opóźnienia widz jest jeszcze w stanie 'playing'
      expect(concert.getNpcEffectiveState(npcId, offset - 0.01)).toBe('playing');
      // Po minięciu opóźnienia widz przechodzi do 'applause'
      expect(concert.getNpcEffectiveState(npcId, offset + 0.01)).toBe('applause');
    });

    it('zapobiega uniformalnej, natychmiastowej reakcji całego tłumu (fala aplauzu)', () => {
      const concert = new ConcertState();
      concert.setPhase('playing');
      concert.setPhase('cheering');

      const npcs = Array.from({ length: 50 }, (_, i) => `crowd_member_${i}`);

      // Na samym początku (t = 0.05s) nikt lub niemal nikt jeszcze nie reaguje
      const reactingAtStart = npcs.filter((id) => concert.isNpcReacting(id, 0.05));
      expect(reactingAtStart.length).toBeLessThan(3);

      // W połowie okna reakcji (t = 1.3s) część tłumu reaguje, a część jeszcze czeka
      const reactingMidway = npcs.filter((id) => concert.isNpcReacting(id, 1.3));
      expect(reactingMidway.length).toBeGreaterThan(10);
      expect(reactingMidway.length).toBeLessThan(45);

      // Po zakończeniu okna reakcji (t = 2.5s) 100% tłumu aktywnie wiwatuje
      const reactingAtEnd = npcs.filter((id) => concert.isNpcReacting(id, 2.5));
      expect(reactingAtEnd.length).toBe(50);
    });
  });

  describe('Natężenie entuzjazmu tłumu (getNpcCheerIntensity)', () => {
    it('zwraca 0 przed momentem reakcji widza', () => {
      const concert = new ConcertState();
      const offset = concert.getReactionOffset('npc_test_fan');
      expect(concert.getNpcCheerIntensity('npc_test_fan', offset - 0.1)).toBe(0);
    });

    it('łagodnie narasta (attack) po rozpoczęciu reakcji widza', () => {
      const concert = new ConcertState();
      const offset = concert.getReactionOffset('npc_test_fan');

      const earlyIntensity = concert.getNpcCheerIntensity('npc_test_fan', offset + 0.1);
      const fullIntensity = concert.getNpcCheerIntensity('npc_test_fan', offset + 0.8);

      expect(earlyIntensity).toBeGreaterThan(0);
      expect(fullIntensity).toBeGreaterThan(earlyIntensity);
      expect(fullIntensity).toBeLessThanOrEqual(1.0);
    });

    it('wygasza się (decay) pod koniec trwania aplauzu', () => {
      const concert = new ConcertState();
      const npcId = 'npc_test_decay';
      const duration = 6.0;

      const peakIntensity = concert.getNpcCheerIntensity(npcId, 3.0, duration);
      const endIntensity = concert.getNpcCheerIntensity(npcId, 5.8, duration);

      expect(peakIntensity).toBeGreaterThan(0.7);
      expect(endIntensity).toBeLessThan(peakIntensity);
    });
  });

  describe('Resetowanie stanu', () => {
    it('przywraca domyślne parametry po wywołaniu reset()', () => {
      const concert = new ConcertState();
      concert.setPhase('encore', { timestamp: 300, trackId: 'final_song' });
      expect(concert.phase).toBe('encore');

      concert.reset();
      expect(concert.phase).toBe('idle');
      expect(concert.previousPhase).toBe('idle');
      expect(concert.trackId).toBeUndefined();
      expect(concert.phaseStartedAt).toBe(0);
      expect(concert.isPlaying).toBe(false);
    });
  });
});
