# Hearing Test — Research Notes (Overview & Rationale)

## Goals
Provide screening-style, at-home measures that approximate:
- **Sensitivity at 1 kHz** (reported in dB HL after a simple calibration step)
- **Speech-in-noise ability** (Digits-in-Noise; best SNR across trials)
- **Upper frequency limit of audibility** (2–20 kHz, coarse-to-fine)
- **Temporal resolution** (gap detection threshold using a simple staircase)

These are **not** substitutes for calibrated clinical audiometry, but can help with
self-screening, education, and research pilots.


---
## Quick notes/description of each test validity for hearing

## dB HL (1 kHz threshold)

-A 1 kHz threshold probes core auditory sensitivity near the speech mid-band, where many everyday cues live. Performance at this    frequency tends to track the overall pure-tone average, so elevated thresholds are a reliable early flag for conductive or sensorineural  loss. Because it’s a single, brief check, it’s useful for self-monitoring and for detecting large changes over time on the same setup. In our browser prototype the value is approximate—not a calibrated clinical dB HL—but it still communicates meaningful changes in audibility.

## Digits-in-Noise (DIN)

DIN measures how well a listener recognizes speech-like material in background noise, which maps closely to real-world communication challenges. The task integrates more than audibility alone, capturing effects of temporal/spectral resolution and binaural processing that pure tones miss. Short DIN screens are quick, reliable, and correlate with perceived difficulty in noisy settings. Our fixed SNR ladder yields a clear “best SNR achieved,” providing a practical screening index even if it’s not a full adaptive SRT. Another big advantage is that calibration is not as neceassary as the noise and triples are normalized realtive to each other so we dont neew precise calibration

## Highest audible frequency

The highest audible tone reflects the upper-end bandwidth of the cochlea, where hair cells are especially vulnerable to aging, noise exposure, and ototoxicity. A lowered upper limit often precedes broader high-frequency hearing loss that degrades consonant cues critical for speech clarity. Tracking this limit over time on the same device can highlight early changes users actually notice. Because output and headphone response shape the result, it’s best interpreted as an educational, same-setup trend rather than a diagnostic metric.

## Temporal gap detection

Gap detection indexes the ear–brain system’s temporal resolution—the ability to resolve very brief silences within noise. Temporal acuity declines with age and some central auditory conditions, and poorer gap thresholds often accompany difficulties understanding rapid speech in noise. A simple two-interval staircase converges on a stable threshold in milliseconds that’s easy to compare within or across sessions. While attention and environment can influence performance, the measure still adds a complementary view beyond pure-tone audibility.


---
## Measurement designs (by module)

### dB HL (1 kHz approximation)
- Converts a user-supplied **dB SPL** measurement of a reference 1 kHz tone at known dBFS
  into a device-specific **calibration constant** (SPL = const + dBFS). During the test we
  step SPL in small increments until audible, then convert to **dB HL** using an approximate
  **RETSPL** offset based on headphone type. Results are **illustrative**.
- **Risks & bias:** Phone microphones and SPL apps vary; coupling the mic to an earcup is
  not standardized; ambient noise leaks; headphone frequency response differs.

### Digits-in-Noise (DIN)
- Uses **digit triplets** mixed with steady “speech-shaped” noise.
- Each round increases the **noise gain** to reduce **SNR**. The user types the three digits.
- Report the lowest SNR with correct identification as a simple **screening index**.
- Notes: In formal DIN, SNR is tracked with an **adaptive** procedure to estimate SRT; here we present a fixed short ladder for speed.

### Highest audible frequency
- Sine oscillator stepped upward. When the user indicates loss of audibility,
- Influenced by output device response and level; interpret cautiously.

### Temporal gap detection (2AFC)
- Two intervals (A/B) of noise; one interval contains a centered silent gap.
- **2-down/1-up** style rule (two correct - smaller gap; any error - larger) approximates
  a threshold with several **reversals** averaged.
- Expect **age-related** increases in gap thresholds even with normal audiograms.

---
## Implementation notes (ties to code)
- **DIN assets:** `audio/din_test/digits_normalized/0.wav..9.wav`  concatenated into 000–999 WAVs and played against `din_noise.wav` with buffer before/after to compute SNR consistently.
- **SNR math:** A fixed RMS (dBFS) is assumed for digits and noise; SNR per round follows from the applied noise gain.
- **Temporal gap:** Web Audio noise buffers with gain ramps create a gap at a known time index; a simple staircase tracks performance.


