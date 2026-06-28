function isInspectable(url: string | undefined): boolean {
  if (!url) return false;
  // Only inspect http, https, and local file origins
  return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://");
}

async function updateSidePanelBehavior(tabId: number, url: string | undefined) {
  try {
    if (isInspectable(url)) {
      await chrome.sidePanel.setOptions({
        tabId: tabId,
        path: "src/sidepanel/sidepanel.html",
        enabled: true
      });
    } else {
      // Disabling side panel on non-inspectable tabs ensures it automatically closes on switch/load
      await chrome.sidePanel.setOptions({
        tabId: tabId,
        enabled: false
      });
    }
  } catch (error) {
    // Suppress console noise for tabs that were closed before update completed
  }
}

// Open side panel specifically for the active tab when clicking the action icon
chrome.action.onClicked.addListener((tab) => {
  if (tab.id && isInspectable(tab.url)) {
    chrome.sidePanel.open({ tabId: tab.id }).catch((err) => {
      console.error("Failed to open side panel for tab:", tab.id, err);
    });
  }
});

// Listen to tab updates (when user navigates)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    updateSidePanelBehavior(tabId, tab.url).catch(() => {});
  }
});

// Listen to tab activation (when user switches tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab) {
      updateSidePanelBehavior(activeInfo.tabId, tab.url).catch(() => {});
    }
  });
});

// Run initial scan on installation/worker activation
chrome.runtime.onInstalled.addListener(async () => {
  console.log("DevVault background worker installed.");
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        updateSidePanelBehavior(tab.id, tab.url).catch(() => {});
      }
    }
  } catch (e) {
    console.error("Error querying tabs on installation:", e);
  }
});
