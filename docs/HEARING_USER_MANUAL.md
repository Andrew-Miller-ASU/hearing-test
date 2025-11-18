# Hearing Test — User & Handoff Manual
Last updated: 2025-11-05

## What this is
A browser‑based **hearing screening** prototype with four modules:
We allow choice between testing left, right or both ears. 
1) **dB HL** (1 kHz threshold with optional smartphone calibration)
2) **Digits‑in‑Noise (DIN)** screening (triplet-in-noise SNR ladder)
3) **Highest Audible Frequency** (2–20 kHz screening)
4) **Temporal Gap Detection** (2AFC adaptive)


---
## How to run
- Easiest: open `index.html` in a modern browser (Chrome/Edge/Safari).
- Or serve the folder locally (recommended for fetch/caching to work fully):
  ```bash
  python3 -m http.server 8000
  # then visit http://localhost:8000
  ```

### Files you’ll see
- `index.html` — main UI (mode selector, modules)
- `script.js` — all test logic and audio engine (Web Audio API)
- `style.css` — styles
- `generate_tone.ipynb` — original file generated the audio for test we did not design
- `generating_audio.py` — generates the triplets audio.
- `audio/` — tone WAV files and DIN assets
  - `din_test/digits_normalized/*.wav` — digits 0–9 (normalized RMS)
  - `din_test/digits_original/*.wav` — digits 0–9 (audio of 0-9 digits obtained for free online)
  - `din_test/triplets_normalized/*.wav` — auto‑generated 000–999
  - `din_test/triplets_original/*.wav` — auto‑generated 000–999 without normalization 
  - `din_test/din_noise.wav` — steady noise bed for DIN
- `charts/` — static illustrations used by the UI
- `images/` — illustation for calibration 

---
## Quick start (end user)
1. **Calibrate volume** on the welcome screen.
2. Choose **ear mode** (Left / Right / Both) and a **test module**.
3. Follow the on‑screen instructions for that module.
4. Review results on screen (summary + table, and an audiogram for the tone screen).

---
## Modules & workflows

### 1) dB HL (1 kHz) with optional calibration
- Prompts user to **calibrate** using a smartphone SPL app pressed to the headphone cup (or skip for a default constant).
- Plays a 1 kHz tone in short bursts; user responds **Yes/No** until audibility is reached.
- Displays estimated **dB HL** and an **expected age band** (illustrative).
- Notes:
  - Calibration uses a constant derived from the measured **dB SPL** of a known dBFS tone.
  - If calibration is skipped, results are **approximate** and device‑dependent.

### 2) Digits‑in‑Noise (DIN) screening
- Each **round** plays three spoken digits embedded in steady noise.
- The **noise level** steps each round; user types what they heard.
- At the end, the table shows **Correct/Incorrect** per round and your best (lowest) **SNR**.

### 3) Highest audible frequency
- User plays a sine tone and steps frequency upward (coarse 1 kHz, then finer 0.5 kHz).
- If they can no longer hear it, the UI narrows the range to pinpoint a final **highest audible** estimate.

### 4) Temporal gap detection (2AFC)
- Two bursts of noise are presented; **one** contains a tiny silent **gap**.
- User chooses **First** or **Second** (or 1/2). A simple **staircase** reduces gap after two correct, increases after an error.
- The result is the estimated **gap threshold** (ms; lower is better temporal resolution).

---
## Data & privacy
- No cloud backend; all processing runs in the browser.
- No personal data stored by default; results are not persisted unless you add storage.

## Known limitations
- **Calibration:** Smartphone SPL apps and uncalibrated headphones are not standards‑compliant; treat dB HL as approximate.
- **Device/volume variance:** Output level varies by OS, sound card, browser, and headphones.
- **Environment:** Use a quiet room; avoid very low‑quality earbuds or laptop speakers.
- **DIN assets:** Ensure digits/noise WAVs share consistent RMS so SNR steps are meaningful.

