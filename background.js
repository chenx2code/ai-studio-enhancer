chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GENERATION_COMPLETE') {
    let messageBody = chrome.i18n.getMessage('notificationMessage') || 'Google AI Studio has finished generating a response.';
    
    if (request.chatTitle) {
      messageBody = `[${request.chatTitle}]\n${messageBody}`;
    }

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: chrome.i18n.getMessage('notificationTitle') || 'Generation Complete',
      message: messageBody,
      priority: 2
    });
  }
});
