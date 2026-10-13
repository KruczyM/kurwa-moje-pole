"""Original deterministic arcade score and layered combat Foley; no external samples."""
from pathlib import Path
import json
import wave
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/game-assets/2d/fighter/audio-v2'
RATE = 22050
RNG = np.random.default_rng(20261013)


def tone(duration, start, end=None, decay=5, harmonics=0):
    t = np.arange(int(duration * RATE)) / RATE
    end = start if end is None else end
    phase = 2 * np.pi * (start * t + (end - start) * t * t / (2 * duration))
    env = np.minimum(1, t / .008) * np.exp(-decay * t / duration)
    return (np.sin(phase) + harmonics * np.sin(phase * 2)) * env


def noise(duration, decay=5, smooth=3, high=False):
    t = np.arange(int(duration * RATE)) / RATE
    raw = RNG.normal(0, .45, len(t))
    filtered = np.convolve(raw, np.ones(smooth) / smooth, mode='same')
    signal = raw - filtered if high else filtered
    return signal * np.minimum(1, t / .003) * np.exp(-decay * t / duration)


def mix(duration, events):
    result = np.zeros(int(duration * RATE))
    for at, sound, gain in events:
        start = int(at * RATE)
        end = min(len(result), start + len(sound))
        if end > start:
            result[start:end] += sound[:end-start] * gain
    return result


def write(name, sound):
    OUT.mkdir(parents=True, exist_ok=True)
    peak = np.max(np.abs(sound))
    if peak > .92:
        sound = sound * .92 / peak
    with wave.open(str(OUT / (name + '.wav')), 'wb') as stream:
        stream.setnchannels(1 if sound.ndim == 1 else 2)
        stream.setsampwidth(2)
        stream.setframerate(RATE)
        stream.writeframes((sound * 32767).astype('<i2').tobytes())


