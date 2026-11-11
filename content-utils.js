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
    if (!mimeType || typeof mimeType !== 'string') return 'File';
    const raw = mimeType.trim();
    if (!raw) return 'File';
    const type = raw.toLowerCase();

    // Check explicit filename extension before MIME substring rules to prevent false matches like "cmd.py"
    if (!type.includes('/') && !type.includes('://')) {
      const extMatch = type.match(/\.([a-z0-9]*[a-z][a-z0-9]{0,9})$/);
      if (extMatch) {
        const ext = extMatch[1];
        if (ext === 'pdf') return 'PDF';
        if (ext === 'md' || ext === 'markdown') return 'Markdown';
        if (ext === 'csv') return 'CSV';
        if (ext === 'tsv') return 'TSV';
        if (ext === 'json') return 'JSON';
        if (ext === 'html' || ext === 'htm') return 'HTML';
        if (ext === 'xml') return 'XML';
        if (ext === 'yaml' || ext === 'yml') return 'YAML';
        if (ext === 'sql') return 'SQL';
        if (ext === 'txt') return 'Text';
        if (ext === 'py') return 'Python';
        if (ext === 'js' || ext === 'jsx' || ext === 'mjs' || ext === 'cjs') return 'JavaScript';
        if (ext === 'ts' || ext === 'tsx') return 'TypeScript';
        if (ext.length <= 8) return ext.toUpperCase();
        return 'File';
      }
    }

    if (type.includes('pdf')) return 'PDF';
    if (type.includes('markdown') || type === 'text/md' || type === 'md') return 'Markdown';
    if (type.includes('csv')) return 'CSV';
    if (type.includes('tab-separated-values') || type === 'text/tsv') return 'TSV';
    if (type.includes('json')) return 'JSON';
    if (type.includes('html')) return 'HTML';
    if (type.includes('xml')) return 'XML';
    if (type.includes('yaml')) return 'YAML';
    if (type.includes('sql')) return 'SQL';
    if (type.includes('text/plain')) return 'Text';
    if (type.includes('python')) return 'Python';
    if (type.includes('javascript')) return 'JavaScript';
    if (type.includes('typescript')) return 'TypeScript';
    if (type.includes('vnd.google-apps.folder')) return 'Folder';
    if (type.includes('vnd.google-apps.spreadsheet') || type.includes('spreadsheetml')) return 'Spreadsheet';
    if (type.includes('vnd.google-apps.presentation') || type.includes('presentationml')) return 'Presentation';
    if (type.includes('vnd.google-apps.document') || type.includes('wordprocessingml') || type.includes('msword')) return 'Document';

    const parts = type.split('/');
    if (parts.length === 2) {
      const subType = parts[1];
      if (subType && subType !== 'octet-stream' && subType.length <= 8 && !subType.includes('vnd') && !subType.includes('+')) {
        return subType.toUpperCase();
      }
    }
    return 'File';
  }

  function friendlyTypeToTag(friendlyType, mimeOrName) {
    const raw = (mimeOrName || '').toLowerCase();
    if (friendlyType === 'Markdown') return 'MD';
    if (friendlyType === 'Python') return 'PY';
    if (friendlyType === 'Text') return 'TXT';
    if (friendlyType === 'JavaScript') return 'JS';
    if (friendlyType === 'TypeScript') return 'TS';
    if (friendlyType === 'JS/TS') return 'JS';
    if (friendlyType === 'Folder') return 'FOLDER';
    if (friendlyType === 'Spreadsheet') return 'XLSX';
    if (friendlyType === 'Presentation') return 'PPT';
    if (friendlyType === 'Document') {
      if (raw.includes('word') || raw.includes('google-apps.document') || /\.docx?$/i.test(raw)) {
        return 'DOC';
      }
      return 'FILE';
    }
    if (!friendlyType || friendlyType === 'File' || friendlyType === 'Document') return 'FILE';
    return friendlyType.toUpperCase();
  }

  function isValidExtensionFileName(str) {
    if (!str || typeof str !== 'string') return '';
    const trimmed = str.trim();
    if (!trimmed || trimmed.length > 180) return '';
    if (trimmed.includes('://') || /^data:/i.test(trimmed) || /^blob:/i.test(trimmed)) return '';
    if (/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(trimmed)) return '';
    if (/^(?:[a-z0-9-]+\.)*(?:google(?:apis)?|gstatic|youtube)\.com$/i.test(trimmed)) return '';
    if (trimmed === '[OMITTED_CLOUD_FILE]' || trimmed === 'Document' || trimmed === 'File') return '';
    if (/(\.\.\.|\u2026)$/.test(trimmed)) return '';
    const m = trimmed.match(/^([^\/\\:*?"<>|\r\n]+\.([a-zA-Z0-9]*[a-zA-Z][a-zA-Z0-9]{0,9}))$/);
    return m ? m[1].trim() : '';
  }

  function isMimeTypeString(str) {
    if (!str || typeof str !== 'string') return false;
    const trimmed = str.trim();
    if (!trimmed || trimmed.length > 120 || trimmed.includes(' ') || trimmed.includes('://')) return false;
    return /^(application|text|audio|video|image|multipart|model)\/[a-zA-Z0-9.+_-]+$/i.test(trimmed);
  }

  function isLikelyDriveFileId(str) {
    if (!str || typeof str !== 'string') return false;
    const trimmed = str.trim();
    if (!trimmed || trimmed.length < 18 || trimmed.length > 80) return false;
    if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return false;
    return /[A-Za-z]/.test(trimmed) && /[0-9]/.test(trimmed);
  }

  function getDriveRecordFromState(driveId) {
    if (!driveId || typeof driveId !== 'string') return null;
    const enhancer = global.__AIStudioEnhancer__;
    const State = enhancer && enhancer.State;
    if (!State || typeof State.getDriveMetadata !== 'function') return null;
    return State.getDriveMetadata(driveId) || null;
  }

  function extractDriveFileIdFromSlot(slot) {
    if (!slot) return '';
    const enhancer = global.__AIStudioEnhancer__;
    const State = enhancer && enhancer.State;
    const hasLookup = Boolean(State && typeof State.getDriveMetadata === 'function');
    const candidates = [];

    const walk = (node, depth) => {
      if (depth > 3 || node === null || node === undefined) return;
      if (typeof node === 'string') {
        const trimmed = node.trim();
        if (trimmed) candidates.push(trimmed);
        return;
      }
      if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) {
          walk(node[i], depth + 1);
        }
      }
    };

    walk(slot, 0);

    // Prefer exact hit already stored in State Drive metadata cache
    if (hasLookup) {
      for (let i = 0; i < candidates.length; i++) {
        if (State.getDriveMetadata(candidates[i])) {
          return candidates[i];
        }
      }
    }

    // Prefer mixed-case Drive File IDs first, then any valid Drive ID morphology
    let fallbackId = '';
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (!isLikelyDriveFileId(c)) continue;
      if (/[A-Z]/.test(c) && /[a-z]/.test(c) && c.length >= 25) {
        return c;
      }
      if (!fallbackId) {
        fallbackId = c;
      }
    }

    return fallbackId;
  }

  function resolveAttachmentFromDriveMetadata(driveRec, attachmentType, fallbackFileName) {
    if (!driveRec || typeof driveRec !== 'object') {
      return null;
    }

    const rawName = typeof driveRec.n === 'string'
      ? driveRec.n.trim()
      : (typeof driveRec.name === 'string' ? driveRec.name.trim() : '');
    const rawMime = typeof driveRec.m === 'string'
      ? driveRec.m.trim()
      : (typeof driveRec.mimeType === 'string' ? driveRec.mimeType.trim() : '');
    const rawExt = (typeof driveRec.e === 'string'
      ? driveRec.e.trim()
      : (typeof driveRec.fileExtension === 'string' ? driveRec.fileExtension.trim() : '')).replace(/^\./, '');
    const sourceRank = typeof driveRec.s === 'number' ? driveRec.s : 1;
    const isTruncated = Boolean(rawName && /(\.\.\.|\u2026)$/.test(rawName));

    if (attachmentType === 'image') {
      let imgType = 'IMG';
      if (rawName && !isTruncated) {
        const extMatch = rawName.match(/\.([a-zA-Z0-9]{1,8})$/);
        if (extMatch) {
          imgType = extMatch[1].toUpperCase();
        }
      }
      if (imgType === 'IMG' && rawMime && rawMime.toLowerCase().startsWith('image/')) {
        const sub = rawMime.split('/')[1].split('+')[0].replace(/^x-/i, '').toUpperCase();
        if (sub && sub.length <= 6 && sub !== '*') {
          imgType = sub;
        }
      }
      return {
        fileName: rawName || (fallbackFileName || ''),
        fileType: imgType,
        fileCategory: 'image',
        friendlyType: 'Image',
        isDefaultName: !rawName,
        isTruncatedName: isTruncated,
        hasExplicitType: Boolean(rawName),
        sourceRank: sourceRank
      };
    }

    const validMime = rawMime && rawMime.toLowerCase() !== 'application/octet-stream' ? rawMime : '';
    const extMatch = (!isTruncated && rawName)
      ? rawName.match(/\.([a-zA-Z0-9]*[a-zA-Z][a-zA-Z0-9]{0,9})$/)
      : null;

    let friendlyType = 'File';
    let fileType = 'FILE';
    let fileCategory = 'file';

    if (extMatch) {
      fileType = extMatch[1].toUpperCase();
      friendlyType = getFriendlyFileType(rawName);
      fileCategory = detectFileCategory(fileType, rawName, false);
    } else if (validMime) {
      friendlyType = getFriendlyFileType(validMime);
      fileType = friendlyTypeToTag(friendlyType, validMime);
      const isFolder = fileType === 'FOLDER' || validMime.toLowerCase().includes('folder');
      fileCategory = detectFileCategory(fileType, validMime, isFolder);
    } else if (!isTruncated && rawExt && /^[a-zA-Z0-9]*[a-zA-Z][a-zA-Z0-9]{0,9}$/.test(rawExt)) {
      fileType = rawExt.toUpperCase();
      friendlyType = getFriendlyFileType('.' + rawExt);
      fileCategory = detectFileCategory(fileType, '.' + rawExt, false);
    } else if (rawName && !isTruncated && /\bfolder\b/i.test(rawName)) {
      fileType = 'FOLDER';
      friendlyType = 'Folder';
      fileCategory = 'folder';
    } else if (rawMime) {
      friendlyType = getFriendlyFileType(rawMime);
    }

    return {
      fileName: rawName || (fallbackFileName || ''),
      fileType: fileType,
      fileCategory: fileCategory,
      friendlyType: friendlyType,
      isDefaultName: !rawName,
      isTruncatedName: isTruncated,
      hasExplicitType: fileType !== 'FILE',
      sourceRank: sourceRank
    };
  }

  function inferFileMetadataFromApiSlot(slotArray) {
    const result = {
      fileType: 'FILE',
      fileCategory: 'file',
      fileName: '',
      friendlyType: 'File',
      isDefaultName: true,
      isTruncatedName: false,
      hasExplicitType: false,
      driveFileId: '',
      sourceRank: 0
    };
    if (!Array.isArray(slotArray) || slotArray.length === 0) return result;

    let detectedMime = '';
    let detectedName = '';

    const visit = (node, depth) => {
      if (depth > 3 || node === null || node === undefined) return;
      if (typeof node === 'string') {
        const s = node.trim();
        if (!s || s.length >= 300) return;
        if (!detectedMime && isMimeTypeString(s) && s.toLowerCase() !== 'application/octet-stream') {
          detectedMime = s;
        }
        if (!detectedName) {
          const extName = isValidExtensionFileName(s);
          if (extName) {
            detectedName = extName;
          }
        }
        return;
      }
      if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) {
          visit(node[i], depth + 1);
          if (detectedMime && detectedName) break;
        }
      }
    };

    visit(slotArray, 0);

    const driveFileId = extractDriveFileIdFromSlot(slotArray);
    if (driveFileId) {
      result.driveFileId = driveFileId;
    }

    const driveRec = driveFileId ? getDriveRecordFromState(driveFileId) : null;
    const driveMeta = driveRec ? resolveAttachmentFromDriveMetadata(driveRec, 'file') : null;

    // Prefer non-truncated cached Drive metadata when available, or authoritative drive_api metadata
    if (driveMeta && driveMeta.fileName && (!driveMeta.isTruncatedName || !detectedName)) {
      result.fileName = driveMeta.fileName;
      result.fileType = driveMeta.fileType;
      result.friendlyType = driveMeta.friendlyType;
      result.fileCategory = driveMeta.fileCategory;
      result.isDefaultName = false;
      result.isTruncatedName = Boolean(driveMeta.isTruncatedName);
      result.hasExplicitType = driveMeta.hasExplicitType;
      result.sourceRank = driveMeta.sourceRank || 0;

      if (result.fileType === 'FILE' && detectedMime) {
        const friendly = getFriendlyFileType(detectedMime);
        const tag = friendlyTypeToTag(friendly, detectedMime);
        const isFolder = tag === 'FOLDER' || detectedMime.toLowerCase().includes('folder');
        if (tag !== 'FILE') {
          result.friendlyType = friendly;
          result.fileType = tag;
          result.fileCategory = detectFileCategory(tag, detectedMime, isFolder);
          result.hasExplicitType = true;
        }
      }
      return result;
    }

    if (detectedName) {
      const extMatch = detectedName.match(/\.([a-zA-Z0-9]*[a-zA-Z][a-zA-Z0-9]{0,9})$/);
      const tag = extMatch ? extMatch[1].toUpperCase() : 'FILE';
      result.fileName = detectedName;
      result.fileType = tag;
      result.friendlyType = getFriendlyFileType(detectedName);
      result.fileCategory = detectFileCategory(tag, detectedName, false);
      result.isDefaultName = false;
      result.hasExplicitType = true;
      return result;
    }

    const effectiveMime = detectedMime || (driveRec && driveRec.m ? driveRec.m : '');
    if (effectiveMime && effectiveMime.toLowerCase() !== 'application/octet-stream') {
      const friendly = getFriendlyFileType(effectiveMime);
      const tag = friendlyTypeToTag(friendly, effectiveMime);
      const isFolder = tag === 'FOLDER' || effectiveMime.toLowerCase().includes('folder');
      result.friendlyType = friendly;
      result.fileType = tag;
      result.fileCategory = detectFileCategory(tag, effectiveMime, isFolder);
      result.hasExplicitType = tag !== 'FILE';
      result.sourceRank = driveMeta ? (driveMeta.sourceRank || 0) : 0;
      return result;
    }

    return result;
  }

  function getAttachmentPlaceholder(turn) {
    if (!turn || !Array.isArray(turn)) return null;
    
    const imageContent = turn[1];
    const cloudFileContent = turn[3]; // Large cloud drive files
    const inlineContent = turn[12];
    const youtubeContent = turn[13];
    const docContent = turn[23]; // Normal files

    if (imageContent && Array.isArray(imageContent) && imageContent.length > 0) {
      if (imageContent.length === 1) {
        const driveId = extractDriveFileIdFromSlot(imageContent[0]);
        const driveRec = driveId ? getDriveRecordFromState(driveId) : null;
        if (driveRec && driveRec.n) {
          return { text: `[${driveRec.n}]`, type: 'image' };
        }
      }
      return { text: '[Image]', type: 'image' };
    }
    
    if (inlineContent && Array.isArray(inlineContent) && inlineContent.length > 0 && typeof inlineContent[0] === 'string' && inlineContent[0].startsWith('image/')) {
      return { text: '[Image]', type: 'image' };
    }
    
    if (youtubeContent && Array.isArray(youtubeContent) && youtubeContent.length > 0) {
      return { text: '[YouTube Video]', type: 'video' };
    }
    
    if (docContent && Array.isArray(docContent) && docContent.length > 0) {
      const meta = inferFileMetadataFromApiSlot(docContent);
      if (meta.fileName) {
        return { text: `[${meta.fileName}]`, type: meta.fileCategory };
      }
      const friendly = meta.friendlyType;
      return {
        text: friendly === 'File' || friendly === 'Document' ? '[File]' : `[${friendly} File]`,
        type: meta.fileType !== 'FILE' ? meta.fileType.toLowerCase() : 'file'
      };
    }
    
    if (cloudFileContent && Array.isArray(cloudFileContent) && cloudFileContent.length > 0) {
      const meta = inferFileMetadataFromApiSlot(cloudFileContent);
      if (meta.fileName) {
        return { text: `[${meta.fileName}]`, type: meta.fileCategory };
      }
      if (meta.hasExplicitType && meta.friendlyType !== 'File') {
        return { text: `[${meta.friendlyType} File]`, type: meta.fileType.toLowerCase() };
      }
      return { text: '[File]', type: 'file' };
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
      isTruncatedName: false,
      imageIndex: imgIdx,
      totalImages: totalImages
    };
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
   * Collect file attachment elements within a turn or round root without descending into nested duplicates
   * or misclassifying image-only preview wrappers as file chips.
   */
  function getTurnFileElements(rootEl) {
    if (!rootEl || typeof rootEl.querySelectorAll !== 'function') return [];

    const hasFileStructure = (el) => {
      const tag = el.tagName ? el.tagName.toLowerCase() : '';
      if (tag === 'ms-file-chunk' || tag === 'ms-drive-file') return true;
      return Boolean(
        el.getAttribute('data-filename') ||
        el.getAttribute('data-name') ||
        el.querySelector('.file-chunk-container, .name, [data-filename], [data-name]')
      );
    };

    const shouldSkipElement = (el) => {
      if (!el || el === rootEl) return true;
      const tag = el.tagName ? el.tagName.toLowerCase() : '';
      if (
        tag === 'ms-chat-turn' ||
        tag === 'ms-image-chunk' ||
        tag === 'ms-youtube-chunk' ||
        tag === 'ms-text-chunk' ||
        tag === 'button' ||
        (el.classList && (
          el.classList.contains('chat-turn-container') ||
          el.classList.contains('actions-container') ||
          el.classList.contains('token-count') ||
          el.classList.contains('loading-icon') ||
          el.classList.contains('thumbnail-icon')
        ))
      ) {
        return true;
      }
      if (closestWithinBoundary(el, 'ms-image-chunk, ms-youtube-chunk, ms-text-chunk, button', rootEl)) {
        return true;
      }
      if (el.querySelector('ms-image-chunk, ms-youtube-chunk')) {
        return true;
      }
      const imgs = Array.from(el.querySelectorAll('img')).filter(isTurnContentImage);
      if (imgs.length > 0 && !hasFileStructure(el)) {
        return true;
      }
      return false;
    };

    const accepted = [];
    const acceptIfUnique = (el) => {
      for (let i = 0; i < accepted.length; i++) {
        if (accepted[i] === el || isDescendantElement(accepted[i], el, rootEl)) {
          return;
        }
      }
      accepted.push(el);
    };

    const structuredChunks = Array.from(
      rootEl.querySelectorAll('ms-file-chunk, ms-media-chunk, ms-drive-file')
    );
    structuredChunks.forEach((el) => {
      if (!shouldSkipElement(el)) {
        acceptIfUnique(el);
      }
    });

    const genericChips = Array.from(
      rootEl.querySelectorAll('[class*="file"], [class*="chip"], [class*="attachment"], [data-test-id*="file"]')
    );
    genericChips.forEach((el) => {
      if (shouldSkipElement(el)) return;
      if (closestWithinBoundary(el, 'ms-file-chunk, ms-media-chunk, ms-drive-file', rootEl)) return;
      if (el.querySelector('[class*="file"], [class*="chip"], [class*="attachment"], ms-file-chunk, ms-media-chunk, ms-drive-file')) {
        return;
      }
      acceptIfUnique(el);
    });

    return accepted;
  }

  /**
   * Extract clean filename and category from a rendered file attachment element (e.g. <ms-file-chunk>).
   */
  function extractFileInfo(fileEl, fileIdx, totalFiles) {
    const safeIdx = typeof fileIdx === 'number' && fileIdx >= 0 ? fileIdx : 0;
    const safeTotal = typeof totalFiles === 'number' && totalFiles > 0 ? totalFiles : 1;
    const defaultWord = chrome.i18n.getMessage('fileLabel') || 'File';
    const fallbackLabel = safeTotal > 1 ? `${defaultWord} ${safeIdx + 1}` : defaultWord;

    const makeDefault = () => ({
      fileName: fallbackLabel,
      fileType: 'FILE',
      fileCategory: 'file',
      isDefaultName: true,
      isTruncatedName: false,
      fileIndex: safeIdx,
      totalFiles: safeTotal
    });

    if (!fileEl) return makeDefault();

    const FILE_UI_PLACEHOLDERS = new Set([
      'docs',
      'description',
      'insert_drive_file',
      'draft',
      'article',
      'picture_as_pdf',
      'code',
      'table_chart',
      'folder',
      'folder_open',
      'attach_file',
      'upload_file',
      'progress_activity',
      'hourglass_empty',
      'sync',
      'close',
      'remove',
      'delete',
      'clear',
      'cancel',
      'open_in_new',
      'download',
      'more_vert',
      'more_horiz',
      'expand_more',
      'chevron_right',
      'loading',
      'loading...',
      'file',
      '[file]',
      'pdf file',
      'document',
      '[document]',
      'attachment',
      'run settings',
      '文件',
      '文档',
      '附件',
      '加载中',
      '删除',
      '移除',
      '下载',
      '关闭'
    ]);

    const cleanFileCandidate = (raw) => {
      if (!raw || typeof raw !== 'string') return '';
      return raw
        .replace(/(?:\s|^)[\d,.]+[kKmM]?\s*tokens?\b/gi, '')
        .replace(/^[\s·|-]+|[\s·|-]+$/g, '')
        .trim();
    };

    const isPlaceholderCandidate = (val) => {
      const cleaned = cleanFileCandidate(val);
      if (!cleaned || cleaned.length >= 150) return true;
      const lower = cleaned.toLowerCase();
      if (FILE_UI_PLACEHOLDERS.has(lower)) return true;
      if (lower.includes('run settings')) return true;
      if (/^[\d,.]+[kKmM]?\s*tokens?$/i.test(cleaned)) return true;
      return false;
    };

    const isIgnoredTextNodeContainer = (node) => {
      if (!node || node.nodeType !== 1) return false;
      const tag = node.tagName ? node.tagName.toLowerCase() : '';
      if (tag === 'button' || tag === 'mat-icon' || tag === 'svg' || tag === 'style' || tag === 'script') {
        return true;
      }
      if (node.getAttribute && node.getAttribute('aria-hidden') === 'true') {
        return true;
      }
      if (node.classList && (
        node.classList.contains('loading-icon') ||
        node.classList.contains('thumbnail-icon') ||
        node.classList.contains('token-count') ||
        node.classList.contains('material-symbols-outlined') ||
        node.classList.contains('material-icons') ||
        node.classList.contains('material-symbols-rounded') ||
        node.classList.contains('mat-icon') ||
        node.classList.contains('cdk-visually-hidden') ||
        node.classList.contains('sr-only')
      )) {
        return true;
      }
      return false;
    };

    const readCleanTextLines = (root) => {
      const lines = [];
      const visit = (node) => {
        if (!node) return;
        if (node.nodeType === 3) {
          const val = (node.nodeValue || '').trim();
          if (val) lines.push(val);
          return;
        }
        if (isIgnoredTextNodeContainer(node)) return;

        const hasChildNodes = node.childNodes && node.childNodes.length > 0;
        if (hasChildNodes) {
          for (let i = 0; i < node.childNodes.length; i++) {
            visit(node.childNodes[i]);
          }
          return;
        }

        if (node.children && node.children.length > 0) {
          for (let i = 0; i < node.children.length; i++) {
            visit(node.children[i]);
          }
          return;
        }

        const txt = (node.textContent || '').trim();
        if (txt) {
          txt.split('\n').forEach((part) => {
            const trimmed = part.trim();
            if (trimmed) lines.push(trimmed);
          });
        }
      };

      visit(root);
      return lines;
    };

    const nameEl = fileEl.querySelector('.name, [class*="file-name"], [class*="filename"]');
    const explicitCandidates = [
      fileEl.getAttribute('data-filename'),
      fileEl.getAttribute('data-name')
    ];
    if (nameEl) {
      explicitCandidates.push(
        nameEl.getAttribute('data-filename'),
        nameEl.getAttribute('data-name'),
        nameEl.getAttribute('title'),
        nameEl.title
      );
    }
    explicitCandidates.push(fileEl.getAttribute('title'), fileEl.title);

    const downloadLinks = fileEl.querySelectorAll('a[download]');
    for (const link of downloadLinks) {
      const dl = link.getAttribute('download');
      if (dl) explicitCandidates.push(dl);
    }

    const nameElLines = nameEl ? readCleanTextLines(nameEl) : [];

    const controlCandidates = [];
    const ariaLabels = [fileEl.getAttribute('aria-label')];
    const controls = fileEl.querySelectorAll('button[aria-label], a[aria-label], [ng-reflect-message]');
    for (const ctrl of controls) {
      ariaLabels.push(ctrl.getAttribute('aria-label'), ctrl.getAttribute('ng-reflect-message'));
    }
    ariaLabels.forEach((lbl) => {
      if (!lbl || typeof lbl !== 'string') return;
      const stripped = lbl.replace(/^(remove|delete|view|download|open|preview)\s+/i, '').trim();
      if (isValidExtensionFileName(stripped)) {
        controlCandidates.push(stripped);
      }
    });

    const fallbackLines = (!nameEl || nameElLines.length === 0) ? readCleanTextLines(fileEl) : [];

    const orderedCandidates = [];
    const pushClean = (raw) => {
      const cleaned = cleanFileCandidate(raw);
      if (cleaned && !isPlaceholderCandidate(cleaned) && !orderedCandidates.includes(cleaned)) {
        orderedCandidates.push(cleaned);
      }
    };

    explicitCandidates.forEach(pushClean);
    nameElLines.forEach(pushClean);
    controlCandidates.forEach(pushClean);
    fallbackLines.forEach(pushClean);

    let realName = '';
    const hasTruncatedSuffix = (s) => /(\.\.\.|\u2026)$/.test(s);

    // Tier 1: Non-truncated candidate with an explicit valid file extension (so title="a.csv" beats "a.c...")
    for (const cand of orderedCandidates) {
      if (!hasTruncatedSuffix(cand) && isValidExtensionFileName(cand)) {
        realName = cand;
        break;
      }
    }

    // Tier 2: Any non-truncated non-placeholder name (e.g. Google Doc title or folder)
    if (!realName) {
      for (const cand of orderedCandidates) {
        if (!hasTruncatedSuffix(cand)) {
          realName = cand;
          break;
        }
      }
    }

    // Tier 3: Visually truncated name (only when full title is not available)
    if (!realName && orderedCandidates.length > 0) {
      realName = orderedCandidates[0];
    }

    if (!realName) {
      return makeDefault();
    }

    const isTruncated = hasTruncatedSuffix(realName);
    const extMatch = !isTruncated ? realName.match(/\.([a-zA-Z0-9]*[a-zA-Z][a-zA-Z0-9]{0,9})$/) : null;
    const isFolder = !extMatch && /\bfolder\b/i.test(realName);
    const fileType = extMatch ? extMatch[1].toUpperCase() : (isFolder ? 'FOLDER' : 'FILE');
    const category = detectFileCategory(fileType, realName, isFolder);

    return {
      fileName: realName,
      fileType: fileType,
      fileCategory: category,
      isDefaultName: false,
      isTruncatedName: isTruncated,
      fileIndex: safeIdx,
      totalFiles: safeTotal
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
      const images = Array.from(element.querySelectorAll('img')).filter(isTurnContentImage);
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
        imageContent.forEach((slotItem, subIdx) => {
          apiImages.push({
            index,
            domIndex,
            subIdx,
            driveFileId: extractDriveFileIdFromSlot(slotItem)
          });
        });
      } else if (Array.isArray(inlineContent) && inlineContent.length > 0) {
        if (typeof inlineContent[0] === 'string' && (inlineContent[0].startsWith('image/') || inlineContent[0].includes('OMITTED'))) {
          apiImages.push({ index, domIndex, subIdx: 0, driveFileId: '' });
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

        const fallbackLabel = totalImages > 1 ? `${defaultWord} ${slotIdx + 1}` : defaultWord;
        const driveRec = apiImg.driveFileId ? getDriveRecordFromState(apiImg.driveFileId) : null;
        const driveImgMeta = driveRec ? resolveAttachmentFromDriveMetadata(driveRec, 'image', fallbackLabel) : null;

        if (matchedDomIdx !== -1) {
          usedDomImgs.add(matchedDomIdx);
          const { img } = domImages[matchedDomIdx];
          const info = extractImageInfo(img, slotIdx, totalImages);
          let finalImgName = info.fileName;
          let finalImgType = info.fileType;
          let finalImgDefault = info.isDefaultName;
          let finalImgTruncated = Boolean(info.isTruncatedName);

          const canApplyDriveImg = Boolean(
            driveImgMeta &&
            !driveImgMeta.isDefaultName &&
            driveImgMeta.fileName && (
              info.isDefaultName ||
              (finalImgTruncated && !driveImgMeta.isTruncatedName) ||
              (!driveImgMeta.isTruncatedName && (driveImgMeta.sourceRank || 0) >= 3)
            )
          );
          if (canApplyDriveImg) {
            finalImgName = driveImgMeta.fileName;
            finalImgType = driveImgMeta.fileType || 'IMG';
            finalImgDefault = false;
            finalImgTruncated = Boolean(driveImgMeta.isTruncatedName);
          }

          attachments.push({
            type: 'image',
            fileCategory: 'image',
            fileType: finalImgType,
            fileName: finalImgName,
            isDefaultName: finalImgDefault,
            isTruncatedName: finalImgTruncated,
            driveFileId: apiImg.driveFileId || '',
            domIndex: apiImg.domIndex,
            subIndex: slotIdx,
            turnIndex: apiImg.index
          });
        } else {
          const useDriveImg = Boolean(driveImgMeta && !driveImgMeta.isDefaultName && driveImgMeta.fileName);
          attachments.push({
            type: 'image',
            fileCategory: 'image',
            fileType: useDriveImg ? (driveImgMeta.fileType || 'IMG') : 'IMG',
            fileName: useDriveImg ? driveImgMeta.fileName : fallbackLabel,
            isDefaultName: !useDriveImg,
            isTruncatedName: useDriveImg ? Boolean(driveImgMeta.isTruncatedName) : false,
            driveFileId: apiImg.driveFileId || '',
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
          isTruncatedName: false,
          driveFileId: '',
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
          isTruncatedName: false,
          driveFileId: '',
          domIndex: domIndex,
          subIndex: idx,
          turnIndex: turnIndex
        });
      });
    }

    // 3. Gather all rendered file elements across DOM cards of this round
    const domFiles = [];
    elementList.forEach(({ element, domIndex }) => {
      const files = getTurnFileElements(element).filter((fel) => {
        const rawText = fel.textContent ? fel.textContent.trim() : '';
        return !(fullText && rawText && rawText === fullText);
      });
      files.forEach((fel, subIdx) => {
        domFiles.push({ element: fel, domIndex, subIdx });
      });
    });

    // 4. Gather video and file occurrences from API chunks in this round
    const apiFiles = [];
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
            isDefaultName: false,
            isTruncatedName: false,
            turnIndex: index,
            domIndex: domIndex
          });
        }
      }

      if (docContent && Array.isArray(docContent) && docContent.length > 0) {
        apiFiles.push({
          source: 'doc',
          meta: inferFileMetadataFromApiSlot(docContent),
          index: index,
          domIndex: domIndex
        });
      }

      if (cloudFileContent && Array.isArray(cloudFileContent) && cloudFileContent.length > 0) {
        apiFiles.push({
          source: 'cloud',
          meta: inferFileMetadataFromApiSlot(cloudFileContent),
          index: index,
          domIndex: domIndex
        });
      }
    });

    const totalFiles = Math.max(domFiles.length, apiFiles.length);
    const defaultFileWord = chrome.i18n.getMessage('fileLabel') || 'File';
    let emittedFileCount = 0;

    // 5. Align DOM file chips and API file slots without overwriting resolved filenames/types with PDF
    if (apiFiles.length > 0) {
      const usedDomFiles = new Set();
      const useChunkFileAlignment = elementList.length > 1;

      apiFiles.forEach((apiFile) => {
        const fileSlotIdx = emittedFileCount++;
        const slotFallbackName = totalFiles > 1 ? `${defaultFileWord} ${fileSlotIdx + 1}` : defaultFileWord;
        let matchedDomIdx = -1;

        if (useChunkFileAlignment && apiFile.domIndex !== undefined) {
          matchedDomIdx = domFiles.findIndex((d, i) => !usedDomFiles.has(i) && d.domIndex === apiFile.domIndex);
        } else {
          matchedDomIdx = domFiles.findIndex((_, i) => !usedDomFiles.has(i));
        }

        const meta = apiFile.meta;
        if (matchedDomIdx !== -1) {
          usedDomFiles.add(matchedDomIdx);
          const { element: fel } = domFiles[matchedDomIdx];
          const info = extractFileInfo(fel, fileSlotIdx, totalFiles);

          let finalName = info.fileName;
          let finalType = info.fileType;
          let finalCategory = info.fileCategory;
          let finalIsDefault = info.isDefaultName;
          let finalIsTruncated = info.isTruncatedName;

          const shouldPreferMetaName = Boolean(
            meta.fileName && (
              info.isDefaultName ||
              (info.isTruncatedName && !meta.isTruncatedName) ||
              ((meta.sourceRank || 0) >= 3 && !meta.isTruncatedName)
            )
          );

          if (shouldPreferMetaName) {
            finalName = meta.fileName;
            finalType = meta.fileType;
            finalCategory = meta.fileCategory;
            finalIsDefault = false;
            finalIsTruncated = Boolean(meta.isTruncatedName);
          } else if (info.isDefaultName && meta.hasExplicitType) {
            finalType = meta.fileType;
            finalCategory = meta.fileCategory;
            if (meta.friendlyType && meta.friendlyType !== 'File') {
              finalName = `${meta.friendlyType} ${defaultFileWord}`;
            }
          } else if (finalType === 'FILE' && finalCategory === 'file' && meta.hasExplicitType) {
            finalType = meta.fileType;
            finalCategory = meta.fileCategory;
          }

          attachments.push({
            type: 'file',
            fileCategory: finalCategory,
            fileType: finalType,
            fileName: finalName,
            isDefaultName: finalIsDefault,
            isTruncatedName: finalIsTruncated,
            driveFileId: meta.driveFileId || '',
            domIndex: apiFile.domIndex,
            subIndex: fileSlotIdx,
            turnIndex: apiFile.index
          });
        } else {
          let fallbackName = slotFallbackName;
          let fallbackDefault = true;
          let fallbackTruncated = false;
          if (meta.fileName) {
            fallbackName = meta.fileName;
            fallbackDefault = false;
            fallbackTruncated = Boolean(meta.isTruncatedName);
          } else if (meta.hasExplicitType && meta.friendlyType && meta.friendlyType !== 'File') {
            fallbackName = `${meta.friendlyType} ${defaultFileWord}`;
            fallbackDefault = meta.isDefaultName;
          }

          attachments.push({
            type: 'file',
            fileCategory: meta.fileCategory,
            fileType: meta.fileType,
            fileName: fallbackName,
            isDefaultName: fallbackDefault,
            isTruncatedName: fallbackTruncated,
            driveFileId: meta.driveFileId || '',
            domIndex: apiFile.domIndex,
            subIndex: fileSlotIdx,
            turnIndex: apiFile.index
          });
        }
      });

      // Append any remaining DOM files beyond apiFiles count
      domFiles.forEach(({ element: fel, domIndex }, i) => {
        if (usedDomFiles.has(i)) return;
        const fileSlotIdx = emittedFileCount++;
        const info = extractFileInfo(fel, fileSlotIdx, totalFiles);
        if (info.isDefaultName && domFiles.length > apiFiles.length) return;
        const matchingChunk = chunks.find(c => c && c.domIndex === domIndex);
        const turnIndex = matchingChunk ? matchingChunk.index : (chunks[0] ? (chunks[0].index !== undefined ? chunks[0].index : undefined) : undefined);
        attachments.push({
          type: 'file',
          fileCategory: info.fileCategory,
          fileType: info.fileType,
          fileName: info.fileName,
          isDefaultName: info.isDefaultName,
          isTruncatedName: info.isTruncatedName,
          driveFileId: '',
          domIndex: domIndex,
          subIndex: fileSlotIdx,
          turnIndex: turnIndex
        });
      });
    } else if (domFiles.length > 0) {
      domFiles.forEach(({ element: fel, domIndex }) => {
        const fileSlotIdx = emittedFileCount++;
        const info = extractFileInfo(fel, fileSlotIdx, totalFiles);
        const matchingChunk = chunks.find(c => c && c.domIndex === domIndex);
        const turnIndex = matchingChunk ? matchingChunk.index : (chunks[0] ? (chunks[0].index !== undefined ? chunks[0].index : undefined) : undefined);
        attachments.push({
          type: 'file',
          fileCategory: info.fileCategory,
          fileType: info.fileType,
          fileName: info.fileName,
          isDefaultName: info.isDefaultName,
          isTruncatedName: info.isTruncatedName,
          driveFileId: '',
          domIndex: domIndex,
          subIndex: fileSlotIdx,
          turnIndex: turnIndex
        });
      });
    }

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
    extractDriveFileIdFromSlot,
    resolveAttachmentFromDriveMetadata,
    truncateText,
    showTooltip,
    hideTooltip,
    createToolbarButton,
    detectFileCategory,
    extractImageInfo,
    getTurnFileElements,
    extractFileInfo,
    extractRoundAttachments,
    extractUserAccount
  };

})(window);
