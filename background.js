// ============================================================
// TAB LIMITER — Background Service Worker
// Monitors tab count and enforces the limit
// ============================================================

import { trackTabBlocked } from './analytics.js';

const LIMIT_KEY = 'tab_limit';
const DEFAULT_LIMIT = 10;
const ENABLED_KEY = 'tab_limiter_enabled';

// Listen for new tabs being created
chrome.tabs.onCreated.addListener(async (tab) => {
  const stored = await chrome.storage.local.get([LIMIT_KEY, ENABLED_KEY]);
  const limit = stored[LIMIT_KEY] || DEFAULT_LIMIT;
  const enabled = stored[ENABLED_KEY] !== false; // default: enabled

  if (!enabled) return;

  // Count all tabs across all windows
  const allTabs = await chrome.tabs.query({});
  if (allTabs.length > limit) {
    // Close the newly opened tab
    chrome.tabs.remove(tab.id);
    // Track the block event
    trackTabBlocked();
    // Show notification badge on icon
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#FF4444' });
    // Clear badge after 3 seconds
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 3000);
  } else {
    // Update badge with current count
    chrome.action.setBadgeText({ text: String(allTabs.length) });
    chrome.action.setBadgeBackgroundColor({ color: '#4A90E2' });
  }
});

// Update badge when tabs are closed
chrome.tabs.onRemoved.addListener(async () => {
  const stored = await chrome.storage.local.get(ENABLED_KEY);
  const enabled = stored[ENABLED_KEY] !== false;
  if (!enabled) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
  const allTabs = await chrome.tabs.query({});
  if (allTabs.length > 0) {
    chrome.action.setBadgeText({ text: String(allTabs.length) });
    chrome.action.setBadgeBackgroundColor({ color: '#4A90E2' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
});

// Initialize badge on startup
chrome.runtime.onStartup.addListener(async () => {
  const stored = await chrome.storage.local.get(ENABLED_KEY);
  const enabled = stored[ENABLED_KEY] !== false;
  if (enabled) {
    const allTabs = await chrome.tabs.query({});
    chrome.action.setBadgeText({ text: String(allTabs.length) });
    chrome.action.setBadgeBackgroundColor({ color: '#4A90E2' });
  }
});
