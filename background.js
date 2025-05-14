const ALARM_NAME = "auto_miner_alarm";
let TARGET_URL = "https://x365.ai/quantum"; // Default value
let BUTTON_SELECTOR = 'button[data-v-b24bcc6d]'; // Default value

function executeTask() {
  chrome.storage.local.get(["targetUrl", "buttonSelector"], (result) => {
    TARGET_URL = result.targetUrl || "https://x365.ai/quantum";
    BUTTON_SELECTOR = result.buttonSelector || 'button[data-v-b24bcc6d]';

    // Check if a tab with the target URL already exists
    chrome.tabs.query({ url: TARGET_URL }, (existingTabs) => {
    if (existingTabs.length > 0) {
      // Tab already exists, use the first one found
      const existingTab = existingTabs[0];
      // Optionally, you might want to focus the existing tab or reload it
      // For now, we'll just execute the script in it
      executeScriptInTab(existingTab.id);
    } else {
      // No existing tab, create a new one
      chrome.tabs.create({ url: TARGET_URL, active: false }, (newTab) => {
        executeScriptInTab(newTab.id);
      });
    }
  });
}); // Closing bracket for chrome.storage.local.get
}

function executeScriptInTab(tabId) {
  setTimeout(() => {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (currentButtonSelector) => {
        const btn = document.querySelector(currentButtonSelector); // use dynamic selector
        if (btn) {
          btn.click();
          console.log('Button clicked in tab:', tabId);
          return true; // Indicate button was clicked
        } else {
          console.log('Button not found after delay in tab:', tabId);
          return false; // Indicate button was not found
        }
      },
      args: [BUTTON_SELECTOR] // Pass the selector to the script
    });
  }, 10000); // Delay before executing script
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "start") {
    // Save the new targetUrl and buttonSelector from the popup message
    TARGET_URL = request.targetUrl || TARGET_URL;
    BUTTON_SELECTOR = request.buttonSelector || BUTTON_SELECTOR;
    chrome.storage.local.set({ targetUrl: TARGET_URL, buttonSelector: BUTTON_SELECTOR }, () => {
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
  if (alarm.name === ALARM_NAME) {
    console.log("Alarm triggered:", alarm.name);
    executeTask();
  }
});
