(function (global) {
  'use strict';
  global.__AIStudioEnhancer__ = global.__AIStudioEnhancer__ || {};

  const State = global.__AIStudioEnhancer__.State;

  let isGenerating = false;
  let enableNotifications = true;
  let lastActivityTime = Date.now();
  let lastUpdateTime = 0;
  const ACTIVITY_TIMEOUT = 5000; // 5 seconds

  function updateActivity() {
    const now = Date.now();
    // Performance optimization: Throttle. Limit high-frequency events (like mousemove)
    // to update the timestamp at most once every 1 second (1000ms).
    // This minimizes CPU overhead and prevents performance issues completely.
    if (now - lastUpdateTime > 1000) {
      lastActivityTime = now;
      lastUpdateTime = now;
    }
  }

  function initObserver() {
    chrome.storage.local.get(['enableNotifications'], (result) => {
      enableNotifications = result.enableNotifications !== false;
    });

    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.enableNotifications) {
        enableNotifications = changes.enableNotifications.newValue;
      }
    });

    // Listen for user interactions to determine if they are actively using the page
    // even if the window doesn't have system focus (e.g., scrolling a background window).
    const options = { passive: true, capture: true };
    window.addEventListener('wheel', updateActivity, options);
    window.addEventListener('mousemove', updateActivity, options);
    window.addEventListener('keydown', updateActivity, options);
    window.addEventListener('touchstart', updateActivity, options);
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
      
      const isRecentlyActive = (Date.now() - lastActivityTime) < ACTIVITY_TIMEOUT;
      
      // We consider the user is NOT looking at the window if:
      // 1. The tab is hidden (e.g. switched tabs or minimized) OR
      // 2. The window doesn't have focus AND they haven't interacted with it recently (e.g. background scrolling)
      const shouldNotify = document.hidden || (!document.hasFocus() && !isRecentlyActive);

      if (shouldNotify) {
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
