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

// Generates white noise with the specified duration, sample rate, and cutoff frequency (using a low-pass filter)
// Returns an AudioBuffer object
async function getWhiteNoiseAudioBuffer(durationSec, sampleRateHz, lowPassCutoffFreqHz)
{
  const numSamples = Math.floor(durationSec * sampleRateHz);
  const offlineAudioCtx = new OfflineAudioContext(1, numSamples, sampleRateHz);

  const noiseBuffer = offlineAudioCtx.createBuffer(1, numSamples, sampleRateHz);
  const channelData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < channelData.length; i++)
  {
    channelData[i] = Math.random() * 2 - 1;
  }

  const noiseSource = offlineAudioCtx.createBufferSource();
  noiseSource.buffer = noiseBuffer;

  const lowPassFilter1 = offlineAudioCtx.createBiquadFilter();
  lowPassFilter1.type = "lowpass";
  lowPassFilter1.frequency.value = lowPassCutoffFreqHz;
  lowPassFilter1.Q.value = Math.SQRT1_2;

  const lowPassFilter2 = offlineAudioCtx.createBiquadFilter();
  lowPassFilter2.type = "lowpass";
  lowPassFilter2.frequency.value = lowPassCutoffFreqHz;
  lowPassFilter2.Q.value = Math.SQRT1_2;

  noiseSource.connect(lowPassFilter1).connect(lowPassFilter2).connect(offlineAudioCtx.destination);
  noiseSource.start();

  return await offlineAudioCtx.startRendering();
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
  return [srcNode, gainNode];
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

// ---------- Temporal Gap Detection Test Code ----------

const NOISE_DURATION_SEC = 0.5;
const NOISE_SAMPLE_RATE_HZ = 50000;
const NOISE_CUTOFF_FREQ_HZ = 5000;
const FADE_IN_OUT_DURATION_MS = 1;

let noiseAudioBufferTgd = null;

async function startTgdTest()
{
  document.getElementById("mode-select").style.display = "none";      // Hide the mode selection menu
  document.getElementById("tgd-test-area").style.display = "block";   // Show the TGD testing interface

  const playBtn = document.getElementById("tgd-play-btn");

  // Play button event listener
  playBtn.addEventListener("click", async () => {
    gapLength = document.getElementById("gap-len-input").value;
    gapPosition = document.getElementById("gap-pos-input").value;
    fade = document.getElementById("fade-toggle-cb").checked;
    playBtn.disabled = true;
    await playNoise(gapLength, gapPosition, fade, playBtn);
  });
}

async function playNoise(gapLengthMs, gapPositionPct, fade, playBtn)
{
  const ctx = await getAudioContext();

  if (!noiseAudioBufferTgd) noiseAudioBufferTgd = await getWhiteNoiseAudioBuffer(NOISE_DURATION_SEC, NOISE_SAMPLE_RATE_HZ, NOISE_CUTOFF_FREQ_HZ);
  
  let [noiseSourceNode, noiseGainNode] = getSourceNodeWithGain(ctx, noiseAudioBufferTgd, 1.0);

  let noiseStartTime = ctx.currentTime + 0.05;
  let gapStartTime = noiseStartTime + (NOISE_DURATION_SEC * (gapPositionPct / 100));
  let gapEndTime = gapStartTime + (gapLengthMs / 1000);
  let noiseEndTime = noiseStartTime + NOISE_DURATION_SEC;

  if (fade)
  {
    let rampLengthSec = FADE_IN_OUT_DURATION_MS / 1000;

    noiseGainNode.gain.setValueAtTime(0, noiseStartTime);
    noiseGainNode.gain.linearRampToValueAtTime(1, noiseStartTime + rampLengthSec);

    noiseGainNode.gain.setValueAtTime(1, Math.max(noiseStartTime + rampLengthSec, gapStartTime - rampLengthSec));
    noiseGainNode.gain.linearRampToValueAtTime(0, gapStartTime);

    noiseGainNode.gain.setValueAtTime(0, gapEndTime);
    noiseGainNode.gain.linearRampToValueAtTime(1, gapEndTime + rampLengthSec);

    noiseGainNode.gain.setValueAtTime(1, Math.max(0, noiseEndTime - rampLengthSec));
    noiseGainNode.gain.linearRampToValueAtTime(0, noiseEndTime);
  }
  else
  {
    noiseGainNode.gain.setValueAtTime(1, noiseStartTime);
    noiseGainNode.gain.setValueAtTime(0, gapStartTime);
    noiseGainNode.gain.setValueAtTime(1, gapEndTime);
  }

  noiseSourceNode.start(noiseStartTime);
  noiseSourceNode.stop(noiseEndTime);

  noiseSourceNode.addEventListener("ended", () => {
    if (playBtn)
    {
      playBtn.disabled = false;
    }
  }, { once: true });
}


