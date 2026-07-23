(function (global) {
  'use strict';

  // Wait for namespace to be ready (it should be, since files are loaded in order)
  const Enhancer = global.__AIStudioEnhancer__;
  if (!Enhancer || !Enhancer.Utils || !Enhancer.State || !Enhancer.Markdown || !Enhancer.Catalog || !Enhancer.Notification) {
    console.error('AI Studio Enhancer: Modules failed to load properly.');
    return;
  }

  const Utils = Enhancer.Utils;
  const State = Enhancer.State;
  const Markdown = Enhancer.Markdown;
  const Catalog = Enhancer.Catalog;
  const Notification = Enhancer.Notification;

  /**
   * PART 1: Inject Interceptor Script
   */
  const s = document.createElement('script');
  s.src = chrome.runtime.getURL('interceptor.js');
  s.onload = function () { this.remove(); };
  (document.head || document.documentElement).appendChild(s);

  /**
   * PART 2: Message Listener from Interceptor
   */
  window.addEventListener('message', function (event) {
    if (event.source === window && event.data && event.data.type === 'FROM_INTERCEPTOR') {
      const data = event.data.payload;
      const apiKeyword = event.data.apiKeyword;

      try {
        let turns = null;
        let promptData = null;

        if (apiKeyword === 'ResolveDriveResource') {
          turns = data?.[0]?.[13]?.[0];
          promptData = data?.[0]?.[4];
        } else if (apiKeyword === 'UpdatePrompt' || apiKeyword === 'CreatePrompt') {
          turns = data?.[13]?.[0];
          promptData = data?.[4];
        }

        // Update conversation history
        if (turns && Array.isArray(turns)) {
          State.setHistory(turns);
          Catalog.updateCatalogData(turns);
        }

        // Update prompt title
        if (promptData && promptData[0]) {
          State.setTitle(promptData[0]);
        }
      } catch (e) {
        console.error('AI Studio Enhancer: Error processing intercepted data:', e);
      }
    }
  });

  /**
   * PART 3: UI Injection Logic
   */
  function checkAndInjectButton() {
    const targetUrlPattern = /^https:\/\/aistudio\.google\.com\/prompts\/.+$/;
    const currentUrl = window.location.href;

    if (!targetUrlPattern.test(currentUrl)) {
      document.getElementById(Utils.SELECTORS.id.exportButton)?.remove();
      document.getElementById(Utils.SELECTORS.id.catalogButton)?.remove();
      document.getElementById(Utils.SELECTORS.id.scrollToBottomButton)?.remove();
      document.getElementById(Utils.SELECTORS.id.catalogPanel)?.remove();
      return;
    }

    const toolbarRight = document.querySelector('.toolbar-right');
    if (!toolbarRight) return;

    const temporaryChatToggle = document.querySelector(Utils.SELECTORS.query.temporaryChatToggle);
    const isToggleActive = temporaryChatToggle && temporaryChatToggle.querySelector('button.ms-button-active');
    const isIndicatorPresent = document.querySelector(Utils.SELECTORS.query.temporaryChatIndicator);

    if (isToggleActive || isIndicatorPresent) {
      document.getElementById(Utils.SELECTORS.id.exportButton)?.remove();
      document.getElementById(Utils.SELECTORS.id.catalogButton)?.remove();
      document.getElementById(Utils.SELECTORS.id.scrollToBottomButton)?.remove();
      document.getElementById(Utils.SELECTORS.id.catalogPanel)?.remove();
      return;
    }

    // --- Inject Export Markdown Button ---
      if (!document.getElementById(Utils.SELECTORS.id.exportButton)) {
        const exportButton = Utils.createToolbarButton(
          Utils.SELECTORS.id.exportButton, 
          'markdown_copy', 
          chrome.i18n.getMessage('tooltipCopyMarkdown'), 
          Markdown.exportToMarkdown, 
          'icon-borderless'
        );
        const moreButton = toolbarRight.querySelector(Utils.SELECTORS.query.moreActionsButton);
        if (moreButton) moreButton.parentElement.insertBefore(exportButton, moreButton);
        else toolbarRight.appendChild(exportButton);
      }

      // --- Inject Catalog Button ---
      if (!document.getElementById(Utils.SELECTORS.id.catalogButton)) {
        const catalogButton = Utils.createToolbarButton(
          Utils.SELECTORS.id.catalogButton, 
          'list', 
          chrome.i18n.getMessage('tooltipCatalog'), 
          () => { /* Handled by delegation */ }, 
          'icon-primary'
        );
        const moreButton = toolbarRight.querySelector(Utils.SELECTORS.query.moreActionsButton);
        if (moreButton) {
            moreButton.after(catalogButton);
        } else {
            const runSettingsButton = toolbarRight.querySelector(Utils.SELECTORS.query.runSettingsButton);
            if (runSettingsButton) {
                runSettingsButton.parentElement.insertBefore(catalogButton, runSettingsButton);
            }
        }
      }

      // --- Event Delegation Listener for Toolbar ---
      if (!toolbarRight.dataset.delegatedListener) {
        toolbarRight.dataset.delegatedListener = 'true';
        toolbarRight.addEventListener('click', (e) => {
          const target = e.target;
          
          if (target.closest(Utils.SELECTORS.query.runSettingsButton)) {
            if (Catalog.getCatalogVisible() && e.isTrusted) {
              e.preventDefault();
              e.stopPropagation();
              Catalog.toggleCatalog(false);
              setTimeout(() => {
                const runSettingsBtn = document.querySelector(Utils.SELECTORS.query.runSettingsButton);
                if (runSettingsBtn) runSettingsBtn.click();
              }, 150);
            }
          }
          else if (target.closest('#' + Utils.SELECTORS.id.catalogButton)) {
            const sidePanel = document.querySelector(Utils.SELECTORS.query.nativeSidePanel);
            const isNativePanelOpen = sidePanel && sidePanel.getBoundingClientRect().width > 0;
            
            if (isNativePanelOpen) {
              const runSettingsBtn = document.querySelector(Utils.SELECTORS.query.runSettingsButton);
              if (runSettingsBtn) runSettingsBtn.click();
              setTimeout(() => Catalog.toggleCatalog(), 150);
            } else {
              Catalog.toggleCatalog();
            }
          }
        }, true);
      }

      // --- Inject Catalog Panel ---
      if (!document.getElementById(Utils.SELECTORS.id.catalogPanel)) {
        const chunkEditor = document.querySelector(Utils.SELECTORS.query.chunkEditor);
        if (chunkEditor) {
          const panel = Catalog.createCatalogPanel();
          chunkEditor.appendChild(panel);
        }
      }

      // --- Inject Floating Scroll Button ---
      if (!document.getElementById(Utils.SELECTORS.id.scrollToBottomButton)) {
        const chunkEditor = document.querySelector(Utils.SELECTORS.query.chunkEditor);
        if (chunkEditor) {
          const scrollBtn = document.createElement('button');
          scrollBtn.id = Utils.SELECTORS.id.scrollToBottomButton;
          scrollBtn.className = 'button-hidden mat-mdc-tooltip-trigger'; 
          const icon = document.createElement('span');
          icon.className = 'material-symbols-outlined notranslate';
          icon.textContent = 'keyboard_arrow_down';
          scrollBtn.appendChild(icon);
          
          scrollBtn.addEventListener('click', () => {
            Utils.hideTooltip();
            Catalog.scrollToBottom();
            scrollBtn.classList.add('button-hidden');
            if (Catalog.getScrollStopTimer()) {
              clearTimeout(Catalog.getScrollStopTimer());
            }
            Catalog.setIsHoveringScrollButton(false);
          });
          
          scrollBtn.addEventListener('mouseenter', () => {
            Catalog.setIsHoveringScrollButton(true);
            Utils.showTooltip(scrollBtn, chrome.i18n.getMessage('tooltipScrollToBottom'));
            if (Catalog.getScrollStopTimer()) {
              clearTimeout(Catalog.getScrollStopTimer());
              Catalog.setScrollStopTimer(null);
            }
          });
          
          scrollBtn.addEventListener('mouseleave', () => {
            Catalog.setIsHoveringScrollButton(false);
            Utils.hideTooltip();
            
            const target = Catalog.getChatMainContainer();
            if (target) {
              const currentScrollTop = target.scrollTop;
              const currentScrollHeight = target.scrollHeight;
              const distanceToBottom = currentScrollHeight - currentScrollTop - target.clientHeight;
              if (distanceToBottom >= 150) {
                if (Catalog.getScrollStopTimer()) clearTimeout(Catalog.getScrollStopTimer());
                Catalog.setScrollStopTimer(setTimeout(() => {
                  scrollBtn.classList.add('button-hidden');
                }, 2500));
              }
            }
          });
          
          scrollBtn.addEventListener('blur', () => {
            Utils.hideTooltip();
          });
          
          document.body.appendChild(scrollBtn);
          
          const targetContainer = Catalog.getChatMainContainer();
          if (targetContainer) {
            const resizeObserver = new ResizeObserver(() => {
              Catalog.updateScrollButtonPosition();
              Catalog.updateScrollBtnOverlayVisibility();
            });
            resizeObserver.observe(targetContainer);
          }
          Catalog.updateScrollButtonPosition();
        }
      }
  }

  /**
   * PART 4: Initialization & Global Observers
   */
  function initialize() {
    checkAndInjectButton();
    Catalog.setupConversationObserver();
    Catalog.setupWindowListeners();
    Notification.initObserver();

    const lastScrollTops = new WeakMap();
    const lastScrollHeights = new WeakMap();
    let ignoreScrollUntil = 0;
    
    let isScrolling = false;
    // Global scroll listener for the floating button
    window.addEventListener('scroll', (e) => {
      if (isScrolling) return;
      isScrolling = true;
      setTimeout(() => {
        isScrolling = false;
      }, 50); // Throttle to roughly 20fps

      const btn = document.getElementById(Utils.SELECTORS.id.scrollToBottomButton);
      if (!btn) return;
      
      let container = e.target;
      const isDoc = container === document || container === window || container === document.documentElement || container === document.body;
      
      if (!isDoc) {
        const containsChatTurns = typeof container.querySelector === 'function' && container.querySelector(Utils.SELECTORS.query.chatTurn) !== null;
        if (!containsChatTurns) return;
      }
      
      if (container === document || container.nodeType === Node.DOCUMENT_NODE) {
        container = document.documentElement;
      }
      
      if (container.scrollHeight > container.clientHeight + 20) {
        const currentScrollTop = container.scrollTop;
        const currentScrollHeight = container.scrollHeight;
        const distanceToBottom = currentScrollHeight - currentScrollTop - container.clientHeight;
        
        let lastScrollTop = lastScrollTops.get(container) || 0;
        const lastScrollHeight = lastScrollHeights.get(container) || currentScrollHeight;
        
        if (currentScrollHeight !== lastScrollHeight) {
          lastScrollTop += (currentScrollHeight - lastScrollHeight);
        }
        
        lastScrollTops.set(container, currentScrollTop);
        lastScrollHeights.set(container, currentScrollHeight);
        
        if (Date.now() < ignoreScrollUntil) return;
        
        if (distanceToBottom < 150) {
          if (Catalog.getScrollStopTimer()) clearTimeout(Catalog.getScrollStopTimer());
          btn.classList.add('button-hidden');
        } else {
          Catalog.updateScrollBtnOverlayVisibility();
          if (btn.style.display !== 'none') {
            btn.classList.remove('button-hidden');
            if (Catalog.getScrollStopTimer()) clearTimeout(Catalog.getScrollStopTimer());
            if (!Catalog.getIsHoveringScrollButton()) {
              Catalog.setScrollStopTimer(setTimeout(() => {
                btn.classList.add('button-hidden');
              }, 2500));
            }
          }
        }
      }
    }, true);

    let lastUrl = window.location.href;
    let debounceTimer;

    const observer = new MutationObserver((mutations) => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        checkAndInjectButton();
        return;
      }

      let hasAddedNodes = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes && mutation.addedNodes.length > 0) {
          hasAddedNodes = true;
          break;
        }
      }
      if (hasAddedNodes) {
        ignoreScrollUntil = Date.now() + 300;
      }

      Catalog.updateScrollBtnOverlayVisibility();

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        checkAndInjectButton();
        Notification.checkGenerationState(); 
      }, 150);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    document.addEventListener('mousedown', (e) => {
      const settingsBtn = e.target.closest(Utils.SELECTORS.query.runSettingsButton);
      if (settingsBtn) {
        const btn = document.getElementById(Utils.SELECTORS.id.scrollToBottomButton);
        if (btn) btn.style.display = 'none';
      }
    }, true);
  }

  // Boot up
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})(window);