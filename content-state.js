(function (global) {
  'use strict';
  global.__AIStudioEnhancer__ = global.__AIStudioEnhancer__ || {};

  let conversationHistory = null;
  let promptTitle = chrome.i18n.getMessage('promptTitleDefault') || 'Conversation';
  let catalogData = [];

  // Two-tier Drive file metadata cache constants (global by Drive File ID)
  const DRIVE_CACHE_STORAGE_KEY = 'aseDriveFileCache_v1';
  const MAX_DRIVE_CACHE_ENTRIES = 3000;
  const DRIVE_CACHE_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 180 days
  const DRIVE_PERSIST_DEBOUNCE_MS = 500;
  const DRIVE_TOUCH_PERSIST_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  const DRIVE_SOURCE_RANK = {
    drive_api: 3,
    dom_full: 2,
    dom_truncated: 1
  };

  const driveMetadataMap = new Map();
  const dirtyDriveIds = new Set();
  let driveHydrated = false;
  let driveHydrating = false;
  let isFlushingDriveCache = false;
  let drivePersistTimer = null;
  let hydrationCallbacks = [];
  let drivePersistenceValidator = null;

  function hasChromeStorageLocal() {
    return Boolean(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local);
  }

  function normalizeSourceRank(source) {
    if (typeof source === 'number') {
      if (source >= 3) return DRIVE_SOURCE_RANK.drive_api;
      if (source === 2) return DRIVE_SOURCE_RANK.dom_full;
      return DRIVE_SOURCE_RANK.dom_truncated;
    }
    if (source === 'drive_api') return DRIVE_SOURCE_RANK.drive_api;
    if (source === 'dom_full') return DRIVE_SOURCE_RANK.dom_full;
    return DRIVE_SOURCE_RANK.dom_truncated;
  }

  function isRecordExpired(rec, now) {
    if (!rec || typeof rec !== 'object') return true;
    const t = typeof rec.t === 'number' ? rec.t : 0;
    if (t <= 0) return true;
    return (now - t) > DRIVE_CACHE_TTL_MS;
  }

  function cloneRecord(rec) {
    return {
      n: typeof rec.n === 'string' ? rec.n : '',
      m: typeof rec.m === 'string' ? rec.m : '',
      e: typeof rec.e === 'string' ? rec.e : '',
      s: typeof rec.s === 'number' ? rec.s : DRIVE_SOURCE_RANK.dom_truncated,
      t: typeof rec.t === 'number' ? rec.t : Date.now()
    };
  }

  function normalizeStoredRecord(raw, now) {
    if (!raw || typeof raw !== 'object') return null;
    const n = typeof raw.n === 'string' ? raw.n.trim() : '';
    const m = typeof raw.m === 'string' ? raw.m.trim() : '';
    const e = typeof raw.e === 'string' ? raw.e.trim() : '';
    const s = normalizeSourceRank(raw.s);
    const t = typeof raw.t === 'number' && isFinite(raw.t) ? raw.t : 0;
    if ((!n && !m && !e) || t <= 0 || (now - t) > DRIVE_CACHE_TTL_MS) {
      return null;
    }
    return { n, m, e, s, t };
  }

  function touchEntryInL1(id, rec) {
    driveMetadataMap.delete(id);
    driveMetadataMap.set(id, rec);
  }

  function trimL1MapInPlace(maxEntries) {
    while (driveMetadataMap.size > maxEntries) {
      const oldestKey = driveMetadataMap.keys().next().value;
      if (oldestKey === undefined) break;
      driveMetadataMap.delete(oldestKey);
      dirtyDriveIds.delete(oldestKey);
    }
  }

  function sortAndTrimEntries(entryMap, maxEntries) {
    const entries = Array.from(entryMap.entries());
    entries.sort((a, b) => a[1].t - b[1].t);
    if (entries.length > maxEntries) {
      return entries.slice(entries.length - maxEntries);
    }
    return entries;
  }

  function canPersistNow(options) {
    if (options && options.persist === false) return false;
    if (typeof drivePersistenceValidator === 'function') {
      try {
        if (!drivePersistenceValidator()) return false;
      } catch (err) {
        return false;
      }
    }
    return hasChromeStorageLocal();
  }

  function mergeDriveRecords(existing, incoming, now) {
    const rawName = incoming.name !== undefined ? incoming.name : incoming.n;
    const rawMime = incoming.mimeType !== undefined ? incoming.mimeType : incoming.m;
    const rawExt = incoming.fileExtension !== undefined ? incoming.fileExtension : incoming.e;
    const rawSource = incoming.source !== undefined ? incoming.source : incoming.s;

    const inName = typeof rawName === 'string' ? rawName.trim() : '';
    const inMime = typeof rawMime === 'string' ? rawMime.trim() : '';
    const inExt = typeof rawExt === 'string' ? rawExt.trim() : '';
    const inRank = normalizeSourceRank(rawSource);

    if (!inName && !inMime && !inExt) {
      return { record: existing || null, changed: false, shouldTouchPersist: false };
    }

    if (!existing) {
      return {
        record: { n: inName, m: inMime, e: inExt, s: inRank, t: now },
        changed: true,
        shouldTouchPersist: true
      };
    }

    const exRank = typeof existing.s === 'number' ? existing.s : DRIVE_SOURCE_RANK.dom_truncated;
    const exName = existing.n || '';
    const exMime = existing.m || '';
    const exExt = existing.e || '';

    // Prevent lower-trust sources (e.g. truncated DOM) from overwriting higher-trust cache
    if (inRank < exRank) {
      if (!exName && inName && inRank >= DRIVE_SOURCE_RANK.dom_full) {
        return {
          record: {
            n: inName,
            m: exMime || inMime,
            e: exExt || inExt,
            s: exRank,
            t: now
          },
          changed: true,
          shouldTouchPersist: true
        };
      }
      return { record: existing, changed: false, shouldTouchPersist: false };
    }

    if (inRank > exRank) {
      const nameChanged = Boolean(inName && inName !== exName);
      const nextName = inName || exName;
      const nextMime = inMime || (!nameChanged ? exMime : '');
      const nextExt = inExt || (!nameChanged ? exExt : '');
      const changed = nextName !== exName || nextMime !== exMime || nextExt !== exExt || inRank !== exRank;
      return {
        record: { n: nextName, m: nextMime, e: nextExt, s: inRank, t: now },
        changed: changed,
        shouldTouchPersist: true
      };
    }

    // Equal trust rank (drive_api === 3 or dom_full === 2): allow authoritative rename refresh
    if (inRank >= DRIVE_SOURCE_RANK.dom_full) {
      const nextName = inName || exName;
      const renamed = Boolean(inName && exName && inName !== exName);
      const nextMime = inMime || (!renamed ? exMime : '');
      const nextExt = inExt || (!renamed ? exExt : '');
      const changed = nextName !== exName || nextMime !== exMime || nextExt !== exExt;
      const prevT = typeof existing.t === 'number' ? existing.t : 0;
      const shouldTouchPersist = changed || (now - prevT) >= DRIVE_TOUCH_PERSIST_INTERVAL_MS;
      return {
        record: { n: nextName, m: nextMime, e: nextExt, s: inRank, t: now },
        changed: changed,
        shouldTouchPersist: shouldTouchPersist
      };
    }

    // Both dom_truncated (1): upgrade only if missing name or incoming reveals a longer truncated prefix
    if ((!exName && inName) || (inName && exName && inName.length > exName.length)) {
      return {
        record: {
          n: inName,
          m: inMime || exMime,
          e: inExt || exExt,
          s: inRank,
          t: now
        },
        changed: true,
        shouldTouchPersist: true
      };
    }

    return { record: existing, changed: false, shouldTouchPersist: false };
  }

  function schedulePersistDriveCache() {
    if (drivePersistTimer !== null) {
      clearTimeout(drivePersistTimer);
      drivePersistTimer = null;
    }
    if (!hasChromeStorageLocal()) return;
    drivePersistTimer = setTimeout(() => {
      drivePersistTimer = null;
      flushDriveMetadataCache();
    }, DRIVE_PERSIST_DEBOUNCE_MS);
  }

  function flushDriveMetadataCache() {
    if (isFlushingDriveCache) return;
    if (driveHydrating) return;
    if (dirtyDriveIds.size === 0 || !hasChromeStorageLocal()) return;
    if (!canPersistNow()) {
      dirtyDriveIds.clear();
      return;
    }

    const batchIds = Array.from(dirtyDriveIds);
    batchIds.forEach((id) => dirtyDriveIds.delete(id));
    isFlushingDriveCache = true;

    try {
      chrome.storage.local.get([DRIVE_CACHE_STORAGE_KEY], (res) => {
        try {
          const now = Date.now();
          const rawStored = res && res[DRIVE_CACHE_STORAGE_KEY] && typeof res[DRIVE_CACHE_STORAGE_KEY] === 'object'
            ? res[DRIVE_CACHE_STORAGE_KEY]
            : {};

          const merged = new Map();
          const storedKeys = Object.keys(rawStored);
          for (let i = 0; i < storedKeys.length; i++) {
            const k = storedKeys[i];
            const normalized = normalizeStoredRecord(rawStored[k], now);
            if (normalized) {
              merged.set(k, normalized);
            }
          }

          // Read-modify-merge local dirty writes without overwriting other tabs' new entries
          for (let i = 0; i < batchIds.length; i++) {
            const id = batchIds[i];
            const liveRec = driveMetadataMap.get(id);
            if (!liveRec || isRecordExpired(liveRec, now)) continue;
            const storedRec = merged.get(id);
            if (!storedRec) {
              merged.set(id, cloneRecord(liveRec));
            } else if (liveRec.s > storedRec.s || (liveRec.s === storedRec.s && liveRec.t >= storedRec.t)) {
              merged.set(id, cloneRecord(liveRec));
            }
          }

          // Propagate L1 LRU read renewals for records present in both L1 and storage
          merged.forEach((storedRec, id) => {
            const liveRec = driveMetadataMap.get(id);
            if (liveRec && !isRecordExpired(liveRec, now) && liveRec.s >= storedRec.s && liveRec.t > storedRec.t) {
              storedRec.t = liveRec.t;
            }
          });

          const trimmedEntries = sortAndTrimEntries(merged, MAX_DRIVE_CACHE_ENTRIES);
          const serialized = {};
          for (let i = 0; i < trimmedEntries.length; i++) {
            const entry = trimmedEntries[i];
            serialized[entry[0]] = entry[1];
          }

          chrome.storage.local.set({ [DRIVE_CACHE_STORAGE_KEY]: serialized }, () => {
            isFlushingDriveCache = false;
            if (dirtyDriveIds.size > 0) {
              schedulePersistDriveCache();
            }
          });
        } catch (innerErr) {
          isFlushingDriveCache = false;
        }
      });
    } catch (outerErr) {
      isFlushingDriveCache = false;
    }
  }

  function initDriveMetadataCache(onHydrated, options) {
    const forceReload = Boolean(options && options.forceReload);
    if (typeof onHydrated === 'function') {
      hydrationCallbacks.push(onHydrated);
    }

    if (forceReload) {
      if (drivePersistTimer !== null) {
        clearTimeout(drivePersistTimer);
        drivePersistTimer = null;
      }
      driveMetadataMap.clear();
      dirtyDriveIds.clear();
      driveHydrated = false;
      driveHydrating = false;
    }

    const runCallbacks = () => {
      const cbs = hydrationCallbacks.slice();
      hydrationCallbacks = [];
      for (let i = 0; i < cbs.length; i++) {
        try {
          cbs[i]();
        } catch (err) {
          // Ignore callback failures to keep storage hydration resilient
        }
      }
    };

    if (driveHydrated && !forceReload) {
      runCallbacks();
      return;
    }

    if (driveHydrating && !forceReload) {
      return;
    }

    if (!hasChromeStorageLocal()) {
      driveHydrated = true;
      driveHydrating = false;
      runCallbacks();
      return;
    }

    driveHydrating = true;
    try {
      chrome.storage.local.get([DRIVE_CACHE_STORAGE_KEY], (res) => {
        try {
          const now = Date.now();
          const rawStored = res && res[DRIVE_CACHE_STORAGE_KEY] && typeof res[DRIVE_CACHE_STORAGE_KEY] === 'object'
            ? res[DRIVE_CACHE_STORAGE_KEY]
            : {};

          const merged = new Map();
          const storedKeys = Object.keys(rawStored);
          for (let i = 0; i < storedKeys.length; i++) {
            const k = storedKeys[i];
            const normalized = normalizeStoredRecord(rawStored[k], now);
            if (normalized) {
              merged.set(k, normalized);
            }
          }

          // Preserve any fresher or higher-rank metadata received in L1 before async storage load returned
          driveMetadataMap.forEach((sessionRec, id) => {
            if (isRecordExpired(sessionRec, now)) return;
            const storedRec = merged.get(id);
            if (!storedRec) {
              merged.set(id, cloneRecord(sessionRec));
            } else if (sessionRec.s > storedRec.s || (sessionRec.s === storedRec.s && sessionRec.t >= storedRec.t)) {
              merged.set(id, cloneRecord(sessionRec));
            }
          });

          const sortedEntries = sortAndTrimEntries(merged, MAX_DRIVE_CACHE_ENTRIES);
          driveMetadataMap.clear();
          for (let i = 0; i < sortedEntries.length; i++) {
            const entry = sortedEntries[i];
            driveMetadataMap.set(entry[0], entry[1]);
          }

          driveHydrated = true;
          driveHydrating = false;

          if (dirtyDriveIds.size > 0 && canPersistNow()) {
            schedulePersistDriveCache();
          }

          runCallbacks();
        } catch (innerErr) {
          driveHydrated = true;
          driveHydrating = false;
          runCallbacks();
        }
      });
    } catch (outerErr) {
      driveHydrated = true;
      driveHydrating = false;
      runCallbacks();
    }
  }

  function getDriveMetadata(fileId) {
    if (!fileId || typeof fileId !== 'string') return null;
    const key = fileId.trim();
    if (!key) return null;

    const existing = driveMetadataMap.get(key);
    if (!existing) return null;

    const now = Date.now();
    if (isRecordExpired(existing, now)) {
      driveMetadataMap.delete(key);
      dirtyDriveIds.delete(key);
      return null;
    }

    const prevT = typeof existing.t === 'number' ? existing.t : 0;
    existing.t = now;
    touchEntryInL1(key, existing);

    if ((now - prevT) >= DRIVE_TOUCH_PERSIST_INTERVAL_MS && canPersistNow()) {
      dirtyDriveIds.add(key);
      schedulePersistDriveCache();
    }

    return cloneRecord(existing);
  }

  function setDriveMetadata(fileId, meta, options) {
    if (!fileId || typeof fileId !== 'string' || !meta || typeof meta !== 'object') return false;
    const key = fileId.trim();
    if (!key) return false;

    const now = Date.now();
    let existing = driveMetadataMap.get(key) || null;
    if (existing && isRecordExpired(existing, now)) {
      driveMetadataMap.delete(key);
      existing = null;
    }

    const mergedResult = mergeDriveRecords(existing, meta, now);
    if (!mergedResult.record) return false;

    const shouldUpdateL1 = !existing || mergedResult.changed || mergedResult.shouldTouchPersist;
    if (shouldUpdateL1) {
      touchEntryInL1(key, mergedResult.record);
      trimL1MapInPlace(MAX_DRIVE_CACHE_ENTRIES);
    }

    if ((mergedResult.changed || mergedResult.shouldTouchPersist) && canPersistNow(options)) {
      dirtyDriveIds.add(key);
      schedulePersistDriveCache();
    }

    return mergedResult.changed;
  }

  function setDrivePersistenceValidator(fn) {
    drivePersistenceValidator = typeof fn === 'function' ? fn : null;
  }

  function clearDriveMetadataCache(callback) {
    if (drivePersistTimer !== null) {
      clearTimeout(drivePersistTimer);
      drivePersistTimer = null;
    }
    driveMetadataMap.clear();
    dirtyDriveIds.clear();
    driveHydrated = true;
    driveHydrating = false;

    if (hasChromeStorageLocal() && typeof chrome.storage.local.remove === 'function') {
      chrome.storage.local.remove([DRIVE_CACHE_STORAGE_KEY], () => {
        if (typeof callback === 'function') callback();
      });
    } else if (typeof callback === 'function') {
      callback();
    }
  }

  global.__AIStudioEnhancer__.State = {
    getHistory: () => conversationHistory,
    setHistory: (history) => { conversationHistory = history; },
    
    getTitle: () => promptTitle,
    setTitle: (title) => { promptTitle = title; },
    
    getCatalogData: () => catalogData,
    setCatalogData: (data) => { catalogData = data; },

    DRIVE_CACHE_STORAGE_KEY,
    MAX_DRIVE_CACHE_ENTRIES,
    DRIVE_CACHE_TTL_MS,
    DRIVE_SOURCE_RANK,
    initDriveMetadataCache,
    getDriveMetadata,
    setDriveMetadata,
    setDrivePersistenceValidator,
    clearDriveMetadataCache
  };

})(window);
