function tg$(id){ return document.getElementById(id); }
function tgShow(id){ const el=tg$(id); if (el) el.style.display='block'; }
function tgHide(id){ const el=tg$(id); if (el) el.style.display='none'; }

let tgActiveSources = [];

// Open TG; hide other modes
window.startTemporalGapTest = async function startTemporalGapTest(){
  await showBasicCalibrationPrompt();
  tgHide("mode-select");
  tgHide("ear-select");
  tgHide("test-area");
  tgHide("dbhl-test-area");
  tgHide("din-test-area");
  tgHide("freq-test-area");
  tgHide("freq-results-area");
  tgHide("summary-section");
  tgHide("results-detail");

  tgShow("tg-test-area");
  tgReset();
};

// Back to menu
window.backToModesFromTG = function backToModesFromTG(){
  tgStopAudio();
  tgHide("tg-test-area");
  tgShow("mode-select");
  tgShow("ear-select");
};

// ---------- Audio engine (centered silent gap inside noise) ----------
const TGD_NOISE_SEC = 0.5;   // duration of each interval (A or B)
const TGD_ISI_SEC   = 0.5;   // gap between A and B
const TGD_FADE_MS   = 1;     // ramp edges (ms)
const TGD_GAP_POS   = 50;    // where the gap sits inside the interval (%)
const TGD_USE_FADES = true;

const TGD_SAMPLE_RATE_HZ = 50000;
const TGD_CUTOFF_FREQ_HZ = 5000;

// ---------- Adaptive gap  ----------
let TGD_GAP_MS = 25;          // start gap 
const TGD_GAP_MIN = 1;
const TGD_GAP_MAX = 200;
const TGD_STEP_DOWN = 0.80;   // 20% smaller after two correct
const TGD_STEP_UP   = 1.25;   // 25% larger after one wrong
let tgConsecCorrect = 0;      // consecutive correct counter
let tgLastDir = null;         // 'up' | 'down' | null
let tgReversalGaps = [];      // store gaps at reversals for threshold estimate



let tgdTestBaseGain = 0.1;

// Play one interval with an optional internal silent gap
async function tgdPlayNoiseInterval(gapMs, gapPosPct, fade, startAt) {
  const ctx = await getAudioContext();
  let noiseAudioBufferTgd = await getWhiteNoiseAudioBuffer(TGD_NOISE_SEC, TGD_SAMPLE_RATE_HZ, TGD_CUTOFF_FREQ_HZ);
  let [src, gain] = getSourceNodeWithGain(ctx, noiseAudioBufferTgd, 1.0);

  tgActiveSources.push(src);
  src.onended = () => {
    tgActiveSources = tgActiveSources.filter(s => s !== src);
  };

  const t0 = startAt ?? (ctx.currentTime + 0.05);
  const t1 = t0 + TGD_NOISE_SEC;

  const ramp = TGD_FADE_MS / 1000;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(tgdTestBaseGain, t0 + ramp);

  if (gapMs > 0){
    const gapStart = t0 + (TGD_NOISE_SEC * (gapPosPct / 100));
    const gapEnd   = gapStart + (gapMs / 1000);
    if (fade){
      gain.gain.setValueAtTime(tgdTestBaseGain, Math.max(t0 + ramp, gapStart - ramp));
      gain.gain.linearRampToValueAtTime(0, gapStart);
      gain.gain.setValueAtTime(0, gapEnd);
      gain.gain.linearRampToValueAtTime(tgdTestBaseGain, gapEnd + ramp);
    } else {
      gain.gain.setValueAtTime(tgdTestBaseGain, t0 + ramp);
      gain.gain.setValueAtTime(0, gapStart);
      gain.gain.setValueAtTime(tgdTestBaseGain, gapEnd);
    }
  } else {
    gain.gain.setValueAtTime(tgdTestBaseGain, t1 - ramp);
  }
  gain.gain.linearRampToValueAtTime(0, t1);

  src.start(t0);
  src.stop(t1);

  return { start: t0, stop: t1 };
}

