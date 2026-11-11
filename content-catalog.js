(function (global) {
  'use strict';
  global.__AIStudioEnhancer__ = global.__AIStudioEnhancer__ || {};

  const State = global.__AIStudioEnhancer__.State;
  const Utils = global.__AIStudioEnhancer__.Utils;
  const Attachments = global.__AIStudioEnhancer__.Attachments;

  let catalogVisible = false;
  let scrollStopTimer = null;
  let isHoveringScrollButton = false;
  let nativePanelObserver = null;
  let currentlyObservedNativePanel = null;

  const boundScrollers = new WeakSet();
  const attachmentCache = new Map();

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

  const extractRoundAttachments = Attachments.extractRoundAttachments;

  // Query all currently rendered user chat turn DOM elements
  function getUserTurnElements() {
    return typeof Utils.getUserTurnElements === 'function' ? Utils.getUserTurnElements() : [];
  }

  // Extract visible prompt text from a chat turn element while skipping UI buttons/icons, attachments, and token counters
  function getCleanPromptText(turnEl) {
    if (!turnEl) return '';
    const container = turnEl.querySelector(Utils.SELECTORS.query.chatTurnContainer) || turnEl;

    const isIgnoredUiNode = (node) => {
      let cur = node.parentElement;
      while (cur && cur !== container) {
        const tag = cur.tagName;
        if (
          tag === 'BUTTON' ||
          tag === 'MAT-ICON' ||
          tag === 'SVG' ||
          tag === 'STYLE' ||
          tag === 'SCRIPT' ||
          tag === 'NOSCRIPT' ||
          tag === 'MS-FILE-CHUNK' ||
          tag === 'MS-DRIVE-FILE' ||
          tag === 'MS-IMAGE-CHUNK' ||
          tag === 'MS-MEDIA-CHUNK' ||
          tag === 'MS-YOUTUBE-CHUNK' ||
          tag === 'MS-VIDEO-CHUNK' ||
          tag === 'MS-AUDIO-CHUNK'
        ) {
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
          cur.classList.contains('sr-only') ||
          cur.classList.contains('file-chunk-container') ||
          cur.classList.contains('actions-container') ||
          cur.classList.contains('token-count') ||
          cur.classList.contains('loading-icon') ||
          cur.classList.contains('katex-mathml')
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
      .replace(/^\s*\|?(?:\s*:?-{2,}:?\s*\|)+\s*(?::?-{2,}:?\s*)?$/gm, ' ')
      .replace(/\|/g, ' ')
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
    return Array.from(turnEl.querySelectorAll('img')).filter(Utils.isTurnContentImage);
  }

  function getTurnContentFiles(turnEl) {
    if (!turnEl || !Attachments || typeof Attachments.getTurnFileElements !== 'function') return [];
    return Attachments.getTurnFileElements(turnEl);
  }

  function getTurnContentVideos(turnEl) {
    if (!turnEl) return [];
    const structured = Array.from(turnEl.querySelectorAll('ms-youtube-chunk, ms-video-chunk'));
    if (structured.length > 0) return structured;
    return Array.from(turnEl.querySelectorAll('iframe[src*="youtube"], video'));
  }

  function turnHasAttachment(turnEl) {
    if (!turnEl) return false;
    if (getTurnContentImages(turnEl).length > 0) return true;
    if (getTurnContentFiles(turnEl).length > 0) return true;
    if (getTurnContentVideos(turnEl).length > 0) return true;
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
      if (alt && (alt === cleanTarget || alt.includes(cleanTarget) || (alt.length >= 4 && cleanTarget.includes(alt)))) {
        return true;
      }
      if (img.src && !img.src.startsWith('data:') && cleanTarget.length >= 4 && img.src.toLowerCase().includes(cleanTarget)) {
        return true;
      }
    }
    return false;
  }

  function doesFileElementMatchName(fileEl, targetName) {
    if (!fileEl || !targetName) return false;
    const normTarget = normalizeTextForMatch(targetName);
    if (!normTarget) return false;

    const candidates = [];
    if (Attachments && typeof Attachments.extractFileInfo === 'function') {
      const info = Attachments.extractFileInfo(fileEl, 0, 1);
      if (info && !info.isDefaultName && info.fileName) {
        candidates.push(info.fileName);
      }
    }
    const nameEl = fileEl.querySelector('.name, [class*="file-name"], [class*="filename"]');
    if (nameEl) {
      candidates.push(
        nameEl.getAttribute('title'),
        nameEl.title,
        nameEl.getAttribute('data-filename'),
        nameEl.getAttribute('data-name'),
        nameEl.textContent
      );
    }
    candidates.push(
      fileEl.getAttribute('title'),
      fileEl.title,
      fileEl.getAttribute('data-filename'),
      fileEl.getAttribute('data-name'),
      fileEl.textContent
    );

    for (const raw of candidates) {
      if (!raw || typeof raw !== 'string') continue;
      const cleanRaw = raw.replace(/\s*[\d,.]+[kKmM]?\s*tokens?/gi, '').trim();
      if (!cleanRaw) continue;
      const normCand = normalizeTextForMatch(cleanRaw);
      if (!normCand) continue;
      if (normCand === normTarget || normCand.includes(normTarget) || normTarget.includes(normCand)) {
        return true;
      }
      // Handle visually truncated DOM display names (e.g. "transformer_wmt_benchmark.c...")
      if (/(\.\.\.|\u2026)$/.test(cleanRaw)) {
        const prefix = normalizeTextForMatch(cleanRaw.replace(/(\.\.\.|\u2026)+$/, ''));
        if (prefix && prefix.length >= 6 && normTarget.startsWith(prefix)) {
          return true;
        }
      }
    }
    return false;
  }

  // Check whether a turn element contains a file chunk/card matching a real (non-placeholder) filename
  function matchFileInTurn(turnEl, targetName) {
    if (!turnEl || !targetName) return false;
    const files = getTurnContentFiles(turnEl);
    for (const fel of files) {
      if (doesFileElementMatchName(fel, targetName)) {
        return true;
      }
    }
    return false;
  }

  function matchAttachmentInTurn(turnEl, fileName) {
    if (!turnEl || !fileName) return false;
    if (matchImageInTurn(turnEl, fileName)) return true;
    if (matchFileInTurn(turnEl, fileName)) return true;
    // File chips/cards in DOM always mark the turn as containing an attachment
    if (!turnHasAttachment(turnEl)) return false;
    const normTarget = normalizeTextForMatch(fileName);
    if (!normTarget) return false;
    const container = turnEl.querySelector(Utils.SELECTORS.query.chatTurnContainer) || turnEl;
    const rawTurnText = (container.textContent || '').replace(/[\d,.]+[kKmM]?\s*tokens?/gi, ' ');
    const normTurnText = normalizeTextForMatch(rawTurnText);
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
        if (round.hasAttachments && round.fullText && round.chunkEndDomIndex > round.chunkStartDomIndex) {
          probeSet.add(round.roundIndex);
        }
      }
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

      let verifiedProbes = 0;
      let coLocatedMultiChunkHits = 0;
      let contradictions = 0;

      for (const rIdx of probeSet) {
        const round = roundsSummary[rIdx];
        const el = userTurnElements[rIdx];
        if (!round || !el) continue;

        const normRoundText = compactTextForMatch(normalizeTextForMatch(round.fullText));
        const domText = getCleanPromptText(el);
        const normDomText = compactTextForMatch(normalizeTextForMatch(domText));
        const hasDomAtt = turnHasAttachment(el);
        const rawNonTokenLen = (el.textContent || '').replace(/[\d,.]+[kKmM]?\s*tokens?/gi, '').trim().length;
        // Skip empty unhydrated lazy placeholders so missing inner text/attachments are never counted as contradictions
        const isTurnHydrated = normDomText.length > 0 || hasDomAtt || rawNonTokenLen > 0;
        if (!isTurnHydrated) continue;

        let textMatched = false;
        let attMatched = false;

        if (round.fullText && normRoundText.length > 0) {
          if (normRoundText.length >= 6) {
            textMatched = textsLooselyMatch(domText, round.fullText);
            if (textMatched) {
              verifiedProbes++;
            } else if (normDomText.length >= 6) {
              contradictions++;
            }
          } else {
            textMatched = normDomText === normRoundText || normDomText.includes(normRoundText);
            if (textMatched) {
              verifiedProbes++;
            } else if (normDomText.length > 0) {
              contradictions++;
            }
          }
        }

        if (round.hasAttachments) {
          attMatched = hasDomAtt;
          if (attMatched) {
            verifiedProbes++;
          } else if (normDomText.length > 0 || rawNonTokenLen > 0) {
            contradictions++;
          }
        }

        if (round.chunkEndDomIndex > round.chunkStartDomIndex && round.hasAttachments && round.fullText && textMatched && attMatched) {
          coLocatedMultiChunkHits++;
        }
      }

      if (coLocatedMultiChunkHits > 0 && contradictions === 0) {
        return { mode: 'round', totalDomTurns: totalRounds };
      }
      if (contradictions >= 2 || (contradictions >= 1 && verifiedProbes === 0) || (contradictions > 0 && coLocatedMultiChunkHits === 0)) {
        return { mode: 'chunk', totalDomTurns: totalUserChunks };
      }
      if (verifiedProbes > 0) {
        return { mode: 'round', totalDomTurns: totalRounds };
      }
    }

    // Partially rendered DOM (virtualized / lazy-hydrated):
    // 1. Positive co-located check: a visible multi-chunk round already showing both text and attachments proves 'round' mode
    const multiChunkMatchesWithoutAtt = [];
    for (const round of roundsSummary) {
      if (
        round.chunkEndDomIndex > round.chunkStartDomIndex &&
        round.hasAttachments &&
        round.fullText &&
        compactTextForMatch(normalizeTextForMatch(round.fullText)).length >= 6
      ) {
        const matchedEls = userTurnElements.filter(el => textsLooselyMatch(getCleanPromptText(el), round.fullText));
        if (matchedEls.length === 1) {
          if (turnHasAttachment(matchedEls[0])) {
            return { mode: 'round', totalDomTurns: totalRounds };
          }
          multiChunkMatchesWithoutAtt.push(round);
        }
      }
    }

    // 2. Compare pairwise DOM gaps between unique visible text anchors vs round vs chunk spacing
    // (runs before inferring 'chunk' from missing attachment DOM in case attachments load lazily)
    if (userTurnElements.length >= 2) {
      const roundCompCount = new Map();
      const roundCompMap = new Map();
      for (const r of roundsSummary) {
        if (!r.fullText) continue;
        const c = compactTextForMatch(normalizeTextForMatch(r.fullText));
        if (c.length >= 6) {
          roundCompCount.set(c, (roundCompCount.get(c) || 0) + 1);
          roundCompMap.set(r.roundIndex, c);
        }
      }
      const uniqueAnchors = [];
      for (let p = 0; p < userTurnElements.length; p++) {
        const domTxt = getCleanPromptText(userTurnElements[p]);
        const dComp = compactTextForMatch(normalizeTextForMatch(domTxt));
        if (dComp.length < 6) continue;
        let matchedRound = null;
        let hits = 0;
        for (const r of roundsSummary) {
          const rComp = roundCompMap.get(r.roundIndex);
          if (!rComp || roundCompCount.get(rComp) !== 1) continue;
          if (textsLooselyMatch(domTxt, r.fullText)) {
            matchedRound = r;
            hits++;
            if (hits > 1) break;
          }
        }
        if (hits === 1 && matchedRound) {
          uniqueAnchors.push({ domPos: p, round: matchedRound });
        }
      }
      let roundVotes = 0;
      let chunkVotes = 0;
      for (let i = 0; i < uniqueAnchors.length; i++) {
        for (let j = i + 1; j < uniqueAnchors.length; j++) {
          const a = uniqueAnchors[i];
          const b = uniqueAnchors[j];
          const domDelta = b.domPos - a.domPos;
          const roundDelta = b.round.roundIndex - a.round.roundIndex;
          const chunkDelta = b.round.chunkTextDomIndex - a.round.chunkTextDomIndex;
          if (domDelta > 0 && roundDelta !== chunkDelta) {
            if (domDelta === roundDelta) roundVotes++;
            else if (domDelta === chunkDelta) chunkVotes++;
          }
        }
      }
      if (roundVotes > 0 && chunkVotes === 0) {
        return { mode: 'round', totalDomTurns: totalRounds };
      }
      if (chunkVotes > 0 && roundVotes === 0) {
        return { mode: 'chunk', totalDomTurns: totalUserChunks };
      }
    }

    // 3. Fallback when spacing was ambiguous but a multi-chunk round's text turn has no attachment
    if (multiChunkMatchesWithoutAtt.length > 0) {
      return { mode: 'chunk', totalDomTurns: totalUserChunks };
    }

    const existingStamped = document.querySelector('ms-chat-turn[data-enhancer-dom-mode]');
    if (existingStamped) {
      const m = existingStamped.getAttribute('data-enhancer-dom-mode');
      if (m === 'round') return { mode: 'round', totalDomTurns: totalRounds };
      if (m === 'chunk') return { mode: 'chunk', totalDomTurns: totalUserChunks };
    }

    return { mode: null, totalDomTurns: totalRounds };
  }

  function getAttachmentCacheKey(roundIdx, itemOrType, subIdxOpt) {
    if (itemOrType && typeof itemOrType === 'object') {
      const type = itemOrType.type || 'file';
      const subIdx = itemOrType.subIndex !== undefined ? itemOrType.subIndex : 0;
      return `${roundIdx}_${type}_${subIdx}`;
    }
    const type = itemOrType || 'file';
    const subIdx = subIdxOpt !== undefined ? subIdxOpt : 0;
    return `${roundIdx}_${type}_${subIdx}`;
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
        chunkEndDomIndex: round.endDomIndex,
        chunkTextDomIndex: round.textDomIndex
      };
    });

    const detected = detectDomLayoutMode(userTurnElements, roundsSummary, totalUserChunks);
    const effectiveMode = detected.mode || 'round';
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
      let textTurnElement = null;
      if (isFullDomPresent) {
        if (effectiveMode === 'round') {
          if (userTurnElements[roundIdx]) {
            turnElement = userTurnElements[roundIdx];
            textTurnElement = turnElement;
            roundElements.push({ element: turnElement, domIndex: roundIdx });
          }
        } else {
          for (let d = round.startDomIndex; d <= round.endDomIndex; d++) {
            if (userTurnElements[d]) {
              roundElements.push({ element: userTurnElements[d], domIndex: d });
            }
          }
          turnElement = userTurnElements[round.startDomIndex] || null;
          textTurnElement = userTurnElements[round.textDomIndex] || turnElement;
        }
      } else if (fullText && userTurnElements.length > 0 && compactTextForMatch(normalizeTextForMatch(fullText)).length >= 6) {
        const sameTextRoundsCount = roundsSummary.filter(r => r.fullText && textsLooselyMatch(r.fullText, fullText)).length;
        if (sameTextRoundsCount === 1) {
          const textMatches = userTurnElements.filter(el => textsLooselyMatch(getCleanPromptText(el), fullText));
          if (textMatches.length === 1) {
            const matchedEl = textMatches[0];
            textTurnElement = matchedEl;
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
      const textElementId = textTurnElement && textTurnElement.id ? textTurnElement.id : turnElementId;

      // Extract attachments from matched DOM elements (if safely resolved) and API chunks in this round
      const attachments = extractRoundAttachments(round.chunks, roundElements, fullText);

      // Synchronize with attachmentCache: restore known real names or save newly resolved ones
      let imageIdxInRound = 0;
      let fileIdxInRound = 0;
      attachments.forEach((att, attIdx) => {
        if (att.subIndex === undefined) {
          if (att.type === 'image') {
            att.subIndex = imageIdxInRound++;
          } else if (att.type === 'file') {
            att.subIndex = fileIdxInRound++;
          } else {
            att.subIndex = attIdx;
          }
        }
        const cacheKey = getAttachmentCacheKey(roundIdx, att);
        const existingCache = attachmentCache.get(cacheKey);
        const needsCacheRestore = Boolean(
          att.isDefaultName ||
          (att.type === 'file' && att.isTruncatedName)
        );

        if (!att.isDefaultName && att.fileName) {
          const shouldSaveToCache =
            !existingCache ||
            (existingCache.isTruncatedName && !att.isTruncatedName) ||
            (existingCache.fileType === 'FILE' && att.fileType !== 'FILE') ||
            !att.isTruncatedName;
          if (shouldSaveToCache) {
            attachmentCache.set(cacheKey, {
              fileName: att.fileName,
              fileType: att.fileType,
              fileCategory: att.fileCategory,
              isTruncatedName: Boolean(att.isTruncatedName)
            });
          }
        }

        if (needsCacheRestore && existingCache && existingCache.fileName) {
          const cacheIsBetter =
            att.isDefaultName ||
            (!existingCache.isTruncatedName && att.isTruncatedName) ||
            (existingCache.fileType !== 'FILE' && att.fileType === 'FILE');
          if (cacheIsBetter) {
            const preservedType = (!existingCache.fileType || existingCache.fileType === 'FILE') && att.fileType && att.fileType !== 'FILE'
              ? att.fileType
              : existingCache.fileType;
            const preservedCat = (!existingCache.fileType || existingCache.fileType === 'FILE') && att.fileType && att.fileType !== 'FILE'
              ? att.fileCategory
              : (existingCache.fileCategory || att.fileCategory);
            att.fileName = existingCache.fileName;
            att.fileType = preservedType;
            att.fileCategory = preservedCat;
            att.isDefaultName = false;
            att.isTruncatedName = Boolean(existingCache.isTruncatedName);
          }
        }
      });

      const resolvedStartDomIndex = effectiveMode === 'round' ? roundIdx : round.startDomIndex;
      const resolvedEndDomIndex = effectiveMode === 'round' ? roundIdx : round.endDomIndex;
      const resolvedTextDomIndex = effectiveMode === 'round' ? roundIdx : round.textDomIndex;

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
          targetDomIndex: resolvedTextDomIndex,
          chunkStartDomIndex: round.startDomIndex,
          chunkEndDomIndex: round.endDomIndex,
          chunkTextDomIndex: round.textDomIndex,
          chunkTargetDomIndex: round.textDomIndex,
          turnElementId: textElementId,
          promptText: fullText,
          pureText: fullText,
          displayText: fullText,
          truncatedText: Utils.truncateText(fullText, 50),
          role: 'user'
        });

        // Each attachment is indented directly below the prompt text (isTurnRoot: false)
        let imgCounter = 0;
        let fileCounter = 0;
        attachments.forEach((att, attIdx) => {
          const subIndex = att.subIndex !== undefined
            ? att.subIndex
            : (att.type === 'image' ? imgCounter++ : (att.type === 'file' ? fileCounter++ : attIdx));
          const attChunk = round.chunks.find(c => c.index === att.turnIndex);
          const chunkAttDomIndex = attChunk
            ? attChunk.domIndex
            : ((effectiveMode !== 'round' && att.domIndex !== undefined) ? att.domIndex : round.startDomIndex);
          const attTargetDomIndex = effectiveMode === 'round' ? roundIdx : chunkAttDomIndex;
          const attDomEl = isFullDomPresent ? userTurnElements[attTargetDomIndex] : null;
          const attElementId = (attDomEl && attDomEl.id) ? attDomEl.id : (chunkAttDomIndex === round.startDomIndex ? turnElementId : null);

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
            isTruncatedName: Boolean(att.isTruncatedName),
            driveFileId: att.driveFileId || '',
            pureText: fullText,
            turnIndex: att.turnIndex !== undefined ? att.turnIndex : primaryIndex,
            startDomIndex: resolvedStartDomIndex,
            endDomIndex: resolvedEndDomIndex,
            targetDomIndex: attTargetDomIndex,
            chunkStartDomIndex: round.startDomIndex,
            chunkEndDomIndex: round.endDomIndex,
            chunkTextDomIndex: round.textDomIndex,
            chunkTargetDomIndex: chunkAttDomIndex,
            turnElementId: attElementId,
            promptText: `[${att.fileType}] ${att.fileName}`,
            displayText: att.fileName,
            subIndex: subIndex,
            role: 'user'
          });
        });
      } else if (attachments.length > 0) {
        // B. Round has NO text, only attachments: first attachment is turn root
        let imgCounter = 0;
        let fileCounter = 0;
        attachments.forEach((att, attIdx) => {
          const isRoot = attIdx === 0;
          const subIndex = att.subIndex !== undefined
            ? att.subIndex
            : (att.type === 'image' ? imgCounter++ : (att.type === 'file' ? fileCounter++ : attIdx));
          const attChunk = round.chunks.find(c => c.index === att.turnIndex);
          const chunkAttDomIndex = attChunk
            ? attChunk.domIndex
            : ((effectiveMode !== 'round' && att.domIndex !== undefined) ? att.domIndex : round.startDomIndex);
          const attTargetDomIndex = effectiveMode === 'round' ? roundIdx : chunkAttDomIndex;
          const attDomEl = isFullDomPresent ? userTurnElements[attTargetDomIndex] : null;
          const attElementId = (attDomEl && attDomEl.id) ? attDomEl.id : (chunkAttDomIndex === round.startDomIndex ? turnElementId : null);

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
            isTruncatedName: Boolean(att.isTruncatedName),
            driveFileId: att.driveFileId || '',
            pureText: '',
            turnIndex: att.turnIndex !== undefined ? att.turnIndex : primaryIndex,
            startDomIndex: resolvedStartDomIndex,
            endDomIndex: resolvedEndDomIndex,
            targetDomIndex: attTargetDomIndex,
            chunkStartDomIndex: round.startDomIndex,
            chunkEndDomIndex: round.endDomIndex,
            chunkTextDomIndex: round.textDomIndex,
            chunkTargetDomIndex: chunkAttDomIndex,
            turnElementId: attElementId,
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
    activeNavState = null;
    lastNavigationEndAt = 0;
    const stampedTurns = document.querySelectorAll('ms-chat-turn[data-enhancer-dom-index]');
    stampedTurns.forEach((el) => {
      el.removeAttribute('data-enhancer-dom-index');
      el.removeAttribute('data-enhancer-dom-mode');
    });
  }

  function applyDriveResolvedToCatalogItem(item, driveRec, defaultFileWord) {
    if (!item || !driveRec || !Attachments || typeof Attachments.resolveAttachmentFromDriveMetadata !== 'function') {
      return false;
    }
    const isImage = item.type === 'image';
    const resolved = Attachments.resolveAttachmentFromDriveMetadata(driveRec, isImage ? 'image' : 'file');
    if (!resolved) return false;

    const driveRank = typeof driveRec.s === 'number' ? driveRec.s : 1;
    const hasResolvedName = Boolean(resolved.fileName && !resolved.isDefaultName);
    const hasExplicitMimeType = Boolean(!isImage && resolved.hasExplicitType && resolved.fileType !== 'FILE');

    if (!hasResolvedName && !hasExplicitMimeType) {
      return false;
    }

    let shouldApply = false;
    if (hasResolvedName) {
      if (item.isDefaultName) {
        shouldApply = true;
      } else if (!isImage && item.isTruncatedName && !resolved.isTruncatedName) {
        shouldApply = true;
      } else if (
        driveRank >= 3 &&
        !resolved.isTruncatedName &&
        (resolved.fileName !== item.fileName ||
          (resolved.fileType !== 'FILE' && resolved.fileType !== item.fileType) ||
          (resolved.fileCategory !== 'file' && resolved.fileCategory !== item.fileCategory))
      ) {
        shouldApply = true;
      } else if (!resolved.isTruncatedName && !isImage && item.fileType === 'FILE' && resolved.fileType !== 'FILE') {
        shouldApply = true;
      }
    } else if (hasExplicitMimeType && item.isDefaultName && item.fileType === 'FILE') {
      shouldApply = true;
    }

    if (!shouldApply) return false;

    let nextFileName = item.fileName;
    let nextFileType = item.fileType;
    let nextCategory = item.fileCategory;
    let nextIsDefault = Boolean(item.isDefaultName);
    let nextIsTruncated = Boolean(item.isTruncatedName);

    if (hasResolvedName) {
      nextFileName = resolved.fileName;
      if (isImage) {
        nextFileType = resolved.fileType || 'IMG';
        nextCategory = 'image';
      } else {
        const keepItemType = resolved.fileType === 'FILE' && item.fileType && item.fileType !== 'FILE' && resolved.fileName === item.fileName;
        nextFileType = keepItemType ? item.fileType : (resolved.fileType || 'FILE');
        nextCategory = keepItemType ? (item.fileCategory || 'file') : (resolved.fileCategory || 'file');
      }
      nextIsDefault = false;
      nextIsTruncated = Boolean(resolved.isTruncatedName);
    } else if (hasExplicitMimeType) {
      nextFileType = resolved.fileType;
      nextCategory = resolved.fileCategory;
      if (resolved.friendlyType && resolved.friendlyType !== 'File') {
        nextFileName = `${resolved.friendlyType} ${defaultFileWord}`;
      }
      nextIsDefault = true;
      nextIsTruncated = false;
    }

    const changed =
      nextFileName !== item.fileName ||
      nextFileType !== item.fileType ||
      nextCategory !== item.fileCategory ||
      nextIsDefault !== Boolean(item.isDefaultName) ||
      nextIsTruncated !== Boolean(item.isTruncatedName);

    item.fileName = nextFileName;
    item.fileType = nextFileType;
    item.fileCategory = nextCategory;
    item.promptText = `[${nextFileType}] ${nextFileName}`;
    item.displayText = nextFileName;
    item.isDefaultName = nextIsDefault;
    item.isTruncatedName = nextIsTruncated;

    if (!nextIsDefault && nextFileName) {
      const cacheKey = getAttachmentCacheKey(item.roundIndex, item);
      attachmentCache.set(cacheKey, {
        fileName: nextFileName,
        fileType: nextFileType,
        fileCategory: nextCategory,
        isTruncatedName: nextIsTruncated
      });
    }

    return changed;
  }

  function refreshCatalogFromDriveCache(targetDriveId) {
    const catalogData = State.getCatalogData();
    if (!catalogData || catalogData.length === 0) return false;
    if (typeof State.getDriveMetadata !== 'function') return false;

    const defaultFileWord = chrome.i18n.getMessage('fileLabel') || 'File';
    let updated = false;

    catalogData.forEach((item) => {
      if (item.type !== 'image' && item.type !== 'file') return;
      if (!item.driveFileId) return;
      if (targetDriveId && item.driveFileId !== targetDriveId) return;

      const driveRec = State.getDriveMetadata(item.driveFileId);
      if (!driveRec) return;

      if (applyDriveResolvedToCatalogItem(item, driveRec, defaultFileWord)) {
        updated = true;
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
    ).filter(Utils.isTurnContentImage);

    const liveFiles = [];
    document.querySelectorAll('.chat-turn-container.user').forEach((userCont) => {
      liveFiles.push(...getTurnContentFiles(userCont));
    });

    let updated = false;
    const defaultFileWord = chrome.i18n.getMessage('fileLabel') || 'File';

    const imageItems = catalogData.filter(item => item.type === 'image');
    const imageRoundIndices = new Set(imageItems.map(item => item.roundIndex));
    const singleImageRound = imageRoundIndices.size === 1;

    const fileItems = catalogData.filter(item => item.type === 'file');
    const fileRoundIndices = new Set(fileItems.map(item => item.roundIndex));
    const singleFileRound = fileRoundIndices.size === 1;

    const needsAttachmentEnrichment = (item) => Boolean(
      item.isDefaultName ||
      (item.type === 'file' && item.isTruncatedName)
    );

    catalogData.forEach(item => {
      if (item.type !== 'image' && item.type !== 'file') return;

      const isImage = item.type === 'image';
      const roundIdx = item.roundIndex;
      const subIdx = item.subIndex !== undefined ? item.subIndex : 0;
      const cacheKey = getAttachmentCacheKey(roundIdx, item);
      const getElsForTurn = isImage ? getTurnContentImages : getTurnContentFiles;
      const typeItems = isImage ? imageItems : fileItems;
      const livePool = isImage ? liveImages : liveFiles;
      const isSingleRoundForType = isImage ? singleImageRound : singleFileRound;

      if (needsAttachmentEnrichment(item)) {
        // 1A. Check persistent Drive metadata cache first when Drive File ID is known
        if (item.driveFileId && typeof State.getDriveMetadata === 'function') {
          const driveRec = State.getDriveMetadata(item.driveFileId);
          if (driveRec && applyDriveResolvedToCatalogItem(item, driveRec, defaultFileWord)) {
            updated = true;
            if (!needsAttachmentEnrichment(item)) return;
          }
        }

        // 1B. Check per-session fallback cache
        if (attachmentCache.has(cacheKey)) {
          const cached = attachmentCache.get(cacheKey);
          const cacheIsBetter =
            item.isDefaultName ||
            (!cached.isTruncatedName && item.isTruncatedName) ||
            (cached.fileType !== 'FILE' && item.fileType === 'FILE');
          if (cacheIsBetter && cached.fileName) {
            const preservedType = (!cached.fileType || cached.fileType === 'FILE') && item.fileType && item.fileType !== 'FILE'
              ? item.fileType
              : cached.fileType;
            const preservedCat = (!cached.fileType || cached.fileType === 'FILE') && item.fileType && item.fileType !== 'FILE'
              ? item.fileCategory
              : (cached.fileCategory || item.fileCategory);
            item.fileName = cached.fileName;
            item.fileType = preservedType;
            if (preservedCat) item.fileCategory = preservedCat;
            item.promptText = `[${preservedType}] ${cached.fileName}`;
            item.displayText = cached.fileName;
            item.isDefaultName = false;
            item.isTruncatedName = Boolean(cached.isTruncatedName);
            updated = true;
            if (!needsAttachmentEnrichment(item)) return;
          }
        }

        // 2. Scan live DOM
        let targetEl = null;
        let roundContainerResolved = false;
        const roundTurnEls = [];
        const roundTypeItems = typeItems.filter(x => x.roundIndex === roundIdx);
        const roundTotalCount = roundTypeItems.length || 1;

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
            const sameChunkItems = roundTypeItems.filter(x => x.chunkTargetDomIndex === item.chunkTargetDomIndex);
            const localIdx = Math.max(0, sameChunkItems.indexOf(item));
            targetEl = getElsForTurn(targetChunkEl)[localIdx] || null;
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
                  const sameChunkItems = roundTypeItems.filter(x => x.chunkTargetDomIndex === item.chunkTargetDomIndex);
                  const localIdx = Math.max(0, sameChunkItems.indexOf(item));
                  targetEl = getElsForTurn(targetChunkEl)[localIdx] || null;
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

        if (!targetEl && roundTurnEls.length > 0) {
          const roundEls = [];
          roundTurnEls.forEach((turnEl) => {
            roundEls.push(...getElsForTurn(turnEl));
          });
          targetEl = roundEls[subIdx] || null;
        }

        // Strategy B: Fallback to user-turn live pool only if the round's DOM container wasn't already localized
        if (!targetEl && !roundContainerResolved && livePool.length > 0) {
          if (isSingleRoundForType && (roundTotalCount === 1 || livePool.length === roundTotalCount)) {
            targetEl = livePool[subIdx] || null;
          } else if (item.pureText && compactTextForMatch(normalizeTextForMatch(item.pureText)).length >= 6) {
            const sameTextRoundsCount = roundsSummary.filter(r => r.fullText && textsLooselyMatch(r.fullText, item.pureText)).length;
            if (sameTextRoundsCount === 1) {
              const matchedPool = livePool.filter(el => {
                const parentTurn = el.closest(Utils.SELECTORS.query.chatTurn) || el.closest('.chat-turn-container.user');
                if (!parentTurn) return false;
                return textsLooselyMatch(getCleanPromptText(parentTurn), item.pureText);
              });
              targetEl = matchedPool[subIdx] || null;
            }
          }
        }

        if (targetEl) {
          const info = isImage
            ? Attachments.extractImageInfo(targetEl, subIdx, roundTotalCount)
            : Attachments.extractFileInfo(targetEl, subIdx, roundTotalCount);
          const infoImprovesItem = !info.isDefaultName && info.fileName && (
            item.isDefaultName ||
            (!info.isTruncatedName && info.fileType !== 'FILE') ||
            info.fileName !== item.fileName
          );
          if (infoImprovesItem) {
            const nextFileType = (!isImage && info.fileType === 'FILE' && item.fileType && item.fileType !== 'FILE')
              ? item.fileType
              : info.fileType;
            const nextCategory = (!isImage && info.fileType === 'FILE' && item.fileCategory && item.fileCategory !== 'file')
              ? item.fileCategory
              : (info.fileCategory || (isImage ? 'image' : 'file'));

            item.fileName = info.fileName;
            item.fileType = nextFileType;
            item.fileCategory = nextCategory;
            item.promptText = `[${nextFileType}] ${info.fileName}`;
            item.displayText = info.fileName;
            item.isDefaultName = false;
            item.isTruncatedName = Boolean(info.isTruncatedName);
            attachmentCache.set(cacheKey, {
              fileName: info.fileName,
              fileType: nextFileType,
              fileCategory: nextCategory,
              isTruncatedName: Boolean(info.isTruncatedName)
            });

            // Reverse-persist DOM-resolved name into global Drive cache (e.g. when Drive XHR was HTTP-cached)
            if (item.driveFileId && typeof State.setDriveMetadata === 'function') {
              State.setDriveMetadata(item.driveFileId, {
                name: info.fileName,
                fileExtension: (!info.isTruncatedName && nextFileType && nextFileType !== 'FILE' && nextFileType !== 'IMG')
                  ? nextFileType.toLowerCase()
                  : '',
                source: info.isTruncatedName ? 'dom_truncated' : 'dom_full'
              });
            }
            updated = true;
          }
        }
      } else if (item.fileName && !item.isDefaultName) {
        const existingCache = attachmentCache.get(cacheKey);
        const shouldSaveToCache =
          !existingCache ||
          (existingCache.isTruncatedName && !item.isTruncatedName) ||
          (existingCache.fileType === 'FILE' && item.fileType !== 'FILE') ||
          !item.isTruncatedName;
        if (shouldSaveToCache) {
          attachmentCache.set(cacheKey, {
            fileName: item.fileName,
            fileType: item.fileType,
            fileCategory: item.fileCategory,
            isTruncatedName: Boolean(item.isTruncatedName)
          });
        }
        if (item.driveFileId && typeof State.setDriveMetadata === 'function') {
          State.setDriveMetadata(item.driveFileId, {
            name: item.fileName,
            fileExtension: (!item.isTruncatedName && item.fileType && item.fileType !== 'FILE' && item.fileType !== 'IMG')
              ? item.fileType.toLowerCase()
              : '',
            source: item.isTruncatedName ? 'dom_truncated' : 'dom_full'
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
          const canRestore = Boolean(
            (newItem.type === 'image' || newItem.type === 'file') &&
            (newItem.isDefaultName || (newItem.type === 'file' && newItem.isTruncatedName))
          );
          if (canRestore) {
            const cacheKey = getAttachmentCacheKey(newItem.roundIndex, newItem);
            if (attachmentCache.has(cacheKey)) {
              const cached = attachmentCache.get(cacheKey);
              const cacheIsBetter =
                newItem.isDefaultName ||
                (!cached.isTruncatedName && newItem.isTruncatedName) ||
                (cached.fileType !== 'FILE' && newItem.fileType === 'FILE');
              if (cacheIsBetter && cached.fileName) {
                const preservedType = (!cached.fileType || cached.fileType === 'FILE') && newItem.fileType && newItem.fileType !== 'FILE'
                  ? newItem.fileType
                  : cached.fileType;
                const preservedCat = (!cached.fileType || cached.fileType === 'FILE') && newItem.fileType && newItem.fileType !== 'FILE'
                  ? newItem.fileCategory
                  : (cached.fileCategory || newItem.fileCategory);
                newItem.fileName = cached.fileName;
                newItem.fileType = preservedType;
                if (preservedCat) newItem.fileCategory = preservedCat;
                newItem.promptText = `[${preservedType}] ${cached.fileName}`;
                newItem.displayText = cached.fileName;
                newItem.isDefaultName = false;
                newItem.isTruncatedName = Boolean(cached.isTruncatedName);
              }
            } else {
              const matchOld = oldData.find(o =>
                o.type === newItem.type &&
                o.roundIndex === newItem.roundIndex &&
                o.subIndex === newItem.subIndex &&
                (!o.pureText || !newItem.pureText || textsLooselyMatch(o.pureText, newItem.pureText)) &&
                !o.isDefaultName &&
                o.fileName
              );
              if (matchOld) {
                const oldIsBetter =
                  newItem.isDefaultName ||
                  (!matchOld.isTruncatedName && newItem.isTruncatedName) ||
                  (matchOld.fileType !== 'FILE' && newItem.fileType === 'FILE');
                if (oldIsBetter) {
                  const preservedType = (!matchOld.fileType || matchOld.fileType === 'FILE') && newItem.fileType && newItem.fileType !== 'FILE'
                    ? newItem.fileType
                    : matchOld.fileType;
                  const preservedCat = (!matchOld.fileType || matchOld.fileType === 'FILE') && newItem.fileType && newItem.fileType !== 'FILE'
                    ? newItem.fileCategory
                    : (matchOld.fileCategory || newItem.fileCategory);
                  newItem.fileName = matchOld.fileName;
                  newItem.fileType = preservedType;
                  if (preservedCat) newItem.fileCategory = preservedCat;
                  newItem.promptText = `[${preservedType}] ${matchOld.fileName}`;
                  newItem.displayText = matchOld.fileName;
                  newItem.isDefaultName = false;
                  newItem.isTruncatedName = Boolean(matchOld.isTruncatedName);
                  attachmentCache.set(cacheKey, {
                    fileName: matchOld.fileName,
                    fileType: preservedType,
                    fileCategory: preservedCat,
                    isTruncatedName: Boolean(matchOld.isTruncatedName)
                  });
                }
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
              newData[i].fileType !== oldData[i].fileType ||
              newData[i].fileCategory !== oldData[i].fileCategory ||
              newData[i].isDefaultName !== oldData[i].isDefaultName ||
              newData[i].isTruncatedName !== oldData[i].isTruncatedName ||
              newData[i].driveFileId !== oldData[i].driveFileId ||
              newData[i].targetDomIndex !== oldData[i].targetDomIndex ||
              newData[i].chunkTargetDomIndex !== oldData[i].chunkTargetDomIndex ||
              newData[i].domLayoutMode !== oldData[i].domLayoutMode) {
            isDifferent = true;
            break;
          }
        }
      }

      if (newData.length === 0) {
        activeNavState = null;
        lastNavigationEndAt = 0;
      } else if (activeNavState && activeNavState.catalogItem) {
        const navItem = activeNavState.catalogItem;
        const stillExists = newData.some(item =>
          item.roundIndex === navItem.roundIndex &&
          item.type === navItem.type &&
          (!navItem.pureText || !item.pureText || textsLooselyMatch(item.pureText, navItem.pureText))
        );
        if (!stillExists) {
          activeNavState = null;
          lastNavigationEndAt = 0;
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
                if (
                  !shouldEnrich &&
                  ((node.classList && node.classList.contains('loading-icon')) ||
                    (node.querySelector && node.querySelector('.loading-icon')))
                ) {
                  const targetUserCont = mutation.target && mutation.target.closest
                    ? mutation.target.closest('.chat-turn-container.user')
                    : null;
                  if (targetUserCont) {
                    shouldEnrich = true;
                  }
                }
              }
            }
          }
          if (!shouldEnrich && mutation.addedNodes && mutation.addedNodes.length > 0) {
            for (let i = 0; i < mutation.addedNodes.length; i++) {
              const node = mutation.addedNodes[i];
              if (node.nodeType === Node.ELEMENT_NODE) {
                const tag = node.tagName.toLowerCase();
                if (
                  tag === 'img' ||
                  tag === 'ms-image-chunk' ||
                  tag === 'ms-file-chunk' ||
                  tag === 'ms-media-chunk' ||
                  tag === 'ms-drive-file' ||
                  tag === 'ms-chat-turn' ||
                  tag === 'ms-prompt-chunk'
                ) {
                  shouldEnrich = true;
                  break;
                } else if (node.querySelector && node.querySelector('img, ms-image-chunk, ms-file-chunk, ms-media-chunk, ms-drive-file, .file-chunk-container, span.name')) {
                  shouldEnrich = true;
                  break;
                }
              } else if (node.nodeType === Node.TEXT_NODE) {
                const parent = mutation.target;
                if (
                  parent &&
                  parent.closest &&
                  parent.closest('.chat-turn-container.user') &&
                  parent.closest('ms-file-chunk, ms-media-chunk, ms-drive-file, .file-chunk-container, span.name')
                ) {
                  shouldEnrich = true;
                  break;
                }
              }
            }
          }
        } else if (mutation.type === 'characterData') {
          if (!shouldEnrich) {
            const parent = mutation.target && mutation.target.parentElement;
            if (
              parent &&
              parent.closest &&
              parent.closest('.chat-turn-container.user') &&
              parent.closest('ms-file-chunk, ms-media-chunk, ms-drive-file, .file-chunk-container, span.name')
            ) {
              const data = State.getCatalogData();
              if (data && data.some(item => item.type === 'file' && (item.isDefaultName || item.isTruncatedName))) {
                shouldEnrich = true;
              }
            }
          }
        } else if (mutation.type === 'attributes') {
          const target = mutation.target;
          if (target && target.closest && target.closest('.chat-turn-container.user')) {
            const tag = target.tagName ? target.tagName.toLowerCase() : '';
            const data = State.getCatalogData();
            if (data && data.length > 0) {
              if (tag === 'img' && data.some(item => item.type === 'image' && item.isDefaultName)) {
                shouldEnrich = true;
              } else if (
                (tag === 'ms-file-chunk' ||
                  tag === 'ms-media-chunk' ||
                  tag === 'ms-drive-file' ||
                  (target.classList && target.classList.contains('name')) ||
                  target.closest('ms-file-chunk, ms-media-chunk, ms-drive-file')) &&
                data.some(item => item.type === 'file' && (item.isDefaultName || item.isTruncatedName))
              ) {
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
      characterData: true,
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
  let navigationToken = 0;
  let lastNavigationEndAt = 0;
  let activeNavState = null; // Preserves the clicked catalog item across post-landing render updates

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
    const clientTop = scroller.clientTop || 0;
    const visibleHeight = scroller.clientHeight > 0
      ? Math.min(rect.height || scroller.clientHeight, scroller.clientHeight)
      : rect.height;
    return { top: rect.top + clientTop, height: visibleHeight };
  }

  function computeDesiredTop(targetRect, scrollerMetrics, catalogItem) {
    const isAttachment = Boolean(catalogItem && catalogItem.type !== 'text');
    if (!isAttachment) return 80;
    const targetH = targetRect ? targetRect.height : 0;
    if (!targetH || targetH <= 0) return 80;
    return Math.max(80, Math.round((scrollerMetrics.height - targetH) / 2));
  }

  function applyNavSelectionHighlight(list, catalogItem, includeFlightClass) {
    if (!list || !catalogItem) return;
    const targetSub = catalogItem.subIndex !== undefined && catalogItem.subIndex !== null
      ? String(catalogItem.subIndex)
      : '';
    const targetType = catalogItem.type || 'text';
    const allItems = list.querySelectorAll('.catalog-list-item');
    allItems.forEach((el) => {
      const idx = el.getAttribute('data-turn-index');
      const counter = el.getAttribute('data-turn-counter');
      const elSub = el.getAttribute('data-sub-index') || '';
      const elType = el.getAttribute('data-item-type') || '';

      const matchesCounter = (catalogItem.turnCounter !== undefined && counter === String(catalogItem.turnCounter));
      const matchesIdx = (idx !== null && parseInt(idx, 10) === catalogItem.turnIndex);
      const matchesTurn = matchesCounter || matchesIdx;

      const matchesType = !elType || elType === targetType;
      const isExactTarget = matchesTurn && matchesType && elSub === targetSub;
      const isTurnRoot = matchesTurn && (el.getAttribute('data-is-turn-root') === 'true' || elSub === '');

      if (isExactTarget || isTurnRoot) {
        el.classList.add('catalog-item-selected');
      } else {
        el.classList.remove('catalog-item-selected');
      }

      if (includeFlightClass && isExactTarget) {
        el.classList.add('catalog-item-navigating');
      } else {
        el.classList.remove('catalog-item-navigating');
      }
    });
  }

  function getChatMainContainer() {
    return getChatScrollContainer();
  }

  // Hardware-synchronized 60fps/120fps ease-out cubic scroll animation with live target support
  function animateScrollTo(scroller, targetTopOrGetter, duration, onComplete) {
    if (!scroller) return () => {};

    const resolveTarget = () => {
      const raw = typeof targetTopOrGetter === 'function' ? targetTopOrGetter() : targetTopOrGetter;
      const liveMaxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      return Math.max(0, Math.min(liveMaxScroll, raw));
    };

    const prevScrollBehavior = scroller.style.scrollBehavior;
    const computedBehavior = window.getComputedStyle ? window.getComputedStyle(scroller).scrollBehavior : '';
    const shouldOverrideBehavior = computedBehavior === 'smooth' || prevScrollBehavior === 'smooth';
    if (shouldOverrideBehavior) {
      scroller.style.scrollBehavior = 'auto';
    }
    const restoreScrollBehavior = () => {
      if (shouldOverrideBehavior) {
        scroller.style.scrollBehavior = prevScrollBehavior;
      }
    };

    const initialTarget = resolveTarget();
    if (Math.abs(initialTarget - scroller.scrollTop) < 2) {
      scroller.scrollTop = initialTarget;
      restoreScrollBehavior();
      if (onComplete) onComplete();
      return () => {};
    }

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    let prevEased = 0;
    const startTime = performance.now();
    let rafId = null;
    let isCanceled = false;

    const cancel = () => {
      isCanceled = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      restoreScrollBehavior();
    };

    const tick = (currentTime) => {
      if (isCanceled) return;

      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(progress);
      const stepFraction = prevEased >= 1 ? 1 : Math.min(1, (eased - prevEased) / Math.max(1e-6, 1 - prevEased));
      prevEased = eased;

      const liveTarget = resolveTarget();
      const curTop = scroller.scrollTop;
      const remaining = liveTarget - curTop;

      if (progress < 1) {
        scroller.scrollTop = curTop + remaining * stepFraction;
        rafId = requestAnimationFrame(tick);
      } else {
        scroller.scrollTop = liveTarget;
        rafId = null;
        restoreScrollBehavior();
        if (onComplete) onComplete();
      }
    };

    rafId = requestAnimationFrame(tick);
    return cancel;
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
    const effectiveMode = detected.mode || (catalogData && catalogData[0] && catalogData[0].domLayoutMode) || 'round';
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

  function inferVisibleRoundRange(userTurns, catalogData, ctxOpt, viewportBoundsOpt) {
    const ctx = ctxOpt || buildDomLookupContext(catalogData, userTurns);
    let minRound = Infinity;
    let maxRound = -Infinity;
    const anchors = [];

    for (let i = 0; i < userTurns.length; i++) {
      if (viewportBoundsOpt) {
        const rect = userTurns[i].getBoundingClientRect();
        if (rect.bottom < viewportBoundsOpt.topMin || rect.top > viewportBoundsOpt.topMax) {
          continue;
        }
      }
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

    let cachedAnchors = null;
    const getVisibleUniqueAnchors = () => {
      if (cachedAnchors) return cachedAnchors;
      const anchorsList = [];
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
          anchorsList.push({ domPos: j, expIdx, roundIndex: aRoundIdx });
        }
      }
      cachedAnchors = anchorsList;
      return anchorsList;
    };

    const isOrderConsistentWithAnchors = (candPos, candExpIdx) => {
      const anchorsList = getVisibleUniqueAnchors();
      for (const a of anchorsList) {
        if (a.domPos < candPos && a.expIdx >= candExpIdx) return false;
        if (a.domPos > candPos && a.expIdx <= candExpIdx) return false;
        if (a.domPos === candPos && a.expIdx !== candExpIdx) return false;
      }
      return true;
    };

    const verifyDirectCandidate = (el) => {
      const domPos = userTurns.indexOf(el);
      if (domPos === -1) return false;
      if (!isOrderConsistentWithAnchors(domPos, effectiveTargetIndex)) {
        return false;
      }
      const tText = ctx.getCachedCleanText(el);
      if (pureText && doesElementMatchText(tText, pureText)) {
        if (effectiveMode === 'chunk' && effectiveTargetIndex !== effectiveTextIndex) {
          return false;
        }
        if (duplicateCount > 1) {
          const sc = scoreCandidateContext(domPos, effectiveTextIndex, ctx);
          if (sc.checkedNeighbors > 0 && sc.conflicts > 0 && sc.matches === 0) {
            return false;
          }
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

    // Tier 1.5: Recorded element ID lookup (verified directly against the item's expected chunk or attachment)
    if (catalogItem.turnElementId) {
      const idEl = document.getElementById(catalogItem.turnElementId);
      if (idEl && verifyDirectCandidate(idEl)) {
        return idEl;
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
        if (!isOrderConsistentWithAnchors(pos, effectiveTargetIndex)) {
          continue;
        }
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
        const consistentCandidates = candidates.filter(cand => isOrderConsistentWithAnchors(cand.pos, effectiveTextIndex));
        if (consistentCandidates.length === 0) return -1;
        const isUniqueLong = !requireStrictGuard && normCompactLen >= 6 && duplicateCount <= 1;

        const scored = consistentCandidates.map((cand) => {
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
          // Unique strict exact match should not be discarded just because adjacent turns are still hydrating
          return winner.pos;
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
    const anchors = getVisibleUniqueAnchors();

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

      const myToken = ++navigationToken;
      isNavigating = true;
      activeNavState = { catalogItem };
      const clickTime = performance.now();
      const minFeedbackDurationMs = 380; // Ensure visible feedback even for short distances

      // Temporarily override CSS smooth scrolling so rAF closed-loop steps apply immediately
      const prevScrollBehavior = scroller.style.scrollBehavior;
      const computedScrollBehavior = window.getComputedStyle ? window.getComputedStyle(scroller).scrollBehavior : '';
      const didOverrideScrollBehavior = computedScrollBehavior === 'smooth' || prevScrollBehavior === 'smooth';
      if (didOverrideScrollBehavior) {
        scroller.style.scrollBehavior = 'auto';
      }

      // 2. Update active highlight in the sidebar list immediately
      const list = document.getElementById(Utils.SELECTORS.id.catalogListContainer);
      if (list) {
        applyNavSelectionHighlight(list, catalogItem, true);
      }

      // Helper to fade away temporary navigation row background after minimum feedback time
      const clearNavigatingState = (immediate = false) => {
        const doClear = () => {
          const curList = document.getElementById(Utils.SELECTORS.id.catalogListContainer);
          if (curList) {
            const navItems = curList.querySelectorAll('.catalog-list-item.catalog-item-navigating');
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
            navigationClearTimer = setTimeout(() => {
              if (myToken === navigationToken) {
                doClear();
              } else {
                navigationClearTimer = null;
              }
            }, remaining);
          } else {
            doClear();
          }
        }
      };

      // 3. User interrupt handler: abort auto-navigation on manual scroll interaction
      const scrollInterruptKeys = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Escape']);
      const onUserInterrupt = (e) => {
        if (myToken !== navigationToken || !isNavigating) return;
        if (e.target && e.target.closest && e.target.closest('#' + Utils.SELECTORS.id.catalogPanel)) {
          return;
        }
        if (e.type === 'pointerdown' && !(e.target === scroller && e.offsetX >= scroller.clientWidth)) {
          return;
        }
        if (e.type === 'keydown') {
          const active = document.activeElement;
          if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || active.isContentEditable)) {
            if (e.key !== 'Escape') return;
          }
          if (!scrollInterruptKeys.has(e.key)) {
            return;
          }
        }
        cleanup(true);
      };

      const scheduleSafetyTimeout = (delayMs) => {
        if (navigationSafetyTimer) {
          clearTimeout(navigationSafetyTimer);
        }
        navigationSafetyTimer = setTimeout(() => {
          if (myToken === navigationToken && isNavigating) {
            cleanup(false);
          }
        }, delayMs);
      };

      cleanup = (immediate = false) => {
        if (myToken !== navigationToken) return;
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
        if (didOverrideScrollBehavior) {
          scroller.style.scrollBehavior = prevScrollBehavior;
        }
        activeNavigationAbort = null;
        isNavigating = false;
        if (immediate) {
          activeNavState = null;
          lastNavigationEndAt = 0;
        } else {
          activeNavState = {
            catalogItem,
            landedScrollTop: scroller.scrollTop
          };
          lastNavigationEndAt = performance.now();
        }
        window.removeEventListener('wheel', onUserInterrupt, { capture: true });
        window.removeEventListener('touchstart', onUserInterrupt, { capture: true });
        window.removeEventListener('pointerdown', onUserInterrupt, { capture: true });
        window.removeEventListener('keydown', onUserInterrupt, { capture: true });
      };
      activeNavigationAbort = cleanup;

      // Global safety timer: covers multi-hop virtual/lazy search; extended upon entering landOnTarget
      scheduleSafetyTimeout(8000);

      window.addEventListener('wheel', onUserInterrupt, { capture: true, passive: true });
      window.addEventListener('touchstart', onUserInterrupt, { capture: true, passive: true });
      window.addEventListener('pointerdown', onUserInterrupt, { capture: true, passive: true });
      window.addEventListener('keydown', onUserInterrupt, { capture: true, passive: true });

      const isElementVisibleInLayout = (el) => {
        if (!el || typeof window.getComputedStyle !== 'function') return true;
        const st = window.getComputedStyle(el);
        return st.display !== 'none' && st.visibility !== 'hidden';
      };

      const determineLayoutMode = (cardEl) => {
        const stamped = cardEl && cardEl.getAttribute ? cardEl.getAttribute('data-enhancer-dom-mode') : '';
        if (stamped === 'round' || stamped === 'chunk') {
          return { mode: stamped, certain: true };
        }
        const liveCatalog = State.getCatalogData() || catalogData;
        const ctx = buildDomLookupContext(liveCatalog);
        return { mode: ctx.effectiveMode, certain: Boolean(ctx.detectedMode) };
      };

      const resolveLocalChunkOrRoundIndex = (els, item, cardEl) => {
        const liveCatalog = State.getCatalogData() || catalogData;
        const sameRoundItems = liveCatalog.filter(x => x.roundIndex === item.roundIndex && x.type === item.type);
        const sameChunkItems = item.chunkTargetDomIndex !== undefined
          ? sameRoundItems.filter(x => x.chunkTargetDomIndex === item.chunkTargetDomIndex)
          : sameRoundItems;

        const matchItem = (x) => (
          x === item ||
          (x.turnIndex === item.turnIndex &&
           x.subIndex === item.subIndex &&
           (!item.fileName || x.fileName === item.fileName))
        );

        const roundPos = Math.max(0, sameRoundItems.findIndex(matchItem));
        const chunkPos = Math.max(0, sameChunkItems.findIndex(matchItem));
        const fallbackRoundIdx = item.type === 'video'
          ? roundPos
          : (item.subIndex !== undefined ? item.subIndex : roundPos);

        const modeInfo = determineLayoutMode(cardEl);
        if (modeInfo.mode === 'round') {
          return fallbackRoundIdx;
        }
        // If mode fell back without full certainty, detect full-round card by element count
        if (!modeInfo.certain && sameRoundItems.length > sameChunkItems.length && els.length >= sameRoundItems.length) {
          return fallbackRoundIdx;
        }
        return chunkPos;
      };

      // Resolve sub-element within card for image, file, or video attachments
      const resolveSubTarget = (cardEl, item) => {
        if (!cardEl || !item) return cardEl;
        if (item.type === 'image') {
          const contentImgs = getTurnContentImages(cardEl);
          const layoutImgs = contentImgs.filter(isElementVisibleInLayout);
          const imgs = layoutImgs.length > 0 ? layoutImgs : contentImgs;
          if (imgs.length > 0) {
            if (item.fileName && !item.isDefaultName) {
              const targetLower = item.fileName.trim().toLowerCase();
              const exactMatch = imgs.find((img) => {
                const alt = (img.alt || '').trim().toLowerCase();
                const title = (img.title || '').trim().toLowerCase();
                return alt === targetLower || title === targetLower;
              });
              if (exactMatch) return exactMatch;

              const looseMatch = imgs.find((img) => {
                const alt = (img.alt || '').trim().toLowerCase();
                const title = (img.title || '').trim().toLowerCase();
                return (alt && (alt.includes(targetLower) || (alt.length >= 4 && targetLower.includes(alt)))) ||
                       (title && (title.includes(targetLower) || (title.length >= 4 && targetLower.includes(title)))) ||
                       (img.src && !img.src.startsWith('data:') && targetLower.length >= 4 && img.src.toLowerCase().includes(targetLower));
              });
              if (looseMatch) return looseMatch;
            }
            const idx = resolveLocalChunkOrRoundIndex(imgs, item, cardEl);
            return imgs[idx] || imgs[imgs.length - 1] || cardEl;
          }
        } else if (item.type === 'file') {
          const allFileEls = getTurnContentFiles(cardEl);
          const layoutFiles = allFileEls.filter(isElementVisibleInLayout);
          const fileEls = layoutFiles.length > 0 ? layoutFiles : allFileEls;
          if (fileEls.length > 0) {
            if (item.fileName && !item.isDefaultName) {
              const matchedChip = fileEls.find((el) => doesFileElementMatchName(el, item.fileName));
              if (matchedChip) return matchedChip;
            }
            const idx = resolveLocalChunkOrRoundIndex(fileEls, item, cardEl);
            return fileEls[idx] || fileEls[fileEls.length - 1] || cardEl;
          }
        } else if (item.type === 'video') {
          const allVideoEls = getTurnContentVideos(cardEl);
          const layoutVideos = allVideoEls.filter(isElementVisibleInLayout);
          const videoEls = layoutVideos.length > 0 ? layoutVideos : allVideoEls;
          if (videoEls.length > 0) {
            const idx = resolveLocalChunkOrRoundIndex(videoEls, item, cardEl);
            return videoEls[idx] || videoEls[videoEls.length - 1] || cardEl;
          }
        }
        return cardEl;
      };

      const isTrackedCardValid = (card) => {
        if (!card || !card.isConnected) return false;
        const pure = (catalogItem.pureText || '').trim();
        const normA = compactTextForMatch(normalizeTextForMatch(pure));
        if (normA.length >= 6) {
          const stampedMode = card.getAttribute ? card.getAttribute('data-enhancer-dom-mode') : '';
          const canCheckText =
            catalogItem.type === 'text' ||
            stampedMode === 'round' ||
            catalogItem.chunkTargetDomIndex === undefined ||
            catalogItem.chunkTextDomIndex === undefined ||
            catalogItem.chunkTargetDomIndex === catalogItem.chunkTextDomIndex;
          if (canCheckText) {
            const curText = getCleanPromptText(card);
            const curComp = compactTextForMatch(normalizeTextForMatch(curText));
            if (curComp.length >= 6 && !doesElementMatchText(curText, pure)) {
              return false;
            }
          }
        }
        return true;
      };

      // Two-stage Plan A motion constants: instant approach teleport + short crisp deceleration glide
      // Avoids slow visible dragging across lazy-rendered blank placeholder turns even for short hops.
      const TELEPORT_DISTANCE_THRESHOLD = 520;
      const getApproachDistance = (viewportHeight) => {
        return Math.min(340, Math.max(180, Math.round((viewportHeight || 800) * 0.42)));
      };
      const computeCrispGlideDuration = (dist) => {
        return Math.min(210, Math.max(95, Math.round(80 + Math.sqrt(Math.max(0, dist)) * 4.5)));
      };

      // Shared search budget across initial hydration search and any mid-flight virtual-scroll re-acquisition
      const maxSearchHops = 22;
      let searchHopsUsed = 0;
      const targetRound = catalogItem.roundIndex !== undefined ? catalogItem.roundIndex : 0;
      const totalRounds = catalogItem.totalRounds || new Set(catalogData.map(i => i.roundIndex)).size || 1;
      let lowBound = { round: 0, scrollTop: 0 };
      let highBound = {
        round: Math.max(0, totalRounds - 1),
        scrollTop: Math.max(0, scroller.scrollHeight - scroller.clientHeight)
      };
      let lastSearchDir = 1;
      let lastHopScrollHeight = scroller.scrollHeight;
      let sawBottomMiss = false;
      let sawTopMiss = false;
      let emptyGapConsecutive = 0;

      let runSearchHop = null;

      // Landing Stabilization Anchor: dynamically pins the target to live desiredTop
      // for at least 380ms (longer for lazy expansions / pending images), ensuring pixel-exact stop.
      const anchorLand = (anchorCard) => {
        if (!isNavigating || myToken !== navigationToken) return;
        let cardEl = anchorCard;
        const anchorStartTime = performance.now();
        const anchorMinMs = 380;
        const baseAnchorMaxMs = 1350;
        const requiredStableFrames = 5;
        let stableFrames = 0;
        let lastAbsDelta = Infinity;
        let prevDeltaSign = 0;
        let anchorApproachTeleports = 0;
        const maxAnchorTeleports = 8;
        let anchorRafId = null;
        let anchorCanceled = false;

        activeNavigationCancel = () => {
          anchorCanceled = true;
          if (anchorRafId !== null) {
            cancelAnimationFrame(anchorRafId);
            anchorRafId = null;
          }
        };

        const anchorTick = () => {
          if (anchorCanceled || !isNavigating || myToken !== navigationToken) return;

          if (!isTrackedCardValid(cardEl)) {
            cardEl = findTargetElement(catalogItem);
            if (!cardEl || !cardEl.isConnected) {
              if (searchHopsUsed < maxSearchHops && runSearchHop) {
                runSearchHop(searchHopsUsed + 1);
              } else {
                cleanup(false);
              }
              return;
            }
            stableFrames = 0;
          }

          const freshTarget = resolveSubTarget(cardEl, catalogItem);
          const freshRect = freshTarget.getBoundingClientRect();
          const currentScrollerRect = getScrollerViewportMetrics(scroller);
          const liveDesiredTop = computeDesiredTop(freshRect, currentScrollerRect, catalogItem);

          const curTop = scroller.scrollTop;
          const liveMaxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
          const rawTargetTop = curTop + ((freshRect.top - currentScrollerRect.top) - liveDesiredTop);
          const clampedTargetTop = Math.max(0, Math.min(liveMaxScroll, rawTargetTop));
          const boundedDelta = clampedTargetTop - curTop;
          const absDelta = Math.abs(boundedDelta);
          const curSign = boundedDelta > 0 ? 1 : (boundedDelta < 0 ? -1 : 0);

          const isPendingImage = Boolean(freshTarget && freshTarget.tagName === 'IMG' && !freshTarget.complete);

          if (absDelta > TELEPORT_DISTANCE_THRESHOLD && anchorApproachTeleports < maxAnchorTeleports) {
            // Large lazy turn expansion pushed the target offscreen again: re-teleport to doorstep cleanly
            const approachDist = Math.min(280, Math.max(150, Math.round(currentScrollerRect.height * 0.35)));
            const jumpTop = Math.max(0, Math.min(liveMaxScroll, clampedTargetTop - curSign * approachDist));
            if (Math.abs(jumpTop - curTop) > 40) {
              scroller.scrollTop = jumpTop;
              anchorApproachTeleports++;
              stableFrames = 0;
              scheduleSafetyTimeout(2400);
              lastAbsDelta = absDelta;
              prevDeltaSign = curSign;
              anchorRafId = requestAnimationFrame(anchorTick);
              return;
            }
          }

          if (absDelta > 1.0) {
            // Guard against sub-pixel DPR/zoom quantization oscillation near 1-2px
            const isSmallOscillation = absDelta <= 2.5 && prevDeltaSign !== 0 && curSign !== prevDeltaSign && absDelta >= lastAbsDelta * 0.9;
            if (isSmallOscillation) {
              stableFrames++;
            } else {
              if (absDelta > 8) {
                const glideStep = Math.sign(boundedDelta) * Math.max(5, Math.min(220, Math.round(absDelta * 0.45)));
                scroller.scrollTop = Math.max(0, Math.min(liveMaxScroll, curTop + glideStep));
              } else {
                scroller.scrollTop = clampedTargetTop;
              }
              const moved = Math.abs(scroller.scrollTop - curTop);
              if (moved < 0.25) {
                // Reached scroll boundary or browser quantization floor
                stableFrames++;
              } else {
                stableFrames = 0;
              }
            }
          } else {
            if (absDelta > 0.5 && stableFrames === 0) {
              scroller.scrollTop = clampedTargetTop;
            }
            stableFrames++;
          }

          lastAbsDelta = absDelta;
          if (curSign !== 0) prevDeltaSign = curSign;

          const elapsed = performance.now() - anchorStartTime;
          const effectiveMaxMs = (isPendingImage || anchorApproachTeleports > 0) ? 1850 : baseAnchorMaxMs;
          const keepAnchoring = (elapsed < anchorMinMs || stableFrames < requiredStableFrames || isPendingImage) && elapsed < effectiveMaxMs;
          if (keepAnchoring) {
            anchorRafId = requestAnimationFrame(anchorTick);
          } else {
            // Final precision touch before releasing if a late shift happened right at window edge
            const finalRect = freshTarget.getBoundingClientRect();
            const finalMetrics = getScrollerViewportMetrics(scroller);
            const finalDesiredTop = computeDesiredTop(finalRect, finalMetrics, catalogItem);
            const finalMaxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
            const finalTargetTop = Math.max(0, Math.min(finalMaxScroll, scroller.scrollTop + ((finalRect.top - finalMetrics.top) - finalDesiredTop)));
            const finalDiff = Math.abs(finalTargetTop - scroller.scrollTop);
            if (finalDiff > 0.5) {
              scroller.scrollTop = finalTargetTop;
            }
            anchorRafId = null;
            cleanup(false);
          }
        };

        anchorRafId = requestAnimationFrame(anchorTick);
      };

      // Two-stage Plan A landing: instant approach teleport past intermediate blank turns + short crisp glide
      const landOnTarget = (initialEl) => {
        if (!isNavigating || myToken !== navigationToken) return;
        scheduleSafetyTimeout(3200);
        let trackedCard = initialEl;
        if (!trackedCard || !trackedCard.isConnected) {
          trackedCard = findTargetElement(catalogItem);
        }
        if (!trackedCard || !trackedCard.isConnected) {
          if (searchHopsUsed < maxSearchHops && runSearchHop) {
            runSearchHop(searchHopsUsed + 1);
          } else {
            cleanup(false);
          }
          return;
        }

        const subTarget0 = resolveSubTarget(trackedCard, catalogItem);
        const rect0 = subTarget0.getBoundingClientRect();
        const metrics0 = getScrollerViewportMetrics(scroller);
        const desiredTop0 = computeDesiredTop(rect0, metrics0, catalogItem);
        const maxScroll0 = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
        const targetTop0 = Math.max(0, Math.min(maxScroll0, scroller.scrollTop + ((rect0.top - metrics0.top) - desiredTop0)));
        const initialBoundedDist = Math.abs(targetTop0 - scroller.scrollTop);

        if (initialBoundedDist <= 1.5) {
          if (initialBoundedDist > 0.5) {
            scroller.scrollTop = targetTop0;
          }
          anchorLand(trackedCard);
          return;
        }

        let flightTeleports = 0;
        const maxFlightTeleports = 16;

        // Stage 1: Teleport to the approach zone when distance exceeds half-screen threshold
        if (initialBoundedDist > TELEPORT_DISTANCE_THRESHOLD) {
          const approachDist = getApproachDistance(metrics0.height);
          const dirSign = targetTop0 >= scroller.scrollTop ? 1 : -1;
          const preJumpTop = Math.max(0, Math.min(maxScroll0, targetTop0 - dirSign * approachDist));
          if (Math.abs(preJumpTop - scroller.scrollTop) > 40) {
            scroller.scrollTop = preJumpTop;
            flightTeleports++;
          }
          if (!isTrackedCardValid(trackedCard)) {
            const refound = findTargetElement(catalogItem);
            if (refound && refound.isConnected) {
              trackedCard = refound;
            }
          }
        }

        let initialGlideDist = initialBoundedDist;
        if (isTrackedCardValid(trackedCard)) {
          const subTarget1 = resolveSubTarget(trackedCard, catalogItem);
          const rect1 = subTarget1.getBoundingClientRect();
          const metrics1 = getScrollerViewportMetrics(scroller);
          const desiredTop1 = computeDesiredTop(rect1, metrics1, catalogItem);
          const maxScroll1 = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
          const targetTop1 = Math.max(0, Math.min(maxScroll1, scroller.scrollTop + ((rect1.top - metrics1.top) - desiredTop1)));
          initialGlideDist = Math.abs(targetTop1 - scroller.scrollTop);
          if (initialGlideDist <= 1.5) {
            if (initialGlideDist > 0.5) {
              scroller.scrollTop = targetTop1;
            }
            anchorLand(trackedCard);
            return;
          }
        }

        let remainingMs = computeCrispGlideDuration(Math.min(TELEPORT_DISTANCE_THRESHOLD, initialGlideDist));
        let p = 0;
        let prevTime = performance.now();
        const flightStartTime = prevTime;
        let rafId = null;
        let canceled = false;

        activeNavigationCancel = () => {
          canceled = true;
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
        };

        const flightTick = (currentTime) => {
          if (canceled || !isNavigating || myToken !== navigationToken) return;

          const dt = Math.min(48, Math.max(1, currentTime - prevTime));
          prevTime = currentTime;

          if (!isTrackedCardValid(trackedCard)) {
            trackedCard = findTargetElement(catalogItem);
            if (!trackedCard || !trackedCard.isConnected) {
              rafId = null;
              if (searchHopsUsed < maxSearchHops && runSearchHop) {
                runSearchHop(searchHopsUsed + 1);
              } else {
                cleanup(false);
              }
              return;
            }
          }

          const subTarget = resolveSubTarget(trackedCard, catalogItem);
          const liveRect = subTarget.getBoundingClientRect();
          const metrics = getScrollerViewportMetrics(scroller);
          const liveDesiredTop = computeDesiredTop(liveRect, metrics, catalogItem);
          const curTop = scroller.scrollTop;
          const liveMaxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
          const liveTargetTop = Math.max(0, Math.min(liveMaxScroll, curTop + ((liveRect.top - metrics.top) - liveDesiredTop)));
          const boundedRemaining = liveTargetTop - curTop;
          const absRemaining = Math.abs(boundedRemaining);

          // If asynchronous lazy hydration shifts target beyond teleport threshold mid-glide,
          // re-teleport directly into its new approach zone rather than dragging over blank placeholders.
          if (absRemaining > TELEPORT_DISTANCE_THRESHOLD && flightTeleports < maxFlightTeleports) {
            const approachDist = getApproachDistance(metrics.height);
            const sign = boundedRemaining > 0 ? 1 : -1;
            const jumpTop = Math.max(0, Math.min(liveMaxScroll, liveTargetTop - sign * approachDist));
            if (Math.abs(jumpTop - curTop) > 40) {
              scroller.scrollTop = jumpTop;
              flightTeleports++;
              p = 0;
              remainingMs = computeCrispGlideDuration(Math.min(approachDist, absRemaining));
              scheduleSafetyTimeout(3200);
              rafId = requestAnimationFrame(flightTick);
              return;
            }
          }

          // Extend remaining glide slightly when sub-viewport reflow arrives late in flight
          if (p > 0.65 && absRemaining > 60 && (currentTime - flightStartTime) < 1200) {
            remainingMs = Math.max(
              remainingMs,
              Math.min(240, Math.round(90 + Math.sqrt(absRemaining) * 3.5))
            );
          }

          const nextP = remainingMs <= dt ? 1 : (1 - (1 - p) * Math.max(0, 1 - dt / remainingMs));
          remainingMs = Math.max(0, remainingMs - dt);
          const prevEased = 1 - Math.pow(1 - p, 3);
          const nextEased = 1 - Math.pow(1 - nextP, 3);
          const stepFraction = prevEased >= 1 ? 1 : Math.min(1, (nextEased - prevEased) / Math.max(1e-6, 1 - prevEased));
          p = nextP;

          if (p < 1) {
            let step = boundedRemaining * stepFraction;
            if (p > 0.85 && absRemaining >= 1 && Math.abs(step) > 0 && Math.abs(step) < 1) {
              step = Math.sign(boundedRemaining);
            }
            scroller.scrollTop = Math.max(0, Math.min(liveMaxScroll, curTop + step));
            rafId = requestAnimationFrame(flightTick);
          } else {
            rafId = null;
            if (absRemaining <= 12) {
              scroller.scrollTop = liveTargetTop;
            }
            // Larger residuals are smoothly converged by anchorLand without abrupt snaps
            anchorLand(trackedCard);
          }
        };

        rafId = requestAnimationFrame(flightTick);
      };

      // Target not in DOM yet (virtualized / lazy-deferred): instant-jump bracketed search
      // with adaptive hydration settle so long chats skip blank turns without visual dragging.
      runSearchHop = (hop) => {
        if (!isNavigating || myToken !== navigationToken) return;
        searchHopsUsed = hop;

        const quickFound = findTargetElement(catalogItem);
        if (quickFound) {
          landOnTarget(quickFound);
          return;
        }

        const curScrollHeight = scroller.scrollHeight;
        const maxScroll = Math.max(0, curScrollHeight - scroller.clientHeight);
        const currentTop = scroller.scrollTop;

        if (hop > maxSearchHops || maxScroll <= 0) {
          cleanup(false);
          return;
        }

        // Propagate scrollHeight growth/shrinkage since the previous hop onto [lowBound, highBound]
        // so tightened intermediate bounds cannot trap search behind newly expanded lazy turns.
        const dh = curScrollHeight - lastHopScrollHeight;
        lastHopScrollHeight = curScrollHeight;
        if (dh > 0) {
          if (highBound.round === totalRounds - 1) {
            highBound.scrollTop = Math.max(highBound.scrollTop, maxScroll);
          } else {
            highBound.scrollTop = Math.min(maxScroll, highBound.scrollTop + dh);
          }
        } else if (dh < 0) {
          lowBound.scrollTop = Math.max(0, lowBound.scrollTop + dh);
          if (highBound.round === totalRounds - 1) {
            highBound.scrollTop = maxScroll;
          } else {
            highBound.scrollTop = Math.max(0, Math.min(maxScroll, highBound.scrollTop + dh));
          }
        } else if (highBound.round === totalRounds - 1) {
          highBound.scrollTop = Math.max(highBound.scrollTop, maxScroll);
        }

        const liveTurns = getUserTurnElements();
        const metrics = getScrollerViewportMetrics(scroller);
        const viewBound = {
          topMin: metrics.top - metrics.height * 1.5,
          topMax: metrics.top + metrics.height * 2.5
        };
        const visRange = inferVisibleRoundRange(liveTurns, catalogData, null, viewBound);
        const getAnchorDesiredTop = (el) => {
          const r = el.getBoundingClientRect();
          return Math.max(0, Math.min(maxScroll, Math.round(currentTop + (r.top - metrics.top) - 80)));
        };

        let firstA = null;
        let lastA = null;
        let firstScroll = 0;
        let lastScroll = 0;
        let minNextRoundScroll = 0;

        // Tighten search bracket from live visible round anchors (resilient to upstream resize)
        if (visRange.anchors.length > 0) {
          emptyGapConsecutive = 0;
          firstA = visRange.anchors[0];
          lastA = visRange.anchors[visRange.anchors.length - 1];
          firstScroll = getAnchorDesiredTop(liveTurns[firstA.domPos]);
          lastScroll = getAnchorDesiredTop(liveTurns[lastA.domPos]);

          if (targetRound < firstA.roundIndex && (firstA.roundIndex <= highBound.round || firstScroll < highBound.scrollTop)) {
            if (firstScroll >= lowBound.scrollTop) {
              highBound = { round: firstA.roundIndex, scrollTop: firstScroll };
            }
          } else if (targetRound > lastA.roundIndex) {
            // Project lower bound past the bottom of lastA and any trailing model turns in that round
            let floorEl = liveTurns[lastA.domPos];
            const allTurns = Array.from(document.querySelectorAll(Utils.SELECTORS.query.chatTurn));
            const idxInAll = allTurns.indexOf(floorEl);
            if (idxInAll !== -1) {
              for (let k = idxInAll + 1; k < allTurns.length; k++) {
                const nextCont = allTurns[k].querySelector(Utils.SELECTORS.query.chatTurnContainer);
                if (nextCont && nextCont.classList.contains(Utils.SELECTORS.class.userTurn)) {
                  break;
                }
                floorEl = allTurns[k];
              }
            }
            const floorRect = floorEl.getBoundingClientRect();
            minNextRoundScroll = Math.max(
              lastScroll,
              Math.min(maxScroll, Math.round(currentTop + (floorRect.bottom - metrics.top) - 140))
            );
            const nextMinRound = Math.min(totalRounds - 1, lastA.roundIndex + 1);
            if (minNextRoundScroll <= highBound.scrollTop &&
                ((nextMinRound >= lowBound.round && (nextMinRound > lowBound.round || minNextRoundScroll > lowBound.scrollTop)) ||
                 minNextRoundScroll > lowBound.scrollTop)) {
              lowBound = { round: nextMinRound, scrollTop: minNextRoundScroll };
            } else if ((lastA.roundIndex >= lowBound.round || lastScroll > lowBound.scrollTop) && lastScroll <= highBound.scrollTop) {
              lowBound = { round: lastA.roundIndex, scrollTop: lastScroll };
            }
          }
        }

        // Reset collided bounds while retaining the current frame's live observation
        if (lowBound.round >= highBound.round || lowBound.scrollTop > highBound.scrollTop) {
          lowBound = (lastA && targetRound > lastA.roundIndex)
            ? { round: Math.min(totalRounds - 1, lastA.roundIndex + 1), scrollTop: Math.min(maxScroll, minNextRoundScroll || lastScroll) }
            : { round: 0, scrollTop: 0 };
          highBound = (firstA && targetRound < firstA.roundIndex && firstScroll >= lowBound.scrollTop)
            ? { round: firstA.roundIndex, scrollTop: firstScroll }
            : { round: Math.max(0, totalRounds - 1), scrollTop: maxScroll };
          if (lowBound.round >= highBound.round || lowBound.scrollTop > highBound.scrollTop) {
            lowBound = { round: 0, scrollTop: 0 };
            highBound = { round: Math.max(0, totalRounds - 1), scrollTop: maxScroll };
          }
        }

        let searchTarget;
        if (targetRound === 0) {
          if (hop > 1 && currentTop <= 5 && visRange.anchors.length === 0) {
            sawTopMiss = true;
          }
          if (sawTopMiss) {
            searchTarget = currentTop + Math.max(400, Math.round(metrics.height * 0.9));
            lastSearchDir = 1;
          } else {
            searchTarget = 0;
            lastSearchDir = -1;
          }
        } else if (targetRound >= totalRounds - 1 && !sawBottomMiss) {
          if (hop > 1 && currentTop >= maxScroll - 20 && visRange.anchors.length === 0) {
            sawBottomMiss = true;
            lastSearchDir = -1;
            searchTarget = currentTop - Math.max(520, Math.round(metrics.height * 0.95));
          } else {
            searchTarget = maxScroll;
            lastSearchDir = 1;
          }
        } else if (targetRound >= totalRounds - 1 && sawBottomMiss && visRange.anchors.length === 0) {
          lastSearchDir = -1;
          searchTarget = currentTop - Math.max(520, Math.round(metrics.height * 0.95));
        } else if (visRange.minRound !== -1 && targetRound >= visRange.minRound && targetRound <= visRange.maxRound) {
          // Target round is inside visible span: interpolate between bracketing anchors or nudge chunk offset
          let leftA = null;
          let rightA = null;
          for (const a of visRange.anchors) {
            if (a.roundIndex <= targetRound) leftA = a;
            if (!rightA && a.roundIndex >= targetRound) rightA = a;
          }
          if (leftA && leftA.roundIndex === targetRound) {
            const baseTop = getAnchorDesiredTop(liveTurns[leftA.domPos]);
            const ctxMode = buildDomLookupContext(catalogData, liveTurns).effectiveMode;
            const chunkDiff = (ctxMode === 'chunk' && catalogItem.chunkTargetDomIndex !== undefined && catalogItem.chunkTextDomIndex !== undefined)
              ? (catalogItem.chunkTargetDomIndex - catalogItem.chunkTextDomIndex)
              : 0;
            const stepUnit = Math.round(metrics.height * 0.65);
            if (chunkDiff < 0) {
              searchTarget = Math.min(currentTop - stepUnit, baseTop + chunkDiff * 240);
            } else if (chunkDiff > 0) {
              searchTarget = Math.max(currentTop + stepUnit, baseTop + chunkDiff * 240);
            } else if (Math.abs(baseTop - currentTop) >= 12) {
              searchTarget = baseTop;
            } else {
              searchTarget = currentTop + lastSearchDir * Math.round(metrics.height * 0.45);
            }
          } else if (leftA && rightA && rightA.roundIndex > leftA.roundIndex) {
            const leftTop = getAnchorDesiredTop(liveTurns[leftA.domPos]);
            const rightTop = getAnchorDesiredTop(liveTurns[rightA.domPos]);
            const frac = (targetRound - leftA.roundIndex) / (rightA.roundIndex - leftA.roundIndex);
            searchTarget = Math.round(leftTop + (rightTop - leftTop) * frac);
          } else {
            const isBefore = catalogItem.chunkTargetDomIndex !== undefined &&
              catalogItem.chunkTextDomIndex !== undefined &&
              catalogItem.chunkTargetDomIndex < catalogItem.chunkTextDomIndex;
            const stepUnit = Math.max(400, Math.round(metrics.height * 0.75));
            searchTarget = currentTop + (isBefore ? -stepUnit : stepUnit);
          }
        } else if (visRange.anchors.length === 0 && hop > 1) {
          // Landed inside an unhydrated gap or giant model reply with zero user anchors in view:
          // first check if mounted model turns expose a direct edge past the gap, otherwise march monotonically.
          emptyGapConsecutive++;
          const dir = lastSearchDir || 1;
          const nearAllTurns = Array.from(document.querySelectorAll(Utils.SELECTORS.query.chatTurn)).filter((t) => {
            const r = t.getBoundingClientRect();
            return r.bottom >= viewBound.topMin && r.top <= viewBound.topMax;
          });
          let jumpedTurnEdge = null;
          if (nearAllTurns.length > 0) {
            if (dir > 0) {
              let maxBottom = -Infinity;
              for (const t of nearAllTurns) {
                const r = t.getBoundingClientRect();
                if (r.bottom > maxBottom) maxBottom = r.bottom;
              }
              const edgeTop = Math.min(maxScroll, Math.round(currentTop + (maxBottom - metrics.top) - 80));
              if (edgeTop > currentTop + 200) jumpedTurnEdge = edgeTop;
            } else {
              let minTop = Infinity;
              for (const t of nearAllTurns) {
                const r = t.getBoundingClientRect();
                if (r.top < minTop) minTop = r.top;
              }
              const edgeTop = Math.max(0, Math.round(currentTop + (minTop - metrics.top) - Math.round(metrics.height * 0.75)));
              if (edgeTop < currentTop - 200) jumpedTurnEdge = edgeTop;
            }
          }
          if (jumpedTurnEdge !== null) {
            searchTarget = jumpedTurnEdge;
          } else {
            const stride = Math.round(metrics.height * 0.95) * Math.min(3, Math.max(1, emptyGapConsecutive));
            let nextGapTop = currentTop + dir * stride;
            if (dir > 0 && currentTop >= maxScroll - 8) {
              lastSearchDir = -1;
              nextGapTop = currentTop - Math.round(metrics.height * 0.95);
            } else if (dir < 0 && currentTop <= 8) {
              lastSearchDir = 1;
              nextGapTop = currentTop + Math.round(metrics.height * 0.95);
            }
            searchTarget = nextGapTop;
          }
        } else {
          // Interpolate strictly inside [lowBound, highBound] with step-size safeguards
          const rSpan = Math.max(1, highBound.round - lowBound.round);
          const frac = Math.max(0, Math.min(1, (targetRound - lowBound.round) / rSpan));
          let est = Math.round(lowBound.scrollTop + (highBound.scrollTop - lowBound.scrollTop) * frac);

          const roundGap = visRange.minRound !== -1
            ? (targetRound < visRange.minRound ? (visRange.minRound - targetRound) : (targetRound - visRange.maxRound))
            : Infinity;
          let dir;
          if (visRange.minRound !== -1) {
            dir = targetRound < visRange.minRound ? -1 : 1;
          } else if (Math.abs(est - currentTop) >= 5) {
            dir = est >= currentTop ? 1 : -1;
          } else {
            dir = lastSearchDir;
          }
          lastSearchDir = dir;

          // Avoid large overshoot jumps when within 1-2 rounds of visible turns
          if (roundGap <= 2 && Math.abs(est - currentTop) > metrics.height * 2.5) {
            est = currentTop + dir * Math.round(metrics.height * 1.4);
          }

          const minStep = Math.max(220, Math.round(metrics.height * 0.65));
          if (dir < 0 && est > currentTop - minStep) {
            est = Math.max(lowBound.scrollTop, currentTop - minStep);
          } else if (dir > 0 && est < currentTop + minStep) {
            est = Math.min(highBound.scrollTop, currentTop + minStep);
          }
          searchTarget = est;
        }

        searchTarget = Math.max(0, Math.min(maxScroll, Math.round(searchTarget)));

        // Avoid zero-movement stall unless boundaries themselves prevent movement
        if (Math.abs(searchTarget - currentTop) < 5 && hop > 1) {
          const nudgeDir = (visRange.maxRound !== -1 && targetRound > visRange.maxRound) ? 1
            : ((visRange.minRound !== -1 && targetRound < visRange.minRound) ? -1 : (lastSearchDir || 1));
          const nudgeDist = Math.max(320, Math.round(metrics.height * 0.7));
          const nudged = Math.max(0, Math.min(maxScroll, currentTop + nudgeDir * nudgeDist));
          if (Math.abs(nudged - currentTop) >= 5) {
            lastSearchDir = nudgeDir;
            searchTarget = nudged;
          }
        }

        // Execute instant jump (zero slow intermediate blank sweep), then observe asynchronously
        // via rAF until virtual/deferred DOM renders & height stabilizes (or target is found immediately).
        if (Math.abs(searchTarget - currentTop) >= 1) {
          scroller.scrollTop = searchTarget;
        }
        lastHopScrollHeight = scroller.scrollHeight;

        const hopJumpTime = performance.now();
        const minHopSettleMs = 45;
        const maxHopSettleMs = 280;
        let prevScrollHeight = scroller.scrollHeight;
        let prevUserTurnCount = getUserTurnElements().length;
        let prevAllTurnCount = document.querySelectorAll(Utils.SELECTORS.query.chatTurn).length;
        let stableCount = 0;
        let settleRafId = null;
        let hopCanceled = false;

        activeNavigationCancel = () => {
          hopCanceled = true;
          if (settleRafId !== null) {
            cancelAnimationFrame(settleRafId);
            settleRafId = null;
          }
          if (searchSettleTimer) {
            clearTimeout(searchSettleTimer);
            searchSettleTimer = null;
          }
        };

        const hopSettleTick = (now) => {
          if (hopCanceled || !isNavigating || myToken !== navigationToken) return;

          const curH = scroller.scrollHeight;
          const curUserTurns = getUserTurnElements();
          const curUserCount = curUserTurns.length;
          const curAllTurns = Array.from(document.querySelectorAll(Utils.SELECTORS.query.chatTurn));
          const curAllCount = curAllTurns.length;

          const domMutated =
            curH !== prevScrollHeight ||
            curUserCount !== prevUserTurnCount ||
            curAllCount !== prevAllTurnCount;

          if (domMutated) {
            prevScrollHeight = curH;
            prevUserTurnCount = curUserCount;
            prevAllTurnCount = curAllCount;
            stableCount = 0;
          } else {
            stableCount++;
          }

          const foundEl = findTargetElement(catalogItem);
          if (foundEl) {
            settleRafId = null;
            landOnTarget(foundEl);
            return;
          }

          const hopElapsed = now - hopJumpTime;
          const curMetrics = getScrollerViewportMetrics(scroller);
          const curViewBound = {
            topMin: curMetrics.top - curMetrics.height * 1.5,
            topMax: curMetrics.top + curMetrics.height * 2.5
          };
          const nearViewportTurns = curAllTurns.filter((t) => {
            const r = t.getBoundingClientRect();
            return r.bottom >= curMetrics.top - 120 && r.top <= curMetrics.top + curMetrics.height + 120;
          });
          const hasUnhydratedViewportTurn = nearViewportTurns.some((t) => {
            const cont = t.querySelector(Utils.SELECTORS.query.chatTurnContainer);
            if (!cont) return true;
            if (cont.classList.contains(Utils.SELECTORS.class.userTurn)) {
              return !getCleanPromptText(t) && !turnHasAttachment(t);
            }
            return false;
          });
          const hasAnchorsNow = domMutated
            ? false
            : (inferVisibleRoundRange(curUserTurns, catalogData, null, curViewBound).anchors.length > 0 || sawBottomMiss || sawTopMiss || emptyGapConsecutive > 0);
          const readyByStability = !hasUnhydratedViewportTurn && hopElapsed >= minHopSettleMs && stableCount >= 2 && hasAnchorsNow;

          if (readyByStability || hopElapsed >= maxHopSettleMs) {
            settleRafId = null;
            if (hop < maxSearchHops) {
              runSearchHop(hop + 1);
            } else {
              cleanup(false);
            }
            return;
          }

          settleRafId = requestAnimationFrame(hopSettleTick);
        };

        settleRafId = requestAnimationFrame(hopSettleTick);
      };

      // Check if target is already in DOM
      const initialTargetEl = findTargetElement(catalogItem);
      if (initialTargetEl) {
        landOnTarget(initialTargetEl);
        return;
      }

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

      const myToken = ++navigationToken;
      activeNavState = null;
      lastNavigationEndAt = 0;

      const getMaxScroll = () => Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      const initialMax = getMaxScroll();
      const totalDistance = Math.abs(initialMax - scroller.scrollTop);
      if (totalDistance < 1) return;

      const prevScrollBehavior = scroller.style.scrollBehavior;
      const computedBehavior = window.getComputedStyle ? window.getComputedStyle(scroller).scrollBehavior : '';
      const didOverrideBehavior = computedBehavior === 'smooth' || prevScrollBehavior === 'smooth';
      if (didOverrideBehavior) {
        scroller.style.scrollBehavior = 'auto';
      }
      const restoreBehavior = () => {
        if (didOverrideBehavior) {
          scroller.style.scrollBehavior = prevScrollBehavior;
        }
      };

      if (totalDistance > 520) {
        const approachDist = Math.min(340, Math.max(180, Math.round((scroller.clientHeight || 800) * 0.42)));
        scroller.scrollTop = Math.max(0, initialMax - approachDist);
      }

      const remainingDistance = Math.abs(getMaxScroll() - scroller.scrollTop);
      const duration = Math.min(210, Math.max(95, Math.round(80 + Math.sqrt(remainingDistance) * 4.5)));
      let tailAttempts = 0;

      const finishOrConverge = () => {
        if (myToken !== navigationToken) {
          restoreBehavior();
          return;
        }
        const liveMax = getMaxScroll();
        const tailRemaining = liveMax - scroller.scrollTop;
        if (Math.abs(tailRemaining) > 4 && tailAttempts < 4) {
          tailAttempts++;
          if (Math.abs(tailRemaining) > 520) {
            const approachDist = Math.min(340, Math.max(180, Math.round((scroller.clientHeight || 800) * 0.42)));
            scroller.scrollTop = Math.max(0, liveMax - approachDist);
          }
          const settleDur = Math.min(180, Math.max(85, Math.round(70 + Math.sqrt(Math.abs(getMaxScroll() - scroller.scrollTop)) * 4)));
          const settleCancel = animateScrollTo(scroller, getMaxScroll, settleDur, finishOrConverge);
          activeNavigationCancel = () => {
            settleCancel();
            restoreBehavior();
          };
          return;
        }
        restoreBehavior();
        activeNavigationCancel = null;
      };

      const cancelAnim = animateScrollTo(scroller, getMaxScroll, duration, finishOrConverge);
      activeNavigationCancel = () => {
        cancelAnim();
        restoreBehavior();
      };
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
    if (lastNavigationEndAt > 0 && (performance.now() - lastNavigationEndAt) < 350) {
      return;
    }

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

  let userScrollKeyListenerBound = false;

  function setupScrollSpy() {
    const scroller = getChatScrollContainer();
    if (!scroller || boundScrollers.has(scroller)) return;

    boundScrollers.add(scroller);

    const onManualScrollInput = (e) => {
      if (isNavigating) return;
      if (e && e.target && e.target.closest && e.target.closest('#' + Utils.SELECTORS.id.catalogPanel)) {
        return;
      }
      activeNavState = null;
      lastNavigationEndAt = 0;
    };
    const onScrollbarPointerDown = (e) => {
      if (e && e.target === scroller && e.offsetX >= scroller.clientWidth) {
        onManualScrollInput(e);
      }
    };
    scroller.addEventListener('wheel', onManualScrollInput, { passive: true });
    scroller.addEventListener('touchstart', onManualScrollInput, { passive: true });
    scroller.addEventListener('pointerdown', onScrollbarPointerDown, { passive: true });

    if (!userScrollKeyListenerBound) {
      userScrollKeyListenerBound = true;
      window.addEventListener('keydown', (e) => {
        if (isNavigating) return;
        const active = document.activeElement;
        if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || active.isContentEditable)) {
          return;
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'PageUp' || e.key === 'PageDown' || e.key === 'Home' || e.key === 'End' || e.key === ' ') {
          activeNavState = null;
          lastNavigationEndAt = 0;
        }
      }, { passive: true });
    }

    let scrollTimer = null;
    scroller.addEventListener('scroll', () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        const withinNavGrace = lastNavigationEndAt > 0 && (performance.now() - lastNavigationEndAt) < 400;
        if (!isNavigating && !withinNavGrace) {
          const movedPastLandedSpot = activeNavState &&
            activeNavState.landedScrollTop !== undefined &&
            Math.abs(scroller.scrollTop - activeNavState.landedScrollTop) > 12;
          if (!activeNavState || movedPastLandedSpot) {
            activeNavState = null;
            lastNavigationEndAt = 0;
            updateActiveTurnByViewport();
          }
        }
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
    listItem.setAttribute('data-item-type', catalogItem.type || 'text');
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

    const scroller = getChatScrollContainer();
    const withinNavGrace = lastNavigationEndAt > 0 && (performance.now() - lastNavigationEndAt) < 400;
    const stillAtLandedSpot = Boolean(
      activeNavState &&
      activeNavState.catalogItem && (
        isNavigating ||
        withinNavGrace ||
        !scroller ||
        activeNavState.landedScrollTop === undefined ||
        Math.abs(scroller.scrollTop - activeNavState.landedScrollTop) <= 24
      )
    );

    if (stillAtLandedSpot) {
      applyNavSelectionHighlight(listContainer, activeNavState.catalogItem, isNavigating);
    } else {
      if (activeNavState) {
        activeNavState = null;
        lastNavigationEndAt = 0;
      }
      updateActiveTurnByViewport();
    }
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
    refreshCatalogFromDriveCache,
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
