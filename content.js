(function() {
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
  s.onload = function() { this.remove(); };
  (document.head || document.documentElement).appendChild(s);

  /**
   * PART 2: 消息监听器
   */
  window.addEventListener('message', function(event) {
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

        // Create catalog item
        const catalogItem = {
          turnIndex: index,
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
   * PART 3.6: 目录切换功能
   */
  
  /**
   * Create catalog panel DOM element
   * @returns {HTMLElement} The catalog panel element
   */
  function createCatalogPanel() {
    const panel = document.createElement('div');
    panel.id = 'catalog-panel';
    panel.className = 'catalog-panel';
    
    // Create panel header
    const header = document.createElement('div');
    header.className = 'catalog-header';
    header.textContent = chrome.i18n.getMessage('catalogHeader');
    
    // Create prompt list container
    const listContainer = document.createElement('div');
    listContainer.id = 'catalog-list-container';
    listContainer.className = 'catalog-list-container';
    
    panel.appendChild(header);
    panel.appendChild(listContainer);
    
    return panel;
  }

  /**
   * Create prompt list item element
   * @param {Object} catalogItem - Catalog item data
   * @param {number} index - Index of the item in the list
   * @returns {HTMLElement} The list item element
   */
  function createPromptListItem(catalogItem, index) {
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
    
    // Add click event handler for navigation (placeholder for now)
    listItem.addEventListener('click', function() {
      console.log('Navigate to prompt at turn index:', catalogItem.turnIndex);
      // TODO: Implement navigation functionality in task 6
    });
    
    // Add keyboard support
    listItem.addEventListener('keydown', function(event) {
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
      console.error('Catalog list container not found');
      return;
    }
    
    // Clear existing content
    listContainer.innerHTML = '';
    
    // Handle empty state
    if (!catalogData || catalogData.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'catalog-empty-state';
      emptyState.textContent = chrome.i18n.getMessage('catalogEmptyState');
      listContainer.appendChild(emptyState);
      return;
    }
    
    // Create list items for each user prompt
    catalogData.forEach((catalogItem, index) => {
      const listItem = createPromptListItem(catalogItem, index);
      listContainer.appendChild(listItem);
    });
    
    console.log('Rendered', catalogData.length, 'prompt list items');
  }

  /**
   * Show catalog panel
   */
  function showCatalogPanel() {
    let panel = document.getElementById('catalog-panel');
    
    if (!panel) {
      panel = createCatalogPanel();
      document.body.appendChild(panel);
    }
    
    // Render the prompt list
    renderPromptList();
    
    panel.style.display = 'block';
    console.log('Catalog panel shown with', catalogData.length, 'items');
  }

  /**
   * Hide catalog panel
   */
  function hideCatalogPanel() {
    const panel = document.getElementById('catalog-panel');
    if (panel) {
      panel.style.display = 'none';
    }
    console.log('Catalog panel hidden');
  }

  /**
   * Toggle catalog panel visibility
   */
  function toggleCatalog() {
    catalogVisible = !catalogVisible;
    console.log('Catalog toggled:', catalogVisible ? 'visible' : 'hidden');
    
    if (catalogVisible) {
      showCatalogPanel();
    } else {
      hideCatalogPanel();
    }
  }

  /**
   * PART 4: UI注入逻辑
   */
  function checkAndInjectButton() {
    const targetUrlPattern = /^https:\/\/aistudio\.google\.com\/prompts\/.+$/;
    const currentUrl = window.location.href;
    const existingExportButton = document.getElementById('export-markdown-btn');
    const existingCatalogButton = document.getElementById('catalog-toggle-btn');

    if (!targetUrlPattern.test(currentUrl)) {
      if (existingExportButton) {
        existingExportButton.remove();
      }
      if (existingCatalogButton) {
        existingCatalogButton.remove();
      }
      return;
    }

    if (existingExportButton && existingCatalogButton) {
      // Both buttons already exist and URL matches, no need to re-inject
      return;
    }

    const injectionInterval = setInterval(() => {
      const toolbar = document.querySelector('ms-toolbar .toolbar-container');
      if (toolbar) {
        clearInterval(injectionInterval);
        
        // Create export markdown button if it doesn't exist
        if (!existingExportButton) {
          const exportTooltipText = chrome.i18n.getMessage('tooltipCopyMarkdown');
          const exportButton = document.createElement('button');
          exportButton.id = 'export-markdown-btn';
          exportButton.setAttribute('aria-label', exportTooltipText);
          exportButton.setAttribute('aria-describedby', 'export-markdown-tooltip');

          const exportIcon = document.createElement('span');
          exportIcon.className = 'material-symbols-outlined';
          exportIcon.innerText = 'markdown_copy';

          const exportTooltip = document.createElement('span');
          exportTooltip.id = 'export-markdown-tooltip';
          exportTooltip.className = 'custom-tooltip-text';
          exportTooltip.setAttribute('role', 'tooltip');
          exportTooltip.innerText = exportTooltipText;

          exportButton.appendChild(exportIcon);
          exportButton.appendChild(exportTooltip);
          exportButton.addEventListener('click', exportToMarkdown);
          
          const moreButton = toolbar.querySelector('button[aria-label="View more actions"]');
          if (moreButton) toolbar.insertBefore(exportButton, moreButton);
          else toolbar.appendChild(exportButton);
        }
        
        // Create catalog toggle button if it doesn't exist
        if (!existingCatalogButton) {
          const catalogTooltipText = chrome.i18n.getMessage('tooltipCatalog');
          const catalogButton = document.createElement('button');
          catalogButton.id = 'catalog-toggle-btn';
          catalogButton.setAttribute('aria-label', catalogTooltipText);
          catalogButton.setAttribute('aria-describedby', 'catalog-tooltip');

          const catalogIcon = document.createElement('span');
          catalogIcon.className = 'material-symbols-outlined';
          catalogIcon.innerText = 'list';

          const catalogTooltip = document.createElement('span');
          catalogTooltip.id = 'catalog-tooltip';
          catalogTooltip.className = 'custom-tooltip-text';
          catalogTooltip.setAttribute('role', 'tooltip');
          catalogTooltip.innerText = catalogTooltipText;

          catalogButton.appendChild(catalogIcon);
          catalogButton.appendChild(catalogTooltip);
          catalogButton.addEventListener('click', toggleCatalog);
          
          const moreButton = toolbar.querySelector('button[aria-label="View more actions"]');
          if (moreButton) toolbar.insertBefore(catalogButton, moreButton);
          else toolbar.appendChild(catalogButton);
        }
      }
    }, 500);
  }

  function initialize() {
    checkAndInjectButton();

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