// Play A and B optionally force which side has the gap used by Replay
async function tgdPlayTwoIntervals(gapMs, gapPosPct, fade, forcedGapInFirst = null){
  const ctx = await getAudioContext();
  const t0 = ctx.currentTime + 0.2;
  const gapInFirst = (forcedGapInFirst === null) ? (Math.random() < 0.5) : !!forcedGapInFirst;

  // UI lines in sync with audio
  scheduleLineAnimation(tgLines.a.fill, t0, TGD_NOISE_SEC);
  const A = await tgdPlayNoiseInterval(gapInFirst ? gapMs : 0, gapPosPct, fade, t0);

  scheduleLineAnimation(tgLines.b.fill, A.stop + TGD_ISI_SEC, TGD_NOISE_SEC);
  const B = await tgdPlayNoiseInterval(gapInFirst ? 0 : gapMs, gapPosPct, fade, A.stop + TGD_ISI_SEC);

  return new Promise(resolve => {
    const waitMs = Math.max(0, (B.stop - ctx.currentTime) * 1000);
    const t = setTimeout(() => resolve({ gapInFirst, doneAt: B.stop }), waitMs + 5);
    tgTimers.push(t);
  });
}

// ---------- UI state, progress, and inline audio lines ----------
const tgCFG = { totalTrials: 24 };
let tgState = null;
let tgAudioState = null;   // {gapInFirst}
let tgTimers = [];         // timeouts to clear on reset

const tgLines = {
  a: { track: null, fill: null },
  b: { track: null, fill: null }
};

function clearTimers(){
  tgTimers.forEach(id => clearTimeout(id));
  tgTimers = [];
}

function ensureAudioLines(){
  // remove old
  const oldA = document.getElementById("tg-line-a-track");
  const oldB = document.getElementById("tg-line-b-track");
  if (oldA) oldA.remove();
  if (oldB) oldB.remove();
  const tiles = Array.from(document.querySelectorAll(".tg-audio .tg-audio-visual"));
  const aTile = tiles[0];
  const bTile = tiles[1];

  function mountInsideTile(tile, id){
    if (!tile) return { track:null, fill:null };
    tile.style.position = "relative";
    tile.style.overflow = "hidden";

    const track = document.createElement("div");
    track.id = `${id}-track`;
    Object.assign(track.style, {
      position: "absolute",
      left: "10px",
      right: "10px",
      bottom: "10px",
      height: "8px",
      borderRadius: "999px",
      background: "#e5e7eb",
      opacity: 0.95,
      overflow: "hidden",
      pointerEvents: "none"
    });

    const fill = document.createElement("div");
    fill.id = `${id}-fill`;
    Object.assign(fill.style, {
      width: "0%",
      height: "100%",
      background: "#60a5fa",
      transition: "none",
      pointerEvents: "none"
    });

    track.appendChild(fill);
    tile.appendChild(track);
    fill.style.transition = "none";
    fill.style.width = "0%";
    return { track, fill };
  }

  tgLines.a = mountInsideTile(aTile, "tg-line-a");
  tgLines.b = mountInsideTile(bTile, "tg-line-b");
}

function scheduleLineAnimation(fillEl, startAtSec, durSec){
  if (!fillEl) return;
  getAudioContext().then(ctx => {
    const delayMs = Math.max(0, (startAtSec - ctx.currentTime) * 1000);
    const t = setTimeout(() => animateLine(fillEl, durSec), delayMs);
    tgTimers.push(t);
  });
}

function animateLine(fillEl, durSec){
  fillEl.style.transition = "none";
  fillEl.style.width = "0%";
  requestAnimationFrame(() => {
    fillEl.style.transition = `width ${durSec}s linear`;
    fillEl.style.width = "100%";
    const t = setTimeout(() => {
      fillEl.style.transition = "none";
      fillEl.style.width = "0%";
    }, durSec * 1000 + 20);
    tgTimers.push(t);
  });
}

function tgReset(){
  clearTimers();
  tgStopAudio();
  ensureAudioLines();

    // reset staircase
  TGD_GAP_MS = 25;
  tgConsecCorrect = 0;
  tgLastDir = null;
  tgReversalGaps = [];


  tgState = { running:false, trial:0, awaiting:false, logs:[] };
  tgAudioState = null;

  tg$("tg-status").textContent = "Ready";
  tg$("tg-progress").textContent = `Trial 0 / ${tgCFG.totalTrials}`;
  tg$("tg-progress-bar").style.width = "0%";
  tg$("tg-first-btn").disabled  = true;
  tg$("tg-second-btn").disabled = true;
  tg$("tg-replay-btn").disabled = true;

  const startBtn = tg$("tg-start-btn");
  if (startBtn) startBtn.textContent = "Start Test";

  tgHide("tg-results");
}

// Start / Restart
window.tgBegin = async function tgBegin(){
  tgReset();
  const startBtn = tg$("tg-start-btn");
  if (startBtn) startBtn.textContent = "Restart Test";

  tgState.running = true;
  await tgRunOneAB(false);
};

