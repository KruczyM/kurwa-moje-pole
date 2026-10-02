import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ElevenLabsNpcService } from './ElevenLabsNpcService';

describe('ElevenLabsNpcService', () => {
  let service: ElevenLabsNpcService;
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
    });
    vi.stubEnv('VITE_ELEVENLABS_API_KEY', '');
    service = new ElevenLabsNpcService();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('correctly manages API key storage and masking', () => {
    expect(service.hasApiKey()).toBe(false);
    expect(service.getMaskedApiKey()).toBe('');

    service.setApiKey('sk_test1234567890abcdef');
    expect(service.hasApiKey()).toBe(true);
    expect(service.getApiKey()).toBe('sk_test1234567890abcdef');
    expect(service.getMaskedApiKey()).toBe('sk_tes...cdef');

    service.setApiKey('');
    expect(service.hasApiKey()).toBe(false);
  });

  it('reads API key from Vite environment variable as fallback', () => {
    vi.stubEnv('VITE_ELEVENLABS_API_KEY', 'sk_env_test_987654321');
    expect(service.hasApiKey()).toBe(true);
    expect(service.getApiKey()).toBe('sk_env_test_987654321');
  });

  it('selects appropriate voice IDs for different character types and genders', () => {
    // Female energetic (Korba / Parówkowa Wojowniczka):
    const korbaVoice = service.getVoiceIdForPersona('Korba', 'female');
    expect(korbaVoice).toBe(ElevenLabsNpcService.DEFAULT_VOICES.domi.voiceId);

    // Female calm / boho (Niebieska Kosmitka):
    const kosmitkaVoice = service.getVoiceIdForPersona('Niebieska Kosmitka', 'female');
    expect(kosmitkaVoice).toBe(ElevenLabsNpcService.DEFAULT_VOICES.rachel.voiceId);

    // Male rock / older (Pień aka Peposz, Hemoroid):
    const pienVoice = service.getVoiceIdForPersona('Pień aka Peposz', 'male');
    expect(pienVoice).toBe(ElevenLabsNpcService.DEFAULT_VOICES.adam.voiceId);

    // Male raver (Neon Raver):
    const raverVoice = service.getVoiceIdForPersona('087_neon_raver', 'male');
    expect(raverVoice).toBe(ElevenLabsNpcService.DEFAULT_VOICES.josh.voiceId);

    // Default male (Standard festival fan):
    const standardVoice = service.getVoiceIdForPersona('Festiwalowicz', 'male');
    expect(standardVoice).toBe(ElevenLabsNpcService.DEFAULT_VOICES.antoni.voiceId);
  });

  it('successfully fetches synthesized audio buffer when API returns 200', async () => {
    service.setApiKey('sk_valid_key');
    const dummyBuffer = new Uint8Array([1, 2, 3, 4]).buffer;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(dummyBuffer),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await service.synthesizeSpeech('Siemanko!', 'pNInz6obpgDQGcFmaJgB');
    expect(result).toBeDefined();
    expect(result).toBe(dummyBuffer);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/text-to-speech/pNInz6obpgDQGcFmaJgB'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'xi-api-key': 'sk_valid_key',
        }),
      })
    );
  });

  it('detects quota exceeded on 429 response and marks quotaExceeded', async () => {
    service.setApiKey('sk_valid_key');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('{"detail": {"status": "quota_exceeded"}}'),
    });
    vi.stubGlobal('fetch', mockFetch);

    expect(service.isQuotaExceeded()).toBe(false);
    const result = await service.synthesizeSpeech('Siemanko!', 'pNInz6obpgDQGcFmaJgB');

    expect(result).toBeNull();
    expect(service.isQuotaExceeded()).toBe(true);

    // Subsequent calls immediately return null without making another network request:
    const secondCall = await service.synthesizeSpeech('Drugie pytanie', 'pNInz6obpgDQGcFmaJgB');
    expect(secondCall).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Setting a new key resets quota:
    service.setApiKey('sk_new_key');
    expect(service.isQuotaExceeded()).toBe(false);
  });
});
