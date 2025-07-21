(function () {
  'use strict';

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
      console.log(data);
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
          // Skip empty prompts
          return;
        }

        // Try to find the corresponding DOM element to get its ID
        let turnElementId = null;
        const chatTurns = document.querySelectorAll('ms-chat-turn');

        // Find user turns and match by index
        let userTurnCount = 0;
        for (const chatTurn of chatTurns) {
          const container = chatTurn.querySelector('.chat-turn-container');
          if (container && container.classList.contains('user')) {
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
      console.log('Catalog updated with', catalogData.length, 'user prompts');

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
      console.log(`Catalog validation: ${catalogData.length - validItems.length} items removed due to deleted DOM elements`);
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
    const conversationContainer = document.querySelector('body');
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
              if (node.tagName === 'MS-CHAT-TURN' || 
                  node.querySelector && node.querySelector('ms-chat-turn')) {
                shouldValidate = true;
              }
            }
          });
        }
      });

      if (shouldValidate) {
        console.log('Detected conversation changes, validating catalog data...');
        // Use setTimeout to ensure DOM changes are complete
        setTimeout(validateCatalogData, 100);
      }
    });

    // Start observing
    observer.observe(conversationContainer, {
      childList: true,
      subtree: true
    });

    console.log('Conversation observer set up successfully');
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
      console.log('=== Navigation Debug Info ===');
      console.log('Attempting to navigate to turn index:', turnIndex);

      // Find the catalog item that corresponds to this turnIndex
      const catalogItem = catalogData.find(item => item.turnIndex === turnIndex);
      if (!catalogItem) {
        console.warn('Could not find catalog item for turn index:', turnIndex);
        return;
      }
      console.log('Target catalog item:', catalogItem);

      // Use direct ID-based navigation if available
      if (catalogItem.turnElementId) {
        console.log('Using direct ID navigation for element:', catalogItem.turnElementId);

        const targetElement = document.getElementById(catalogItem.turnElementId);
        if (targetElement) {
          console.log('Found target element by ID:', targetElement);

          // Scroll to the target element with smooth behavior
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
          });

          // Add visual highlight to indicate the navigated-to element
          highlightElement(targetElement);

          console.log('Successfully navigated to user prompt using ID:', catalogItem.turnElementId);
          return;
        } else {
          console.warn('Could not find element with ID:', catalogItem.turnElementId);
        }
      }

      // Fallback to index-based navigation if ID method fails
      console.log('Falling back to index-based navigation');

      // Find all ms-chat-turn elements (Google AI Studio's conversation structure)
      const chatTurns = document.querySelectorAll('ms-chat-turn');
      console.log('Found', chatTurns.length, 'ms-chat-turn elements');

      if (chatTurns.length === 0) {
        console.warn('Could not find ms-chat-turn elements for navigation');
        return;
      }

      // Extract user turns only by looking for "user" class
      const userTurns = [];
      chatTurns.forEach((turn, index) => {
        const container = turn.querySelector('.chat-turn-container');
        if (container && container.classList.contains('user')) {
          userTurns.push({
            element: turn,
            domIndex: index
          });
        }
      });

      console.log('Found', userTurns.length, 'user turns at DOM indices:', userTurns.map(t => t.domIndex));

      // Find the catalog item's position in our user-only list
      const catalogItemIndex = catalogData.findIndex(item => item.turnIndex === turnIndex);
      console.log('Catalog item index:', catalogItemIndex, 'Total catalog items:', catalogData.length);

      if (catalogItemIndex >= 0 && catalogItemIndex < userTurns.length) {
        const targetTurn = userTurns[catalogItemIndex];
        console.log('Navigating to user turn at catalog index:', catalogItemIndex, 'DOM index:', targetTurn.domIndex);

        // Scroll to the target element with smooth behavior
        targetTurn.element.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        });

        // Add visual highlight to indicate the navigated-to element
        highlightElement(targetTurn.element);

        console.log('Successfully navigated to user prompt at turn index:', turnIndex);
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
      }, 300);
    }, 1500);
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
    panel.id = 'catalog-side-panel';
    // Add native classes for styling and structure
    panel.className = 'ng-tns-c1846459499-4 ng-star-inserted'; 
    panel.style.display = 'none'; // Initially hidden

    // Create the inner content container that handles the slide-in animation
    const contentContainer = document.createElement('div');
    contentContainer.className = 'content-container ng-tns-c1846459499-4 ng-trigger ng-trigger-slideInOut ng-star-inserted';

    // Create the panel header
    const header = document.createElement('div');
    header.className = 'header'; // Match prompt gallery

    const title = document.createElement('h2');
    title.className = 'no-select gmat-title-small';
    title.textContent = chrome.i18n.getMessage('catalogHeader');

    // Create the close button
    const closeButton = document.createElement('button');
    closeButton.className = 'mdc-icon-button mat-mdc-icon-button mat-mdc-button-base close-button mat-unthemed'; // Match prompt gallery
    closeButton.setAttribute('aria-label', 'Close catalog panel');
    closeButton.addEventListener('click', () => toggleCatalog(false)); // Explicitly close

    const closeIcon = document.createElement('span');
    closeIcon.className = 'material-symbols-outlined notranslate';
    closeIcon.textContent = 'close';

    // Assemble the header
    closeButton.appendChild(closeIcon);
    header.appendChild(title);
    header.appendChild(closeButton);

    // Create the scrollable content area
    const settingsWrapper = document.createElement('div');
    settingsWrapper.className = 'settings-items-wrapper';
    settingsWrapper.setAttribute('msscrollableindicatorcontainer', '');

    const scrollableArea = document.createElement('div');
    scrollableArea.className = 'scrollable-area';
    scrollableArea.id = 'catalog-list-container'; // Keep this ID for rendering the list
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
    if (catalogItem.contentType === 'image') {
      promptText.textContent = '[Image]';
      promptText.classList.add('catalog-image-prompt');
    } else {
      promptText.textContent = catalogItem.truncatedText;
    }

    listItem.appendChild(promptText);

    // Add click event handler for navigation
    listItem.addEventListener('click', function () {
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
    const listContainer = document.getElementById('catalog-list-container');
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
    const catalogPanel = document.getElementById('catalog-side-panel');
    const catalogButton = document.getElementById('catalog-toggle-btn');
    if (!catalogPanel || !catalogButton) return;

    const shouldShow = forceShow !== undefined ? forceShow : catalogPanel.style.display === 'none';

    if (shouldShow) {
        // --- SHOW CATALOG ---
        const sideToggles = document.querySelector('.toggles-container');
        const nativeButtons = sideToggles?.querySelectorAll('button[aria-label*="settings"], button[aria-label*="gallery"]');
        nativeButtons?.forEach(btn => {
            if (btn.classList.contains('right-side-panel-button-highlight')) {
                btn.click();
            }
        });

        renderPromptList();
        catalogPanel.style.display = 'flex'; // Set display to make it visible
        catalogButton.classList.add('right-side-panel-button-highlight');
        catalogVisible = true;

    } else {
        // --- HIDE CATALOG ---
        catalogPanel.style.display = 'none'; // Set display to none to hide it
        catalogButton.classList.remove('right-side-panel-button-highlight');
        catalogVisible = false;
    }
  }

  /**
   * PART 4: UI注入逻辑
   */
  function checkAndInjectButton() {
    const targetUrlPattern = /^https:\/\/aistudio\.google\.com\/prompts\/.+$/;
    const currentUrl = window.location.href;

    if (!targetUrlPattern.test(currentUrl)) {
      const existingButton = document.getElementById('export-markdown-btn');
      if (existingButton) existingButton.remove();
      const existingCatalogButton = document.getElementById('catalog-toggle-btn');
      if (existingCatalogButton) existingCatalogButton.remove();
      const existingCatalogPanel = document.getElementById('catalog-side-panel');
      if (existingCatalogPanel) existingCatalogPanel.remove();
      return;
    }

    const injectionInterval = setInterval(() => {
      const toolbar = document.querySelector('ms-toolbar .toolbar-container');
      const sideToggles = document.querySelector('.toggles-container');

      if (toolbar && sideToggles) {
        clearInterval(injectionInterval);

        // --- Inject Export Button (top bar) ---
        if (!document.getElementById('export-markdown-btn')) {
          const exportButton = document.createElement('button');
          exportButton.id = 'export-markdown-btn';
          exportButton.className = 'custom-toolbar-button'; // Use shared class

          const exportIcon = document.createElement('span');
          exportIcon.className = 'material-symbols-outlined';
          exportIcon.textContent = 'markdown_copy';
          exportButton.appendChild(exportIcon);

          const exportTooltip = document.createElement('div');
          exportTooltip.className = 'custom-tooltip-text';
          exportTooltip.textContent = chrome.i18n.getMessage('tooltipCopyMarkdown');
          exportButton.appendChild(exportTooltip);

          exportButton.addEventListener('click', exportToMarkdown);

          const moreButton = toolbar.querySelector('button[aria-label="View more actions"]');
          if (moreButton) toolbar.insertBefore(exportButton, moreButton);
          else toolbar.appendChild(exportButton);
        }

        // --- Inject Catalog Button (right side) ---
        if (!document.getElementById('catalog-toggle-btn')) {
          const catalogButton = document.createElement('button');
          catalogButton.id = 'catalog-toggle-btn';
          catalogButton.className = 'custom-toolbar-button'; // Use shared class

          const catalogIcon = document.createElement('span');
          catalogIcon.className = 'material-symbols-outlined';
          catalogIcon.textContent = 'list';
          catalogButton.appendChild(catalogIcon);

          const catalogTooltip = document.createElement('div');
          catalogTooltip.className = 'custom-tooltip-text';
          catalogTooltip.textContent = chrome.i18n.getMessage('tooltipCatalog');
          catalogButton.appendChild(catalogTooltip);

          catalogButton.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCatalog();
          });

          sideToggles.appendChild(catalogButton);
        }

        // --- Inject Catalog Panel (hidden) ---
        if (!document.getElementById('catalog-side-panel')) {
          const panel = createCatalogPanel();
          const nativePanelContainer = document.querySelector('ms-right-side-panel');
          if(nativePanelContainer) {
             nativePanelContainer.parentElement.insertBefore(panel, nativePanelContainer);
          }
        }

        // Add listeners to all native sidebar buttons to close our panel
        const nativeSidebarButtons = sideToggles.querySelectorAll('button[aria-label*="settings"], button[aria-label*="gallery"]');
        nativeSidebarButtons.forEach(button => {
            button.addEventListener('click', () => {
                toggleCatalog(false); // Force-close our panel
            });
        });
      }
    }, 500);
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