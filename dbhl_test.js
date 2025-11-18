const DBHL_FREQ_HZ = 1000;            // The frequency of the dB HL test tone (in Hz)
const DBHL_TONE_DURATION_SEC = 1.0;   // The duration of each tone tone during the test
const DB_SPL_TEST_START = 0;          // The initial volume (dB SPL) of the dB HL test tone
const DB_SPL_TEST_STEP = 2.5;         // The size of the increment in volume if the user cannot hear the current tone

const CAL_TONE_GAIN = 0.1;        // The amount of linear gain that will be applied to the test tone played during calibration

const DEFAULT_CAL_CONST =  100;   // Default constant to be used if the user opts not to calibrate their test

// RETSPL values at 1 KHz for different types of listening devices; used for the calculation of dB HL
const RETSPL_1KHZ_EARPHONES = 2;
const RETSPL_1KHZ_OVEREAR = 4;
const RETSPL_1KHZ_ONEAR = 7.5;

let listeningDeviceType;          // The type of audio listenting device the user is taking the test with (values: earphones, overear, onear)

let calibrationConstant;          // Represents the dB SPL of a tone played at 0 dBFS; dB SPL = calibrationConstant + dBFS

let currentDbSpl;                 // The dB SPL of the tone currently being played

// Computes the calibration constant given the dBFS value played by the software, and the actual dB SPL measured by the user
function computeCalibrationConstant(dbfsPlayed, splMeasured)
{
  console.log(splMeasured - dbfsPlayed);
  return splMeasured - dbfsPlayed;
}

// Converts an amplitude value (linear gain) to dBFS
function ampToDbfs(amplitude) 
{
  if (amplitude <= 0) return -Infinity;
  return 20 * Math.log10(amplitude);
}

// Converts dBFS to an amplitude value (linear gain)
function dbfsToAmp(dbfs)
{
  return Math.pow(10, dbfs / 20);
}

// Converts a dB SPL value to an amplitude (linear gain) using the calibration constant
function splToAmp(spl)
{
  return Math.pow(10, (spl - calibrationConstant) / 20);
}

// Converts a dB SPL value to a dBFS value using the calibration constant
function splToDbfs(spl)
{
  return spl - calibrationConstant;
}

// Converts a dBFS value to a dB SPL value using the calibration constant
function dbfsToSpl(dbfs)
{
  return dbfs + calibrationConstant;
}

