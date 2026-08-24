const STORAGE_KEY = "slipMateV3State";

const EMPTY_TAB_STATE = Object.freeze({
  selections: [],
  modeOverride: null,
  authState: "unknown",
  pageDetected: false,
  mappingError: ""
});

let mutationQueue = Promise.resolve();

function selectionKey(selection) {
  return `${selection.eventId}:${selection.selectionId}`;
}

function cleanSelection(selection) {
  if (!selection || typeof selection !== "object") return null;

  const eventId = String(selection.eventId || "").trim();
  const selectionId = String(selection.selectionId || "").trim();
  const fractionalOdd = String(selection.fractionalOdd || "").trim();

  if (!/^\d+$/.test(eventId) || !/^\d+$/.test(selectionId)) return null;
  if (!/^\d+\/\d+$/.test(fractionalOdd)) return null;

  const decimalOdd = Number(selection.decimalOdd);

  return {
    eventId,
    selectionId,
    fractionalOdd,
    decimalOdd: Number.isFinite(decimalOdd) && decimalOdd > 1 ? decimalOdd : null,
    selectionName: String(selection.selectionName || "").slice(0, 160),
    marketName: String(selection.marketName || "").slice(0, 160),
    eventName: String(selection.eventName || "").slice(0, 200),
    handicap: String(selection.handicap || "").slice(0, 60),
    marketId: String(selection.marketId || "").slice(0, 80)
  };
}

async function readRootState() {
  const stored = await chrome.storage.session.get(STORAGE_KEY);
  const root = stored[STORAGE_KEY];
  return root && typeof root === "object" && root.tabs
    ? root
    : { version: 3, tabs: {} };
}

function normalizeTabState(value) {
  return {
    ...EMPTY_TAB_STATE,
    ...(value || {}),
    selections: Array.isArray(value?.selections)
      ? value.selections.map(cleanSelection).filter(Boolean)
      : []
  };
}

async function getTabState(tabId) {
  const root = await readRootState();
  return normalizeTabState(root.tabs[String(tabId)]);
}

function updateTabState(tabId, updater) {
  mutationQueue = mutationQueue.catch(() => undefined).then(async () => {
    const root = await readRootState();
    const key = String(tabId);
    const current = normalizeTabState(root.tabs[key]);
    const next = normalizeTabState(updater(current));

    root.tabs[key] = next;
    await chrome.storage.session.set({ [STORAGE_KEY]: root });
    return next;
  });

  return mutationQueue;
}

async function broadcastState(tabId, state) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: "SLIP_MATE_STATE_CHANGED",
      state
    });
  } catch (_error) {
    // The content script may not be mounted yet.
  }
}

function resolveTabId(request, sender) {
  const candidate = sender.tab?.id ?? request.tabId;
  return Number.isInteger(candidate) ? candidate : null;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || typeof request.action !== "string") return undefined;

  const tabId = resolveTabId(request, sender);

  (async () => {
    if (request.action === "SLIP_MATE_GET_STATE") {
      sendResponse({ ok: true, state: tabId === null ? null : await getTabState(tabId) });
      return;
    }

    if (tabId === null) {
      sendResponse({ ok: false, error: "Bet365 tab not found" });
      return;
    }

    let next;

    switch (request.action) {
      case "SLIP_MATE_TOGGLE_SELECTION": {
        const selection = cleanSelection(request.selection);
        if (!selection) {
          sendResponse({ ok: false, error: "Invalid selection" });
          return;
        }

        next = await updateTabState(tabId, (state) => {
          const key = selectionKey(selection);
          const exists = state.selections.some((item) => selectionKey(item) === key);
          return {
            ...state,
            mappingError: "",
            selections: exists
              ? state.selections.filter((item) => selectionKey(item) !== key)
              : [...state.selections, selection]
          };
        });
        break;
      }

      case "SLIP_MATE_REMOVE_SELECTION":
        next = await updateTabState(tabId, (state) => ({
          ...state,
          selections: state.selections.filter(
            (item) => selectionKey(item) !== String(request.key || "")
          )
        }));
        break;

      case "SLIP_MATE_CLEAR":
        next = await updateTabState(tabId, (state) => ({
          ...state,
          selections: [],
          mappingError: ""
        }));
        break;

      case "SLIP_MATE_SET_MODE":
        next = await updateTabState(tabId, (state) => ({
          ...state,
          modeOverride:
            request.enabled === null || request.enabled === undefined
              ? null
              : Boolean(request.enabled)
        }));
        break;

      case "SLIP_MATE_SET_CONTEXT":
        next = await updateTabState(tabId, (state) => ({
          ...state,
          authState: ["logged-in", "logged-out", "unknown"].includes(request.authState)
            ? request.authState
            : "unknown",
          pageDetected: true
        }));
        break;

      case "SLIP_MATE_MAPPING_ERROR":
        next = await updateTabState(tabId, (state) => ({
          ...state,
          mappingError: String(request.message || "Não foi possível identificar esta seleção.").slice(0, 180)
        }));
        break;

      default:
        sendResponse({ ok: false, error: "Unknown action" });
        return;
    }

    await broadcastState(tabId, next);
    sendResponse({ ok: true, state: next });
  })().catch((error) => {
    sendResponse({ ok: false, error: error?.message || "Unexpected extension error" });
  });

  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  mutationQueue = mutationQueue.catch(() => undefined).then(async () => {
    const root = await readRootState();
    delete root.tabs[String(tabId)];
    await chrome.storage.session.set({ [STORAGE_KEY]: root });
  });
});
