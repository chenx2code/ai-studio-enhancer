(function (global) {
  'use strict';
  global.__AIStudioEnhancer__ = global.__AIStudioEnhancer__ || {};

  function exportToMarkdown() {
    const conversationHistory = global.__AIStudioEnhancer__.State.getHistory();
    const promptTitle = global.__AIStudioEnhancer__.State.getTitle();
    const getFriendlyFileType = global.__AIStudioEnhancer__.Utils.getFriendlyFileType;

    if (!conversationHistory) {
      alert(chrome.i18n.getMessage('errorNoDataSource'));
      return;
    }

    // Read the setting from storage before exporting
    chrome.storage.local.get(['includeThoughts', 'includeLink', 'includeAccount'], (result) => {
      const includeThoughts = result.includeThoughts || false;
      const includeLink = result.includeLink || false;
      const includeAccount = result.includeAccount || false;
      let markdownOutput = '# ' + promptTitle + '\n\n';
      
      if (includeAccount || includeLink) {
        // Attempt to extract the account email from the DOM
        let accountEmail = '';
        if (includeAccount) {
          const accountNode = document.querySelector('[aria-label*="@"]');
          if (accountNode) {
            const ariaLabel = accountNode.getAttribute('aria-label');
            // Match standard email formats
            const emailMatch = ariaLabel.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
            if (emailMatch) {
              accountEmail = emailMatch[1];
            }
          }
        }

        if (includeAccount && accountEmail) {
          const accountText = chrome.i18n.getMessage('accountInfo') || 'Account';
          markdownOutput += `> **${accountText}:** ${accountEmail}\n`;
        }
        
        if (includeLink) {
          const originalLinkText = chrome.i18n.getMessage('originalConversation') || 'Original Conversation';
          markdownOutput += `> **${originalLinkText}:** [${window.location.href}](${window.location.href})\n`;
        }
        markdownOutput += `\n---\n\n`;
      }
      
      for (let i = 0; i < conversationHistory.length; i++) {
        const turn = conversationHistory[i];
        if (!Array.isArray(turn) || turn.length < 9) continue;
        
        const content = turn[0] || '';
        const role = turn[8];
        let finalContent = turn[2] && typeof turn[2] === 'string' ? turn[2] : content;
        
        if (role === 'user') {
          const textContent = turn[0] || '';
          const imageContent = turn[1];
          const youtubeContent = turn[13];
          const docContent = turn[23];
          
          let placeholder = '';
          
          if (imageContent && Array.isArray(imageContent) && imageContent.length > 0) {
            placeholder = '> [Image]\n\n';
          } else if (youtubeContent && Array.isArray(youtubeContent) && youtubeContent.length > 0) {
            placeholder = '> [YouTube Video]\n\n';
          } else if (docContent && Array.isArray(docContent) && docContent.length > 0) {
            const friendlyType = getFriendlyFileType(docContent[0]);
            if (friendlyType === 'Document') {
              placeholder = '> [Document]\n\n';
            } else {
              placeholder = `> [${friendlyType} File]\n\n`;
            }
          } else if (!textContent) {
            placeholder = '> [Attachment]\n\n';
          }

          if (textContent) {
             markdownOutput += placeholder + '## ' + textContent + '\n\n';
          } else if (placeholder) {
             // If no text at all, convert the placeholder into a heading to maintain Markdown structure
             markdownOutput += placeholder.replace('> ', '## ');
          }
        } else if (role === 'model' && finalContent) {
          // Check if the next turn is ALSO a model turn.
          // In Google AI Studio, the "thinking process" is rendered as a separate preceding model turn.
          let isThoughtTurn = false;
          let nextTurnIndex = i + 1;
          while (nextTurnIndex < conversationHistory.length) {
            const nextTurn = conversationHistory[nextTurnIndex];
            if (Array.isArray(nextTurn) && nextTurn.length >= 9) {
              if (nextTurn[8] === 'model') {
                isThoughtTurn = true;
              }
              break; // Found the next valid turn, stop looking ahead
            }
            nextTurnIndex++;
          }
          
          if (isThoughtTurn) {
            if (includeThoughts) {
              // Wrap the thought process in markdown blockquotes
              markdownOutput += '> **[Thought Process / 思考过程]**\n>\n';
              markdownOutput += finalContent.split('\n').map(line => '> ' + line).join('\n');
              markdownOutput += '\n\n';
            }
            // If includeThoughts is false, we simply skip this turn entirely.
          } else {
            // This is the final response turn.
            // Just in case other models still use <think> tags within the same turn:
            if (!includeThoughts) {
              finalContent = finalContent.replace(/<think>[\s\S]*?<\/think>\n*/gi, '');
              finalContent = finalContent.trim();
            }
            
            if (finalContent) {
              markdownOutput += finalContent + '\n\n---\n\n';
            }
          }
        }
      }
      
      navigator.clipboard.writeText(markdownOutput.trim()).then(() => {
        alert(chrome.i18n.getMessage('successCopied'));
      }).catch(err => {
        console.error('Failed to copy text: ', err);
      });
    });
  }

  global.__AIStudioEnhancer__.Markdown = {
    exportToMarkdown
  };

})(window);
