import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiNpcService } from './GeminiNpcService';

describe('GeminiNpcService', () => {
  let service: GeminiNpcService;
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    service = new GeminiNpcService();

    // Mock window.localStorage
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
    });
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('manages API key in localStorage and provides a safe masked representation', () => {
    expect(service.hasApiKey()).toBe(false);
    expect(service.getApiKey()).toBeUndefined();
    expect(service.getMaskedApiKey()).toBe('');

    service.setApiKey('AIzaSyDUMMYKEY1234567890XYZ');
    expect(service.hasApiKey()).toBe(true);
    expect(service.getApiKey()).toBe('AIzaSyDUMMYKEY1234567890XYZ');
    expect(service.getMaskedApiKey()).toBe('AIzaSy...0XYZ');

    service.setApiKey('');
    expect(service.hasApiKey()).toBe(false);
    expect(service.getApiKey()).toBeUndefined();
  });

  it('builds system prompt with accurate festival persona context for any character', () => {
    const promptPien = service.buildSystemPrompt('Pień aka Peposz');
    expect(promptPien).toContain('Gospodarz Pola');
    expect(promptPien).toContain('Kurwa Moje Pole');
    expect(promptPien).toContain('Pol\'and\'Rock');
    expect(promptPien).toContain('TTS');

    const promptZawor = service.buildSystemPrompt('Zawór');
    expect(promptZawor).toContain('Zawór');
    expect(promptZawor).toContain('Hydraulik');

    const promptKorba = service.buildSystemPrompt('Korba');
    expect(promptKorba).toContain('Korba');
    expect(promptKorba).toContain('Tancerka');

    const promptHemoroid = service.buildSystemPrompt('Hemoroid');
    expect(promptHemoroid).toContain('Hemoroid');
  });

  it('cleans markdown, bracketed actions, emojis, and quotes from raw LLM responses', () => {
    const raw = `"*uśmiecha się szeroko* Siemanko brachu! **Jasne**, że pole jest nasze! (kiwa głową) 🎸🔥"`;
    const cleaned = service.cleanResponseText(raw);
    expect(cleaned).toBe('Siemanko brachu! Jasne, że pole jest nasze!');
    expect(cleaned).not.toContain('*');
    expect(cleaned).not.toContain('(');
    expect(cleaned).not.toContain('🎸');
  });

  it('requires Gemini API key and informs user when API key is missing', async () => {
    const result = await service.generateResponse('Pień aka Peposz', 'Czyje to pole?');
    expect(result.source).toBe('error');
    expect(result.error).toContain('Gemini');
    expect(result.text).toContain('Gemini');
  });

  it('successfully queries Gemini API when valid key is set and caches conversation history', async () => {
    service.setApiKey('VALID_TEST_KEY');

    const fakeResponseData = {
      candidates: [
        {
          content: {
            parts: [{ text: '*odkłada puszkę* To jest moje pole i nikt mi go nie zabierze!' }],
          },
        },
      ],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => fakeResponseData,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await service.generateResponse('Pień aka Peposz', 'Siema Peposz!');
    expect(fetchMock).toHaveBeenCalled();
    expect(result.source).toBe('gemini');
    expect(result.text).toBe('To jest moje pole i nikt mi go nie zabierze!');

    // Second call should include previous turns in history:
    await service.generateResponse('Pień aka Peposz', 'A piwa dasz?');
    const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(secondCallBody.contents.length).toBe(3); // 2 history items + 1 current message
  });

  it('reports connection error when Gemini API call fails without offline fallback', async () => {
    service.setApiKey('SOME_KEY');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const result = await service.generateResponse('Zawór', 'Gdzie jest woda?');
    expect(result.source).toBe('error');
    expect(result.error).toBeDefined();
    expect(result.text).toContain('Gemini');
  });
});
