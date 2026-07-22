document.addEventListener('DOMContentLoaded', () => {
  // Localization
  const titleElem = document.getElementById('popup-title');
  const settingTextElem = document.getElementById('setting-include-thoughts');
  
  if (chrome.i18n.getMessage('popupTitle')) {
    titleElem.textContent = chrome.i18n.getMessage('popupTitle');
  }
  if (chrome.i18n.getMessage('settingIncludeThoughts')) {
    settingTextElem.textContent = chrome.i18n.getMessage('settingIncludeThoughts');
  }

  const checkbox = document.getElementById('include-thoughts-checkbox');

  // Load current setting
  chrome.storage.local.get(['includeThoughts'], (result) => {
    // Default is false (do not include thoughts)
    checkbox.checked = result.includeThoughts || false;
  });

  // Save setting on change
  checkbox.addEventListener('change', (e) => {
    chrome.storage.local.set({ includeThoughts: e.target.checked });
  });
});
