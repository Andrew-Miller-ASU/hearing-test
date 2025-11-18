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

// Creates the ear router, which separates input audio into two channels and adjusts the gain (volume) for the left and right ears,
// allowing any hearing test to be taken in left ear, right ear, or both ears mode
function createEarRouter(ctx)
{
  const input = ctx.createGain();    
  const leftGain = ctx.createGain();
  const rightGain = ctx.createGain();
  const channelMerger = ctx.createChannelMerger(2);

  [input, leftGain, rightGain, channelMerger].forEach(n => {
    n.channelCountMode = "explicit";
    n.channelInterpretation = "discrete";
  });

  input.connect(leftGain);
  input.connect(rightGain);
  leftGain.connect(channelMerger, 0, 0);
  rightGain.connect(channelMerger, 0, 1);

  // Called by selectTestEarMode(value)
  // Applies the change to the ear router when the user changes the ear mode on the front-end
  function applyMode()
  {
    const mode = (window.testEarMode || 'both');
    if (mode === 'left')      { leftGain.gain.value = 1;   rightGain.gain.value = 0; }
    else if (mode === 'right'){ leftGain.gain.value = 0;   rightGain.gain.value = 1; }
    else                      { leftGain.gain.value = 1;   rightGain.gain.value = 1; }
  }

  return { input, output: channelMerger, applyMode };
}

// Creates an ear router (if one does not exist already) and hooks it up to the audio playback pipeline
async function ensureEarRouter()
{
  const ctx = await getAudioContext();

  if (!window.earRouter)
  {
    window.earRouter = createEarRouter(ctx);
    window.earRouter.output.connect(ctx.destination);
  }

  window.earRouter.applyMode();
  return window.earRouter;
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

  ensureEarRouter().then(router => {
    router.applyMode();
    srcNode.connect(router.input);
  });

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

  ensureEarRouter().then(router => {
    router.applyMode();
    srcNode.connect(gainNode).connect(router.input);
  });

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

  ensureEarRouter().then(router => {
    router.applyMode();
    oscNode.connect(router.input);
  });

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

  ensureEarRouter().then(router => {
    router.applyMode();
    oscNode.connect(gainNode).connect(router.input);
  });

  return oscNode;
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

window.testEarMode = 'both';      // Global ear mode variable (values: 'left', 'right', 'both'); Controls which ear(s) the test audio is played for

// Sets the global ear mode ('left', 'right', or 'both') whenever the user modifies the state
// of the ear mode selector on the home page
function selectTestEarMode(value)
{
  document.querySelectorAll(".toggle-segment").forEach(s => s.classList.remove("active"));
  document.querySelector(`.toggle-segment[data-value="${value}"]`).classList.add("active");
  window.testEarMode = value;
  if (window.earRouter) earRouter.applyMode();
}

// Make these functions globally accessible
window.getAudioContext = getAudioContext;
window.getAudioBufferFromUrl = getAudioBufferFromUrl;
window.getSourceNode = getSourceNode;
window.getSourceNodeWithGain = getSourceNodeWithGain;
window.getOscillatorNode = getOscillatorNode;
window.getOscillatorNodeWithGain = getOscillatorNodeWithGain;
window.getWhiteNoiseAudioBuffer = getWhiteNoiseAudioBuffer;