// ---------- Frequency Test Code ----------

const INIT_FREQ = 1000;         // Specifies the initial position of the input slider

/***********************
 * Highest-Only Frequency Test (frontend-only)
 * - Adds a mode from the existing mode-select
 * - UI has one slider, Play/Stop (placeholders), and a single "Mark Highest Audible" button
 * - Results screen replaces the test UI after marking
 ***********************/
let pinpointing_exact_frequency = false; // When the user has clicked "No, I can't Hear it" let the user pinpoint their best audible with smaller steps.
let pinpointing_max = 20000;
let pinpointing_min = 2000;
(async function () {
  // --- Local state
  let ctx = await getAudioContext();
  let freqCurrentHz = INIT_FREQ;
  let freqHighestHz = null;
  let freqPlaying = false;

  let oscNode = null;

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

  function setFreqStatus2(text) {
    const el = $("freq-status2");
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
    freqCurrentHz = 2000;
    freqHighestHz = null;
    freqPlaying = false;
    pinpointing_exact_frequency = false;
    pinpointing_max = 20000;
    pinpointing_min = 2000;

    // Reset UI
    if ($("freq-slider")) $("freq-slider").value = "2000";
    if ($("freq-readout")) $("freq-readout").textContent = "2 kHz";
    if ($("next_suggested_frequency")) $("next_suggested_frequency").textContent = `Next Suggested Frequency Check: 3,000 Hz or 3 kHz`;
    setFreqStatus("Ready");
    setFreqStatus2("Ready");
    if ($("freq-slider")) $("freq-slider").min = 2000;
    if ($("freq-slider")) $("freq-slider").max = 20000;
    if ($("freq-slider")) $("freq-slider").step = 1000;

    // Show our area
    safeShow("freq-test-area");
    document.getElementById("next_suggested_frequency").style.fontWeight = 'bold';
  };

  // --- UI handlers (wired via inline onclick/oninput in HTML)

  let freqStopTimer;  // This is the timer variable to stop the frequency sound after a certain duration.
  let FREQ_STOP_TIMER_RESET_TIME = 5000; // Milliseconds; This is the time that will be used for when it's time for the FreqStopTimer to stop.
  window.updateFreqReadout = function updateFreqReadout() {
    const v = Number(($("freq-slider") || {}).value || 1000);
    freqCurrentHz = Math.round(v);
    
    if ($("freq-readout")) $("freq-readout").textContent = freqFmtHz(freqCurrentHz);

    if (freqPlaying) {                                        // Only adjust the frequency if the tone is currently playing
      oscNode.frequency.value = freqCurrentHz;                // Adjust the frequency value of the OscillatorNode based on user input (applies immediately)
      setFreqStatus(`Playing ${freqFmtHz(freqCurrentHz)}`);   // Update the status message
    }
    
    let nextSuggestedFreq; // variable for the next suggested frequency for the user to check
    if(freqCurrentHz < 20000){
      if(freqCurrentHz < 6000){     // the range for hearing loss is 2000-6000 hz, but it can get murky in the 7-8 kHz range. To be safe, start slowing down the increments from 1000 to 500 around this mark.

        nextSuggestedFreq = freqCurrentHz + 1000; // recommend the user jumps 1000 hz
        document.getElementById("freq-slider").step = 1000;
      }
      else{

        nextSuggestedFreq = freqCurrentHz + 500; // recommend the user jumps 500 hz
        document.getElementById("freq-slider").step = 500;
      }

      if ($("next_suggested_frequency")) $("next_suggested_frequency").textContent = `Next Suggested Frequency Check: ${nextSuggestedFreq} Hz or ${freqFmtHz(nextSuggestedFreq)}`;
    }

  };

  window.updateFreqReadout2 = function updateFreqReadout2() { // this is a copy of the updateFreqReadout function above, except this version works for the pinpoint_exact_frequency sections. This is for after the user has selected "No, I can't Hear it".
    const v = Number(($("freq-slider2") || {}).value || 1000);
    freqCurrentHz = Math.round(v);
    
    if ($("freq-readout2")) $("freq-readout2").textContent = freqFmtHz(freqCurrentHz);

    if (freqPlaying) {                                        // Only adjust the frequency if the tone is currently playing
      oscNode.frequency.value = freqCurrentHz;                // Adjust the frequency value of the OscillatorNode based on user input (applies immediately)
      setFreqStatus2(`Playing ${freqFmtHz(freqCurrentHz)}`);   // Update the status message
    }
    
    let nextSuggestedFreq; // variable for the next suggested frequency for the user to check
    
    if(freqCurrentHz < pinpointing_max){

      nextSuggestedFreq = freqCurrentHz + 100; // recommend the user jumps 1000 hz
      document.getElementById("freq-slider2").step = 100;
      if ($("next_suggested_frequency2")) $("next_suggested_frequency2").textContent = `Next Suggested Frequency Check: ${nextSuggestedFreq} Hz or ${freqFmtHz(nextSuggestedFreq)}`;
    }

  };

  window.prepareFreqTestForNextFreq = function prepareFreqTestForNextFreq(){ //automatically set the value of the input to be the next suggested freq
    // backend functionality for the "Yes I can still hear it" button.
    let freqInput = document.getElementById("freq-slider");
    let freqInput2 = document.getElementById("freq-slider2");
    
    if(!pinpointing_exact_frequency && parseInt(freqInput.value, 10) < 20000){
      if(parseInt(freqInput.value, 10) < 6000){     // the range for hearing loss is 2000-6000 hz, but it can get murky in the 7-8 kHz range. To be safe, start slowing down the increments from 1000 to 500 around this mark.

        temp = parseInt(freqInput.value, 10);
        freqInput.value = temp + 1000;
        
      }
      else{

        temp = parseInt(freqInput.value, 10);
        freqInput.value = temp + 500;
        
      }
    }
    else if(pinpointing_exact_frequency && parseInt(freqInput2.value, 10) < pinpointing_max){

      temp = parseInt(freqInput2.value, 10);   // if pinpointing frequency, aka "No, I can't hear it" was pressed, use lower step size.
      freqInput2.value = temp + 100;
    }
    

    if(freqStopTimer != null){

      clearTimeout(freqStopTimer);
      freqStopTimer = setTimeout(freqStopPlaceholder, FREQ_STOP_TIMER_RESET_TIME); // stop after 5 seconds
    }

    if(!pinpointing_exact_frequency){
      updateFreqReadout();
    }
    else{
      updateFreqReadout2();
    }
  };

  window.eventListenerForFreqIncBtn = function eventListenerForFreqIncBtn(){

      let freqInput = document.getElementById("freq-slider");
      let freqInput2 = document.getElementById("freq-slider2");

      if(parseInt(freqInput.value, 10) < 20000){
        if(!pinpointing_exact_frequency){
          if(freqInput.value < 6000){     // the range for hearing loss is 2000-6000 hz, but it can get murky in the 7-8 kHz range. To be safe, start slowing down the increments from 1000 to 500 around this mark.

            temp = parseInt(freqInput.value, 10);
            freqInput.value = temp + 1000;
          
          }
          else{

            temp = parseInt(freqInput.value, 10);
            freqInput.value = temp + 500;
            
          }
          updateFreqReadout();
        }
        else if(pinpointing_exact_frequency && parseInt(freqInput2.value, 10) < pinpointing_max){

          temp = parseInt(freqInput2.value, 10);   // If "No, I can't hear it" was pressed and current value is below the new max
          freqInput2.value = temp + 100;
          updateFreqReadout2();
        }
        

        if(freqStopTimer != null){

          clearTimeout(freqStopTimer);
          freqStopTimer = setTimeout(freqStopPlaceholder, FREQ_STOP_TIMER_RESET_TIME); // stop after 5 seconds
        }
      }

    

  };

  window.eventListenerForFreqDecBtn = function eventListenerForFreqDecBtn(){

      let freqInput = document.getElementById("freq-slider");
      let freqInput2 = document.getElementById("freq-slider2");

      if(parseInt(freqInput.value, 10) > 2000){
        if(!pinpointing_exact_frequency){
          if(freqInput.value <= 6000){     // the range for hearing loss is 2000-6000 hz, but it can get murky in the 7-8 kHz range. To be safe, start slowing down the increments from 1000 to 500 around this mark.

            temp = parseInt(freqInput.value, 10);
            freqInput.value = temp - 1000;
          
          }
          else{

            temp = parseInt(freqInput.value, 10);
            freqInput.value = temp - 500;
            
          }
          updateFreqReadout();
        }
        else if(pinpointing_exact_frequency && parseInt(freqInput2.value, 10) > pinpointing_min){
          temp = parseInt(freqInput2.value, 10);
          freqInput2.value = temp - 100;
          updateFreqReadout2();
        }
          

          if(freqStopTimer != null){

            clearTimeout(freqStopTimer);
            freqStopTimer = setTimeout(freqStopPlaceholder, FREQ_STOP_TIMER_RESET_TIME); // stop after 5 seconds
          }
      }

  };

  window.pinpointingExactFrequencyPage = function pinpointingExactFrequencyPage(){ // pinpoint a better approximation for where the user stopped hearing the tone.
    if(freqPlaying){
      window.freqStopPlaceholder();
    }
    pinpointing_exact_frequency = true; // let the program know we have switched modes
    freq_slider = document.getElementById("freq-slider");
    freq_slider2 = document.getElementById("freq-slider2");
    setFreqStatus2("Ready");
    
    pinpointing_max = parseInt(freq_slider.value, 10); // this is where the user clicked "No, I can't hear." Therefore, we don't need to go past this point.
    

    if(pinpointing_max > 2000){
      if(pinpointing_max <= 6000 && pinpointing_max >= 4000){ // since 2-6 kHz is where we are normally stepping by 1000, set the target range for pinpoint to be 2x this less than the max.

        pinpointing_min = pinpointing_max - 2000;
      }
      else if(pinpointing_max < 4000){ // if less than 4000, we want the minimum to be 2000.

        pinpointing_min = 2000;
      }
      else{

        pinpointing_min = pinpointing_max - 1000;
      }

      safeHide("freq-test-area"); // hide the previous page
      safeShow("pinpoint_highest_audible_for_freq_test"); // show new page
      
      if ($("freq-slider2")) $("freq-slider2").value = pinpointing_min;
      freq_slider.value = parseInt(freq_slider2.value, 10);
      if ($("freq-slider2")) $("freq-slider2").min = pinpointing_min;
      if ($("freq-slider2")) $("freq-slider2").max = pinpointing_max;
      if ($("freq-slider2")) $("freq-slider2").step = 100;
      if ($("freq-readout2")) $("freq-readout2").textContent = `${pinpointing_min / 1000} kHz`;
      
      instructions = document.getElementById("pinpoint_highest_audible_for_freq_test_instructions");
      instructions.textContent = `Looks like you stopped hearing the sound around ${pinpointing_max} Hz or ${freqFmtHz(pinpointing_max)}. Let's narrow down a better approximation for what you can hear. Try again, but this time your test range will be between ${pinpointing_min} Hz or ${freqFmtHz(pinpointing_min)} and ${pinpointing_max} Hz or ${freqFmtHz(pinpointing_max)}.`;
      if ($("next_suggested_frequency2")) $("next_suggested_frequency2").textContent = `Next Suggested Frequency Check: ${pinpointing_min + 100} Hz or ${freqFmtHz(pinpointing_min + 100)}`;

      freqCurrentHz = parseInt(freq_slider2.value, 10);
    }
    else{ // if 2000, there's nothing to check. Head straight to results.
      markHighestFrequency();
    }
  };

  window.prepareForMarkHighestFrequency = function prepareForMarkHighestFrequency(){ //this function checks if the user is at least able to hear the pinpointing_min value. If they can, go ahead and proceed to the markHighestFrequency(). If not, recursively call pinpointExactFrequencyPage();

    if(freqCurrentHz == pinpointing_min){

      window.pinpointingExactFrequencyPage();
    }
    else{

      markHighestFrequency();
    }
    
  };
  
  window.freqPlayPlaceholder = function freqPlayPlaceholder() {
    if (!freqPlaying) {                                                // Only start the tone if it's not already playing
      oscNode = getOscillatorNodeWithGain(ctx, freqCurrentHz, 0.25);   // Create the OscillatorNode to play the tone (at the freqency determined by the input slider)
      oscNode.start();                                                 // Play the tone
      freqPlaying = true;
      setFreqStatus(`Playing ${freqFmtHz(freqCurrentHz)}`);
      setFreqStatus2(`Playing ${freqFmtHz(freqCurrentHz)}`);
      if(freqStopTimer != null){  // make sure the timer variable has a reference
        clearTimeout(freqStopTimer);  // reset timer variable timer
      }
      if(freqPlaying){  // don't worry about this if the user stopped the sound before this point

        freqStopTimer = setTimeout(freqStopPlaceholder, FREQ_STOP_TIMER_RESET_TIME); // stop after 5 seconds
      }
      
      
    }
  };

  window.freqStopPlaceholder = function freqStopPlaceholder() {
    oscNode.stop()                                                    // Stop playing the tone
    freqPlaying = false;
    setFreqStatus("Stopped");
    setFreqStatus2("Stopped");
  };

  window.markHighestFrequency = function markHighestFrequency() {
    freqHighestHz = freqCurrentHz;

    if(freqHighestHz > pinpointing_min){
      freqHighestHz = freqHighestHz - 100;
    }

    // Stop placeholder "audio" and show results
    window.freqStopPlaceholder();

    if ($("freq-result-text")) {
      $("freq-result-text").innerHTML =
        `Highest audible frequency on this setup: <strong>${freqFmtHz(freqHighestHz)}</strong>.`;
    }

    // Replace the testing UI with the results area
    safeHide("freq-test-area");
    safeHide("pinpoint_highest_audible_for_freq_test");
    safeShow("freq-results-area");
  };

  window.restartFreqTest = function restartFreqTest() {
    // Just bounce back into start state
    window.startFreqTest();
  };

  window.backToModesFromFreq = function backToModesFromFreq() {
    oscNode.stop();
    freqPlaying = false;
    pinpointing_exact_frequency = false;
    safeHide("freq-test-area");
    safeHide("freq-results-area");
    safeHide("pinpoint_highest_audible_for_freq_test");
    safeShow("mode-select");
  };

  // Automatically stop the tone playback if the user leaves the test
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      oscNode.stop();
      freqPlaying = false;
    }
  });
  window.addEventListener("load", () => { 
    oscNode.stop();
    freqPlaying = false;
  });
  window.addEventListener("beforeunload", () => { 
    oscNode.stop();
    freqPlaying = false;
  });
    window.addEventListener("pagehide", () => { 
    oscNode.stop();
    freqPlaying = false;
  });

})();

