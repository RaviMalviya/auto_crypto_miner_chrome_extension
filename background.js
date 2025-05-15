const ALARM_NAME = "auto_miner_alarm";

const DEFAULT_TARGET_URL = "https://x365.ai/quantum";
const DEFAULT_BUTTON_SELECTOR = "CLAIM TOKENS";

let targetUrl = DEFAULT_TARGET_URL; // Default value
let buttonSelector = DEFAULT_BUTTON_SELECTOR; // Default value

let miningClaimInProgress = false; // Flag to track if the button has been clicked

function executeTask() {
  chrome.storage.local.get(["targetUrl", "buttonSelector"], (result) => {
    targetUrl = result.targetUrl || DEFAULT_TARGET_URL;
    buttonSelector = result.buttonSelector || DEFAULT_BUTTON_SELECTOR;

    // Check if a tab with the target URL already exists
    chrome.tabs.query({ url: targetUrl }, (existingTabs) => {
      if (existingTabs.length > 0) {
        // Tab already exists, use the first one found
        const existingTab = existingTabs[0];
        // Optionally, you might want to focus the existing tab or reload it
        // For now, we'll just execute the script in it
        executeScriptInTab(existingTab.id, () => {
          miningClaimInProgress = false;
        });
      } else {
        // No existing tab, create a new one
        chrome.tabs.create({ url: targetUrl, active: false }, (newTab) => {
          executeScriptInTab(newTab.id, () => {
            miningClaimInProgress = false;
          });
        });
      }
    });
  }); // Closing bracket for chrome.storage.local.get
}

function executeScriptInTab(tabId, completeCallback = null) {
  chrome.tabs.reload(tabId, {}, () => {

    setTimeout(() => {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (currentButtonSelector) => {
          // Your script logic here
          let btn = Array.from(document.querySelectorAll("button")).find(el => el.textContent.trim().toLocaleLowerCase() === currentButtonSelector.toLocaleLowerCase());
          if (btn) {
            btn.click();
            console.log('Button clicked in tab:', tabId);
            return true; // Indicate button was clicked
          } else {
            btn = document.querySelector(`button[${currentButtonSelector}]`);
            if(btn) {
              btn.click();
              console.log('Button clicked in tab:', tabId);
              return true; // Indicate button was clicked
            } else {
              console.log('Button not found after delay in tab:', tabId);
              return false; // Indicate button was not found
            }
          }
        },
        args: [buttonSelector] // Pass the selector to the script
      }, (results) => {
        // Callback in extension context
        console.log('Script execution result:', results);
        if (completeCallback) completeCallback();
      });
    }, 10000);
  });// Delay before executing script
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "start") {
    // Save the new targetUrl and buttonSelector from the popup message
    targetUrl = request.targetUrl || targetUrl;
    buttonSelector = request.buttonSelector || buttonSelector;
    chrome.storage.local.set({ targetUrl: targetUrl, buttonSelector: buttonSelector }, () => {
      console.log('Background: Target URL and Button Selector updated and saved.');
    });

    chrome.alarms.get(ALARM_NAME, (alarm) => {
      if (alarm) {
        console.log("Alarm already exists, clearing and resetting.");
        chrome.alarms.clear(ALARM_NAME, () => {
          chrome.alarms.create(ALARM_NAME, { periodInMinutes: request.interval });
          console.log(`Alarm set to run every ${request.interval} minutes.`);
        });
      } else {
        chrome.alarms.create(ALARM_NAME, { periodInMinutes: request.interval });
        console.log(`Alarm set to run every ${request.interval} minutes.`);
      }
    });
    sendResponse({ status: "Alarm started" });
  } else if (request.action === "stop") {
    chrome.alarms.clear(ALARM_NAME, (wasCleared) => {
      if (wasCleared) {
        console.log("Alarm cleared.");
        sendResponse({ status: "Alarm stopped" });
      } else {
        console.log("No alarm to clear or error clearing alarm.");
        sendResponse({ status: "Alarm not found or error stopping" });
      }
    });
  }
  return true; // Indicates that the response will be sent asynchronously
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME && !miningClaimInProgress) {
    miningClaimInProgress = true;
    console.log("Alarm triggered:", alarm.name);
    executeTask();
  }
});
