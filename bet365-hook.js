(function initializeBet365Hook(scope) {
  const PAGE_SOURCE = "SLIP_MATE_PAGE";
  const CONTENT_SOURCE = "SLIP_MATE_CONTENT";

  function ownKeys(value) {
    try {
      return Reflect.ownKeys(value || {});
    } catch (_error) {
      return [];
    }
  }

  function isStem(value) {
    return Boolean(value && typeof value === "object" && value.data && typeof value.data === "object");
  }

  function getStemFromProps(props) {
    if (!props || typeof props !== "object") return null;
    if (isStem(props.stem)) return props.stem;
    if (isStem(props.pushStem)) return props.pushStem;
    return null;
  }

  function findFiber(node) {
    for (const key of ownKeys(node)) {
      if (
        typeof key === "string" &&
        (key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$"))
      ) {
        return node[key];
      }
    }
    return null;
  }

  function findStemOnNode(node) {
    for (const key of ownKeys(node)) {
      if (typeof key !== "string") continue;
      if (key.startsWith("__reactProps$")) {
        const stem = getStemFromProps(node[key]);
        if (stem) return stem;
      }
    }

    let fiber = findFiber(node);
    let depth = 0;
    while (fiber && depth < 32) {
      const stem =
        getStemFromProps(fiber.memoizedProps) ||
        getStemFromProps(fiber.pendingProps) ||
        getStemFromProps(fiber.stateNode);
      if (stem) return stem;
      fiber = fiber.return;
      depth += 1;
    }
    return null;
  }

  function nameFromData(data) {
    if (!data) return "";
    if (data.NA) return String(data.NA);
    if (data.N1 && data.N2) return `${data.N1} v ${data.N2}`;
    return String(data.N1 || data.N2 || data.HT || "");
  }

  function extractSelectionFromStem(stem, context = {}) {
    if (!isStem(stem)) return null;

    const selectionId = String(stem.data.ID || "").trim();
    const fractionalOdd = String(stem.data.OD || "").trim();

    if (!/^\d+$/.test(selectionId) || !/^\d+\/\d+$/.test(fractionalOdd)) {
      return null;
    }
    if (stem.data.SU && String(stem.data.SU) !== "0") return null;

    let cursor = stem;
    let eventId = "";
    let eventName = "";
    let marketName = "";
    let marketId = "";
    let depth = 0;

    while (isStem(cursor) && depth < 40) {
      const data = cursor.data;

      if (!marketId && data.MA) marketId = String(data.MA);
      if (!marketId && cursor.nodeName === "MA" && data.ID) marketId = String(data.ID);

      if (
        cursor !== stem &&
        !marketName &&
        (data.MA || cursor.nodeName === "MA" || cursor.nodeName === "MG")
      ) {
        marketName = nameFromData(data);
      }

      if (data.FI || data.PF) {
        if (!eventId) eventId = String(data.FI || data.PF);
        const candidateName = nameFromData(data);
        const isFixtureStem = cursor.nodeName === "EV" || Boolean(data.N1 && data.N2);
        if (candidateName && (!eventName || isFixtureStem)) eventName = candidateName;
      }

      cursor = cursor.parent;
      depth += 1;
    }

    if (!/^\d+$/.test(eventId)) return null;

    const decimalOdd = Number.parseFloat(String(context.decimalOdd || "").replace(",", "."));
    return {
      eventId,
      selectionId,
      fractionalOdd,
      decimalOdd: Number.isFinite(decimalOdd) && decimalOdd > 1 ? decimalOdd : null,
      selectionName: String(stem.data.NA || context.selectionName || "").trim(),
      marketName: String(marketName || context.marketName || "").trim(),
      eventName: String(eventName || context.eventName || "").trim(),
      handicap: String(stem.data.HA || stem.data.HD || "").trim(),
      marketId
    };
  }

  const api = { extractSelectionFromStem, findStemOnNode, nameFromData };
  if (typeof module === "object" && module.exports) module.exports = api;

  if (!scope.document || scope.__SLIP_MATE_HOOK_INSTALLED__) return;
  scope.__SLIP_MATE_HOOK_INSTALLED__ = true;

  function getPotentialParticipant(path) {
    return path.find((node) => {
      if (!(node instanceof Element)) return false;
      return (
        node.classList?.contains("rgl-43895c") ||
        node.classList?.contains("rgl-4a5de5")
      );
    });
  }

  function getStemPotential(path) {
    for (const node of path) {
      if (!(node instanceof Element)) continue;
      const stem = findStemOnNode(node);
      if (isStem(stem) && ("OD" in stem.data || stem.nodeName === "PA")) {
        return getDisplayContext(node).participant || node;
      }
    }
    return null;
  }

  function getDisplayContext(element) {
    if (!(element instanceof Element)) return {};
    const participant = element.classList.contains("rgl-43895c")
      ? element
      : element.closest(".rgl-43895c") || element;
    const oddsElement = participant.matches(".rgl-4a5de5")
      ? participant
      : participant.querySelector(".rgl-4a5de5");
    return { participant, decimalOdd: oddsElement?.textContent?.trim() || "" };
  }

  function resolveSelection(path) {
    for (const node of path) {
      if (!(node instanceof Element)) continue;
      const stem = findStemOnNode(node);
      if (!stem) continue;
      const context = getDisplayContext(node);
      const selection = extractSelectionFromStem(stem, context);
      if (selection) return { selection, element: context.participant || node };
    }
    return null;
  }

  let enabled = false;
  let selectedKeys = new Set();
  let lastHandled = { key: "", at: 0 };
  let lastFailureAt = 0;
  const knownElements = new Map();

  function keyFor(selection) {
    return `${selection.eventId}:${selection.selectionId}`;
  }

  function post(type, payload) {
    scope.postMessage({ source: PAGE_SOURCE, type, payload }, "*");
  }

  function rememberElement(key, element) {
    if (!(element instanceof Element)) return;
    element.setAttribute("data-slip-mate-selection-key", key);
    element.toggleAttribute("data-slip-mate-selected", selectedKeys.has(key));
    if (!knownElements.has(key)) knownElements.set(key, new Set());
    knownElements.get(key).add(element);
  }

  function refreshHighlights() {
    for (const [key, elements] of knownElements) {
      for (const element of elements) {
        if (!element.isConnected) {
          elements.delete(element);
        } else {
          element.toggleAttribute("data-slip-mate-selected", selectedKeys.has(key));
        }
      }
      if (elements.size === 0) knownElements.delete(key);
    }
  }

  function block(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function handleSelectionEvent(event) {
    if (!enabled || event.button > 0) return;

    const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
    const resolved = resolveSelection(path);
    const potential = resolved?.element || getStemPotential(path) || getPotentialParticipant(path);

    if (!resolved) {
      if (!potential) return;
      block(event);
      const now = Date.now();
      if ((event.type === "pointerdown" || event.type === "click") && now - lastFailureAt > 700) {
        lastFailureAt = now;
        post("BET365_MAPPING_ERROR", {
          code: "unsupportedMarket"
        });
      }
      return;
    }

    block(event);
    const key = keyFor(resolved.selection);
    const now = Date.now();
    const isPrimaryEvent = event.type === "pointerdown" || event.type === "click";
    const isDuplicate = lastHandled.key === key && now - lastHandled.at < 800;

    if (isPrimaryEvent && !isDuplicate) {
      lastHandled = { key, at: now };
      rememberElement(key, resolved.element);
      post("BET365_SELECTION", resolved.selection);
    }
  }

  for (const eventName of ["pointerdown", "mousedown", "mouseup", "click"]) {
    document.addEventListener(eventName, handleSelectionEvent, {
      capture: true,
      passive: false
    });
  }

  scope.addEventListener("message", (event) => {
    if (event.source !== scope || event.data?.source !== CONTENT_SOURCE) return;

    if (event.data.type === "SET_MODE") {
      enabled = event.data.payload?.enabled === true;
      document.documentElement?.setAttribute("data-slip-mate-mode", enabled ? "on" : "off");
      return;
    }

    if (event.data.type === "SET_SELECTED_KEYS") {
      const keys = event.data.payload?.keys;
      selectedKeys = new Set(Array.isArray(keys) ? keys.map(String) : []);
      refreshHighlights();
    }
  });

  post("HOOK_READY", { strategy: "react-stem" });
})(typeof globalThis !== "undefined" ? globalThis : this);