// Replay same assignment doesn’t advance trial
window.tgReplay = async function tgReplay(){
  if (!tgState?.running || !tgAudioState) return;
  tg$("tg-first-btn").disabled  = true;
  tg$("tg-second-btn").disabled = true;
  tg$("tg-replay-btn").disabled = true;

  tg$("tg-status").textContent = "Replaying…";
  await tgRunOneAB(true);
};

// One A/B pass
async function tgRunOneAB(useLast=false){
  tg$("tg-status").textContent = "Listening…";
  tgState.awaiting = false;

  // decide side and keep it for replay
  const forcedGapInFirst = useLast && tgAudioState ? tgAudioState.gapInFirst : null;

  const res = await tgdPlayTwoIntervals(TGD_GAP_MS, TGD_GAP_POS, TGD_USE_FADES, forcedGapInFirst);
  tgAudioState = { gapInFirst: forcedGapInFirst === null ? res.gapInFirst : forcedGapInFirst };

  tg$("tg-status").textContent = "Which had the pause?";
  tg$("tg-first-btn").disabled  = false;
  tg$("tg-second-btn").disabled = false;
  tg$("tg-replay-btn").disabled = false;
  tgState.awaiting = true;
}


window.tgChoose = function tgChoose(choice){
  if (!tgState?.running || !tgState.awaiting) return;

  // lock inputs during transition
  tg$("tg-first-btn").disabled  = true;
  tg$("tg-second-btn").disabled = true;
  tg$("tg-replay-btn").disabled = true;
  tgState.awaiting = false;

  // did user pick the side with the gap?
  // gap was on FIRST if tgAudioState.gapInFirst === true
  const correct = (choice === (tgAudioState?.gapInFirst ? 1 : 2));

  // log the trial
  tgState.logs.push({
    trial: tgState.trial + 1,
    response: choice,
    correct,
    gapMs: Number(TGD_GAP_MS.toFixed(2))
  });

  // ----- staircase -----
  let dir = null;
  if (correct){
    tgConsecCorrect += 1;
    if (tgConsecCorrect >= 2){
      dir = "down";
      TGD_GAP_MS = Math.max(TGD_GAP_MIN, TGD_GAP_MS * TGD_STEP_DOWN);
      tgConsecCorrect = 0;
    }
  } else {
    dir = "up";
    TGD_GAP_MS = Math.min(TGD_GAP_MAX, TGD_GAP_MS * TGD_STEP_UP);
    tgConsecCorrect = 0;
  }
  // reversal detection 
  if (dir && tgLastDir && dir !== tgLastDir){
    tgReversalGaps.push(Number(TGD_GAP_MS.toFixed(2)));
  }
  tgLastDir = dir;
  // -----------------------------------

  // progress UI
  tgState.trial += 1;
  const t = tgState.trial, total = tgCFG.totalTrials;
  tg$("tg-progress").textContent = `Trial ${t} / ${total}`;
  tg$("tg-progress-bar").style.width = Math.min(100, Math.round((t/total)*100)) + "%";
  tg$("tg-status").textContent = `Next gap: ${TGD_GAP_MS.toFixed(1)} ms`;

  // end or continue
  if (t >= total){
    tgState.running = false;

    // simple threshold estimate: mean of last 3–4 reversals if available
    let estimate = TGD_GAP_MS;
    if (tgReversalGaps.length >= 3){
      const tail = tgReversalGaps.slice(-4);
      estimate = tail.reduce((a,b)=>a+b,0) / tail.length;
    }

    tg$("tg-status").textContent = "Done";
    if(estimate.toFixed(1) < 8){
      tg$("tg-result-summary").innerHTML =
        `<strong>Estimated temporal resolution ≈ ${estimate.toFixed(1)} ms (lower is better). This is relatively normal.</strong>`;
    }
    else{

      tg$("tg-result-summary").textContent =
        `<strong>Estimated temporal resolution ≈ ${estimate.toFixed(1)} ms (lower is better). It might be a good idea to consult with a specialist.</strong>`;
    }
    tgShow("tg-results");
    return;
  }

  // next A/B 
  setTimeout(() => { tgRunOneAB(false); }, 450);
};

// Keyboard shortcuts
window.addEventListener("keydown", (e) => {
  if (!tgState?.running || !tgState.awaiting) return;
  if (e.key === "1") tgChoose(1);
  if (e.key === "2") tgChoose(2);
});

// Ensures all audio is stopped when the user exits the test
window.addEventListener("beforeunload", () => {
  tgStopAudio();
});

function tgStopAudio(){
  tgActiveSources.forEach(src => {
    try { src.stop(); } catch (e) {}
    try { src.disconnect(); } catch (e) {}
  });
  tgActiveSources = [];
}