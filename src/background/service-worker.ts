// Set up the side panel behavior to open when clicking the extension icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Error setting side panel behavior:", error));

// Log startup for debugging
chrome.runtime.onInstalled.addListener(() => {
  console.log("DevVault background worker installed.");
});
