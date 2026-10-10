"""Import licensed MIDI melodies into complete, deterministic five-lane charts.
Requires mido. Original MIDI/LilyPond files are retained alongside the game assets.
"""
import json
from pathlib import Path
import mido

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    ('ode', 'Oda do radości', 'L. van Beethoven · zapis: Peter Chubb', 'Public Domain', 'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=528'),
    ('amazing', 'Amazing Grace', 'Traditional · arr. Breizh Partitions', 'CC BY-SA 3.0', 'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1832'),
]
USER_SOURCES = [
    ('zegarmistrz-midi', 'Zegarmistrz światła purpurowy', 'Tadeusz Woźniak', 3),
    ('czarny-chleb-midi', 'Czarny chleb i czarna kawa', 'Strachy na Lachy', 0),
    ('pila-tango-midi', 'Piła tango', 'Pidżama Porno', 8),
    ('sen-victoria-midi', 'Sen o Victorii', 'Dżem', 0),
    ('czerwony-cegla-midi', 'Czerwony jak cegła', 'Dżem', 7),
]
SOURCES += [(key,title,artist,'Plik użytkownika — licencja niezweryfikowana',
             f'game-assets/audio/guitar/{key}.mid') for key,title,artist,_ in USER_SOURCES]
CHANNELS = {key:channel for key,_,_,channel in USER_SOURCES}
charts = []
for key, title, artist, license_name, url in SOURCES:
    midi = mido.MidiFile(ROOT / f'public/game-assets/audio/guitar/{key}.mid')
    tempo = 500000
    elapsed = 0.0
    starts = {}
    tracks = midi.tracks if key in CHANNELS else midi.tracks[:2]
    for message in mido.merge_tracks(tracks):
        elapsed += mido.tick2second(message.time, midi.ticks_per_beat, tempo)
        if message.type == 'set_tempo':
            tempo = message.tempo
        if (message.type == 'note_on' and message.velocity and message.channel != 9
            and (key not in CHANNELS or message.channel == CHANNELS[key])):
            starts.setdefault(round(elapsed, 6), []).append(message.note)
    # The upper staff's highest simultaneous voice becomes the guitar melody.
    melody = [(time, max(pitches)) for time, pitches in sorted(starts.items())]
    # Playable reduction, retaining original pitch/timing: up to 5.5 notes/sec.
    if key in CHANNELS:
        reduced = []
        for time,pitch in melody:
            if not reduced or time-reduced[-1][0] >= .18:
                reduced.append((time,pitch))
        melody = reduced
    if not melody:
        raise ValueError(f'No melody in {key}')
    unique = sorted(set(pitch for _, pitch in melody))
    start_offset = melody[0][0]
    names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
    notes = [{'id': f'{key}-{i}', 'lane': min(4, unique.index(pitch)*5//len(unique)),
              'time': round(time-start_offset+2.5, 6), 'chordName': f'{names[pitch%12]}{pitch//12-1}'}
             for i, (time, pitch) in enumerate(melody)]
    charts.append({'id': key, 'title': title, 'artist': artist, 'license': license_name, 'source': url,
                   'bpm': round(mido.tempo2bpm(tempo)), 'duration': notes[-1]['time']+3,
                   'difficulty': 'Średni', 'chords': sorted(set(n['chordName'] for n in notes)), 'notes': notes})
target = ROOT / 'src/game/interactions/guitarMidiCharts.json'
target.write_text(json.dumps(charts, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print([(chart['id'],len(chart['notes']),chart['duration']) for chart in charts])