async function runDbHlCalibration()
{
    let ctx = await getAudioContext();

    let calTonePlaying = false;
    let calToneSrcNode;

    const modalBackdrop = document.getElementById('dbhl-modal-backdrop');
    modalBackdrop.style.display = 'flex';
    document.body.dataset.prevOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';

    const calibrationOptionArea = document.getElementById('dbhl-modal-cal-sel');
    const yesCalibrationButton = document.getElementById('dbhl-modal-yes-cal-btn');
    const noCalibrationButton = document.getElementById('dbhl-modal-no-cal-btn');

    const noCalibrationArea = document.getElementById('dbhl-modal-no-cal');
    const listeningDeviceSelectionNoCal = document.getElementById('dbhl-modal-no-dev-sel');
    const continueWithoutCalibrationButton = document.getElementById('dbhl-modal-continue-btn');

    const calibrationArea = document.getElementById('dbhl-modal-calibration');
    const listeningDeviceSelectionYesCal = document.getElementById('dbhl-modal-yes-dev-sel');
    const calTonePlayStopButton = document.getElementById('dbhl-modal-play-stop-btn');
    const dbReadingInput = document.getElementById('dbhl-modal-cal-input');
    const doneButton = document.getElementById('dbhl-modal-cal-done');

    yesCalibrationButton.addEventListener("click", async () => {
      calibrationOptionArea.style.display = 'none';
      calibrationArea.style.display = 'flex';
    });

    noCalibrationButton.addEventListener("click", async () => {
      calibrationOptionArea.style.display = 'none';
      noCalibrationArea.style.display = 'flex';
    });

    calTonePlayStopButton.addEventListener("click", async () => {
      if (!calTonePlaying)
      {
        calToneSrcNode = getOscillatorNodeWithGain(ctx, DBHL_FREQ_HZ, CAL_TONE_GAIN);
        calToneSrcNode.start();
        calTonePlaying = true;
        calTonePlayStopButton.textContent = "■ Stop";
        calTonePlayStopButton.style.background = "#dc2626";
      }
      else
      {
        try { calToneSrcNode.stop(); } catch {}
        calTonePlaying = false;
        calTonePlayStopButton.textContent = "▶ Play";
        calTonePlayStopButton.style.background = "#2563eb";
      }
    });

    continueWithoutCalibrationButton.addEventListener("click", async () => {
      calibrationConstant = DEFAULT_CAL_CONST;    // If the user did not go through calibration, use a default value
      listeningDeviceType = listeningDeviceSelectionNoCal.value;
      try { calToneSrcNode.stop(); } catch {};    // Stop the calibration tone if the user didn't already
      // Hide the modal overlay
      modalBackdrop.style.display = 'none';
      document.body.style.overflow = document.body.dataset.prevOverflow || '';
    });

    doneButton.addEventListener("click", async () => {
      if (!isNaN(dbReadingInput.value))
        {
          testToneDbfs = ampToDbfs(CAL_TONE_GAIN);
          calibrationConstant = computeCalibrationConstant(testToneDbfs, parseFloat(dbReadingInput.value));
          listeningDeviceType = listeningDeviceSelectionYesCal.value;
          try { calToneSrcNode.stop(); } catch {};    // Stop the calibration tone if the user didn't already
          // Hide the modal overlay
          modalBackdrop.style.display = 'none';
          document.body.style.overflow = document.body.dataset.prevOverflow || '';
        }
    });

}

let dbHlRunning = false;

async function startDbHlTest()
{
  // Only show the dB HL Testing area
  hideHome();
  document.getElementById("dbhl-test-area").style.display = "block";

  runDbHlCalibration();

  // Reset UI
  document.getElementById("dbhl-result").textContent = "";
  document.getElementById("dbhl-status").textContent = "";
  const logEl = document.getElementById("dbhl-log");
  if (logEl) logEl.textContent = ""; // Clear log of tones played
  document.getElementById("dbhl-replay-row").style.display = "none";
  document.getElementById("dbhl-response-row").style.display = "none";
  document.getElementById("dbhl-start-row").style.display = "flex";
  document.getElementById("dbhl-results-area").style.display = "none";
  dbHlRunning = false;

  // Begin the test on "Start Test" button click
  document.getElementById("dbhl-start-btn").onclick = async () => {
    currentDbSpl = DB_SPL_TEST_START;

    // Once the test has started, hide the "Start Test" button and show the test controls
    document.getElementById("dbhl-start-row").style.display = "none";
    document.getElementById("dbhl-response-row").style.display = "flex";
    document.getElementById("dbhl-replay-row").style.display = "block";

    dbHlRunning = true;
    await playDbHlTone(); // First tone
  };

  // "Replay" button replays the last tone
  document.getElementById("dbhl-replay-btn").onclick = async () => {
    if (dbHlRunning) await playDbHlTone();
  };

  // "Yes" button ends test at current level
  document.getElementById("dbhl-yes").onclick = () => {
    if (!dbHlRunning) return;
    endDbHlTest();
    dbHlRunning = false;
  };

  // "No" button increases volume of the next tone, but ends test if stepping would cause level to exceed 0 dBFS
  document.getElementById("dbhl-no").onclick = async () => {
    if (!dbHlRunning) return;

    nextDbSpl = currentDbSpl + DB_SPL_TEST_STEP;

    if (splToDbfs(nextDbSpl) >= 0)
    {
      currentDbSpl = dbfsToSpl(0);    // Clamp to 0 dBFS and end test (can't go louder without clipping)
      endDbHlTest();
    } else {
      // Step and play next louder tone automatically
      currentDbSpl = nextDbSpl;
      await playDbHlTone();
    }
  };
}

