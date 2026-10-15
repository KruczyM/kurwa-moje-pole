import os
import subprocess
from pathlib import Path

upload_dir = Path("C:/Users/krucz/.gemini/antigravity/brain/d81ba138-3200-4466-b868-2f212dff67d0/.user_uploaded")
gen_dir = Path("public/game-assets/2d/fighter/audio-v2/generated")
gen_dir.mkdir(parents=True, exist_ok=True)

# 1. Prepare reference audio
# uploaded_media_0_1792035443191.mp3 contains: "Three, two, one, fight!"
ref_src = upload_dir / "uploaded_media_0_1792035443191.mp3"
ref_wav = gen_dir / "ref_announcer.wav"

cmd = [
    "ffmpeg", "-y",
    "-i", str(ref_src),
    "-ar", "24000",
    "-ac", "1",
    str(ref_wav)
]
subprocess.run(cmd, check=True, capture_output=True)
print(f"Prepared reference audio: {ref_wav}")

ref_text = "Three, two, one, fight!"

# 2. Phrases to generate
phrases = [
    ("announcer-draw", "Draw!"),
    ("announcer-double-ko", "Double K.O.!"),
    ("announcer-time-over", "Time Over!"),
    ("announcer-perfect", "Perfect!"),
    ("announcer-sudden-death", "Sudden Death!"),
    ("announcer-game-over", "Game Over!"),
    ("announcer-continue", "Continue?"),
    ("announcer-choose-fighter", "Choose your fighter!"),
]

# 3. Load F5TTS
from f5_tts.api import F5TTS
import soundfile as sf
import torch

print("Loading F5TTS model (will download weights if first time)...")
f5tts = F5TTS(device="cuda" if torch.cuda.is_available() else "cpu")

for key, text in phrases:
    print(f"\n--- Generating '{text}' ({key}) ---")
    out_raw = gen_dir / f"{key}_raw.wav"
    wav, sr, _ = f5tts.infer(
        ref_file=str(ref_wav),
        ref_text=ref_text,
        gen_text=text,
        cfg_strength=2.2,
        nfe_step=32,
        speed=1.0,
        target_rms=0.15,
        remove_silence=True,
    )
    sf.write(str(out_raw), wav, sr)
    print(f"Saved raw: {out_raw} (sr={sr}, duration={len(wav)/sr:.2f}s)")

    # Post-process into game standard: 22050Hz, 16-bit mono PCM, normalized peak 0.88
    out_game = Path("public/game-assets/2d/fighter/audio-v2") / f"{key}.wav"
    cmd_proc = [
        "ffmpeg", "-y",
        "-i", str(out_raw),
        "-af", "silenceremove=1:0:-40dB,loudnorm=I=-16:TP=-1.2:LRA=11",
        "-ar", "22050",
        "-ac", "1",
        str(out_game)
    ]
    subprocess.run(cmd_proc, check=True, capture_output=True)
    print(f"Published game audio: {out_game}")

print("\nAll phrases generated successfully!")
