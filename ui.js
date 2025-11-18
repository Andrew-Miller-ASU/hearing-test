function show(id)
{
  const element = document.getElementById(id);
  if (element)
  {
    element.style.display = 'block';
  }
}

function hide(id)
{
  const element = document.getElementById(id);
  if (element)
  {
    element.style.display = 'none';
  }
}

function showHome()
{
  document.getElementById("calibration-page").style.display = "";
  document.getElementById("din-calibration-page").style.display = "";
  document.getElementById("test-area").style.display = "";
  document.getElementById("dbhl-test-area").style.display = "";
  document.getElementById("dbhl-modal-backdrop").style.display = "";
  document.getElementById("din-test-area").style.display = "";
  document.getElementById("freq-test-area").style.display = "";
  document.getElementById("pinpoint_highest_audible_for_freq_test").style.display = "";
  document.getElementById("freq-results-area").style.display = "";
  document.getElementById("tg-test-area").style.display = "";
  document.getElementById("tg-bottom-controls").style.display = "";
  document.getElementById("tg-results").style.display = "";
  document.getElementById("summary-section").style.display = "";
  document.getElementById("results-detail").style.display = "";

  document.getElementById("mode-select").style.display = "block";
  document.getElementById("ear-select").style.display = "block";
}

function hideHome()
{
  document.getElementById("mode-select").style.display = "none";
  document.getElementById("ear-select").style.display = "none";
}

function showBasicCalibrationPrompt()
{
  return new Promise((resolve) => {
    hideHome();

    document.getElementById("calibration-page").style.display = "block";

    document.getElementById("cal-test-volume-btn").onclick = () => {
      document.getElementById("calibrationTestAudio").src = `audio/250Hz_40dB.wav`;
      document.getElementById("calibrationTestAudio").style.display = "block";
    };

    document.getElementById("cal-proceed-btn").onclick = () => {
      document.getElementById("calibration-page").style.display = "none";
      resolve();
    };
  });
}

// Make these functions globally accessible
window.show = show;
window.hide = hide;
window.showHome = showHome;
window.hideHome = hideHome;
window.showBasicCalibrationPrompt = showBasicCalibrationPrompt;