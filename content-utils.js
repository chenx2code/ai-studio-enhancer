(function (global) {
  'use strict';
  global.__AIStudioEnhancer__ = global.__AIStudioEnhancer__ || {};

  /**
   * Configuration object for storing all fragile CSS selectors and class names.
   */
  const SELECTORS = {
    query: {
      toolbar: 'ms-toolbar .toolbar-container',
      runSettingsButton: '[iconname="tune"], [aria-label*="run settings"], [aria-label*="Run settings"], [aria-label*="settings panel"]',
      moreActionsButton: 'button[aria-label="View more actions"]',
      nativeSidePanel: 'ms-right-side-panel',
      nativeSidePanelCloseButton: 'ms-right-side-panel button[iconname="close"]',
      chunkEditor: 'ms-chunk-editor',
      chatTurn: 'ms-chat-turn',
      chatTurnContainer: '.chat-turn-container',
      conversationObserverTarget: 'body',
      temporaryChatToggle: 'ms-incognito-mode-toggle',
      temporaryChatIndicator: 'ms-incognito-mode-indicator',
    },
    class: {
      userTurn: 'user',
      nativePanelHeader: 'header',
      nativePanelTitle: 'no-select v3-font-headline-2',
      nativeMaterialIcon: 'material-symbols-outlined notranslate',
      nativeSettingsWrapper: 'settings-items-wrapper',
      nativeScrollableArea: 'scrollable-area',
    },
    tag: {
      chatTurn: 'ms-chat-turn',
    },
    id: {
      exportButton: 'export-markdown-btn',
      catalogButton: 'catalog-toggle-btn',
      catalogPanel: 'catalog-side-panel',
      catalogListContainer: 'catalog-list-container',
      scrollToBottomButton: 'scroll-to-bottom-btn',
    },
    classExt: {
      panelVisible: 'panel-visible',
      buttonHidden: 'button-hidden',
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

  function getFriendlyFileType(mimeType) {
    if (!mimeType || typeof mimeType !== 'string') return 'Document';
    const type = mimeType.toLowerCase();
    
    if (type.includes('pdf')) return 'PDF';
    if (type.includes('markdown') || type.includes('md')) return 'Markdown';
    if (type.includes('csv')) return 'CSV';
    if (type.includes('json')) return 'JSON';
    if (type.includes('html')) return 'HTML';
    if (type.includes('xml')) return 'XML';
    if (type.includes('text/plain')) return 'Text';
    if (type.includes('python')) return 'Python';
    if (type.includes('javascript') || type.includes('typescript')) return 'JS/TS';
    
    const parts = type.split('/');
    if (parts.length === 2) {
      const subType = parts[1];
      if (subType.length <= 8 && !subType.includes('vnd') && !subType.includes('+')) {
        return subType.toUpperCase();
      }
    }
    return 'Document';
  }

  function getAttachmentPlaceholder(turn) {
    if (!turn || !Array.isArray(turn)) return null;
    
    const imageContent = turn[1];
    const inlineContent = turn[12];
    const youtubeContent = turn[13];
    const docContent = turn[23];

    if (imageContent && Array.isArray(imageContent) && imageContent.length > 0) {
      return { text: '[Image]', type: 'image' };
    }
    if (inlineContent && Array.isArray(inlineContent) && inlineContent.length > 0 && typeof inlineContent[0] === 'string' && inlineContent[0].startsWith('image/')) {
      return { text: '[Image]', type: 'image' };
    }
    if (youtubeContent && Array.isArray(youtubeContent) && youtubeContent.length > 0) {
      return { text: '[YouTube Video]', type: 'video' };
    }
    if (docContent && Array.isArray(docContent) && docContent.length > 0) {
      const friendlyType = getFriendlyFileType(docContent[0]);
      return { 
        text: friendlyType === 'Document' ? '[Document]' : `[${friendlyType} File]`, 
        type: friendlyType.toLowerCase() 
      };
    }
    
    return null;
  }

  function truncateText(text, maxLength = 50) {
    if (!text || typeof text !== 'string') return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  let currentTooltip = null;

  function showTooltip(targetElement, text) {
    if (currentTooltip) {
      currentTooltip.remove();
    }
    const tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip-text';
    tooltip.textContent = text;
    document.body.appendChild(tooltip);
    currentTooltip = tooltip;

    const targetRect = targetElement.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let top = targetRect.bottom + 8;
    let left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);

    if (top + tooltipRect.height > window.innerHeight) {
      top = targetRect.top - tooltipRect.height - 8;
    }
    if (left < 0) {
      left = 5;
    }
    if (left + tooltipRect.width > window.innerWidth) {
      left = window.innerWidth - tooltipRect.width - 5;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.position = 'fixed';

    setTimeout(() => {
      if(tooltip) tooltip.style.opacity = '1';
    }, 10); 
  }

  function hideTooltip() {
    if (currentTooltip) {
      const tooltipToRemove = currentTooltip;
      currentTooltip = null;
      tooltipToRemove.style.opacity = '0';
      setTimeout(() => {
        tooltipToRemove.remove();
      }, 150);
    }
  }

  function createToolbarButton(id, iconName, tooltipText, onClick, variant = 'icon-borderless') {
    const button = document.createElement('button');
    button.id = id;
    button.setAttribute('ms-button', '');
    button.setAttribute('variant', variant);
    button.setAttribute('iconname', iconName);
    button.classList.add('mat-mdc-tooltip-trigger');

    if (variant === 'icon-primary') {
      button.classList.add('ms-button-primary', 'ms-button-icon');
    } else {
      button.classList.add('ms-button-borderless', 'ms-button-icon');
    }

    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined notranslate ms-button-icon-symbol';
    icon.textContent = iconName;
    button.appendChild(icon);

    button.addEventListener('mouseenter', () => showTooltip(button, tooltipText));
    button.addEventListener('mouseleave', hideTooltip);
    button.addEventListener('blur', hideTooltip);
    button.addEventListener('click', hideTooltip);
    button.addEventListener('click', onClick);

    return button;
  }

  global.__AIStudioEnhancer__.Utils = {
    SELECTORS,
    CONSTANTS,
    getFriendlyFileType,
    getAttachmentPlaceholder,
    truncateText,
    showTooltip,
    hideTooltip,
    createToolbarButton
  };

})(window);
