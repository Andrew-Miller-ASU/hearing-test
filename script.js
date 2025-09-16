let index = 0, results = [];
let testMode = 'both'; // 'both', 'left', or 'right'
let tones = [];

// dB HL Testing code

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

let audioCtx = null;

function dbfsToAmp(dbfs) {
  const amp = Math.pow(10, dbfs / 20);
  return Math.max(0, Math.min(1, amp));
}
function ampToHL1k(A) {
  if (A <= 0) return -Infinity;
  return 20 * Math.log10(A) + K_1K;
}

async function playSineBuffer(freqHz, dbfs, durationSec) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') { try { await audioCtx.resume(); } catch(e) {} }

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

// End of dB HL Testing code

function calibrationTest() { //display sound element for user to test their audios

    document.getElementById("calibrationTestAudio").src = `audio/250Hz_40dB.wav`;
    document.getElementById("calibrationTestAudio").style.display = "block";

}

function proceedToTest() {

    //User is finished with Calibration, display the test modes.
    document.getElementById("calibration-page").style.display = "none";
    document.getElementById("mode-select").style.display = "block";

}

function startDINTest() { //start DIN test

    document.getElementById("mode-select").style.display = "none";
    document.getElementById("DIN_Test_Area").style.display = "block";
    user_quit = false;
    round_number = 1;
    test_completed = false;
    DIN_noise = generateDINNoise();
    correct_guesses = [];
    round_results = [];
    correct_answer = 0;
    document.getElementById("DINTestAudio").src = `audio/triplets/${DIN_noise[0]}.wav`;
    document.getElementById("quit_DIN_Test_Button").addEventListener('click', function () {

        user_quit = true;
        displayDINTestResults(correct_guesses, round_results);

    });

    document.getElementById("din-play-button").addEventListener('click', function () {

        document.getElementById("DINTestAudio").play();

    });

    document.getElementById("DIN_Test_enter_button").addEventListener('click', function () {

        if (round_number < 21 && !user_quit) {
            
            correct_answer = DIN_noise[round_number - 1];
            input_text = document.getElementById("DIN_User_Input").value;
            
            if (String(input_text) == correct_answer) {

                correct_guesses.push(round_number);
                
            }
            round_results.push(`Round ${round_number}/20: \t Correct Answer: ${correct_answer} \t Your Answer: ${String(input_text)}`);
            
            round_number++;
            if (round_number < 21) {
                document.getElementById("DINTestAudio").src = `audio/triplets/${DIN_noise[round_number - 1]}.wav`;
                document.getElementById("DIN_Test_Round_Display").textContent = `Round ${round_number}/20`;
                document.getElementById("DIN_User_Input").value = "";
                test_completed = true;
            }
            else {

                displayDINTestResults(correct_guesses, round_results);
            }
        }
        else {
            test_completed = true;
            displayDINTestResults(correct_guesses, round_results);
        }
    });

    if (test_completed) {

        displayDINTestResults(correct_guesses, round_results);
    }
}

function displayDINTestResults(correct, results) { //display DIN results


    

    document.getElementById("DIN_Test_Area").style.display = "none";
    document.getElementById("DIN_Results_Area").style.display = "block";

    content = `You were correct ${correct.length} times!\n\n`;

    

    for (i = 0; i < results.length; i++) {

        content += results[i] + "\n";
        
    }
    document.getElementById("DIN_Results_Text_Display").textContent = content;

}

function generateDINNoise() {

    noise = [];
    
    for (i = 0; i < 20; i++) { //create an array of 20 integers

        number = Math.floor(Math.random() * 1000); //create a random integer from 0 to 999
        threeDigitNumber = String(number).padStart(3, '0'); //format that integer to 3 digits
        
        noise.push(String(threeDigitNumber));

        /*while (true) {
            number = Math.floor(Math.random() * 1000); //create a random integer from 0 to 999
            threeDigitNumber = String(number).padStart(3, '0'); //format that integer to 3 digits
            filePath = `audio/triplets/${threeDigitNumber}.wav`; //ensure the file exists in audio/triplets. Make sure you've ran the generate_audio.py file.
            if (doesFileExist(filePath)) {
                console.log('File exists.');
                noise.push(threeDigitNumber);
                break;
            } else {
                console.log('File does not exist.');
                continue;
            }
        }*/
    }

    return noise;
}

function doesFileExist(urlToFile) {
    var xhr = new XMLHttpRequest();
    xhr.open('HEAD', urlToFile, false); // 'false' makes the request synchronous
    xhr.send();

    if (xhr.status === 200) { // HTTP status 200 indicates success (file exists)
        return true;
    } else if (xhr.status === 404) { // HTTP status 404 indicates file not found
        return false;
    } else {
        // Handle other potential status codes if needed (e.g., 403 Forbidden)
        return false;
    }
}

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


