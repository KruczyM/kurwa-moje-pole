#!/usr/bin/env python3
"""
csound_export_guitar_samples.py — Generuje autentyczne próbki stalowej gitary akustycznej
z programu Csound (C:\Program Files\Csound6_x64) dla gry na gitarze ogniskowej.

Wymagania:
- Csound 6.18+ (C:\Program Files\Csound6_x64\bin\csound.exe)
- General MIDI SoundBank (sf_GMbank.sf2) — preset 25: Steel Guitar
- ffmpeg (na PATH)
"""

import os
import subprocess
import wave
import struct
import math

CSOUND_BIN = r"C:\Program Files\Csound6_x64\bin\csound.exe"
SF2_PATH = r"C:/Program Files/Csound6_x64/samples/sf_GMbank.sf2"

WORKTREE_ROOT = r"E:\kodowanie\gra\.ai\worktrees\guitar-perf-audio"
MAIN_ROOT = r"E:\kodowanie\gra"

OUTPUT_DIRS = [
    os.path.join(WORKTREE_ROOT, "public", "game-assets", "audio", "guitar", "samples"),
    os.path.join(MAIN_ROOT, "public", "game-assets", "audio", "guitar", "samples"),
]

SCRATCH_DIR = r"C:\Users\krucz\.gemini\antigravity\brain\3cd61d16-b35b-410b-9606-3c32e334e666\scratch\csound_samples"
os.makedirs(SCRATCH_DIR, exist_ok=True)

SAMPLE_NOTE_NAMES = [
    'E2', 'F2', 'Gb2', 'G2', 'Ab2', 'A2', 'Bb2', 'B2',
    'C3', 'Db3', 'D3', 'Eb3', 'E3', 'F3', 'Gb3', 'G3', 'Ab3', 'A3', 'Bb3', 'B3',
    'C4', 'Db4', 'D4', 'Eb4', 'E4', 'F4', 'Gb4', 'G4', 'Ab4', 'A4', 'Bb4', 'B4',
    'C5', 'Db5', 'D5', 'Eb5', 'E5', 'F5', 'Gb5', 'G5', 'Ab5', 'A5',
]

SEMITONES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}

def note_to_midi(name: str) -> int:
    letter = name[0]
    rest = name[1:]
    accidental = -1 if rest.startswith('b') else (1 if rest.startswith('#') else 0)
    octave = int(rest[1:]) if accidental != 0 else int(rest)
    return (octave + 1) * 12 + SEMITONES[letter] + accidental

def get_note_duration(midi: int) -> float:
    # Struny basowe mają większą masę i drgają dłużej
    if midi < 48:      # E2 - B2
        return 2.8
    elif midi < 60:    # C3 - B3
        return 2.5
    elif midi < 72:    # C4 - B4
        return 2.2
    else:              # C5 - A5
        return 1.9

def render_note(name: str, midi: int) -> str:
    dur = get_note_duration(midi)
    # Velocity 106 daje naturalne, wyraziste uderzenie kostki w strunę stalową
    vel = 106

    csd_content = f"""<CsoundSynthesizer>
<CsOptions>
-o "{SCRATCH_DIR}/{name}.raw.wav" -W -m0
</CsOptions>
<CsInstruments>
sr = 44100
ksmps = 32
nchnls = 2
0dbfs = 32768

giSf sfload "{SF2_PATH}"
; Preset 25: Steel Guitar (Bank 0)
giSteel sfpreset 25, 0, giSf, 0

instr 1
  iMidi = p4
  iVel = p5
  ; sfplay3: a1, a2 sfplay3 iVel, iKey, iAmp, iFrq, iPreset
  aL, aR sfplay3 iVel, iMidi, 1.0, 1.0, giSteel

  ; Naturalny koniec z mikroskopijnym wygaszeniem zapobiegającym trzaskom (anti-click)
  kEnv linen 1, 0.0005, p3, 0.12
  outs aL * kEnv, aR * kEnv
endin
</CsInstruments>
<CsScore>
i 1 0.0 {dur} {midi} {vel}
e
</CsScore>
</CsoundSynthesizer>
"""
    csd_path = os.path.join(SCRATCH_DIR, f"{name}.csd")
    with open(csd_path, "w", encoding="utf-8") as f:
        f.write(csd_content)

    res = subprocess.run([CSOUND_BIN, csd_path], capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"Csound failed on {name}: {res.stderr}")

    raw_wav = os.path.join(SCRATCH_DIR, f"{name}.raw.wav")
    norm_wav = os.path.join(SCRATCH_DIR, f"{name}.norm.wav")

    # Normalizacja poziomu głośności do -0.8 dBFS (peak = 29500 / 32768)
    with wave.open(raw_wav, "rb") as wf:
        params = wf.getparams()
        nframes = wf.getnframes()
        data = wf.readframes(nframes)
        shorts = list(struct.unpack(f"{nframes*2}h", data))
        peak = max(abs(s) for s in shorts) if shorts else 1

    target_peak = 29500
    gain = target_peak / max(1, peak)
    norm_shorts = [int(max(-32767, min(32767, s * gain))) for s in shorts]
    norm_data = struct.pack(f"{len(norm_shorts)}h", *norm_shorts)

    with wave.open(norm_wav, "wb") as wf:
        wf.setparams(params)
        wf.writeframes(norm_data)

    return norm_wav

def main():
    print(f"=== Generowanie {len(SAMPLE_NOTE_NAMES)} próbek gitary stalowej z Csound ===")
    print(f"Csound: {CSOUND_BIN}")
    print(f"SoundBank: {SF2_PATH} (Preset 25: Steel Guitar)")

    for out_dir in OUTPUT_DIRS:
        os.makedirs(out_dir, exist_ok=True)

    success_count = 0
    for idx, name in enumerate(SAMPLE_NOTE_NAMES, 1):
        midi = note_to_midi(name)
        norm_wav = render_note(name, midi)

        # Kompresja ffmpeg do 192k MP3 (studyjna czystość)
        mp3_tmp = os.path.join(SCRATCH_DIR, f"{name}.mp3")
        cmd = [
            "ffmpeg", "-y", "-i", norm_wav,
            "-codec:a", "libmp3lame",
            "-b:a", "192k",
            "-ar", "44100",
            mp3_tmp
        ]
        subprocess.run(cmd, capture_output=True, check=True)

        # Kopiuj do katalogów docelowych
        with open(mp3_tmp, "rb") as f:
            mp3_bytes = f.read()

        for out_dir in OUTPUT_DIRS:
            target_path = os.path.join(out_dir, f"{name}.mp3")
            with open(target_path, "wb") as f:
                f.write(mp3_bytes)

        file_size = len(mp3_bytes)
        print(f"[{idx:02d}/{len(SAMPLE_NOTE_NAMES)}] {name:4s} (MIDI {midi:2d}) -> {file_size/1024:.1f} KB OK")
        success_count += 1

    print(f"\nUkonczono pomyslnie wygenerowanie {success_count} probek z Csound!")

if __name__ == "__main__":
    main()
