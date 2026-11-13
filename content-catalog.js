// content-catalog.js
// Manages catalog data extraction/enrichment, Drive cache synchronization, DOM/panel observers,
// and the catalog sidebar panel UI while delegating DOM localization and scroll navigation.

(function (global) {
  'use strict';
  global.__AIStudioEnhancer__ = global.__AIStudioEnhancer__ || {};

  const State = global.__AIStudioEnhancer__.State;
  const Utils = global.__AIStudioEnhancer__.Utils;
  const Attachments = global.__AIStudioEnhancer__.Attachments;
  const Locator = global.__AIStudioEnhancer__.CatalogLocator;
  const Navigator = global.__AIStudioEnhancer__.CatalogNavigator;

  let catalogVisible = false;
  let nativePanelObserver = null;
  let currentlyObservedNativePanel = null;

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
    const userTurnElements = Locator.getUserTurnElements();

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

    const detected = Locator.detectDomLayoutMode(userTurnElements, roundsSummary, totalUserChunks);
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
      } else if (fullText && userTurnElements.length > 0 && Locator.compactTextForMatch(Locator.normalizeTextForMatch(fullText)).length >= 6) {
        const sameTextRoundsCount = roundsSummary.filter(r => r.fullText && Locator.textsLooselyMatch(r.fullText, fullText)).length;
        if (sameTextRoundsCount === 1) {
          const textMatches = userTurnElements.filter(el => Locator.textsLooselyMatch(Locator.getCleanPromptText(el), fullText));
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
      const attachments = Attachments.extractRoundAttachments(round.chunks, roundElements, fullText);

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
    Navigator.clearActiveNavState();
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

    const userTurnElements = Locator.getUserTurnElements();
    const roundsSummary = Locator.extractRoundsSummary(catalogData);
    const totalUserChunks = catalogData[0].totalUserChunks || roundsSummary.length;
    const detected = Locator.detectDomLayoutMode(userTurnElements, roundsSummary, totalUserChunks);
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
      liveFiles.push(...Locator.getTurnContentFiles(userCont));
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
      const getElsForTurn = isImage ? Locator.getTurnContentImages : Locator.getTurnContentFiles;
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
        } else if (item.pureText && Locator.compactTextForMatch(Locator.normalizeTextForMatch(item.pureText)).length >= 6) {
          const sameTextRoundsCount = roundsSummary.filter(r => r.fullText && Locator.textsLooselyMatch(r.fullText, item.pureText)).length;
          if (sameTextRoundsCount === 1) {
            const matchedTextIdx = userTurnElements.findIndex(el => Locator.textsLooselyMatch(Locator.getCleanPromptText(el), item.pureText));
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
          } else if (item.pureText && Locator.compactTextForMatch(Locator.normalizeTextForMatch(item.pureText)).length >= 6) {
            const sameTextRoundsCount = roundsSummary.filter(r => r.fullText && Locator.textsLooselyMatch(r.fullText, item.pureText)).length;
            if (sameTextRoundsCount === 1) {
              const matchedPool = livePool.filter(el => {
                const parentTurn = el.closest(Utils.SELECTORS.query.chatTurn) || el.closest('.chat-turn-container.user');
                if (!parentTurn) return false;
                return Locator.textsLooselyMatch(Locator.getCleanPromptText(parentTurn), item.pureText);
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
                (!o.pureText || !newItem.pureText || Locator.textsLooselyMatch(o.pureText, newItem.pureText)) &&
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

      Navigator.reconcileActiveNavState(newData);

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

          // Only trigger anti-overlap if expanding
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
      Navigator.navigateToPrompt(catalogItem);
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

    Navigator.syncHighlightAfterRender(listContainer);
  }

  function toggleCatalog(forceShow) {
    const catalogPanel = document.getElementById(Utils.SELECTORS.id.catalogPanel);
    const catalogButton = document.getElementById(Utils.SELECTORS.id.catalogButton);
    if (!catalogPanel || !catalogButton) return;

    const isVisible = catalogPanel.classList.contains(Utils.SELECTORS.classExt.panelVisible);
    const shouldShow = forceShow !== undefined ? forceShow : !isVisible;

    if (shouldShow === isVisible) return;

    if (shouldShow) {
      Navigator.setupScrollSpy();
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
    scrollToBottom: Navigator.scrollToBottom,
    getChatMainContainer: Navigator.getChatMainContainer,
    getChatScrollContainer: Navigator.getChatScrollContainer,
    updateScrollButtonPosition: Navigator.updateScrollButtonPosition,
    updateScrollBtnOverlayVisibility: Navigator.updateScrollBtnOverlayVisibility,
    getCatalogVisible,
    getIsHoveringScrollButton: Navigator.getIsHoveringScrollButton,
    setIsHoveringScrollButton: Navigator.setIsHoveringScrollButton,
    getScrollStopTimer: Navigator.getScrollStopTimer,
    setScrollStopTimer: Navigator.setScrollStopTimer
  };

})(window);
