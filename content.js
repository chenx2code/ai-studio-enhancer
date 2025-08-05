(function () {
  'use strict';

  /**
   * Configuration object for storing all fragile CSS selectors and class names.
   * Centralizing these makes the extension more resilient to website updates.
   * If Google AI Studio changes its layout, we only need to update the values here.
   */
  const SELECTORS = {
    // --- Host Page Queries ---
    // Selectors for finding elements on the Google AI Studio page.
    query: {
      toolbar: 'ms-toolbar .toolbar-container',
      sideTogglesContainer: '.toggles-container',
      moreActionsButton: 'button[aria-label="View more actions"]',
      nativeSidePanel: 'ms-right-side-panel',
      nativeSidePanelButtons: 'button[aria-label*="settings"], button[aria-label*="gallery"]',
      chatTurn: 'ms-chat-turn',
      chatTurnContainer: '.chat-turn-container',
      conversationObserverTarget: 'body',
    },

    // --- Host Page Classes ---
    // Class names used by the native UI that we need to interact with or mimic.
    class: {
      userTurn: 'user',
      nativeButtonHighlighted: 'right-side-panel-button-highlight',
      // Classes mimicked from the native UI for consistent styling
      nativePanelBase: 'ng-tns-c1846459499-4 ng-star-inserted',
      nativePanelContent: 'content-container ng-tns-c1846459499-4 ng-trigger ng-trigger-slideInOut ng-star-inserted',
      nativePanelHeader: 'header',
      nativePanelTitle: 'no-select v3-font-headline-2',
      nativeCloseButton: 'mdc-icon-button mat-mdc-icon-button mat-mdc-button-base close-button mat-unthemed',
      nativeMaterialIcon: 'material-symbols-outlined notranslate',
      nativeSettingsWrapper: 'settings-items-wrapper',
      nativeScrollableArea: 'scrollable-area',
    },

    // --- Host Page Tags ---
    // Tag names of key elements on the host page.
    tag: {
      chatTurn: 'ms-chat-turn',
    },
    
    // --- Extension-Specific IDs ---
    // Unique IDs for elements injected by this extension.
    id: {
      exportButton: 'export-markdown-btn',
      catalogButton: 'catalog-toggle-btn',
      catalogPanel: 'catalog-side-panel',
      catalogListContainer: 'catalog-list-container',
    },

    // --- Extension-Specific Classes ---
    // Class names for elements injected by this extension.
    classExt: {
      panelVisible: 'panel-visible',
    }
  };

  /**
   * Constants for magic values used throughout the script.
   */
  const CONSTANTS = {
    INJECTION_INTERVAL_MS: 500,
    HIGHLIGHT_DURATION_MS: 1500,
    HIGHLIGHT_FADE_OUT_MS: 300,
  };

  let conversationHistory = null;
  let promptTitle = chrome.i18n.getMessage('promptTitleDefault');
  let catalogData = [];
  let catalogVisible = false;

  /**
   * PART 1: 脚本注射器
   */
  const s = document.createElement('script');
  s.src = chrome.runtime.getURL('interceptor.js');
  s.onload = function () { this.remove(); };
  (document.head || document.documentElement).appendChild(s);

  /**
   * PART 2: 消息监听器
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

        // 提取对话历史
        if (turns && Array.isArray(turns)) {
          conversationHistory = turns;
          // Update catalog data when conversation history changes
          updateCatalogData(conversationHistory);
        }

        // 提取标题
        if (promptData && promptData[0]) {
          promptTitle = promptData[0];
        }

      } catch (e) {
        console.error('处理接收到的数据时出错:', e);
      }
    }
  });

  /**
   * PART 3: 核心导出功能 
   */
  function exportToMarkdown() {
    if (!conversationHistory) {
      alert(chrome.i18n.getMessage('errorNoDataSource'));
      return;
    }
    let markdownOutput = `# ${promptTitle}\n\n`;
    conversationHistory.forEach(turn => {
      if (!Array.isArray(turn) || turn.length < 9) return;
      const content = turn[0] || '';
      const role = turn[8];
      const finalContent = turn[2] && typeof turn[2] === 'string' ? turn[2] : content;
      if (role === 'user' && content) markdownOutput += `## ${content}\n\n`;
      else if (role === 'model' && finalContent) markdownOutput += `${finalContent}\n\n---\n\n`;
    });
    navigator.clipboard.writeText(markdownOutput.trim()).then(() => {
      alert(chrome.i18n.getMessage('successCopied'));
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  }

  /**
   * PART 3.5: 目录数据管理功能
   */

  /**
   * Truncate text to specified length with ellipsis
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length (default: 50)
   * @returns {string} Truncated text with ellipsis if needed
   */
  function truncateText(text, maxLength = 50) {
    if (!text || typeof text !== 'string') return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  /**
   * Extract and filter user prompts from conversation history
   * @param {Array} conversationTurns - Array of conversation turns
   * @returns {Array} Array of catalog items with user prompts
   */
  function extractUserPrompts(conversationTurns) {
    if (!Array.isArray(conversationTurns)) {
      return [];
    }

    const userPrompts = [];

    conversationTurns.forEach((turn, index) => {
      // Validate turn structure
      if (!Array.isArray(turn) || turn.length < 9) {
        return;
      }

      const role = turn[8];

      // Filter for user prompts only
      if (role === 'user') {
        const textContent = turn[0] || '';
        const imageContent = turn[1];

        let promptText = '';
        let contentType = 'text';

        // Handle different content types
        if (textContent && textContent.trim()) {
            // Text prompt
            promptText = textContent.trim();
            contentType = 'text';
        } else if (imageContent && Array.isArray(imageContent) && imageContent.length > 0) {
            // Image prompt (when turn[0] is empty but turn[1] has content)
            promptText = '[Image]';
            contentType = 'image';
        } else {
            // Fallback for other content types like documents/files.
            // Instead of skipping the turn, we create a placeholder entry.
            // This is crucial for keeping the catalog index synchronized with the
            // actual number of user prompts in the DOM, fixing navigation.
            promptText = '[File]';
            contentType = 'file';
        }

        // Try to find the corresponding DOM element to get its ID
        let turnElementId = null;
        const chatTurns = document.querySelectorAll(SELECTORS.query.chatTurn);

        // Find user turns and match by index
        let userTurnCount = 0;
        for (const chatTurn of chatTurns) {
          const container = chatTurn.querySelector(SELECTORS.query.chatTurnContainer);
          if (container && container.classList.contains(SELECTORS.class.userTurn)) {
            if (userTurnCount === userPrompts.length) {
              // This is the DOM element for current user prompt
              turnElementId = chatTurn.id;
              break;
            }
            userTurnCount++;
          }
        }

        // Create catalog item
        const catalogItem = {
          turnIndex: index,
          turnElementId: turnElementId, // Store the DOM element ID
          promptText: promptText,
          truncatedText: truncateText(promptText, 50),
          contentType: contentType,
          role: role
        };

        userPrompts.push(catalogItem);
      }
    });

    return userPrompts;
  }

  /**
   * Update catalog data with current conversation history
   * @param {Array} conversationTurns - Current conversation history
   */
  function updateCatalogData(conversationTurns) {
    try {
      catalogData = extractUserPrompts(conversationTurns);

      // If catalog is currently visible, re-render the prompt list
      if (catalogVisible) {
        renderPromptList();
      }
    } catch (error) {
      console.error('Error updating catalog data:', error);
      catalogData = [];

      // If catalog is currently visible, re-render to show empty state
      if (catalogVisible) {
        renderPromptList();
      }
    }
  }

  /**
   * Validate and clean up catalog data by checking if DOM elements still exist
   */
  function validateCatalogData() {
    if (!catalogData || catalogData.length === 0) {
      return;
    }

    const validItems = catalogData.filter(item => {
      if (item.turnElementId) {
        const element = document.getElementById(item.turnElementId);
        return element !== null;
      }
      return true; // Keep items without ID for fallback
    });

    if (validItems.length !== catalogData.length) {
      catalogData = validItems;
      
      // Re-render catalog if visible
      if (catalogVisible) {
        renderPromptList();
      }
    }
  }

  /**
   * Set up DOM mutation observer to detect conversation changes
   */
  function setupConversationObserver() {
    // Find the conversation container
    const conversationContainer = document.querySelector(SELECTORS.query.conversationObserverTarget);
    if (!conversationContainer) {
      return;
    }

    // Create mutation observer to watch for DOM changes
    const observer = new MutationObserver((mutations) => {
      let shouldValidate = false;
      
      mutations.forEach((mutation) => {
        // Check if any ms-chat-turn elements were removed
        if (mutation.type === 'childList') {
          mutation.removedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.tagName.toLowerCase() === SELECTORS.tag.chatTurn || 
                  node.querySelector && node.querySelector(SELECTORS.query.chatTurn)) {
                shouldValidate = true;
              }
            }
          });
        }
      });

      if (shouldValidate) {
        // Use setTimeout to ensure DOM changes are complete
        setTimeout(validateCatalogData, 100);
      }
    });

    // Start observing
    observer.observe(conversationContainer, {
      childList: true,
      subtree: true
    });
  }

  /**
   * PART 3.6: 滚动导航功能
   */

  /**
   * Navigate to a specific prompt in the conversation by scrolling to it
   * @param {number} turnIndex - The turn index to navigate to
   */
  function navigateToPrompt(turnIndex) {
    try {
      // Find the catalog item that corresponds to this turnIndex
      const catalogItem = catalogData.find(item => item.turnIndex === turnIndex);
      if (!catalogItem) {
        console.warn('Could not find catalog item for turn index:', turnIndex);
        return;
      }

      // Use direct ID-based navigation if available
      if (catalogItem.turnElementId) {
        const targetElement = document.getElementById(catalogItem.turnElementId);
        if (targetElement) {
          // Scroll to the target element with smooth behavior
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
          });

          // Add visual highlight to indicate the navigated-to element
          highlightElement(targetElement);
          return;
        } else {
          console.warn('Could not find element with ID:', catalogItem.turnElementId);
        }
      }

      // Fallback to index-based navigation if ID method fails
      // Find all ms-chat-turn elements (Google AI Studio's conversation structure)
      const chatTurns = document.querySelectorAll(SELECTORS.query.chatTurn);

      if (chatTurns.length === 0) {
        console.warn('Could not find ms-chat-turn elements for navigation');
        return;
      }

      // Extract user turns only by looking for "user" class
      const userTurns = [];
      chatTurns.forEach((turn, index) => {
        const container = turn.querySelector(SELECTORS.query.chatTurnContainer);
        if (container && container.classList.contains(SELECTORS.class.userTurn)) {
          userTurns.push({
            element: turn,
            domIndex: index
          });
        }
      });

      // Find the catalog item's position in our user-only list
      const catalogItemIndex = catalogData.findIndex(item => item.turnIndex === turnIndex);

      if (catalogItemIndex >= 0 && catalogItemIndex < userTurns.length) {
        const targetTurn = userTurns[catalogItemIndex];

        // Scroll to the target element with smooth behavior
        targetTurn.element.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        });

        // Add visual highlight to indicate the navigated-to element
        highlightElement(targetTurn.element);
      } else {
        console.warn('Could not map catalog item to DOM element. Catalog index:', catalogItemIndex, 'Available user turns:', userTurns.length);
      }

    } catch (error) {
      console.error('Error during navigation:', error);
    }
  }

  /**
   * Highlight an element temporarily to indicate navigation
   * @param {HTMLElement} element - Element to highlight
   */
  function highlightElement(element) {
    // Store original styles
    const originalBackground = element.style.backgroundColor;
    const originalTransition = element.style.transition;

    // Apply highlight
    element.style.transition = 'background-color 0.3s ease';
    element.style.backgroundColor = 'rgba(66, 133, 244, 0.1)'; // Light blue highlight

    // Remove highlight after delay
    setTimeout(() => {
      element.style.backgroundColor = originalBackground;

      // Remove transition after background returns to normal
      setTimeout(() => {
        element.style.transition = originalTransition;
      }, CONSTANTS.HIGHLIGHT_FADE_OUT_MS);
    }, CONSTANTS.HIGHLIGHT_DURATION_MS);
  }

  /**
   * PART 3.7: 目录切换功能
   */

  /**
   * Create catalog panel DOM element, mimicking the native side panel structure.
   * @returns {HTMLElement} The catalog panel element.
   */
  function createCatalogPanel() {
    // Create the main container with the same classes as the native one
    const panel = document.createElement('ms-right-side-panel');
    panel.id = SELECTORS.id.catalogPanel;
    // Add native classes for styling and structure
    panel.className = SELECTORS.class.nativePanelBase;
    // No initial class needed, default CSS state is hidden

    // Create the inner content container that handles the slide-in animation
    const contentContainer = document.createElement('div');
    contentContainer.className = SELECTORS.class.nativePanelContent;

    // Create the panel header
    const header = document.createElement('div');
    header.className = SELECTORS.class.nativePanelHeader; // Match prompt gallery

    const title = document.createElement('h2');
    title.className = SELECTORS.class.nativePanelTitle;
    title.textContent = chrome.i18n.getMessage('catalogHeader');

    // Create the close button
    const closeButton = document.createElement('button');
    closeButton.className = SELECTORS.class.nativeCloseButton; // Match prompt gallery
    closeButton.setAttribute('aria-label', 'Close catalog panel');
    closeButton.addEventListener('click', () => toggleCatalog(false)); // Explicitly close

    const closeIcon = document.createElement('span');
    closeIcon.className = SELECTORS.class.nativeMaterialIcon;
    closeIcon.textContent = 'close';

    // Assemble the header
    closeButton.appendChild(closeIcon);
    header.appendChild(title);
    header.appendChild(closeButton);

    // Create the scrollable content area
    const settingsWrapper = document.createElement('div');
    settingsWrapper.className = SELECTORS.class.nativeSettingsWrapper;
    settingsWrapper.setAttribute('msscrollableindicatorcontainer', '');

    const scrollableArea = document.createElement('div');
    scrollableArea.className = SELECTORS.class.nativeScrollableArea;
    scrollableArea.id = SELECTORS.id.catalogListContainer; // Keep this ID for rendering the list
    scrollableArea.setAttribute('msscrollable', '');

    // Assemble the panel
    settingsWrapper.appendChild(scrollableArea);
    contentContainer.appendChild(header);
    contentContainer.appendChild(settingsWrapper);
    panel.appendChild(contentContainer);

    return panel;
  }

  /**
   * Create prompt list item element
   * @param {Object} catalogItem - Catalog item data
   * @returns {HTMLElement} The list item element
   */
  function createPromptListItem(catalogItem) {
    const listItem = document.createElement('div');
    listItem.className = 'catalog-list-item';
    listItem.setAttribute('data-turn-index', catalogItem.turnIndex);
    listItem.setAttribute('role', 'button');
    listItem.setAttribute('tabindex', '0');

    // Create prompt text element
    const promptText = document.createElement('span');
    promptText.className = 'catalog-prompt-text';

    // Display appropriate content based on content type
    if (catalogItem.contentType === 'text') {
        promptText.textContent = catalogItem.truncatedText;
    } else {
        // For non-text prompts ('image', 'file'), use the full text (e.g., '[Image]')
        // and apply special styling.
        promptText.textContent = catalogItem.promptText;
        promptText.classList.add('catalog-image-prompt');
    }

    listItem.appendChild(promptText);

    // Add click event handler for navigation
    listItem.addEventListener('click', function () {
      // Remove selected class from all other items
      const allItems = document.querySelectorAll('.catalog-list-item');
      allItems.forEach(item => item.classList.remove('catalog-item-selected'));

      // Add selected class to the clicked item
      listItem.classList.add('catalog-item-selected');

      navigateToPrompt(catalogItem.turnIndex);
      // Optional: close panel after navigation
      // toggleCatalog(false); 
    });

    // Add keyboard support
    listItem.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        listItem.click();
      }
    });

    return listItem;
  }

  /**
   * Render prompt list in the catalog panel
   */
  function renderPromptList() {
    const listContainer = document.getElementById(SELECTORS.id.catalogListContainer);
    if (!listContainer) {
      return;
    }
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

  /**
   * Toggle catalog panel visibility and handle native panel exclusivity.
   * @param {boolean} [forceShow] - Force a specific state. Toggles if undefined.
   */
  function toggleCatalog(forceShow) {
    const catalogPanel = document.getElementById(SELECTORS.id.catalogPanel);
    const catalogButton = document.getElementById(SELECTORS.id.catalogButton);
    if (!catalogPanel || !catalogButton) return;

    const isVisible = catalogPanel.classList.contains(SELECTORS.classExt.panelVisible);
    const shouldShow = forceShow !== undefined ? forceShow : !isVisible;

    if (shouldShow === isVisible) return; // No change needed

    if (shouldShow) {
        // --- SHOW CATALOG ---
        const sideToggles = document.querySelector(SELECTORS.query.sideTogglesContainer);
        const nativeButtons = sideToggles?.querySelectorAll(SELECTORS.query.nativeSidePanelButtons);
        nativeButtons?.forEach(btn => {
            if (btn.classList.contains(SELECTORS.class.nativeButtonHighlighted)) {
                btn.click();
            }
        });

        renderPromptList();
        catalogPanel.classList.add(SELECTORS.classExt.panelVisible);
        catalogButton.classList.add(SELECTORS.class.nativeButtonHighlighted);
        catalogVisible = true;

    } else {
        // --- HIDE CATALOG ---
        catalogPanel.classList.remove(SELECTORS.classExt.panelVisible);
        catalogButton.classList.remove(SELECTORS.class.nativeButtonHighlighted);
        catalogVisible = false;
    }
  }

  /**
   * Factory function to create a standardized toolbar button.
   * Encapsulates the repetitive logic of creating a button, its icon, and its tooltip.
   * @param {string} id - The ID for the button element.
   * @param {string} iconName - The name of the Material Symbol icon.
   * @param {string} tooltipText - The text to display in the tooltip.
   * @param {function} onClick - The function to call when the button is clicked.
   * @returns {HTMLButtonElement} The fully constructed button element.
   */
  function createToolbarButton(id, iconName, tooltipText, onClick) {
    const button = document.createElement('button');
    button.id = id;
    button.className = 'custom-toolbar-button'; // Shared class for base styling

    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.textContent = iconName;
    button.appendChild(icon);

    const tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip-text';
    tooltip.textContent = tooltipText;
    button.appendChild(tooltip);

    button.addEventListener('click', onClick);

    return button;
  }

  /**
   * PART 4: UI注入逻辑
   */
  function checkAndInjectButton() {
    const targetUrlPattern = /^https:\/\/aistudio\.google\.com\/prompts\/.+$/;
    const currentUrl = window.location.href;

    if (!targetUrlPattern.test(currentUrl)) {
      const existingButton = document.getElementById(SELECTORS.id.exportButton);
      if (existingButton) existingButton.remove();
      const existingCatalogButton = document.getElementById(SELECTORS.id.catalogButton);
      if (existingCatalogButton) existingCatalogButton.remove();
      const existingCatalogPanel = document.getElementById(SELECTORS.id.catalogPanel);
      if (existingCatalogPanel) existingCatalogPanel.remove();
      return;
    }

    const injectionInterval = setInterval(() => {
      // Find injection points for core and auxiliary features.
      const toolbar = document.querySelector(SELECTORS.query.toolbar);
      const sideToggles = document.querySelector(SELECTORS.query.sideTogglesContainer);

      // Stop the interval once we've had a chance to inject, to avoid re-running.
      // The presence of either container is a good signal to proceed and then stop.
      if (toolbar || sideToggles) {
        clearInterval(injectionInterval);

        // --- Graceful Injection for Core Feature: Export Button ---
        if (toolbar) {
          if (!document.getElementById(SELECTORS.id.exportButton)) {
            const exportButton = createToolbarButton(
              SELECTORS.id.exportButton,
              'markdown_copy',
              chrome.i18n.getMessage('tooltipCopyMarkdown'),
              exportToMarkdown
            );

            const moreButton = toolbar.querySelector(SELECTORS.query.moreActionsButton);
            // The "more actions" button is nested inside another div, so we need to
            // insert the new button relative to its parent, not the main toolbar.
            if (moreButton && moreButton.parentElement) {
              moreButton.parentElement.insertBefore(exportButton, moreButton);
            } else {
              toolbar.appendChild(exportButton); // Fallback
            }
          }
        } else {
          console.warn('Markdown Copier: Could not find toolbar to inject Export button.');
        }

        // --- Graceful Injection for Auxiliary Feature: Catalog ---
        if (sideToggles) {
          // Inject Catalog Button
          if (!document.getElementById(SELECTORS.id.catalogButton)) {
             const catalogButton = createToolbarButton(
              SELECTORS.id.catalogButton,
              'list',
              chrome.i18n.getMessage('tooltipCatalog'),
              (e) => {
                e.stopPropagation();
                toggleCatalog();
              }
            );
            sideToggles.appendChild(catalogButton);
          }

          // Inject Catalog Panel (hidden)
          if (!document.getElementById(SELECTORS.id.catalogPanel)) {
            const panel = createCatalogPanel();
            const nativePanelContainer = document.querySelector(SELECTORS.query.nativeSidePanel);
            if (nativePanelContainer && nativePanelContainer.parentElement) {
               nativePanelContainer.parentElement.insertBefore(panel, nativePanelContainer);
            }
          }

          // Add listeners to all native sidebar buttons to close our panel
          const nativeSidebarButtons = sideToggles.querySelectorAll(SELECTORS.query.nativeSidePanelButtons);
          nativeSidebarButtons.forEach(button => {
              button.addEventListener('click', () => {
                  toggleCatalog(false); // Force-close our panel
              });
          });
        } else {
          console.warn('Markdown Copier: Could not find side toggles to inject Catalog feature.');
        }
      }
    }, CONSTANTS.INJECTION_INTERVAL_MS);
  }

  function initialize() {
    checkAndInjectButton();
    
    // Set up conversation observer to handle deletions
    setupConversationObserver();

    // Monitor URL changes for single-page applications
    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        checkAndInjectButton();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();