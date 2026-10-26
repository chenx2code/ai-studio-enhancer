(function (global) {
  'use strict';
  global.__AIStudioEnhancer__ = global.__AIStudioEnhancer__ || {};

  const State = global.__AIStudioEnhancer__.State;
  const Utils = global.__AIStudioEnhancer__.Utils;

  let catalogVisible = false;
  let scrollStopTimer = null;
  let isHoveringScrollButton = false;
  let nativePanelObserver = null;
  let currentlyObservedNativePanel = null;

  function extractUserPrompts(conversationTurns) {
    if (!Array.isArray(conversationTurns)) {
      return [];
    }
    const userPrompts = [];
    const userTurnElementIds = [];
    const chatTurns = document.querySelectorAll(Utils.SELECTORS.query.chatTurn);
    for (const chatTurn of chatTurns) {
      const container = chatTurn.querySelector(Utils.SELECTORS.query.chatTurnContainer);
      if (container && container.classList.contains(Utils.SELECTORS.class.userTurn)) {
        userTurnElementIds.push(chatTurn.id);
      }
    }

    conversationTurns.forEach((turn, index) => {
      if (!Array.isArray(turn) || turn.length < 9) return;
      const role = turn[8];
      if (role === 'user') {
        const textContent = turn[0] || '';
        let promptText = '';
        let contentType = 'text';

        if (textContent && textContent.trim()) {
          promptText = textContent.trim();
          contentType = 'text';
        } else {
          const attachment = Utils.getAttachmentPlaceholder(turn);
          if (attachment) {
            promptText = attachment.text;
            contentType = attachment.type;
          } else {
            promptText = '[File]';
            contentType = 'file';
          }
        }

        let turnElementId = userTurnElementIds[userPrompts.length] || null;

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
      const newData = extractUserPrompts(conversationTurns);
      const oldData = State.getCatalogData();
      
      let isDifferent = false;
      if (!oldData || newData.length !== oldData.length) {
        isDifferent = true;
      } else {
        for (let i = 0; i < newData.length; i++) {
          if (newData[i].promptText !== oldData[i].promptText || 
              newData[i].turnElementId !== oldData[i].turnElementId) {
            isDifferent = true;
            break;
          }
        }
      }

      if (isDifferent) {
        State.setCatalogData(newData);
        if (catalogVisible) {
          renderPromptList();
        }
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
      for (let m = 0; m < mutations.length; m++) {
        const mutation = mutations[m];
        if (mutation.type === 'childList') {
          for (let i = 0; i < mutation.removedNodes.length; i++) {
            const node = mutation.removedNodes[i];
            if (node.nodeType === Node.ELEMENT_NODE) {
              const tag = node.tagName.toLowerCase();
              if (tag === 'ms-chat-turn' || tag === Utils.SELECTORS.tag.chatTurn) {
                shouldValidate = true;
                break;
              } else if (tag === 'div' || tag === 'main' || tag === 'section') {
                if (node.querySelector && node.querySelector(Utils.SELECTORS.query.chatTurn)) {
                  shouldValidate = true;
                  break;
                }
              }
            }
          }
        }
        if (shouldValidate) break;
      }
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
  }

  function checkAndObserveNativePanel() {
    const panel = document.querySelector(Utils.SELECTORS.query.nativeSidePanel);
    
    if (panel && panel !== currentlyObservedNativePanel) {
      if (nativePanelObserver) {
        nativePanelObserver.disconnect();
      }
      currentlyObservedNativePanel = panel;
      
      let previousWidth = panel.getBoundingClientRect().width;
      
      nativePanelObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          const currentWidth = entry.contentRect.width;
          
          // Only trigger anti-overlap if expanding (we can't easily rely on isWindowResizing here if we decoupled it, but we can assume normal usage)
          // Wait, we need to access isWindowResizing from setupWindowListeners...
          // Let's just keep the anti-overlap simple for now, or just move the resize listener here.
          if (currentWidth > previousWidth && currentWidth > 0 && catalogVisible) {
            const catalogPanel = document.getElementById(Utils.SELECTORS.id.catalogPanel);
            if (catalogPanel) {
              catalogPanel.style.setProperty('transition', 'none', 'important');
              toggleCatalog(false);
              setTimeout(() => {
                catalogPanel.style.removeProperty('transition');
              }, 50);
            }
          }
          previousWidth = currentWidth;
        }
      });
      nativePanelObserver.observe(panel);
    } else if (!panel && currentlyObservedNativePanel) {
      if (nativePanelObserver) {
        nativePanelObserver.disconnect();
        nativePanelObserver = null;
      }
      currentlyObservedNativePanel = null;
    }
  }

  let activeNavigationCancel = null;
  let isNavigating = false;

  // Retrieve the primary scrollable container for AI Studio chat history
  function getChatScrollContainer() {
    const turn = document.querySelector(Utils.SELECTORS.query.chatTurn) || document.querySelector(Utils.SELECTORS.query.chunkEditor);
    if (turn) {
      let p = turn.parentElement;
      while (p && p !== document.body) {
        const s = window.getComputedStyle(p);
        if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && p.scrollHeight > p.clientHeight) {
          return p;
        }
        p = p.parentElement;
      }
    }

    const chunkEditor = document.querySelector(Utils.SELECTORS.query.chunkEditor);
    if (chunkEditor) {
      const s = window.getComputedStyle(chunkEditor);
      if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && chunkEditor.scrollHeight > chunkEditor.clientHeight) {
        return chunkEditor;
      }
      for (const child of chunkEditor.children) {
        if (child.id === Utils.SELECTORS.id.catalogPanel) continue;
        const cs = window.getComputedStyle(child);
        if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && child.scrollHeight > child.clientHeight) {
          return child;
        }
      }
      const mainContent = Array.from(chunkEditor.children).find(
        child => child.id !== Utils.SELECTORS.id.catalogPanel && child.tagName !== 'STYLE' && !child.classList.contains('custom-tooltip-text')
      );
      if (mainContent) return mainContent;
      return chunkEditor;
    }

    if (document.documentElement.scrollHeight > document.documentElement.clientHeight) {
      return document.documentElement;
    }
    return document.body;
  }

  function getChatMainContainer() {
    return getChatScrollContainer();
  }

  // Hardware-synchronized 60fps/120fps ease-out cubic scroll animation
  function animateScrollTo(scroller, targetTop, duration, onComplete) {
    if (!scroller) return () => {};

    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const boundedTarget = Math.max(0, Math.min(maxScroll, Math.round(targetTop)));
    const startTop = scroller.scrollTop;
    const distance = boundedTarget - startTop;

    if (Math.abs(distance) < 2) {
      scroller.scrollTop = boundedTarget;
      if (onComplete) onComplete();
      return () => {};
    }

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const startTime = performance.now();
    let rafId = null;
    let isCanceled = false;

    const tick = (currentTime) => {
      if (isCanceled) return;

      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      const easedProgress = easeOutCubic(progress);

      scroller.scrollTop = Math.round(startTop + distance * easedProgress);

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        scroller.scrollTop = boundedTarget;
        if (onComplete) onComplete();
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      isCanceled = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  }

  // Extract clean normalized prompt text from a chat turn element
  function getCleanPromptText(turnEl) {
    if (!turnEl) return '';
    const container = turnEl.querySelector(Utils.SELECTORS.query.chatTurnContainer) || turnEl;
    return (container.textContent || '').replace(/\s+/g, ' ').trim();
  }

  // Infer catalog item index corresponding to a rendered DOM turn
  function inferCatalogIndex(turnEl, catalogData) {
    if (!turnEl || !catalogData || catalogData.length === 0) return -1;
    const text = getCleanPromptText(turnEl);
    if (!text) return -1;

    for (let i = 0; i < catalogData.length; i++) {
      const itemText = (catalogData[i].promptText || '').replace(/\s+/g, ' ').trim();
      if (itemText && (itemText === text || itemText.startsWith(text.slice(0, 30)) || text.startsWith(itemText.slice(0, 30)))) {
        return i;
      }
    }
    return -1;
  }

  // Locate the target DOM ms-chat-turn element for a given catalog item
  function findTargetElement(catalogItem) {
    if (!catalogItem) return null;

    // Tier 1: ID Match (if element has valid ID)
    if (catalogItem.turnElementId) {
      const el = document.getElementById(catalogItem.turnElementId);
      if (el) return el;
    }

    const chatTurns = Array.from(document.querySelectorAll(Utils.SELECTORS.query.chatTurn));
    if (chatTurns.length === 0) return null;

    const userTurns = [];
    chatTurns.forEach((turn, index) => {
      const container = turn.querySelector(Utils.SELECTORS.query.chatTurnContainer);
      if (container && container.classList.contains(Utils.SELECTORS.class.userTurn)) {
        userTurns.push({ element: turn, domIndex: index });
      }
    });

    if (userTurns.length === 0) return null;

    const targetText = (catalogItem.promptText || '').replace(/\s+/g, ' ').trim();

    // Helper to pick closest candidate if multiple matches exist
    const pickClosestTurn = (matches) => {
      const catalogData = State.getCatalogData() || [];
      const catalogIndex = catalogData.findIndex(item => item.turnIndex === catalogItem.turnIndex);
      const targetRatio = catalogIndex >= 0 ? catalogIndex / Math.max(1, catalogData.length - 1) : 0;
      const expectedDomIndex = Math.round(targetRatio * (userTurns.length - 1));

      let best = matches[0].element;
      let minDiff = Infinity;
      for (const m of matches) {
        const idx = userTurns.findIndex(u => u.element === m.element);
        const diff = Math.abs(idx - expectedDomIndex);
        if (diff < minDiff) {
          minDiff = diff;
          best = m.element;
        }
      }
      return best;
    };

    // Tier 2: Text Matching
    if (targetText && targetText !== '[File]' && targetText !== '[Image]' && targetText !== '[Document]') {
      // 2a. Exact match
      const exactMatches = userTurns.filter(t => getCleanPromptText(t.element) === targetText);
      if (exactMatches.length === 1) {
        return exactMatches[0].element;
      } else if (exactMatches.length > 1) {
        return pickClosestTurn(exactMatches);
      }

      // 2b. Prefix match (first 25 characters)
      const prefix = targetText.slice(0, 25);
      if (prefix.length >= 5) {
        const prefixMatches = userTurns.filter(t => {
          const tText = getCleanPromptText(t.element);
          return tText.startsWith(prefix) || prefix.startsWith(tText.slice(0, 25));
        });
        if (prefixMatches.length === 1) {
          return prefixMatches[0].element;
        } else if (prefixMatches.length > 1) {
          return pickClosestTurn(prefixMatches);
        }
      }

      // 2c. Substring overlap match
      let bestCandidate = null;
      let maxOverlap = 0;
      for (const t of userTurns) {
        const tText = getCleanPromptText(t.element);
        if (!tText) continue;
        let overlap = 0;
        const minLen = Math.min(tText.length, targetText.length);
        while (overlap < minLen && tText[overlap] === targetText[overlap]) {
          overlap++;
        }
        if (overlap > 10 && overlap > maxOverlap) {
          maxOverlap = overlap;
          bestCandidate = t.element;
        }
      }
      if (bestCandidate) return bestCandidate;
    }

    // Tier 3: Index match fallback when all turns are fully rendered
    const catalogData = State.getCatalogData() || [];
    const catalogIndex = catalogData.findIndex(item => item.turnIndex === catalogItem.turnIndex);
    if (catalogIndex >= 0 && catalogData.length === userTurns.length) {
      return userTurns[catalogIndex].element;
    }

    return null;
  }

  function navigateToPrompt(turnIndex) {
    try {
      const catalogData = State.getCatalogData();
      const catalogItem = catalogData.find(item => item.turnIndex === turnIndex);
      if (!catalogItem) return;

      const scroller = getChatScrollContainer();
      if (!scroller) return;

      // 1. Cancel active animation
      if (activeNavigationCancel) {
        activeNavigationCancel();
        activeNavigationCancel = null;
      }

      isNavigating = true;

      // 2. User interrupt handler: abort auto-navigation on manual interaction
      const onUserInterrupt = (e) => {
        if (e.target && e.target.closest && e.target.closest('#' + Utils.SELECTORS.id.catalogPanel)) {
          return;
        }
        cleanup();
      };

      const cleanup = () => {
        if (activeNavigationCancel) {
          activeNavigationCancel();
          activeNavigationCancel = null;
        }
        isNavigating = false;
        window.removeEventListener('wheel', onUserInterrupt, { capture: true });
        window.removeEventListener('touchstart', onUserInterrupt, { capture: true });
        window.removeEventListener('keydown', onUserInterrupt, { capture: true });
      };

      window.addEventListener('wheel', onUserInterrupt, { capture: true, passive: true });
      window.addEventListener('touchstart', onUserInterrupt, { capture: true, passive: true });
      window.addEventListener('keydown', onUserInterrupt, { capture: true, passive: true });

      // Precision landing helper when target DOM element is available
      const landOnTarget = (targetEl) => {
        if (!targetEl) {
          cleanup();
          return;
        }

        const targetRect = targetEl.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        const desiredTop = 80;

        const delta = (targetRect.top - scrollerRect.top) - desiredTop;
        const targetScrollTop = scroller.scrollTop + delta;
        const totalDistance = Math.abs(delta);

        // Plan A: Two-stage motion for large distances (teleport to approach zone + smooth glide to target)
        // If distance is large (> 1800px), jump to ~1000px before the target,
        // then perform a visible, buttery-smooth deceleration glide for the final approach!
        const approachDistance = 1000;
        if (totalDistance > 1800) {
          const preJumpTop = delta > 0
            ? targetScrollTop - approachDistance
            : targetScrollTop + approachDistance;
          scroller.scrollTop = Math.max(0, Math.min(scroller.scrollHeight - scroller.clientHeight, preJumpTop));
        }

        // Re-measure fresh target coordinates from the approach zone for 100% precision
        const freshTarget = findTargetElement(catalogItem) || targetEl;
        const freshTargetRect = freshTarget.getBoundingClientRect();
        const finalDelta = (freshTargetRect.top - scrollerRect.top) - desiredTop;
        const finalTargetTop = scroller.scrollTop + finalDelta;
        const glideDistance = Math.abs(finalDelta);

        // Comfortable glide duration for the final approach (320ms - 420ms)
        const duration = Math.min(420, Math.max(280, Math.round(240 + Math.sqrt(glideDistance) * 3.8)));

        activeNavigationCancel = animateScrollTo(scroller, finalTargetTop, duration, () => {
          // Final micro-settle if async rendering shifted layout slightly during flight
          const settledTarget = findTargetElement(catalogItem) || freshTarget;
          const settledRect = settledTarget.getBoundingClientRect();
          const settleDelta = (settledRect.top - scrollerRect.top) - desiredTop;

          if (Math.abs(settleDelta) > 12) {
            activeNavigationCancel = animateScrollTo(scroller, scroller.scrollTop + settleDelta, 120, () => {
              cleanup();
            });
          } else {
            cleanup();
          }
        });
      };

      // Check if target is already in DOM
      const initialTargetEl = findTargetElement(catalogItem);
      if (initialTargetEl) {
        landOnTarget(initialTargetEl);
        return;
      }

      // Target not in DOM yet (virtualized): smooth hydration glide towards target's estimated location
      const chatTurns = Array.from(document.querySelectorAll(Utils.SELECTORS.query.chatTurn));
      const userTurns = [];
      chatTurns.forEach((turn, index) => {
        const container = turn.querySelector(Utils.SELECTORS.query.chatTurnContainer);
        if (container && container.classList.contains(Utils.SELECTORS.class.userTurn)) {
          userTurns.push(turn);
        }
      });

      let scrollUp = true;
      if (userTurns.length > 0) {
        const firstVisibleIdx = inferCatalogIndex(userTurns[0], catalogData);
        const catalogItemIdx = catalogData.findIndex(item => item.turnIndex === catalogItem.turnIndex);
        if (firstVisibleIdx !== -1 && catalogItemIdx !== -1) {
          scrollUp = catalogItemIdx < firstVisibleIdx;
        } else {
          scrollUp = scroller.scrollTop > 300;
        }
      } else {
        scrollUp = scroller.scrollTop > 300;
      }

      const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      const searchTarget = scrollUp ? 0 : maxScroll;
      const searchDistance = Math.abs(searchTarget - scroller.scrollTop);
      const searchDuration = Math.min(650, Math.max(320, Math.round(240 + Math.sqrt(searchDistance) * 4.5)));

      let frameCount = 0;
      const startTop = scroller.scrollTop;
      const searchDelta = searchTarget - startTop;
      const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
      const searchStartTime = performance.now();
      let searchRafId = null;

      const searchStep = (currentTime) => {
        frameCount++;
        const elapsed = currentTime - searchStartTime;
        const progress = Math.min(1, elapsed / searchDuration);
        const easedProgress = easeOutCubic(progress);

        scroller.scrollTop = Math.round(startTop + searchDelta * easedProgress);

        // Check every 4 frames (~60ms) if target element has been hydrated into DOM
        if (frameCount % 4 === 0) {
          const foundEl = findTargetElement(catalogItem);
          if (foundEl) {
            cancelAnimationFrame(searchRafId);
            searchRafId = null;
            landOnTarget(foundEl);
            return;
          }
        }

        if (progress < 1) {
          searchRafId = requestAnimationFrame(searchStep);
        } else {
          // Final check after boundary arrival
          setTimeout(() => {
            const finalFound = findTargetElement(catalogItem);
            if (finalFound) {
              landOnTarget(finalFound);
            } else {
              cleanup();
            }
          }, 80);
        }
      };

      searchRafId = requestAnimationFrame(searchStep);
      activeNavigationCancel = () => {
        if (searchRafId !== null) {
          cancelAnimationFrame(searchRafId);
          searchRafId = null;
        }
      };
    } catch (error) {
      console.error('Error during navigation:', error);
    }
  }

  function scrollToBottom() {
    try {
      const scroller = getChatScrollContainer();
      if (!scroller) return;

      if (activeNavigationCancel) {
        activeNavigationCancel();
        activeNavigationCancel = null;
      }

      const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      const totalDistance = Math.abs(maxScroll - scroller.scrollTop);
      if (totalDistance < 5) return;

      const approachDistance = 1000;
      if (totalDistance > 1800) {
        scroller.scrollTop = maxScroll - approachDistance;
      }

      const remainingDistance = Math.abs(maxScroll - scroller.scrollTop);
      const duration = Math.min(420, Math.max(280, Math.round(240 + Math.sqrt(remainingDistance) * 3.5)));
      activeNavigationCancel = animateScrollTo(scroller, maxScroll, duration, () => {
        activeNavigationCancel = null;
      });
    } catch (error) {
      console.error('Error scrolling to bottom:', error);
    }
  }


  function isOverlayActive() {
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) {
      return overlay.offsetWidth > 0 && overlay.offsetHeight > 0 && overlay.style.visibility !== 'hidden';
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
    checkAndObserveNativePanel,
    createCatalogPanel,
    toggleCatalog,
    scrollToBottom,
    getChatMainContainer,
    getChatScrollContainer,
    updateScrollButtonPosition,
    updateScrollBtnOverlayVisibility,
    getCatalogVisible,
    getIsHoveringScrollButton,
    setIsHoveringScrollButton,
    getScrollStopTimer,
    setScrollStopTimer
  };

})(window);
