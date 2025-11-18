# Frailty Indicator Analysis Tool - Hearing Test Suite

This software provides a collection of tests that users can take to assess different aspects of their hearing. These tests should not be considered a substitute for professional medical advice.

## Tests Modes

- Measure your hearing in the left ear only, right ear only, or in both ears by using the selector on the home page

## Legacy Tests

- Speaker and Headphones mode
- Test your ability to hear different frequencies at both 20 dB and 40 dB

## New Tests

**dB HL (decibels Hearing Loss) Test**
- Calibration using smartphone app sound meter ensures accurate results
- Identifies the minimum volume that you're capable of hearing 

**DIN (Digits-in-Noise) Test**
- Measures your ability to discern speech over background noise

**TGD (Temporal Gap Detection) Test**
- Measures your ability to detect small silent gaps in noise
- May indicate deficits in attention and processing speed

**Frequency Range Test**
- Identifies the highest frequency (pitch) that you're capable of hearing 
 
## Deployment

1. Download the repository and navigate to the local `hearing-test` directory.
2. Start a simple HTTP server in that directory using `python -m http.server <port>`.
3. Go to `http://localhost:<port>>/` in your browser to begin using the software.

## Requirements

Built with HTML/CSS/JS. No external libraries or SDKs are required. No Internet connection is required.
