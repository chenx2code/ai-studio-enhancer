(function() {
  'use strict';

  // 定义目标API的核心关键词
  const TARGET_KEYWORDS = [
    'CreatePrompt',
    'ResolveDriveResource',
    'UpdatePrompt'
  ];


  // 检查一个URL是否包含任何一个目标关键词
  function getTargetKeyword(url) {
    if (!url) return null;
    return TARGET_KEYWORDS.find(keyword => url.includes(keyword));
  }

  // --- 拦截 XMLHttpRequest ---
  const originalXhrOpen = window.XMLHttpRequest.prototype.open;
  const originalXhrSend = window.XMLHttpRequest.prototype.send;

  window.XMLHttpRequest.prototype.open = function(...args) {
    this._url = args[1];
    return originalXhrOpen.apply(this, args);
  };

  window.XMLHttpRequest.prototype.send = function(...args) {
    const xhr = this;
    
    function onLoad() {
      xhr.removeEventListener('load', onLoad);
      const matchedKeyword = getTargetKeyword(xhr._url);
      if (xhr.readyState === 4 && matchedKeyword) {
        try {
          const data = JSON.parse(xhr.responseText);
          window.postMessage({ type: 'FROM_INTERCEPTOR', payload: data, apiKeyword: matchedKeyword }, '*');
        } catch (e) {
          console.error('解析 XHR 响应为JSON时出错:', e);
        }
      }
    }
    
    this.addEventListener('load', onLoad);
    return originalXhrSend.apply(this, args);
  };

})();
