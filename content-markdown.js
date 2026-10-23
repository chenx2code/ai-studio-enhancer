(function (global) {
  'use strict';
  global.__AIStudioEnhancer__ = global.__AIStudioEnhancer__ || {};

  function exportToMarkdown() {
    const conversationHistory = global.__AIStudioEnhancer__.State.getHistory();
    const promptTitle = global.__AIStudioEnhancer__.State.getTitle();
    const getFriendlyFileType = global.__AIStudioEnhancer__.Utils.getFriendlyFileType;
    const getAttachmentPlaceholder = global.__AIStudioEnhancer__.Utils.getAttachmentPlaceholder;

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
          let placeholder = '';
          
          const attachment = getAttachmentPlaceholder(turn);
          if (attachment) {
            placeholder = `> ${attachment.text}\n\n`;
          } else if (!textContent) {
            placeholder = '> [File]\n\n';
          }

          if (textContent) {
            const trimmedText = textContent.trim();
            const MAX_HEADING_LENGTH = 200;
            const lines = trimmedText.split('\n');
            const firstLine = lines[0].trim();
            const isMultiLine = lines.length > 1;
            const promptLabel = chrome.i18n.getMessage('promptLabel') || 'User Prompt';

            if (trimmedText.length > MAX_HEADING_LENGTH && !isMultiLine) {
              // Single-line prompt exceeding 200 characters:
              // Truncate the heading at 200 characters and format the full prompt in a blockquote
              const headingText = trimmedText.substring(0, MAX_HEADING_LENGTH).trim() + '...';
              markdownOutput += placeholder + '## ' + headingText + '\n\n' + formatBlockquote(promptLabel, trimmedText);
            } else if (isMultiLine) {
              // Multiline prompt:
              // Use first line as heading (truncated if > 200 chars), and full prompt in a blockquote
              const headingText = firstLine.length > MAX_HEADING_LENGTH
                ? firstLine.substring(0, MAX_HEADING_LENGTH).trim() + '...'
                : firstLine;
              markdownOutput += placeholder + '## ' + headingText + '\n\n' + formatBlockquote(promptLabel, trimmedText);
            } else {
              // Standard short single-line prompt (<= 200 characters)
              markdownOutput += placeholder + '## ' + trimmedText + '\n\n';
            }
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
              const adjustedThoughts = demoteAIHeadings(finalContent);
              markdownOutput += formatBlockquote('Thought Process', adjustedThoughts);
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
              const adjustedContent = demoteAIHeadings(finalContent);
              markdownOutput += adjustedContent + '\n\n---\n\n';
            }
          }
        }
      }
      
      // Sanitize the filename and trigger direct download
      const filename = sanitizeFilename(promptTitle);
      downloadMarkdownFile(markdownOutput.trim(), filename);
    });
  }

  function sanitizeFilename(name) {
    let filename = (name || '').trim();
    if (!filename) {
      filename = chrome.i18n.getMessage('promptTitleDefault') || 'conversation';
    }
    // Remove invalid filename characters \ / : * ? " < > | and control characters
    filename = filename.replace(/[\\/:*?"<>|\x00-\x1F\x7F]/g, '_').trim();
    // Remove leading and trailing dots and spaces
    filename = filename.replace(/^[. ]+|[. ]+$/g, '');
    // Limit filename length to 100 characters to prevent filesystem issues
    if (filename.length > 100) {
      filename = filename.substring(0, 100).trim();
    }
    return (filename || 'conversation') + '.md';
  }

  function downloadMarkdownFile(content, filename) {
    try {
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
      const blobUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = filename;
      downloadLink.style.display = 'none';

      document.body.appendChild(downloadLink);
      downloadLink.click();

      setTimeout(() => {
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(blobUrl);
      }, 1000);
    } catch (err) {
      console.error('Failed to trigger download: ', err);
    }
  }

  function formatBlockquote(label, text) {
    if (!text || typeof text !== 'string') return '';
    const prefix = label ? `> **[${label}]**\n>\n` : '';
    const body = text.split('\n').map(line => '> ' + line).join('\n');
    return `${prefix}${body}\n\n`;
  }

  /**
   * Dynamically shifts AI headings so that the highest heading starts at H3 (###) or deeper,
   * preserving relative hierarchy between subheadings.
   * Headings exceeding level 6 are converted to bold paragraphs to prevent flattening.
   * Fenced code blocks (``` and ~~~) are strictly protected to keep comments intact.
   *
   * @param {string} text - Raw markdown text
   * @returns {string} - Markdown text with adjusted heading levels
   */
  function demoteAIHeadings(text) {
    if (!text || typeof text !== 'string') return '';

    const lines = text.split('\n');
    let inCodeBlock = false;
    let minHeadingLevel = 7;

    // First pass: identify the minimum heading level (highest hierarchy) outside code blocks
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*(```|~~~)/.test(line)) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (!inCodeBlock) {
        const match = line.match(/^(\s*)(#{1,6})\s+/);
        if (match) {
          const level = match[2].length;
          if (level < minHeadingLevel) {
            minHeadingLevel = level;
          }
        }
      }
    }

    // Target minimum level for AI responses is 3 (###)
    // If AI highest is # (1), shiftBy = 2
    // If AI highest is ## (2), shiftBy = 1
    // If AI highest is ### or deeper (>= 3), shiftBy = 0
    // If no headings found (7), shiftBy = 0
    const shiftBy = minHeadingLevel < 3 ? (3 - minHeadingLevel) : 0;
    if (shiftBy === 0) {
      return text;
    }

    // Second pass: apply the uniform shift to all headings outside code blocks
    inCodeBlock = false;
    const adjustedLines = lines.map(line => {
      if (/^\s*(```|~~~)/.test(line)) {
        inCodeBlock = !inCodeBlock;
        return line;
      }
      if (inCodeBlock) {
        return line;
      }

      const match = line.match(/^(\s*)(#{1,6})\s+(.*)$/);
      if (match) {
        const indent = match[1];
        const originalLevel = match[2].length;
        const headingText = match[3];
        const newLevel = originalLevel + shiftBy;

        if (newLevel <= 6) {
          return `${indent}${'#'.repeat(newLevel)} ${headingText}`;
        } else {
          // When level exceeds 6, fallback to bold to preserve distinction without breaking markdown
          return `${indent}**${headingText}**`;
        }
      }

      return line;
    });

    return adjustedLines.join('\n');
  }

  global.__AIStudioEnhancer__.Markdown = {
    exportToMarkdown,
    downloadMarkdown: exportToMarkdown,
    demoteAIHeadings
  };

})(window);
