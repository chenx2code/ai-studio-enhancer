(function (global) {
  'use strict';
  global.__AIStudioEnhancer__ = global.__AIStudioEnhancer__ || {};

  const State = global.__AIStudioEnhancer__.State;
  const Utils = global.__AIStudioEnhancer__.Utils;

  let catalogVisible = false;
  let scrollStopTimer = null;
  let isHoveringScrollButton = false;

  function extractUserPrompts(conversationTurns) {
    if (!Array.isArray(conversationTurns)) {
      return [];
    }
    const userPrompts = [];
    conversationTurns.forEach((turn, index) => {
      if (!Array.isArray(turn) || turn.length < 9) return;
      const role = turn[8];
      if (role === 'user') {
        const textContent = turn[0] || '';
        const imageContent = turn[1];
        const youtubeContent = turn[13];
        const docContent = turn[23];

        let promptText = '';
        let contentType = 'text';

        if (textContent && textContent.trim()) {
          promptText = textContent.trim();
          contentType = 'text';
        } else if (imageContent && Array.isArray(imageContent) && imageContent.length > 0) {
          promptText = '[Image]';
          contentType = 'image';
        } else if (youtubeContent && Array.isArray(youtubeContent) && youtubeContent.length > 0) {
          promptText = '[YouTube Video]';
          contentType = 'video';
        } else if (docContent && Array.isArray(docContent) && docContent.length > 0) {
          const friendlyType = Utils.getFriendlyFileType(docContent[0]);
          promptText = friendlyType === 'Document' ? '[Document]' : `[${friendlyType} File]`;
          contentType = friendlyType.toLowerCase();
        } else {
          promptText = '[File]';
          contentType = 'file';
        }

        let turnElementId = null;
        const chatTurns = document.querySelectorAll(Utils.SELECTORS.query.chatTurn);
        let userTurnCount = 0;
        for (const chatTurn of chatTurns) {
          const container = chatTurn.querySelector(Utils.SELECTORS.query.chatTurnContainer);
          if (container && container.classList.contains(Utils.SELECTORS.class.userTurn)) {
            if (userTurnCount === userPrompts.length) {
              turnElementId = chatTurn.id;
              break;
            }
            userTurnCount++;
          }
        }

        userPrompts.push({
          turnIndex: index,
          turnElementId: turnElementId,
          promptText: promptText,
          truncatedText: Utils.truncateText(promptText, 50),
          contentType: contentType,
          role: role
        });
      }
    });
    return userPrompts;
  }

  function updateCatalogData(conversationTurns) {
    try {
      State.setCatalogData(extractUserPrompts(conversationTurns));
      if (catalogVisible) {
        renderPromptList();
      }
    } catch (error) {
      console.error('Error updating catalog data:', error);
      State.setCatalogData([]);
      if (catalogVisible) {
        renderPromptList();
      }
    }
  }

  function validateCatalogData() {
    let catalogData = State.getCatalogData();
    if (!catalogData || catalogData.length === 0) return;

    const validItems = catalogData.filter(item => {
      if (item.turnElementId) {
        const element = document.getElementById(item.turnElementId);
        return element !== null;
      }
      return true;
    });

    if (validItems.length !== catalogData.length) {
      State.setCatalogData(validItems);
      if (catalogVisible) {
        renderPromptList();
      }
    }
  }

  function setupConversationObserver() {
    const conversationContainer = document.querySelector(Utils.SELECTORS.query.conversationObserverTarget);
    if (!conversationContainer) return;

    let validationTimer = null;
    const observer = new MutationObserver((mutations) => {
      let shouldValidate = false;
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.removedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.tagName.toLowerCase() === Utils.SELECTORS.tag.chatTurn ||
                node.querySelector && node.querySelector(Utils.SELECTORS.query.chatTurn)) {
                shouldValidate = true;
              }
            }
          });
        }
      });
      if (shouldValidate) {
        clearTimeout(validationTimer);
        validationTimer = setTimeout(validateCatalogData, 100);
      }
    });

    observer.observe(conversationContainer, {
      childList: true,
      subtree: true
    });
  }

  function setupWindowListeners() {
    let isWindowResizing = false;
    let windowResizeTimer = null;

    // Listen to actual window resizes to set a flag
    window.addEventListener('resize', () => {
      isWindowResizing = true;
      clearTimeout(windowResizeTimer);
      windowResizeTimer = setTimeout(() => {
        isWindowResizing = false;
      }, 500); // Wait 500ms after resize ends
    });

    let nativePanel = document.querySelector(Utils.SELECTORS.query.nativeSidePanel);
    let previousWidth = 0;
    
    const initObserver = (panel) => {
      previousWidth = panel.getBoundingClientRect().width;
      
      const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          const currentWidth = entry.contentRect.width;
          
          // Only trigger anti-overlap if expanding AND caused by window resize
          if (currentWidth > previousWidth && currentWidth > 0 && catalogVisible && isWindowResizing) {
            const catalogPanel = document.getElementById(Utils.SELECTORS.id.catalogPanel);
            if (catalogPanel) {
              // 1. Insta-kill the animation
              catalogPanel.style.setProperty('transition', 'none', 'important');
              // 2. Hide the panel
              toggleCatalog(false);
              // 3. Restore animation capability for the next time
              setTimeout(() => {
                catalogPanel.style.removeProperty('transition');
              }, 50);
            }
          }
          previousWidth = currentWidth;
        }
      });
      resizeObserver.observe(panel);
    };

    if (nativePanel) {
      initObserver(nativePanel);
    } else {
      const interval = setInterval(() => {
        nativePanel = document.querySelector(Utils.SELECTORS.query.nativeSidePanel);
        if (nativePanel) {
          clearInterval(interval);
          initObserver(nativePanel);
        }
      }, 500);
    }
  }

  function highlightElement(element) {
    const originalBackground = element.style.backgroundColor;
    const originalTransition = element.style.transition;
    element.style.transition = 'background-color 0.3s ease';
    element.style.backgroundColor = 'rgba(66, 133, 244, 0.1)';
    setTimeout(() => {
      element.style.backgroundColor = originalBackground;
      setTimeout(() => {
        element.style.transition = originalTransition;
      }, Utils.CONSTANTS.HIGHLIGHT_FADE_OUT_MS);
    }, Utils.CONSTANTS.HIGHLIGHT_DURATION_MS);
  }

  function navigateToPrompt(turnIndex) {
    try {
      const catalogData = State.getCatalogData();
      const catalogItem = catalogData.find(item => item.turnIndex === turnIndex);
      if (!catalogItem) return;

      if (catalogItem.turnElementId) {
        const targetElement = document.getElementById(catalogItem.turnElementId);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
          highlightElement(targetElement);
          return;
        }
      }

      const chatTurns = document.querySelectorAll(Utils.SELECTORS.query.chatTurn);
      if (chatTurns.length === 0) return;

      const userTurns = [];
      chatTurns.forEach((turn, index) => {
        const container = turn.querySelector(Utils.SELECTORS.query.chatTurnContainer);
        if (container && container.classList.contains(Utils.SELECTORS.class.userTurn)) {
          userTurns.push({ element: turn, domIndex: index });
        }
      });

      const catalogItemIndex = catalogData.findIndex(item => item.turnIndex === turnIndex);
      if (catalogItemIndex >= 0 && catalogItemIndex < userTurns.length) {
        const targetTurn = userTurns[catalogItemIndex];
        targetTurn.element.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
        highlightElement(targetTurn.element);
      }
    } catch (error) {
      console.error('Error during navigation:', error);
    }
  }

  function scrollToBottom() {
    try {
      const chatTurns = document.querySelectorAll(Utils.SELECTORS.query.chatTurn);
      if (chatTurns.length > 0) {
        const lastTurn = chatTurns[chatTurns.length - 1];
        lastTurn.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
      }
    } catch (error) {
      console.error('Error scrolling to bottom:', error);
    }
  }

  function getChatMainContainer() {
    const firstTurn = document.querySelector(Utils.SELECTORS.query.chatTurn);
    if (firstTurn && firstTurn.parentElement) return firstTurn.parentElement;
    const chunkEditor = document.querySelector(Utils.SELECTORS.query.chunkEditor);
    if (chunkEditor) {
      const mainContent = Array.from(chunkEditor.children).find(
        child => child.id !== Utils.SELECTORS.id.catalogPanel && child.tagName !== 'STYLE' && !child.classList.contains('custom-tooltip-text')
      );
      if (mainContent) return mainContent;
      return chunkEditor;
    }
    return null;
  }

  function isOverlayActive() {
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) {
      const style = window.getComputedStyle(overlay);
      return style.display !== 'none' && style.visibility !== 'hidden';
    }
    return false;
  }

  function updateScrollBtnOverlayVisibility() {
    const btn = document.getElementById(Utils.SELECTORS.id.scrollToBottomButton);
    if (!btn) return;
    if (isOverlayActive()) {
      btn.style.display = 'none';
    } else {
      btn.style.display = '';
    }
  }

  function updateScrollButtonPosition() {
    const btn = document.getElementById(Utils.SELECTORS.id.scrollToBottomButton);
    if (!btn) return;
    const target = getChatMainContainer();
    if (target) {
      const rect = target.getBoundingClientRect();
      btn.style.left = (rect.left + rect.width / 2) + 'px';
    }
  }

  function createCatalogPanel() {
    const panel = document.createElement('ms-right-side-panel');
    panel.id = Utils.SELECTORS.id.catalogPanel;

    const contentContainer = document.createElement('div');
    contentContainer.className = 'content-container';

    const header = document.createElement('div');
    header.className = Utils.SELECTORS.class.nativePanelHeader;

    const title = document.createElement('h2');
    title.className = Utils.SELECTORS.class.nativePanelTitle;
    title.textContent = chrome.i18n.getMessage('catalogHeader');

    const closeButton = document.createElement('button');
    closeButton.setAttribute('ms-button', '');
    closeButton.setAttribute('variant', 'icon-borderless');
    closeButton.setAttribute('size', 'small');
    closeButton.setAttribute('iconname', 'close');
    closeButton.setAttribute('aria-label', 'Close catalog panel');
    closeButton.addEventListener('click', () => toggleCatalog(false));

    const closeIcon = document.createElement('span');
    closeIcon.className = Utils.SELECTORS.class.nativeMaterialIcon;
    closeIcon.textContent = 'close';
    closeIcon.setAttribute('aria-hidden', 'true');
    closeButton.appendChild(closeIcon);

    header.appendChild(title);
    header.appendChild(closeButton);

    const settingsWrapper = document.createElement('div');
    settingsWrapper.className = Utils.SELECTORS.class.nativeSettingsWrapper;
    settingsWrapper.setAttribute('msscrollableindicatorcontainer', '');

    const scrollableArea = document.createElement('div');
    scrollableArea.className = Utils.SELECTORS.class.nativeScrollableArea;
    scrollableArea.id = Utils.SELECTORS.id.catalogListContainer;
    scrollableArea.setAttribute('msscrollable', '');

    settingsWrapper.appendChild(scrollableArea);
    contentContainer.appendChild(header);
    contentContainer.appendChild(settingsWrapper);
    panel.appendChild(contentContainer);

    return panel;
  }

  function createPromptListItem(catalogItem) {
    const listItem = document.createElement('div');
    listItem.className = 'catalog-list-item';
    listItem.setAttribute('data-turn-index', catalogItem.turnIndex);
    listItem.setAttribute('role', 'button');
    listItem.setAttribute('tabindex', '0');

    const promptText = document.createElement('span');
    promptText.className = 'catalog-prompt-text';

    if (catalogItem.contentType === 'text') {
      promptText.textContent = catalogItem.truncatedText;
    } else {
      promptText.textContent = catalogItem.promptText;
      promptText.classList.add('catalog-image-prompt');
    }

    listItem.appendChild(promptText);

    listItem.addEventListener('click', function () {
      const allItems = document.querySelectorAll('.catalog-list-item');
      allItems.forEach(item => item.classList.remove('catalog-item-selected'));
      listItem.classList.add('catalog-item-selected');
      navigateToPrompt(catalogItem.turnIndex);
    });

    listItem.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        listItem.click();
      }
    });

    return listItem;
  }

  function renderPromptList() {
    const listContainer = document.getElementById(Utils.SELECTORS.id.catalogListContainer);
    const catalogData = State.getCatalogData();
    if (!listContainer) return;
    
    listContainer.innerHTML = '';

    if (!catalogData || catalogData.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'catalog-empty-state';
      emptyState.textContent = chrome.i18n.getMessage('catalogEmptyState');
      listContainer.appendChild(emptyState);
      return;
    }

    catalogData.forEach((catalogItem) => {
      const listItem = createPromptListItem(catalogItem);
      listContainer.appendChild(listItem);
    });
  }

  function toggleCatalog(forceShow) {
    const catalogPanel = document.getElementById(Utils.SELECTORS.id.catalogPanel);
    const catalogButton = document.getElementById(Utils.SELECTORS.id.catalogButton);
    if (!catalogPanel || !catalogButton) return;

    const isVisible = catalogPanel.classList.contains(Utils.SELECTORS.classExt.panelVisible);
    const shouldShow = forceShow !== undefined ? forceShow : !isVisible;

    if (shouldShow === isVisible) return;

    if (shouldShow) {
      renderPromptList();
    }

    catalogPanel.classList.toggle(Utils.SELECTORS.classExt.panelVisible, shouldShow);
    catalogButton.classList.toggle(Utils.SELECTORS.classExt.buttonHidden, shouldShow);
    catalogVisible = shouldShow;
  }
  
  function getCatalogVisible() {
    return catalogVisible;
  }
  
  function getIsHoveringScrollButton() {
    return isHoveringScrollButton;
  }
  
  function setIsHoveringScrollButton(val) {
    isHoveringScrollButton = val;
  }
  
  function getScrollStopTimer() {
    return scrollStopTimer;
  }
  
  function setScrollStopTimer(timer) {
    scrollStopTimer = timer;
  }

  global.__AIStudioEnhancer__.Catalog = {
    updateCatalogData,
    setupConversationObserver,
    setupWindowListeners,
    createCatalogPanel,
    toggleCatalog,
    scrollToBottom,
    getChatMainContainer,
    updateScrollButtonPosition,
    updateScrollBtnOverlayVisibility,
    getCatalogVisible,
    getIsHoveringScrollButton,
    setIsHoveringScrollButton,
    getScrollStopTimer,
    setScrollStopTimer
  };

})(window);
