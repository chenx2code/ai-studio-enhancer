(function (global) {
  'use strict';
  global.__AIStudioEnhancer__ = global.__AIStudioEnhancer__ || {};

  /**
   * Main entry point to export conversation history to a clean Markdown file.
   */
  function exportToMarkdown() {
    const conversationHistory = global.__AIStudioEnhancer__.State.getHistory();
    const promptTitle = global.__AIStudioEnhancer__.State.getTitle();

    if (!conversationHistory || conversationHistory.length === 0) {
      alert(chrome.i18n.getMessage('errorNoDataSource'));
      return;
    }

    // Read the settings from storage before exporting (preserving existing user preferences)
    chrome.storage.local.get(['includeThoughts', 'includeLink', 'includeAccount', 'includePromptNumber'], (result) => {
      const includeThoughts = result.includeThoughts || false;
      const includeLink = result.includeLink || false;
      const includeAccount = result.includeAccount || false;
      const includePromptNumber = result.includePromptNumber !== undefined ? Boolean(result.includePromptNumber) : true;

      const markdownOutput = assembleMarkdown(conversationHistory, promptTitle, {
        includeThoughts,
        includeLink,
        includeAccount,
        includePromptNumber
      });

      const filename = sanitizeFilename(promptTitle);
      downloadMarkdownFile(markdownOutput, filename);
    });
  }

  /**
   * Group consecutive user chunks into single prompt rounds with corresponding model responses.
   * In Google AI Studio, a multi-attachment user submission is split into consecutive 'user' turns.
   */
  function groupConversationHistory(conversationHistory) {
    if (!Array.isArray(conversationHistory)) return [];

    const rounds = [];
    let currentRound = null;

    for (let i = 0; i < conversationHistory.length; i++) {
      const turn = conversationHistory[i];
      if (!Array.isArray(turn) || turn.length < 9) continue;

      const role = turn[8];
      if (role === 'user') {
        // If there's no round yet, or the current round already received model turns, start a new round
        if (!currentRound || currentRound.modelTurns.length > 0) {
          currentRound = {
            roundIndex: rounds.length,
            userChunks: [],
            modelTurns: []
          };
          rounds.push(currentRound);
        }
        currentRound.userChunks.push({ turn, index: i });
      } else if (role === 'model') {
        if (!currentRound) {
          currentRound = {
            roundIndex: rounds.length,
            userChunks: [],
            modelTurns: []
          };
          rounds.push(currentRound);
        }
        currentRound.modelTurns.push({ turn, index: i });
      }
    }

    return rounds;
  }

  /**
   * Detect whether conversation is primarily Chinese or English for labels.
   */
  function detectLanguage(title, rounds) {
    let allText = title || '';
    rounds.forEach(r => {
      r.userChunks.forEach(({ turn }) => {
        if (turn[0] && typeof turn[0] === 'string') allText += turn[0];
      });
    });

    if (typeof document !== 'undefined' && document.documentElement && document.documentElement.lang) {
      if (document.documentElement.lang.toLowerCase().startsWith('zh')) return true;
    }
    if (typeof navigator !== 'undefined' && navigator.language) {
      if (navigator.language.toLowerCase().startsWith('zh')) return true;
    }
    if (chrome.i18n && typeof chrome.i18n.getUILanguage === 'function') {
      if (chrome.i18n.getUILanguage().toLowerCase().startsWith('zh')) return true;
    }
    return /[\u4e00-\u9fa5]/.test(allText);
  }

  /**
   * Query all rendered user chat turn DOM elements.
   */
  function getUserTurnDOMElements() {
    const userTurnElements = [];
    const Utils = global.__AIStudioEnhancer__.Utils;
    if (!Utils || !Utils.SELECTORS) return userTurnElements;
    const chatTurns = document.querySelectorAll(Utils.SELECTORS.query.chatTurn);
    for (const chatTurn of chatTurns) {
      const container = chatTurn.querySelector(Utils.SELECTORS.query.chatTurnContainer);
      if (container && container.classList.contains(Utils.SELECTORS.class.userTurn)) {
        userTurnElements.push(chatTurn);
      }
    }
    return userTurnElements;
  }

  /**
   * Format user turn with H2 heading and attachments according to rules:
   * - Multiple attachments: rendered inline on a single line (> [Image 1] [Image 2] ...)
   * - Single attachment: rendered on its own line (> [Image])
   */
  function formatUserTurn(round, roundElements, isChinese, options = {}) {
    const Utils = global.__AIStudioEnhancer__.Utils;

    // 1. Combine all user text in this round
    const textParts = [];
    round.userChunks.forEach(({ turn }) => {
      const txt = (turn[0] || '').trim();
      if (txt) textParts.push(txt);
    });
    const text = textParts.join('\n\n').trim();

    // 2. Extract attachments for this round using Utils
    const rawAttachments = Utils && Utils.extractRoundAttachments
      ? Utils.extractRoundAttachments(round.userChunks, roundElements, text)
      : [];

    const totalImages = rawAttachments.filter(a => a.type === 'image').length;
    let imageCounter = 0;

    const formattedAttachments = rawAttachments.map(att => {
      if (att.type === 'image') {
        imageCounter++;
        if (!att.isDefaultName && att.fileName) {
          return `[${att.fileType || 'Image'}] ${att.fileName}`;
        }
        return totalImages > 1 ? `[Image ${imageCounter}]` : '[Image]';
      } else if (att.type === 'video') {
        return '[YouTube Video]';
      } else {
        return att.fileName ? `[${att.fileType || 'File'}] ${att.fileName}` : `[${att.fileType || 'File'}]`;
      }
    });

    const shouldIncludeNumber = options.includePromptNumber !== undefined
      ? !!options.includePromptNumber
      : true;
    const turnNumber = options.turnNumber;
    const includeNumber = shouldIncludeNumber && !!turnNumber;

    const basePromptLabel = chrome.i18n.getMessage('promptLabel') || (isChinese ? '用户提问' : 'User Prompt');
    const promptLabel = includeNumber ? `${basePromptLabel} #${turnNumber}` : basePromptLabel;
    let heading = '';
    let quoteBlock = '';
    let attachmentBlock = '';

    if (text) {
      const isMultiline = text.includes('\n');
      if (!isMultiline) {
        if (text.length <= 200) {
          heading = text;
        } else {
          heading = text.substring(0, 200) + '...';
          quoteBlock =
            `> **[${promptLabel}]**\n` +
            text.split('\n').map(l => (l.trim() ? `> ${l}` : '>')).join('\n');
        }
      } else {
        const lines = text.split('\n');
        let firstLine = lines[0].trim();
        if (firstLine.length > 200) {
          heading = firstLine.substring(0, 200) + '...';
        } else {
          heading = firstLine.replace(/[:：]$/, '...');
        }
        quoteBlock =
          `> **[${promptLabel}]**\n` +
          lines.map(l => (l.trim() ? `> ${l}` : '>')).join('\n');
      }

      // Attachments follow heading as blockquote
      if (formattedAttachments.length === 1) {
        // Single attachment occupies its own line
        attachmentBlock = `> ${formattedAttachments[0]}`;
      } else if (formattedAttachments.length > 1) {
        // Multiple attachments placed together on a single line
        attachmentBlock = `> ${formattedAttachments.join(' ')}`;
      }
    } else {
      // No text, only attachments
      if (formattedAttachments.length === 1) {
        heading = formattedAttachments[0];
      } else if (formattedAttachments.length > 1) {
        heading = chrome.i18n.getMessage('untitledPrompt') || (isChinese ? '未命名提问' : 'Untitled Prompt');
        attachmentBlock = `> ${formattedAttachments.join(' ')}`;
      } else {
        heading = chrome.i18n.getMessage('untitledPrompt') || (isChinese ? '未命名提问' : 'Untitled Prompt');
      }
    }

    const prefix = includeNumber ? `${turnNumber}. ` : '';
    const finalHeading = `## ${prefix}${heading}`;
    const parts = [finalHeading];
    if (attachmentBlock) {
      parts.push(attachmentBlock);
    }
    if (quoteBlock) {
      parts.push(quoteBlock);
    }

    return parts.join('\n\n');
  }

  /**
   * Format model response, preserving thinking process if enabled, and demoting headings to H3+.
   */
  function formatModelTurn(round, includeThoughts, isChinese) {
    if (!round.modelTurns || round.modelTurns.length === 0) {
      return isChinese ? '*(无回答内容)*' : '*(No response)*';
    }

    const parts = [];
    const thoughtLabel = chrome.i18n.getMessage('thoughtProcess') || (isChinese ? '思考过程' : 'Thought Process');

    if (round.modelTurns.length > 1) {
      // Multiple model turns: turns before the last one are thought process turns
      const thoughtTurns = round.modelTurns.slice(0, -1);
      const answerTurn = round.modelTurns[round.modelTurns.length - 1];

      if (includeThoughts) {
        const thoughtTexts = thoughtTurns
          .map(t => (t.turn[2] && typeof t.turn[2] === 'string') ? t.turn[2] : (t.turn[0] || ''))
          .filter(Boolean)
          .join('\n\n');
        if (thoughtTexts) {
          const demoted = demoteAIHeadings(thoughtTexts);
          const quoted = demoted.split('\n').map(l => (l.trim() ? `> ${l}` : '>')).join('\n');
          parts.push(`> **[${thoughtLabel}]**\n${quoted}`);
        }
      }

      let answerText = (answerTurn.turn[2] && typeof answerTurn.turn[2] === 'string') ? answerTurn.turn[2] : (answerTurn.turn[0] || '');
      if (!includeThoughts) {
        answerText = answerText.replace(/<think>[\s\S]*?<\/think>\n*/gi, '').trim();
      }
      if (answerText) {
        parts.push(demoteAIHeadings(answerText));
      }
    } else {
      // Exactly 1 model turn
      const singleTurn = round.modelTurns[0];
      let content = (singleTurn.turn[2] && typeof singleTurn.turn[2] === 'string') ? singleTurn.turn[2] : (singleTurn.turn[0] || '');

      if (!includeThoughts) {
        content = content.replace(/<think>[\s\S]*?<\/think>\n*/gi, '').trim();
      } else {
        // Format <think> tags into blockquotes
        content = content.replace(/<think>([\s\S]*?)<\/think>\n*/gi, (_, thinkContent) => {
          const quoted = thinkContent.trim().split('\n').map(l => (l.trim() ? `> ${l}` : '>')).join('\n');
          return `> **[${thoughtLabel}]**\n${quoted}\n\n`;
        });
      }

      if (content) {
        parts.push(demoteAIHeadings(content));
      } else {
        parts.push(isChinese ? '*(无回答内容)*' : '*(No response)*');
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Assemble the complete Markdown document from conversation turns and settings.
   */
  function assembleMarkdown(conversationHistory, promptTitle, settings) {
    const safeSettings = settings || {};
    const includeThoughts = 'includeThoughts' in safeSettings ? Boolean(safeSettings.includeThoughts) : false;
    const includeAccount = 'includeAccount' in safeSettings ? Boolean(safeSettings.includeAccount) : false;
    const includeLink = 'includeLink' in safeSettings ? Boolean(safeSettings.includeLink) : false;
    const includePromptNumber = 'includePromptNumber' in safeSettings ? Boolean(safeSettings.includePromptNumber) : true;

    const rounds = groupConversationHistory(conversationHistory);
    const isChinese = detectLanguage(promptTitle, rounds);

    const parts = [];

    // 1. Single Root Heading (H1)
    const title = (promptTitle || '').trim() || (chrome.i18n.getMessage('promptTitleDefault') || (isChinese ? '未命名对话' : 'Untitled Conversation'));
    parts.push(`# ${title}\n`);

    // 2. Metadata (Account and Original Conversation Link based on popup settings)
    const metaLines = [];
    if (includeAccount) {
      const Utils = global.__AIStudioEnhancer__.Utils;
      const accountEmail = Utils && Utils.extractUserAccount ? Utils.extractUserAccount() : '';
      if (accountEmail) {
        const accountText = chrome.i18n.getMessage('accountInfo') || (isChinese ? '账号' : 'Account');
        metaLines.push(`> **${accountText}:** ${accountEmail}`);
      }
    }
    if (includeLink) {
      const originalLinkText = chrome.i18n.getMessage('originalConversation') || (isChinese ? '原始对话链接' : 'Original Conversation');
      metaLines.push(`> **${originalLinkText}:** [${window.location.href}](${window.location.href})`);
    }

    if (metaLines.length > 0) {
      parts.push(metaLines.join('\n'));
      parts.push('\n---\n');
    }

    // 3. Conversation Rounds
    const userTurnElements = getUserTurnDOMElements();
    let userChunkCounter = 0;

    rounds.forEach((round, roundIndex) => {
      const startDomIndex = userChunkCounter;
      const endDomIndex = userChunkCounter + round.userChunks.length - 1;
      userChunkCounter += round.userChunks.length;

      const roundElements = [];
      for (let d = startDomIndex; d <= endDomIndex; d++) {
        if (userTurnElements[d]) {
          roundElements.push({ element: userTurnElements[d], domIndex: d });
        }
      }

      const turnNumber = roundIndex + 1;
      const userMarkdown = formatUserTurn(round, roundElements, isChinese, {
        includePromptNumber,
        turnNumber
      });
      if (userMarkdown) {
        parts.push(userMarkdown);
      }

      const modelMarkdown = formatModelTurn(round, includeThoughts, isChinese);
      if (modelMarkdown) {
        parts.push(modelMarkdown);
      }

      parts.push('\n---\n');
    });

    return parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  /**
   * Cross-platform safe filename generation.
   */
  function sanitizeFilename(name) {
    let filename = (name || '').trim();
    if (!filename) {
      filename = chrome.i18n.getMessage('promptTitleDefault') || 'conversation';
    }
    // Remove invalid filename characters \ / : * ? " < > | and control characters
    filename = filename.replace(/[\\/:*?"<>|\x00-\x1F\x7F]/g, '_').trim();
    // Collapse consecutive underscores
    filename = filename.replace(/_+/g, '_');
    // Remove leading and trailing dots and spaces
    filename = filename.replace(/^[. ]+|[. ]+$/g, '');
    // Limit filename length to 100 characters to prevent filesystem issues
    if (filename.length > 100) {
      filename = filename.substring(0, 100).trim();
      filename = filename.replace(/^[. ]+|[. ]+$/g, '');
    }
    return (filename || 'conversation') + '.md';
  }

  /**
   * Trigger client-side file download via Blob URL.
   */
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

  /**
   * Dynamically shifts AI headings so that the highest heading starts at H3 (###) or deeper,
   * preserving relative hierarchy between subheadings.
   * Headings exceeding level 6 are converted to bold paragraphs to prevent flattening.
   * Fenced code blocks (``` and ~~~) are strictly protected to keep comments intact.
   *
   * @param {string} markdownText - Raw markdown text
   * @returns {string} - Markdown text with adjusted heading levels
   */
  function demoteAIHeadings(markdownText) {
    if (!markdownText) return '';

    const lines = markdownText.split('\n');
    let inCodeBlock = false;
    let codeFenceChar = '';
    let codeFenceLen = 0;

    // Pass 1: Find minimum heading level (L_min) outside code blocks
    let minLevel = 7;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (fenceMatch) {
        const matchFence = fenceMatch[1];
        const matchChar = matchFence[0];
        const matchLen = matchFence.length;

        if (!inCodeBlock) {
          inCodeBlock = true;
          codeFenceChar = matchChar;
          codeFenceLen = matchLen;
          continue;
        } else if (matchChar === codeFenceChar && matchLen >= codeFenceLen) {
          inCodeBlock = false;
          codeFenceChar = '';
          codeFenceLen = 0;
          continue;
        }
      }

      if (inCodeBlock) continue;

      const headingMatch = line.match(/^((?: {0,3}>[ \t]*)*)(#{1,6})[ \t]+(.*)$/);
      if (headingMatch) {
        const level = headingMatch[2].length;
        if (level < minLevel) {
          minLevel = level;
        }
      }
    }

    // Determine shift amount:
    // If L_min = 1 (used #), shift +2 (# -> ###, ## -> ####, etc.)
    // If L_min = 2 (used ##), shift +1 (## -> ###, ### -> ####, etc.)
    // If L_min >= 3 (used ### or lower, or no headings), shift +0 (keep as-is)
    let shift = 0;
    if (minLevel === 1) {
      shift = 2;
    } else if (minLevel === 2) {
      shift = 1;
    }

    if (shift === 0) {
      return markdownText;
    }

    // Pass 2: Apply shift and bold fallback (> 6) outside code blocks
    inCodeBlock = false;
    codeFenceChar = '';
    codeFenceLen = 0;
    const resultLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (fenceMatch) {
        const matchFence = fenceMatch[1];
        const matchChar = matchFence[0];
        const matchLen = matchFence.length;

        if (!inCodeBlock) {
          inCodeBlock = true;
          codeFenceChar = matchChar;
          codeFenceLen = matchLen;
          resultLines.push(line);
          continue;
        } else if (matchChar === codeFenceChar && matchLen >= codeFenceLen) {
          inCodeBlock = false;
          codeFenceChar = '';
          codeFenceLen = 0;
          resultLines.push(line);
          continue;
        }
      }

      if (inCodeBlock) {
        resultLines.push(line);
        continue;
      }

      const headingMatch = line.match(/^((?: {0,3}>[ \t]*)*)(#{1,6})[ \t]+(.*)$/);
      if (headingMatch) {
        const quotePrefix = headingMatch[1];
        const originalLevel = headingMatch[2].length;
        const headingContent = headingMatch[3];
        const newLevel = originalLevel + shift;

        if (newLevel <= 6) {
          resultLines.push(`${quotePrefix}${'#'.repeat(newLevel)} ${headingContent}`);
        } else {
          resultLines.push(`${quotePrefix}**${headingContent}**`);
        }
      } else {
        resultLines.push(line);
      }
    }

    return resultLines.join('\n');
  }

  global.__AIStudioEnhancer__.Markdown = {
    exportToMarkdown,
    downloadMarkdown: exportToMarkdown,
    groupConversationHistory,
    assembleMarkdown,
    formatUserTurn,
    formatModelTurn,
    demoteAIHeadings,
    sanitizeFilename
  };

})(window);
