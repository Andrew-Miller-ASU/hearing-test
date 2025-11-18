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
  document.getElementById("ear-select").style.display = "none";
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
  document.getElementById("ear-select").style.display = "none";
  document.getElementById("din-test-area").style.display = "block";   // Show the DIN testing interface

  resetDinTest();

  let triplet = null;

  // Play button event listener
  document.getElementById("din-play-btn").addEventListener("click", async () => {
    if (!triplet) triplet = getRandomDigitTriplet();              // Generate a new digit triplet if one hasn't been generated already for this test
    document.getElementById("din-play-btn").disabled = true;      // Disable the button while the triplet is playing to avoid overlapping audio
    await playTriplet(triplet, getGainForRound(currentRound));    // Play the triplet with the appropriate noise level for the current round
    document.getElementById("din-play-btn").disabled = false;     // Reenable the button to allow the triplet to be replayed
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
  DIN_BEST_SNR_DISPLAY = document.getElementById("din-best-snr-display");

  for (const item of dinTestData)
  {
    if (item.result === true && item.snr < lowestSnr) lowestSnr = item.snr;
  }

  DIN_Test_Normal_Result_Explanation = "Your score falls into the 'Normal' category. This test hasn't detected any causes for concern.";
  DIN_Test_Inefficient_Result_Explanation = "Your score falls into the 'Inefficient' category. While this likely isn't a major sign for concern, this does indicate that you are not in optimal condition and may be at risk of frailty sooner than you think. It might be a good idea to consult with a specialist and get a proper check up.";
  DIN_Test_Poor_Result_Explanation = "Your score falls into the 'Poor' category. This is a sign of frailty. We recommend seeing a specialist.";

  document.getElementById("din-test-controls").style.display = "none";                                                      // Hide the controls for an active test
  DIN_BEST_SNR_DISPLAY.textContent =                                                             // Display the user's best (lowest) SNR score
    `Your best SNR score was: ${lowestSnr === Infinity ? `N/A. None of your attempts were correct. While this could be a sign of frailty, in which we would recommend you consult with a specialist, it is likely that you didn't complete the full test. We recommend redoing the test to completion for a more accurate assessment.` : `${lowestSnr.toFixed(2)} dB.`}`;
  document.getElementById("din-results-section").style.display = "block";                                                   // Show the end-of-test results table

  if(lowestSnr != Infinity){ // explanations for the results.

    DIN_Test_Display_Explanation = DIN_BEST_SNR_DISPLAY.textContent;

    if(lowestSnr.toFixed(2) <= -5.55){
      DIN_BEST_SNR_DISPLAY.textContent = DIN_Test_Display_Explanation + " " + DIN_Test_Normal_Result_Explanation;
    }
    else if(lowestSnr.toFixed(2) > -5.55 && lowestSnr.toFixed(2) <= -3.8){

      DIN_BEST_SNR_DISPLAY.textContent = DIN_Test_Display_Explanation + " " + DIN_Test_Inefficient_Result_Explanation;
    }
    else{
      DIN_BEST_SNR_DISPLAY.textContent = DIN_Test_Display_Explanation + " " + DIN_Test_Poor_Result_Explanation;
    }
  }
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

  return new Promise(resolve => {
    noiseSourceNode.onended = () => {
      resolve({ triplet, gainAmount });       // Return the triplet that was played and the volume level
    };
  });
}