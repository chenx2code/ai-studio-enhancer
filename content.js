(function() {
  'use strict';

  let conversationHistory = null;
  let promptTitle = "未命名对话";

  /**
   * PART 1: 脚本注射器
   */
  const s = document.createElement('script');
  s.src = chrome.runtime.getURL('interceptor.js');
  s.onload = function() { this.remove(); };
  (document.head || document.documentElement).appendChild(s);
  console.log('%c已将 interceptor.js 注入到页面。', 'color: orange;');

  /**
   * PART 2: 消息监听器
   */
  window.addEventListener('message', function(event) {
    if (event.source === window && event.data && event.data.type === 'FROM_INTERCEPTOR') {
      console.log('%c已收到来自拦截器的数据包。', 'color: purple; font-weight: bold;');
      
      const data = event.data.payload;
      const apiKeyword = event.data.apiKeyword;

      try {
        let turns = null;
        let promptData = null;

        if (apiKeyword === 'ResolveDriveResource') {
          console.log('按 ResolveDriveResource 结构解析...');
          turns = data?.[0]?.[13]?.[0];
          promptData = data?.[0]?.[4];
        } else if (apiKeyword === 'UpdatePrompt') {
          console.log('按 UpdatePrompt 结构解析...');
          turns = data?.[13]?.[0];
          promptData = data?.[4];
        }

        // 提取对话历史
        if (turns && Array.isArray(turns)) {
           conversationHistory = turns;
        }

        // 提取标题
        if (promptData && promptData[0]) {
          promptTitle = promptData[0];
        }

      } catch (e) {
        console.error('处理接收到的数据时出错:', e);
      }
    }
  });

  /**
   * PART 3: 核心导出功能 
   */
  function exportToMarkdown() {
    if (!conversationHistory) {
      alert("未能获取到对话数据源！");
      return;
    }
    let markdownOutput = `# ${promptTitle}\n\n`;
    conversationHistory.forEach(turn => {
        if (!Array.isArray(turn) || turn.length < 9) return;
        const content = turn[0] || '';
        const role = turn[8];
        const finalContent = turn[2] && typeof turn[2] === 'string' ? turn[2] : content;
        if (role === 'user' && content) markdownOutput += `## ${content}\n\n`;
        else if (role === 'model' && finalContent) markdownOutput += `${finalContent}\n\n---\n\n`;
    });
    navigator.clipboard.writeText(markdownOutput.trim());
    alert("对话已成功复制！");
  }

  /**
   * PART 4: UI注入逻辑
   */
    function checkAndInjectButton() {
      const targetUrlPattern = /^https:\/\/aistudio\.google\.com\/prompts\/.+$/;
      const currentUrl = window.location.href;
      const existingButton = document.getElementById('export-markdown-btn');

      if (!targetUrlPattern.test(currentUrl)) {
        if (existingButton) {
          existingButton.remove();
          console.log('%c当前URL不匹配，已移除复制按钮。', 'color: gray;');
        }
        return;
      }

      if (existingButton) {
        // Button already exists and URL matches, no need to re-inject
        return;
      }

      const injectionInterval = setInterval(() => {
        const toolbar = document.querySelector('ms-toolbar .toolbar-container');
        if (toolbar) {
            clearInterval(injectionInterval);
            const exportButton = document.createElement('button');
            exportButton.id = 'export-markdown-btn';
            exportButton.setAttribute('title', '复制对话为Markdown');
            const icon = document.createElement('span');
            icon.className = 'material-symbols-outlined';
            icon.innerText = 'data_object';
            exportButton.appendChild(icon);
            exportButton.addEventListener('click', exportToMarkdown);
            const moreButton = toolbar.querySelector('button[aria-label="View more actions"]');
            if (moreButton) toolbar.insertBefore(exportButton, moreButton);
            else toolbar.appendChild(exportButton);
            console.log('%c复制按钮已注入。', 'color: green;');
        }
      }, 500);
    }

    // Initial check and injection
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', checkAndInjectButton);
    } else {
      checkAndInjectButton();
    }

    // Monitor URL changes for single-page applications
    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log('%cURL已改变，重新检查按钮注入。', 'color: blue;');
        checkAndInjectButton();
      }
    });

    // Start observing the document body for changes (including URL changes)
    observer.observe(document.body, { childList: true, subtree: true });
})();