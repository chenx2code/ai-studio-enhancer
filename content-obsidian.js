// content-obsidian.js
// Handles full conversation export to Obsidian via official URI scheme and clipboard transit

(function (global) {
  'use strict';
  global.__AIStudioEnhancer__ = global.__AIStudioEnhancer__ || {};

  const State = global.__AIStudioEnhancer__.State;
  const Utils = global.__AIStudioEnhancer__.Utils;

  const I18N_STRINGS = {
    zh: {
      obsidianIdle: '一键导出至 Obsidian',
      obsidianLoading: '正在准备导出至 Obsidian...',
      obsidianSuccess: '已导出至 Obsidian！',
      obsidianModalTitle: '导出至 Obsidian',
      obsidianModalFolderLabel: '目标文件夹',
      obsidianModalFolderPlaceholder: '例如: AI Studio 或 Work/AI',
      obsidianModalTitleLabel: '笔记标题',
      obsidianModalRecentLabel: '快捷历史标签:',
      obsidianModalSetDefault: '设为默认文件夹且不再提醒',
      cancelBtn: '取消',
      confirmExportBtn: '确认导出',
      closeTitle: '关闭'
    },
    en: {
      obsidianIdle: 'Export conversation to Obsidian',
      obsidianLoading: 'Exporting to Obsidian...',
      obsidianSuccess: 'Exported to Obsidian!',
      obsidianModalTitle: 'Export to Obsidian',
      obsidianModalFolderLabel: 'Target Folder',
      obsidianModalFolderPlaceholder: 'e.g. AI Studio or Work/AI',
      obsidianModalTitleLabel: 'Note Title',
      obsidianModalRecentLabel: 'Recent folders:',
      obsidianModalSetDefault: 'Set as default folder and do not ask again',
      cancelBtn: 'Cancel',
      confirmExportBtn: 'Export',
      closeTitle: 'Close'
    }
  };

  const DEFAULT_SETTINGS = {
    obsidianFolder: 'AI Studio',
    obsidianVault: '',
    obsidianSilent: true,
    obsidianPromptFolder: false,
    obsidianFolderHistory: ['AI Studio']
  };

  let isExporting = false;

  // Retrieve current active localization strings
  function getStrings() {
    let isChinese = false;
    try {
      if (typeof document !== 'undefined' && document.documentElement && document.documentElement.lang) {
        isChinese = document.documentElement.lang.toLowerCase().startsWith('zh');
      } else if (typeof navigator !== 'undefined' && navigator.language) {
        isChinese = navigator.language.toLowerCase().startsWith('zh');
      }
      if (!isChinese && typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.i18n?.getUILanguage) {
        isChinese = chrome.i18n.getUILanguage().toLowerCase().startsWith('zh');
      }
    } catch (e) {
      isChinese = (typeof navigator !== 'undefined' && navigator.language && navigator.language.toLowerCase().startsWith('zh')) || false;
    }
    return isChinese ? I18N_STRINGS.zh : I18N_STRINGS.en;
  }

  // Get official Obsidian gemstone logo SVG markup
  function getObsidianIconSvg() {
    return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M9.643 14.012c.615-.183 1.605-.465 2.745-.534-.684-1.725-.849-3.235-.716-4.579.153-1.552.7-2.847 1.234-3.95.114-.235.223-.454.328-.664.149-.297.289-.577.42-.86.217-.47.378-.885.46-1.27.08-.38.08-.719-.014-1.044-.095-.325-.297-.675-.681-1.06a1.6 1.6 0 00-1.475.36l-4.95 4.453a1.602 1.602 0 00-.512.952l-.427 2.83c.67.592 2.327 2.317 3.335 4.71.09.213.174.432.253.656zM5.855 9.937c-.024.1-.057.197-.099.29L3.14 16.058a1.602 1.602 0 00.313 1.772l4.117 4.24c2.102-3.102 1.795-6.02.835-8.3-.728-1.73-1.832-3.083-2.55-3.833z"/>
      <path d="M8.52 22.57c.073.01.146.018.22.02.781.023 2.095.091 3.16.288.87.16 2.593.642 4.011 1.056 1.082.316 2.197-.548 2.354-1.664.115-.814.33-1.735.725-2.58l-.009.004c-.67-1.87-1.523-3.077-2.417-3.847a5.294 5.294 0 00-2.777-1.258c-1.541-.216-2.952.189-3.841.45.532 2.218.368 4.828-1.425 7.53z"/>
      <path d="M19.676 18.538a69.072 69.072 0 001.858-2.952.811.811 0 00-.061-.901c-.516-.684-1.504-2.075-2.042-3.362-.554-1.323-.636-3.378-.64-4.378a1.708 1.708 0 00-.359-1.051L15.235 1.83a3.757 3.757 0 01-.076.545c-.107.503-.307 1.004-.536 1.498-.135.29-.29.601-.446.915-.105.21-.21.42-.31.626-.517 1.068-.998 2.227-1.132 3.59-.125 1.262.046 2.73.814 4.484.128.01.257.025.386.043a6.364 6.364 0 013.327 1.506c.916.79 1.743 1.921 2.414 3.5z"/>
    </svg>`;
  }

  // Load Obsidian export preferences from storage
  function loadExportSettings(callback) {
    const keys = [
      'includeThoughts',
      'includeLink',
      'includeAccount',
      'obsidianFolder',
      'obsidianVault',
      'obsidianSilent',
      'obsidianPromptFolder',
      'obsidianFolderHistory'
    ];

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(keys, (res) => {
        if (!res) return callback(DEFAULT_SETTINGS);
        callback({
          includeThoughts: res.includeThoughts !== undefined ? !!res.includeThoughts : false,
          includeLink: res.includeLink !== undefined ? !!res.includeLink : false,
          includeAccount: res.includeAccount !== undefined ? !!res.includeAccount : false,
          obsidianFolder: res.obsidianFolder !== undefined ? String(res.obsidianFolder) : DEFAULT_SETTINGS.obsidianFolder,
          obsidianVault: res.obsidianVault !== undefined ? String(res.obsidianVault) : DEFAULT_SETTINGS.obsidianVault,
          obsidianSilent: res.obsidianSilent !== undefined ? !!res.obsidianSilent : DEFAULT_SETTINGS.obsidianSilent,
          obsidianPromptFolder: res.obsidianPromptFolder !== undefined ? !!res.obsidianPromptFolder : DEFAULT_SETTINGS.obsidianPromptFolder,
          obsidianFolderHistory: Array.isArray(res.obsidianFolderHistory) ? res.obsidianFolderHistory : DEFAULT_SETTINGS.obsidianFolderHistory
        });
      });
    } else {
      callback(DEFAULT_SETTINGS);
    }
  }

  // Save Obsidian export preferences
  function saveExportSettings(settings, callback) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(settings, () => {
        if (callback) callback();
      });
    } else {
      if (callback) callback();
    }
  }

  // Record folder to recent history (up to 5 folders, deduplicated)
  function addObsidianFolderHistory(folder, callback) {
    if (!folder || typeof folder !== 'string') {
      if (callback) callback();
      return;
    }
    const cleanFolder = folder.trim().replace(/^[\/\\\\]+|[\/\\\\]+$/g, '');
    if (!cleanFolder) {
      if (callback) callback();
      return;
    }

    loadExportSettings((settings) => {
      let history = Array.isArray(settings.obsidianFolderHistory) ? settings.obsidianFolderHistory.slice() : ['AI Studio'];
      history = [cleanFolder, ...history.filter((f) => f.toLowerCase() !== cleanFolder.toLowerCase())].slice(0, 5);
      settings.obsidianFolderHistory = history;
      saveExportSettings(settings, callback);
    });
  }

  // Safely write text to system clipboard with fallback
  async function writeToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (err) {
        console.warn('[AI Studio Enhancer] navigator.clipboard.writeText failed, falling back to textarea execCommand:', err);
      }
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.setAttribute('readonly', '');
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (!successful) {
      throw new Error('Failed to copy Markdown content to clipboard.');
    }
  }

  // Trigger Obsidian URI dispatch via hidden link click
  function triggerObsidianUri(uri) {
    const a = document.createElement('a');
    a.href = uri;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) {
        document.body.removeChild(a);
      }
    }, 150);
  }

  // Update Obsidian export button state in top toolbar and catalog header
  function setObsidianButtonState(state, tooltip) {
    const buttons = [
      document.getElementById(Utils.SELECTORS.id.obsidianButton),
      document.getElementById('catalog-obsidian-btn')
    ].filter(Boolean);

    if (buttons.length === 0) return;

    const strings = getStrings();
    const defaultTooltip =
      state === 'loading'
        ? strings.obsidianLoading
        : state === 'success'
        ? strings.obsidianSuccess
        : strings.obsidianIdle;

    const tip = tooltip || defaultTooltip;

    buttons.forEach((btn) => {
      btn.dataset.state = state;
      btn.title = tip;
      btn.setAttribute('aria-label', tip);

      if (state === 'loading') {
        btn.classList.remove('is-success');
        btn.classList.add('is-loading');
        btn.innerHTML = `
          <span class="enhancer-spinner-composited">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <circle cx="12" cy="12" r="9.5" stroke-opacity="0.25"></circle>
              <path d="M12 2.5 A 9.5 9.5 0 0 1 21.5 12"></path>
            </svg>
          </span>
        `;
      } else if (state === 'success') {
        btn.classList.remove('is-loading');
        btn.classList.add('is-success');
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        `;
      } else {
        btn.classList.remove('is-loading', 'is-success');
        btn.innerHTML = getObsidianIconSvg();
      }
    });
  }

  // Show interactive Obsidian folder and title confirmation modal
  function showObsidianModal(options = {}) {
    const { title = '', defaultFolder = 'AI Studio', historyFolders = [], onConfirm, onCancel } = options;
    const strings = getStrings();

    const existing = document.getElementById('enhancer-obsidian-modal');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    const overlay = document.createElement('div');
    overlay.id = 'enhancer-obsidian-modal';
    overlay.className = 'enhancer-modal-overlay';

    // Build history chips HTML
    const foldersToDisplay = Array.from(new Set([defaultFolder, ...(Array.isArray(historyFolders) ? historyFolders : [])]))
      .filter(Boolean)
      .slice(0, 5);

    let chipsHtml = '';
    if (foldersToDisplay.length > 0) {
      const chipButtons = foldersToDisplay
        .map(
          (f) =>
            `<button type="button" class="enhancer-modal-chip" data-folder="${f}">📁 ${f}</button>`
        )
        .join('');
      chipsHtml = `
        <div class="enhancer-modal-chips-row">
          <span class="enhancer-modal-chips-label">${strings.obsidianModalRecentLabel}</span>
          <div class="enhancer-modal-chips-list">${chipButtons}</div>
        </div>
      `;
    }

    overlay.innerHTML = `
      <div class="enhancer-modal-card" role="dialog" aria-modal="true" aria-labelledby="enhancer-modal-title">
        <div class="enhancer-modal-header">
          <div class="enhancer-modal-brand">
            <span class="enhancer-modal-icon">
              ${getObsidianIconSvg()}
            </span>
            <span id="enhancer-modal-title" class="enhancer-modal-title">${strings.obsidianModalTitle}</span>
          </div>
          <button type="button" class="enhancer-modal-close" aria-label="${strings.closeTitle}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
            </svg>
          </button>
        </div>

        <div class="enhancer-modal-body">
          <!-- 1. Note Title input -->
          <div class="enhancer-modal-field">
            <label for="enhancer-input-title" class="enhancer-modal-label">${strings.obsidianModalTitleLabel}</label>
            <div class="enhancer-modal-input-box">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
              </svg>
              <input type="text" id="enhancer-input-title" class="enhancer-modal-input" value="${title || ''}" spellcheck="false" autocomplete="off">
            </div>
          </div>

          <!-- 2. Target Folder input -->
          <div class="enhancer-modal-field" style="margin-top: 14px;">
            <label for="enhancer-input-folder" class="enhancer-modal-label">${strings.obsidianModalFolderLabel}</label>
            <div class="enhancer-modal-input-box">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
              </svg>
              <input type="text" id="enhancer-input-folder" class="enhancer-modal-input" placeholder="${strings.obsidianModalFolderPlaceholder}" value="${defaultFolder || 'AI Studio'}" spellcheck="false" autocomplete="off">
            </div>
          </div>

          <!-- 3. History chips for folder -->
          ${chipsHtml}

          <!-- 4. Remember folder as default & don't ask again checkbox -->
          <label class="enhancer-modal-checkbox-row">
            <input type="checkbox" id="enhancer-input-setdefault" class="enhancer-modal-checkbox">
            <span class="enhancer-modal-checkbox-label">${strings.obsidianModalSetDefault}</span>
          </label>
        </div>

        <div class="enhancer-modal-footer">
          <button type="button" class="enhancer-modal-btn enhancer-modal-btn-cancel">${strings.cancelBtn}</button>
          <button type="button" class="enhancer-modal-btn enhancer-modal-btn-confirm">${strings.confirmExportBtn}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const folderInput = overlay.querySelector('#enhancer-input-folder');
    const titleInput = overlay.querySelector('#enhancer-input-title');
    const setDefaultCheckbox = overlay.querySelector('#enhancer-input-setdefault');
    const cancelBtn = overlay.querySelector('.enhancer-modal-btn-cancel');
    const confirmBtn = overlay.querySelector('.enhancer-modal-btn-confirm');
    const closeBtn = overlay.querySelector('.enhancer-modal-close');

    // Click history chips to quickly fill folder
    const chips = overlay.querySelectorAll('.enhancer-modal-chip');
    chips.forEach((ch) => {
      ch.addEventListener('click', () => {
        const target = ch.getAttribute('data-folder');
        if (target && folderInput) {
          folderInput.value = target;
          folderInput.focus();
        }
      });
    });

    const closeModal = () => {
      document.removeEventListener('keydown', handleKeyDown);
      overlay.classList.add('is-closing');
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 180);
    };

    const handleConfirm = () => {
      const chosenFolder = folderInput ? folderInput.value.trim() || 'AI Studio' : 'AI Studio';
      const chosenTitle = titleInput ? titleInput.value.trim() || title : title;
      const setAsDefault = setDefaultCheckbox ? setDefaultCheckbox.checked : false;
      closeModal();
      if (onConfirm) {
        onConfirm({ folder: chosenFolder, title: chosenTitle, setAsDefault });
      }
    };

    const handleCancel = () => {
      closeModal();
      if (onCancel) onCancel();
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        handleCancel();
      }
    });

    if (closeBtn) closeBtn.addEventListener('click', handleCancel);
    if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
    if (confirmBtn) confirmBtn.addEventListener('click', handleConfirm);

    document.addEventListener('keydown', handleKeyDown);

    // Auto-focus folder input
    setTimeout(() => {
      if (folderInput) {
        folderInput.focus();
        folderInput.select();
      }
    }, 60);
  }

  // Export conversation directly to Obsidian via official transit protocol
  async function exportToObsidian(options = {}) {
    if (isExporting) return;

    const conversationHistory = State.getHistory();
    const promptTitle = State.getTitle();

    if (!conversationHistory || conversationHistory.length === 0) {
      alert(chrome.i18n.getMessage('errorNoDataSource') || 'No conversation history available to export.');
      return;
    }

    isExporting = true;
    const uiStrings = getStrings();
    const loadingMsg = uiStrings ? uiStrings.obsidianLoading : '正在准备导出至 Obsidian...';
    setObsidianButtonState('loading', loadingMsg);

    try {
      // 1. Load user export preferences
      const settings = await new Promise((resolve) => loadExportSettings(resolve));

      // 2. Assemble Markdown document (reusing Markdown module)
      const markdown = global.__AIStudioEnhancer__.Markdown.assembleMarkdown(conversationHistory, promptTitle, {
        includeThoughts: settings.includeThoughts,
        includeLink: settings.includeLink,
        includeAccount: settings.includeAccount
      });

      // 3. Sanitize title and compute note path inside Obsidian
      const rawTitle = options.title !== undefined && options.title.trim() ? options.title : promptTitle;
      const cleanTitle = (global.__AIStudioEnhancer__.Markdown.sanitizeFilename
        ? global.__AIStudioEnhancer__.Markdown.sanitizeFilename(rawTitle)
        : rawTitle
      ).replace(/\.md$/i, '');

      const rawFolder = options.folder !== undefined ? String(options.folder) : (typeof settings.obsidianFolder === 'string' ? settings.obsidianFolder : 'AI Studio');
      const folder = rawFolder.trim().replace(/^[\/\\\\]+|[\/\\\\]+$/g, '');
      const notePath = folder ? `${folder}/${cleanTitle}` : cleanTitle;

      // 4. Copy Markdown to clipboard (Obsidian clipboard-transit pattern)
      await writeToClipboard(markdown);

      // 5. Build official Obsidian URI scheme parameters
      const params = new URLSearchParams();
      params.append('file', notePath);
      params.append('clipboard', 'true');

      const targetVault = options.vault !== undefined ? options.vault : settings.obsidianVault;
      if (targetVault && targetVault.trim()) {
        params.append('vault', targetVault.trim());
      }
      if (settings.obsidianSilent !== false) {
        params.append('silent', 'true');
      }

      const obsidianUri = `obsidian://new?${params.toString()}`;

      // 6. Trigger native URI dispatch
      triggerObsidianUri(obsidianUri);

      // 7. Update UI state with success feedback
      const successPrefix = uiStrings ? uiStrings.obsidianSuccess.replace(/[！!]$/, '') : '已导出至 Obsidian';
      setObsidianButtonState('success', `${successPrefix} (${notePath})`);
      setTimeout(() => {
        setObsidianButtonState('idle');
      }, 1500);
    } catch (err) {
      console.error('[AI Studio Enhancer] Error during Obsidian export:', err);
      setObsidianButtonState('idle');
    } finally {
      isExporting = false;
    }
  }

  // Trigger conversation export flow (checking promptFolder setting)
  function handleObsidianExport() {
    loadExportSettings((settings) => {
      if (settings && settings.obsidianPromptFolder) {
        const title = State.getTitle() || '';
        const defaultFolder = (settings.obsidianFolderHistory && settings.obsidianFolderHistory[0]) || settings.obsidianFolder || 'AI Studio';
        const historyFolders = settings.obsidianFolderHistory || [];

        showObsidianModal({
          title,
          defaultFolder,
          historyFolders,
          onConfirm: ({ folder, title: chosenTitle, setAsDefault }) => {
            if (setAsDefault) {
              const updatedSettings = {
                ...settings,
                obsidianFolder: folder,
                obsidianPromptFolder: false
              };
              let history = Array.isArray(settings.obsidianFolderHistory) ? settings.obsidianFolderHistory.slice() : ['AI Studio'];
              history = [folder, ...history.filter((f) => f.toLowerCase() !== folder.toLowerCase())].slice(0, 5);
              updatedSettings.obsidianFolderHistory = history;

              saveExportSettings(updatedSettings, () => {
                exportToObsidian({ folder, title: chosenTitle });
              });
            } else {
              addObsidianFolderHistory(folder);
              exportToObsidian({ folder, title: chosenTitle });
            }
          }
        });
      } else {
        exportToObsidian();
      }
    });
  }

  global.__AIStudioEnhancer__.Obsidian = {
    exportToObsidian,
    handleObsidianExport,
    showObsidianModal,
    setObsidianButtonState,
    getObsidianIconSvg,
    loadExportSettings,
    saveExportSettings,
    addObsidianFolderHistory
  };

})(window);
