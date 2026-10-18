import { describe, expect, it } from 'vitest';
import { FlankiSession } from './FlankiSession';

describe('Flanki lobby', () => {
  it('only lets the host choose a valid teammate as runner before the start', () => {
    const session = new FlankiSession(() => 'match');
    session.join({ id: 'host', name: 'Host', character: 'Amper' });
    session.join({ id: 'guest', name: 'Guest', character: 'Antena' });
    expect(session.selectRunner('guest', 'B', 'guest')).toBe(false);
    expect(session.selectRunner('host', 'A', 'guest')).toBe(false);
    expect(session.selectRunner('host', 'B', 'guest')).toBe(true);
    const state = session.getState()!;
    expect(state.runners?.B).toBe('guest');
    state.runners!.B = 'other';
    expect(session.getState()!.runners?.B).toBe('guest');
    session.start('host');
    expect(session.selectRunner('host', 'B', 'pien')).toBe(false);
  });
  const player = (id: string) => ({ id, name: id, character: 'Amper' });
  it('balances up to four humans and only the host can lock the roster', () => {
    const session = new FlankiSession(() => 'match');
    ['one', 'two', 'three', 'four'].forEach((id) => expect(session.join(player(id))).toBe(true));
    expect(session.join(player('five'))).toBe(false);
    expect(session.getState()!.players.map((entry) => entry.team)).toEqual(['A', 'B', 'A', 'B']);
    expect(session.start('two')).toBe(false);
    expect(session.start('one')).toBe(true);
    expect(session.join(player('late'))).toBe(false);
    expect(session.accepts('two', 'match', false)).toBe(true);
    expect(session.accepts('two', 'match', true)).toBe(false);
    expect(session.accepts('one', 'old', true)).toBe(false);
  });
  it('ends a running match if a participant disconnects; snapshots do not leak mutable state', () => {
    const session = new FlankiSession(() => 'match');
    session.join(player('one'));
    session.join(player('two'));
    session.getState()!.players.pop();
    expect(session.getState()!.players).toHaveLength(2);
    session.start('one');
    expect(session.leave('stranger')).toBe(false);
    expect(session.leave('two')).toBe(true);
    expect(session.getState()).toBeNull();
  });
  it('allows a new lobby after the host simulation announces a winner', () => {
    let id = 0;
    const session = new FlankiSession(() => `match-${++id}`);
    session.join(player('one'));
    session.start('one');
    session.markFinished('stranger', 'match-1');
    expect(session.join(player('two'))).toBe(false);
    session.markFinished('one', 'match-1');
    expect(session.join(player('two'))).toBe(true);
    expect(session.getState()!.sessionId).toBe('match-2');
    expect(session.getState()!.phase).toBe('waiting');
  });
});
