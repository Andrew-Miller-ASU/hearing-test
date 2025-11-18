/***********************
 * Highest-Only Frequency Test
 * - Adds a mode from the existing mode-select
 * - UI has one slider, Play/Stop, and a single "Mark Highest Audible" button
 * - Results screen replaces the test UI after marking
 ***********************/
let pinpointing_exact_frequency = false; // When the user has clicked "No, I can't Hear it" let the user pinpoint their best audible with smaller steps.
let pinpointing_max = 20000;
let pinpointing_min = 2000;
(async function () {
  // --- Local state
  let ctx = await getAudioContext();
  let freqCurrentHz = 2000;
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
  window.startFreqTest = async function startFreqTest() {
    await showBasicCalibrationPrompt();

    // Hide other test areas to avoid overlap
    safeHide("mode-select");
    safeHide("ear-select");
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
    if (!freqPlaying) {                                                             // Only start the tone if it's not already playing
      oscNode = getOscillatorNodeWithGain(ctx, freqCurrentHz, 0.25);                // Create the OscillatorNode to play the tone (at the freqency determined by the input slider)
      oscNode.start();                                                              // Play the tone
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
    try { oscNode.stop() } catch {};                                                   // Stop playing the tone
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

    freqHighestHzSimplifiedExplanation = document.getElementById("freq-results-norms-simplified-explanation");
    if(freqHighestHz <= 8000){
      freqHighestHzSimplifiedExplanation.innerHTML = `<strong>In your case, your score was ${freqFmtHz(freqHighestHz)}, which is a sign of frailty. We recommend consulting with a specialist.</strong>`;
    }
    else{
      freqHighestHzSimplifiedExplanation.innerHTML = `<strong>In your case, your score was ${freqFmtHz(freqHighestHz)}, which is above the range where hearing loss is typically detected. This test hasn't detected signs of frailty for you.</strong>`;
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
    try { oscNode.stop() } catch {};
    freqPlaying = false;
    pinpointing_exact_frequency = false;
    safeHide("freq-test-area");
    safeHide("freq-results-area");
    safeHide("pinpoint_highest_audible_for_freq_test");
    safeShow("mode-select");
    safeShow("ear-select");
  };

  // Automatically stop the tone playback if the user leaves the test
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      try { oscNode.stop() } catch {};
      freqPlaying = false;
    }
  });
  window.addEventListener("load", () => { 
    try { oscNode.stop() } catch {};
    freqPlaying = false;
  });
  window.addEventListener("beforeunload", () => { 
    try { oscNode.stop() } catch {};
    freqPlaying = false;
  });
    window.addEventListener("pagehide", () => { 
    try { oscNode.stop() } catch {};
    freqPlaying = false;
  });

})();
