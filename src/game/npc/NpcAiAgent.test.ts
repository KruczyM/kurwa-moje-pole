import { describe, it, expect } from 'vitest';
import {
  NpcAiAgent,
  NPC_PERSONAS,
  EXTENDED_HERO_PERSONAS,
  SIGNATURE_MODEL_PERSONAS,
  analyzeModelPersonality,
} from './NpcAiAgent';

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

    it('generates lore-accurate responses for extended heroes', () => {
      const ambona = NpcAiAgent.generateResponse('Ambona', 'Zaraz będzie ciemno!');
      expect(ambona.topic).toBe('ciemno');
      expect(ambona.text.toUpperCase()).toContain('ZAMKNIJ SIĘ');

      const dziaslo = NpcAiAgent.generateResponse('Dziąsło', 'Kim jesteś?');
      expect(dziaslo.topic).toBe('tozsamosc');
      expect(dziaslo.text.toLowerCase()).toContain('jarocin');

      const jeczmien = NpcAiAgent.generateResponse('Jęczmień', 'Gdzie jest piwo?');
      expect(jeczmien.topic).toBe('piwo');
      expect(jeczmien.text.toLowerCase()).toContain('chmiel');
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

    it('generates thematic responses for signature models', () => {
      const alienReply = NpcAiAgent.generateResponse('050_blue_alien_girl', 'Jak ci się podoba błoto?');
      expect(alienReply.topic).toBe('bloto');
      expect(alienReply.text.toLowerCase()).toContain('błoto');

      const hotdogReply = NpcAiAgent.generateResponse('082_hotdog_girl', 'Co z tym piwem?');
      expect(hotdogReply.topic).toBe('piwo');
      expect(hotdogReply.text.toLowerCase()).toContain('hotdog');

      const knightReply = NpcAiAgent.generateResponse('084_knight_cosplay', 'Czyje to pole?');
      expect(knightReply.topic).toBe('pole');
      expect(knightReply.text.toLowerCase()).toContain('pole');
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

  describe('General Dialogue & Core Lore Responses', () => {
    it('responds with iconic festival phrase to "zaraz będzie ciemno"', () => {
      const response = NpcAiAgent.generateResponse('Pień', 'Zaraz będzie ciemno!');
      expect(response.topic).toBe('ciemno');
      expect(response.text.toUpperCase()).toContain('ZAMKNIJ SIĘ');
    });

    it('answers questions about camp territory and field ownership', () => {
      const response = NpcAiAgent.generateResponse('Pień', 'Czyje to pole?');
      expect(response.topic).toBe('pole');
      expect(response.text.toLowerCase()).toContain('pole');
    });

    it('responds to inquiries about beer and drinks', () => {
      const response = NpcAiAgent.generateResponse('Gruczoł', 'Gdzie dostanę zimne piwo?');
      expect(response.topic).toBe('piwo');
      expect(response.text.length).toBeGreaterThan(10);
    });

    it('responds to inquiries about mud and puddles', () => {
      const response = NpcAiAgent.generateResponse('Krwiak', 'Jak tam błoto pod sceną?');
      expect(response.topic).toBe('bloto');
      expect(response.text.length).toBeGreaterThan(10);
    });

    it('responds to inquiries about toilets and sanitation', () => {
      const response = NpcAiAgent.generateResponse('Zawór', 'Gdzie jest kibel albo toi toi?');
      expect(response.topic).toBe('kibel');
      expect(response.text.toLowerCase()).toContain('toi');
    });

    it('provides identity description when asked "kim jesteś"', () => {
      const response = NpcAiAgent.generateResponse('Amper', 'Kim jesteś i czym się zajmujesz?');
      expect(response.topic).toBe('tozsamosc');
      expect(response.text.toLowerCase()).toContain('amper');
    });

    it('returns a safe in-character contextual fallback for arbitrary unknown questions', () => {
      const response = NpcAiAgent.generateResponse('Antena', 'Czy fizyka kwantowa tłumaczy rezonans akustyczny?');
      expect(response.topic).toBe('ogolne');
      expect(response.text).toContain('fizyka kwantowa');
      expect(response.voiceSettings.pitch).toBeGreaterThan(1.0); // Antena's pitch
    });

    it('handles empty input gracefully with a friendly greeting', () => {
      const response = NpcAiAgent.generateResponse('Pień', '');
      expect(response.topic).toBe('powitanie');
      expect(response.text.length).toBeGreaterThan(3);
    });
  });
});
