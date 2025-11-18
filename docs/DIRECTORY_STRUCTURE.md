# Expected Directory Structure

```text
project/
├─ index.html
├─ audio_utilities.js
├─ dbhl_test.js
├─ din_test.js
├─ freq_test.js
├─ original_tests.js
├─ tgd_test.js
├─ ui.js
├─ style.css
├─ README.md
├─ generate_tone.ipynb
├─ generating_audio.py
├─ audio/
│  ├─ 250Hz_20dB.wav, ... 
│  └─ din_test/
│     ├─ digits_normalized/
│     ├─ digits_original/
│     │  ├─ 0.wav ... 9.wav
│     ├─ triplets_normalized/        <-- generated 000.wav..999.wav
│     ├─ triplets_original/
│     └─ din_noise.wav
└─ charts/
└─ images/
└─ docs/
```