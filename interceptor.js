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
            window.postMessage({ type: 'FROM_INTERCEPTOR', payload: data, apiKeyword: matchedKeyword }, '*');
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
