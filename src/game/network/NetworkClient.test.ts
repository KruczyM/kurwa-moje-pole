import { describe, it, expect, beforeEach } from 'vitest';
import { NetworkClient } from './NetworkClient';

describe('NetworkClient', () => {
  let client: NetworkClient;

  beforeEach(() => {
    client = new NetworkClient({ autoConnect: false });
  });

  it('inicjalizuje się ze statusem disconnected i domyślnym tokenem sesji', () => {
    expect(client.getStatus()).toBe('disconnected');
    expect(client.getSessionToken()).toBeTruthy();
    expect(client.getNickname()).toBeTruthy();
  });

  it('waliduje i zapisuje pseudonim', () => {
    const valid = client.setNickname('NowyGracz');
    expect(valid.valid).toBe(true);
    expect(client.getNickname()).toBe('NowyGracz');

    const invalid = client.setNickname('A');
    expect(invalid.valid).toBe(false);
    expect(client.getNickname()).toBe('NowyGracz'); // nie zmieniono po błędzie
  });

  it('powiadamia słuchaczy o zmianie statusu', () => {
    const statuses: string[] = [];
    const unsubscribe = client.onStatusChange((s) => statuses.push(s));

    expect(statuses).toEqual(['disconnected']);
    unsubscribe();
  });
});