// ---------- DIN Test Code ----------

const DIN_TEST_TRIPLETS_PATH = "audio/din_test/triplets_normalized/";    // Audio files for every spoken 3-digit combination (normalized)
const DIN_TEST_NOISE_PATH = "audio/din_test/din_noise.wav";              // Background noise audio file
const NOISE_BUFFER_DURATION = 0.5;                 // Amount of time (in seconds) the noise will play before and after the spoken digits
const TOTAL_TEST_ROUNDS = 10;                      // The total number of rounds until the test automatically ends

const DIGITS_RMS_DBFS = -20.00;                     // RMS dBFS (average relative volume) that all digit audio was normalized to; used for calculation of SNR
const NOISE_RMS_DBFS = -29.29;                      // RMS dBFS (average relative volume) of the noise audio; used for calculation of SNR

// Utility function to calculate RMS dBFS for a piece of audio after a linear gain has been applied (given the base RMS dBFS of the audio)
function calculateRmsDbfsAfterGain(baseRmsDbfs, gainAmount)
{
  return baseRmsDbfs + (20 * Math.log10(gainAmount));
}

// Utility function to calculate SNR (signal-to-noise ratio) for the DIN test, given the noise gain amount for the current round
function calculateSNR(noiseGainAmount)
{
  return DIGITS_RMS_DBFS - calculateRmsDbfsAfterGain(NOISE_RMS_DBFS, noiseGainAmount);
}

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
let dinTestData = [];  // Contains items: { roundNumber, digitsPlayed, digitsHeard, result, snr }

