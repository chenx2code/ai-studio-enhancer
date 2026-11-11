(function () {
  'use strict';

  // Define core keywords for target APIs
  const TARGET_KEYWORDS = [
    'CreatePrompt',
    'ResolveDriveResource',
    'UpdatePrompt'
  ];

  // Match Google Drive v3 file metadata XHR endpoints across Google API hosts
  const DRIVE_METADATA_URL_REGEX = /^https:\/\/(?:content|www|clients6)\.googleapis\.com\/drive\/v3\/files\/([^/?#]+)(?:[?#]|$)/i;

  function isSafeShortString(str) {
    if (typeof str !== 'string') return false;
    const trimmed = str.trim();
    if (!trimmed || trimmed.length >= 500) return false;
    if (/^data:[^;]+;base64,/i.test(trimmed)) return false;
    if (trimmed.length >= 180 && /^[A-Za-z0-9+/=_-]+$/.test(trimmed)) return false;
    return true;
  }

  // Collect short non-blob strings up to a shallow depth for attachment metadata inspection
  function extractShallowSafeStrings(root) {
    const out = [];
    const seen = new Set();
    const maxItems = 24;
    const maxDepth = 4;

    function walk(node, depth) {
      if (out.length >= maxItems || node === null || node === undefined) return;
      if (typeof node === 'string') {
        const trimmed = node.trim();
        if (!isSafeShortString(trimmed)) return;
        if (!seen.has(trimmed)) {
          seen.add(trimmed);
          out.push(trimmed);
        }
        return;
      }
      if (depth >= maxDepth) return;
      if (Array.isArray(node)) {
        for (let i = 0; i < node.length && out.length < maxItems; i++) {
          walk(node[i], depth + 1);
        }
      } else if (typeof node === 'object') {
        const vals = Object.values(node);
        for (let i = 0; i < vals.length && out.length < maxItems; i++) {
          walk(vals[i], depth + 1);
        }
      }
    }

    walk(root, 0);
    return out;
  }

  // Sanitize a single turn[1] image entry while preserving slot count and any Drive File IDs
  function sanitizeImageSlot(imgEntry) {
    if (typeof imgEntry === 'string') {
      const trimmed = imgEntry.trim();
      return isSafeShortString(trimmed) ? trimmed : '[OMITTED_IMAGE]';
    }
    if (imgEntry && (Array.isArray(imgEntry) || typeof imgEntry === 'object')) {
      const safeStrings = extractShallowSafeStrings(imgEntry);
      if (safeStrings.length === 1) return safeStrings[0];
      if (safeStrings.length > 1) return safeStrings;
    }
    return '[OMITTED_IMAGE]';
  }

  // Check if a URL contains any of the target keywords
  function getTargetKeyword(url) {
    if (!url) return null;
    // Ensure URL is a string
    const urlStr = typeof url === 'string' ? url : url.toString();
    return TARGET_KEYWORDS.find(keyword => urlStr.includes(keyword));
  }

  // Extract Drive File ID when URL points to Drive v3 metadata JSON (excluding media downloads)
  function getDriveFileIdFromUrl(url) {
    if (!url) return null;
    const urlStr = typeof url === 'string' ? url : url.toString();
    const match = urlStr.match(DRIVE_METADATA_URL_REGEX);
    if (!match) return null;
    if (/[?&]alt=media(?:[&#]|$)/i.test(urlStr)) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch (e) {
      return match[1];
    }
  }

  // --- Intercept XMLHttpRequest ---
  const originalXhrOpen = window.XMLHttpRequest.prototype.open;
  const originalXhrSend = window.XMLHttpRequest.prototype.send;

  window.XMLHttpRequest.prototype.open = function (...args) {
    this._method = typeof args[0] === 'string' ? args[0].toUpperCase() : 'GET';
    // Ensure _url is a string even if a URL object is passed
    this._url = typeof args[1] === 'string' ? args[1] : (args[1] ? args[1].toString() : '');
    return originalXhrOpen.apply(this, args);
  };

  window.XMLHttpRequest.prototype.send = function (...args) {
    const matchedKeyword = getTargetKeyword(this._url);
    const driveFileId = !matchedKeyword && this._method !== 'DELETE'
      ? getDriveFileIdFromUrl(this._url)
      : null;

    // Only attach listener if this is a target API request or Drive metadata request
    if (matchedKeyword || driveFileId) {
      const xhr = this;

      // Use loadend so it always fires (success, error, or abort)
      function onLoadEnd() {
        xhr.removeEventListener('loadend', onLoadEnd);
        if (xhr.readyState !== 4) return;

        if (driveFileId) {
          if (typeof xhr.status === 'number' && (xhr.status < 200 || xhr.status >= 300)) return;
          try {
            let data = null;
            if (!xhr.responseType || xhr.responseType === 'text') {
              if (!xhr.responseText) return;
              data = JSON.parse(xhr.responseText);
            } else if (xhr.responseType === 'json') {
              data = xhr.response;
            } else {
              return;
            }

            if (!data || typeof data !== 'object' || Array.isArray(data) || data.error) return;
            const resolvedId = typeof data.id === 'string' && data.id.trim() ? data.id.trim() : driveFileId;
            const name = typeof data.name === 'string' ? data.name.trim() : '';
            const mimeType = typeof data.mimeType === 'string' ? data.mimeType.trim() : '';
            const fileExtension = typeof data.fileExtension === 'string' ? data.fileExtension.trim() : '';
            if (!resolvedId || (!name && !mimeType)) return;

            window.postMessage({
              type: 'FROM_INTERCEPTOR',
              apiKeyword: 'DRIVE_FILE_METADATA',
              payload: {
                id: resolvedId,
                name,
                mimeType,
                fileExtension
              }
            }, '*');
          } catch (e) {
            // Ignore non-JSON or aborted Drive metadata responses
          }
          return;
        }

        try {
          if (!xhr.responseType || xhr.responseType === 'text') {
            // Proceed to parse text JSON
          } else {
            return;
          }
          const data = JSON.parse(xhr.responseText);
          let turns = null;
          let promptData = null;

          if (matchedKeyword === 'ResolveDriveResource') {
            turns = data?.[0]?.[13]?.[0];
            promptData = data?.[0]?.[4];
          } else if (matchedKeyword === 'UpdatePrompt' || matchedKeyword === 'CreatePrompt') {
            turns = data?.[13]?.[0];
            promptData = data?.[4];
          }

          // Clean up heavy data from turns to prevent memory bloat (OOM)
          if (turns && Array.isArray(turns)) {
            turns.forEach(turn => {
              if (!Array.isArray(turn)) return;
              // turn[1] is imageContent (preserve array length and any Drive File IDs)
              if (turn[1] && Array.isArray(turn[1])) {
                turn[1] = turn[1].map(sanitizeImageSlot);
              }
              // turn[3] is cloudFileContent (preserve shallow metadata/MIME/filename/Drive ID strings while stripping heavy payloads)
              if (turn[3] && Array.isArray(turn[3])) {
                const safeStrings = extractShallowSafeStrings(turn[3]);
                turn[3] = safeStrings.length > 0 ? safeStrings : ['[OMITTED_CLOUD_FILE]'];
              }
              // turn[12] is inlineContent
              if (turn[12] && Array.isArray(turn[12])) {
                const isImageBlob = typeof turn[12][0] === 'string' && turn[12][0].startsWith('image/');
                if (isImageBlob) {
                  turn[12] = [turn[12][0], '[OMITTED_IMAGE_DATA]'];
                }
              }
              // turn[23] is docContent (preserve shallow metadata/MIME/filename strings while discarding heavy base64 data)
              if (turn[23] && Array.isArray(turn[23])) {
                const safeStrings = extractShallowSafeStrings(turn[23]);
                turn[23] = safeStrings.length > 0 ? safeStrings : ['Document'];
              }
            });
          }

          window.postMessage({ type: 'FROM_INTERCEPTOR', payload: { turns, promptData }, apiKeyword: matchedKeyword }, '*');
        } catch (e) {
          console.error('Error parsing XHR response to JSON:', e);
        }
      }

      this.addEventListener('loadend', onLoadEnd);
    }

    return originalXhrSend.apply(this, args);
  };

})();
