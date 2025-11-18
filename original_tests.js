let index = 0, results = [];
let testMode = 'both'; // 'both', 'left', or 'right'
let tones = [];

function startTest(mode) {
  testMode = mode;
  document.getElementById("summary-section").style.display = "none";
  document.getElementById("results-detail").style.display = "none";
  document.getElementById("summary-text").textContent = "";

  document.getElementById("mode-select").style.display = "none";
  document.getElementById("ear-select").style.display = "none";
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