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
      nativeSidePanel: 'ms-right-side-panel:not(#catalog-side-panel)',
      nativeSidePanelCloseButton: 'ms-right-side-panel:not(#catalog-side-panel) button[iconname="close"]',
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
      obsidianButton: 'export-obsidian-btn',
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
      if (tooltip) tooltip.style.opacity = '1';
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

  function createToolbarButton(id, iconName, tooltipText, onClick, variant = 'icon-borderless', customSvg = null) {
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

    if (customSvg) {
      button.innerHTML = customSvg;
    } else {
      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined notranslate ms-button-icon-symbol';
      icon.textContent = iconName;
      button.appendChild(icon);
    }

    button.addEventListener('mouseenter', () => showTooltip(button, tooltipText));
    button.addEventListener('mouseleave', hideTooltip);
    button.addEventListener('blur', hideTooltip);
    button.addEventListener('click', hideTooltip);
    button.addEventListener('click', onClick);

    return button;
  }

  function isDescendantElement(parent, child, boundary) {
    let cur = child ? child.parentElement : null;
    while (cur) {
      if (cur === parent) return true;
      if (boundary && cur === boundary) break;
      cur = cur.parentElement;
    }
    return false;
  }

  function closestWithinBoundary(el, selector, boundary) {
    if (!el || typeof el.closest !== 'function') return null;
    const found = el.closest(selector);
    if (!found) return null;
    if (!boundary || found === boundary || isDescendantElement(boundary, found)) {
      return found;
    }
    return null;
  }

  function isTurnContentImage(img) {
    if (!img) return false;
    if (
      (img.classList && (img.classList.contains('user-icon') || img.classList.contains('avatar'))) ||
      (img.src && (img.src.includes('googleusercontent.com/a/') || img.src.includes('watermark.png'))) ||
      (img.alt && img.alt.trim().toLowerCase() === 'thinking')
    ) {
      return false;
    }
    return true;
  }

  /**
   * Query all currently rendered user chat turn DOM elements.
   */
  function getUserTurnElements() {
    const result = [];
    const chatTurns = document.querySelectorAll(SELECTORS.query.chatTurn);
    for (const chatTurn of chatTurns) {
      const container = chatTurn.querySelector(SELECTORS.query.chatTurnContainer);
      if (container && container.classList.contains(SELECTORS.class.userTurn)) {
        result.push(chatTurn);
      }
    }
    return result;
  }

  /**
   * Extract Google account email from DOM candidates (matching gemi-boost).
   */
  function extractUserAccount() {
    try {
      const candidates = Array.from(
        document.querySelectorAll(
          'button[aria-label*="@"], a[aria-label*="@"], [data-identifier*="@"], [data-email*="@"], [aria-label*="Google 账号"], [aria-label*="Google Account"]'
        )
      );

      for (const el of candidates) {
        const text = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('data-identifier') || ''} ${el.getAttribute('data-email') || ''} ${el.title || ''}`;
        const match = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (match) {
          return match[1];
        }
      }

      const userIcons = Array.from(document.querySelectorAll('img.user-icon, [class*="avatar"] img'));
      for (const img of userIcons) {
        const match = (img.alt || img.title || '').match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (match) {
          return match[1];
        }
      }
    } catch (e) {
      console.warn('Failed to extract user account email:', e);
    }
    return '';
  }

  global.__AIStudioEnhancer__.Utils = {
    SELECTORS,
    CONSTANTS,
    truncateText,
    showTooltip,
    hideTooltip,
    createToolbarButton,
    isDescendantElement,
    closestWithinBoundary,
    isTurnContentImage,
    getUserTurnElements,
    extractUserAccount
  };

})(window);
