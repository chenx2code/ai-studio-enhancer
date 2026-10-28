// popup.js
// Handles reading, saving, and internationalizing AI Studio Enhancer settings in Google Material Design 3 style

const DEFAULT_SETTINGS = {
  includeThoughts: false,
  includeLink: false,
  includeAccount: false,
  enableNotifications: true,
  obsidianFolder: 'AI Studio',
  obsidianVault: '',
  obsidianPromptFolder: false
};

// UI localization strings fallback
const I18N_STRINGS = {
  zh: {
    exportSectionTitle: '导出偏好',
    thoughtsTitle: '包含思考过程',
    thoughtsDesc: '导出模型的思考链与推理过程',
    linkTitle: '包含对话链接',
    linkDesc: '导出 Markdown 时附带原始对话链接',
    accountTitle: '包含账号邮箱',
    accountDesc: '导出 Markdown 时附带当前账号信息',
    notificationSectionTitle: '通知提醒',
    notificationsTitle: '桌面通知',
    notificationsDesc: '生成完毕时发送通知（仅后台标签触发）',
    obsidianSectionTitle: 'Obsidian 设置',
    obsidianPromptFolderTitle: '导出前询问目标文件夹',
    obsidianPromptFolderDesc: '每次导出时弹窗选择目标文件夹',
    obsidianFolderTitle: '默认目标文件夹',
    obsidianFolderDesc: '关闭上方开关时直接导出到此文件夹',
    obsidianVaultTitle: 'Vault 仓库名称',
    obsidianVaultDesc: '留空则在当前活动的 Vault 中创建',
    autoSaveText: '更改已自动保存',
    savedFeedback: '设置已保存'
  },
  en: {
    exportSectionTitle: 'Export Preferences',
    thoughtsTitle: 'Include thinking process',
    thoughtsDesc: 'Export model reasoning and thoughts',
    linkTitle: 'Include conversation link',
    linkDesc: 'Add original chat link to Markdown export',
    accountTitle: 'Include account email',
    accountDesc: 'Add Google account email to Markdown header',
    notificationSectionTitle: 'Notifications',
    notificationsTitle: 'Desktop notifications',
    notificationsDesc: 'Notify when generation is complete (background only)',
    obsidianSectionTitle: 'Obsidian Settings',
    obsidianPromptFolderTitle: 'Ask folder before export',
    obsidianPromptFolderDesc: 'Prompt to choose a destination folder on each export',
    obsidianFolderTitle: 'Default target folder',
    obsidianFolderDesc: 'Used when the switch above is disabled',
    obsidianVaultTitle: 'Vault name',
    obsidianVaultDesc: 'Leave blank for active vault',
    autoSaveText: 'Changes saved automatically',
    savedFeedback: 'Settings saved'
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const thoughtsToggle = document.getElementById('includeThoughts');
  const linkToggle = document.getElementById('includeLink');
  const accountToggle = document.getElementById('includeAccount');
  const notificationsToggle = document.getElementById('enableNotifications');

  const obsidianSectionTitle = document.getElementById('obsidianSectionTitle');
  const obsidianPromptFolder = document.getElementById('obsidianPromptFolder');
  const obsidianPromptFolderTitle = document.getElementById('obsidianPromptFolderTitle');
  const obsidianPromptFolderDesc = document.getElementById('obsidianPromptFolderDesc');
  const obsidianFolderRow = document.getElementById('obsidianFolderRow');
  const obsidianFolder = document.getElementById('obsidianFolder');
  const obsidianFolderTitle = document.getElementById('obsidianFolderTitle');
  const obsidianFolderDesc = document.getElementById('obsidianFolderDesc');
  const obsidianVault = document.getElementById('obsidianVault');
  const obsidianVaultTitle = document.getElementById('obsidianVaultTitle');
  const obsidianVaultDesc = document.getElementById('obsidianVaultDesc');

  const versionChip = document.getElementById('versionChip');
  const exportSectionTitle = document.getElementById('exportSectionTitle');
  const thoughtsTitle = document.getElementById('thoughtsTitle');
  const thoughtsDesc = document.getElementById('thoughtsDesc');
  const linkTitle = document.getElementById('linkTitle');
  const linkDesc = document.getElementById('linkDesc');
  const accountTitle = document.getElementById('accountTitle');
  const accountDesc = document.getElementById('accountDesc');
  const notificationSectionTitle = document.getElementById('notificationSectionTitle');
  const notificationsTitle = document.getElementById('notificationsTitle');
  const notificationsDesc = document.getElementById('notificationsDesc');
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');

  // Detect language and apply localization
  let isChinese = false;
  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      isChinese = navigator.language.toLowerCase().startsWith('zh');
    }
    if (!isChinese && typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.i18n?.getUILanguage) {
      isChinese = chrome.i18n.getUILanguage().toLowerCase().startsWith('zh');
    }
  } catch (e) {
    isChinese = (typeof navigator !== 'undefined' && navigator.language && navigator.language.toLowerCase().startsWith('zh')) || false;
  }

  const strings = isChinese ? I18N_STRINGS.zh : I18N_STRINGS.en;

  const getMsg = (key, fallback) => {
    try {
      if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
        const msg = chrome.i18n.getMessage(key);
        if (msg) return msg;
      }
    } catch (e) {}
    return fallback;
  };

  if (exportSectionTitle) exportSectionTitle.textContent = getMsg('exportSectionTitle', strings.exportSectionTitle);
  if (thoughtsTitle) thoughtsTitle.textContent = getMsg('settingIncludeThoughtsTitle', strings.thoughtsTitle);
  if (thoughtsDesc) thoughtsDesc.textContent = getMsg('settingIncludeThoughtsDesc', strings.thoughtsDesc);
  if (linkTitle) linkTitle.textContent = getMsg('settingIncludeLinkTitle', strings.linkTitle);
  if (linkDesc) linkDesc.textContent = getMsg('settingIncludeLinkDesc', strings.linkDesc);
  if (accountTitle) accountTitle.textContent = getMsg('settingIncludeAccountTitle', strings.accountTitle);
  if (accountDesc) accountDesc.textContent = getMsg('settingIncludeAccountDesc', strings.accountDesc);
  if (notificationSectionTitle) notificationSectionTitle.textContent = getMsg('notificationSectionTitle', strings.notificationSectionTitle);
  if (notificationsTitle) notificationsTitle.textContent = getMsg('settingEnableNotificationsTitle', strings.notificationsTitle);
  if (notificationsDesc) notificationsDesc.textContent = getMsg('settingEnableNotificationsDesc', strings.notificationsDesc);

  if (obsidianSectionTitle) obsidianSectionTitle.textContent = getMsg('obsidianSectionTitle', strings.obsidianSectionTitle);
  if (obsidianPromptFolderTitle) obsidianPromptFolderTitle.textContent = getMsg('obsidianPromptFolderTitle', strings.obsidianPromptFolderTitle);
  if (obsidianPromptFolderDesc) obsidianPromptFolderDesc.textContent = getMsg('obsidianPromptFolderDesc', strings.obsidianPromptFolderDesc);
  if (obsidianFolderTitle) obsidianFolderTitle.textContent = getMsg('obsidianFolderTitle', strings.obsidianFolderTitle);
  if (obsidianFolderDesc) obsidianFolderDesc.textContent = getMsg('obsidianFolderDesc', strings.obsidianFolderDesc);
  if (obsidianVaultTitle) obsidianVaultTitle.textContent = getMsg('obsidianVaultTitle', strings.obsidianVaultTitle);
  if (obsidianVaultDesc) obsidianVaultDesc.textContent = getMsg('obsidianVaultDesc', strings.obsidianVaultDesc);

  const autoSaveMsg = getMsg('autoSaveText', strings.autoSaveText);
  const savedFeedbackMsg = getMsg('savedFeedback', strings.savedFeedback);
  if (statusText) statusText.textContent = autoSaveMsg;

  const updateFolderRowDisabledState = (isPromptChecked) => {
    if (obsidianFolderRow && obsidianFolder) {
      if (isPromptChecked) {
        obsidianFolderRow.classList.add('is-disabled');
        obsidianFolder.disabled = true;
      } else {
        obsidianFolderRow.classList.remove('is-disabled');
        obsidianFolder.disabled = false;
      }
    }
  };

  // Retrieve version dynamically from extension manifest
  if (versionChip) {
    try {
      const manifest = typeof chrome !== 'undefined' && chrome.runtime?.getManifest ? chrome.runtime.getManifest() : null;
      if (manifest && manifest.version) {
        versionChip.textContent = `v${manifest.version}`;
      }
    } catch (e) {
      // Keep default version from HTML
    }
  }

  // Load preferences from chrome.storage.local
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get([
      'includeThoughts',
      'includeLink',
      'includeAccount',
      'enableNotifications',
      'obsidianPromptFolder',
      'obsidianFolder',
      'obsidianVault'
    ], (result) => {
      if (thoughtsToggle) {
        thoughtsToggle.checked = result.includeThoughts !== undefined ? !!result.includeThoughts : DEFAULT_SETTINGS.includeThoughts;
      }
      if (linkToggle) {
        linkToggle.checked = result.includeLink !== undefined ? !!result.includeLink : DEFAULT_SETTINGS.includeLink;
      }
      if (accountToggle) {
        accountToggle.checked = result.includeAccount !== undefined ? !!result.includeAccount : DEFAULT_SETTINGS.includeAccount;
      }
      if (notificationsToggle) {
        notificationsToggle.checked = result.enableNotifications !== undefined ? !!result.enableNotifications : DEFAULT_SETTINGS.enableNotifications;
      }
      const isPrompt = result.obsidianPromptFolder !== undefined ? !!result.obsidianPromptFolder : DEFAULT_SETTINGS.obsidianPromptFolder;
      if (obsidianPromptFolder) obsidianPromptFolder.checked = isPrompt;
      if (obsidianFolder) obsidianFolder.value = result.obsidianFolder !== undefined ? String(result.obsidianFolder) : DEFAULT_SETTINGS.obsidianFolder;
      if (obsidianVault) obsidianVault.value = result.obsidianVault !== undefined ? String(result.obsidianVault) : DEFAULT_SETTINGS.obsidianVault;
      updateFolderRowDisabledState(isPrompt);
    });
  } else {
    try {
      if (thoughtsToggle) thoughtsToggle.checked = localStorage.getItem('includeThoughts') === 'true';
      if (linkToggle) linkToggle.checked = localStorage.getItem('includeLink') === 'true';
      if (accountToggle) accountToggle.checked = localStorage.getItem('includeAccount') === 'true';
      if (notificationsToggle) notificationsToggle.checked = localStorage.getItem('enableNotifications') !== 'false';
      const isPrompt = localStorage.getItem('obsidianPromptFolder') === 'true';
      if (obsidianPromptFolder) obsidianPromptFolder.checked = isPrompt;
      if (obsidianFolder) obsidianFolder.value = localStorage.getItem('obsidianFolder') || DEFAULT_SETTINGS.obsidianFolder;
      if (obsidianVault) obsidianVault.value = localStorage.getItem('obsidianVault') || DEFAULT_SETTINGS.obsidianVault;
      updateFolderRowDisabledState(isPrompt);
    } catch (e) {
      if (thoughtsToggle) thoughtsToggle.checked = DEFAULT_SETTINGS.includeThoughts;
      if (linkToggle) linkToggle.checked = DEFAULT_SETTINGS.includeLink;
      if (accountToggle) accountToggle.checked = DEFAULT_SETTINGS.includeAccount;
      if (notificationsToggle) notificationsToggle.checked = DEFAULT_SETTINGS.enableNotifications;
      if (obsidianPromptFolder) obsidianPromptFolder.checked = DEFAULT_SETTINGS.obsidianPromptFolder;
      if (obsidianFolder) obsidianFolder.value = DEFAULT_SETTINGS.obsidianFolder;
      if (obsidianVault) obsidianVault.value = DEFAULT_SETTINGS.obsidianVault;
      updateFolderRowDisabledState(DEFAULT_SETTINGS.obsidianPromptFolder);
    }
  }

  // Save feedback timer handle
  let feedbackTimer = null;

  const showSavedFeedback = () => {
    if (!statusIndicator || !statusText) return;
    statusIndicator.classList.add('saved');
    statusText.textContent = savedFeedbackMsg;

    if (feedbackTimer) clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
      statusIndicator.classList.remove('saved');
      statusText.textContent = autoSaveMsg;
    }, 1500);
  };

  // Save preferences on change
  const saveSettings = () => {
    const newSettings = {
      includeThoughts: thoughtsToggle ? thoughtsToggle.checked : DEFAULT_SETTINGS.includeThoughts,
      includeLink: linkToggle ? linkToggle.checked : DEFAULT_SETTINGS.includeLink,
      includeAccount: accountToggle ? accountToggle.checked : DEFAULT_SETTINGS.includeAccount,
      enableNotifications: notificationsToggle ? notificationsToggle.checked : DEFAULT_SETTINGS.enableNotifications,
      obsidianPromptFolder: obsidianPromptFolder ? obsidianPromptFolder.checked : false,
      obsidianFolder: obsidianFolder ? obsidianFolder.value.trim() || 'AI Studio' : 'AI Studio',
      obsidianVault: obsidianVault ? obsidianVault.value.trim() : ''
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(newSettings, () => {
        showSavedFeedback();
      });
    } else {
      try {
        localStorage.setItem('includeThoughts', newSettings.includeThoughts);
        localStorage.setItem('includeLink', newSettings.includeLink);
        localStorage.setItem('includeAccount', newSettings.includeAccount);
        localStorage.setItem('enableNotifications', newSettings.enableNotifications);
        localStorage.setItem('obsidianPromptFolder', newSettings.obsidianPromptFolder);
        localStorage.setItem('obsidianFolder', newSettings.obsidianFolder);
        localStorage.setItem('obsidianVault', newSettings.obsidianVault);
      } catch (e) {}
      showSavedFeedback();
    }
  };

  if (thoughtsToggle) thoughtsToggle.addEventListener('change', saveSettings);
  if (linkToggle) linkToggle.addEventListener('change', saveSettings);
  if (accountToggle) accountToggle.addEventListener('change', saveSettings);
  if (notificationsToggle) notificationsToggle.addEventListener('change', saveSettings);

  if (obsidianPromptFolder) {
    obsidianPromptFolder.addEventListener('change', () => {
      updateFolderRowDisabledState(obsidianPromptFolder.checked);
      saveSettings();
    });
  }
  if (obsidianFolder) {
    obsidianFolder.addEventListener('change', saveSettings);
    obsidianFolder.addEventListener('blur', saveSettings);
  }
  if (obsidianVault) {
    obsidianVault.addEventListener('change', saveSettings);
    obsidianVault.addEventListener('blur', saveSettings);
  }
});
