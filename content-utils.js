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
    const cloudFileContent = turn[3]; // Large cloud drive files
    const inlineContent = turn[12];
    const youtubeContent = turn[13];
    const docContent = turn[23]; // Normal files

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
    
    if (cloudFileContent && Array.isArray(cloudFileContent) && cloudFileContent.length > 0 && typeof cloudFileContent[0] === 'string') {
      return { text: '[PDF File]', type: 'pdf' };
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

  /**
   * Classify file type into one of 10 granular categories (or fallback 'file').
   */
  function detectFileCategory(fileType, fileName, isFolder) {
    if (isFolder || (fileType && fileType.toLowerCase() === 'folder')) {
      return 'folder';
    }

    const ext = (fileType || '').toLowerCase();
    const name = (fileName || '').toLowerCase();

    if (ext === 'pdf' || name.endsWith('.pdf')) {
      return 'pdf';
    }

    const codeExts = [
      'py', 'js', 'ts', 'jsx', 'tsx', 'html', 'htm', 'css', 'scss', 'sass',
      'json', 'yaml', 'yml', 'xml', 'sql', 'sh', 'bash', 'zsh', 'c', 'cpp',
      'cc', 'cxx', 'h', 'hpp', 'java', 'go', 'rs', 'php', 'rb', 'swift',
      'kt', 'kts', 'dart', 'scala', 'r', 'lua', 'vue', 'svelte'
    ];
    if (codeExts.includes(ext) || codeExts.some((ce) => name.endsWith('.' + ce))) {
      return 'code';
    }

    const tableExts = ['csv', 'xlsx', 'xls', 'tsv', 'parquet', 'feather', 'ods'];
    if (tableExts.includes(ext) || tableExts.some((te) => name.endsWith('.' + te))) {
      return 'table';
    }

    const textExts = ['md', 'markdown', 'txt', 'rtf', 'log', 'doc', 'docx', 'odt', 'tex'];
    if (textExts.includes(ext) || textExts.some((te) => name.endsWith('.' + te))) {
      return 'text';
    }

    const audioExts = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'opus', 'wma'];
    if (audioExts.includes(ext) || audioExts.some((ae) => name.endsWith('.' + ae)) || ext === 'audio') {
      return 'audio';
    }

    const videoExts = ['mp4', 'mov', 'webm', 'mkv', 'avi', 'flv', 'wmv'];
    if (videoExts.includes(ext) || videoExts.some((ve) => name.endsWith('.' + ve)) || ext === 'video' || ext === 'youtube') {
      return 'video';
    }

    const archiveExts = ['zip', 'tar', 'gz', 'tgz', 'rar', '7z', 'bz2', 'xz'];
    if (archiveExts.includes(ext) || archiveExts.some((ae) => name.endsWith('.' + ae))) {
      return 'archive';
    }

    const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico', 'tiff'];
    if (imageExts.includes(ext) || imageExts.some((ie) => name.endsWith('.' + ie)) || ext === 'image') {
      return 'image';
    }

    return 'file';
  }

  /**
   * Extract clean image info, resolving true filename if present, or human-friendly label.
   */
  function extractImageInfo(img, imgIdx, totalImages) {
    const UI_ACTION_EXACT = new Set([
      'uploaded image preview',
      'uploaded image',
      'image preview',
      'preview image',
      'preview',
      'image',
      '[image]',
      'generated image',
      'attached image',
      'loaded image',
      'thinking',
      'download',
      'download image',
      'download file',
      'view full image',
      'view fullscreen',
      'fullscreen',
      'full screen',
      'open options',
      'more options',
      'options',
      'menu',
      'expand',
      'collapse',
      'zoom',
      'zoom in',
      'zoom out',
      'copy',
      'copy image',
      'share',
      'edit',
      'close',
      'remove',
      'delete',
      'view',
      'more_vert',
      '上传的图片预览',
      '上传的图片',
      '图片预览',
      '图片',
      '生成的图片',
      '下载',
      '下载图片',
      '查看大图',
      '查看原图',
      '全屏',
      '更多选项',
      '打开选项',
      '选项',
      '菜单',
      '展开',
      '放大',
      '复制',
      '复制图片',
      '分享',
      '编辑',
      '关闭',
      '删除',
      '移除'
    ]);

    const isPlaceholder = (val) => {
      if (!val || typeof val !== 'string') return true;
      const clean = val.trim().toLowerCase();
      if (!clean) return true;
      if (UI_ACTION_EXACT.has(clean)) return true;
      return (
        clean.startsWith('view image') ||
        clean.startsWith('view full') ||
        clean.startsWith('remove image') ||
        clean.startsWith('delete image') ||
        clean.startsWith('download image') ||
        clean.startsWith('download file')
      );
    };

    const extractExtensionFilename = (val) => {
      if (!val || typeof val !== 'string') return '';
      const stripped = val.replace(/^(remove|delete|view|download|open|preview)\s+/i, '').trim();
      if (!stripped || isPlaceholder(stripped)) return '';
      const fullMatch = stripped.match(/^([^\/\\:*\?"<>|\r\n]+\.[a-zA-Z0-9]{2,5})$/);
      if (fullMatch && !isPlaceholder(fullMatch[1])) return fullMatch[1].trim();
      const tokenMatch = stripped.match(/([^\s\/\\:*\?"<>|]+\.[a-zA-Z0-9]{2,5})/);
      if (tokenMatch && !isPlaceholder(tokenMatch[1])) return tokenMatch[1].trim();
      return '';
    };

    const container = img.closest(
      '.image-container, ms-image-chunk, ms-prompt-chunk, .file-preview-container, [class*="file-preview"], [class*="image-preview"], [class*="preview"], [role="group"]'
    );
    const tightImageContainer = img.closest(
      '.image-container, ms-image-chunk, .file-preview-container, [class*="file-preview"], [class*="image-preview"]'
    ) || container;

    const explicitFileAttrs = [
      img.getAttribute('data-filename'),
      img.getAttribute('data-name')
    ];
    if (container) {
      explicitFileAttrs.push(
        container.getAttribute('data-filename'),
        container.getAttribute('data-name')
      );
    }
    if (tightImageContainer) {
      const downloadLinks = tightImageContainer.querySelectorAll('a[download]');
      for (const link of downloadLinks) {
        const dlName = link.getAttribute('download');
        if (dlName) explicitFileAttrs.push(dlName);
      }
    }

    const directImageAttrs = [img.title, img.alt];
    if (container && container.title) {
      directImageAttrs.push(container.title);
    }

    let realName = '';

    // Tier A: Prefer explicit filename with extension on explicit attrs or img attributes
    for (const cand of [...explicitFileAttrs, ...directImageAttrs]) {
      const extName = extractExtensionFilename(cand);
      if (extName) {
        realName = extName;
        break;
      }
    }

    // Tier B: Scan tight container UI attributes/controls ONLY for strings containing a file extension
    if (!realName && tightImageContainer) {
      const uiCandidates = [
        tightImageContainer.getAttribute('aria-label')
      ];
      const controls = tightImageContainer.querySelectorAll('button[aria-label], a[aria-label], [ng-reflect-message]');
      for (const ctrl of controls) {
        uiCandidates.push(
          ctrl.getAttribute('aria-label'),
          ctrl.getAttribute('ng-reflect-message')
        );
      }
      for (const cand of uiCandidates) {
        const extName = extractExtensionFilename(cand);
        if (extName) {
          realName = extName;
          break;
        }
      }
    }

    // Tier C: Extensionless non-placeholder name ONLY from explicit attrs or img title/alt (never button aria-label)
    if (!realName) {
      for (const cand of [...explicitFileAttrs, ...directImageAttrs]) {
        if (cand && !isPlaceholder(cand)) {
          const cleaned = cand.trim();
          if (cleaned && !isPlaceholder(cleaned)) {
            realName = cleaned;
            break;
          }
        }
      }
    }

    // Determine extension and tag
    let fileType = 'IMG';
    if (realName) {
      const extMatch = realName.match(/\.([a-zA-Z0-9]+)$/);
      if (extMatch) {
        fileType = extMatch[1].toUpperCase();
      }
    }

    const defaultWord = chrome.i18n.getMessage('imageLabel') || 'Image';
    const fallbackLabel = totalImages > 1 ? `${defaultWord} ${imgIdx + 1}` : defaultWord;

    return {
      fileName: realName || fallbackLabel,
      fileType: fileType,
      fileCategory: 'image',
      isDefaultName: !realName,
      imageIndex: imgIdx,
      totalImages: totalImages
    };
  }

  /**
   * Extract attachments for a round of user chunks from live DOM elements and API turn data.
   */
  function extractRoundAttachments(chunks, roundElements, fullText) {
    const attachments = [];
    const seenSignatures = new Set();

    // Normalize roundElements into array of { element, domIndex }
    const elementList = [];
    if (Array.isArray(roundElements)) {
      roundElements.forEach((item) => {
        if (item && item.element) {
          elementList.push(item);
        } else if (item instanceof Element) {
          elementList.push({ element: item, domIndex: undefined });
        }
      });
    } else if (roundElements instanceof Element) {
      elementList.push({ element: roundElements, domIndex: undefined });
    }

    // 1. Gather all rendered images across DOM cards of this round
    const domImages = [];
    elementList.forEach(({ element, domIndex }) => {
      const images = Array.from(element.querySelectorAll('img')).filter((img) => {
        if (
          (img.classList && (img.classList.contains('user-icon') || img.classList.contains('avatar'))) ||
          (img.src && (img.src.includes('googleusercontent.com/a/') || img.src.includes('watermark.png'))) ||
          (img.alt && img.alt.trim().toLowerCase() === 'thinking')
        ) {
          return false;
        }
        return true;
      });
      images.forEach((img, subIdx) => {
        domImages.push({ img, domIndex, subIdx });
      });
    });

    // 2. Gather image occurrences from API chunks in this round
    const apiImages = [];
    chunks.forEach((chunkItem) => {
      const turn = chunkItem.turn || chunkItem;
      const index = chunkItem.index;
      const domIndex = chunkItem.domIndex;
      if (!Array.isArray(turn)) return;
      const imageContent = turn[1];
      const inlineContent = turn[12];
      if (Array.isArray(imageContent) && imageContent.length > 0) {
        imageContent.forEach((_, subIdx) => {
          apiImages.push({ index, domIndex, subIdx });
        });
      } else if (Array.isArray(inlineContent) && inlineContent.length > 0) {
        if (typeof inlineContent[0] === 'string' && (inlineContent[0].startsWith('image/') || inlineContent[0].includes('OMITTED'))) {
          apiImages.push({ index, domIndex, subIdx: 0 });
        }
      }
    });

    const totalImages = Math.max(domImages.length, apiImages.length);
    const defaultWord = chrome.i18n.getMessage('imageLabel') || 'Image';

    // Populate image attachments without shifting mounted chunks onto unmounted sibling slots
    if (apiImages.length > 0) {
      const usedDomImgs = new Set();
      const useChunkDomAlignment = elementList.length > 1;

      apiImages.forEach((apiImg, slotIdx) => {
        let matchedDomIdx = -1;
        if (useChunkDomAlignment && apiImg.domIndex !== undefined) {
          matchedDomIdx = domImages.findIndex((d, i) => !usedDomImgs.has(i) && d.domIndex === apiImg.domIndex);
        } else {
          matchedDomIdx = domImages.findIndex((_, i) => !usedDomImgs.has(i));
        }

        if (matchedDomIdx !== -1) {
          usedDomImgs.add(matchedDomIdx);
          const { img } = domImages[matchedDomIdx];
          const info = extractImageInfo(img, slotIdx, totalImages);
          attachments.push({
            type: 'image',
            fileCategory: 'image',
            fileType: info.fileType,
            fileName: info.fileName,
            isDefaultName: info.isDefaultName,
            domIndex: apiImg.domIndex,
            subIndex: slotIdx,
            turnIndex: apiImg.index
          });
        } else {
          attachments.push({
            type: 'image',
            fileCategory: 'image',
            fileType: 'IMG',
            fileName: totalImages > 1 ? `${defaultWord} ${slotIdx + 1}` : defaultWord,
            isDefaultName: true,
            domIndex: apiImg.domIndex,
            subIndex: slotIdx,
            turnIndex: apiImg.index
          });
        }
      });

      // Append any remaining DOM images beyond apiImages count
      domImages.forEach(({ img, domIndex }, i) => {
        if (usedDomImgs.has(i)) return;
        const slotIdx = attachments.length;
        const info = extractImageInfo(img, slotIdx, totalImages);
        const matchingChunk = chunks.find(c => c && c.domIndex === domIndex);
        const turnIndex = matchingChunk ? matchingChunk.index : (chunks[0] ? (chunks[0].index !== undefined ? chunks[0].index : undefined) : undefined);
        attachments.push({
          type: 'image',
          fileCategory: 'image',
          fileType: info.fileType,
          fileName: info.fileName,
          isDefaultName: info.isDefaultName,
          domIndex: domIndex,
          subIndex: slotIdx,
          turnIndex: turnIndex
        });
      });
    } else if (domImages.length > 0) {
      domImages.forEach(({ img, domIndex }, idx) => {
        const info = extractImageInfo(img, idx, totalImages);
        const matchingChunk = chunks.find(c => c && c.domIndex === domIndex);
        const turnIndex = matchingChunk ? matchingChunk.index : (chunks[0] ? (chunks[0].index !== undefined ? chunks[0].index : undefined) : undefined);
        attachments.push({
          type: 'image',
          fileCategory: 'image',
          fileType: info.fileType,
          fileName: info.fileName,
          isDefaultName: info.isDefaultName,
          domIndex: domIndex,
          subIndex: idx,
          turnIndex: turnIndex
        });
      });
    }

    // 3. Extract file elements / chips across DOM cards of this round
    elementList.forEach(({ element, domIndex }) => {
      const fileElements = Array.from(element.querySelectorAll('[class*="file"], [class*="chip"], [class*="attachment"], ms-file-chunk, ms-media-chunk, [data-test-id*="file"]')).filter((el) => {
        if (el.classList.contains('chat-turn-container') || el.tagName.toLowerCase() === 'ms-chat-turn') {
          return false;
        }
        const text = el.textContent ? el.textContent.trim() : '';
        if (!text || (fullText && text === fullText)) return false;
        return !el.querySelector('[class*="file"], [class*="chip"], [class*="attachment"]');
      });

      fileElements.forEach((fel) => {
        let rawText = fel.textContent.trim();
        rawText = rawText.replace(/\s*[\d,.]+[kKmM]?\s*tokens?/i, '').trim();
        const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
        let fName = lines.length > 1 ? lines[lines.length - 1] : lines[0];
        fName = fName.replace(/\s*[\d,.]+[kKmM]?\s*tokens?/i, '').trim();

        if (fName && fName.length < 150 && !fName.toLowerCase().includes('run settings')) {
          const extMatch = fName.match(/\.([a-zA-Z0-9]+)$/);
          let fileType = extMatch ? extMatch[1].toUpperCase() : 'PDF';
          const isFolder = fName.toLowerCase().includes('folder');
          const category = detectFileCategory(fileType, fName, isFolder);
          const sig = `file:${fName}`;
          if (!seenSignatures.has(sig)) {
            seenSignatures.add(sig);
            const matchingChunk = chunks.find(c => c && c.domIndex === domIndex);
            attachments.push({
              type: 'file',
              fileCategory: category,
              fileType: fileType,
              fileName: fName,
              domIndex: domIndex,
              turnIndex: matchingChunk ? matchingChunk.index : (chunks[0] ? (chunks[0].index !== undefined ? chunks[0].index : undefined) : undefined)
            });
          }
        }
      });
    });

    // 4. Extract or supplement from API chunks in this round
    chunks.forEach((chunkItem) => {
      const turn = chunkItem.turn || chunkItem;
      const index = chunkItem.index;
      const domIndex = chunkItem.domIndex;
      if (!Array.isArray(turn)) return;

      const cloudFileContent = turn[3];
      const youtubeContent = turn[13];
      const docContent = turn[23];

      if (youtubeContent && Array.isArray(youtubeContent) && youtubeContent.length > 0) {
        const sig = `video:youtube:${index}`;
        if (!seenSignatures.has(sig)) {
          seenSignatures.add(sig);
          attachments.push({
            type: 'video',
            fileCategory: 'video',
            fileType: 'Video',
            fileName: 'YouTube Video',
            turnIndex: index,
            domIndex: domIndex
          });
        }
      }

      if (docContent && Array.isArray(docContent) && docContent.length > 0) {
        const mimeOrName = docContent[0] || '';
        let fileName = (docContent[1] && typeof docContent[1] === 'string' && docContent[1].length < 150) ? docContent[1] : '';
        const friendlyType = getFriendlyFileType(mimeOrName);
        let tag = friendlyType === 'Markdown' ? 'MD' : (friendlyType === 'Document' ? 'DOC' : friendlyType.toUpperCase());
        const category = detectFileCategory(tag, fileName || mimeOrName, false);

        // If we already have a DOM attachment without an accurate fileType, enhance it
        const unassignedFile = attachments.find(a => a.type === 'file' && !a.enhanced);
        if (unassignedFile) {
          unassignedFile.fileType = tag;
          unassignedFile.fileCategory = category;
          unassignedFile.enhanced = true;
          unassignedFile.turnIndex = index;
          if (unassignedFile.domIndex === undefined) unassignedFile.domIndex = domIndex;
        } else {
          if (!fileName) {
            fileName = `${friendlyType} ${chrome.i18n.getMessage('fileLabel') || 'File'}`;
          }
          const sig = `file:${fileName}:${index}`;
          if (!seenSignatures.has(sig)) {
            seenSignatures.add(sig);
            attachments.push({
              type: 'file',
              fileCategory: category,
              fileType: tag,
              fileName: fileName,
              turnIndex: index,
              domIndex: domIndex
            });
          }
        }
      }

      if (cloudFileContent && Array.isArray(cloudFileContent) && cloudFileContent.length > 0) {
        const unassignedFile = attachments.find(a => a.type === 'file' && !a.enhanced);
        if (unassignedFile) {
          unassignedFile.fileType = 'PDF';
          unassignedFile.fileCategory = 'pdf';
          unassignedFile.enhanced = true;
          unassignedFile.turnIndex = index;
          if (unassignedFile.domIndex === undefined) unassignedFile.domIndex = domIndex;
        } else {
          const sig = `file:cloud:${index}`;
          if (!seenSignatures.has(sig)) {
            seenSignatures.add(sig);
            attachments.push({
              type: 'file',
              fileCategory: 'pdf',
              fileType: 'PDF',
              fileName: `PDF ${chrome.i18n.getMessage('fileLabel') || 'File'}`,
              turnIndex: index,
              domIndex: domIndex
            });
          }
        }
      }
    });

    return attachments;
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
    getFriendlyFileType,
    getAttachmentPlaceholder,
    truncateText,
    showTooltip,
    hideTooltip,
    createToolbarButton,
    detectFileCategory,
    extractImageInfo,
    extractRoundAttachments,
    extractUserAccount
  };

})(window);
