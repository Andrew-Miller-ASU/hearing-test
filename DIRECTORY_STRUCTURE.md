# Expected Directory Structure

```text
project/
├─ index.html
├─ script.js
├─ style.css
├─ README.md
├─ generate_tone.ipynb
├─ generating_audio.py
├─ HEARING_USER_MANUAL.md            <-- this file
├─ HEARING_REQUIREMENTS.txt
├─ HEARING_RESEARCH_NOTES.md
├─ AUDIO_PREP_GUIDE.md               <-- how to build DIN triplets
├─ audio/
│  ├─ 250Hz_20dB.wav, ... (tone files used by index.html)
│  └─ din_test/
│     ├─ digits_normalized/
│     │  ├─ 0.wav ... 9.wav
│     ├─ triplets_normalized/        <-- generated 000.wav..999.wav
│     └─ din_noise.wav
└─ charts/
└─ images/
```
