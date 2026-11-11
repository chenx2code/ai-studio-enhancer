// content-catalog-locator.js
// Resolves prompt rounds, DOM layout modes (round vs chunk), text/attachment matching,
// and target DOM elements across virtualized / lazy-hydrated chat turns.

(function (global) {
  'use strict';
  global.__AIStudioEnhancer__ = global.__AIStudioEnhancer__ || {};

  const State = global.__AIStudioEnhancer__.State;
  const Utils = global.__AIStudioEnhancer__.Utils;
  const Attachments = global.__AIStudioEnhancer__.Attachments;

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

  global.__AIStudioEnhancer__.CatalogLocator = {
    getUserTurnElements,
    getCleanPromptText,
    normalizeTextForMatch,
    compactTextForMatch,
    textsLooselyMatch,
    doesElementMatchText,
    getTurnContentImages,
    getTurnContentFiles,
    getTurnContentVideos,
    turnHasAttachment,
    doesFileElementMatchName,
    matchAttachmentInTurn,
    extractRoundsSummary,
    detectDomLayoutMode,
    buildDomLookupContext,
    inferCatalogRoundIndex,
    inferVisibleRoundRange,
    resolveRoundFromNeighbors,
    findTargetElement
  };

})(window);
