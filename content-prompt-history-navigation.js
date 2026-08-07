(function (global) {
  'use strict';
  global.__AIStudioEnhancer__ = global.__AIStudioEnhancer__ || {};

  const State = global.__AIStudioEnhancer__.State;

  let historyIndex = -1;
  let currentDraft = '';

  function isPromptInput(el) {
    // Match the textarea used in AI Studio
    return el && el.tagName === 'TEXTAREA' && el.getAttribute('formcontrolname') === 'promptText';
  }

  function setInputValue(el, value) {
    el.value = value;
    // Dispatch input event to notify Angular's form control
    el.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Auto-resize the textarea by dispatching a fake keydown or input if needed, 
    // but the 'input' event should usually be enough for cdk-textarea-autosize.
    
    // Move cursor to the beginning of the text
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = 0;
    }, 0);
  }

  function handleKeyDown(event) {
    const el = event.target;
    if (!isPromptInput(el)) return;

    if (event.key === 'ArrowUp') {
      const isAtStart = el.selectionStart === 0 && el.selectionEnd === 0;

      // Trigger if at the very beginning (not holding the key), OR if we are already cycling history
      if (!event.repeat && (isAtStart || historyIndex >= 0)) {
        const catalogData = State.getCatalogData();
        if (!catalogData || catalogData.length === 0) return;
        
        event.preventDefault();

        if (historyIndex === -1) {
          currentDraft = el.value;
        }

        if (historyIndex < catalogData.length - 1) {
          historyIndex++;
        }

        const prompt = catalogData[catalogData.length - 1 - historyIndex];
        if (prompt && prompt.promptText) {
          setInputValue(el, prompt.promptText);
        }
      }
    } else if (event.key === 'ArrowDown') {
      const isAtEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
      
      // ArrowDown only navigates history if we are ALREADY in history mode.
      if (!event.repeat && historyIndex >= 0) {
        event.preventDefault();
        
        if (historyIndex > 0) {
          historyIndex--;
          const catalogData = State.getCatalogData();
          const prompt = catalogData[catalogData.length - 1 - historyIndex];
          if (prompt && prompt.promptText) {
            setInputValue(el, prompt.promptText);
          }
        } else {
          historyIndex = -1;
          setInputValue(el, currentDraft);
        }
      }
    } else if (event.key === 'Enter' && !event.shiftKey) {
      // User is submitting the prompt
      historyIndex = -1;
      currentDraft = '';
    } else if (
      event.key !== 'Shift' && event.key !== 'Control' && event.key !== 'Alt' && event.key !== 'Meta' &&
      event.key !== 'ArrowUp' && event.key !== 'ArrowDown'
    ) {
      // If user presses Left/Right, types, or deletes, exit history browsing mode
      if (historyIndex >= 0) {
        historyIndex = -1;
      }
    }
  }

  function handleMouseDown(event) {
    // If the user clicks anywhere, exit history mode
    if (historyIndex >= 0) {
      historyIndex = -1;
    }
  }

  function initialize() {
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('mousedown', handleMouseDown, true);
  }

  global.__AIStudioEnhancer__.PromptHistoryNavigation = {
    initialize
  };

})(window);
