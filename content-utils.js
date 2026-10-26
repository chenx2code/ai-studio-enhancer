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
    const isPlaceholder = (val) => {
      if (!val || typeof val !== 'string') return true;
      const clean = val.trim().toLowerCase();
      return (
        !clean ||
        clean === 'uploaded image preview' ||
        clean === 'uploaded image' ||
        clean === 'image preview' ||
        clean === 'preview image' ||
        clean === 'preview' ||
        clean === 'image' ||
        clean === '[image]' ||
        clean === '上传的图片预览' ||
        clean === '上传的图片' ||
        clean === '图片预览' ||
        clean === '图片' ||
        clean.startsWith('view image') ||
        clean.startsWith('remove image') ||
        clean.startsWith('delete image')
      );
    };

    // 1. Look for explicit real filename on img or its container hierarchy
    let realName = '';
    const candidates = [
      img.getAttribute('data-filename'),
      img.getAttribute('data-name'),
      img.title,
      img.alt
    ];

    const container = img.closest(
      '.file-preview-container, [class*="file-preview"], [class*="image-preview"], [class*="preview"], [role="group"]'
    );
    if (container) {
      candidates.push(
        container.getAttribute('data-filename'),
        container.getAttribute('data-name'),
        container.title,
        container.getAttribute('aria-label')
      );

      // Button inside container (e.g. view full screen or remove)
      const btn = container.querySelector('button[aria-label]');
      if (btn) {
        const btnLabel = btn.getAttribute('aria-label');
        if (btnLabel && !isPlaceholder(btnLabel)) {
          const match = btnLabel.match(/([^\s\/\\:*\?"<>|]+\.[a-zA-Z0-9]{2,5})/);
          if (match) candidates.push(match[1]);
          else candidates.push(btnLabel);
        }
      }
    }

    for (const cand of candidates) {
      if (cand && !isPlaceholder(cand)) {
        let cleaned = cand.replace(/^(remove|delete|view)\s+/i, '').trim();
        if (cleaned && !isPlaceholder(cleaned)) {
          realName = cleaned;
          break;
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
        if (img.classList.contains('user-icon') || img.classList.contains('avatar') || (img.src && img.src.includes('googleusercontent.com/a/'))) {
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
        inlineContent.forEach((item, subIdx) => {
          if (typeof item === 'string' && (item.startsWith('image/') || item.includes('OMITTED'))) {
            apiImages.push({ index, domIndex, subIdx });
          }
        });
      }
    });

    const totalImages = Math.max(domImages.length, apiImages.length);

    // Populate image attachments
    if (domImages.length > 0) {
      domImages.forEach(({ img, domIndex, subIdx }, idx) => {
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
          subIndex: subIdx,
          turnIndex: turnIndex
        });
      });

      // If API has more images than DOM (due to virtualization), supplement missing ones
      if (apiImages.length > domImages.length) {
        const defaultWord = chrome.i18n.getMessage('imageLabel') || 'Image';
        for (let i = domImages.length; i < apiImages.length; i++) {
          const apiImg = apiImages[i];
          attachments.push({
            type: 'image',
            fileCategory: 'image',
            fileType: 'IMG',
            fileName: totalImages > 1 ? `${defaultWord} ${i + 1}` : defaultWord,
            isDefaultName: true,
            domIndex: apiImg.domIndex,
            subIndex: apiImg.subIdx,
            turnIndex: apiImg.index
          });
        }
      }
    } else if (apiImages.length > 0) {
      const defaultWord = chrome.i18n.getMessage('imageLabel') || 'Image';
      apiImages.forEach((apiImg, idx) => {
        attachments.push({
          type: 'image',
          fileCategory: 'image',
          fileType: 'IMG',
          fileName: totalImages > 1 ? `${defaultWord} ${idx + 1}` : defaultWord,
          isDefaultName: true,
          domIndex: apiImg.domIndex,
          subIndex: apiImg.subIdx,
          turnIndex: apiImg.index
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