// Given a number representing the current round of the test, this function will return the gain amount that should be used in that round
function getGainForRound(roundNumber)
{
  let baseGainAmount = 3;           // Initial noise gain (i.e., the volume of the noise in round 1)
  let gainIncrementPerRound = 0.5;    // The amount by which the gain will be incremented for each successive round

  return baseGainAmount + ((roundNumber - 1) * gainIncrementPerRound);    // Formula for calculating the gain amount for the specified round
}

function storeRoundData(digitsPlayed, digitsHeard)
{
  dinTestData.push({
    roundNumber: currentRound,
    digitsPlayed,
    digitsHeard,
    result: digitsPlayed === digitsHeard,
    snr: calculateSNR(getGainForRound(currentRound))       // Calculate SNR for the current round, based on that round's noise gain level
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

    const tdSnr = document.createElement("td");
    tdSnr.textContent = `${row.snr.toFixed(2)} dB`;
    tdSnr.style.padding = "8px";
    tdSnr.style.borderBottom = "1px solid #f1f5f9";

    tr.append(tdRound, tdDigitsPlayed, tdDigitsHeard, tdResult, tdSnr);
    tbody.appendChild(tr);
  }

  // Find the user's best SNR score (the lowest SNR in a round that the user got correct)

  let lowestSnr = Infinity;

  for (const item of dinTestData)
  {
    if (item.result === true && item.snr < lowestSnr) lowestSnr = item.snr;
  }

  document.getElementById("din-test-controls").style.display = "none";                                                      // Hide the controls for an active test
  document.getElementById("din-best-snr-display").textContent =                                                             // Display the user's best (lowest) SNR score
    `Your best SNR score was: ${lowestSnr === Infinity ? 'N/A (Too high to be measured)' : `${lowestSnr.toFixed(2)} dB`}`;
  document.getElementById("din-results-section").style.display = "block";                                                   // Show the end-of-test results table
}

// Given a digit triplet and gain amount, will play the audio for the digit triplet concurrently with the noise audio (with the specified gain adjustment)
async function playTriplet(triplet, gainAmount)
{
  const ctx = await getAudioContext();

  // Create the AudioBuffer for the background noise, which can be reused throughout the entire test
  if (!noiseAudioBuffer) noiseAudioBuffer = await getAudioBufferFromUrl(ctx, DIN_TEST_NOISE_PATH);
  let noiseSourceNode = getSourceNodeWithGain(ctx, noiseAudioBuffer, gainAmount)[0];   // Create SourceNode to allow for noise playback

  let digitsAudioBuffer = await getAudioBufferFromUrl(ctx, `${DIN_TEST_TRIPLETS_PATH}${triplet}.wav`);   // Create AudioBuffer for triplet audio
  let digitsSourceNode = getSourceNode(ctx, digitsAudioBuffer);                                          // Create SourceNode to allow for digits playback

  const t0 = ctx.currentTime + 0.02;                      // Current time

  noiseSourceNode.start(t0);                              // Play noise first
  digitsSourceNode.start(t0 + NOISE_BUFFER_DURATION);     // Play digits after specified buffer time has passed

  const totalDuration = digitsAudioBuffer.duration + 2 * NOISE_BUFFER_DURATION;   // Calculate total noise duration including buffer time
  noiseSourceNode.stop(t0 + totalDuration);                                       // Stop noise playback

  return {triplet, gainAmount}    // Return the triplet that was played and the volume level
}

// -------- End of the DIN test code ------------


// Temporal Gap test code (placeholder only - no functionality yet) ----------------
// ===== Temporal Gap Detection (2AFC) — Frontend-only =====

// ===== Temporal Gap Detection (Design-only; no audio) =====
function tg$(id){ return document.getElementById(id); }
function tgShow(id){ const el=tg$(id); if (el) el.style.display='block'; }
function tgHide(id){ const el=tg$(id); if (el) el.style.display='none'; }

const tgDesignCFG = {
  totalTrials: 12 // UI preview count; adjust as you like
};

let tgDesignState = null;

function tgResetDesign(){
  tgDesignState = {
    running: false,
    trial: 0,
    awaiting: false,
    logs: []
  };
  tg$("tg-status").textContent = "Ready";
  tg$("tg-progress").textContent = `Trial 0 / ${tgDesignCFG.totalTrials}`;
  tg$("tg-progress-bar").style.width = "0%";
  tg$("tg-first-btn").disabled  = true;
  tg$("tg-second-btn").disabled = true;

  //  reset Start label + disable Replay
  const startBtn = tg$("tg-start-btn");
  if (startBtn) startBtn.textContent = "Start Test";
  const replayBtn = tg$("tg-replay-btn");
  if (replayBtn) replayBtn.disabled = true;

  tgHide("tg-results");
}

// Show TG page from Mode Select
window.startTemporalGapTest = function startTemporalGapTest(){
  // Hide other areas you already have
  tgHide("mode-select");
  tgHide("test-area");
  tgHide("dbhl-test-area");
  tgHide("din-test-area");
  tgHide("freq-test-area");
  tgHide("freq-results-area");
  tgHide("summary-section");
  tgHide("results-detail");

  tgShow("tg-test-area");
  tgResetDesign();
};

// Back to mode menu
window.backToModesFromTG = function backToModesFromTG(){
  tgHide("tg-test-area");
  tgShow("mode-select");
};

// Begin (design-only): fake the “listening choose” flow without audio
window.tgBeginDesign = function tgBeginDesign(){
  // Restart from scratch each time
  tgResetDesign();

  // Change label after first click
  const startBtn = tg$("tg-start-btn");
  if (startBtn) startBtn.textContent = "Restart Test";

  tgDesignState.running = true;
  tg$("tg-status").textContent = "Listening… ( preview)";
  tg$("tg-first-btn").disabled  = true;
  tg$("tg-second-btn").disabled = true;

  // Simulate both intervals finishing, then enable choices + replay
  setTimeout(() => {
    if (!tgDesignState.running) return;
    tg$("tg-status").textContent = "Which had the pause?";
    tg$("tg-first-btn").disabled  = false;
    tg$("tg-second-btn").disabled = false;

    // NEW: allow replay of the current trial
    const replayBtn = tg$("tg-replay-btn");
    if (replayBtn) replayBtn.disabled = false;

    tgDesignState.awaiting = true;
  }, 900);
};

window.tgReplayDesign = function tgReplayDesign(){
  if (!tgDesignState?.running) return;

  // Disable choices during replay
  tgDesignState.awaiting = false;
  tg$("tg-first-btn").disabled  = true;
  tg$("tg-second-btn").disabled = true;

  const replayBtn = tg$("tg-replay-btn");
  if (replayBtn) replayBtn.disabled = true;

  tg$("tg-status").textContent = "Replaying… (design preview)";

  setTimeout(() => {
    if (!tgDesignState.running) return;
    tg$("tg-status").textContent = "Which had the pause?";
    tg$("tg-first-btn").disabled  = false;
    tg$("tg-second-btn").disabled = false;

    if (replayBtn) replayBtn.disabled = false;
    tgDesignState.awaiting = true;
  }, 700);
};


// Handle a choice (design-only): just advance UI
window.tgChoose = function tgChoose(choice){
  if (!tgDesignState?.running || !tgDesignState.awaiting) return;

  // Disable choices & replay while we transition
  tg$("tg-first-btn").disabled  = true;
  tg$("tg-second-btn").disabled = true;
  const replayBtn = tg$("tg-replay-btn");
  if (replayBtn) replayBtn.disabled = true;

  // Log minimal info (no correctness; no audio yet)
  tgDesignState.logs.push({ trial: tgDesignState.trial + 1, response: choice });

  // Advance trial count & progress
  tgDesignState.trial += 1;
  const t = tgDesignState.trial;
  const total = tgDesignCFG.totalTrials;

  tg$("tg-progress").textContent = `Trial ${t} / ${total}`;
  tg$("tg-progress-bar").style.width = Math.min(100, Math.round((t/total)*100)) + "%";

  if (t >= total){
    tgDesignState.running = false;
    tg$("tg-status").textContent = "Done (design preview)";
    tg$("tg-result-summary").textContent =
      "Placeholder result. Threshold estimation will appear here once audio is implemented.";

    // Keep replay disabled at the end
    if (replayBtn) replayBtn.disabled = true;

    tgShow("tg-results");
    return;
  }

  // Simulate next trial
  tg$("tg-status").textContent = "Listening… (design preview)";
  tgDesignState.awaiting = false;

  setTimeout(() => {
    if (!tgDesignState.running) return;
    tg$("tg-status").textContent = "Which had the pause?";
    tg$("tg-first-btn").disabled  = false;
    tg$("tg-second-btn").disabled = false;

    // Re-enable replay once awaiting a response
    if (replayBtn) replayBtn.disabled = false;

    tgDesignState.awaiting = true;
  }, 600);
};


// Keyboard shortcuts for accessibility (design-only)
window.addEventListener("keydown", (e) => {
  if (!tgDesignState?.running || !tgDesignState.awaiting) return;
  if (e.key === "1") tgChoose(1);
  if (e.key === "2") tgChoose(2);
});


// -------- End of Temporal Gap test code ------------



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

