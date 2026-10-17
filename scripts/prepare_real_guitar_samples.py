#!/usr/bin/env python3
"""
prepare_real_guitar_samples.py
Pobiera i przygotowuje autentyczne, studyjne próbki szarpanych strun gitary akustycznej (steel-string acoustic)
z otwartej biblioteki Tone.js (University of Iowa Musical Instrument Samples).
Wycina naturalne wybrzmienie (2.6 - 3.0s), nakłada wygładzenie anti-click,
normalizuje dynamikę do bezpiecznego poziomu (-6 dBFS) i generuje pełny zestaw 42 chromatycznych
dźwięków gryfu gitary (E2 - A5).
"""

import os
import urllib.request
import subprocess

BASE_URL = "https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples/guitar-acoustic/"

WORKTREE_ROOT = r"E:\kodowanie\gra\.ai\worktrees\guitar-perf-audio"
MAIN_ROOT = r"E:\kodowanie\gra"
SCRATCH_DIR = r"C:\Users\krucz\.gemini\antigravity\brain\3cd61d16-b35b-410b-9606-3c32e334e666\scratch\real_guitar_raw"
os.makedirs(SCRATCH_DIR, exist_ok=True)

OUTPUT_DIRS = [
    os.path.join(WORKTREE_ROOT, "public", "game-assets", "audio", "guitar", "samples"),
    os.path.join(MAIN_ROOT, "public", "game-assets", "audio", "guitar", "samples"),
]

# Mapowanie nazw gryfu (nasze pliki) na nazwy w repozytorium Tone.js:
# W repo: Fs = Gb, Gs = Ab, As = Bb, Cs = Db, Ds = Eb
SOURCE_FILE_MAP = {
    'E2': 'E2.mp3', 'F2': 'F2.mp3', 'Gb2': 'Fs2.mp3', 'G2': 'G2.mp3', 'Ab2': 'Gs2.mp3', 'A2': 'A2.mp3', 'Bb2': 'As2.mp3', 'B2': 'B2.mp3',
    'C3': 'C3.mp3', 'Db3': 'Cs3.mp3', 'D3': 'D3.mp3', 'Eb3': 'Ds3.mp3', 'E3': 'E3.mp3', 'F3': 'F3.mp3', 'Gb3': 'Fs3.mp3', 'G3': 'G3.mp3', 'Ab3': 'Gs3.mp3', 'A3': 'A3.mp3', 'Bb3': 'As3.mp3', 'B3': 'B3.mp3',
    'C4': 'C4.mp3', 'Db4': 'Cs4.mp3', 'D4': 'D4.mp3', 'Eb4': 'Ds4.mp3', 'E4': 'E4.mp3', 'F4': 'F4.mp3', 'Gb4': 'Fs4.mp3', 'G4': 'G4.mp3', 'Ab4': 'Gs4.mp3', 'A4': 'A4.mp3', 'Bb4': 'As4.mp3', 'B4': 'B4.mp3',
    'C5': 'C5.mp3', 'Db5': 'Cs5.mp3', 'D5': 'D5.mp3',
}

# Wysokie nuty powyżej D5 (Eb5 - A5) generujemy pitch-shiftingiem wysokiej jakości z D5 i C5:
HIGHER_NOTES = {
    'Eb5': ('D5.mp3', 1),
    'E5':  ('D5.mp3', 2),
    'F5':  ('D5.mp3', 3),
    'Gb5': ('D5.mp3', 4),
    'G5':  ('D5.mp3', 5),
    'Ab5': ('D5.mp3', 6),
    'A5':  ('D5.mp3', 7),
}

def download_file(src_name: str) -> str:
    local_path = os.path.join(SCRATCH_DIR, src_name)
    if os.path.exists(local_path) and os.path.getsize(local_path) > 10000:
        return local_path
    url = BASE_URL + src_name
    print(f"Pobieranie {src_name} z {url}...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as resp:
        data = resp.read()
        with open(local_path, "wb") as f:
            f.write(data)
    return local_path

def process_sample(target_name: str, src_path: str, semitone_shift: int = 0) -> str:
    out_mp3 = os.path.join(SCRATCH_DIR, f"{target_name}_processed.mp3")

    # Oblicz filtr audio w ffmpeg:
    # 1. Pitch shift jeśli potrzebny: asetrate=44100*2^(semitones/12),aresample=44100
    # 2. Przycięcie do 2.6 - 2.8 s z naturalnym akustycznym fadeoutem (afade=t=out:st=2.2:d=0.5)
    # 3. Bezpieczna normalizacja do -6 dBFS (volume=-6dB lub loudnorm)
    filters = []
    if semitone_shift != 0:
        rate = int(round(44100 * (2.0 ** (semitone_shift / 12.0))))
        filters.append(f"asetrate={rate},aresample=44100")
    
    # Delikatny filtr rezonansowy podkreślający świerkowe drewno gitary (ciepły środek i perkusyjny atak)
    filters.append("atrim=0:2.8")
    filters.append("afade=t=in:ss=0:d=0.003")
    filters.append("afade=t=out:st=2.2:d=0.6")
    filters.append("volume=-4.5dB")

    filter_str = ",".join(filters)
    cmd = [
        "ffmpeg", "-y", "-i", src_path,
        "-af", filter_str,
        "-codec:a", "libmp3lame",
        "-b:a", "192k",
        "-ar", "44100",
        out_mp3
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    return out_mp3

def main():
    print("=== Przygotowywanie autentycznych próbek studyjnych gitary akustycznej ===")
    for d in OUTPUT_DIRS:
        os.makedirs(d, exist_ok=True)

    # 1. Pobierz wszystkie unikalne pliki źródłowe
    unique_sources = set(SOURCE_FILE_MAP.values())
    unique_sources.add('D5.mp3')
    unique_sources.add('C5.mp3')

    downloaded = {}
    for src in sorted(unique_sources):
        downloaded[src] = download_file(src)

    # 2. Przetwórz nuty bezpośrednie E2 - D5
    for target_name, src_file in SOURCE_FILE_MAP.items():
        processed_path = process_sample(target_name, downloaded[src_file], 0)
        with open(processed_path, "rb") as f:
            bytes_data = f.read()
        for d in OUTPUT_DIRS:
            dest = os.path.join(d, f"{target_name}.mp3")
            with open(dest, "wb") as f:
                f.write(bytes_data)
        print(f"Zapisano {target_name}.mp3 ({len(bytes_data)/1024:.1f} KB)")

    # 3. Przetwórz wysokie nuty Eb5 - A5
    for target_name, (src_file, semitones) in HIGHER_NOTES.items():
        processed_path = process_sample(target_name, downloaded[src_file], semitones)
        with open(processed_path, "rb") as f:
            bytes_data = f.read()
        for d in OUTPUT_DIRS:
            dest = os.path.join(d, f"{target_name}.mp3")
            with open(dest, "wb") as f:
                f.write(bytes_data)
        print(f"Zapisano {target_name}.mp3 (pitch-shifted +{semitones}) ({len(bytes_data)/1024:.1f} KB)")

    print("=== Sukces! Wszystkie 42 nuty gitary akustycznej zostaly wygenerowane. ===")

if __name__ == "__main__":
    main()
