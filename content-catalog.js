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

  let scrollSpyBound = false;
  const attachmentCache = new Map();

  const detectFileCategory = Utils.detectFileCategory;

  // Get SVG markup for a given attachment category
  function getAttachmentIconSvg(category) {
    switch (category) {
      case 'folder':
        return '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>';
      case 'code':
        return '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>';
      case 'pdf':
        return '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9.5 8.5c0 .83-.67 1.5-1.5 1.5H7v2H5.5V8H8c.83 0 1.5.67 1.5 1.5v2zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V8H13c.83 0 1.5.67 1.5 1.5v4zm4-3.5H17v1h1.5v1.5H17v2h-1.5V8h3v1.5z"/></svg>';
      case 'table':
        return '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM5 7h14v2H5V7zm0 4h6v8H5v-8zm14 8h-6v-8h6v8z"/></svg>';
      case 'text':
        return '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>';
      case 'audio':
        return '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>';
      case 'video':
        return '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-10 12.5v-9l6 4.5-6 4.5z"/></svg>';
      case 'archive':
        return '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 10h-2v-2h2v2zm0-4h-2v-2h2v2zm-2-4V6h2v2h-2z"/></svg>';
      case 'image':
        return '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
      case 'file':
      default:
        return '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>';
    }
  }

  const extractImageInfo = Utils.extractImageInfo;
  const extractRoundAttachments = Utils.extractRoundAttachments;

  function extractUserPrompts(conversationTurns) {
    if (!Array.isArray(conversationTurns)) {
      return [];
    }

    // 1. Query all rendered user chat turn DOM elements
    const userTurnElements = [];
    const chatTurns = document.querySelectorAll(Utils.SELECTORS.query.chatTurn);
    for (const chatTurn of chatTurns) {
      const container = chatTurn.querySelector(Utils.SELECTORS.query.chatTurnContainer);
      if (container && container.classList.contains(Utils.SELECTORS.class.userTurn)) {
        userTurnElements.push(chatTurn);
      }
    }

    // 2. Group consecutive user chunks in conversationTurns into prompt rounds.
    // In Google AI Studio, a user prompt turn (containing all text and attachment chunks)
    // is rendered inside a single user ms-chat-turn. Consecutive user chunks belong to the same prompt round.
    const userPromptRounds = [];
    let currentRound = null;

    conversationTurns.forEach((turn, index) => {
      if (!Array.isArray(turn) || turn.length < 9) return;
      const role = turn[8];
      if (role === 'user') {
        if (!currentRound) {
          const roundIdx = userPromptRounds.length;
          currentRound = {
            roundIndex: roundIdx,
            primaryTurnIndex: index,
            chunks: []
          };
          userPromptRounds.push(currentRound);
        }
        currentRound.chunks.push({ turn, index, domIndex: currentRound.roundIndex });
      } else {
        // Model turn ends the current user prompt round
        currentRound = null;
      }
    });

    const totalRounds = userPromptRounds.length;
    const userPrompts = [];
    let turnCounter = 0;

    // Stamp rendered user chat turn DOM elements with their precise DOM index
    userTurnElements.forEach((el, idx) => {
      el.setAttribute('data-enhancer-dom-index', String(idx));
    });

    userPromptRounds.forEach((round, roundIdx) => {
      turnCounter++;
      const badgeStr = turnCounter < 10 ? '0' + turnCounter : String(turnCounter);

      // Match with user turn DOM element corresponding to this round
      const roundElements = [];
      let turnElement = null;

      if (userTurnElements.length === totalRounds && userTurnElements[roundIdx]) {
        turnElement = userTurnElements[roundIdx];
      } else if (userTurnElements.length === 1 && totalRounds === 1) {
        turnElement = userTurnElements[0];
      } else if (userTurnElements[roundIdx]) {
        turnElement = userTurnElements[roundIdx];
      }

      if (turnElement) {
        roundElements.push({ element: turnElement, domIndex: roundIdx });
      }
      const turnElementId = turnElement ? turnElement.id : null;

      // Extract combined text from all user chunks in this round
      const textParts = [];
      round.chunks.forEach(({ turn }) => {
        const txt = (turn[0] || '').trim();
        if (txt) {
          textParts.push(txt);
        }
      });
      const fullText = textParts.join(' ');
      const primaryIndex = round.primaryTurnIndex;

      // Extract attachments from DOM elements and API chunks in this round
      const attachments = extractRoundAttachments(round.chunks, roundElements, fullText);

      // Synchronize with attachmentCache: restore known real names or save newly resolved ones
      attachments.forEach((att, attIdx) => {
        const subIndex = att.subIndex !== undefined ? att.subIndex : attIdx;
        const cacheKey = `${roundIdx}_${subIndex}`;
        if (!att.isDefaultName && att.fileName) {
          attachmentCache.set(cacheKey, {
            fileName: att.fileName,
            fileType: att.fileType,
            fileCategory: att.fileCategory
          });
        } else if (att.isDefaultName && attachmentCache.has(cacheKey)) {
          const cached = attachmentCache.get(cacheKey);
          att.fileName = cached.fileName;
          att.fileType = cached.fileType;
          if (cached.fileCategory) att.fileCategory = cached.fileCategory;
          att.isDefaultName = false;
        }
      });

      if (fullText) {
        // A. Round has text: text row is turn root (gets the sequence badge)
        userPrompts.push({
          roundIndex: roundIdx,
          totalRounds: totalRounds,
          turnCounter: turnCounter,
          turnBadge: badgeStr,
          isTurnRoot: true,
          type: 'text',
          turnIndex: primaryIndex,
          startDomIndex: roundIdx,
          endDomIndex: roundIdx,
          targetDomIndex: roundIdx,
          turnElementId: turnElementId,
          promptText: fullText,
          pureText: fullText,
          displayText: fullText,
          truncatedText: Utils.truncateText(fullText, 50),
          role: 'user'
        });

        // Each attachment is indented directly below the prompt text (isTurnRoot: false)
        attachments.forEach((att, attIdx) => {
          userPrompts.push({
            roundIndex: roundIdx,
            totalRounds: totalRounds,
            turnCounter: turnCounter,
            turnBadge: '',
            isTurnRoot: false,
            type: att.type,
            fileCategory: att.fileCategory,
            fileType: att.fileType,
            fileName: att.fileName,
            isDefaultName: Boolean(att.isDefaultName),
            pureText: fullText,
            turnIndex: att.turnIndex !== undefined ? att.turnIndex : primaryIndex,
            startDomIndex: roundIdx,
            endDomIndex: roundIdx,
            targetDomIndex: roundIdx,
            turnElementId: turnElementId,
            promptText: `[${att.fileType}] ${att.fileName}`,
            displayText: att.fileName,
            subIndex: att.subIndex !== undefined ? att.subIndex : attIdx,
            role: 'user'
          });
        });
      } else if (attachments.length > 0) {
        // B. Round has NO text, only attachments: first attachment is turn root
        attachments.forEach((att, attIdx) => {
          const isRoot = attIdx === 0;
          userPrompts.push({
            roundIndex: roundIdx,
            totalRounds: totalRounds,
            turnCounter: turnCounter,
            turnBadge: isRoot ? badgeStr : '',
            isTurnRoot: isRoot,
            type: att.type,
            fileCategory: att.fileCategory,
            fileType: att.fileType,
            fileName: att.fileName,
            isDefaultName: Boolean(att.isDefaultName),
            pureText: '',
            turnIndex: att.turnIndex !== undefined ? att.turnIndex : primaryIndex,
            startDomIndex: roundIdx,
            endDomIndex: roundIdx,
            targetDomIndex: roundIdx,
            turnElementId: turnElementId,
            promptText: `[${att.fileType}] ${att.fileName}`,
            displayText: att.fileName,
            subIndex: att.subIndex !== undefined ? att.subIndex : attIdx,
            role: 'user'
          });
        });
      } else {
        // C. Fallback: empty prompt
        userPrompts.push({
          roundIndex: roundIdx,
          totalRounds: totalRounds,
          turnCounter: turnCounter,
          turnBadge: badgeStr,
          isTurnRoot: true,
          type: 'text',
          turnIndex: primaryIndex,
          startDomIndex: roundIdx,
          endDomIndex: roundIdx,
          targetDomIndex: roundIdx,
          turnElementId: turnElementId,
          promptText: '[Prompt]',
          pureText: '',
          displayText: '[Prompt]',
          truncatedText: '[Prompt]',
          role: 'user'
        });
      }
    });

    return userPrompts;
  }

  function clearAttachmentCache() {
    attachmentCache.clear();
  }

  function enrichCatalogAttachmentNames() {
    const catalogData = State.getCatalogData();
    if (!catalogData || catalogData.length === 0) return false;

    const userTurnElements = [];
    const chatTurns = document.querySelectorAll(Utils.SELECTORS.query.chatTurn);
    for (const chatTurn of chatTurns) {
      const container = chatTurn.querySelector(Utils.SELECTORS.query.chatTurnContainer);
      if (container && container.classList.contains(Utils.SELECTORS.class.userTurn)) {
        userTurnElements.push(chatTurn);
      }
    }

    const liveImages = Array.from(
      document.querySelectorAll(
        '.image-container img, ms-image-chunk img, ms-prompt-chunk img, .chat-turn-container.user img'
      )
    ).filter(img => {
      if (img.classList && (img.classList.contains('user-icon') || img.classList.contains('avatar'))) return false;
      if (img.src && (img.src.includes('googleusercontent.com/a/') || img.src.includes('watermark.png'))) return false;
      if (img.alt && img.alt.toLowerCase() === 'thinking') return false;
      return true;
    });

    let updated = false;

    const imageItems = catalogData.filter(item => !item.isTurnRoot && item.type === 'image');
    const imageRoundIndices = new Set(imageItems.map(item => item.roundIndex));
    const singleImageRound = imageRoundIndices.size === 1;

    catalogData.forEach(item => {
      if (!item.isTurnRoot && item.type === 'image') {
        const roundIdx = item.roundIndex;
        const subIdx = item.subIndex !== undefined ? item.subIndex : 0;
        const cacheKey = `${roundIdx}_${subIdx}`;

        if (item.isDefaultName) {
          // 1. Check cache first
          if (attachmentCache.has(cacheKey)) {
            const cached = attachmentCache.get(cacheKey);
            item.fileName = cached.fileName;
            item.fileType = cached.fileType;
            if (cached.fileCategory) item.fileCategory = cached.fileCategory;
            item.promptText = `[${cached.fileType}] ${cached.fileName}`;
            item.displayText = cached.fileName;
            item.isDefaultName = false;
            updated = true;
            return;
          }

          // 2. Scan live DOM
          let targetImg = null;

          // Strategy A: Find user turn matching this round
          let targetTurnEl = null;
          if (userTurnElements.length > 0) {
            if (userTurnElements[roundIdx]) {
              const cleanText = getCleanPromptText(userTurnElements[roundIdx]);
              if (!item.pureText || cleanText.includes(item.pureText) || item.pureText.includes(cleanText)) {
                targetTurnEl = userTurnElements[roundIdx];
              }
            }
            if (!targetTurnEl && item.pureText) {
              targetTurnEl = userTurnElements.find(el => {
                const clean = getCleanPromptText(el);
                return clean && (clean.includes(item.pureText) || item.pureText.includes(clean));
              });
            }
          }

          if (targetTurnEl) {
            const imgs = Array.from(targetTurnEl.querySelectorAll('img')).filter(img =>
              (!img.classList || (!img.classList.contains('user-icon') && !img.classList.contains('avatar'))) &&
              (!img.src || (!img.src.includes('googleusercontent.com/a/') && !img.src.includes('watermark.png'))) &&
              (!img.alt || img.alt.toLowerCase() !== 'thinking')
            );
            targetImg = imgs[subIdx] || imgs[0];
          }

          // Strategy B: Fallback to liveImages if only one round with images exists or turn-level match was bypassed
          if (!targetImg && liveImages.length > 0) {
            if (singleImageRound) {
              targetImg = liveImages[subIdx] || liveImages[0];
            } else if (item.pureText) {
              for (const img of liveImages) {
                const parentTurn = img.closest(Utils.SELECTORS.query.chatTurn) || img.closest('.chat-turn-container.user');
                if (parentTurn) {
                  const turnText = getCleanPromptText(parentTurn);
                  if (turnText && (turnText.includes(item.pureText) || item.pureText.includes(turnText))) {
                    targetImg = img;
                    break;
                  }
                }
              }
            }
          }

          if (targetImg) {
            const info = Utils.extractImageInfo(targetImg, subIdx, liveImages.length || 1);
            if (!info.isDefaultName && info.fileName) {
              item.fileName = info.fileName;
              item.fileType = info.fileType;
              item.fileCategory = info.fileCategory || 'image';
              item.promptText = `[${info.fileType}] ${info.fileName}`;
              item.displayText = info.fileName;
              item.isDefaultName = false;
              attachmentCache.set(cacheKey, {
                fileName: info.fileName,
                fileType: info.fileType,
                fileCategory: item.fileCategory
              });
              updated = true;
            }
          }
        } else if (item.fileName && !item.isDefaultName) {
          attachmentCache.set(cacheKey, {
            fileName: item.fileName,
            fileType: item.fileType,
            fileCategory: item.fileCategory
          });
        }
      }
    });

    if (updated) {
      State.setCatalogData(catalogData);
      if (catalogVisible) {
        renderPromptList();
      }
    }
    return updated;
  }

  function updateCatalogData(conversationTurns) {
    try {
      const newData = extractUserPrompts(conversationTurns);
      const oldData = State.getCatalogData();
      
      // Smart Merge: prevent fallback placeholder names from overwriting previously resolved filenames
      if (oldData && oldData.length > 0) {
        newData.forEach((newItem) => {
          if (!newItem.isTurnRoot && newItem.isDefaultName) {
            const cacheKey = `${newItem.roundIndex}_${newItem.subIndex !== undefined ? newItem.subIndex : 0}`;
            if (attachmentCache.has(cacheKey)) {
              const cached = attachmentCache.get(cacheKey);
              newItem.fileName = cached.fileName;
              newItem.fileType = cached.fileType;
              if (cached.fileCategory) newItem.fileCategory = cached.fileCategory;
              newItem.promptText = `[${cached.fileType}] ${cached.fileName}`;
              newItem.displayText = cached.fileName;
              newItem.isDefaultName = false;
            } else {
              const matchOld = oldData.find(o => 
                !o.isTurnRoot && 
                o.roundIndex === newItem.roundIndex && 
                o.subIndex === newItem.subIndex && 
                !o.isDefaultName && 
                o.fileName
              );
              if (matchOld) {
                newItem.fileName = matchOld.fileName;
                newItem.fileType = matchOld.fileType;
                if (matchOld.fileCategory) newItem.fileCategory = matchOld.fileCategory;
                newItem.promptText = `[${matchOld.fileType}] ${matchOld.fileName}`;
                newItem.displayText = matchOld.fileName;
                newItem.isDefaultName = false;
                attachmentCache.set(cacheKey, {
                  fileName: matchOld.fileName,
                  fileType: matchOld.fileType,
                  fileCategory: matchOld.fileCategory
                });
              }
            }
          }
        });
      }

      let isDifferent = false;
      if (!oldData || newData.length !== oldData.length) {
        isDifferent = true;
      } else {
        for (let i = 0; i < newData.length; i++) {
          if (newData[i].promptText !== oldData[i].promptText || 
              newData[i].turnElementId !== oldData[i].turnElementId ||
              newData[i].turnBadge !== oldData[i].turnBadge ||
              newData[i].fileName !== oldData[i].fileName ||
              newData[i].isDefaultName !== oldData[i].isDefaultName) {
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

      // Schedule asynchronous DOM-ready enrichment
      setTimeout(enrichCatalogAttachmentNames, 250);
      setTimeout(enrichCatalogAttachmentNames, 800);
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
    let enrichmentTimer = null;
    const observer = new MutationObserver((mutations) => {
      let shouldValidate = false;
      let shouldEnrich = false;
      for (let m = 0; m < mutations.length; m++) {
        const mutation = mutations[m];
        if (mutation.type === 'childList') {
          if (mutation.removedNodes && mutation.removedNodes.length > 0) {
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
          if (mutation.addedNodes && mutation.addedNodes.length > 0) {
            for (let i = 0; i < mutation.addedNodes.length; i++) {
              const node = mutation.addedNodes[i];
              if (node.nodeType === Node.ELEMENT_NODE) {
                const tag = node.tagName.toLowerCase();
                if (tag === 'img' || tag === 'ms-image-chunk' || tag === 'ms-chat-turn' || tag === 'ms-prompt-chunk') {
                  shouldEnrich = true;
                  break;
                } else if (node.querySelector && node.querySelector('img, ms-image-chunk')) {
                  shouldEnrich = true;
                  break;
                }
              }
            }
          }
        }
        if (shouldValidate && shouldEnrich) break;
      }
      if (shouldValidate) {
        clearTimeout(validationTimer);
        validationTimer = setTimeout(validateCatalogData, 100);
      }
      if (shouldEnrich) {
        clearTimeout(enrichmentTimer);
        enrichmentTimer = setTimeout(enrichCatalogAttachmentNames, 150);
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
  let navigationClearTimer = null;
  let navigationSafetyTimer = null;
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

  // Extract clean normalized prompt text from a chat turn element, stripping token noise
  function getCleanPromptText(turnEl) {
    if (!turnEl) return '';
    const container = turnEl.querySelector(Utils.SELECTORS.query.chatTurnContainer) || turnEl;
    let text = (container.textContent || '').replace(/\s+/g, ' ').trim();
    // Strip token statistics like "7,281 tokens"
    text = text.replace(/[\d,.]+[kKmM]?\s*tokens?/gi, '').trim();
    return text;
  }

  // Infer prompt DOM index corresponding to a rendered DOM turn
  function inferCatalogIndex(turnEl, catalogData) {
    if (!turnEl || !catalogData || catalogData.length === 0) return -1;

    // 1. Stamped DOM index attribute
    const stamped = turnEl.getAttribute('data-enhancer-dom-index');
    if (stamped !== null) {
      const parsed = parseInt(stamped, 10);
      if (!isNaN(parsed)) return parsed;
    }

    const text = getCleanPromptText(turnEl);
    if (!text) return -1;

    for (let i = 0; i < catalogData.length; i++) {
      const item = catalogData[i];
      if (item.pureText && (text.includes(item.pureText) || item.pureText.includes(text))) {
        return item.targetDomIndex !== undefined ? item.targetDomIndex : i;
      }
      if (item.fileName && text.includes(item.fileName)) {
        return item.targetDomIndex !== undefined ? item.targetDomIndex : i;
      }
    }
    return -1;
  }

  // Locate the target DOM ms-chat-turn element for a given catalog item
  function findTargetElement(catalogItem) {
    if (!catalogItem) return null;

    const targetDomIndex = catalogItem.targetDomIndex !== undefined ? catalogItem.targetDomIndex : catalogItem.roundIndex;

    // Tier 1: Direct stamped DOM index attribute or element ID match
    if (targetDomIndex !== undefined) {
      const stampedEl = document.querySelector(`ms-chat-turn[data-enhancer-dom-index="${targetDomIndex}"]`);
      if (stampedEl) return stampedEl;
    }

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

    const totalUserChunks = catalogItem.totalUserChunks || userTurns.length;

    // Stamp user turns with their DOM index if count matches total chunks
    if (userTurns.length >= totalUserChunks) {
      userTurns.forEach((u, idx) => {
        if (!u.element.hasAttribute('data-enhancer-dom-index')) {
          u.element.setAttribute('data-enhancer-dom-index', String(idx));
        }
      });
    }

    const pureText = (catalogItem.pureText || '').trim();
    const fileName = (catalogItem.fileName || '').trim();

    // Tier 2: Exact full text or filename match (Strict)
    if (pureText || fileName) {
      const exactMatches = [];
      userTurns.forEach((u) => {
        const tText = getCleanPromptText(u.element);
        if (pureText && tText === pureText) {
          exactMatches.push(u.element);
        } else if (fileName && tText.includes(fileName)) {
          exactMatches.push(u.element);
        }
      });

      if (exactMatches.length === 1) {
        return exactMatches[0];
      } else if (exactMatches.length > 1) {
        let best = exactMatches[0];
        let minDiff = Infinity;
        for (const el of exactMatches) {
          const idx = userTurns.findIndex(u => u.element === el);
          const diff = Math.abs(idx - (targetDomIndex || 0));
          if (diff < minDiff) {
            minDiff = diff;
            best = el;
          }
        }
        return best;
      }

      // Tier 3: Substring / Prefix match (Requires minimum length >= 6 to prevent short word false positives)
      if (pureText && pureText.length >= 6) {
        const sample = pureText.slice(0, 40);
        const prefixMatches = userTurns.filter((u) => {
          const tText = getCleanPromptText(u.element);
          if (!tText || tText.length < 6) return false;
          return tText.startsWith(sample) || sample.startsWith(tText) || tText.includes(pureText) || pureText.includes(tText);
        }).map(u => u.element);

        if (prefixMatches.length === 1) {
          return prefixMatches[0];
        } else if (prefixMatches.length > 1) {
          let best = prefixMatches[0];
          let minDiff = Infinity;
          for (const el of prefixMatches) {
            const idx = userTurns.findIndex(u => u.element === el);
            const diff = Math.abs(idx - (targetDomIndex || 0));
            if (diff < minDiff) {
              minDiff = diff;
              best = el;
            }
          }
          return best;
        }
      }
    }

    // Tier 4: Direct 1:1 physical index fallback if all user chunks are rendered in DOM
    if (targetDomIndex !== undefined && targetDomIndex >= 0 && targetDomIndex < userTurns.length) {
      if (userTurns.length >= totalUserChunks) {
        return userTurns[targetDomIndex].element;
      }
    }

    return null;
  }

  function navigateToPrompt(target) {
    try {
      const catalogData = State.getCatalogData();
      if (!catalogData || catalogData.length === 0) return;

      let catalogItem = null;
      if (target && typeof target === 'object') {
        catalogItem = target;
      } else {
        catalogItem = catalogData.find(item =>
          item.turnIndex === target ||
          item.roundIndex === target ||
          item.turnCounter === target
        );
      }
      if (!catalogItem) return;

      const scroller = getChatScrollContainer();
      if (!scroller) return;

      // 1. Cancel active animation and previous timers
      if (activeNavigationCancel) {
        activeNavigationCancel();
        activeNavigationCancel = null;
      }
      if (navigationClearTimer) {
        clearTimeout(navigationClearTimer);
        navigationClearTimer = null;
      }
      if (navigationSafetyTimer) {
        clearTimeout(navigationSafetyTimer);
        navigationSafetyTimer = null;
      }

      isNavigating = true;
      const clickTime = performance.now();
      const minFeedbackDurationMs = 380; // Ensure visible feedback even for short distances

      // Global safety timer: ensure navigation and flight highlight ALWAYS terminates within 1000ms
      navigationSafetyTimer = setTimeout(() => {
        if (isNavigating) {
          cleanup(false);
        }
      }, 1000);

      // 2. Update active highlight in the sidebar list immediately
      const list = document.getElementById(Utils.SELECTORS.id.catalogListContainer);
      if (list) {
        const allItems = list.querySelectorAll('.catalog-list-item');
        allItems.forEach((el) => {
          const idx = el.getAttribute('data-turn-index');
          const counter = el.getAttribute('data-turn-counter');
          const elSub = el.getAttribute('data-sub-index') || '';
          const targetSub = catalogItem.subIndex !== undefined && catalogItem.subIndex !== null ? String(catalogItem.subIndex) : '';

          const matchesCounter = (catalogItem.turnCounter !== undefined && counter === String(catalogItem.turnCounter));
          const matchesIdx = (idx !== null && parseInt(idx, 10) === catalogItem.turnIndex);
          const matchesTurn = matchesCounter || matchesIdx;

          const isExactTarget = matchesTurn && elSub === targetSub;
          const isTurnRoot = matchesTurn && (el.getAttribute('data-is-turn-root') === 'true' || elSub === '');

          // Active state: target item and its turn root badge are active
          if (isExactTarget || isTurnRoot) {
            el.classList.add('catalog-item-selected');
          } else {
            el.classList.remove('catalog-item-selected');
          }

          // Navigating flight background: ONLY the exact clicked row
          if (isExactTarget) {
            el.classList.add('catalog-item-navigating');
          } else {
            el.classList.remove('catalog-item-navigating');
          }
        });
      }

      // Helper to fade away temporary navigation row background after minimum feedback time
      const clearNavigatingState = (immediate = false) => {
        const doClear = () => {
          if (list) {
            const navItems = list.querySelectorAll('.catalog-list-item.catalog-item-navigating');
            navItems.forEach((el) => el.classList.remove('catalog-item-navigating'));
          }
          navigationClearTimer = null;
        };

        if (navigationClearTimer) {
          clearTimeout(navigationClearTimer);
          navigationClearTimer = null;
        }

        if (immediate) {
          doClear();
        } else {
          const elapsed = performance.now() - clickTime;
          const remaining = Math.max(0, minFeedbackDurationMs - elapsed);
          if (remaining > 0) {
            navigationClearTimer = setTimeout(doClear, remaining);
          } else {
            doClear();
          }
        }
      };

      // 3. User interrupt handler: abort auto-navigation on manual interaction
      const onUserInterrupt = (e) => {
        if (e.target && e.target.closest && e.target.closest('#' + Utils.SELECTORS.id.catalogPanel)) {
          return;
        }
        cleanup(true);
      };

      const cleanup = (immediate = false) => {
        if (navigationSafetyTimer) {
          clearTimeout(navigationSafetyTimer);
          navigationSafetyTimer = null;
        }
        clearNavigatingState(immediate);
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

      // Resolve sub-element within card for image or file attachments
      const resolveSubTarget = (cardEl, item) => {
        if (!cardEl || !item) return cardEl;
        if (item.type === 'image') {
          const imgs = Array.from(cardEl.querySelectorAll('img')).filter((img) => {
            if (img.classList.contains('user-icon') || img.classList.contains('avatar') || (img.src && img.src.includes('googleusercontent.com/a/'))) {
              return false;
            }
            return true;
          });
          if (imgs.length > 0) {
            const idx = item.subIndex || 0;
            return imgs[idx] || imgs[0] || cardEl;
          }
        }
        return cardEl;
      };

      // Precision landing helper when target DOM element is available
      const landOnTarget = (targetEl) => {
        if (!targetEl) {
          cleanup(false);
          return;
        }

        const subTarget = resolveSubTarget(targetEl, catalogItem);
        const targetRect = subTarget.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        const isAttachment = catalogItem.type === 'image' || catalogItem.type === 'file';
        const desiredTop = isAttachment
          ? Math.max(80, Math.round((scrollerRect.height - targetRect.height) / 2))
          : 80;

        const delta = (targetRect.top - scrollerRect.top) - desiredTop;
        const targetScrollTop = scroller.scrollTop + delta;
        const totalDistance = Math.abs(delta);

        // Landing Stabilization Anchor: dynamically pins the target to desiredTop
        // for up to 350ms, actively absorbing any layout shifts from async reflow, KaTeX or image loading.
        const anchorLand = () => {
          const anchorStartTime = performance.now();
          const anchorWindowMs = 350;
          let stableFrames = 0;
          let anchorRafId = null;

          const anchorTick = () => {
            if (!isNavigating) return;

            const freshCard = findTargetElement(catalogItem) || targetEl;
            if (!freshCard) {
              cleanup(false);
              return;
            }
            const freshTarget = resolveSubTarget(freshCard, catalogItem);
            const freshRect = freshTarget.getBoundingClientRect();
            const currentScrollerRect = scroller.getBoundingClientRect();
            const settleDelta = Math.round((freshRect.top - currentScrollerRect.top) - desiredTop);

            if (Math.abs(settleDelta) > 2) {
              const prevScroll = scroller.scrollTop;
              scroller.scrollTop += settleDelta;
              // If scroll did not move (hit scroll boundary top or bottom), treat as stable
              if (scroller.scrollTop === prevScroll) {
                stableFrames++;
              } else {
                stableFrames = 0;
              }
            } else {
              stableFrames++;
            }

            const elapsed = performance.now() - anchorStartTime;
            if (elapsed < anchorWindowMs && stableFrames < 5) {
              anchorRafId = requestAnimationFrame(anchorTick);
            } else {
              cleanup(false);
            }
          };

          anchorRafId = requestAnimationFrame(anchorTick);
          activeNavigationCancel = () => {
            if (anchorRafId !== null) {
              cancelAnimationFrame(anchorRafId);
              anchorRafId = null;
            }
          };
        };

        // Self-adaptive high-speed smooth cruise (capped at ~460ms so it never feels slow even across 50,000+ pixels)
        // Eliminates violent instant jumps (preJumpTop) which cause browser reflow thrashing.
        const duration = Math.min(460, Math.max(260, Math.round(200 + Math.sqrt(totalDistance) * 3.6)));

        activeNavigationCancel = animateScrollTo(scroller, targetScrollTop, duration, () => {
          anchorLand();
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
        const firstVisibleDomIdx = inferCatalogIndex(userTurns[0], catalogData);
        const targetDom = catalogItem.targetDomIndex !== undefined ? catalogItem.targetDomIndex : (catalogItem.roundIndex || 0);
        if (firstVisibleDomIdx !== -1) {
          scrollUp = targetDom < firstVisibleDomIdx;
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
              cleanup(false);
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
      if (typeof cleanup === 'function') {
        cleanup(true);
      }
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

      const duration = Math.min(460, Math.max(260, Math.round(200 + Math.sqrt(totalDistance) * 3.6)));
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

  function updateActiveTurnHighlight(turnIndex, turnCounter, subIndex) {
    const list = document.getElementById(Utils.SELECTORS.id.catalogListContainer);
    if (!list) return;

    const items = list.querySelectorAll('.catalog-list-item');
    items.forEach((item) => {
      const idx = item.getAttribute('data-turn-index');
      const counter = item.getAttribute('data-turn-counter');
      const itemSub = item.getAttribute('data-sub-index');
      const matchesCounter = (turnCounter !== undefined && counter === String(turnCounter));
      const matchesIdx = (idx !== null && parseInt(idx, 10) === turnIndex);

      if (matchesCounter || matchesIdx) {
        if (subIndex !== undefined && subIndex !== null && itemSub !== null) {
          if (String(subIndex) === itemSub) {
            item.classList.add('catalog-item-selected');
          } else {
            item.classList.remove('catalog-item-selected');
          }
        } else {
          item.classList.add('catalog-item-selected');
        }
      } else {
        item.classList.remove('catalog-item-selected');
      }
      // Ensure temporary flight highlight is cleared during viewport scroll updates
      item.classList.remove('catalog-item-navigating');
    });
  }

  function updateActiveTurnByViewport() {
    if (isNavigating) return;

    const scroller = getChatScrollContainer();
    if (!scroller) return;

    const chatTurns = Array.from(document.querySelectorAll(Utils.SELECTORS.query.chatTurn));
    const userTurns = chatTurns.filter((turn) => {
      const container = turn.querySelector(Utils.SELECTORS.query.chatTurnContainer);
      return container && container.classList.contains(Utils.SELECTORS.class.userTurn);
    });

    if (userTurns.length === 0) return;

    const scrollerRect = scroller.getBoundingClientRect();
    let activeTurnEl = null;
    let activeTurnDomIndex = 0;

    for (let i = 0; i < userTurns.length; i++) {
      const rect = userTurns[i].getBoundingClientRect();
      if (rect.top <= scrollerRect.top + 250) {
        activeTurnEl = userTurns[i];
        activeTurnDomIndex = i;
      } else {
        break;
      }
    }

    if (!activeTurnEl && userTurns.length > 0) {
      activeTurnEl = userTurns[0];
      activeTurnDomIndex = 0;
    }
    if (!activeTurnEl) return;

    const catalogData = State.getCatalogData();
    if (!catalogData || catalogData.length === 0) return;

    // 1. Try stamped DOM index or active DOM turn index
    let domIndex = activeTurnDomIndex;
    const stamped = activeTurnEl.getAttribute('data-enhancer-dom-index');
    if (stamped !== null) {
      const parsed = parseInt(stamped, 10);
      if (!isNaN(parsed)) {
        domIndex = parsed;
      }
    }

    // Find the catalog item whose round covers this domIndex (startDomIndex <= domIndex <= endDomIndex)
    let found = catalogData.find(item =>
      item.startDomIndex !== undefined &&
      item.endDomIndex !== undefined &&
      item.startDomIndex <= domIndex &&
      domIndex <= item.endDomIndex &&
      item.isTurnRoot
    );

    if (!found) {
      found = catalogData.find(item => item.targetDomIndex === domIndex);
    }

    // 2. Fallback content matching
    if (!found) {
      const cleanText = getCleanPromptText(activeTurnEl);
      if (cleanText) {
        found = catalogData.find(item =>
          (item.pureText && cleanText.includes(item.pureText)) ||
          (item.fileName && cleanText.includes(item.fileName))
        );
      }
    }

    if (found) {
      updateActiveTurnHighlight(found.turnIndex, found.turnCounter);
    }
  }

  function setupScrollSpy() {
    if (scrollSpyBound) return;
    const scroller = getChatScrollContainer();
    if (!scroller) return;

    scrollSpyBound = true;
    let scrollTimer = null;
    scroller.addEventListener('scroll', () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        updateActiveTurnByViewport();
        enrichCatalogAttachmentNames();
      }, 100);
    }, { passive: true });
  }

  function createCatalogPanel() {
    const panel = document.createElement('ms-right-side-panel');
    panel.id = Utils.SELECTORS.id.catalogPanel;

    const contentContainer = document.createElement('div');
    contentContainer.className = 'content-container';

    const header = document.createElement('div');
    header.className = 'catalog-header header';
    header.innerHTML = `
      <div class="catalog-title-group">
        <span class="catalog-title">${chrome.i18n.getMessage('catalogHeader')}</span>
        <span id="catalog-toc-badge" class="catalog-toc-badge is-hidden">0</span>
      </div>
      <button class="catalog-close-btn" title="${chrome.i18n.getMessage('closeCatalogTitle') || 'Close'}" aria-label="${chrome.i18n.getMessage('closeCatalogTitle') || 'Close'}">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
        </svg>
      </button>
    `;

    const closeBtn = header.querySelector('.catalog-close-btn');
    closeBtn.addEventListener('click', () => toggleCatalog(false));

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

  function createPromptListItem(catalogItem, hasSubItems) {
    const listItem = document.createElement('div');
    listItem.className = 'catalog-list-item';
    const isAttachment = catalogItem.type !== 'text';
    if (isAttachment) {
      listItem.classList.add('catalog-item-sub');
    }
    if (hasSubItems) {
      listItem.classList.add('has-sub-items');
    }
    listItem.setAttribute('data-turn-index', catalogItem.turnIndex);
    if (catalogItem.turnCounter !== undefined) {
      listItem.setAttribute('data-turn-counter', catalogItem.turnCounter);
    }
    if (catalogItem.subIndex !== undefined) {
      listItem.setAttribute('data-sub-index', String(catalogItem.subIndex));
    }
    listItem.setAttribute('role', 'button');
    listItem.setAttribute('tabindex', '0');
    if (catalogItem.isTurnRoot) {
      listItem.setAttribute('data-is-turn-root', 'true');
      listItem.classList.add('catalog-item-turn-root');
    }

    // 1. Leading Slot: Turn Number Badge (for turn root) or blank indentation spacer (for attachments)
    const leading = document.createElement('div');
    leading.className = 'catalog-item-leading';
    if (catalogItem.isTurnRoot && catalogItem.turnBadge) {
      leading.innerHTML = `<span class="catalog-turn-badge">${catalogItem.turnBadge}</span>`;
    }
    listItem.appendChild(leading);

    // 2. Text Content Area: Prompt text or attachment with icon aligned with prompt text
    const content = document.createElement('div');
    content.className = 'catalog-item-content';

    const textSpan = document.createElement('span');
    textSpan.className = 'catalog-prompt-text';

    if (catalogItem.type === 'text') {
      textSpan.textContent = catalogItem.promptText;
      textSpan.title = catalogItem.promptText;
    } else {
      const category = catalogItem.fileCategory || 'file';
      const fileType = catalogItem.fileType || 'File';
      const fileName = catalogItem.fileName || fileType;

      const iconSpan = document.createElement('span');
      iconSpan.className = `catalog-inline-icon catalog-icon-${category}`;
      iconSpan.innerHTML = getAttachmentIconSvg(category);
      textSpan.appendChild(iconSpan);

      const tagSpan = document.createElement('span');
      tagSpan.className = `catalog-type-tag catalog-type-tag-${category}`;
      tagSpan.textContent = `[${fileType}]`;
      textSpan.appendChild(tagSpan);

      textSpan.appendChild(document.createTextNode(' ' + fileName));
      textSpan.title = `[${fileType}] ${fileName}`;
    }

    content.appendChild(textSpan);
    listItem.appendChild(content);

    listItem.addEventListener('click', function () {
      navigateToPrompt(catalogItem);
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
    
    // Update header turn count badge
    const badge = document.getElementById('catalog-toc-badge');
    if (badge) {
      if (catalogData && catalogData.length > 0) {
        const uniqueTurns = new Set(catalogData.map(item => item.turnCounter || item.turnIndex)).size;
        badge.textContent = String(uniqueTurns);
        badge.classList.remove('is-hidden');
      } else {
        badge.textContent = '0';
        badge.classList.add('is-hidden');
      }
    }

    listContainer.innerHTML = '';

    if (!catalogData || catalogData.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'catalog-empty-state';
      emptyState.innerHTML = `
        <div class="catalog-empty-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/>
          </svg>
        </div>
        <div class="catalog-empty-title">${chrome.i18n.getMessage('catalogEmptyTitle') || 'No conversation yet'}</div>
        <div class="catalog-empty-desc">${chrome.i18n.getMessage('catalogEmptyDesc') || 'Prompts will appear here automatically'}</div>
      `;
      listContainer.appendChild(emptyState);
      return;
    }

    catalogData.forEach((catalogItem, idx) => {
      const nextItem = catalogData[idx + 1];
      const hasSubItems = Boolean(catalogItem.isTurnRoot && nextItem && !nextItem.isTurnRoot);
      const listItem = createPromptListItem(catalogItem, hasSubItems);
      listContainer.appendChild(listItem);
    });

    updateActiveTurnByViewport();
  }

  function toggleCatalog(forceShow) {
    const catalogPanel = document.getElementById(Utils.SELECTORS.id.catalogPanel);
    const catalogButton = document.getElementById(Utils.SELECTORS.id.catalogButton);
    if (!catalogPanel || !catalogButton) return;

    const isVisible = catalogPanel.classList.contains(Utils.SELECTORS.classExt.panelVisible);
    const shouldShow = forceShow !== undefined ? forceShow : !isVisible;

    if (shouldShow === isVisible) return;

    if (shouldShow) {
      setupScrollSpy();
      enrichCatalogAttachmentNames();
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
    enrichCatalogAttachmentNames,
    clearAttachmentCache,
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
