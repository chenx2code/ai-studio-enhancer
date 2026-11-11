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

  const boundScrollers = new WeakSet();
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

  // Query all currently rendered user chat turn DOM elements
  function getUserTurnElements() {
    const result = [];
    const chatTurns = document.querySelectorAll(Utils.SELECTORS.query.chatTurn);
    for (const chatTurn of chatTurns) {
      const container = chatTurn.querySelector(Utils.SELECTORS.query.chatTurnContainer);
      if (container && container.classList.contains(Utils.SELECTORS.class.userTurn)) {
        result.push(chatTurn);
      }
    }
    return result;
  }

  // Extract visible prompt text from a chat turn element while skipping UI buttons/icons and token counters
  function getCleanPromptText(turnEl) {
    if (!turnEl) return '';
    const container = turnEl.querySelector(Utils.SELECTORS.query.chatTurnContainer) || turnEl;

    const isIgnoredUiNode = (node) => {
      let cur = node.parentElement;
      while (cur && cur !== container) {
        const tag = cur.tagName;
        if (tag === 'BUTTON' || tag === 'MAT-ICON' || tag === 'SVG' || tag === 'STYLE' || tag === 'SCRIPT' || tag === 'NOSCRIPT') {
          return true;
        }
        if (cur.getAttribute && cur.getAttribute('aria-hidden') === 'true') {
          return true;
        }
        if (cur.classList && (
          cur.classList.contains('material-symbols-outlined') ||
          cur.classList.contains('material-icons') ||
          cur.classList.contains('material-symbols-rounded') ||
          cur.classList.contains('mat-icon') ||
          cur.classList.contains('cdk-visually-hidden') ||
          cur.classList.contains('sr-only')
        )) {
          return true;
        }
        cur = cur.parentElement;
      }
      return false;
    };

    let rawText = '';
    if (typeof document.createTreeWalker === 'function') {
      const parts = [];
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
      let textNode = walker.nextNode();
      while (textNode) {
        if (!isIgnoredUiNode(textNode)) {
          const val = textNode.nodeValue;
          if (val && val.trim()) {
            parts.push(val);
          }
        }
        textNode = walker.nextNode();
      }
      rawText = parts.join(' ');
    } else {
      rawText = container.textContent || '';
    }

    let text = rawText.replace(/\s+/g, ' ').trim();
    // Strip token statistics like "7,281 tokens"
    text = text.replace(/[\d,.]+[kKmM]?\s*tokens?/gi, '').trim();
    return text;
  }

  // Normalize API Markdown text and rendered DOM text into a consistent lowercase form for comparison
  function normalizeTextForMatch(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/^\s{0,3}(?:```+|~~~+)[^\n]*$/gm, ' ')
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^\s{0,3}(?:>+\s*|#{1,6}\s+|[-*+]\s+|\d+\.\s+)/gm, '')
      .replace(/[`*~]+/g, '')
      .replace(/(^|\s)_+/g, '$1')
      .replace(/_+(\s|$)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function compactTextForMatch(normText) {
    return normText ? normText.replace(/\s+/g, '') : '';
  }

  // Compare DOM text and API prompt text resiliently across Markdown formatting and line breaks
  function textsLooselyMatch(domText, apiText) {
    const dNorm = normalizeTextForMatch(domText);
    const aNorm = normalizeTextForMatch(apiText);
    if (!dNorm || !aNorm) return false;
    if (dNorm === aNorm) return true;

    const dComp = compactTextForMatch(dNorm);
    const aComp = compactTextForMatch(aNorm);
    if (!dComp || !aComp) return false;
    if (dComp === aComp) return true;

    // Require minimum normalized length >= 6 before substring/prefix matching to avoid short-token collisions
    if (aComp.length >= 6 && dComp.length >= 6) {
      if (dComp.includes(aComp) || aComp.includes(dComp)) return true;
      const prefixLen = Math.min(32, aComp.length, dComp.length);
      if (prefixLen >= 10 && dComp.slice(0, prefixLen) === aComp.slice(0, prefixLen)) return true;
    }
    return false;
  }

  function getTurnContentImages(turnEl) {
    if (!turnEl) return [];
    return Array.from(turnEl.querySelectorAll('img')).filter((img) => {
      if (img.classList && (img.classList.contains('user-icon') || img.classList.contains('avatar'))) return false;
      if (img.src && (img.src.includes('googleusercontent.com/a/') || img.src.includes('watermark.png'))) return false;
      if (img.alt && img.alt.trim().toLowerCase() === 'thinking') return false;
      return true;
    });
  }

  function turnHasAttachment(turnEl) {
    if (!turnEl) return false;
    if (getTurnContentImages(turnEl).length > 0) return true;
    return Boolean(
      turnEl.querySelector(
        'ms-file-chunk, ms-media-chunk, ms-image-chunk, ms-youtube-chunk, ms-video-chunk, ms-audio-chunk, ms-drive-file, [class*="file"], [class*="attachment"], [data-test-id*="file"]'
      )
    );
  }

  // Check whether a turn element contains an image matching a real (non-placeholder) filename
  function matchImageInTurn(turnEl, targetName) {
    if (!turnEl || !targetName) return false;
    const cleanTarget = targetName.trim().toLowerCase();
    if (!cleanTarget) return false;
    const imgs = getTurnContentImages(turnEl);
    for (const img of imgs) {
      const alt = (img.alt || '').trim().toLowerCase();
      if (alt && (alt === cleanTarget || alt.includes(cleanTarget) || cleanTarget.includes(alt))) return true;
      if (img.src && !img.src.startsWith('data:') && img.src.toLowerCase().includes(cleanTarget)) return true;
    }
    return false;
  }

  function matchAttachmentInTurn(turnEl, fileName) {
    if (!turnEl || !fileName) return false;
    if (matchImageInTurn(turnEl, fileName)) return true;
    // File chips/cards in DOM always mark the turn as containing an attachment
    if (!turnHasAttachment(turnEl)) return false;
    const normTarget = normalizeTextForMatch(fileName);
    if (!normTarget) return false;
    const normTurnText = normalizeTextForMatch(getCleanPromptText(turnEl));
    if (normTurnText && normTurnText.includes(normTarget)) return true;
    const compTarget = compactTextForMatch(normTarget);
    const compTurn = compactTextForMatch(normTurnText);
    return Boolean(compTarget && compTurn && compTurn.includes(compTarget));
  }

  function extractRoundsSummary(catalogData) {
    const byRound = new Map();
    if (!Array.isArray(catalogData)) return [];
    catalogData.forEach((item) => {
      const rIdx = item.roundIndex;
      if (rIdx === undefined || rIdx === null) return;
      if (!byRound.has(rIdx)) {
        byRound.set(rIdx, {
          roundIndex: rIdx,
          fullText: item.pureText || '',
          hasAttachments: item.type !== 'text',
          chunkStartDomIndex: item.chunkStartDomIndex !== undefined ? item.chunkStartDomIndex : (item.startDomIndex !== undefined ? item.startDomIndex : rIdx),
          chunkEndDomIndex: item.chunkEndDomIndex !== undefined ? item.chunkEndDomIndex : (item.endDomIndex !== undefined ? item.endDomIndex : rIdx),
          chunkTextDomIndex: item.chunkTextDomIndex !== undefined ? item.chunkTextDomIndex : (item.chunkStartDomIndex !== undefined ? item.chunkStartDomIndex : rIdx),
          fileNames: (!item.isDefaultName && item.fileName) ? [item.fileName] : []
        });
      } else {
        const entry = byRound.get(rIdx);
        if (!entry.fullText && item.pureText) entry.fullText = item.pureText;
        if (item.chunkTextDomIndex !== undefined && item.type === 'text') {
          entry.chunkTextDomIndex = item.chunkTextDomIndex;
        }
        if (item.type !== 'text') entry.hasAttachments = true;
        if (!item.isDefaultName && item.fileName && !entry.fileNames.includes(item.fileName)) {
          entry.fileNames.push(item.fileName);
        }
      }
    });
    return Array.from(byRound.values()).sort((a, b) => a.roundIndex - b.roundIndex);
  }

  // Detect whether Google AI Studio currently renders 1 ms-chat-turn per prompt round ('round')
  // or 1 ms-chat-turn per user chunk ('chunk'), without misclassifying virtualized slices
  function detectDomLayoutMode(userTurnElements, roundsSummary, totalUserChunks) {
    const totalRounds = roundsSummary.length;
    if (totalRounds === 0) return { mode: null, totalDomTurns: 0 };

    if (!totalUserChunks || totalUserChunks <= totalRounds) {
      return { mode: 'round', totalDomTurns: totalRounds };
    }

    if (userTurnElements.length === totalUserChunks) {
      return { mode: 'chunk', totalDomTurns: totalUserChunks };
    }

    if (userTurnElements.length > totalRounds) {
      return { mode: 'chunk', totalDomTurns: totalUserChunks };
    }

    if (userTurnElements.length === totalRounds) {
      // Guard against coincidental virtual-scroll slice of chunk mode matching totalRounds count.
      // Prioritize multi-chunk rounds containing both text and attachments, plus first/mid/last rounds.
      const probeSet = new Set([0, Math.floor(totalRounds / 2), totalRounds - 1]);
      for (const round of roundsSummary) {
        if (probeSet.size >= 6) break;
        if (round.hasAttachments && round.fullText) {
          probeSet.add(round.roundIndex);
        }
      }
      for (const round of roundsSummary) {
        if (probeSet.size >= 6) break;
        if (round.fullText) {
          probeSet.add(round.roundIndex);
        }
      }

      let roundModeConsistent = true;
      let verifiedProbes = 0;

      for (const rIdx of probeSet) {
        const round = roundsSummary[rIdx];
        const el = userTurnElements[rIdx];
        if (!round || !el) continue;

        const normRoundText = compactTextForMatch(normalizeTextForMatch(round.fullText));
        if (round.fullText && normRoundText.length > 0) {
          const domText = getCleanPromptText(el);
          const normDomText = compactTextForMatch(normalizeTextForMatch(domText));
          const textMatches = normRoundText.length >= 6
            ? textsLooselyMatch(domText, round.fullText)
            : normDomText === normRoundText;
          if (!textMatches) {
            roundModeConsistent = false;
            break;
          }
          verifiedProbes++;
        }

        if (round.hasAttachments) {
          if (!turnHasAttachment(el)) {
            roundModeConsistent = false;
            break;
          }
          verifiedProbes++;
        }
      }

      if (!roundModeConsistent) {
        return { mode: 'chunk', totalDomTurns: totalUserChunks };
      }
      if (verifiedProbes > 0) {
        return { mode: 'round', totalDomTurns: totalRounds };
      }
      return { mode: null, totalDomTurns: totalUserChunks };
    }

    // Partially rendered DOM (virtualized): inspect any visible multi-chunk round with both text and attachments
    for (const round of roundsSummary) {
      if (round.hasAttachments && round.fullText && compactTextForMatch(normalizeTextForMatch(round.fullText)).length >= 6) {
        const matchedEls = userTurnElements.filter(el => textsLooselyMatch(getCleanPromptText(el), round.fullText));
        if (matchedEls.length === 1) {
          if (turnHasAttachment(matchedEls[0])) {
            return { mode: 'round', totalDomTurns: totalRounds };
          }
          return { mode: 'chunk', totalDomTurns: totalUserChunks };
        }
      }
    }

    const existingStamped = document.querySelector('ms-chat-turn[data-enhancer-dom-mode]');
    if (existingStamped) {
      const m = existingStamped.getAttribute('data-enhancer-dom-mode');
      if (m === 'round') return { mode: 'round', totalDomTurns: totalRounds };
      if (m === 'chunk') return { mode: 'chunk', totalDomTurns: totalUserChunks };
    }

    return { mode: null, totalDomTurns: totalUserChunks };
  }

  function extractUserPrompts(conversationTurns) {
    if (!Array.isArray(conversationTurns)) {
      return [];
    }

    // 1. Query all currently rendered user chat turn DOM elements
    const userTurnElements = getUserTurnElements();

    // 2. Group consecutive user chunks in conversationTurns into prompt rounds
    const userPromptRounds = [];
    let currentRound = null;
    let userChunkCounter = 0;

    conversationTurns.forEach((turn, index) => {
      if (!Array.isArray(turn) || turn.length < 9) return;
      const role = turn[8];
      if (role === 'user') {
        const domIndex = userChunkCounter;
        userChunkCounter++;

        if (!currentRound) {
          currentRound = {
            roundIndex: userPromptRounds.length,
            primaryTurnIndex: index,
            startDomIndex: domIndex,
            textDomIndex: domIndex,
            hasTextChunk: false,
            hasAttachmentChunk: false,
            chunks: []
          };
          userPromptRounds.push(currentRound);
        }
        const txt = (turn[0] || '').trim();
        if (txt && !currentRound.hasTextChunk) {
          currentRound.textDomIndex = domIndex;
          currentRound.hasTextChunk = true;
        }
        const hasApiAtt =
          (Array.isArray(turn[1]) && turn[1].length > 0) ||
          (Array.isArray(turn[3]) && turn[3].length > 0) ||
          (Array.isArray(turn[12]) && turn[12].length > 0) ||
          (Array.isArray(turn[13]) && turn[13].length > 0) ||
          (Array.isArray(turn[23]) && turn[23].length > 0);
        if (hasApiAtt) {
          currentRound.hasAttachmentChunk = true;
        }

        currentRound.chunks.push({ turn, index, domIndex });
        currentRound.endDomIndex = domIndex;
      } else {
        // Model turn ends the current user prompt round
        currentRound = null;
      }
    });

    const totalUserChunks = userChunkCounter;
    const totalRounds = userPromptRounds.length;
    const roundsSummary = userPromptRounds.map((round, roundIdx) => {
      const textParts = [];
      round.chunks.forEach(({ turn }) => {
        const t = (turn[0] || '').trim();
        if (t) textParts.push(t);
      });
      return {
        roundIndex: roundIdx,
        fullText: textParts.join(' '),
        hasAttachments: round.hasAttachmentChunk || round.chunks.length > 1,
        chunkStartDomIndex: round.startDomIndex,
        chunkEndDomIndex: round.endDomIndex
      };
    });

    const detected = detectDomLayoutMode(userTurnElements, roundsSummary, totalUserChunks);
    const effectiveMode = detected.mode || 'chunk';
    const isFullDomPresent = Boolean(detected.mode && detected.totalDomTurns > 0 && userTurnElements.length === detected.totalDomTurns);

    // Only stamp sequential DOM indices when all expected user turns are mounted in DOM
    if (isFullDomPresent) {
      userTurnElements.forEach((el, idx) => {
        el.setAttribute('data-enhancer-dom-index', String(idx));
        el.setAttribute('data-enhancer-dom-mode', effectiveMode);
      });
    }

    const userPrompts = [];
    let turnCounter = 0;

    userPromptRounds.forEach((round, roundIdx) => {
      turnCounter++;
      const badgeStr = turnCounter < 10 ? '0' + turnCounter : String(turnCounter);

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

      // Match DOM elements belonging to this round ONLY when verified complete or uniquely text-matched
      const roundElements = [];
      let turnElement = null;
      if (isFullDomPresent) {
        if (effectiveMode === 'round') {
          if (userTurnElements[roundIdx]) {
            turnElement = userTurnElements[roundIdx];
            roundElements.push({ element: turnElement, domIndex: roundIdx });
          }
        } else {
          for (let d = round.startDomIndex; d <= round.endDomIndex; d++) {
            if (userTurnElements[d]) {
              roundElements.push({ element: userTurnElements[d], domIndex: d });
            }
          }
          turnElement = userTurnElements[round.startDomIndex] || null;
        }
      } else if (fullText && userTurnElements.length > 0 && compactTextForMatch(normalizeTextForMatch(fullText)).length >= 6) {
        const sameTextRoundsCount = roundsSummary.filter(r => r.fullText && textsLooselyMatch(r.fullText, fullText)).length;
        if (sameTextRoundsCount === 1) {
          const textMatches = userTurnElements.filter(el => textsLooselyMatch(getCleanPromptText(el), fullText));
          if (textMatches.length === 1) {
            const matchedEl = textMatches[0];
            if (effectiveMode === 'round' || round.startDomIndex === round.textDomIndex) {
              turnElement = matchedEl;
            }
            roundElements.push({
              element: matchedEl,
              domIndex: effectiveMode === 'round' ? roundIdx : round.textDomIndex
            });
          }
        }
      }
      const turnElementId = turnElement && turnElement.id ? turnElement.id : null;

      // Extract attachments from matched DOM elements (if safely resolved) and API chunks in this round
      const attachments = extractRoundAttachments(round.chunks, roundElements, fullText);

      // Synchronize with attachmentCache: restore known real names or save newly resolved ones
      let imageIdxInRound = 0;
      attachments.forEach((att, attIdx) => {
        if (att.subIndex === undefined && att.type === 'image') {
          att.subIndex = imageIdxInRound++;
        }
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

      const resolvedStartDomIndex = effectiveMode === 'round' ? roundIdx : round.startDomIndex;
      const resolvedEndDomIndex = effectiveMode === 'round' ? roundIdx : round.endDomIndex;

      if (fullText) {
        // A. Round has text: text row is turn root (gets the sequence badge)
        userPrompts.push({
          roundIndex: roundIdx,
          totalRounds: totalRounds,
          totalUserChunks: totalUserChunks,
          domLayoutMode: detected.mode,
          turnCounter: turnCounter,
          turnBadge: badgeStr,
          isTurnRoot: true,
          type: 'text',
          turnIndex: primaryIndex,
          startDomIndex: resolvedStartDomIndex,
          endDomIndex: resolvedEndDomIndex,
          targetDomIndex: resolvedStartDomIndex,
          chunkStartDomIndex: round.startDomIndex,
          chunkEndDomIndex: round.endDomIndex,
          chunkTextDomIndex: round.textDomIndex,
          chunkTargetDomIndex: round.startDomIndex,
          turnElementId: turnElementId,
          promptText: fullText,
          pureText: fullText,
          displayText: fullText,
          truncatedText: Utils.truncateText(fullText, 50),
          role: 'user'
        });

        // Each attachment is indented directly below the prompt text (isTurnRoot: false)
        let imgCounter = 0;
        attachments.forEach((att, attIdx) => {
          const subIndex = att.subIndex !== undefined ? att.subIndex : (att.type === 'image' ? imgCounter++ : attIdx);
          const attChunk = round.chunks.find(c => c.index === att.turnIndex);
          const chunkAttDomIndex = attChunk
            ? attChunk.domIndex
            : ((effectiveMode !== 'round' && att.domIndex !== undefined) ? att.domIndex : round.startDomIndex);
          const attTargetDomIndex = effectiveMode === 'round' ? roundIdx : chunkAttDomIndex;

          userPrompts.push({
            roundIndex: roundIdx,
            totalRounds: totalRounds,
            totalUserChunks: totalUserChunks,
            domLayoutMode: detected.mode,
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
            startDomIndex: resolvedStartDomIndex,
            endDomIndex: resolvedEndDomIndex,
            targetDomIndex: attTargetDomIndex,
            chunkStartDomIndex: round.startDomIndex,
            chunkEndDomIndex: round.endDomIndex,
            chunkTextDomIndex: round.textDomIndex,
            chunkTargetDomIndex: chunkAttDomIndex,
            turnElementId: turnElementId,
            promptText: `[${att.fileType}] ${att.fileName}`,
            displayText: att.fileName,
            subIndex: subIndex,
            role: 'user'
          });
        });
      } else if (attachments.length > 0) {
        // B. Round has NO text, only attachments: first attachment is turn root
        let imgCounter = 0;
        attachments.forEach((att, attIdx) => {
          const isRoot = attIdx === 0;
          const subIndex = att.subIndex !== undefined ? att.subIndex : (att.type === 'image' ? imgCounter++ : attIdx);
          const attChunk = round.chunks.find(c => c.index === att.turnIndex);
          const chunkAttDomIndex = attChunk
            ? attChunk.domIndex
            : ((effectiveMode !== 'round' && att.domIndex !== undefined) ? att.domIndex : round.startDomIndex);
          const attTargetDomIndex = effectiveMode === 'round' ? roundIdx : chunkAttDomIndex;

          userPrompts.push({
            roundIndex: roundIdx,
            totalRounds: totalRounds,
            totalUserChunks: totalUserChunks,
            domLayoutMode: detected.mode,
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
            startDomIndex: resolvedStartDomIndex,
            endDomIndex: resolvedEndDomIndex,
            targetDomIndex: attTargetDomIndex,
            chunkStartDomIndex: round.startDomIndex,
            chunkEndDomIndex: round.endDomIndex,
            chunkTextDomIndex: round.textDomIndex,
            chunkTargetDomIndex: chunkAttDomIndex,
            turnElementId: turnElementId,
            promptText: `[${att.fileType}] ${att.fileName}`,
            displayText: att.fileName,
            subIndex: subIndex,
            role: 'user'
          });
        });
      } else {
        // C. Fallback: empty prompt
        userPrompts.push({
          roundIndex: roundIdx,
          totalRounds: totalRounds,
          totalUserChunks: totalUserChunks,
          domLayoutMode: detected.mode,
          turnCounter: turnCounter,
          turnBadge: badgeStr,
          isTurnRoot: true,
          type: 'text',
          turnIndex: primaryIndex,
          startDomIndex: resolvedStartDomIndex,
          endDomIndex: resolvedEndDomIndex,
          targetDomIndex: resolvedStartDomIndex,
          chunkStartDomIndex: round.startDomIndex,
          chunkEndDomIndex: round.endDomIndex,
          chunkTextDomIndex: round.textDomIndex,
          chunkTargetDomIndex: round.startDomIndex,
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
    const stampedTurns = document.querySelectorAll('ms-chat-turn[data-enhancer-dom-index]');
    stampedTurns.forEach((el) => {
      el.removeAttribute('data-enhancer-dom-index');
      el.removeAttribute('data-enhancer-dom-mode');
    });
  }

  function enrichCatalogAttachmentNames() {
    const catalogData = State.getCatalogData();
    if (!catalogData || catalogData.length === 0) return false;

    const userTurnElements = getUserTurnElements();
    const roundsSummary = extractRoundsSummary(catalogData);
    const totalUserChunks = catalogData[0].totalUserChunks || roundsSummary.length;
    const detected = detectDomLayoutMode(userTurnElements, roundsSummary, totalUserChunks);
    const effectiveMode = detected.mode || catalogData[0].domLayoutMode || 'chunk';
    const isFullDomPresent = Boolean(detected.mode && detected.totalDomTurns > 0 && userTurnElements.length === detected.totalDomTurns);

    if (isFullDomPresent) {
      userTurnElements.forEach((el, idx) => {
        el.setAttribute('data-enhancer-dom-index', String(idx));
        el.setAttribute('data-enhancer-dom-mode', effectiveMode);
      });
    }

    const liveImages = Array.from(
      document.querySelectorAll('.chat-turn-container.user img')
    ).filter(img => {
      if (img.classList && (img.classList.contains('user-icon') || img.classList.contains('avatar'))) return false;
      if (img.src && (img.src.includes('googleusercontent.com/a/') || img.src.includes('watermark.png'))) return false;
      if (img.alt && img.alt.trim().toLowerCase() === 'thinking') return false;
      return true;
    });

    let updated = false;

    const imageItems = catalogData.filter(item => item.type === 'image');
    const imageRoundIndices = new Set(imageItems.map(item => item.roundIndex));
    const singleImageRound = imageRoundIndices.size === 1;

    catalogData.forEach(item => {
      if (item.type === 'image') {
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
          let roundContainerResolved = false;
          const roundTurnEls = [];
          const roundImageItems = imageItems.filter(x => x.roundIndex === roundIdx);
          const roundTotalImages = roundImageItems.length || 1;

          // Strategy A: Gather rendered turn element(s) belonging to this round
          if (isFullDomPresent) {
            if (effectiveMode === 'round') {
              if (userTurnElements[roundIdx]) {
                roundTurnEls.push(userTurnElements[roundIdx]);
                roundContainerResolved = true;
              }
            } else if (item.chunkTargetDomIndex !== undefined && userTurnElements[item.chunkTargetDomIndex]) {
              const targetChunkEl = userTurnElements[item.chunkTargetDomIndex];
              roundContainerResolved = true;
              const sameChunkImageItems = roundImageItems.filter(x => x.chunkTargetDomIndex === item.chunkTargetDomIndex);
              const localIdx = Math.max(0, sameChunkImageItems.indexOf(item));
              targetImg = getTurnContentImages(targetChunkEl)[localIdx] || null;
            } else {
              const startD = item.chunkStartDomIndex !== undefined ? item.chunkStartDomIndex : roundIdx;
              const endD = item.chunkEndDomIndex !== undefined ? item.chunkEndDomIndex : startD;
              for (let d = startD; d <= endD; d++) {
                if (userTurnElements[d]) roundTurnEls.push(userTurnElements[d]);
              }
              if (roundTurnEls.length > 0) roundContainerResolved = true;
            }
          } else if (item.pureText && compactTextForMatch(normalizeTextForMatch(item.pureText)).length >= 6) {
            const sameTextRoundsCount = roundsSummary.filter(r => r.fullText && textsLooselyMatch(r.fullText, item.pureText)).length;
            if (sameTextRoundsCount === 1) {
              const matchedTextIdx = userTurnElements.findIndex(el => textsLooselyMatch(getCleanPromptText(el), item.pureText));
              if (matchedTextIdx !== -1) {
                roundContainerResolved = true;
                if (effectiveMode === 'round') {
                  roundTurnEls.push(userTurnElements[matchedTextIdx]);
                } else if (item.chunkTargetDomIndex !== undefined && item.chunkTextDomIndex !== undefined) {
                  const targetPos = matchedTextIdx + (item.chunkTargetDomIndex - item.chunkTextDomIndex);
                  if (targetPos >= 0 && targetPos < userTurnElements.length) {
                    const targetChunkEl = userTurnElements[targetPos];
                    const sameChunkImageItems = roundImageItems.filter(x => x.chunkTargetDomIndex === item.chunkTargetDomIndex);
                    const localIdx = Math.max(0, sameChunkImageItems.indexOf(item));
                    targetImg = getTurnContentImages(targetChunkEl)[localIdx] || null;
                  }
                } else {
                  const startOffset = (item.chunkTextDomIndex || 0) - (item.chunkStartDomIndex || 0);
                  const endOffset = (item.chunkEndDomIndex || 0) - (item.chunkStartDomIndex || 0);
                  const baseIdx = matchedTextIdx - Math.max(0, startOffset);
                  for (let k = Math.max(0, baseIdx); k <= baseIdx + Math.max(0, endOffset); k++) {
                    if (userTurnElements[k]) roundTurnEls.push(userTurnElements[k]);
                  }
                }
              }
            }
          }

          if (!targetImg && roundTurnEls.length > 0) {
            const roundImgs = [];
            roundTurnEls.forEach((turnEl) => {
              roundImgs.push(...getTurnContentImages(turnEl));
            });
            targetImg = roundImgs[subIdx] || null;
          }

          // Strategy B: Fallback to user-turn liveImages only if the round's DOM container wasn't already localized
          if (!targetImg && !roundContainerResolved && liveImages.length > 0) {
            if (singleImageRound && (roundTotalImages === 1 || liveImages.length === roundTotalImages)) {
              targetImg = liveImages[subIdx] || null;
            } else if (item.pureText && compactTextForMatch(normalizeTextForMatch(item.pureText)).length >= 6) {
              const sameTextRoundsCount = roundsSummary.filter(r => r.fullText && textsLooselyMatch(r.fullText, item.pureText)).length;
              if (sameTextRoundsCount === 1) {
                const matchedImages = liveImages.filter(img => {
                  const parentTurn = img.closest(Utils.SELECTORS.query.chatTurn) || img.closest('.chat-turn-container.user');
                  if (!parentTurn) return false;
                  return textsLooselyMatch(getCleanPromptText(parentTurn), item.pureText);
                });
                targetImg = matchedImages[subIdx] || null;
              }
            }
          }

          if (targetImg) {
            const info = Utils.extractImageInfo(targetImg, subIdx, roundTotalImages);
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
          if (newItem.type === 'image' && newItem.isDefaultName) {
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
                o.type === 'image' &&
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
              newData[i].isDefaultName !== oldData[i].isDefaultName ||
              newData[i].targetDomIndex !== oldData[i].targetDomIndex ||
              newData[i].domLayoutMode !== oldData[i].domLayoutMode) {
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
    const catalogData = State.getCatalogData();
    if (!catalogData || catalogData.length === 0) return;

    // Virtual scrolling unmounts off-screen ms-chat-turn nodes without deleting API turns.
    // Clear disconnected DOM IDs instead of dropping catalog entries when turns unmount.
    catalogData.forEach((item) => {
      if (item.turnElementId && !document.getElementById(item.turnElementId)) {
        item.turnElementId = null;
      }
    });
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
        } else if (mutation.type === 'attributes') {
          const target = mutation.target;
          if (target && target.tagName && target.tagName.toLowerCase() === 'img') {
            if (target.closest && target.closest('.chat-turn-container.user')) {
              const data = State.getCatalogData();
              if (data && data.some(item => item.type === 'image' && item.isDefaultName)) {
                shouldEnrich = true;
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
      subtree: true,
      attributes: true,
      attributeFilter: ['alt', 'title', 'data-filename', 'data-name']
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
  let activeNavigationAbort = null;
  let navigationClearTimer = null;
  let navigationSafetyTimer = null;
  let searchSettleTimer = null;
  let isNavigating = false;

  // Retrieve the primary scrollable container for AI Studio chat history
  function getChatScrollContainer() {
    const isScrollableY = (el) => {
      if (!el) return false;
      const s = window.getComputedStyle(el);
      const oy = s.overflowY;
      return (oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollHeight > el.clientHeight + 1;
    };

    const turn = document.querySelector(Utils.SELECTORS.query.chatTurn) || document.querySelector(Utils.SELECTORS.query.chunkEditor);
    if (turn) {
      let p = turn.parentElement;
      while (p && p !== document.body) {
        if (isScrollableY(p)) {
          return p;
        }
        p = p.parentElement;
      }
    }

    const chunkEditor = document.querySelector(Utils.SELECTORS.query.chunkEditor);
    if (chunkEditor) {
      if (isScrollableY(chunkEditor)) {
        return chunkEditor;
      }
      for (const child of chunkEditor.children) {
        if (child.id === Utils.SELECTORS.id.catalogPanel) continue;
        if (isScrollableY(child)) {
          return child;
        }
      }
      const mainContent = Array.from(chunkEditor.children).find(
        child => child.id !== Utils.SELECTORS.id.catalogPanel && child.tagName !== 'STYLE' && !child.classList.contains('custom-tooltip-text')
      );
      if (mainContent) return mainContent;
      return chunkEditor;
    }

    if (document.documentElement.scrollHeight > document.documentElement.clientHeight + 1) {
      return document.documentElement;
    }
    return document.body;
  }

  function getScrollerViewportMetrics(scroller) {
    if (!scroller || scroller === document.documentElement || scroller === document.body) {
      return {
        top: 0,
        height: window.innerHeight || document.documentElement.clientHeight || 800
      };
    }
    const rect = scroller.getBoundingClientRect();
    return { top: rect.top, height: rect.height };
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

  function doesElementMatchText(domText, apiText) {
    if (!domText || !apiText) return false;
    const dNorm = normalizeTextForMatch(domText);
    const aNorm = normalizeTextForMatch(apiText);
    if (!dNorm || !aNorm) return false;
    const dComp = compactTextForMatch(dNorm);
    const aComp = compactTextForMatch(aNorm);
    if (!dComp || !aComp) return false;
    if (dNorm === aNorm || dComp === aComp) return true;
    if (aComp.length >= 6 && dComp.length >= 6) {
      return textsLooselyMatch(domText, apiText);
    }
    return false;
  }

  // Build lookup structures and layout mode context shared across target resolution and scroll spy
  function buildDomLookupContext(catalogData, userTurnsOpt) {
    const userTurns = userTurnsOpt || getUserTurnElements();
    const roundsSummary = extractRoundsSummary(catalogData || []);
    const totalRounds = roundsSummary.length;
    const totalUserChunks = (catalogData && catalogData[0] && catalogData[0].totalUserChunks) || totalRounds;
    const detected = detectDomLayoutMode(userTurns, roundsSummary, totalUserChunks);
    const effectiveMode = detected.mode || (catalogData && catalogData[0] && catalogData[0].domLayoutMode) || 'chunk';
    const totalDomTurns = effectiveMode === 'round' ? totalRounds : totalUserChunks;
    const isFullDomPresent = Boolean(detected.mode && detected.totalDomTurns > 0 && userTurns.length === detected.totalDomTurns);

    const roundByIndex = new Map();
    const chunkToRound = new Map();
    const duplicateNormCounts = new Map();

    roundsSummary.forEach((round) => {
      roundByIndex.set(round.roundIndex, round);
      for (let c = round.chunkStartDomIndex; c <= round.chunkEndDomIndex; c++) {
        chunkToRound.set(c, round.roundIndex);
      }
      if (round.fullText) {
        const comp = compactTextForMatch(normalizeTextForMatch(round.fullText));
        if (comp) {
          duplicateNormCounts.set(comp, (duplicateNormCounts.get(comp) || 0) + 1);
        }
      }
    });

    const domTextCache = new WeakMap();
    const domAttCache = new WeakMap();

    const getCachedCleanText = (el) => {
      if (!el) return '';
      if (domTextCache.has(el)) return domTextCache.get(el);
      const val = getCleanPromptText(el);
      domTextCache.set(el, val);
      return val;
    };

    const getCachedHasAttachment = (el) => {
      if (!el) return false;
      if (domAttCache.has(el)) return domAttCache.get(el);
      const val = turnHasAttachment(el);
      domAttCache.set(el, val);
      return val;
    };

    return {
      userTurns,
      roundsSummary,
      totalRounds,
      totalUserChunks,
      detectedMode: detected.mode,
      effectiveMode,
      totalDomTurns,
      isFullDomPresent,
      roundByIndex,
      chunkToRound,
      duplicateNormCounts,
      getCachedCleanText,
      getCachedHasAttachment
    };
  }

  function getExpectedUnitAtIndex(expIdx, ctx) {
    if (expIdx < 0 || expIdx >= ctx.totalDomTurns) return null;
    if (ctx.effectiveMode === 'round') {
      const round = ctx.roundByIndex.get(expIdx);
      if (!round) return null;
      return {
        roundIndex: round.roundIndex,
        text: round.fullText || '',
        expectText: Boolean(round.fullText),
        expectAttachment: round.hasAttachments,
        fileNames: round.fileNames || []
      };
    }
    const rIdx = ctx.chunkToRound.get(expIdx);
    const round = ctx.roundByIndex.get(rIdx);
    if (!round) return null;
    const isSingleChunkRound = round.chunkStartDomIndex === round.chunkEndDomIndex;
    const isTextChunk = Boolean(round.fullText) && (isSingleChunkRound || expIdx === round.chunkTextDomIndex);
    return {
      roundIndex: round.roundIndex,
      text: isTextChunk ? round.fullText : '',
      expectText: isTextChunk,
      expectAttachment: round.hasAttachments && (!isTextChunk || isSingleChunkRound),
      fileNames: round.fileNames || []
    };
  }

  // Score how consistently surrounding rendered DOM turns agree with assigning candidatePos -> targetExpIdx
  function scoreCandidateContext(candidatePos, targetExpIdx, ctx) {
    let score = 0;
    let matches = 0;
    let conflicts = 0;
    let checkedNeighbors = 0;

    const offsets = [-2, -1, 1, 2];
    for (const delta of offsets) {
      const domPos = candidatePos + delta;
      const expIdx = targetExpIdx + delta;
      if (domPos < 0 || domPos >= ctx.userTurns.length || expIdx < 0 || expIdx >= ctx.totalDomTurns) {
        continue;
      }

      const exp = getExpectedUnitAtIndex(expIdx, ctx);
      if (!exp) continue;

      const nbEl = ctx.userTurns[domPos];
      const nbText = ctx.getCachedCleanText(nbEl);
      const nbCompLen = compactTextForMatch(normalizeTextForMatch(nbText)).length;

      if (exp.expectText) {
        const expCompLen = compactTextForMatch(normalizeTextForMatch(exp.text)).length;
        if (expCompLen >= 4) {
          checkedNeighbors++;
          if (doesElementMatchText(nbText, exp.text)) {
            score += 2;
            matches++;
          } else if (nbCompLen >= 4) {
            score -= 3;
            conflicts++;
          }
        }
      } else if (exp.expectAttachment) {
        checkedNeighbors++;
        const hasAtt = ctx.getCachedHasAttachment(nbEl);
        if (hasAtt) {
          score += 1;
          matches++;
        } else if (nbCompLen >= 6) {
          score -= 2;
          conflicts++;
        }
      }
    }

    return { score, matches, conflicts, checkedNeighbors };
  }

  function inferUniqueTextRoundIndex(domText, ctx) {
    const compDom = compactTextForMatch(normalizeTextForMatch(domText));
    if (!compDom) return -1;

    const strictMatches = [];
    const looseMatches = [];

    for (const round of ctx.roundsSummary) {
      if (!round.fullText) continue;
      const normA = normalizeTextForMatch(round.fullText);
      const compA = compactTextForMatch(normA);
      if (!compA) continue;
      if (compDom === compA) {
        strictMatches.push(round.roundIndex);
      } else if (compDom.length >= 6 && compA.length >= 6 && textsLooselyMatch(domText, round.fullText)) {
        const ratio = Math.min(compDom.length, compA.length) / Math.max(compDom.length, compA.length);
        if (ratio >= 0.45) {
          looseMatches.push(round.roundIndex);
        }
      }
    }

    if (strictMatches.length === 1) return strictMatches[0];
    if (strictMatches.length === 0 && looseMatches.length === 1) return looseMatches[0];
    return -1;
  }

  // Always returns roundIndex (0 .. totalRounds - 1), or -1 if undetermined
  function inferCatalogRoundIndex(turnEl, catalogData, ctxOpt, domPosOpt) {
    if (!turnEl || !catalogData || catalogData.length === 0) return -1;

    const ctx = ctxOpt || buildDomLookupContext(catalogData);
    const domPos = domPosOpt !== undefined ? domPosOpt : ctx.userTurns.indexOf(turnEl);
    if (domPos === -1) return -1;

    // 1. Verified full-DOM fast path
    if (ctx.isFullDomPresent) {
      if (ctx.effectiveMode === 'round') {
        return domPos < ctx.totalRounds ? domPos : -1;
      }
      const rIdx = ctx.chunkToRound.get(domPos);
      return rIdx !== undefined ? rIdx : -1;
    }

    const domText = ctx.getCachedCleanText(turnEl);
    const domComp = compactTextForMatch(normalizeTextForMatch(domText));

    // 2. Mode-consistent stamped DOM index with non-destructive validation
    const stamped = turnEl.getAttribute('data-enhancer-dom-index');
    const stampedMode = turnEl.getAttribute('data-enhancer-dom-mode');
    if (stamped !== null && (!stampedMode || stampedMode === ctx.effectiveMode)) {
      const parsed = parseInt(stamped, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        const candidateRoundIdx = ctx.effectiveMode === 'round' ? parsed : ctx.chunkToRound.get(parsed);
        if (candidateRoundIdx !== undefined) {
          const round = ctx.roundByIndex.get(candidateRoundIdx);
          if (round) {
            const roundCompLen = compactTextForMatch(normalizeTextForMatch(round.fullText)).length;
            const textMatches = round.fullText && doesElementMatchText(domText, round.fullText);
            const isAttachmentChunkInRound = ctx.effectiveMode === 'chunk' && round.hasAttachments && parsed !== round.chunkTextDomIndex && ctx.getCachedHasAttachment(turnEl);
            const hasClearContradiction = !textMatches && !isAttachmentChunkInRound && roundCompLen >= 6 && domComp.length >= 6;
            if (!hasClearContradiction && (textMatches || isAttachmentChunkInRound || !round.fullText)) {
              return candidateRoundIdx;
            }
          }
        }
      }
    }

    // 3. Unique / context-verified text matching across rounds
    if (domComp.length > 0) {
      const strictRounds = [];
      const looseRounds = [];

      for (const round of ctx.roundsSummary) {
        if (!round.fullText) continue;
        const compA = compactTextForMatch(normalizeTextForMatch(round.fullText));
        if (!compA) continue;
        if (domComp === compA) {
          strictRounds.push(round.roundIndex);
        } else if (domComp.length >= 6 && compA.length >= 6 && textsLooselyMatch(domText, round.fullText)) {
          const ratio = Math.min(domComp.length, compA.length) / Math.max(domComp.length, compA.length);
          const isMultiChunk = round.chunkEndDomIndex > round.chunkStartDomIndex;
          if (ratio >= 0.45 || (isMultiChunk && compA.includes(domComp))) {
            looseRounds.push(round.roundIndex);
          }
        }
      }

      const candidates = strictRounds.length > 0 ? strictRounds : looseRounds;
      if (candidates.length === 1 && (domComp.length >= 6 || !ctx.duplicateNormCounts.get(domComp) || ctx.duplicateNormCounts.get(domComp) <= 1)) {
        return candidates[0];
      }
      if (candidates.length > 0) {
        let bestRound = -1;
        let bestScore = -Infinity;
        let bestConflicts = Infinity;
        let bestMatches = 0;

        for (const rIdx of candidates) {
          const round = ctx.roundByIndex.get(rIdx);
          const expIdx = ctx.effectiveMode === 'round' ? rIdx : round.chunkTextDomIndex;
          const sc = scoreCandidateContext(domPos, expIdx, ctx);
          if (sc.score > bestScore || (sc.score === bestScore && sc.matches > bestMatches)) {
            bestScore = sc.score;
            bestMatches = sc.matches;
            bestConflicts = sc.conflicts;
            bestRound = rIdx;
          }
        }

        if (bestRound !== -1 && (bestMatches > 0 || bestConflicts === 0)) {
          return bestRound;
        }
      }
    }

    // 4. Non-default attachment filename matching
    const matchingAttRounds = new Set();
    for (const item of catalogData) {
      if (item.type !== 'text' && item.fileName && !item.isDefaultName) {
        if (matchAttachmentInTurn(turnEl, item.fileName)) {
          matchingAttRounds.add(item.roundIndex);
        }
      }
    }
    if (matchingAttRounds.size === 1) {
      return Array.from(matchingAttRounds)[0];
    }

    return -1;
  }

  function inferVisibleRoundRange(userTurns, catalogData, ctxOpt) {
    const ctx = ctxOpt || buildDomLookupContext(catalogData, userTurns);
    let minRound = Infinity;
    let maxRound = -Infinity;
    const anchors = [];

    for (let i = 0; i < userTurns.length; i++) {
      const rIdx = inferCatalogRoundIndex(userTurns[i], catalogData, ctx, i);
      if (rIdx !== -1) {
        if (rIdx < minRound) minRound = rIdx;
        if (rIdx > maxRound) maxRound = rIdx;
        anchors.push({ domPos: i, roundIndex: rIdx });
      }
    }

    if (anchors.length === 0) {
      return { minRound: -1, maxRound: -1, anchors: [] };
    }
    return { minRound, maxRound, anchors };
  }

  function resolveRoundFromNeighbors(userTurns, targetDomPos, ctx) {
    let bestRound = -1;
    let bestDist = Infinity;

    for (let j = 0; j < userTurns.length; j++) {
      if (j === targetDomPos) continue;
      const dist = Math.abs(targetDomPos - j);
      if (dist > 3 || dist >= bestDist) continue;

      const textJ = ctx.getCachedCleanText(userTurns[j]);
      const anchorRoundIdx = inferUniqueTextRoundIndex(textJ, ctx);
      if (anchorRoundIdx === -1) continue;

      const anchorRound = ctx.roundByIndex.get(anchorRoundIdx);
      if (!anchorRound) continue;

      if (ctx.effectiveMode === 'round') {
        const candRoundIdx = anchorRoundIdx + (targetDomPos - j);
        if (candRoundIdx >= 0 && candRoundIdx < ctx.totalRounds) {
          bestRound = candRoundIdx;
          bestDist = dist;
        }
      } else {
        const isSingleOrTextChunk = anchorRound.chunkStartDomIndex === anchorRound.chunkEndDomIndex ||
          !anchorRound.hasAttachments;
        if (!isSingleOrTextChunk && anchorRound.chunkTextDomIndex === undefined) continue;
        const anchorChunk = anchorRound.chunkTextDomIndex;
        const candChunk = anchorChunk + (targetDomPos - j);
        const candRoundIdx = ctx.chunkToRound.get(candChunk);
        if (candRoundIdx !== undefined) {
          bestRound = candRoundIdx;
          bestDist = dist;
        }
      }
    }

    return bestRound;
  }

  // Locate the target DOM ms-chat-turn element for a given catalog item
  function findTargetElement(catalogItem) {
    if (!catalogItem) return null;

    const catalogData = State.getCatalogData() || [];
    const userTurns = getUserTurnElements();
    if (userTurns.length === 0) return null;

    const ctx = buildDomLookupContext(catalogData, userTurns);
    const effectiveMode = ctx.effectiveMode;
    const roundIdx = catalogItem.roundIndex !== undefined ? catalogItem.roundIndex : 0;
    const effectiveTargetIndex = effectiveMode === 'round'
      ? roundIdx
      : (catalogItem.chunkTargetDomIndex !== undefined
        ? catalogItem.chunkTargetDomIndex
        : (catalogItem.targetDomIndex !== undefined ? catalogItem.targetDomIndex : roundIdx));
    const effectiveTextIndex = effectiveMode === 'round'
      ? roundIdx
      : (catalogItem.chunkTextDomIndex !== undefined ? catalogItem.chunkTextDomIndex : effectiveTargetIndex);

    // Tier 0: Verified Full-DOM Fast Path (100% 1:1 positional guarantee across both Round & Chunk modes)
    if (ctx.isFullDomPresent) {
      userTurns.forEach((el, idx) => {
        el.setAttribute('data-enhancer-dom-index', String(idx));
        el.setAttribute('data-enhancer-dom-mode', effectiveMode);
      });
      if (effectiveTargetIndex >= 0 && effectiveTargetIndex < userTurns.length) {
        return userTurns[effectiveTargetIndex];
      }
      return null;
    }

    // Partial / Virtualized DOM path
    const pureText = (catalogItem.pureText || '').trim();
    const realFileName = (!catalogItem.isDefaultName && catalogItem.fileName) ? catalogItem.fileName.trim() : '';
    const expectsAttachment = catalogItem.type !== 'text';
    const normCompactA = compactTextForMatch(normalizeTextForMatch(pureText));
    const normCompactLen = normCompactA.length;
    const duplicateCount = normCompactLen > 0 ? (ctx.duplicateNormCounts.get(normCompactA) || 1) : 0;

    const verifyDirectCandidate = (el) => {
      const domPos = userTurns.indexOf(el);
      if (domPos === -1) return false;
      const tText = ctx.getCachedCleanText(el);
      if (pureText && doesElementMatchText(tText, pureText)) {
        if (effectiveMode === 'chunk' && effectiveTargetIndex !== effectiveTextIndex) {
          return false;
        }
        return true;
      }
      if (realFileName && matchAttachmentInTurn(el, realFileName)) {
        return true;
      }
      if (effectiveMode === 'chunk' && effectiveTargetIndex !== effectiveTextIndex) {
        const expectedTextPos = domPos + (effectiveTextIndex - effectiveTargetIndex);
        if (expectedTextPos >= 0 && expectedTextPos < userTurns.length && pureText) {
          const textPeer = userTurns[expectedTextPos];
          if (doesElementMatchText(ctx.getCachedCleanText(textPeer), pureText)) {
            if (!expectsAttachment || ctx.getCachedHasAttachment(el)) {
              return true;
            }
          }
        }
      }
      if (!pureText && expectsAttachment && ctx.getCachedHasAttachment(el)) {
        const sc = scoreCandidateContext(domPos, effectiveTargetIndex, ctx);
        if (sc.conflicts === 0 || sc.matches > 0) return true;
      }
      return false;
    };

    // Tier 1: Mode-consistent stamped DOM index (never delete valid stamps on weak uncertainty; only clear wrong-mode stamps)
    if (effectiveTargetIndex !== undefined && effectiveTargetIndex >= 0) {
      const stampedEl = document.querySelector(`ms-chat-turn[data-enhancer-dom-index="${effectiveTargetIndex}"]`);
      if (stampedEl) {
        const stampedMode = stampedEl.getAttribute('data-enhancer-dom-mode');
        if (stampedMode && stampedMode !== effectiveMode) {
          stampedEl.removeAttribute('data-enhancer-dom-index');
          stampedEl.removeAttribute('data-enhancer-dom-mode');
        } else if (verifyDirectCandidate(stampedEl)) {
          return stampedEl;
        }
      }
    }

    // Tier 1.5: Recorded element ID lookup (only when targeting start of round or matching attachment directly)
    const idPointsToTargetChunk = effectiveMode === 'round' ||
      catalogItem.chunkTargetDomIndex === undefined ||
      catalogItem.chunkStartDomIndex === undefined ||
      catalogItem.chunkTargetDomIndex === catalogItem.chunkStartDomIndex;
    if (catalogItem.turnElementId) {
      const idEl = document.getElementById(catalogItem.turnElementId);
      if (idEl && (idPointsToTargetChunk || (realFileName && matchAttachmentInTurn(idEl, realFileName)))) {
        if (verifyDirectCandidate(idEl)) {
          return idEl;
        }
      }
    }

    // Tier 2A: Non-default attachment filename match (e.g. resolved img.alt or drive filename)
    if (realFileName) {
      const attCandidates = [];
      for (let i = 0; i < userTurns.length; i++) {
        if (matchAttachmentInTurn(userTurns[i], realFileName)) {
          attCandidates.push(i);
        }
      }

      const validAttCandidates = [];
      for (const pos of attCandidates) {
        const el = userTurns[pos];
        if (effectiveMode === 'round' && pureText) {
          const tText = ctx.getCachedCleanText(el);
          const tCompLen = compactTextForMatch(normalizeTextForMatch(tText)).length;
          if (normCompactLen >= 6 && tCompLen >= 6 && !doesElementMatchText(tText, pureText)) {
            continue;
          }
        }
        const sc = scoreCandidateContext(pos, effectiveTargetIndex, ctx);
        validAttCandidates.push({ pos, sc });
      }

      if (validAttCandidates.length === 1) {
        const { pos, sc } = validAttCandidates[0];
        if (sc.matches > 0 || sc.conflicts === 0 || sc.score >= 0) {
          return userTurns[pos];
        }
      } else if (validAttCandidates.length > 1) {
        validAttCandidates.sort((a, b) => {
          if (b.sc.score !== a.sc.score) return b.sc.score - a.sc.score;
          if (b.sc.matches !== a.sc.matches) return b.sc.matches - a.sc.matches;
          return Math.abs(a.pos - effectiveTargetIndex) - Math.abs(b.pos - effectiveTargetIndex);
        });
        const best = validAttCandidates[0];
        if (best.sc.matches > 0 || best.sc.conflicts === 0) {
          return userTurns[best.pos];
        }
      }
    }

    // Tier 2B & Tier 3: Normalized exact text match, then length-ratio / context-guarded loose match
    if (normCompactLen > 0) {
      const strictPositions = [];
      const loosePositions = [];

      for (let i = 0; i < userTurns.length; i++) {
        const tText = ctx.getCachedCleanText(userTurns[i]);
        const dComp = compactTextForMatch(normalizeTextForMatch(tText));
        if (!dComp) continue;
        if (dComp === normCompactA) {
          strictPositions.push({ pos: i, similarity: 1 });
        } else if (normCompactLen >= 6 && dComp.length >= 6 && textsLooselyMatch(tText, pureText)) {
          const sim = Math.min(dComp.length, normCompactLen) / Math.max(dComp.length, normCompactLen);
          loosePositions.push({ pos: i, similarity: sim });
        }
      }

      const pickWinningTextPosition = (candidates, requireStrictGuard) => {
        if (candidates.length === 0) return -1;
        const isUniqueLong = !requireStrictGuard && normCompactLen >= 6 && duplicateCount <= 1;

        const scored = candidates.map((cand) => {
          const sc = scoreCandidateContext(cand.pos, effectiveTextIndex, ctx);
          return { pos: cand.pos, similarity: cand.similarity, sc };
        });

        scored.sort((a, b) => {
          if (b.sc.score !== a.sc.score) return b.sc.score - a.sc.score;
          if (b.sc.matches !== a.sc.matches) return b.sc.matches - a.sc.matches;
          if (Math.abs(b.similarity - a.similarity) > 0.1) return b.similarity - a.similarity;
          return Math.abs(a.pos - effectiveTextIndex) - Math.abs(b.pos - effectiveTextIndex);
        });

        const winner = scored[0];
        if (isUniqueLong && scored.length === 1) {
          if (winner.sc.conflicts === 0 || winner.sc.matches > 0 || winner.sc.conflicts <= 1) {
            return winner.pos;
          }
          return -1;
        }

        if (requireStrictGuard) {
          // Reject low-overlap subset matches unless neighbor context actively confirms them
          if (winner.similarity < 0.45 && winner.sc.matches === 0) {
            return -1;
          }
        }

        // For duplicate or short prompts, do not accept if neighbor context actively contradicts it
        if (winner.sc.checkedNeighbors > 0 && winner.sc.conflicts > 0 && winner.sc.matches === 0) {
          return -1;
        }
        return winner.pos;
      };

      let matchedTextPos = pickWinningTextPosition(strictPositions, false);
      if (matchedTextPos === -1) {
        matchedTextPos = pickWinningTextPosition(loosePositions, true);
      }

      if (matchedTextPos !== -1) {
        if (effectiveMode === 'round' || effectiveTargetIndex === effectiveTextIndex) {
          return userTurns[matchedTextPos];
        }
        const chunkOffset = effectiveTargetIndex - effectiveTextIndex;
        const targetPos = matchedTextPos + chunkOffset;
        if (targetPos >= 0 && targetPos < userTurns.length) {
          const targetCandidate = userTurns[targetPos];
          if (!expectsAttachment || ctx.getCachedHasAttachment(targetCandidate)) {
            return targetCandidate;
          }
        }
        // For turn roots whose attachment chunk sits just above the mounted viewport window, land on the matched text chunk
        if (catalogItem.isTurnRoot && catalogItem.type === 'text') {
          return userTurns[matchedTextPos];
        }
      }
    }

    // Tier 3.5: Neighbor-anchor offset projection for unnamed/attachment-only rounds inside the visible window
    const anchors = [];
    for (let j = 0; j < userTurns.length; j++) {
      const tText = ctx.getCachedCleanText(userTurns[j]);
      const aRoundIdx = inferUniqueTextRoundIndex(tText, ctx);
      if (aRoundIdx === -1) continue;
      const aRound = ctx.roundByIndex.get(aRoundIdx);
      if (!aRound) continue;
      const expIdx = effectiveMode === 'round'
        ? aRoundIdx
        : ((aRound.chunkStartDomIndex === aRound.chunkEndDomIndex || !aRound.hasAttachments)
          ? aRound.chunkTextDomIndex
          : null);
      if (expIdx !== null && expIdx !== undefined) {
        anchors.push({ domPos: j, expIdx, roundIndex: aRoundIdx });
      }
    }

    if (anchors.length > 0) {
      // First check if two anchors strictly bracket effectiveTargetIndex with contiguous spacing
      let beforeAnchor = null;
      let afterAnchor = null;
      for (const a of anchors) {
        if (a.expIdx < effectiveTargetIndex && (!beforeAnchor || a.expIdx > beforeAnchor.expIdx)) {
          beforeAnchor = a;
        }
        if (a.expIdx > effectiveTargetIndex && (!afterAnchor || a.expIdx < afterAnchor.expIdx)) {
          afterAnchor = a;
        }
      }

      if (beforeAnchor && afterAnchor &&
          (afterAnchor.domPos - beforeAnchor.domPos) === (afterAnchor.expIdx - beforeAnchor.expIdx)) {
        const bracketPos = beforeAnchor.domPos + (effectiveTargetIndex - beforeAnchor.expIdx);
        if (bracketPos >= 0 && bracketPos < userTurns.length) {
          const candEl = userTurns[bracketPos];
          const candOwnRound = inferUniqueTextRoundIndex(ctx.getCachedCleanText(candEl), ctx);
          if (candOwnRound === -1 || candOwnRound === roundIdx) {
            return candEl;
          }
        }
      }

      // Single close anchor within <= 3 turns
      let closestAnchor = null;
      let minDist = Infinity;
      for (const a of anchors) {
        const d = Math.abs(effectiveTargetIndex - a.expIdx);
        if (d > 0 && d <= 3 && d < minDist) {
          minDist = d;
          closestAnchor = a;
        }
      }

      if (closestAnchor) {
        const candPos = closestAnchor.domPos + (effectiveTargetIndex - closestAnchor.expIdx);
        if (candPos >= 0 && candPos < userTurns.length) {
          const candEl = userTurns[candPos];
          const candText = ctx.getCachedCleanText(candEl);
          const candOwnRound = inferUniqueTextRoundIndex(candText, ctx);
          if (candOwnRound === -1 || candOwnRound === roundIdx) {
            if (!expectsAttachment || ctx.getCachedHasAttachment(candEl)) {
              return candEl;
            }
          }
        }
      }
    }

    return null;
  }

  function navigateToPrompt(target) {
    let cleanup = null;
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

      // 1. Cancel active navigation, animation, and previous timers
      if (activeNavigationAbort) {
        activeNavigationAbort(true);
        activeNavigationAbort = null;
      }
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
      if (searchSettleTimer) {
        clearTimeout(searchSettleTimer);
        searchSettleTimer = null;
      }

      isNavigating = true;
      const clickTime = performance.now();
      const minFeedbackDurationMs = 380; // Ensure visible feedback even for short distances

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

      cleanup = (immediate = false) => {
        if (navigationSafetyTimer) {
          clearTimeout(navigationSafetyTimer);
          navigationSafetyTimer = null;
        }
        if (searchSettleTimer) {
          clearTimeout(searchSettleTimer);
          searchSettleTimer = null;
        }
        clearNavigatingState(immediate);
        if (activeNavigationCancel) {
          activeNavigationCancel();
          activeNavigationCancel = null;
        }
        activeNavigationAbort = null;
        isNavigating = false;
        window.removeEventListener('wheel', onUserInterrupt, { capture: true });
        window.removeEventListener('touchstart', onUserInterrupt, { capture: true });
        window.removeEventListener('keydown', onUserInterrupt, { capture: true });
      };
      activeNavigationAbort = cleanup;

      // Global safety timer: covers multi-hop virtual search + smooth scroll + landing stabilization
      navigationSafetyTimer = setTimeout(() => {
        if (isNavigating) {
          cleanup(false);
        }
      }, 2600);

      window.addEventListener('wheel', onUserInterrupt, { capture: true, passive: true });
      window.addEventListener('touchstart', onUserInterrupt, { capture: true, passive: true });
      window.addEventListener('keydown', onUserInterrupt, { capture: true, passive: true });

      // Resolve sub-element within card for image or file attachments
      const resolveSubTarget = (cardEl, item) => {
        if (!cardEl || !item) return cardEl;
        if (item.type === 'image') {
          const contentImgs = getTurnContentImages(cardEl);
          const visibleImgs = contentImgs.filter((img) => {
            const r = img.getBoundingClientRect();
            return r.width > 0 || r.height > 0;
          });
          const imgs = visibleImgs.length > 0 ? visibleImgs : contentImgs;
          if (imgs.length > 0) {
            if (item.fileName && !item.isDefaultName) {
              const targetLower = item.fileName.trim().toLowerCase();
              const byName = imgs.find((img) => {
                const alt = (img.alt || '').trim().toLowerCase();
                const title = (img.title || '').trim().toLowerCase();
                return (alt && (alt === targetLower || alt.includes(targetLower) || targetLower.includes(alt))) ||
                       (title && (title === targetLower || title.includes(targetLower))) ||
                       (img.src && !img.src.startsWith('data:') && img.src.toLowerCase().includes(targetLower));
              });
              if (byName) return byName;
            }
            const idx = item.subIndex || 0;
            if (item.chunkTargetDomIndex !== undefined && item.chunkStartDomIndex !== undefined && item.chunkTargetDomIndex > item.chunkStartDomIndex) {
              const liveTurns = getUserTurnElements();
              const pos = liveTurns.indexOf(cardEl);
              if (pos !== -1) {
                let precedingImgs = 0;
                const maxBack = Math.min(pos, item.chunkTargetDomIndex - item.chunkStartDomIndex);
                for (let k = 1; k <= maxBack; k++) {
                  precedingImgs += getTurnContentImages(liveTurns[pos - k]).length;
                }
                const localIdx = Math.max(0, idx - precedingImgs);
                if (imgs[localIdx]) return imgs[localIdx];
              }
            }
            return imgs[idx] || imgs[imgs.length - 1] || cardEl;
          }
        } else if (item.type === 'file' && item.fileName && !item.isDefaultName) {
          const fileEls = Array.from(cardEl.querySelectorAll('ms-file-chunk, ms-media-chunk, [class*="file"], [class*="attachment"], [data-test-id*="file"]'));
          const normName = normalizeTextForMatch(item.fileName);
          const matchedChip = fileEls.find((el) => {
            if (el.classList.contains('chat-turn-container')) return false;
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) return false;
            const txt = normalizeTextForMatch(el.textContent || '');
            return Boolean(txt && normName && txt.includes(normName));
          });
          if (matchedChip) return matchedChip;
        }
        return cardEl;
      };

      // Precision landing helper when target DOM element is available
      const landOnTarget = (targetEl) => {
        if (!targetEl || !targetEl.isConnected) {
          cleanup(false);
          return;
        }

        const subTarget = resolveSubTarget(targetEl, catalogItem);
        const targetRect = subTarget.getBoundingClientRect();
        const scrollerRect = getScrollerViewportMetrics(scroller);
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
          if (!isNavigating) return;
          const anchorStartTime = performance.now();
          const anchorWindowMs = 350;
          let stableFrames = 0;
          let anchorRafId = null;

          const anchorTick = () => {
            if (!isNavigating) return;

            const freshCard = targetEl.isConnected ? targetEl : findTargetElement(catalogItem);
            if (!freshCard || !freshCard.isConnected) {
              cleanup(false);
              return;
            }
            const freshTarget = resolveSubTarget(freshCard, catalogItem);
            const freshRect = freshTarget.getBoundingClientRect();
            const currentScrollerRect = getScrollerViewportMetrics(scroller);
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

      // Target not in DOM yet (virtualized): adaptive proportional hydration search across rendered round anchors
      const maxSearchHops = 3;
      const targetRound = catalogItem.roundIndex !== undefined ? catalogItem.roundIndex : 0;
      const totalRounds = catalogItem.totalRounds || new Set(catalogData.map(i => i.roundIndex)).size || 1;

      const runSearchHop = (hop) => {
        if (!isNavigating) return;

        const quickFound = findTargetElement(catalogItem);
        if (quickFound) {
          landOnTarget(quickFound);
          return;
        }

        const liveTurns = getUserTurnElements();
        const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
        const currentTop = scroller.scrollTop;

        if (hop > maxSearchHops || maxScroll <= 0) {
          cleanup(false);
          return;
        }

        const visRange = inferVisibleRoundRange(liveTurns, catalogData);
        let searchTarget;

        if (visRange.minRound !== -1 && visRange.maxRound !== -1) {
          if (targetRound < visRange.minRound) {
            if (hop === maxSearchHops || targetRound === 0 || visRange.minRound === 0) {
              searchTarget = 0;
            } else {
              const est = Math.round(currentTop * (targetRound / Math.max(1, visRange.minRound)));
              searchTarget = Math.min(Math.max(0, currentTop - 160), est);
            }
          } else if (targetRound > visRange.maxRound) {
            const lastRound = Math.max(1, totalRounds - 1);
            if (hop === maxSearchHops || targetRound >= lastRound || visRange.maxRound >= lastRound) {
              searchTarget = maxScroll;
            } else {
              const span = Math.max(1, lastRound - visRange.maxRound);
              const ratio = Math.min(1, (targetRound - visRange.maxRound) / span);
              const est = Math.round(currentTop + (maxScroll - currentTop) * ratio);
              searchTarget = Math.max(Math.min(maxScroll, currentTop + 160), est);
            }
          } else {
            // Target round lies inside visible round span (e.g., off-edge chunk of same round); nudge in chunk direction
            const nudge = catalogItem.chunkTargetDomIndex !== undefined &&
              catalogItem.chunkTextDomIndex !== undefined &&
              catalogItem.chunkTargetDomIndex < catalogItem.chunkTextDomIndex ? -400 : 400;
            searchTarget = currentTop + nudge;
          }
        } else {
          // None of the visible turns resolved uniquely: aim by global round ratio (never default blindly to 0)
          const ratio = totalRounds > 1 ? (targetRound / (totalRounds - 1)) : 0;
          searchTarget = Math.round(maxScroll * ratio);
        }

        searchTarget = Math.max(0, Math.min(maxScroll, searchTarget));
        const searchDistance = Math.abs(searchTarget - currentTop);
        const searchDuration = Math.min(550, Math.max(220, Math.round(180 + Math.sqrt(searchDistance) * 3.8)));

        let frameCount = 0;
        const startTop = currentTop;
        const searchDelta = searchTarget - startTop;
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
        const searchStartTime = performance.now();
        let searchRafId = null;

        const searchStep = (currentTime) => {
          if (!isNavigating) return;
          frameCount++;
          const elapsed = currentTime - searchStartTime;
          const progress = searchDistance < 2 ? 1 : Math.min(1, elapsed / searchDuration);
          const easedProgress = easeOutCubic(progress);

          scroller.scrollTop = Math.round(startTop + searchDelta * easedProgress);

          // Check every 3 frames (~50ms) if target element has hydrated into DOM
          if (frameCount % 3 === 0 || progress >= 1) {
            const foundEl = findTargetElement(catalogItem);
            if (foundEl) {
              if (searchRafId !== null) {
                cancelAnimationFrame(searchRafId);
                searchRafId = null;
              }
              landOnTarget(foundEl);
              return;
            }
          }

          if (progress < 1) {
            searchRafId = requestAnimationFrame(searchStep);
          } else {
            searchRafId = null;
            searchSettleTimer = setTimeout(() => {
              searchSettleTimer = null;
              if (!isNavigating) return;
              const settledEl = findTargetElement(catalogItem);
              if (settledEl) {
                landOnTarget(settledEl);
              } else if (hop < maxSearchHops) {
                runSearchHop(hop + 1);
              } else {
                cleanup(false);
              }
            }, 85);
          }
        };

        searchRafId = requestAnimationFrame(searchStep);
        activeNavigationCancel = () => {
          if (searchRafId !== null) {
            cancelAnimationFrame(searchRafId);
            searchRafId = null;
          }
          if (searchSettleTimer) {
            clearTimeout(searchSettleTimer);
            searchSettleTimer = null;
          }
        };
      };

      runSearchHop(1);
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

      if (activeNavigationAbort) {
        activeNavigationAbort(true);
        activeNavigationAbort = null;
      }
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

    const userTurns = getUserTurnElements();
    if (userTurns.length === 0) return;

    const catalogData = State.getCatalogData();
    if (!catalogData || catalogData.length === 0) return;

    const scrollerRect = getScrollerViewportMetrics(scroller);
    let activeTurnEl = null;
    let activeTurnPos = 0;

    for (let i = 0; i < userTurns.length; i++) {
      const rect = userTurns[i].getBoundingClientRect();
      if (rect.top <= scrollerRect.top + 250) {
        activeTurnEl = userTurns[i];
        activeTurnPos = i;
      } else {
        break;
      }
    }

    if (!activeTurnEl) {
      activeTurnEl = userTurns[0];
      activeTurnPos = 0;
    }

    const ctx = buildDomLookupContext(catalogData, userTurns);
    let activeRoundIdx = inferCatalogRoundIndex(activeTurnEl, catalogData, ctx, activeTurnPos);

    if (activeRoundIdx === -1) {
      activeRoundIdx = resolveRoundFromNeighbors(userTurns, activeTurnPos, ctx);
    }

    let found = null;
    if (activeRoundIdx !== -1) {
      found = catalogData.find(item => item.roundIndex === activeRoundIdx && item.isTurnRoot) ||
              catalogData.find(item => item.roundIndex === activeRoundIdx);
    }

    if (found) {
      updateActiveTurnHighlight(found.turnIndex, found.turnCounter);
    }
  }

  function setupScrollSpy() {
    const scroller = getChatScrollContainer();
    if (!scroller || boundScrollers.has(scroller)) return;

    boundScrollers.add(scroller);
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

    if (catalogItem.type === 'text') {
      const textSpan = document.createElement('span');
      textSpan.className = 'catalog-prompt-text';
      textSpan.textContent = catalogItem.promptText;
      textSpan.title = catalogItem.promptText;
      content.appendChild(textSpan);
    } else {
      const category = catalogItem.fileCategory || 'file';
      const fileType = catalogItem.fileType || 'File';
      const fileName = catalogItem.fileName || fileType;

      const attRow = document.createElement('div');
      attRow.className = 'catalog-attachment-row';
      attRow.title = `[${fileType}] ${fileName}`;

      const iconSpan = document.createElement('span');
      iconSpan.className = `catalog-inline-icon catalog-icon-${category}`;
      iconSpan.innerHTML = getAttachmentIconSvg(category);
      attRow.appendChild(iconSpan);

      const tagSpan = document.createElement('span');
      tagSpan.className = `catalog-type-tag catalog-type-tag-${category}`;
      tagSpan.textContent = `[${fileType}]`;
      attRow.appendChild(tagSpan);

      const nameSpan = document.createElement('span');
      nameSpan.className = 'catalog-attachment-name';
      nameSpan.textContent = fileName;
      attRow.appendChild(nameSpan);

      content.appendChild(attRow);
    }
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
