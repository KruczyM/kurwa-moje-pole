import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AfterJoystick } from './AfterJoystick';
import { SpriteAnimator, type SpriteMetadata } from '../presentation/SpriteAnimator';
import { AfterCampaign } from '../AfterCampaign';

describe('After analog joystick', () => {
  it('keeps one movement owner and ignores other fingers', () => {
    const stick = new AfterJoystick();
    expect(stick.begin(1)).toBe(true);
    expect(stick.begin(2)).toBe(false);
    stick.move(2, 40, 0, 40);
    expect(stick.snapshot().x).toBe(0);
    stick.move(1, 40, 0, 40);
    stick.end(2);
    expect(stick.snapshot().x).toBe(1);
    stick.end(1);
    expect(stick.snapshot()).toEqual({ x: 0, y: 0, knobX: 0, knobY: 0 });
    expect(stick.begin(2)).toBe(true);
  });

  it('clamps diagonals, retains analog speed and suppresses center drift', () => {
    const stick = new AfterJoystick();
    stick.begin(1);
    stick.move(1, 100, -100, 40);
    const full = stick.snapshot();
    expect(Math.hypot(full.x, full.y)).toBeCloseTo(1);
    expect(full.x).toBeGreaterThan(0);
    expect(full.y).toBeLessThan(0);
    expect(Math.hypot(full.knobX, full.knobY)).toBeCloseTo(40);
    stick.move(1, 20, 0, 40);
    expect(stick.snapshot().x).toBeGreaterThan(0);
    expect(stick.snapshot().x).toBeLessThan(1);
    stick.move(1, 2, -2, 40);
    expect(stick.snapshot().x).toBe(0);
    expect(stick.snapshot().y).toBe(0);
  });

  it('resets on overlay/lifecycle and rejects invalid geometry', () => {
    const stick = new AfterJoystick();
    stick.begin(3);
    stick.move(3, 40, 0, 40);
    stick.move(3, NaN, 0, 40);
    expect(stick.snapshot().x).toBe(1);
    stick.reset();
    stick.move(3, 40, 0, 40);
    expect(stick.snapshot().x).toBe(0);
    stick.begin(4);
    stick.move(4, 40, 0, 0);
    expect(stick.snapshot().x).toBe(0);
  });

  it('moves the campaign in the expected direction with normalized diagonal speed', () => {
    const stick = new AfterJoystick();
    stick.begin(1);
    stick.move(1, 40, -40, 40);
    const campaign = new AfterCampaign();
    campaign.addPlayer('local', 'Amper');
    const before = campaign.snapshot().world.players[0].position;
    const { x, y } = stick.snapshot();
    campaign.setInput('local', { moveX: x, moveY: y, sprint: false });
    campaign.advance(1 / 30);
    const after = campaign.snapshot().world.players[0].position;
    expect(after.x).toBeGreaterThan(before.x);
    expect(after.y).toBeLessThan(before.y);
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeCloseTo(2.4 / 30);
  });

  it.each(['amper', 'chlebak'])(
    'corrects authored left/right rows for %s without changing world axes',
    (id) => {
      const meta = JSON.parse(
        readFileSync(`public/game-assets/2d/after/characters/${id}/meta.json`, 'utf8'),
      ) as SpriteMetadata;
      const animator = new SpriteAnimator(meta);
      expect(animator.update(0, 'east', true).y).toBe(3 * 64);
      expect(animator.update(0, 'west', true).y).toBe(64);
      expect(animator.update(0, 'north', true).y).toBe(2 * 64);
      expect(animator.update(0, 'south', true).y).toBe(0);
    },
  );
});
