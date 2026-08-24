(function initializeSlipMateContent(root) {
  const PAGE_SOURCE = "SLIP_MATE_PAGE";
  const CONTENT_SOURCE = "SLIP_MATE_CONTENT";
  const store = root.SlipMateStore;
  const parser = root.SlipMateParser;
  const urlBuilder = root.SlipMateURL;

  let authState = "unknown";
  let extensionState = { selections: [], modeOverride: null, mappingError: "" };
  let ui = null;
  let authTimer = null;
  let lastContextSent = "";

  function safeBetstring() {
    try {
      return sessionStorage.getItem("betstring") || "";
    } catch (_error) {
      return "";
    }
  }

  function buttonTexts() {
    return [...document.querySelectorAll("button")]
      .slice(0, 250)
      .filter((button) => button.getClientRects().length > 0)
      .map((button) => button.textContent.trim().toLocaleLowerCase())
      .filter(Boolean);
  }

  function detectAuthState() {
    return parser.detectAuthState({
      betstring: safeBetstring(),
      buttonTexts: buttonTexts()
    });
  }

  function getEffectiveMode() {
    return extensionState.modeOverride === true;
  }

  function postToPage(type, payload) {
    root.postMessage({ source: CONTENT_SOURCE, type, payload }, "*");
  }

  function applyState(nextState) {
    if (nextState) extensionState = { ...extensionState, ...nextState };

    const effectiveMode = getEffectiveMode();
    postToPage("SET_MODE", { enabled: effectiveMode });
    postToPage("SET_SELECTED_KEYS", {
      keys: extensionState.selections.map(
        (selection) => `${selection.eventId}:${selection.selectionId}`
      )
    });
    ui?.update({
      selections: extensionState.selections,
      mappingError: extensionState.mappingError,
      visible: effectiveMode
    });
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_error) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.documentElement.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
  }

  async function copyCustomSlip() {
    try {
      const url = urlBuilder.buildBet365Url(extensionState.selections, {
        baseUrl: location.origin
      });
      await copyText(url);
      ui?.showToast("Link Bet365 copiado");
    } catch (error) {
      ui?.showToast(error.message);
    }
  }

  function mountUI() {
    if (ui || !document.documentElement) return;
    ui = root.SlipMateUI.create({
      onCopy: copyCustomSlip,
      onClear: async () => applyState(await store.clear()),
      onRemove: async (key) => applyState(await store.remove(key))
    });
    applyState();
  }

  function refreshAuthState() {
    if (authTimer) return;
    authTimer = setTimeout(async () => {
      authTimer = null;
      const detected = detectAuthState();
      if (detected === authState && detected === lastContextSent) return;

      authState = detected;
      applyState();

      if (detected !== lastContextSent) {
        lastContextSent = detected;
        try {
          extensionState = await store.setContext(detected);
          applyState();
        } catch (_error) {
          // A worker restart is recovered by the next state request.
        }
      }
    }, 180);
  }

  root.addEventListener("message", async (event) => {
    if (event.source !== root || event.data?.source !== PAGE_SOURCE) return;

    if (event.data.type === "HOOK_READY") {
      applyState();
      return;
    }

    if (event.data.type === "BET365_SELECTION") {
      if (!getEffectiveMode()) return;
      const selection = parser.normalizeSelection(event.data.payload);
      if (!selection) {
        applyState(
          await store.setMappingError("A Bet365 não forneceu todos os dados desta seleção.")
        );
        return;
      }
      applyState(await store.toggle(selection));
      return;
    }

    if (event.data.type === "BET365_MAPPING_ERROR" && getEffectiveMode()) {
      applyState(
        await store.setMappingError(
          event.data.payload?.message || "Este mercado ainda não é compatível."
        )
      );
    }
  });

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === "SLIP_MATE_STATE_CHANGED") {
      applyState(request.state);
      sendResponse({ ok: true });
      return undefined;
    }

    if (request.action === "getBetstring") {
      sendResponse({ betstring: safeBetstring() });
      return undefined;
    }

    if (request.action === "SLIP_MATE_GET_PAGE_STATE") {
      (async () => {
        const state = await store.getState();
        const legacySelections = authState === "logged-in"
          ? parser.parseLegacyBetstring(safeBetstring())
          : [];
        const legacyUrl = legacySelections.length
          ? urlBuilder.buildBet365Url(legacySelections, { baseUrl: location.origin })
          : "";

        sendResponse({
          ok: true,
          authState,
          effectiveMode: getEffectiveMode(),
          state,
          baseUrl: location.origin,
          legacyAvailable: legacySelections.length > 0,
          legacySelections,
          legacyUrl
        });
      })().catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }

    return undefined;
  });

  (async () => {
    try {
      extensionState = await store.getState();
    } catch (_error) {
      // Defaults keep the page safe until the worker responds again.
    }

    mountUI();
    refreshAuthState();

    const startObserver = () => {
      const target = document.body || document.documentElement;
      if (!target) return;
      new MutationObserver(refreshAuthState).observe(target, {
        childList: true,
        subtree: true
      });
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        mountUI();
        refreshAuthState();
        startObserver();
      }, { once: true });
    } else {
      startObserver();
    }
  })();
})(globalThis);
