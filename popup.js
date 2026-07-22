document.addEventListener('DOMContentLoaded', () => {
  // Localization
  const titleElem = document.getElementById('popup-title');
  const settingThoughtsElem = document.getElementById('setting-include-thoughts');
  const settingLinkElem = document.getElementById('setting-include-link');
  const settingAccountElem = document.getElementById('setting-include-account');
  
  if (chrome.i18n.getMessage('popupTitle')) {
    titleElem.textContent = chrome.i18n.getMessage('popupTitle');
  }
  if (chrome.i18n.getMessage('settingIncludeThoughts')) {
    settingThoughtsElem.textContent = chrome.i18n.getMessage('settingIncludeThoughts');
  }
  if (chrome.i18n.getMessage('settingIncludeLink')) {
    settingLinkElem.textContent = chrome.i18n.getMessage('settingIncludeLink');
  }
  if (chrome.i18n.getMessage('settingIncludeAccount')) {
    settingAccountElem.textContent = chrome.i18n.getMessage('settingIncludeAccount');
  }

  const checkboxThoughts = document.getElementById('include-thoughts-checkbox');
  const checkboxLink = document.getElementById('include-link-checkbox');
  const checkboxAccount = document.getElementById('include-account-checkbox');

  // Load current settings
  chrome.storage.local.get(['includeThoughts', 'includeLink', 'includeAccount'], (result) => {
    checkboxThoughts.checked = result.includeThoughts || false;
    checkboxLink.checked = result.includeLink || false;
    checkboxAccount.checked = result.includeAccount || false;
  });

  // Save settings on change
  checkboxThoughts.addEventListener('change', (e) => {
    chrome.storage.local.set({ includeThoughts: e.target.checked });
  });
  checkboxLink.addEventListener('change', (e) => {
    chrome.storage.local.set({ includeLink: e.target.checked });
  });
  checkboxAccount.addEventListener('change', (e) => {
    chrome.storage.local.set({ includeAccount: e.target.checked });
  });
});
