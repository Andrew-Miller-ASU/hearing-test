"""
Source digits are at: audio/triplets/digits/0.wav ... 9.wav
Output triplets go to: audio/triplets/<abc>.wav
We do NOT modify or delete the digit files.

"""

import os
import random
from pydub import AudioSegment

AUDIO_FOLDER = "audio"
OUTPUT_FOLDER = os.path.join(AUDIO_FOLDER, "triplets")
DIGITS_FOLDER = os.path.join(OUTPUT_FOLDER, "digits")  # fixed location 

GAP_MS = 300
NUM_TRIPLETS = 240


def load_digits():
    """Load 0.wav..9.wav from DIGITS_FOLDER once."""

    digits = {}
    for d in range(10):
        path = os.path.join(DIGITS_FOLDER, f"{d}.wav")
        if not os.path.exists(path):
            raise FileNotFoundError(f"Missing digit file: {path}")
        digits[str(d)] = AudioSegment.from_wav(path)
    return digits


def generate_triplet_audio(triplet: str, digits_map: dict, output_path: str):
    """Concatenate d1 + 300ms + d2 + 300ms + d3 and export to output_path."""
    gap = AudioSegment.silent(duration=GAP_MS)
    audio = digits_map[triplet[0]] + gap + digits_map[triplet[1]] + gap + digits_map[triplet[2]]
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    audio.export(output_path, format="wav")


def main():
    digits_map = load_digits()
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)

    generated_this_run = set()
    created = 0

    while created < NUM_TRIPLETS:
        triplet = "".join(str(random.randint(0, 9)) for _ in range(3))
        if triplet in generated_this_run:
            continue

        out_path = os.path.join(OUTPUT_FOLDER, f"{triplet}.wav")

        # If a file with this triplet already exists from a previous run, skip it.
        if os.path.exists(out_path):
            generated_this_run.add(triplet)
            continue

        generate_triplet_audio(triplet, digits_map, out_path)
        print(f"Generated {out_path}")
        generated_this_run.add(triplet)
        created += 1

    print(f"Done. Created {created} new triplets in '{OUTPUT_FOLDER}'.")


if __name__ == "__main__":
    main()