function endDbHlTest()
{

  let dbHlResult = computeDbHlResult().toFixed(1);
  let expectedAge;
  let dbhlSimpleResultsExplanation;

  if (dbHlResult <= 15) {
    expectedAge = "0–19";
    dbhlSimpleResultsExplanation = "Based on your results, you likely fall into the 'Normal Hearing Ability' category. This means that this test hasn't detected any warning signs of hearing loss.";
  }
  else if (dbHlResult <= 20) {
    expectedAge = "20–29";
    dbhlSimpleResultsExplanation = "Based on your results, you likely fall into the 'Normal Hearing Ability' category. This means that this test hasn't detected any warning signs of hearing loss.";
  }
  else if (dbHlResult <= 25) {
    expectedAge = "30–39";
    dbhlSimpleResultsExplanation = "Based on your results, you likely fall into the 'Normal Hearing Ability' category. This means that this test hasn't detected any warning signs of hearing loss.";
  }
  else if (dbHlResult <= 30) {
    expectedAge = "40–49";
    dbhlSimpleResultsExplanation = "Based on your results, you likely fall into the 'Mild Hearing Loss' category. This means that this test has detected some warning signs of hearing loss. We recommend consulting with a specialist.";
  }
  else if (dbHlResult <= 35) {
    expectedAge = "50–59";
    dbhlSimpleResultsExplanation = "Based on your results, you likely fall into the 'Mild Hearing Loss' category. This means that this test has detected some warning signs of hearing loss. We recommend consulting with a specialist.";
  }
  else if (dbHlResult <= 40) {
    expectedAge = "60–69";
    dbhlSimpleResultsExplanation = "Based on your results, you likely fall into the 'Mild Hearing Loss' category. This means that this test has detected some warning signs of hearing loss. We recommend consulting with a specialist.";
  }
  else if (dbHlResult <= 50) {
    expectedAge = "70–79";
    dbhlSimpleResultsExplanation = "Based on your results, you likely fall into the 'Moderate Hearing Loss' category. This means that this test has detected some warning signs of hearing loss. We recommend consulting with a specialist.";
  }
  else {
    expectedAge = "80+";
    dbhlSimpleResultsExplanation = "Based on your results, you likely fall into the 'Moderately Severe Hearing Loss' category or worse. This means that this test has detected warning signs of hearing loss. We recommend consulting with a specialist.";
  }

  document.getElementById("dbhl-result").textContent =
        `Result: ${dbHlResult} decibels Hearing Loss. ${dbhlSimpleResultsExplanation}`;
  document.getElementById("dbhl-expected-age").textContent = `It is expected to see your results for a person around the ages of ${expectedAge} years old.`;

  document.getElementById("dbhl-results-area").style.display = "flex";
  dbHlRunning = false;
}

function computeDbHlResult()
{
  switch (listeningDeviceType) {
    case "earphones":
      return currentDbSpl - RETSPL_1KHZ_EARPHONES;
    case "overear":
      return currentDbSpl - RETSPL_1KHZ_OVEREAR;
    case "onear":
      return currentDbSpl - RETSPL_1KHZ_ONEAR;
    default:
      return currentDbSpl - RETSPL_1KHZ_ONEAR;
  }
}

async function playDbHlTone()
{
  let ctx = await getAudioContext();

  const testToneSrcNode = getOscillatorNodeWithGain(ctx, DBHL_FREQ_HZ, splToAmp(currentDbSpl));

  const statusDisplay = document.getElementById("dbhl-status");
  statusDisplay.textContent = `Playing 1 kHz @ ${currentDbSpl} dB SPL for ${DBHL_TONE_DURATION_SEC} s…`;

  testToneSrcNode.start(ctx.currentTime);
  testToneSrcNode.stop(ctx.currentTime + DBHL_TONE_DURATION_SEC);

  testToneSrcNode.onended = () => {
  statusDisplay.textContent = `Last level: ${currentDbSpl} dB SPL`;
  };

  // Log each tone played
  const log = document.getElementById("dbhl-log");
  if (log) {
    log.textContent += `Played 1 kHz @ ${currentDbSpl} dB SPL\n`;
    log.scrollTop = log.scrollHeight;
  }
}