import os
from itertools import product
import pyttsx3
from pydub import AudioSegment

AUDIO_FOLDER  = "audio"
OUTPUT_FOLDER = os.path.join(AUDIO_FOLDER, "triplets")
DIGIT_CACHE   = os.path.join(AUDIO_FOLDER, "digits_cache")  # stores 0.wav..9.wav
GAP_MS        = 300  # silence between digits

def ensure_dirs():
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)
    os.makedirs(DIGIT_CACHE, exist_ok=True)

def build_digit_cache():
    """
    Synthesize digits 0..9 exactly once (if missing).
    """
    engine = pyttsx3.init()
    # Optional tuning:
    # engine.setProperty("rate", 175)
    # engine.setProperty("volume", 1.0)

    # Queue only the missing digits, then run once
    queued = False
    for d in range(10):
        path = os.path.join(DIGIT_CACHE, f"{d}.wav")
        if not os.path.exists(path):
            engine.save_to_file(str(d), path)
            queued = True
    if queued:
        engine.runAndWait()

def load_digit_audio():
    """
    Load cached 0..9 into memory as AudioSegments.
    """
    digits = []
    for d in range(10):
        path = os.path.join(DIGIT_CACHE, f"{d}.wav")
        if not os.path.exists(path):
            raise FileNotFoundError(f"Missing cached digit: {path}. Run build_digit_cache() first.")
        digits.append(AudioSegment.from_wav(path))
    return digits

def export_triplet(triplet_str, digits_audio):
    """
    Assemble TRIPLET from cached digits and export as audio/triplets/XYZ.wav
    """
    d0, d1, d2 = (int(triplet_str[0]), int(triplet_str[1]), int(triplet_str[2]))
    gap = AudioSegment.silent(duration=GAP_MS)
    audio = digits_audio[d0] + gap + digits_audio[d1] + gap + digits_audio[d2]

    out_path = os.path.join(OUTPUT_FOLDER, f"{triplet_str}.wav")
    audio.export(out_path, format="wav")
    return out_path

def main():
    ensure_dirs()
    build_digit_cache()
    digits_audio = load_digit_audio()

    # Deterministically generate 000..999
    for d0, d1, d2 in product("0123456789", repeat=3):
        triplet = f"{d0}{d1}{d2}"
        out = export_triplet(triplet, digits_audio)
        print(f"Generated {out}")

if __name__ == "__main__":
    main()
