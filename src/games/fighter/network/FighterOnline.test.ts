import { FIGHTER_PROTOCOL } from './fighterProtocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FighterSimulation } from '../simulation/FighterSimulation';
import { amperDefinition } from '../data/fighters/amper';
import type { FighterFrame, FighterReply, FighterRoomState } from './fighterProtocol';

const mock = vi.hoisted(() => {
  const handlers = new Map<string, (...args: any[]) => void>();
  const socket = {
    connected: true,
    on: vi.fn((name: string, handler: (...args: any[]) => void) => handlers.set(name, handler)),
    connect: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(() => handlers.clear()),
    timeout: vi.fn(),
    emit: vi.fn(),
  };
  return { handlers, socket };
});
vi.mock('socket.io-client', () => ({ io: () => mock.socket }));
vi.mock('../../../game/network/NetworkClient', () => ({ resolveServerUrl: () => 'https://example.test' }));
import { FighterOnline } from './FighterOnline';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  mock.handlers.clear();
});

describe('fighter client session ordering', () => {
  it('delivers a resumed snapshot after membership ack, deduplicates it and resets between rooms', async () => {
    vi.stubGlobal('sessionStorage', { getItem: () => 'null', setItem: vi.fn() });
    const order: string[] = [];
    const frames: FighterFrame[] = [];
    const online = new FighterOnline(
      (room) => {
        if (room) order.push(room.code);
      },
      (frame) => {
        order.push('frame');
        frames.push(frame);
      },
      vi.fn(),
    );
    let acknowledge!: (error: null, reply: FighterReply) => void;
    mock.socket.timeout.mockReturnValue({
      emit: (_event: string, _request: unknown, ack: typeof acknowledge) => {
        acknowledge = ack;
      },
    });
    const room = { code: 'ABCDEF', revision: 1, phase: 'finished' } as FighterRoomState;
    const frame: FighterFrame = {
      sequence: 10,
      matchId: 1,
      snapshot: new FighterSimulation(amperDefinition, amperDefinition).getSnapshot(),
      events: [],
    };
    online.open('join', room.code);
    const joining = mock.handlers.get('fighter:hello')!({ version: FIGHTER_PROTOCOL });
    mock.handlers.get('fighter:frame')!(frame);
    expect(frames).toHaveLength(0);
    acknowledge(null, { room, seat: 1, token: 'own-token' });
    await joining;
    expect(order).toEqual(['ABCDEF', 'frame']);
    expect(online.seat).toBe(1);
    mock.handlers.get('fighter:frame')!(frame);
    expect(frames).toHaveLength(1);
    mock.socket.emit.mockClear();
    online.close(false);
    expect(mock.socket.emit).not.toHaveBeenCalled();
    expect(mock.socket.removeAllListeners).toHaveBeenCalled();
    online.open('create');
    const creating = mock.handlers.get('fighter:hello')!({ version: FIGHTER_PROTOCOL });
    acknowledge(null, { room: { ...room, code: '123456' }, seat: 0, token: 'new-token' });
    await creating;
    mock.handlers.get('fighter:frame')!({ ...frame, sequence: 1 });
    expect(frames).toHaveLength(2);
    expect(order.slice(-2)).toEqual(['123456', 'frame']);
    online.close();
    expect(mock.socket.emit).toHaveBeenCalledWith(
      'fighter:request',
      { action: 'leave' },
      expect.any(Function),
    );
  });
});