def score(name, bpm, combat):
    beat = 60 / bpm
    duration = beat * 64
    events = []
    roots = [110, 87.307, 130.813, 97.999]
    melody = [0, 7, 10, 12, 7, 3, 10, 5]
    for step in range(128):
        at = step * beat / 2
        root = roots[(step // 32) % 4]
        if step % 2 == 0 or (combat and step % 8 == 7):
            events.append((at, tone(.35, 145, 43, 8), .8 if combat else .36))
        if step % 8 in (2, 6):
            snare = mix(.24, [(0, noise(.2, 9, 2, True), 1.1), (0, tone(.15, 190, 145, 7), .35)])
            events.append((at, snare, .55 if combat else .15))
        events.append((at, noise(.07, 10, 2, True), .12 if combat else .05))
        if combat and step % 8 == 5:
            events.append((at + beat / 4, noise(.06, 8, 2, True), .09))
        bass = root / 2 * (2 if step % 8 == 7 else 1)
        events.append((at, tone(beat * .43, bass, decay=2, harmonics=.18), .27))
        if step % (2 if combat else 4) == 0:
            freq = root * 2 ** (melody[(step // 2) % len(melody)] / 12)
            events.append((at, tone(beat * 1.5, freq * 2, decay=4, harmonics=.16), .09))
            events.append(((at + beat * .75) % duration, tone(beat, freq * 2.005, decay=6), .025))
    for bar in range(16):
        root = roots[(bar // 4) % 4]
        for semitone in (0, 3, 7):
            pad = tone(beat * 4, root * 2 ** (semitone / 12), decay=.4)
            t = np.linspace(0, 1, len(pad))
            pad *= np.sin(np.pi * t) ** 2
            events.append((bar * beat * 4, pad, .035 if combat else .07))
    mono = mix(duration, events)
    # Short stereo delay wraps at the loop boundary; quiet headroom preserves hits.
    stereo = np.column_stack((mono, mono * .88 + np.roll(mono, int(.013 * RATE)) * .12)) * .65
    write(name, stereo)


def main():
    score('menu', 104, False)
    score('fight', 136, True)
    body = mix(.32, [(0, tone(.25, 125, 48, 7), .8), (0, noise(.14, 9, 5), 1.3)])
    heavy = mix(.48, [(0, tone(.4, 90, 30, 6), .9), (0, noise(.22, 8, 4), 1.6), (.025, noise(.1, 10, 2, True), .4)])
    effects = {
        'punch': body,
        'heavy': heavy,
        'kick': mix(.4, [(0, body, .8), (0, tone(.3, 170, 45, 7), .55)]),
        'guard': mix(.2, [(0, noise(.15, 10, 14), 1), (0, tone(.16, 155, 100, 9), .45)]),
        'launch': mix(.65, [(0, heavy, 1), (.035, noise(.5, 3, 8), .4), (.06, tone(.5, 120, 1200, 2), .16)]),
        'land': mix(.45, [(0, tone(.4, 75, 25, 7), .9), (0, noise(.24, 9, 14), 1.4)]),
        'swing': noise(.16, 4, 7),
        'swing-heavy': noise(.27, 3, 9),
        'select': tone(.1, 650, 850, 7),
        'ready': mix(.55, [(0, tone(.3, 660, decay=4), .35), (.11, tone(.35, 880, decay=4), .35), (.22, tone(.3, 1320, decay=4), .25)]),
        'empty': mix(.16, [(0, tone(.16, 140, 100, 5, .3), .4)]),
        'bell': mix(.8, [(0, tone(.8, 740, decay=6), .4), (0, tone(.8, 1110, decay=8), .2)]),
        'ko': mix(.8, [(0, heavy, 1), (.03, tone(.7, 100, 25, 5), .7)]),
        'charge': mix(.85, [(0, noise(.85, .3, 6), .22), (0, tone(.85, 100, 800, .3), .22)]),
    }
    glass = mix(.9, [(i * .035, tone(.5, 1400 + i * 237, decay=10), .16) for i in range(12)] + [(0, noise(.4, 8, 2, True), 1)])
    water = noise(1.1, 1, 14)
    paper = mix(1.1, [(i * .08, noise(.23, 5, 3, True), .55) for i in range(9)])
    motifs = {
        'amper': [(0, glass, 1), (0, heavy, .6)],
        'korba': [(i * .09, noise(.24, 3, 6), .65) for i in range(8)] + [(.1, heavy, .5)],
        'kobra': [(0, water, 1), (.06, noise(.25, 5, 5), 1.5)],
        'antena': [(0, tone(.9, 1800, 220, 2, .3), .4), (0, noise(.6, 3, 4), .4)],
        'gruczol': [(0, tone(1.1, 180, 45, 1, .2), .35), (0, water, 1.3), (0, paper, .8), (.04, heavy, .5)],
        'klatwa': [(0, tone(1.1, 360, 120, 2, .5), .35), (.02, noise(.9, 3, 30), 1.3), (0, heavy, .5)],
        'krwiak': [(0, heavy, 1), (0, tone(.7, 420, 130, 6, .3), .5)],
        'pien': [(0, tone(1.1, 240, 155, 2, .7), .45), (0, noise(.8, 4, 15), 1.2)],
        'pierscien': [(0, tone(1.1, 95, 30, 3, .2), .85), (0, heavy, .7)],
        'zawor': [(i * .1, tone(.5, 340 * 2 ** (i/6), 600, 4, .2), .23) for i in range(7)] + [(.02, noise(.4, 5, 3), .8)],
        'ambona': [(0, heavy, .7), (0, tone(.8, 510, 170, 5, .45), .5), (.05, paper, .35)],
        'chlebak': [(i * .12, tone(.15, 1400 if i%2 else 180, 160 if i%2 else 1200, 3, .3), .2) for i in range(6)] + [(.02, tone(.8, 70, 35, 5), .7)],
        'dziaslo': [(0, heavy, 1), (0, tone(1.1, 65, 20, 4), .8), (0, noise(1.1, 3, 18), 1.1)],
        'hemoroid': [(0, tone(1.1, 95, 40, 2, .7), .6), (0, noise(.8, 3, 4), .7), (.04, heavy, .9)],
        'jeczmien': [(i * .09, noise(.07, 9, 2, True), .9) for i in range(8)] + [(0, noise(1.1, 3, 7), .6)],
        'szerszen': [(0, noise(1.1, 2, 4, True), .6), (0, tone(1.1, 160, 80, 3, .15), .4), (.04, glass, .45)],
    }
    for name, events in motifs.items():
        effects['ultimate-' + name] = mix(1.25, events)
    for name, sound in effects.items():
        write(name, sound)
    manifest = {'version': 2, 'sampleRate': RATE, 'provenance': 'Original deterministic synthesis; no third-party samples, voices or paid services.', 'music': {'menu': {'bpm': 104, 'bars': 16}, 'fight': {'bpm': 136, 'bars': 16}}, 'effects': sorted(effects)}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(f'Generated {len(effects)} effects and 2 original stereo music loops in {OUT}')


if __name__ == '__main__':
    main()
