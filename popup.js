document.addEventListener('DOMContentLoaded', () => {
  console.log("Popup script started after DOM fully loaded. Verifying document and elements...");

  if (typeof document === 'undefined' || !document.body) {
    // console.error("CRITICAL POPUP ERROR: 'document' or 'document.body' is not available at DOMContentLoaded.");
    alert("Popup Error: Cannot initialize. Document not ready. Please try reloading the extension or browser.");
    return; // Stop execution
  }
  console.log("Document and document.body are available.");

  const actionBtn = document.getElementById("action-button");
  const statusText = document.getElementById("status");
  const intervalInput = document.getElementById("interval");
  const targetUrlInput = document.getElementById("targetUrl");
  const buttonSelectorInput = document.getElementById("buttonSelector");

  let criticalElementMissing = false;
  if (!actionBtn) {
    // console.error("POPUP UI ERROR: Element with ID 'action-button' not found. Check popup.html.");
    criticalElementMissing = true;
  } else {
    console.log("Element 'action-button' found.");
  }

  if (!statusText) {
    // console.error("POPUP UI ERROR: Element with ID 'status' not found. Check popup.html. This is likely the source of the error.");
    criticalElementMissing = true;
  } else {
    console.log("Element 'status' found.");
  }

  if (!intervalInput) {
    // console.error("POPUP UI ERROR: Element with ID 'interval' not found. Check popup.html.");
    criticalElementMissing = true;
  } else {
    console.log("Element 'interval' found.");
  }

  if (!targetUrlInput) {
    // console.error("POPUP UI ERROR: Element with ID 'targetUrl' not found. Check popup.html.");
    criticalElementMissing = true;
  } else {
    console.log("Element 'targetUrl' found.");
  }

  if (!buttonSelectorInput) {
    // console.error("POPUP UI ERROR: Element with ID 'buttonSelector' not found. Check popup.html.");
    criticalElementMissing = true;
  } else {
    console.log("Element 'buttonSelector' found.");
  }

  if (criticalElementMissing) {
    // console.error("POPUP HALTED: One or more critical UI elements are missing. Further script execution stopped.");
    if (statusText) { // This check is important
      statusText.textContent = "Error: UI init failed. See console.";
    }
    return; // Stop further script execution
  }
  console.log("All critical UI elements (actionBtn, statusText, intervalInput, targetUrlInput, buttonSelectorInput) successfully found. Proceeding with script.");

  let statusTimerInterval = null; // Variable to hold the interval ID for the status timer

  // Load saved state and update UI
  if (chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["isRunning", "interval", "startTime", "targetUrl", "buttonSelector"], (result) => {
      if (chrome.runtime.lastError) {
        // console.error("Error loading data from storage:", chrome.runtime.lastError.message);
        statusText.textContent = "Error: Could not load settings.";
        return;
      }
      const isRunning = result.isRunning || false;
      const interval = result.interval || 1;
      const targetUrl = result.targetUrl || "https://x365.ai/quantum";
      const buttonSelector = result.buttonSelector || "CLAIM TOKENS";

      intervalInput.value = interval;
      targetUrlInput.value = targetUrl;
      buttonSelectorInput.value = buttonSelector;
      updateUI(isRunning, result.startTime);
    });
  } else {
    // console.error("Chrome storage API is not available.");
    statusText.textContent = "Error: Storage API unavailable.";
  }

  actionBtn.addEventListener("click", () => {
    const isCurrentlyRunning = actionBtn.textContent === "Stop";
    const newInterval = parseInt(intervalInput.value, 10);
    const newTargetUrl = targetUrlInput.value;
    const newButtonSelector = buttonSelectorInput.value;

    if (isNaN(newInterval) || newInterval < 1) {
        alert("Please enter a valid interval (minimum 1 minute).");
        return;
    }

    if (chrome && chrome.storage && chrome.storage.local) {
      const newIsRunning = !isCurrentlyRunning;
      const dataToSet = { isRunning: newIsRunning, interval: newInterval, targetUrl: newTargetUrl, buttonSelector: newButtonSelector };
      if (newIsRunning) {
        dataToSet.startTime = Date.now(); // Save start time when starting
      }

      chrome.storage.local.set(dataToSet, () => {
        if (chrome.runtime.lastError) {
          console.error("Error saving data to storage:", chrome.runtime.lastError.message);
          statusText.textContent = "Error: Could not save settings.";
          return;
        }

        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
          if (isCurrentlyRunning) { // Means we are stopping
            chrome.runtime.sendMessage({ action: "stop" }, (response) => {
              if (chrome.runtime.lastError) {
                // console.error("Error sending 'stop' message:", chrome.runtime.lastError.message);
              }
              updateUI(newIsRunning, null);
            });
          } else { // Means we are starting
            // Request permissions before starting
            chrome.permissions.request({
              origins: [newTargetUrl]
            }, (granted) => {
              if (granted) {
                chrome.runtime.sendMessage({ action: "start", interval: newInterval, targetUrl: newTargetUrl, buttonSelector: newButtonSelector }, (response) => {
                  if (chrome.runtime.lastError) {
                    // // console.error("Error sending 'start' message:", chrome.runtime.lastError.message);
                  }
                  updateUI(newIsRunning, newIsRunning ? dataToSet.startTime : null);
                });
              } else {
                // console.error("Permission not granted for URL:", newTargetUrl);
                statusText.textContent = "Error: Permission denied for URL.";
                // Revert UI and storage if permission denied
                chrome.storage.local.set({ isRunning: false, startTime: null }, () => {
                   updateUI(false, null);
                });
              }
            });
          }
        } else {
          // console.error("Chrome runtime or sendMessage API is not available.");
          statusText.textContent = "Error: Cannot communicate with background script.";
        }
        // updateUI is now called within the sendMessage callbacks or permission callback
      });
    } else {
      // console.error("Chrome storage API is not available for saving.");
      statusText.textContent = "Error: Storage API unavailable for saving.";
    }
  });

  function updateUI(running, startTime) {
    if (statusTimerInterval) {
      clearInterval(statusTimerInterval);
      statusTimerInterval = null;
    }

    if (running && startTime) {
      actionBtn.textContent = "Stop";
      const updateTimer = () => {
        const now = Date.now();
        const elapsedMs = now - startTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        statusText.textContent = `Status: Running (${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')})`;
      };
      updateTimer(); // Initial call to display time immediately
      statusTimerInterval = setInterval(updateTimer, 1000);
    } else {
      actionBtn.textContent = "Start";
      statusText.textContent = "Status: Stopped";
    }
  }
});
