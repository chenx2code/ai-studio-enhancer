(function (global) {
  'use strict';
  global.__AIStudioEnhancer__ = global.__AIStudioEnhancer__ || {};

  const State = global.__AIStudioEnhancer__.State;

  let isGenerating = false;
  let enableNotifications = true;

  function initObserver() {
    chrome.storage.local.get(['enableNotifications'], (result) => {
      enableNotifications = result.enableNotifications !== false;
    });

    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.enableNotifications) {
        enableNotifications = changes.enableNotifications.newValue;
      }
    });
  }

  function checkGenerationState() {
    if (!enableNotifications) return;

    const buttons = Array.from(document.querySelectorAll('button.ms-button-primary'));
    const stopBtn = buttons.find(btn => 
      btn.textContent.includes('Stop') && 
      (btn.querySelector('.spin') || btn.textContent.includes('progress_activity'))
    );

    if (stopBtn && !isGenerating) {
      isGenerating = true;
    } else if (!stopBtn && isGenerating) {
      isGenerating = false;
      
      if (document.hidden || !document.hasFocus()) {
        try {
          const fallbackTitle = document.title ? document.title.replace(' - Google AI Studio', '') : '';
          const promptTitle = State.getTitle();
          const finalTitle = (typeof promptTitle !== 'undefined' && promptTitle !== chrome.i18n.getMessage('promptTitleDefault')) ? promptTitle : fallbackTitle;
          
          chrome.runtime.sendMessage({ 
            type: 'GENERATION_COMPLETE',
            chatTitle: finalTitle
          });
        } catch(e) {
          console.error('Failed to send notification message:', e);
        }
      }
    }
  }

  global.__AIStudioEnhancer__.Notification = {
    initObserver,
    checkGenerationState
  };

})(window);
