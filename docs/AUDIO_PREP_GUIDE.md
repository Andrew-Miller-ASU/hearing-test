# AUDIO_PREP_GUIDE — Building DIN Assets

This project expects the following DIN audio:

- `audio/din_test/digits_normalized/0.wav..9.wav` — single digits, normalized
- `audio/din_test/din_noise.wav` — steady speech-shaped noise
- `audio/din_test/triplets_normalized/000.wav..999.wav` — digit triplets (auto-generated)

## 1) Normalize the single digits & noise
Use your audio editor (or a script) to normalize the **RMS dBFS** of each digit file to a
consistent value (e.g., −20.0 dBFS) and note the RMS of your noise file (e.g., −29.29 dBFS).
The web app uses those base RMS values to compute SNR once a linear gain is applied to noise.

## 2) Generate all 1000 triplets
The `generating_audio.py` script concatenates digits with a 300 ms gap and writes to
`audio/din_test/triplets_normalized/` without modifying the source digit files.

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install pydub
# Ensure FFmpeg is installed and on PATH

python generating_audio.py
# -> Creates any missing 000.wav..999.wav under audio/din_test/triplets_normalized
```

If you re-run the script, existing triplets are skipped.

