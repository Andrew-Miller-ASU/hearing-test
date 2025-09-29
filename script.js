// ---------- Audio Utilities (Web Audio API) ----------

let audioContext = null;      // Web Audio API AudioContext for entire application

// Retrieve the application-wide AudioContext for playing and manipulating audio
async function getAudioContext()
{
  if (audioContext && audioContext.state !== "closed")                        // Check if the AudioContext exists and is not closed
  {
    if (audioContext.state === "suspended") await audioContext.resume();      // Resume the AudioContext if it's suspended
    return audioContext;                                                      // Return the existing AudioContext
  }

  audioContext = new (window.AudioContext || window.webkitAudioContext)();    // Create a new AudioContext if one does not exist or it's closed
  return audioContext;
}

// Given a URL (file path), creates an AudioBuffer object which stores the audio asset in memory
// The audio can be played by passing the AudioBuffer object into a AudioBufferSourceNode object
// The AudioBuffer is persistent and can be used to generate multiple AudioBufferSourceNodes, which can only be played once
async function getAudioBufferFromUrl(ctx, url)
{
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Failed to fetch: ${url}`);
  const arrayBuffer = await response.arrayBuffer();
  return await ctx.decodeAudioData(arrayBuffer.slice(0));
}

// Creates an AudioBufferSourceNode from an AudioBuffer object
// The audio can be played by calling start() and stopped by calling stop()
function getSourceNode(ctx, audioBuffer)
{
  const srcNode = ctx.createBufferSource();
  srcNode.buffer = audioBuffer;
  srcNode.connect(ctx.destination);
  return srcNode;
} 

// Creates an AudioBufferSourceNode from an AudioBuffer object
// Attaches the AudioBufferSourceNode to a GainNode, which can be used to adjust gain (volume)
// gainAmount = 1   = original volume
// gainAmount = 0   = silent
// gainAmount = 0.5 = half volume
// gainAmount = 2   = double volume
function getSourceNodeWithGain(ctx, audioBuffer, gainAmount)
{
  const srcNode = ctx.createBufferSource();
  srcNode.buffer = audioBuffer;

  const gainNode = ctx.createGain();
  gainNode.gain.value = gainAmount;

  srcNode.connect(gainNode).connect(ctx.destination);
  return srcNode;
} 

// Creates an OscillatorNode, which is a type of SourceNode
// The audio can be played by calling start() and stopped by calling stop()
// The frequency can be changed at any time by setting the frequency.value property
function getOscillatorNode(ctx, frequency)
{
  const oscNode = ctx.createOscillator();

  oscNode.type = "sine";                    // Specifies the shape of the waveform; options include "sine", "square", "sawtooth", "triangle" and "custom"
  oscNode.frequency.value = frequency;      // Sets the frequency (in Hz) using the specified value

  oscNode.connect(ctx.destination);
  return oscNode;
}

// Creates an OscillatorNode, which is a type of SourceNode
// Attaches the OscillatorNode to a GainNode, which can be used to adjust gain (volume)
// The audio can be played by calling start() and stopped by calling stop()
// The frequency can be changed at any time by setting the frequency.value property
function getOscillatorNodeWithGain(ctx, frequency, gainAmount)
{
  const oscNode = ctx.createOscillator();

  oscNode.type = "sine";                    // Specifies the shape of the waveform; options include "sine", "square", "sawtooth", "triangle" and "custom"
  oscNode.frequency.value = frequency;      // Sets the frequency (in Hz) using the specified value

  const gainNode = ctx.createGain();
  gainNode.gain.value = gainAmount;

  oscNode.connect(gainNode).connect(ctx.destination);
  return oscNode;
}


// ---------- Frequency Test Code ----------

const INIT_FREQ = 1000;         // Specifies the initial position of the input slider

/***********************
 * Highest-Only Frequency Test (frontend-only)
 * - Adds a mode from the existing mode-select
 * - UI has one slider, Play/Stop (placeholders), and a single "Mark Highest Audible" button
 * - Results screen replaces the test UI after marking
 ***********************/

(async function () {
  // --- Local state
  let ctx = await getAudioContext();
  let freqCurrentHz = INIT_FREQ;
  let freqHighestHz = null;
  let freqPlaying = false;

  function $(id) { return document.getElementById(id); }
  function safeHide(id) { const el = $(id); if (el) el.style.display = "none"; }
  function safeShow(id, disp = "block") { const el = $(id); if (el) el.style.display = disp; }

  function freqFmtHz(hz) {
    const n = Number(hz) || 0;
    if (n >= 1000) return (n / 1000).toFixed(2).replace(/\.00$/, "") + " kHz";
    return Math.round(n).toLocaleString() + " Hz";
  }

  function setFreqStatus(text) {
    const el = $("freq-status");
    if (el) el.textContent = text;
  }

  // --- Public entry from the new button in mode-select
  window.startFreqTest = function startFreqTest() {
    // Hide other test areas to avoid overlap
    safeHide("mode-select");
    safeHide("test-area");
    safeHide("dbhl-test-area");
    safeHide("din-test-area");
    safeHide("summary-section");
    safeHide("results-detail");
    safeHide("freq-results-area");

    // Reset local state
    freqCurrentHz = 1000;
    freqHighestHz = null;
    freqPlaying = false;

    // Reset UI
    if ($("freq-slider")) $("freq-slider").value = "1000";
    if ($("freq-readout")) $("freq-readout").textContent = "1,000 Hz";
    setFreqStatus("Ready");

    // Show our area
    safeShow("freq-test-area");
  };

  // --- UI handlers (wired via inline onclick/oninput in HTML)
  window.updateFreqReadout = function updateFreqReadout() {
    const v = Number(($("freq-slider") || {}).value || 1000);
    freqCurrentHz = Math.round(v);
    if ($("freq-readout")) $("freq-readout").textContent = freqFmtHz(freqCurrentHz);

    if (freqPlaying) {                                        // Check if the tone is currently playing
      oscNode.frequency.value = freqCurrentHz;                // Adjust the frequency value of the OscillatorNode based on user input (applies immediately)
      setFreqStatus(`Playing ${freqFmtHz(freqCurrentHz)}`);   // Update the status message
    }
  };

  window.freqPlayPlaceholder = function freqPlayPlaceholder() {
    oscNode = getOscillatorNodeWithGain(ctx, freqCurrentHz, 0.25);   // Create the OscillatorNode to play the tone (at the freqency determined by the input slider)
    oscNode.start();                                                 // Play the tone
    freqPlaying = true;
    setFreqStatus(`Playing ${freqFmtHz(freqCurrentHz)}`);
  };

  window.freqStopPlaceholder = function freqStopPlaceholder() {
    oscNode.stop()                                                    // Stop playing the tone
    freqPlaying = false;
    setFreqStatus("Stopped");
  };

  window.markHighestFrequency = function markHighestFrequency() {
    freqHighestHz = freqCurrentHz;

    // Stop placeholder "audio" and show results
    window.freqStopPlaceholder();

    if ($("freq-result-text")) {
      $("freq-result-text").innerHTML =
        `Highest audible frequency on this setup: <strong>${freqFmtHz(freqHighestHz)}</strong>.`;
    }

    // Replace the testing UI with the results area
    safeHide("freq-test-area");
    safeShow("freq-results-area");
  };

  window.restartFreqTest = function restartFreqTest() {
    // Just bounce back into start state
    window.startFreqTest();
  };

  window.backToModesFromFreq = function backToModesFromFreq() {
    safeHide("freq-test-area");
    safeHide("freq-results-area");
    safeShow("mode-select");
  };
})();



// ---------- DIN Test Code ----------

const DIN_TEST_AUDIO_PATH = "audio/triplets/";    // Audio files for every spoken 3-digit combination and background noise
const NOISE_BUFFER_DURATION = 0.5;                 // Amount of time (in seconds) the noise will play before and after the spoken digits
const TOTAL_TEST_ROUNDS = 15;                      // The total number of rounds until the test automatically ends

// Returns a random combination of 3 digits as a string
function getRandomDigitTriplet()
{
  const triplet = Math.floor(Math.random() * 1000);
  return String(triplet).padStart(3, "0");
}

let noiseAudioBuffer = null;
let digitsAudioBuffer = null;

let currentRound = 1; 

// Stores data for each round of the test
let dinTestData = [];  // Contains items: { roundNumber, digitsPlayed, digitsHeard, result }

// Given a number representing the current round of the test, this function will return the gain amount that should be used in that round
function getGainForRound(roundNumber)
{
  let baseGainAmount = 0.25;           // Initial noise gain (i.e., the volume of the noise in round 1)
  let gainIncrementPerRound = 0.25;    // The amount by which the gain will be incremented for each successive round

  return baseGainAmount + ((roundNumber - 1) * gainIncrementPerRound);    // Formula for calculating the gain amount for the specified round
}

function storeRoundData(digitsPlayed, digitsHeard)
{
  dinTestData.push({
    roundNumber: currentRound,
    digitsPlayed,
    digitsHeard,
    result: digitsPlayed === digitsHeard
  });
}

async function DinCalibrationPage(){ //Calibration page for DIN Test

  document.getElementById("mode-select").style.display = "none";
  document.getElementById("din-calibration-page").style.display = "block";

  
  document.getElementById("din_calibration_test_volume_btn").addEventListener("click", async () => {

      let triplet = null;
      triplet = getRandomDigitTriplet();
      await playTriplet(triplet, 1);
      

  });

  document.getElementById("din_calibration_proceed_to_test_btn").addEventListener("click", async () => {

      document.getElementById("din-calibration-page").style.display = "none";
      startDinTest();

  });
  

}

function resetDinTest()
{
  currentRound = 1;
  document.getElementById("din-round-display").textContent = "Round 1/" + TOTAL_TEST_ROUNDS;
  document.getElementById("digits-input").value = "";
  dinTestData = [];
  
  document.getElementById("din-test-controls").style.display = "block";
  document.getElementById("din-results-section").style.display = "none";
}

async function startDinTest()
{
  document.getElementById("mode-select").style.display = "none";      // Hide the mode selection menu
  document.getElementById("din-test-area").style.display = "block";   // Show the DIN testing interface

  resetDinTest();

  let triplet = null;

  // Play button event listener
  document.getElementById("din-play-btn").addEventListener("click", async () => {
    if (!triplet) triplet = getRandomDigitTriplet();              // Generate a new digit triplet if one hasn't been generated already for this test
    await playTriplet(triplet, getGainForRound(currentRound));    // Play the triplet with the appropriate noise level for the current round
  });

  // Quit button event listener
  document.getElementById("din-quit-btn").addEventListener("click", async () => {
    endDinTest();
  });

  // Submit button event listener
  document.getElementById("din-submit-btn").addEventListener("click", async () => {
    userInput = document.getElementById("digits-input").value;      // Retrieve user input

    if (userInput.length < 3 || !triplet)   // If the user entered less than 3 digits, or did not click Play yet, then the Submit button will do nothing
    {
      return;
    }
    else
    {
      storeRoundData(triplet, userInput);   // Store data for the current round, to be shown at the end of the test
      triplet = null;
      if (currentRound === TOTAL_TEST_ROUNDS)
      {
        endDinTest();     // End the test if the user has reached the final round
      }
      else
      {
        document.getElementById("digits-input").value = "";
        ++currentRound;
        document.getElementById("din-round-display").textContent = `Round ${currentRound}/${TOTAL_TEST_ROUNDS}`;
      }
    }
  });
}

function endDinTest()
{
  // Render the results table

  const tbody = document.getElementById("din-results-tbody");
  const section = document.getElementById("din-results-section");
  if (!tbody || !section) return;

  // Clear the table
  tbody.innerHTML = "";

  // Add a row to the table for each test round
  for (const row of dinTestData)
  {
    const tr = document.createElement("tr");

    const tdRound = document.createElement("td");
    tdRound.textContent = row.roundNumber;
    tdRound.style.padding = "8px";
    tdRound.style.borderBottom = "1px solid #f1f5f9";

    const tdDigitsPlayed = document.createElement("td");
    tdDigitsPlayed.textContent = `${row.digitsPlayed[0]}–${row.digitsPlayed[1]}–${row.digitsPlayed[2]}`;
    tdDigitsPlayed.style.padding = "8px";
    tdDigitsPlayed.style.borderBottom = "1px solid #f1f5f9";

    const tdDigitsHeard = document.createElement("td");
    tdDigitsHeard.textContent = `${row.digitsHeard[0]}–${row.digitsHeard[1]}–${row.digitsHeard[2]}`;
    tdDigitsHeard.style.padding = "8px";
    tdDigitsHeard.style.borderBottom = "1px solid #f1f5f9";

    const tdResult = document.createElement("td");
    tdResult.textContent = row.result ? "Correct" : "Incorrect";
    tdResult.style.padding = "8px";
    tdResult.style.borderBottom = "1px solid #f1f5f9";
    tdResult.style.fontWeight = "700";
    tdResult.style.color = row.result ? "#16a34a" : "#dc2626";

    tr.append(tdRound, tdDigitsPlayed, tdDigitsHeard, tdResult);
    tbody.appendChild(tr);
  }

  // Calculate the percentage of rounds the user got correct

  let correctResultCount = 0;
  for (const item of dinTestData)
  {
    if (item.result) correctResultCount++;
  }
  let correctPercentage = (100 * (correctResultCount / dinTestData.length)).toFixed(2) + "%";

  document.getElementById("din-test-controls").style.display = "none";                                            // Hide the controls for an active test
  document.getElementById("din-correct-percent-display").textContent = "Correct rounds: " + correctPercentage;    // Display the percentage of correct rounds
  document.getElementById("din-results-section").style.display = "block";                                         // Show the end-of-test results table
}

// Given a digit triplet and gain amount, will play the audio for the digit triplet concurrently with the noise audio (with the specified gain adjustment)
async function playTriplet(triplet, gainAmount)
{
  const ctx = await getAudioContext();

  // Create the AudioBuffer for the background noise, which can be reused throughout the entire test
  if (!noiseAudioBuffer) noiseAudioBuffer = await getAudioBufferFromUrl(ctx, `${DIN_TEST_AUDIO_PATH}din_noise.wav`);
  let noiseSourceNode = getSourceNodeWithGain(ctx, noiseAudioBuffer, gainAmount);               // Create SourceNode to allow for noise playback

  let digitsAudioBuffer = await getAudioBufferFromUrl(ctx, `${DIN_TEST_AUDIO_PATH}${triplet}.wav`);   // Create AudioBuffer for triplet audio
  let digitsSourceNode = getSourceNode(ctx, digitsAudioBuffer);                                       // Create SourceNode to allow for digits playback

  const t0 = ctx.currentTime + 0.02;                      // Current time

  noiseSourceNode.start(t0);                              // Play noise first
  digitsSourceNode.start(t0 + NOISE_BUFFER_DURATION);     // Play digits after specified buffer time has passed

  const totalDuration = digitsAudioBuffer.duration + 2 * NOISE_BUFFER_DURATION;   // Calculate total noise duration including buffer time
  noiseSourceNode.stop(t0 + totalDuration);                                       // Stop noise playback

  return {triplet, gainAmount}    // Return the triplet that was played and the volume level
}


// ---------- dB HL Testing Code ----------

// Calibration constant (RETSPL value) mapping SPL to HL for a specific piece of hearing equipment (which SPL equals 0 HL)
// Can be roughly approximated by obtaining ISO RETSPL for similar equipment
const CAL_RETSPL_1K = 7.5;

// Calibration constant for the user's entire equipment setup
// Represents actual volume (dB SPL) output on the user's end when A=1.0 (0 dBFS)
// Can possibly be roughly measured with smartphone app
const CAL_SPL0_1K   = 96.0;

// Final (complete) calibration constant
// Maps A=1.0 (0 dBFS) tone in the software to a dB HL value
const K_1K = CAL_SPL0_1K - CAL_RETSPL_1K;

// Tone duration
const DBHL_DURATION_SEC = 1.0;

function dbfsToAmp(dbfs) {
  const amp = Math.pow(10, dbfs / 20);
  return Math.max(0, Math.min(1, amp));
}
function ampToHL1k(A) {
  if (A <= 0) return -Infinity;
  return 20 * Math.log10(A) + K_1K;
}

async function playSineBuffer(freqHz, dbfs, durationSec) {
  const audioCtx = await getAudioContext();

  const sr = audioCtx.sampleRate;
  const n  = Math.max(1, Math.floor(durationSec * sr));
  const buf = audioCtx.createBuffer(1, n, sr);
  const ch0 = buf.getChannelData(0);

  const amp = dbfsToAmp(dbfs);
  const twoPiF = 2 * Math.PI * freqHz;

  for (let i = 0; i < n; i++) ch0[i] = amp * Math.sin(twoPiF * (i / sr));

  // 5 ms fade in/out
  const k = Math.min(n, Math.floor(0.005 * sr));
  for (let i = 0; i < k; i++) {
    const g = i / k;
    ch0[i] *= g;
    ch0[n - 1 - i] *= g;
  }

  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.connect(audioCtx.destination);
  src.start();
  await new Promise(res => (src.onended = res));
}

// dB HL state
let dbhlCurrentDbfs = -90;
let dbhlRunning = false;

async function playDbHlTone() {
  const statusEl = document.getElementById("dbhl-status");
  statusEl.textContent = `Playing 1 kHz @ ${dbhlCurrentDbfs.toFixed(2)} dBFS for ${DBHL_DURATION_SEC.toFixed(1)} s…`;
  await playSineBuffer(1000, dbhlCurrentDbfs, DBHL_DURATION_SEC);
  statusEl.textContent = `Last level: ${dbhlCurrentDbfs.toFixed(2)} dBFS`;

  // Log each tone played
  const log = document.getElementById("dbhl-log");
  if (log) {
    log.textContent += `Played 1 kHz @ ${dbhlCurrentDbfs.toFixed(2)} dBFS\n`;
    log.scrollTop = log.scrollHeight;
  }
}

function startDbHlTest() {
  // Only show the dB HL Testing area
  document.getElementById("mode-select").style.display = "none";
  document.getElementById("test-area").style.display = "none";
  document.getElementById("dbhl-test-area").style.display = "block";

  // Reset UI
  document.getElementById("dbhl-result").textContent = "";
  document.getElementById("dbhl-status").textContent = "";
  const logEl = document.getElementById("dbhl-log");
  if (logEl) logEl.textContent = ""; // Clear log of tones played
  document.getElementById("dbhl-replay-row").style.display = "none";
  document.getElementById("dbhl-response-row").style.display = "none";
  document.getElementById("dbhl-start-row").style.display = "flex";

  dbhlRunning = false;

  // Begin the test on "Start Test" button click
  document.getElementById("dbhl-start-btn").onclick = async () => {
    const startDb = parseFloat(document.getElementById("dbhl-start").value || "-90");
    dbhlCurrentDbfs = Math.max(-120, Math.min(0, startDb));

    // Once the test has started, hide the "Start Test" button and show the test controls
    document.getElementById("dbhl-start-row").style.display = "none";
    document.getElementById("dbhl-response-row").style.display = "flex";
    document.getElementById("dbhl-replay-row").style.display = "block";

    dbhlRunning = true;
    await playDbHlTone(); // First tone
  };

  // "Replay" button replays the last tone
  document.getElementById("dbhl-replay-btn").onclick = async () => {
    if (dbhlRunning) await playDbHlTone();
  };

  // "Yes" button ends test at current level
  document.getElementById("dbhl-yes").onclick = () => {
    if (!dbhlRunning) return;
    const A  = dbfsToAmp(dbhlCurrentDbfs);
    const hl = ampToHL1k(A);
    document.getElementById("dbhl-result").textContent =
      `Lowest audible level at 1 kHz: ${hl.toFixed(1)} dB HL (K = ${K_1K.toFixed(1)} dB).`;
    dbhlRunning = false;
  };

  // "No" button increases volume of the next tone, but ends test if stepping would cause level to exceed 0 dBFS
  document.getElementById("dbhl-no").onclick = async () => {
    if (!dbhlRunning) return;

    let step = parseFloat(document.getElementById("dbhl-step").value);
    if (!Number.isFinite(step) || step <= 0) step = 2.0;

    const proposed = dbhlCurrentDbfs + step;

    if (proposed >= 0) {
      // Clamp to 0 dBFS and end test (can't go louder without clipping)
      dbhlCurrentDbfs = 0;
      const A  = dbfsToAmp(dbhlCurrentDbfs);
      const hl = ampToHL1k(A);
      document.getElementById("dbhl-result").textContent =
        `Lowest audible level at 1 kHz (at full scale): ${hl.toFixed(1)} dB HL (K = ${K_1K.toFixed(1)} dB).`;
      dbhlRunning = false;
    } else {
      // Step and play next louder tone automatically
      dbhlCurrentDbfs = proposed;
      await playDbHlTone();
    }
  };
}

// ---------- Calibration Prompt Code ----------

function calibrationTest() {

    document.getElementById("calibrationTestAudio").src = `audio/250Hz_40dB.wav`;
    document.getElementById("calibrationTestAudio").style.display = "block";

}

function proceedToTest() {

    //User is finished with Calibration, display the test modes.
    document.getElementById("calibration-page").style.display = "none";
    document.getElementById("mode-select").style.display = "block";

}


// ---------- Original Code ----------

let index = 0, results = [];
let testMode = 'both'; // 'both', 'left', or 'right'
let tones = [];

function startTest(mode) {
  testMode = mode;
  document.getElementById("summary-section").style.display = "none";
  document.getElementById("results-detail").style.display = "none";
  document.getElementById("summary-text").textContent = "";

  document.getElementById("mode-select").style.display = "none";
  document.getElementById("test-area").style.display = "block";
  
  // Define tones
  tones = generateTones(mode);
  index = 0;
  results = [];
  loadNextTone();
}

function generateTones(mode) {
  const baseFreqs = [250, 500, 1000, 2000, 4000, 8000];
  const baseVols = [20, 40];

  let tones = [];
  for (let f of baseFreqs) {
    for (let v of baseVols) {
      if (mode === 'headphones') {
        tones.push({ freq: f, vol: v, ear: 'left' });
        tones.push({ freq: f, vol: v, ear: 'right' });
      } else {
        tones.push({ freq: f, vol: v, ear: 'both' });
      }
    }
  }
  return tones;
}

function loadNextTone() {
  if (index >= tones.length) return showResults();

  const t = tones[index];
  const label = t.ear === 'both' ? '' : ` (${t.ear.toUpperCase()} ear)`;
  document.getElementById("question").textContent =
    `Can you hear ${t.freq} Hz at ${t.vol} dB${label}?`;

  let filename = `${t.freq}Hz_${t.vol}dB`;
  if (t.ear !== 'both') filename += `_${t.ear}`;
  document.getElementById("tone").src = `audio/${filename}.wav`;
}

function recordResponse(heard) {
  const t = tones[index];
  results.push({ ...t, heard });
  index++;
  loadNextTone();
}

function generateSummary(results) {

  if (!results || results.length === 0) {
    return ""; // or return null and handle it safely later
  }
  const isHeadphones = results.some(r => r.ear === 'left' || r.ear === 'right');

  if (!isHeadphones) {
    // Original logic for both ears
    const missedFreqs = new Set();
    const heardFreqs = new Set();

    results.forEach(r => {
      if (r.heard) heardFreqs.add(r.freq);
      else missedFreqs.add(r.freq);
    });

    const missed = [...missedFreqs].sort((a, b) => a - b);
    const heard = [...heardFreqs].sort((a, b) => a - b);

    if (missed.length === 0) {
      return "🎉 You heard all test tones. Your hearing seems to be within a normal range!";
    } else if (missed.length <= 2) {
      return `✅ You heard most tones clearly. However, you may have slight difficulty at ${missed.join("Hz, ")}Hz. Consider monitoring this.`;
    } else if (missed.length >= 3 && heard.length >= 3) {
      return `⚠️ You missed several tones (e.g., ${missed.slice(0, 3).join("Hz, ")}Hz). This could indicate mild hearing loss. We recommend seeing an audiologist for a full assessment.`;
    } else {
      return `🚨 You missed most tones. This suggests a possible significant hearing loss. Please consult a hearing specialist.`;
    }
  } else {
    // Headphones mode — per-ear summary
    const left = results.filter(r => r.ear === 'left');
    const right = results.filter(r => r.ear === 'right');

    function summarizeEar(earResults, label) {
      const missed = [...new Set(earResults.filter(r => !r.heard).map(r => r.freq))].sort((a, b) => a - b);
      const heard = [...new Set(earResults.filter(r => r.heard).map(r => r.freq))];

      if (missed.length === 0) {
        return `🎧 ${label} ear: Normal hearing.`;
      } else if (missed.length <= 2) {
        return `🎧 ${label} ear: Minor issues at ${missed.join("Hz, ")}Hz.`;
      } else if (missed.length >= 3 && heard.length >= 3) {
        return `🎧 ${label} ear: Multiple missed tones (e.g., ${missed.slice(0, 3).join("Hz, ")}Hz). Possible mild hearing loss.`;
      } else {
        return `🎧 ${label} ear: Missed most tones. Likely significant hearing loss.`;
      }
    }

    return [
      summarizeEar(left, "Left"),
      summarizeEar(right, "Right")
    ].join("\n");
  }
}


function showResults() {
  const summaryText = generateSummary(results);
  document.getElementById("summary-text").textContent = summaryText;

  // Reveal summary and details section
  document.getElementById("summary-section").style.display = "block";
  document.getElementById("results-detail").style.display = "block";
  document.getElementById("test-area").style.display = "none";

  // Build table with 'Ear' column
  const tbl = document.getElementById("results-table");
  tbl.innerHTML = `<tr><th>Frequency (Hz)</th><th>Volume (dB)</th><th>Ear</th><th>Result</th></tr>`;
  results.forEach(r => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${r.freq}</td>
      <td>${r.vol}</td>
      <td>${r.ear || 'both'}</td>
      <td>${r.heard ? '✅' : '❌'}</td>
    `;
    tbl.appendChild(row);
  });

  // Prepare chart data objects for each ear
  let leftData = {};
  let rightData = {};
  let bothData = {};

  // Fill chart data: for each freq, store lowest heard volume or 90 if none heard
  results.forEach(r => {
    let target;
    if (r.ear === 'left') target = leftData;
    else if (r.ear === 'right') target = rightData;
    else target = bothData;

    if (target[r.freq] === undefined) {
      target[r.freq] = r.heard ? r.vol : 90;
    } else if (r.heard && r.vol < target[r.freq]) {
      target[r.freq] = r.vol;
    }
  });

  // Get sorted unique frequencies across all ears
  const freqs = [...new Set([
    ...Object.keys(leftData),
    ...Object.keys(rightData),
    ...Object.keys(bothData)
  ].map(f => parseInt(f)))].sort((a, b) => a - b);

  // Map frequencies to thresholds (or null if missing)
  const leftThresholds = freqs.map(f => leftData[f] ?? null);
  const rightThresholds = freqs.map(f => rightData[f] ?? null);
  const bothThresholds = freqs.map(f => bothData[f] ?? null);

  // Render Chart.js audiogram with separate lines per ear
  const ctx = document.getElementById("audiogramChart").getContext("2d");
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: freqs,
      datasets: [
        {
          label: 'Left Ear',
          data: leftThresholds,
          borderColor: '#007bff',
          backgroundColor: 'rgba(0,123,255,0.2)',
          tension: 0.2,
          pointRadius: 5,
          pointHoverRadius: 8,
          spanGaps: true,
        },
        {
          label: 'Right Ear',
          data: rightThresholds,
          borderColor: '#dc3545',
          backgroundColor: 'rgba(220,53,69,0.2)',
          tension: 0.2,
          pointRadius: 5,
          pointHoverRadius: 8,
          spanGaps: true,
        },
        {
          label: 'Both Ears',
          data: bothThresholds,
          borderColor: '#28a745',
          backgroundColor: 'rgba(40,167,69,0.2)',
          tension: 0.2,
          pointRadius: 5,
          pointHoverRadius: 8,
          spanGaps: true,
        }
      ]
    },
    options: {
      scales: {
        y: {
          reverse: true,
          min: 0,
          max: 100,
          title: { display: true, text: 'Hearing Level (dB HL)' }
        },
        x: {
          title: { display: true, text: 'Frequency (Hz)' }
        }
      },
      plugins: {
        title: {
          display: true,
          text: 'Audiogram'
        }
      }
    }
  });
}

