"""Import all supplied loops, fully decode and normalize loudness without trimming music."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
from tempfile import TemporaryDirectory
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[2]
TRACKS = [
    ('adventure-boy', 'Adventure Boy', 'Armotonic', 'adventure-boy-loop-559127'),
    ('space-ambient', 'Space Ambient', 'zec53', 'space-ambient-background-synth-and-drum-machine-loop-371303'),
    ('kitchen-swing', 'Kitchen Fun', 'zec53', 'kitchen-fun-pizz-comical-swing-retro-loop-1-20-sec-400977'),
    ('relaxing-guitar', 'Relaxing Guitar Melody', 'idoberg', 'relaxing-guitar-melody-loop-am-94bpm-607337'),
    ('ambient-space', 'Ambient Space', 'Universfield', 'ambient-space-background-30s-342767'),
    ('loop-three', 'Loop Three', 'Marc Vittorini', 'loop-three-295277'),
    ('sneaky-mallet', 'Sneaky Mallet', 'zec53', 'sneaky-mallet-presentation-positive-upbeat-loop-2-15-sec-401014'),
    ('landscape-piano', 'Cinematic Landscape Piano', 'zec53', 'cinematic-landscape-piano-romance-loop-1-30-sec-505419'),
    ('interstellar', 'Interstellar Electro Hip Hop', 'zec53', 'interstellar-electro-hip-hop-background-loop-2-380672'),
    ('whimsical-intrigue', 'Whimsical Dramedy', 'zec53', 'whimsical-dramedy-comedy-funny-cartoon-intrigue-loop-1-15-sec-396868'),
    ('ghost-zoo', 'Ghost Zoo', 'deejaycoxknot', 'ghost-zoo-loop-130-558172'),
    ('mischievous-piano', 'Quirky Mischievous Piano and Mallet', 'zec53', 'quirky-mischievous-piano-and-mallet-loop-1-20-sec-396874'),
    ('orion-nebula', 'Orion Nebula', 'Universfield', 'orion-nebula-200658'),
    ('game-18', 'Game Music Loop 18', 'XtremeFreddy', 'game-music-loop-18-153392'),
    ('soft-background', 'Soft Background', 'SergeQuadrado', 'soft-background-loop-14329'),
    ('amber', 'Amber', 'GrumpyNora', 'amber-loop-2-416805'),
    ('cinematic-trailer', 'Cinematic Trailer', 'DAUB Audio', 'cinematic-trailer-daub-loop-526515'),
    ('galactic-journey', 'Galactic Space Journey', 'ViraMiller', 'galactic-space-journey-279437'),
    ('cartoon-suspense', 'Cartoon Pizz and Sneaky Suspense', 'zec53', 'cartoon-pizz-and-sneaky-suspense-kids-games-loop-1-15-sec-396877'),
    ('cabin', 'Cabin — Video Game Theme', 'giri_is', 'cabin-video-game-theme-350164'),
    ('game-14', 'Game Music Loop 14', 'XtremeFreddy', 'game-music-loop-14-153385'),
]


def probe(path):
    return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration:stream=sample_rate,channels','-of','json',str(path)]))


def main(archive):
    dest = ROOT/'public/game-assets/audio/bongo-rush/soundtrack-v2'
    dest.mkdir(parents=True, exist_ok=True)
    manifest = {}
    with ZipFile(archive) as z, TemporaryDirectory() as temporary:
        files = [f for f in z.infolist() if not f.is_dir() and Path(f.filename).suffix.lower()=='.mp3']
        assert len(files)==len(TRACKS), 'Archive must contain exactly the 21 reviewed audio files'
        for key,title,artist,suffix in TRACKS:
            matches = [f for f in files if Path(f.filename).stem.endswith(suffix)]
            assert len(matches)==1 and matches[0].file_size < 20_000_000
            member = matches[0]
            data = z.read(member)
            source = Path(temporary)/f'{key}.mp3'
            source.write_bytes(data)
            original = probe(source)
            target = dest/f'{key}.mp3'
            command = ['ffmpeg','-hide_banner','-v','info','-i',str(source),'-map','0:a:0','-vn','-af','loudnorm=I=-18:TP=-2:LRA=20:print_format=json','-ar','44100','-ac','2','-c:a','libmp3lame','-b:a','192k','-metadata',f'title={title}','-metadata',f'artist={artist}','-y',str(target)]
            result = subprocess.run(command, capture_output=True, text=True, check=True)
            loudness = json.loads(re.findall(r'\{[^{}]*"input_i"[^{}]*\}',result.stderr)[-1])
            command[command.index('-af')+1] = f"loudnorm=I=-18:TP=-2:LRA=20:measured_I={loudness['input_i']}:measured_LRA={loudness['input_lra']}:measured_TP={loudness['input_tp']}:measured_thresh={loudness['input_thresh']}:offset={loudness['target_offset']}:linear=true:print_format=json"
            result = subprocess.run(command, capture_output=True, text=True, check=True)
            loudness = json.loads(re.findall(r'\{[^{}]*"input_i"[^{}]*\}',result.stderr)[-1])
            subprocess.run(['ffmpeg','-v','error','-i',str(target),'-f','null','-'],capture_output=True,check=True)
            seconds = float(probe(target)['format']['duration'])
            assert 5 < seconds <= 50
            assert abs(seconds-float(original['format']['duration'])) < .15, 'Do not truncate loops'
            assert float(loudness['output_tp']) < 0 and float(loudness['input_i']) > -60
            manifest[key] = {'title':title,'artist':artist,'file':target.name,'seconds':seconds,'source':Path(member.filename).name,'sourceSha256':hashlib.sha256(data).hexdigest(),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'analysis':loudness}
    (ROOT/'src/games/bongo-rush/data/soundtrack-v2.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Imported and fully decoded {len(manifest)} full-length loops')


if __name__ == '__main__':
    main(Path(sys.argv[1]))
