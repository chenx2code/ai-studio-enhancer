document.addEventListener('DOMContentLoaded', () => {
  // Localization
  const titleElem = document.getElementById('popup-title');
  const settingThoughtsElem = document.getElementById('setting-include-thoughts');
  const settingLinkElem = document.getElementById('setting-include-link');
  const settingAccountElem = document.getElementById('setting-include-account');
  const settingNotificationsElem = document.getElementById('setting-enable-notifications');
  
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
  if (chrome.i18n.getMessage('settingEnableNotifications')) {
    settingNotificationsElem.textContent = chrome.i18n.getMessage('settingEnableNotifications');
  }

  const checkboxThoughts = document.getElementById('include-thoughts-checkbox');
  const checkboxLink = document.getElementById('include-link-checkbox');
  const checkboxAccount = document.getElementById('include-account-checkbox');
  const checkboxNotifications = document.getElementById('enable-notifications-checkbox');

  // Load current settings
  chrome.storage.local.get(['includeThoughts', 'includeLink', 'includeAccount', 'enableNotifications'], (result) => {
    checkboxThoughts.checked = result.includeThoughts || false;
    checkboxLink.checked = result.includeLink || false;
    checkboxAccount.checked = result.includeAccount || false;
    // Default notifications to true since it's a new feature and unobtrusive
    checkboxNotifications.checked = result.enableNotifications !== false;
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
  checkboxNotifications.addEventListener('change', (e) => {
    chrome.storage.local.set({ enableNotifications: e.target.checked });
  });
});
