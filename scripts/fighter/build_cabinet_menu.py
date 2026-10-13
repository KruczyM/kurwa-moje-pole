"""Compose the cabinet's original 120 BPM chiptune. Writes only menu + its metadata.

Run independently: python scripts/fighter/build_cabinet_menu.py
No samples, network, credentials or shared random state are used.
"""
from pathlib import Path
import json
import wave
import numpy as np

RATE = 22050
BEAT = .5
DURATION = 64
OUT = Path(__file__).resolve().parents[2] / 'public/game-assets/2d/fighter/audio-v2'


def generate():
    rng = np.random.default_rng(2026101301)
    length = int(DURATION * RATE)
    left = np.zeros(length)
    right = np.zeros(length)

    def add(at, sound, gain, pan=0):
        # Wrap tails into the beginning so reverberation continues across loops.
        indices = (int(at * RATE) + np.arange(len(sound))) % length
        left[indices] += sound * gain * (1 - pan * .35)
        right[indices] += sound * gain * (1 + pan * .35)

    def chip(note, duration, bass=False):
        t = np.arange(int(duration * RATE)) / RATE
        freq = 440 * 2 ** ((note - 69) / 12)
        # Limited harmonics give a soft pulse timbre without sharp square-wave edges.
        signal = np.sin(2 * np.pi * freq * t)
        for harmonic, amplitude in ((3, .19), (5, .055)):
            signal += amplitude * np.sin(2 * np.pi * freq * harmonic * t)
        envelope = np.minimum(t / .009, 1) * np.minimum((duration - t) / .045, 1)
        envelope *= np.exp(-t / duration * (1.2 if bass else 2))
        return signal * envelope

    def drum(kind):
        duration = .28 if kind == 'kick' else .14
        t = np.arange(int(duration * RATE)) / RATE
        if kind == 'kick':
            phase = 2 * np.pi * (48 * t + 100 * .025 * (1 - np.exp(-t / .025)))
            sound = np.sin(phase) * np.exp(-t * 22)
        else:
            raw = rng.normal(0, .4, len(t))
            sound = np.convolve(raw, np.ones(5) / 5, mode='same')
            sound *= np.exp(-t * (45 if kind == 'snare' else 95))
            if kind == 'snare':
                sound += .22 * np.sin(2 * np.pi * 185 * t) * np.exp(-t * 35)
        return sound * np.minimum(t / .002, 1)

    # A minor / F / C / G, with an original call-and-response melody.
    roots = [45, 41, 48, 43]
    motifs = [
        [0, 7, 12, 10, 7, 3, 5, 7],
        [12, 10, 7, 3, 5, 7, 3, 0],
        [7, 12, 15, 12, 10, 7, 5, 3],
        [5, 7, 10, 7, 3, 5, 7, 0],
    ]
    for bar in range(32):
        root = roots[(bar // 2) % 4]
        section = bar // 8
        for step in range(8):
            at = (bar * 4 + step / 2) * BEAT
            if step in (0, 3, 4) or (bar % 4 == 3 and step == 7):
                add(at, drum('kick'), .31)
            if step in (2, 6):
                add(at, drum('snare'), .28)
            add(at, drum('hat'), .11, -.4 if step % 2 else .4)
            bass_note = root + (12 if step in (3, 7) else 7 if step == 5 else 0)
            add(at, chip(bass_note, BEAT * .42, True), .13)
            # B section answers the A melody in a different register and rhythm.
            if step % 2 == 0 or (section % 2 == 1 and step in (3, 7)):
                note = root + 24 + motifs[section][(step + bar % 2 * 4) % 8]
                if section == 2:
                    note -= 12
                voice = chip(note, BEAT * .72)
                add(at, voice, .09, -.25)
                add(at + BEAT * .75, voice, .021, .65)
            if section in (1, 3):
                arp_note = root + 12 + [0, 7, 12, 7][step % 4]
                add(at + BEAT * .25, chip(arp_note, BEAT * .3), .035, .55)
        # Soft chord stabs tie the rhythm and melody together.
        third = 3 if (bar // 2) % 4 == 0 else 4
        for interval in (0, third, 7):
            add((bar * 4 + 1.5) * BEAT, chip(root + 12 + interval, BEAT * 1.2), .025, -.5)

    stereo = np.column_stack((left, right))
    # Gentle low-pass smoothing; retain headroom for UI sounds.
    for channel in range(2):
        stereo[:, channel] = sum(np.roll(stereo[:, channel], shift) for shift in range(3)) / 3
    peak = np.max(np.abs(stereo))
    stereo *= min(1, .72 / peak)
    OUT.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT / 'menu.wav'), 'wb') as stream:
        stream.setnchannels(2)
        stream.setsampwidth(2)
        stream.setframerate(RATE)
        stream.writeframes((stereo * 32767).astype('<i2').tobytes())
    manifest_path = OUT / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    manifest['music']['menu'] = {
        'bpm': 120, 'bars': 32, 'title': 'Bloto, pot i combo',
        'generator': 'scripts/fighter/build_cabinet_menu.py',
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print('Generated original cabinet menu: 120 BPM, 32 bars, 64 seconds; fight/SFX untouched.')


if __name__ == '__main__':
    generate()
