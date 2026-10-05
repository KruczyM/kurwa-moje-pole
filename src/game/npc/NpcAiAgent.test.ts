import { describe, it, expect } from 'vitest';
import { NpcAiAgent, analyzeModelPersonality } from './NpcAiAgent';

describe('NpcAiAgent', () => {
  describe('Canonical Characters', () => {
    it('correctly resolves personas for all canonical characters', () => {
      const characters = ['Pień', 'Amper', 'Antena', 'Gruczoł', 'Klątwa', 'Krwiak', 'Pierścień', 'Zawór'];
      for (const char of characters) {
        const persona = NpcAiAgent.getPersona(char);
        expect(persona).toBeDefined();
        expect(persona.name).toContain(char);
        expect(persona.voiceSettings).toHaveProperty('pitch');
        expect(persona.voiceSettings).toHaveProperty('rate');
      }
    });

    it('resolves alias names like "Pień aka Peposz" to the correct persona', () => {
      const persona = NpcAiAgent.getPersona('Pień aka Peposz');
      expect(persona.name).toBe('Pień aka Peposz');
      expect(persona.title).toBe('Gospodarz Pola');
    });
  });

  describe('Extended Heroes', () => {
    it('correctly resolves all 8 extended heroes with customized personalities', () => {
      const heroes = ['Ambona', 'Chlebak', 'Dziąsło', 'Hemoroid', 'Jęczmień', 'Kobra', 'Korba', 'Szerszeń'];
      for (const hero of heroes) {
        const persona = NpcAiAgent.getPersona(hero);
        expect(persona).toBeDefined();
        expect(persona.name).toBe(hero);
        expect(persona.voiceSettings.pitch).toBeGreaterThan(0.5);
        expect(persona.voiceSettings.rate).toBeGreaterThan(0.5);
        expect(persona.greetings.length).toBeGreaterThanOrEqual(2);
        expect(persona.identity.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('provides lore and identity for extended heroes', () => {
      const ambona = NpcAiAgent.getPersona('Ambona');
      expect(
        ambona.identity.some(
          (line) =>
            line.toLowerCase().includes('ambona') ||
            line.toLowerCase().includes('kazalnicy') ||
            line.toLowerCase().includes('ogłoszeń'),
        ),
      ).toBe(true);
      expect(ambona.festivalLore).toHaveProperty('ciemno');

      const dziaslo = NpcAiAgent.getPersona('Dziąsło');
      expect(dziaslo.identity.some((line) => line.toLowerCase().includes('jarocin'))).toBe(true);

      const jeczmien = NpcAiAgent.getPersona('Jęczmień');
      expect(
        jeczmien.identity.some(
          (line) => line.toLowerCase().includes('chmiel') || line.toLowerCase().includes('piw'),
        ),
      ).toBe(true);
    });
  });

  describe('Signature Festival Models', () => {
    it('correctly resolves key signature models with distinctive voices and roles', () => {
      const alien = NpcAiAgent.getPersona('050_blue_alien_girl');
      expect(alien.name).toBe('Niebieska Kosmitka');
      expect(alien.voiceSettings.pitch).toBeGreaterThan(1.2); // high extraterrestrial pitch

      const hotdog = NpcAiAgent.getPersona('082_hotdog_girl');
      expect(hotdog.name).toBe('Parówkowa Wojowniczka');
      expect(hotdog.title).toContain('Gastronomii');

      const frog = NpcAiAgent.getPersona('076_frog_suit_guy');
      expect(frog.name).toBe('Żabol z Pola');
      expect(frog.voiceSettings.pitch).toBeLessThan(0.9); // croaking voice

      const knight = NpcAiAgent.getPersona('084_knight_cosplay');
      expect(knight.name).toBe('Rycerz Festiwalowy');

      const mudMonster = NpcAiAgent.getPersona('086_mud_monster');
      expect(mudMonster.name).toBe('Błotny Potwór');
      expect(mudMonster.voiceSettings.pitch).toBeLessThan(0.7); // deep mud rumble
    });

    it('provides thematic lore and identity for signature models', () => {
      const alien = NpcAiAgent.getPersona('050_blue_alien_girl');
      expect(
        alien.identity.some(
          (line) => line.toLowerCase().includes('kosmic') || line.toLowerCase().includes('gwiazd'),
        ),
      ).toBe(true);
      expect(alien.festivalLore).toHaveProperty('bloto');

      const hotdog = NpcAiAgent.getPersona('082_hotdog_girl');
      expect(
        hotdog.identity.some(
          (line) =>
            line.toLowerCase().includes('parówk') ||
            line.toLowerCase().includes('gastronomii') ||
            line.toLowerCase().includes('hotdog'),
        ),
      ).toBe(true);
      expect(hotdog.festivalLore).toHaveProperty('piwo');

      const knight = NpcAiAgent.getPersona('084_knight_cosplay');
      expect(
        knight.identity.some(
          (line) => line.toLowerCase().includes('rycerz') || line.toLowerCase().includes('zbroi'),
        ),
      ).toBe(true);
      expect(knight.festivalLore).toHaveProperty('pole');
    });
  });

  describe('Dynamic Model Analysis Engine', () => {
    it('analyzes unlisted guitarists and troubadours', () => {
      const persona = analyzeModelPersonality('024_plaid_shirt_guitarist.glb');
      expect(persona.title).toContain('Gitarzysta');
      expect(persona.voiceSettings.rate).toBeCloseTo(1.0);
    });

    it('analyzes unlisted metalheads and bikers', () => {
      const metalhead = analyzeModelPersonality('042_heavy_metal_banger.glb');
      expect(metalhead.title).toContain('Headbangingu');
      expect(metalhead.voiceSettings.pitch).toBeLessThan(0.85);

      const biker = analyzeModelPersonality('088_older_biker.glb');
      expect(biker.title).toContain('Szos');
      expect(biker.voiceSettings.pitch).toBeLessThan(0.8);
    });

    it('analyzes unlisted ravers and neon dancers', () => {
      const raver = analyzeModelPersonality('039_neon_mesh_raver.glb');
      expect(raver.title).toContain('Tancerz');
      expect(raver.voiceSettings.pitch).toBeGreaterThan(1.1);
      expect(raver.voiceSettings.rate).toBeGreaterThan(1.15);
    });

    it('analyzes unlisted hippies and boho dancers', () => {
      const hippie = analyzeModelPersonality('040_crochet_top_boho.glb');
      expect(hippie.title).toContain('Pokoju');
      expect(hippie.voiceSettings.pitch).toBeGreaterThan(1.0);
    });

    it('detects female models and configures female gender and elevated pitch', () => {
      const girlRocker = analyzeModelPersonality('078_girl_with_guitar.glb');
      expect(girlRocker.voiceSettings.gender).toBe('female');
      expect(girlRocker.voiceSettings.pitch).toBeGreaterThanOrEqual(1.25);
      expect(girlRocker.title).toContain('Gitarzystka');

      const shortsGirl = analyzeModelPersonality('070_vintage_denim_shorts.glb');
      expect(shortsGirl.voiceSettings.gender).toBe('female');
      expect(shortsGirl.title).toContain('Bywalczyni');

      const bohoGirl = analyzeModelPersonality('005_boho_festival_girl.glb');
      expect(bohoGirl.voiceSettings.gender).toBe('female');
      expect(bohoGirl.voiceSettings.pitch).toBeGreaterThanOrEqual(1.25);

      const korba = NpcAiAgent.getPersona('Korba');
      expect(korba.voiceSettings.gender).toBe('female');
      expect(korba.voiceSettings.pitch).toBeGreaterThan(1.25);
    });

    it('falls back gracefully on arbitrary unknown model strings', () => {
      const fallback = NpcAiAgent.getPersona('unknown_random_npc_999');
      expect(fallback).toBeDefined();
      expect(fallback.name).toBeTruthy();
      expect(fallback.voiceSettings).toHaveProperty('pitch');
      expect(fallback.voiceSettings).toHaveProperty('rate');
      expect(fallback.greetings.length).toBeGreaterThan(0);
    });

    it('caches dynamically generated personas for repeated lookups', () => {
      const first = NpcAiAgent.getPersona('056_festival_mud_sprinter.glb');
      const second = NpcAiAgent.getPersona('056_festival_mud_sprinter.glb');
      expect(first).toBe(second);
    });
  });

  describe('Persona Knowledge & System Prompt Context for Gemini', () => {
    it('provides rich festival lore mapping for canonical characters', () => {
      const canonicals = ['Pień', 'Amper', 'Antena', 'Gruczoł', 'Klątwa', 'Krwiak', 'Pierścień', 'Zawór'];
      for (const name of canonicals) {
        const persona = NpcAiAgent.getPersona(name);
        expect(persona.festivalLore).toBeDefined();
        expect(Object.keys(persona.festivalLore || {}).length).toBeGreaterThanOrEqual(1);
        expect(persona.greetings.length).toBeGreaterThan(0);
        expect(persona.identity.length).toBeGreaterThan(0);
        expect(persona.voiceSettings).toHaveProperty('pitch');
        expect(persona.voiceSettings).toHaveProperty('rate');
      }
    });

    it('ensures Pień possesses camp lore and field ownership authority', () => {
      const pien = NpcAiAgent.getPersona('Pień');
      expect(pien.title).toContain('Gospodarz');
      expect(pien.identity.some((line) => line.toLowerCase().includes('pole'))).toBe(true);
      expect(pien.festivalLore?.ciemno?.[0].toUpperCase()).toContain('ZAMKNIJ SIĘ');
    });

    it('ensures Zawór maintains sanitation and toi-toi expertise', () => {
      const zawor = NpcAiAgent.getPersona('Zawór');
      expect(zawor.title).toContain('Hydraulik');
      expect(
        zawor.identity.some(
          (line) => line.toLowerCase().includes('toi') || line.toLowerCase().includes('sanit'),
        ),
      ).toBe(true);
    });

    it('ensures Szerszeń maintains festival gossip persona and night hooks', () => {
      const szerszen = NpcAiAgent.getPersona('Szerszeń');
      expect(szerszen.title).toContain('Komentator');
      expect(
        szerszen.greetings.some(
          (g) => g.toLowerCase().includes('plotk') || g.toLowerCase().includes('sektor'),
        ),
      ).toBe(true);
    });

    it('ensures Amper maintains camp electrical power lore', () => {
      const amper = NpcAiAgent.getPersona('Amper');
      expect(amper.title).toContain('Elektryk');
      expect(
        amper.identity.some(
          (id) =>
            id.toLowerCase().includes('agregat') ||
            id.toLowerCase().includes('prąd') ||
            id.toLowerCase().includes('kable'),
        ),
      ).toBe(true);
    });

    it('ensures Chlebak possesses camp provisions lore', () => {
      const chlebak = NpcAiAgent.getPersona('Chlebak');
      expect(chlebak.title).toContain('Zaopatrzeniowiec');
      expect(
        chlebak.greetings.some(
          (g) => g.toLowerCase().includes('kabanos') || g.toLowerCase().includes('pasztet'),
        ),
      ).toBe(true);
    });
  });
});
