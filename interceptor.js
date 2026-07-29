(function() {
  'use strict';

  // Define core keywords for target APIs
  const TARGET_KEYWORDS = [
    'CreatePrompt',
    'ResolveDriveResource',
    'UpdatePrompt'
  ];

  // Check if a URL contains any of the target keywords
  function getTargetKeyword(url) {
    if (!url) return null;
    // Ensure URL is a string
    const urlStr = typeof url === 'string' ? url : url.toString();
    return TARGET_KEYWORDS.find(keyword => urlStr.includes(keyword));
  }

  // --- Intercept XMLHttpRequest ---
  const originalXhrOpen = window.XMLHttpRequest.prototype.open;
  const originalXhrSend = window.XMLHttpRequest.prototype.send;

  window.XMLHttpRequest.prototype.open = function(...args) {
    // Ensure _url is a string even if a URL object is passed
    this._url = typeof args[1] === 'string' ? args[1] : (args[1] ? args[1].toString() : '');
    return originalXhrOpen.apply(this, args);
  };

  window.XMLHttpRequest.prototype.send = function(...args) {
    const matchedKeyword = getTargetKeyword(this._url);
    
    // Only attach listener if this is a target API request
    if (matchedKeyword) {
      const xhr = this;
      
      // Use loadend so it always fires (success, error, or abort)
      function onLoadEnd() {
        xhr.removeEventListener('loadend', onLoadEnd);
        if (xhr.readyState === 4) {
          try {
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
                  // turn[1] is imageContent
                  if (turn[1] && Array.isArray(turn[1])) {
                     turn[1] = turn[1].length > 0 ? ['[OMITTED_IMAGE]'] : [];
                  }
                  // turn[3] is cloudFileContent
                  if (turn[3] && Array.isArray(turn[3])) {
                     turn[3] = turn[3].length > 0 ? ['[OMITTED_CLOUD_FILE]'] : [];
                  }
                  // turn[12] is inlineContent
                  if (turn[12] && Array.isArray(turn[12])) {
                     turn[12] = turn[12].length > 0 ? ['image/[OMITTED]'] : [];
                  }
                  // turn[23] is docContent
                  if (turn[23] && Array.isArray(turn[23])) {
                     // Keep the mimetype for getFriendlyFileType, discard the actual content
                     turn[23] = turn[23].length > 0 ? [turn[23][0]] : [];
                  }
               });
            }

            window.postMessage({ type: 'FROM_INTERCEPTOR', payload: { turns, promptData }, apiKeyword: matchedKeyword }, '*');
          } catch (e) {
            console.error('Error parsing XHR response to JSON:', e);
          }
        }
      }
      
      this.addEventListener('loadend', onLoadEnd);
    }
    
    return originalXhrSend.apply(this, args);
  };

})();
