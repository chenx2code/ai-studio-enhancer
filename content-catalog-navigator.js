// content-catalog-navigator.js
// Handles chat scroll container discovery, two-stage catalog navigation across virtualized turns,
// scroll-to-bottom control, and viewport scroll-spy highlight synchronization.

(function (global) {
  'use strict';
  global.__AIStudioEnhancer__ = global.__AIStudioEnhancer__ || {};

  const State = global.__AIStudioEnhancer__.State;
  const Utils = global.__AIStudioEnhancer__.Utils;
  const Locator = global.__AIStudioEnhancer__.CatalogLocator;

  let scrollStopTimer = null;
  let isHoveringScrollButton = false;
  const boundScrollers = new WeakSet();

  let activeNavigationCancel = null;
  let activeNavigationAbort = null;
  let navigationClearTimer = null;
  let navigationSafetyTimer = null;
  let searchSettleTimer = null;
  let isNavigating = false;
  let navigationToken = 0;
  let lastNavigationEndAt = 0;
  let activeNavState = null; // Preserves the clicked catalog item across post-landing render updates
  let userScrollKeyListenerBound = false;

  // Retrieve the primary scrollable container for AI Studio chat history
  function getChatScrollContainer() {
    const isScrollableY = (el) => {
      if (!el) return false;
      const s = window.getComputedStyle(el);
      const oy = s.overflowY;
      return (oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollHeight > el.clientHeight + 1;
    };

    const turn = document.querySelector(Utils.SELECTORS.query.chatTurn) || document.querySelector(Utils.SELECTORS.query.chunkEditor);
    if (turn) {
      let p = turn.parentElement;
      while (p && p !== document.body) {
        if (isScrollableY(p)) {
          return p;
        }
        p = p.parentElement;
      }
    }

    const chunkEditor = document.querySelector(Utils.SELECTORS.query.chunkEditor);
    if (chunkEditor) {
      if (isScrollableY(chunkEditor)) {
        return chunkEditor;
      }
      for (const child of chunkEditor.children) {
        if (child.id === Utils.SELECTORS.id.catalogPanel) continue;
        if (isScrollableY(child)) {
          return child;
        }
      }
      const mainContent = Array.from(chunkEditor.children).find(
        child => child.id !== Utils.SELECTORS.id.catalogPanel && child.tagName !== 'STYLE' && !child.classList.contains('custom-tooltip-text')
      );
      if (mainContent) return mainContent;
      return chunkEditor;
    }

    if (document.documentElement.scrollHeight > document.documentElement.clientHeight + 1) {
      return document.documentElement;
    }
    return document.body;
  }

  function getChatMainContainer() {
    return getChatScrollContainer();
  }

  function getScrollerViewportMetrics(scroller) {
    if (!scroller || scroller === document.documentElement || scroller === document.body) {
      return {
        top: 0,
        height: window.innerHeight || document.documentElement.clientHeight || 800
      };
    }
    const rect = scroller.getBoundingClientRect();
    const clientTop = scroller.clientTop || 0;
    const visibleHeight = scroller.clientHeight > 0
      ? Math.min(rect.height || scroller.clientHeight, scroller.clientHeight)
      : rect.height;
    return { top: rect.top + clientTop, height: visibleHeight };
  }

  function computeDesiredTop(targetRect, scrollerMetrics, catalogItem) {
    const isAttachment = Boolean(catalogItem && catalogItem.type !== 'text');
    if (!isAttachment) return 80;
    const targetH = targetRect ? targetRect.height : 0;
    if (!targetH || targetH <= 0) return 80;
    return Math.max(80, Math.round((scrollerMetrics.height - targetH) / 2));
  }

  function applyNavSelectionHighlight(list, catalogItem, includeFlightClass) {
    if (!list || !catalogItem) return;
    const targetSub = catalogItem.subIndex !== undefined && catalogItem.subIndex !== null
      ? String(catalogItem.subIndex)
      : '';
    const targetType = catalogItem.type || 'text';
    const allItems = list.querySelectorAll('.catalog-list-item');
    allItems.forEach((el) => {
      const idx = el.getAttribute('data-turn-index');
      const counter = el.getAttribute('data-turn-counter');
      const elSub = el.getAttribute('data-sub-index') || '';
      const elType = el.getAttribute('data-item-type') || '';

      const matchesCounter = (catalogItem.turnCounter !== undefined && counter === String(catalogItem.turnCounter));
      const matchesIdx = (idx !== null && parseInt(idx, 10) === catalogItem.turnIndex);
      const matchesTurn = matchesCounter || matchesIdx;

      const matchesType = !elType || elType === targetType;
      const isExactTarget = matchesTurn && matchesType && elSub === targetSub;
      const isTurnRoot = matchesTurn && (el.getAttribute('data-is-turn-root') === 'true' || elSub === '');

      if (isExactTarget || isTurnRoot) {
        el.classList.add('catalog-item-selected');
      } else {
        el.classList.remove('catalog-item-selected');
      }

      if (includeFlightClass && isExactTarget) {
        el.classList.add('catalog-item-navigating');
      } else {
        el.classList.remove('catalog-item-navigating');
      }
    });
  }

  // Hardware-synchronized 60fps/120fps ease-out cubic scroll animation with live target support
  function animateScrollTo(scroller, targetTopOrGetter, duration, onComplete) {
    if (!scroller) return () => {};

    const resolveTarget = () => {
      const raw = typeof targetTopOrGetter === 'function' ? targetTopOrGetter() : targetTopOrGetter;
      const liveMaxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      return Math.max(0, Math.min(liveMaxScroll, raw));
    };

    const prevScrollBehavior = scroller.style.scrollBehavior;
    const computedBehavior = window.getComputedStyle ? window.getComputedStyle(scroller).scrollBehavior : '';
    const shouldOverrideBehavior = computedBehavior === 'smooth' || prevScrollBehavior === 'smooth';
    if (shouldOverrideBehavior) {
      scroller.style.scrollBehavior = 'auto';
    }
    const restoreScrollBehavior = () => {
      if (shouldOverrideBehavior) {
        scroller.style.scrollBehavior = prevScrollBehavior;
      }
    };

    const initialTarget = resolveTarget();
    if (Math.abs(initialTarget - scroller.scrollTop) < 2) {
      scroller.scrollTop = initialTarget;
      restoreScrollBehavior();
      if (onComplete) onComplete();
      return () => {};
    }

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    let prevEased = 0;
    const startTime = performance.now();
    let rafId = null;
    let isCanceled = false;

    const cancel = () => {
      isCanceled = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      restoreScrollBehavior();
    };

    const tick = (currentTime) => {
      if (isCanceled) return;

      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(progress);
      const stepFraction = prevEased >= 1 ? 1 : Math.min(1, (eased - prevEased) / Math.max(1e-6, 1 - prevEased));
      prevEased = eased;

      const liveTarget = resolveTarget();
      const curTop = scroller.scrollTop;
      const remaining = liveTarget - curTop;

      if (progress < 1) {
        scroller.scrollTop = curTop + remaining * stepFraction;
        rafId = requestAnimationFrame(tick);
      } else {
        scroller.scrollTop = liveTarget;
        rafId = null;
        restoreScrollBehavior();
        if (onComplete) onComplete();
      }
    };

    rafId = requestAnimationFrame(tick);
    return cancel;
  }

  function clearActiveNavState() {
    activeNavState = null;
    lastNavigationEndAt = 0;
  }

  function reconcileActiveNavState(newData) {
    if (!Array.isArray(newData) || newData.length === 0) {
      activeNavState = null;
      lastNavigationEndAt = 0;
      return;
    }
    if (activeNavState && activeNavState.catalogItem) {
      const navItem = activeNavState.catalogItem;
      const stillExists = newData.some(item =>
        item.roundIndex === navItem.roundIndex &&
        item.type === navItem.type &&
        (!navItem.pureText || !item.pureText || Locator.textsLooselyMatch(item.pureText, navItem.pureText))
      );
      if (!stillExists) {
        activeNavState = null;
        lastNavigationEndAt = 0;
      }
    }
  }

  function syncHighlightAfterRender(listContainer) {
    if (!listContainer) return;
    const scroller = getChatScrollContainer();
    const withinNavGrace = lastNavigationEndAt > 0 && (performance.now() - lastNavigationEndAt) < 400;
    const stillAtLandedSpot = Boolean(
      activeNavState &&
      activeNavState.catalogItem && (
        isNavigating ||
        withinNavGrace ||
        !scroller ||
        activeNavState.landedScrollTop === undefined ||
        Math.abs(scroller.scrollTop - activeNavState.landedScrollTop) <= 24
      )
    );

    if (stillAtLandedSpot) {
      applyNavSelectionHighlight(listContainer, activeNavState.catalogItem, isNavigating);
    } else {
      if (activeNavState) {
        activeNavState = null;
        lastNavigationEndAt = 0;
      }
      updateActiveTurnByViewport();
    }
  }

  function navigateToPrompt(target) {
    let cleanup = null;
    try {
      const catalogData = State.getCatalogData();
      if (!catalogData || catalogData.length === 0) return;

      let catalogItem = null;
      if (target && typeof target === 'object') {
        catalogItem = target;
      } else {
        catalogItem = catalogData.find(item =>
          item.turnIndex === target ||
          item.roundIndex === target ||
          item.turnCounter === target
        );
      }
      if (!catalogItem) return;

      const scroller = getChatScrollContainer();
      if (!scroller) return;

      // 1. Cancel active navigation, animation, and previous timers
      if (activeNavigationAbort) {
        activeNavigationAbort(true);
        activeNavigationAbort = null;
      }
      if (activeNavigationCancel) {
        activeNavigationCancel();
        activeNavigationCancel = null;
      }
      if (navigationClearTimer) {
        clearTimeout(navigationClearTimer);
        navigationClearTimer = null;
      }
      if (navigationSafetyTimer) {
        clearTimeout(navigationSafetyTimer);
        navigationSafetyTimer = null;
      }
      if (searchSettleTimer) {
        clearTimeout(searchSettleTimer);
        searchSettleTimer = null;
      }

      const myToken = ++navigationToken;
      isNavigating = true;
      activeNavState = { catalogItem };
      const clickTime = performance.now();
      const minFeedbackDurationMs = 380; // Ensure visible feedback even for short distances

      // Temporarily override CSS smooth scrolling so rAF closed-loop steps apply immediately
      const prevScrollBehavior = scroller.style.scrollBehavior;
      const computedScrollBehavior = window.getComputedStyle ? window.getComputedStyle(scroller).scrollBehavior : '';
      const didOverrideScrollBehavior = computedScrollBehavior === 'smooth' || prevScrollBehavior === 'smooth';
      if (didOverrideScrollBehavior) {
        scroller.style.scrollBehavior = 'auto';
      }

      // 2. Update active highlight in the sidebar list immediately
      const list = document.getElementById(Utils.SELECTORS.id.catalogListContainer);
      if (list) {
        applyNavSelectionHighlight(list, catalogItem, true);
      }

      // Helper to fade away temporary navigation row background after minimum feedback time
      const clearNavigatingState = (immediate = false) => {
        const doClear = () => {
          const curList = document.getElementById(Utils.SELECTORS.id.catalogListContainer);
          if (curList) {
            const navItems = curList.querySelectorAll('.catalog-list-item.catalog-item-navigating');
            navItems.forEach((el) => el.classList.remove('catalog-item-navigating'));
          }
          navigationClearTimer = null;
        };

        if (navigationClearTimer) {
          clearTimeout(navigationClearTimer);
          navigationClearTimer = null;
        }

        if (immediate) {
          doClear();
        } else {
          const elapsed = performance.now() - clickTime;
          const remaining = Math.max(0, minFeedbackDurationMs - elapsed);
          if (remaining > 0) {
            navigationClearTimer = setTimeout(() => {
              if (myToken === navigationToken) {
                doClear();
              } else {
                navigationClearTimer = null;
              }
            }, remaining);
          } else {
            doClear();
          }
        }
      };

      // 3. User interrupt handler: abort auto-navigation on manual scroll interaction
      const scrollInterruptKeys = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Escape']);
      const onUserInterrupt = (e) => {
        if (myToken !== navigationToken || !isNavigating) return;
        if (e.target && e.target.closest && e.target.closest('#' + Utils.SELECTORS.id.catalogPanel)) {
          return;
        }
        if (e.type === 'pointerdown' && !(e.target === scroller && e.offsetX >= scroller.clientWidth)) {
          return;
        }
        if (e.type === 'keydown') {
          const active = document.activeElement;
          if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || active.isContentEditable)) {
            if (e.key !== 'Escape') return;
          }
          if (!scrollInterruptKeys.has(e.key)) {
            return;
          }
        }
        cleanup(true);
      };

      const scheduleSafetyTimeout = (delayMs) => {
        if (navigationSafetyTimer) {
          clearTimeout(navigationSafetyTimer);
        }
        navigationSafetyTimer = setTimeout(() => {
          if (myToken === navigationToken && isNavigating) {
            cleanup(false);
          }
        }, delayMs);
      };

      cleanup = (immediate = false) => {
        if (myToken !== navigationToken) return;
        if (navigationSafetyTimer) {
          clearTimeout(navigationSafetyTimer);
          navigationSafetyTimer = null;
        }
        if (searchSettleTimer) {
          clearTimeout(searchSettleTimer);
          searchSettleTimer = null;
        }
        clearNavigatingState(immediate);
        if (activeNavigationCancel) {
          activeNavigationCancel();
          activeNavigationCancel = null;
        }
        if (didOverrideScrollBehavior) {
          scroller.style.scrollBehavior = prevScrollBehavior;
        }
        activeNavigationAbort = null;
        isNavigating = false;
        if (immediate) {
          activeNavState = null;
          lastNavigationEndAt = 0;
        } else {
          activeNavState = {
            catalogItem,
            landedScrollTop: scroller.scrollTop
          };
          lastNavigationEndAt = performance.now();
        }
        window.removeEventListener('wheel', onUserInterrupt, { capture: true });
        window.removeEventListener('touchstart', onUserInterrupt, { capture: true });
        window.removeEventListener('pointerdown', onUserInterrupt, { capture: true });
        window.removeEventListener('keydown', onUserInterrupt, { capture: true });
      };
      activeNavigationAbort = cleanup;

      // Global safety timer: covers multi-hop virtual/lazy search; extended upon entering landOnTarget
      scheduleSafetyTimeout(8000);

      window.addEventListener('wheel', onUserInterrupt, { capture: true, passive: true });
      window.addEventListener('touchstart', onUserInterrupt, { capture: true, passive: true });
      window.addEventListener('pointerdown', onUserInterrupt, { capture: true, passive: true });
      window.addEventListener('keydown', onUserInterrupt, { capture: true, passive: true });

      const isElementVisibleInLayout = (el) => {
        if (!el || typeof window.getComputedStyle !== 'function') return true;
        const st = window.getComputedStyle(el);
        return st.display !== 'none' && st.visibility !== 'hidden';
      };

      const determineLayoutMode = (cardEl) => {
        const stamped = cardEl && cardEl.getAttribute ? cardEl.getAttribute('data-enhancer-dom-mode') : '';
        if (stamped === 'round' || stamped === 'chunk') {
          return { mode: stamped, certain: true };
        }
        const liveCatalog = State.getCatalogData() || catalogData;
        const ctx = Locator.buildDomLookupContext(liveCatalog);
        return { mode: ctx.effectiveMode, certain: Boolean(ctx.detectedMode) };
      };

      const resolveLocalChunkOrRoundIndex = (els, item, cardEl) => {
        const liveCatalog = State.getCatalogData() || catalogData;
        const sameRoundItems = liveCatalog.filter(x => x.roundIndex === item.roundIndex && x.type === item.type);
        const sameChunkItems = item.chunkTargetDomIndex !== undefined
          ? sameRoundItems.filter(x => x.chunkTargetDomIndex === item.chunkTargetDomIndex)
          : sameRoundItems;

        const matchItem = (x) => (
          x === item ||
          (x.turnIndex === item.turnIndex &&
           x.subIndex === item.subIndex &&
           (!item.fileName || x.fileName === item.fileName))
        );

        const roundPos = Math.max(0, sameRoundItems.findIndex(matchItem));
        const chunkPos = Math.max(0, sameChunkItems.findIndex(matchItem));
        const fallbackRoundIdx = item.type === 'video'
          ? roundPos
          : (item.subIndex !== undefined ? item.subIndex : roundPos);

        const modeInfo = determineLayoutMode(cardEl);
        if (modeInfo.mode === 'round') {
          return fallbackRoundIdx;
        }
        // If mode fell back without full certainty, detect full-round card by element count
        if (!modeInfo.certain && sameRoundItems.length > sameChunkItems.length && els.length >= sameRoundItems.length) {
          return fallbackRoundIdx;
        }
        return chunkPos;
      };

      // Resolve sub-element within card for image, file, or video attachments
      const resolveSubTarget = (cardEl, item) => {
        if (!cardEl || !item) return cardEl;
        if (item.type === 'image') {
          const contentImgs = Locator.getTurnContentImages(cardEl);
          const layoutImgs = contentImgs.filter(isElementVisibleInLayout);
          const imgs = layoutImgs.length > 0 ? layoutImgs : contentImgs;
          if (imgs.length > 0) {
            if (item.fileName && !item.isDefaultName) {
              const targetLower = item.fileName.trim().toLowerCase();
              const exactMatch = imgs.find((img) => {
                const alt = (img.alt || '').trim().toLowerCase();
                const title = (img.title || '').trim().toLowerCase();
                return alt === targetLower || title === targetLower;
              });
              if (exactMatch) return exactMatch;

              const looseMatch = imgs.find((img) => {
                const alt = (img.alt || '').trim().toLowerCase();
                const title = (img.title || '').trim().toLowerCase();
                return (alt && (alt.includes(targetLower) || (alt.length >= 4 && targetLower.includes(alt)))) ||
                       (title && (title.includes(targetLower) || (title.length >= 4 && targetLower.includes(title)))) ||
                       (img.src && !img.src.startsWith('data:') && targetLower.length >= 4 && img.src.toLowerCase().includes(targetLower));
              });
              if (looseMatch) return looseMatch;
            }
            const idx = resolveLocalChunkOrRoundIndex(imgs, item, cardEl);
            return imgs[idx] || imgs[imgs.length - 1] || cardEl;
          }
        } else if (item.type === 'file') {
          const allFileEls = Locator.getTurnContentFiles(cardEl);
          const layoutFiles = allFileEls.filter(isElementVisibleInLayout);
          const fileEls = layoutFiles.length > 0 ? layoutFiles : allFileEls;
          if (fileEls.length > 0) {
            if (item.fileName && !item.isDefaultName) {
              const matchedChip = fileEls.find((el) => Locator.doesFileElementMatchName(el, item.fileName));
              if (matchedChip) return matchedChip;
            }
            const idx = resolveLocalChunkOrRoundIndex(fileEls, item, cardEl);
            return fileEls[idx] || fileEls[fileEls.length - 1] || cardEl;
          }
        } else if (item.type === 'video') {
          const allVideoEls = Locator.getTurnContentVideos(cardEl);
          const layoutVideos = allVideoEls.filter(isElementVisibleInLayout);
          const videoEls = layoutVideos.length > 0 ? layoutVideos : allVideoEls;
          if (videoEls.length > 0) {
            const idx = resolveLocalChunkOrRoundIndex(videoEls, item, cardEl);
            return videoEls[idx] || videoEls[videoEls.length - 1] || cardEl;
          }
        }
        return cardEl;
      };

      const isTrackedCardValid = (card) => {
        if (!card || !card.isConnected) return false;
        const pure = (catalogItem.pureText || '').trim();
        const normA = Locator.compactTextForMatch(Locator.normalizeTextForMatch(pure));
        if (normA.length >= 6) {
          const stampedMode = card.getAttribute ? card.getAttribute('data-enhancer-dom-mode') : '';
          const canCheckText =
            catalogItem.type === 'text' ||
            stampedMode === 'round' ||
            catalogItem.chunkTargetDomIndex === undefined ||
            catalogItem.chunkTextDomIndex === undefined ||
            catalogItem.chunkTargetDomIndex === catalogItem.chunkTextDomIndex;
          if (canCheckText) {
            const curText = Locator.getCleanPromptText(card);
            const curComp = Locator.compactTextForMatch(Locator.normalizeTextForMatch(curText));
            if (curComp.length >= 6 && !Locator.doesElementMatchText(curText, pure)) {
              return false;
            }
          }
        }
        return true;
      };

      // Two-stage Plan A motion constants: instant approach teleport + short crisp deceleration glide
      // Avoids slow visible dragging across lazy-rendered blank placeholder turns even for short hops.
      const TELEPORT_DISTANCE_THRESHOLD = 520;
      const getApproachDistance = (viewportHeight) => {
        return Math.min(340, Math.max(180, Math.round((viewportHeight || 800) * 0.42)));
      };
      const computeCrispGlideDuration = (dist) => {
        return Math.min(210, Math.max(95, Math.round(80 + Math.sqrt(Math.max(0, dist)) * 4.5)));
      };

      // Shared search budget across initial hydration search and any mid-flight virtual-scroll re-acquisition
      const maxSearchHops = 22;
      let searchHopsUsed = 0;
      const targetRound = catalogItem.roundIndex !== undefined ? catalogItem.roundIndex : 0;
      const totalRounds = catalogItem.totalRounds || new Set(catalogData.map(i => i.roundIndex)).size || 1;
      let lowBound = { round: 0, scrollTop: 0 };
      let highBound = {
        round: Math.max(0, totalRounds - 1),
        scrollTop: Math.max(0, scroller.scrollHeight - scroller.clientHeight)
      };
      let lastSearchDir = 1;
      let lastHopScrollHeight = scroller.scrollHeight;
      let sawBottomMiss = false;
      let sawTopMiss = false;
      let emptyGapConsecutive = 0;

      let runSearchHop = null;

      // Landing Stabilization Anchor: dynamically pins the target to live desiredTop
      // for at least 380ms (longer for lazy expansions / pending images), ensuring pixel-exact stop.
      const anchorLand = (anchorCard) => {
        if (!isNavigating || myToken !== navigationToken) return;
        let cardEl = anchorCard;
        const anchorStartTime = performance.now();
        const anchorMinMs = 380;
        const baseAnchorMaxMs = 1350;
        const requiredStableFrames = 5;
        let stableFrames = 0;
        let lastAbsDelta = Infinity;
        let prevDeltaSign = 0;
        let anchorApproachTeleports = 0;
        const maxAnchorTeleports = 8;
        let anchorRafId = null;
        let anchorCanceled = false;

        activeNavigationCancel = () => {
          anchorCanceled = true;
          if (anchorRafId !== null) {
            cancelAnimationFrame(anchorRafId);
            anchorRafId = null;
          }
        };

        const anchorTick = () => {
          if (anchorCanceled || !isNavigating || myToken !== navigationToken) return;

          if (!isTrackedCardValid(cardEl)) {
            cardEl = Locator.findTargetElement(catalogItem);
            if (!cardEl || !cardEl.isConnected) {
              if (searchHopsUsed < maxSearchHops && runSearchHop) {
                runSearchHop(searchHopsUsed + 1);
              } else {
                cleanup(false);
              }
              return;
            }
            stableFrames = 0;
          }

          const freshTarget = resolveSubTarget(cardEl, catalogItem);
          const freshRect = freshTarget.getBoundingClientRect();
          const currentScrollerRect = getScrollerViewportMetrics(scroller);
          const liveDesiredTop = computeDesiredTop(freshRect, currentScrollerRect, catalogItem);

          const curTop = scroller.scrollTop;
          const liveMaxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
          const rawTargetTop = curTop + ((freshRect.top - currentScrollerRect.top) - liveDesiredTop);
          const clampedTargetTop = Math.max(0, Math.min(liveMaxScroll, rawTargetTop));
          const boundedDelta = clampedTargetTop - curTop;
          const absDelta = Math.abs(boundedDelta);
          const curSign = boundedDelta > 0 ? 1 : (boundedDelta < 0 ? -1 : 0);

          const isPendingImage = Boolean(freshTarget && freshTarget.tagName === 'IMG' && !freshTarget.complete);

          if (absDelta > TELEPORT_DISTANCE_THRESHOLD && anchorApproachTeleports < maxAnchorTeleports) {
            // Large lazy turn expansion pushed the target offscreen again: re-teleport to doorstep cleanly
            const approachDist = Math.min(280, Math.max(150, Math.round(currentScrollerRect.height * 0.35)));
            const jumpTop = Math.max(0, Math.min(liveMaxScroll, clampedTargetTop - curSign * approachDist));
            if (Math.abs(jumpTop - curTop) > 40) {
              scroller.scrollTop = jumpTop;
              anchorApproachTeleports++;
              stableFrames = 0;
              scheduleSafetyTimeout(2400);
              lastAbsDelta = absDelta;
              prevDeltaSign = curSign;
              anchorRafId = requestAnimationFrame(anchorTick);
              return;
            }
          }

          if (absDelta > 1.0) {
            // Guard against sub-pixel DPR/zoom quantization oscillation near 1-2px
            const isSmallOscillation = absDelta <= 2.5 && prevDeltaSign !== 0 && curSign !== prevDeltaSign && absDelta >= lastAbsDelta * 0.9;
            if (isSmallOscillation) {
              stableFrames++;
            } else {
              if (absDelta > 8) {
                const glideStep = Math.sign(boundedDelta) * Math.max(5, Math.min(220, Math.round(absDelta * 0.45)));
                scroller.scrollTop = Math.max(0, Math.min(liveMaxScroll, curTop + glideStep));
              } else {
                scroller.scrollTop = clampedTargetTop;
              }
              const moved = Math.abs(scroller.scrollTop - curTop);
              if (moved < 0.25) {
                // Reached scroll boundary or browser quantization floor
                stableFrames++;
              } else {
                stableFrames = 0;
              }
            }
          } else {
            if (absDelta > 0.5 && stableFrames === 0) {
              scroller.scrollTop = clampedTargetTop;
            }
            stableFrames++;
          }

          lastAbsDelta = absDelta;
          if (curSign !== 0) prevDeltaSign = curSign;

          const elapsed = performance.now() - anchorStartTime;
          const effectiveMaxMs = (isPendingImage || anchorApproachTeleports > 0) ? 1850 : baseAnchorMaxMs;
          const keepAnchoring = (elapsed < anchorMinMs || stableFrames < requiredStableFrames || isPendingImage) && elapsed < effectiveMaxMs;
          if (keepAnchoring) {
            anchorRafId = requestAnimationFrame(anchorTick);
          } else {
            // Final precision touch before releasing if a late shift happened right at window edge
            const finalRect = freshTarget.getBoundingClientRect();
            const finalMetrics = getScrollerViewportMetrics(scroller);
            const finalDesiredTop = computeDesiredTop(finalRect, finalMetrics, catalogItem);
            const finalMaxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
            const finalTargetTop = Math.max(0, Math.min(finalMaxScroll, scroller.scrollTop + ((finalRect.top - finalMetrics.top) - finalDesiredTop)));
            const finalDiff = Math.abs(finalTargetTop - scroller.scrollTop);
            if (finalDiff > 0.5) {
              scroller.scrollTop = finalTargetTop;
            }
            anchorRafId = null;
            cleanup(false);
          }
        };

        anchorRafId = requestAnimationFrame(anchorTick);
      };

      // Two-stage Plan A landing: instant approach teleport past intermediate blank turns + short crisp glide
      const landOnTarget = (initialEl) => {
        if (!isNavigating || myToken !== navigationToken) return;
        scheduleSafetyTimeout(3200);
        let trackedCard = initialEl;
        if (!trackedCard || !trackedCard.isConnected) {
          trackedCard = Locator.findTargetElement(catalogItem);
        }
        if (!trackedCard || !trackedCard.isConnected) {
          if (searchHopsUsed < maxSearchHops && runSearchHop) {
            runSearchHop(searchHopsUsed + 1);
          } else {
            cleanup(false);
          }
          return;
        }

        const subTarget0 = resolveSubTarget(trackedCard, catalogItem);
        const rect0 = subTarget0.getBoundingClientRect();
        const metrics0 = getScrollerViewportMetrics(scroller);
        const desiredTop0 = computeDesiredTop(rect0, metrics0, catalogItem);
        const maxScroll0 = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
        const targetTop0 = Math.max(0, Math.min(maxScroll0, scroller.scrollTop + ((rect0.top - metrics0.top) - desiredTop0)));
        const initialBoundedDist = Math.abs(targetTop0 - scroller.scrollTop);

        if (initialBoundedDist <= 1.5) {
          if (initialBoundedDist > 0.5) {
            scroller.scrollTop = targetTop0;
          }
          anchorLand(trackedCard);
          return;
        }

        let flightTeleports = 0;
        const maxFlightTeleports = 16;

        // Stage 1: Teleport to the approach zone when distance exceeds half-screen threshold
        if (initialBoundedDist > TELEPORT_DISTANCE_THRESHOLD) {
          const approachDist = getApproachDistance(metrics0.height);
          const dirSign = targetTop0 >= scroller.scrollTop ? 1 : -1;
          const preJumpTop = Math.max(0, Math.min(maxScroll0, targetTop0 - dirSign * approachDist));
          if (Math.abs(preJumpTop - scroller.scrollTop) > 40) {
            scroller.scrollTop = preJumpTop;
            flightTeleports++;
          }
          if (!isTrackedCardValid(trackedCard)) {
            const refound = Locator.findTargetElement(catalogItem);
            if (refound && refound.isConnected) {
              trackedCard = refound;
            }
          }
        }

        let initialGlideDist = initialBoundedDist;
        if (isTrackedCardValid(trackedCard)) {
          const subTarget1 = resolveSubTarget(trackedCard, catalogItem);
          const rect1 = subTarget1.getBoundingClientRect();
          const metrics1 = getScrollerViewportMetrics(scroller);
          const desiredTop1 = computeDesiredTop(rect1, metrics1, catalogItem);
          const maxScroll1 = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
          const targetTop1 = Math.max(0, Math.min(maxScroll1, scroller.scrollTop + ((rect1.top - metrics1.top) - desiredTop1)));
          initialGlideDist = Math.abs(targetTop1 - scroller.scrollTop);
          if (initialGlideDist <= 1.5) {
            if (initialGlideDist > 0.5) {
              scroller.scrollTop = targetTop1;
            }
            anchorLand(trackedCard);
            return;
          }
        }

        let remainingMs = computeCrispGlideDuration(Math.min(TELEPORT_DISTANCE_THRESHOLD, initialGlideDist));
        let p = 0;
        let prevTime = performance.now();
        const flightStartTime = prevTime;
        let rafId = null;
        let canceled = false;

        activeNavigationCancel = () => {
          canceled = true;
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
        };

        const flightTick = (currentTime) => {
          if (canceled || !isNavigating || myToken !== navigationToken) return;

          const dt = Math.min(48, Math.max(1, currentTime - prevTime));
          prevTime = currentTime;

          if (!isTrackedCardValid(trackedCard)) {
            trackedCard = Locator.findTargetElement(catalogItem);
            if (!trackedCard || !trackedCard.isConnected) {
              rafId = null;
              if (searchHopsUsed < maxSearchHops && runSearchHop) {
                runSearchHop(searchHopsUsed + 1);
              } else {
                cleanup(false);
              }
              return;
            }
          }

          const subTarget = resolveSubTarget(trackedCard, catalogItem);
          const liveRect = subTarget.getBoundingClientRect();
          const metrics = getScrollerViewportMetrics(scroller);
          const liveDesiredTop = computeDesiredTop(liveRect, metrics, catalogItem);
          const curTop = scroller.scrollTop;
          const liveMaxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
          const liveTargetTop = Math.max(0, Math.min(liveMaxScroll, curTop + ((liveRect.top - metrics.top) - liveDesiredTop)));
          const boundedRemaining = liveTargetTop - curTop;
          const absRemaining = Math.abs(boundedRemaining);

          // If asynchronous lazy hydration shifts target beyond teleport threshold mid-glide,
          // re-teleport directly into its new approach zone rather than dragging over blank placeholders.
          if (absRemaining > TELEPORT_DISTANCE_THRESHOLD && flightTeleports < maxFlightTeleports) {
            const approachDist = getApproachDistance(metrics.height);
            const sign = boundedRemaining > 0 ? 1 : -1;
            const jumpTop = Math.max(0, Math.min(liveMaxScroll, liveTargetTop - sign * approachDist));
            if (Math.abs(jumpTop - curTop) > 40) {
              scroller.scrollTop = jumpTop;
              flightTeleports++;
              p = 0;
              remainingMs = computeCrispGlideDuration(Math.min(approachDist, absRemaining));
              scheduleSafetyTimeout(3200);
              rafId = requestAnimationFrame(flightTick);
              return;
            }
          }

          // Extend remaining glide slightly when sub-viewport reflow arrives late in flight
          if (p > 0.65 && absRemaining > 60 && (currentTime - flightStartTime) < 1200) {
            remainingMs = Math.max(
              remainingMs,
              Math.min(240, Math.round(90 + Math.sqrt(absRemaining) * 3.5))
            );
          }

          const nextP = remainingMs <= dt ? 1 : (1 - (1 - p) * Math.max(0, 1 - dt / remainingMs));
          remainingMs = Math.max(0, remainingMs - dt);
          const prevEased = 1 - Math.pow(1 - p, 3);
          const nextEased = 1 - Math.pow(1 - nextP, 3);
          const stepFraction = prevEased >= 1 ? 1 : Math.min(1, (nextEased - prevEased) / Math.max(1e-6, 1 - prevEased));
          p = nextP;

          if (p < 1) {
            let step = boundedRemaining * stepFraction;
            if (p > 0.85 && absRemaining >= 1 && Math.abs(step) > 0 && Math.abs(step) < 1) {
              step = Math.sign(boundedRemaining);
            }
            scroller.scrollTop = Math.max(0, Math.min(liveMaxScroll, curTop + step));
            rafId = requestAnimationFrame(flightTick);
          } else {
            rafId = null;
            if (absRemaining <= 12) {
              scroller.scrollTop = liveTargetTop;
            }
            // Larger residuals are smoothly converged by anchorLand without abrupt snaps
            anchorLand(trackedCard);
          }
        };

        rafId = requestAnimationFrame(flightTick);
      };

      // Target not in DOM yet (virtualized / lazy-deferred): instant-jump bracketed search
      // with adaptive hydration settle so long chats skip blank turns without visual dragging.
      runSearchHop = (hop) => {
        if (!isNavigating || myToken !== navigationToken) return;
        searchHopsUsed = hop;

        const quickFound = Locator.findTargetElement(catalogItem);
        if (quickFound) {
          landOnTarget(quickFound);
          return;
        }

        const curScrollHeight = scroller.scrollHeight;
        const maxScroll = Math.max(0, curScrollHeight - scroller.clientHeight);
        const currentTop = scroller.scrollTop;

        if (hop > maxSearchHops || maxScroll <= 0) {
          cleanup(false);
          return;
        }

        // Propagate scrollHeight growth/shrinkage since the previous hop onto [lowBound, highBound]
        // so tightened intermediate bounds cannot trap search behind newly expanded lazy turns.
        const dh = curScrollHeight - lastHopScrollHeight;
        lastHopScrollHeight = curScrollHeight;
        if (dh > 0) {
          if (highBound.round === totalRounds - 1) {
            highBound.scrollTop = Math.max(highBound.scrollTop, maxScroll);
          } else {
            highBound.scrollTop = Math.min(maxScroll, highBound.scrollTop + dh);
          }
        } else if (dh < 0) {
          lowBound.scrollTop = Math.max(0, lowBound.scrollTop + dh);
          if (highBound.round === totalRounds - 1) {
            highBound.scrollTop = maxScroll;
          } else {
            highBound.scrollTop = Math.max(0, Math.min(maxScroll, highBound.scrollTop + dh));
          }
        } else if (highBound.round === totalRounds - 1) {
          highBound.scrollTop = Math.max(highBound.scrollTop, maxScroll);
        }

        const liveTurns = Locator.getUserTurnElements();
        const metrics = getScrollerViewportMetrics(scroller);
        const viewBound = {
          topMin: metrics.top - metrics.height * 1.5,
          topMax: metrics.top + metrics.height * 2.5
        };
        const visRange = Locator.inferVisibleRoundRange(liveTurns, catalogData, null, viewBound);
        const getAnchorDesiredTop = (el) => {
          const r = el.getBoundingClientRect();
          return Math.max(0, Math.min(maxScroll, Math.round(currentTop + (r.top - metrics.top) - 80)));
        };

        let firstA = null;
        let lastA = null;
        let firstScroll = 0;
        let lastScroll = 0;
        let minNextRoundScroll = 0;

        // Tighten search bracket from live visible round anchors (resilient to upstream resize)
        if (visRange.anchors.length > 0) {
          emptyGapConsecutive = 0;
          firstA = visRange.anchors[0];
          lastA = visRange.anchors[visRange.anchors.length - 1];
          firstScroll = getAnchorDesiredTop(liveTurns[firstA.domPos]);
          lastScroll = getAnchorDesiredTop(liveTurns[lastA.domPos]);

          if (targetRound < firstA.roundIndex && (firstA.roundIndex <= highBound.round || firstScroll < highBound.scrollTop)) {
            if (firstScroll >= lowBound.scrollTop) {
              highBound = { round: firstA.roundIndex, scrollTop: firstScroll };
            }
          } else if (targetRound > lastA.roundIndex) {
            // Project lower bound past the bottom of lastA and any trailing model turns in that round
            let floorEl = liveTurns[lastA.domPos];
            const allTurns = Array.from(document.querySelectorAll(Utils.SELECTORS.query.chatTurn));
            const idxInAll = allTurns.indexOf(floorEl);
            if (idxInAll !== -1) {
              for (let k = idxInAll + 1; k < allTurns.length; k++) {
                const nextCont = allTurns[k].querySelector(Utils.SELECTORS.query.chatTurnContainer);
                if (nextCont && nextCont.classList.contains(Utils.SELECTORS.class.userTurn)) {
                  break;
                }
                floorEl = allTurns[k];
              }
            }
            const floorRect = floorEl.getBoundingClientRect();
            minNextRoundScroll = Math.max(
              lastScroll,
              Math.min(maxScroll, Math.round(currentTop + (floorRect.bottom - metrics.top) - 140))
            );
            const nextMinRound = Math.min(totalRounds - 1, lastA.roundIndex + 1);
            if (minNextRoundScroll <= highBound.scrollTop &&
                ((nextMinRound >= lowBound.round && (nextMinRound > lowBound.round || minNextRoundScroll > lowBound.scrollTop)) ||
                 minNextRoundScroll > lowBound.scrollTop)) {
              lowBound = { round: nextMinRound, scrollTop: minNextRoundScroll };
            } else if ((lastA.roundIndex >= lowBound.round || lastScroll > lowBound.scrollTop) && lastScroll <= highBound.scrollTop) {
              lowBound = { round: lastA.roundIndex, scrollTop: lastScroll };
            }
          }
        }

        // Reset collided bounds while retaining the current frame's live observation
        if (lowBound.round >= highBound.round || lowBound.scrollTop > highBound.scrollTop) {
          lowBound = (lastA && targetRound > lastA.roundIndex)
            ? { round: Math.min(totalRounds - 1, lastA.roundIndex + 1), scrollTop: Math.min(maxScroll, minNextRoundScroll || lastScroll) }
            : { round: 0, scrollTop: 0 };
          highBound = (firstA && targetRound < firstA.roundIndex && firstScroll >= lowBound.scrollTop)
            ? { round: firstA.roundIndex, scrollTop: firstScroll }
            : { round: Math.max(0, totalRounds - 1), scrollTop: maxScroll };
          if (lowBound.round >= highBound.round || lowBound.scrollTop > highBound.scrollTop) {
            lowBound = { round: 0, scrollTop: 0 };
            highBound = { round: Math.max(0, totalRounds - 1), scrollTop: maxScroll };
          }
        }

        let searchTarget;
        if (targetRound === 0) {
          if (hop > 1 && currentTop <= 5 && visRange.anchors.length === 0) {
            sawTopMiss = true;
          }
          if (sawTopMiss) {
            searchTarget = currentTop + Math.max(400, Math.round(metrics.height * 0.9));
            lastSearchDir = 1;
          } else {
            searchTarget = 0;
            lastSearchDir = -1;
          }
        } else if (targetRound >= totalRounds - 1 && !sawBottomMiss) {
          if (hop > 1 && currentTop >= maxScroll - 20 && visRange.anchors.length === 0) {
            sawBottomMiss = true;
            lastSearchDir = -1;
            searchTarget = currentTop - Math.max(520, Math.round(metrics.height * 0.95));
          } else {
            searchTarget = maxScroll;
            lastSearchDir = 1;
          }
        } else if (targetRound >= totalRounds - 1 && sawBottomMiss && visRange.anchors.length === 0) {
          lastSearchDir = -1;
          searchTarget = currentTop - Math.max(520, Math.round(metrics.height * 0.95));
        } else if (visRange.minRound !== -1 && targetRound >= visRange.minRound && targetRound <= visRange.maxRound) {
          // Target round is inside visible span: interpolate between bracketing anchors or nudge chunk offset
          let leftA = null;
          let rightA = null;
          for (const a of visRange.anchors) {
            if (a.roundIndex <= targetRound) leftA = a;
            if (!rightA && a.roundIndex >= targetRound) rightA = a;
          }
          if (leftA && leftA.roundIndex === targetRound) {
            const baseTop = getAnchorDesiredTop(liveTurns[leftA.domPos]);
            const ctxMode = Locator.buildDomLookupContext(catalogData, liveTurns).effectiveMode;
            const chunkDiff = (ctxMode === 'chunk' && catalogItem.chunkTargetDomIndex !== undefined && catalogItem.chunkTextDomIndex !== undefined)
              ? (catalogItem.chunkTargetDomIndex - catalogItem.chunkTextDomIndex)
              : 0;
            const stepUnit = Math.round(metrics.height * 0.65);
            if (chunkDiff < 0) {
              searchTarget = Math.min(currentTop - stepUnit, baseTop + chunkDiff * 240);
            } else if (chunkDiff > 0) {
              searchTarget = Math.max(currentTop + stepUnit, baseTop + chunkDiff * 240);
            } else if (Math.abs(baseTop - currentTop) >= 12) {
              searchTarget = baseTop;
            } else {
              searchTarget = currentTop + lastSearchDir * Math.round(metrics.height * 0.45);
            }
          } else if (leftA && rightA && rightA.roundIndex > leftA.roundIndex) {
            const leftTop = getAnchorDesiredTop(liveTurns[leftA.domPos]);
            const rightTop = getAnchorDesiredTop(liveTurns[rightA.domPos]);
            const frac = (targetRound - leftA.roundIndex) / (rightA.roundIndex - leftA.roundIndex);
            searchTarget = Math.round(leftTop + (rightTop - leftTop) * frac);
          } else {
            const isBefore = catalogItem.chunkTargetDomIndex !== undefined &&
              catalogItem.chunkTextDomIndex !== undefined &&
              catalogItem.chunkTargetDomIndex < catalogItem.chunkTextDomIndex;
            const stepUnit = Math.max(400, Math.round(metrics.height * 0.75));
            searchTarget = currentTop + (isBefore ? -stepUnit : stepUnit);
          }
        } else if (visRange.anchors.length === 0 && hop > 1) {
          // Landed inside an unhydrated gap or giant model reply with zero user anchors in view:
          // first check if mounted model turns expose a direct edge past the gap, otherwise march monotonically.
          emptyGapConsecutive++;
          const dir = lastSearchDir || 1;
          const nearAllTurns = Array.from(document.querySelectorAll(Utils.SELECTORS.query.chatTurn)).filter((t) => {
            const r = t.getBoundingClientRect();
            return r.bottom >= viewBound.topMin && r.top <= viewBound.topMax;
          });
          let jumpedTurnEdge = null;
          if (nearAllTurns.length > 0) {
            if (dir > 0) {
              let maxBottom = -Infinity;
              for (const t of nearAllTurns) {
                const r = t.getBoundingClientRect();
                if (r.bottom > maxBottom) maxBottom = r.bottom;
              }
              const edgeTop = Math.min(maxScroll, Math.round(currentTop + (maxBottom - metrics.top) - 80));
              if (edgeTop > currentTop + 200) jumpedTurnEdge = edgeTop;
            } else {
              let minTop = Infinity;
              for (const t of nearAllTurns) {
                const r = t.getBoundingClientRect();
                if (r.top < minTop) minTop = r.top;
              }
              const edgeTop = Math.max(0, Math.round(currentTop + (minTop - metrics.top) - Math.round(metrics.height * 0.75)));
              if (edgeTop < currentTop - 200) jumpedTurnEdge = edgeTop;
            }
          }
          if (jumpedTurnEdge !== null) {
            searchTarget = jumpedTurnEdge;
          } else {
            const stride = Math.round(metrics.height * 0.95) * Math.min(3, Math.max(1, emptyGapConsecutive));
            let nextGapTop = currentTop + dir * stride;
            if (dir > 0 && currentTop >= maxScroll - 8) {
              lastSearchDir = -1;
              nextGapTop = currentTop - Math.round(metrics.height * 0.95);
            } else if (dir < 0 && currentTop <= 8) {
              lastSearchDir = 1;
              nextGapTop = currentTop + Math.round(metrics.height * 0.95);
            }
            searchTarget = nextGapTop;
          }
        } else {
          // Interpolate strictly inside [lowBound, highBound] with step-size safeguards
          const rSpan = Math.max(1, highBound.round - lowBound.round);
          const frac = Math.max(0, Math.min(1, (targetRound - lowBound.round) / rSpan));
          let est = Math.round(lowBound.scrollTop + (highBound.scrollTop - lowBound.scrollTop) * frac);

          const roundGap = visRange.minRound !== -1
            ? (targetRound < visRange.minRound ? (visRange.minRound - targetRound) : (targetRound - visRange.maxRound))
            : Infinity;
          let dir;
          if (visRange.minRound !== -1) {
            dir = targetRound < visRange.minRound ? -1 : 1;
          } else if (Math.abs(est - currentTop) >= 5) {
            dir = est >= currentTop ? 1 : -1;
          } else {
            dir = lastSearchDir;
          }
          lastSearchDir = dir;

          // Avoid large overshoot jumps when within 1-2 rounds of visible turns
          if (roundGap <= 2 && Math.abs(est - currentTop) > metrics.height * 2.5) {
            est = currentTop + dir * Math.round(metrics.height * 1.4);
          }

          const minStep = Math.max(220, Math.round(metrics.height * 0.65));
          if (dir < 0 && est > currentTop - minStep) {
            est = Math.max(lowBound.scrollTop, currentTop - minStep);
          } else if (dir > 0 && est < currentTop + minStep) {
            est = Math.min(highBound.scrollTop, currentTop + minStep);
          }
          searchTarget = est;
        }

        searchTarget = Math.max(0, Math.min(maxScroll, Math.round(searchTarget)));

        // Avoid zero-movement stall unless boundaries themselves prevent movement
        if (Math.abs(searchTarget - currentTop) < 5 && hop > 1) {
          const nudgeDir = (visRange.maxRound !== -1 && targetRound > visRange.maxRound) ? 1
            : ((visRange.minRound !== -1 && targetRound < visRange.minRound) ? -1 : (lastSearchDir || 1));
          const nudgeDist = Math.max(320, Math.round(metrics.height * 0.7));
          const nudged = Math.max(0, Math.min(maxScroll, currentTop + nudgeDir * nudgeDist));
          if (Math.abs(nudged - currentTop) >= 5) {
            lastSearchDir = nudgeDir;
            searchTarget = nudged;
          }
        }

        // Execute instant jump (zero slow intermediate blank sweep), then observe asynchronously
        // via rAF until virtual/deferred DOM renders & height stabilizes (or target is found immediately).
        if (Math.abs(searchTarget - currentTop) >= 1) {
          scroller.scrollTop = searchTarget;
        }
        lastHopScrollHeight = scroller.scrollHeight;

        const hopJumpTime = performance.now();
        const minHopSettleMs = 45;
        const maxHopSettleMs = 280;
        let prevScrollHeight = scroller.scrollHeight;
        let prevUserTurnCount = Locator.getUserTurnElements().length;
        let prevAllTurnCount = document.querySelectorAll(Utils.SELECTORS.query.chatTurn).length;
        let stableCount = 0;
        let settleRafId = null;
        let hopCanceled = false;

        activeNavigationCancel = () => {
          hopCanceled = true;
          if (settleRafId !== null) {
            cancelAnimationFrame(settleRafId);
            settleRafId = null;
          }
          if (searchSettleTimer) {
            clearTimeout(searchSettleTimer);
            searchSettleTimer = null;
          }
        };

        const hopSettleTick = (now) => {
          if (hopCanceled || !isNavigating || myToken !== navigationToken) return;

          const curH = scroller.scrollHeight;
          const curUserTurns = Locator.getUserTurnElements();
          const curUserCount = curUserTurns.length;
          const curAllTurns = Array.from(document.querySelectorAll(Utils.SELECTORS.query.chatTurn));
          const curAllCount = curAllTurns.length;

          const domMutated =
            curH !== prevScrollHeight ||
            curUserCount !== prevUserTurnCount ||
            curAllCount !== prevAllTurnCount;

          if (domMutated) {
            prevScrollHeight = curH;
            prevUserTurnCount = curUserCount;
            prevAllTurnCount = curAllCount;
            stableCount = 0;
          } else {
            stableCount++;
          }

          const foundEl = Locator.findTargetElement(catalogItem);
          if (foundEl) {
            settleRafId = null;
            landOnTarget(foundEl);
            return;
          }

          const hopElapsed = now - hopJumpTime;
          const curMetrics = getScrollerViewportMetrics(scroller);
          const curViewBound = {
            topMin: curMetrics.top - curMetrics.height * 1.5,
            topMax: curMetrics.top + curMetrics.height * 2.5
          };
          const nearViewportTurns = curAllTurns.filter((t) => {
            const r = t.getBoundingClientRect();
            return r.bottom >= curMetrics.top - 120 && r.top <= curMetrics.top + curMetrics.height + 120;
          });
          const hasUnhydratedViewportTurn = nearViewportTurns.some((t) => {
            const cont = t.querySelector(Utils.SELECTORS.query.chatTurnContainer);
            if (!cont) return true;
            if (cont.classList.contains(Utils.SELECTORS.class.userTurn)) {
              return !Locator.getCleanPromptText(t) && !Locator.turnHasAttachment(t);
            }
            return false;
          });
          const hasAnchorsNow = domMutated
            ? false
            : (Locator.inferVisibleRoundRange(curUserTurns, catalogData, null, curViewBound).anchors.length > 0 || sawBottomMiss || sawTopMiss || emptyGapConsecutive > 0);
          const readyByStability = !hasUnhydratedViewportTurn && hopElapsed >= minHopSettleMs && stableCount >= 2 && hasAnchorsNow;

          if (readyByStability || hopElapsed >= maxHopSettleMs) {
            settleRafId = null;
            if (hop < maxSearchHops) {
              runSearchHop(hop + 1);
            } else {
              cleanup(false);
            }
            return;
          }

          settleRafId = requestAnimationFrame(hopSettleTick);
        };

        settleRafId = requestAnimationFrame(hopSettleTick);
      };

      // Check if target is already in DOM
      const initialTargetEl = Locator.findTargetElement(catalogItem);
      if (initialTargetEl) {
        landOnTarget(initialTargetEl);
        return;
      }

      runSearchHop(1);
    } catch (error) {
      console.error('Error during navigation:', error);
      if (typeof cleanup === 'function') {
        cleanup(true);
      }
    }
  }

  function scrollToBottom() {
    try {
      const scroller = getChatScrollContainer();
      if (!scroller) return;

      if (activeNavigationAbort) {
        activeNavigationAbort(true);
        activeNavigationAbort = null;
      }
      if (activeNavigationCancel) {
        activeNavigationCancel();
        activeNavigationCancel = null;
      }

      const myToken = ++navigationToken;
      activeNavState = null;
      lastNavigationEndAt = 0;

      const getMaxScroll = () => Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      const initialMax = getMaxScroll();
      const totalDistance = Math.abs(initialMax - scroller.scrollTop);
      if (totalDistance < 1) return;

      const prevScrollBehavior = scroller.style.scrollBehavior;
      const computedBehavior = window.getComputedStyle ? window.getComputedStyle(scroller).scrollBehavior : '';
      const didOverrideBehavior = computedBehavior === 'smooth' || prevScrollBehavior === 'smooth';
      if (didOverrideBehavior) {
        scroller.style.scrollBehavior = 'auto';
      }
      const restoreBehavior = () => {
        if (didOverrideBehavior) {
          scroller.style.scrollBehavior = prevScrollBehavior;
        }
      };

      if (totalDistance > 520) {
        const approachDist = Math.min(340, Math.max(180, Math.round((scroller.clientHeight || 800) * 0.42)));
        scroller.scrollTop = Math.max(0, initialMax - approachDist);
      }

      const remainingDistance = Math.abs(getMaxScroll() - scroller.scrollTop);
      const duration = Math.min(210, Math.max(95, Math.round(80 + Math.sqrt(remainingDistance) * 4.5)));
      let tailAttempts = 0;

      const finishOrConverge = () => {
        if (myToken !== navigationToken) {
          restoreBehavior();
          return;
        }
        const liveMax = getMaxScroll();
        const tailRemaining = liveMax - scroller.scrollTop;
        if (Math.abs(tailRemaining) > 4 && tailAttempts < 4) {
          tailAttempts++;
          if (Math.abs(tailRemaining) > 520) {
            const approachDist = Math.min(340, Math.max(180, Math.round((scroller.clientHeight || 800) * 0.42)));
            scroller.scrollTop = Math.max(0, liveMax - approachDist);
          }
          const settleDur = Math.min(180, Math.max(85, Math.round(70 + Math.sqrt(Math.abs(getMaxScroll() - scroller.scrollTop)) * 4)));
          const settleCancel = animateScrollTo(scroller, getMaxScroll, settleDur, finishOrConverge);
          activeNavigationCancel = () => {
            settleCancel();
            restoreBehavior();
          };
          return;
        }
        restoreBehavior();
        activeNavigationCancel = null;
      };

      const cancelAnim = animateScrollTo(scroller, getMaxScroll, duration, finishOrConverge);
      activeNavigationCancel = () => {
        cancelAnim();
        restoreBehavior();
      };
    } catch (error) {
      console.error('Error scrolling to bottom:', error);
    }
  }

  function isOverlayActive() {
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) {
      return overlay.offsetWidth > 0 && overlay.offsetHeight > 0 && overlay.style.visibility !== 'hidden';
    }
    return false;
  }

  function updateScrollBtnOverlayVisibility() {
    const btn = document.getElementById(Utils.SELECTORS.id.scrollToBottomButton);
    if (!btn) return;
    if (isOverlayActive()) {
      btn.style.display = 'none';
    } else {
      btn.style.display = '';
    }
  }

  function updateScrollButtonPosition() {
    const btn = document.getElementById(Utils.SELECTORS.id.scrollToBottomButton);
    if (!btn) return;
    const target = getChatMainContainer();
    if (target) {
      const rect = target.getBoundingClientRect();
      btn.style.left = (rect.left + rect.width / 2) + 'px';
    }
  }

  function updateActiveTurnHighlight(turnIndex, turnCounter, subIndex) {
    const list = document.getElementById(Utils.SELECTORS.id.catalogListContainer);
    if (!list) return;

    const items = list.querySelectorAll('.catalog-list-item');
    items.forEach((item) => {
      const idx = item.getAttribute('data-turn-index');
      const counter = item.getAttribute('data-turn-counter');
      const itemSub = item.getAttribute('data-sub-index');
      const matchesCounter = (turnCounter !== undefined && counter === String(turnCounter));
      const matchesIdx = (idx !== null && parseInt(idx, 10) === turnIndex);

      if (matchesCounter || matchesIdx) {
        if (subIndex !== undefined && subIndex !== null && itemSub !== null) {
          if (String(subIndex) === itemSub) {
            item.classList.add('catalog-item-selected');
          } else {
            item.classList.remove('catalog-item-selected');
          }
        } else {
          item.classList.add('catalog-item-selected');
        }
      } else {
        item.classList.remove('catalog-item-selected');
      }
      // Ensure temporary flight highlight is cleared during viewport scroll updates
      item.classList.remove('catalog-item-navigating');
    });
  }

  function updateActiveTurnByViewport() {
    if (isNavigating) return;
    if (lastNavigationEndAt > 0 && (performance.now() - lastNavigationEndAt) < 350) {
      return;
    }

    const scroller = getChatScrollContainer();
    if (!scroller) return;

    const userTurns = Locator.getUserTurnElements();
    if (userTurns.length === 0) return;

    const catalogData = State.getCatalogData();
    if (!catalogData || catalogData.length === 0) return;

    const scrollerRect = getScrollerViewportMetrics(scroller);
    let activeTurnEl = null;
    let activeTurnPos = 0;

    for (let i = 0; i < userTurns.length; i++) {
      const rect = userTurns[i].getBoundingClientRect();
      if (rect.top <= scrollerRect.top + 250) {
        activeTurnEl = userTurns[i];
        activeTurnPos = i;
      } else {
        break;
      }
    }

    if (!activeTurnEl) {
      activeTurnEl = userTurns[0];
      activeTurnPos = 0;
    }

    const ctx = Locator.buildDomLookupContext(catalogData, userTurns);
    let activeRoundIdx = Locator.inferCatalogRoundIndex(activeTurnEl, catalogData, ctx, activeTurnPos);

    if (activeRoundIdx === -1) {
      activeRoundIdx = Locator.resolveRoundFromNeighbors(userTurns, activeTurnPos, ctx);
    }

    let found = null;
    if (activeRoundIdx !== -1) {
      found = catalogData.find(item => item.roundIndex === activeRoundIdx && item.isTurnRoot) ||
              catalogData.find(item => item.roundIndex === activeRoundIdx);
    }

    if (found) {
      updateActiveTurnHighlight(found.turnIndex, found.turnCounter);
    }
  }

  function setupScrollSpy() {
    const scroller = getChatScrollContainer();
    if (!scroller || boundScrollers.has(scroller)) return;

    boundScrollers.add(scroller);

    const onManualScrollInput = (e) => {
      if (isNavigating) return;
      if (e && e.target && e.target.closest && e.target.closest('#' + Utils.SELECTORS.id.catalogPanel)) {
        return;
      }
      activeNavState = null;
      lastNavigationEndAt = 0;
    };
    const onScrollbarPointerDown = (e) => {
      if (e && e.target === scroller && e.offsetX >= scroller.clientWidth) {
        onManualScrollInput(e);
      }
    };
    scroller.addEventListener('wheel', onManualScrollInput, { passive: true });
    scroller.addEventListener('touchstart', onManualScrollInput, { passive: true });
    scroller.addEventListener('pointerdown', onScrollbarPointerDown, { passive: true });

    if (!userScrollKeyListenerBound) {
      userScrollKeyListenerBound = true;
      window.addEventListener('keydown', (e) => {
        if (isNavigating) return;
        const active = document.activeElement;
        if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || active.isContentEditable)) {
          return;
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'PageUp' || e.key === 'PageDown' || e.key === 'Home' || e.key === 'End' || e.key === ' ') {
          activeNavState = null;
          lastNavigationEndAt = 0;
        }
      }, { passive: true });
    }

    let scrollTimer = null;
    scroller.addEventListener('scroll', () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        const withinNavGrace = lastNavigationEndAt > 0 && (performance.now() - lastNavigationEndAt) < 400;
        if (!isNavigating && !withinNavGrace) {
          const movedPastLandedSpot = activeNavState &&
            activeNavState.landedScrollTop !== undefined &&
            Math.abs(scroller.scrollTop - activeNavState.landedScrollTop) > 12;
          if (!activeNavState || movedPastLandedSpot) {
            activeNavState = null;
            lastNavigationEndAt = 0;
            updateActiveTurnByViewport();
          }
        }
        const Catalog = global.__AIStudioEnhancer__.Catalog;
        if (Catalog && typeof Catalog.enrichCatalogAttachmentNames === 'function') {
          Catalog.enrichCatalogAttachmentNames();
        }
      }, 100);
    }, { passive: true });
  }

  function getIsHoveringScrollButton() {
    return isHoveringScrollButton;
  }

  function setIsHoveringScrollButton(val) {
    isHoveringScrollButton = val;
  }

  function getScrollStopTimer() {
    return scrollStopTimer;
  }

  function setScrollStopTimer(timer) {
    scrollStopTimer = timer;
  }

  global.__AIStudioEnhancer__.CatalogNavigator = {
    getChatMainContainer,
    getChatScrollContainer,
    navigateToPrompt,
    scrollToBottom,
    updateScrollButtonPosition,
    updateScrollBtnOverlayVisibility,
    updateActiveTurnHighlight,
    updateActiveTurnByViewport,
    setupScrollSpy,
    clearActiveNavState,
    reconcileActiveNavState,
    syncHighlightAfterRender,
    getIsHoveringScrollButton,
    setIsHoveringScrollButton,
    getScrollStopTimer,
    setScrollStopTimer
  };

})(window);
