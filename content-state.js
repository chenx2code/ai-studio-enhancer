(function (global) {
  'use strict';
  global.__AIStudioEnhancer__ = global.__AIStudioEnhancer__ || {};

  let conversationHistory = null;
  let promptTitle = chrome.i18n.getMessage('promptTitleDefault') || 'Conversation';
  let catalogData = [];

  global.__AIStudioEnhancer__.State = {
    getHistory: () => conversationHistory,
    setHistory: (history) => { conversationHistory = history; },
    
    getTitle: () => promptTitle,
    setTitle: (title) => { promptTitle = title; },
    
    getCatalogData: () => catalogData,
    setCatalogData: (data) => { catalogData = data; }
  };

})(window);
